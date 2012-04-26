var activityRecorder = {
    'log': [],
    'latest': null,
    'recordNewTab': function(tab) {
	var self = this;
	function recordNewTabInternal(newRecord) {
	    if (self.log.length == 0) {
		self.log.push(newRecord);
		return;
	    }
	    var latest = self.log[self.log.length - 1];
	    if (latest.url == newRecord.url) {
		latest.endtime = newRecord.endtime;
		return;
	    }
	    if (newRecord.starttime.getTime() - latest.endtime.getTime() <
		3 * 1000) {
		self.log.pop();
		recordNewTabInternal(newRecord);
		return;
	    }
	    latest.endtime = newRecord.starttime;
	    self.log.push(newRecord);
	}
	if (tab.status != 'complete') {
	    return;
	}
	var newRecord = {
	    url: tab.url,
	    starttime: new Date(),
	    endtime: new Date()
	};
	if (tab.openerTabId) {
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
