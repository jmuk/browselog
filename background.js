var uploader = {
    'upload_url': null,
    'last_upload_url': null,
    'setUploadURL': function(url) {
	this.upload_url = url;
	localStorage.setItem('upload_sheet_url', url);
	localStorage.setItem('upload_sheet_token', null);
	localStorage.setItem('upload_expires', null);
	localStorage.setItem('upload_refresh_token', null);
    },
    'uploadNow': function() {
	function FillCommonHeaders(xhr) {
	    xhr.setRequestHeader('GData-Version', '3.0');
	    xhr.setRequestHeader('Authorization', 'Bearer ' + token);
	}
	function RunSpreadsheetAPI(method, path, callback) {
	    var xhr = new XMLHttpRequest();
	    xhr.open(method, 'https://spreadsheets.google.com/feeds/' + path);
	    xhr.onreadystatechange = function() {
		if (xhr.readyState != 4) {
		    return;
		}
		console.log(xhr.responseText);
		if (callback) {
		    callback(xhr);
		}
	    }
	    FillCommonHeaders(xhr);
	    xhr.send();
	}
	function uploadCells(worksheet_id, last_row) {
	    function escapeParam(str) {
		return String(str).replace('&', '&amp;').replace('"', '&quot;');
	    }
	    function postData(row, col, data) {
		var postdata = '<?xml version="1.0" encoding="UTF-8"?><entry xmlns="http://www.w3.org/2005/Atom" xmlns:gs="http://schemas.google.com/spreadsheets/2006" ><id>https://spreadsheets.google.com/feeds/cells/' + worksheet_id + '/private/full/R' + row + 'C' + col + '</id><link rel="edit" type="application/atom+xml" href="https://spreadsheets.google.com/feeds/cells/' + worksheet_id + '/private/full/R' + row + 'C' + col + '"/><gs:cell row="' + row + '" col="' + col + '" inputValue="' + escapeParam(data) + '"/></entry>';
		var xhr = new XMLHttpRequest();
		xhr.open('PUT', 'https://spreadsheets.google.com/feeds/cells/' + worksheet_id + '/private/full/R' + row + 'C' + col);
		FillCommonHeaders(xhr);
		xhr.setRequestHeader('Content-Type', 'application/atom+xml');
		xhr.setRequestHeader('If-None-Match', '');
		xhr.send(postdata);
	    }
	    for (var i = 0; i < activityRecorder.log.length - 1; i++) {
		var row = last_row + i + 1;
		var activity = activityRecorder.log[i];
		var start = activity.starttime;
		var date = (start.getMonth() + 1) + '/' + start.getDate();
		var time = (start.getHours()) + ':' + start.getMinutes() + ':' + start.getSeconds();
		postData(row, 1, date);
		postData(row, 2, time);
		postData(row, 3, Math.floor((activity.endtime.getTime() - activity.starttime.getTime()) / 1000));
		postData(row, 4, activity.url);
		postData(row, 5, (activity.opener_url || ''));
		postData(row, 6, (activity.tag || ''));
	    }
	}
	function findLastCell(worksheet_id) {
	    RunSpreadsheetAPI('GET', 'cells/' + worksheet_id + '/private/full?alt=json', function(xhr) {
		var data = JSON.parse(xhr.responseText);
		var entries = data.feed.entry;
		var max_row = 0;
		for (var i = 0; i < entries.length; i++) {
		    var entry = entries[i];
		    var row = Number(entry['gs$cell']['row']);
		    if (max_row < row) {
			max_row = row;
		    }
		}
		uploadCells(worksheet_id, max_row);
	    });
	}
	function findWorksheet() {
	    RunSpreadsheetAPI('GET', 'worksheets/' + key + '/private/full?alt=json', function(xhr) {
		var data = JSON.parse(xhr.responseText);
		var sheet_id = data.feed.entry[0].id['$t'];
		var prefix = 'https://spreadsheets.google.com/feeds/worksheets/';
		if (sheet_id.indexOf(prefix) == 0) {
		    findLastCell(sheet_id.substring(prefix.length));
		}
	    });
	}
	function uploadInternal() {
	    findWorksheet();
	}

	if (!this.upload_url) {
	    return;
	}
	var match = /key=([a-zA-Z0-9]*)/.exec(this.upload_url);
	if (!match) {
	    return;
	}
	var key = match[1];
	var token = localStorage.getItem('upload_sheet_token');
	if (!token) {
	    return;
	}
	var expires = localStorage.getItem('upload_expires');
	if ((new Date()).getTime() > expires) {
	    refreshOAuth2Token(function(result) { if (result) { uploadInternal() }});
	}
	uploadInternal();
    }
};

var activityRecorder = {
    'log': [],
    'latest': null,
    'tabs': {},
    'recordNewTab': function(tab) {
	var self = this;
	function recordNewTabInternal(newRecord) {
	    if (self.log.length == 0) {
		self.log.push(newRecord);
		self.tabs[tab.id] = newRecord;
		return;
	    }
	    var latest = self.log[self.log.length - 1];
	    if (latest.url == newRecord.url) {
		latest.endtime = newRecord.endtime;
		return;
	    }
	    if (newRecord.starttime.getTime() - latest.starttime.getTime() <
		3 * 1000) {
		self.log.pop();
		recordNewTabInternal(newRecord);
		return;
	    }
	    latest.endtime = newRecord.starttime;
	    self.log.push(newRecord);
	    self.tabs[tab.id] = newRecord;
	}
	if (tab.status != 'complete') {
	    return;
	}
	var newRecord = {
	    url: tab.url,
	    starttime: new Date(),
	    endtime: new Date()
	};
	if (activityRecorder.tabs[tab.id]) {
	    newRecord.opener_url = activityRecorder.tabs[tab.id].url;
	    recordNewTabInternal(newRecord);
	} else if (tab.openerTabId) {
	    chrome.tabs.get(tab.openerTabId, function(tab) {
		newRecord.opener_url = tab.url;
		recordNewTabInternal(newRecord);
	    });
	} else {
	    recordNewTabInternal(newRecord);
	}
    }
};


chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
	activityRecorder.recordNewTab(tab);
    });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status == "complete") {
	activityRecorder.recordNewTab(tab);
    }
});

chrome.windows.onFocusChanged.addListener(function(windowId) {
    if (windowId == chrome.windows.WINDOW_ID_NONE) {
	return;
    }
    chrome.windows.get(windowId, {'populate':true}, function(w) {
	if (!w.focused) {
	    return;
	}
	if (!w.tabs) {
	    return;
	}
	for (var i = 0; i < w.tabs.length; i++) {
	    var tab = w.tabs[i];
	    if (tab.active) {
		activityRecorder.recordNewTab(tab);
	    }
	}
    });
});

window.addEventListener('load', function() {
    uploader.upload_url = localStorage.getItem('upload_sheet_url');
});
