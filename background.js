var uploader = {
    'upload_url': null,
    'last_upload_url': null,
    'last_uploaded': null,
    'setUploadURL': function(url) {
	this.upload_url = url;
	localStorage.setItem('upload_sheet_url', url);
	localStorage.setItem('upload_sheet_token', null);
	localStorage.setItem('upload_expires', null);
	localStorage.setItem('upload_refresh_token', null);
    },
    'uploadNow': function() {
	function OnUploadFinished(activities) {
	    activityRecorder.log = activityRecorder.log.slice(activities.length);
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
	last_uploaded = new Date();
	if ((new Date()).getTime() > expires) {
	    refreshOAuth2Token(function(result) { if (result) { startUploadTask(key, token, activityRecorder.log, OnUploadFinished) }});
	}
	startUploadTask(key, token, activityRecorder.log, OnUploadFinished);
    },
    'uploadTask': function(self) {
	return function () {
	    var now = new Date();
	    if (self.last_uploaded &&
		(now.getTime() - self.last_uploaded.getTime() < 10 * 1000)) {
		return;
	    }
	    self.uploadNow();
	};
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
	function cleanupURL(url) {
	    var hashpos = url.indexOf('#');
	    if (hashpos >= 0) {
		url = url.substring(0, hashpos);
	    }
	    return url;
	}
	if (tab.status != 'complete') {
	    return;
	}
	var newRecord = {
	    url: cleanupURL(tab.url),
	    starttime: new Date(),
	    endtime: new Date()
	};
	if (activityRecorder.tabs[tab.id]) {
	    newRecord.opener_url = cleanupURL(activityRecorder.tabs[tab.id].url);
	    recordNewTabInternal(newRecord);
	} else if (tab.openerTabId) {
	    chrome.tabs.get(tab.openerTabId, function(tab) {
		newRecord.opener_url = cleanupURL(tab.url);
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
    if (!tab.active) {
	return;
    }
    if (changeInfo.status != "complete") {
	return;
    }
    chrome.windows.get(tab.windowId, null, function(w) {
	if (!w.focused) {
	    return;
	}
	activityRecorder.recordNewTab(tab);
    });
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
    window.setInterval(uploader.uploadTask(uploader), 60 * 1000);
});
