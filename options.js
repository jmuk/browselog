function redrawSheetURL() {
    var url = chrome.extension.getBackgroundPage().uploader.upload_url;
    var div = document.getElementById('show_sheet_url');
    if (url) {
	div.innerHTML = '';
	var anchor = document.createElement('a');
	anchor.href = url;
	anchor.appendChild(document.createTextNode(url));
	div.appendChild(anchor);
	div.appendChild(document.createTextNode(localStorage.getItem('upload_sheet_token')));
	div.style.display = 'block';
    } else {
	div.style.display = 'none';
    }
}


function redrawLog() {
    function addColumn(row, txt) {
	var td = document.createElement('td');
	td.appendChild(document.createTextNode(txt));
	row.appendChild(td);
    }
    var log = chrome.extension.getBackgroundPage().activityRecorder.log;
    var tbl = document.createElement('table');
    var is_first = true;
    for (var i = log.length - 1; i >= 0; i--) {
	var row = document.createElement('tr');
	var record = log[i];
	addColumn(row, record.url);
	addColumn(row, record.opener_url || "");
	addColumn(row, record.starttime);
	addColumn(row, (i == log.length - 1) ? "" : record.endtime);
	addColumn(row, record.tag || "");
	tbl.appendChild(row);
    }
    var div = document.getElementById('onmemory_data');
    div.innerHTML = '';
    div.appendChild(tbl);
}


function updateSheetURL() {
    var url = document.getElementById('sheet_url').value;
    chrome.extension.getBackgroundPage().uploader.setUploadURL(url);
    redrawSheetURL();
    OAuth2TokenRequest();
    return false;
}


function uploadNow() {
    chrome.extension.getBackgroundPage().uploader.uploadNow();
    return false;
}


window.addEventListener('load', function() {
    if (location.search) {
	handleOAuth2Response(chrome.extension.getURL('/options.html'));
	return;
    }
    redrawSheetURL();
    redrawLog();
    document.getElementById('sheet_url_form').onsubmit = updateSheetURL;
    document.getElementById('upload_sheet_form').onsubmit = uploadNow;
});
