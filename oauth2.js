var scope = 'https://spreadsheets.google.com/feeds';
var client_id = '';
var client_secret = '';


function OAuth2TokenRequest() {
    var self_url = chrome.extension.getURL('/options.html');
    chrome.windows.create(
	{url:'https://accounts.google.com/o/oauth2/auth?' +
	 'response_type=code&client_id=' + encodeURIComponent(client_id) +
	 '&redirect_uri=urn:ietf:wg:oauth:2.0:oob' + '&scope=' +
	 encodeURIComponent(scope) + '&access_type=offline',
	 type:'popup'});
    var timer = window.setInterval(function() {
	chrome.windows.getLastFocused({populate:true}, function(w) {
	    for (var i = 0; i < w.tabs.length; ++i) {
		var tab = w.tabs[i];
		if (!tab.active) {
		    continue;
		}
		var title = tab.title;
		var codePos = title.indexOf('code=');
		if (codePos > 0) {
		    var code = title.substring(
			codePos + 'code='.length, title.length);
		    console.log(code);
		    handleOAuth2Code(code);
		    chrome.windows.remove(w.id);
		    window.clearInterval(timer);
		}
	    }
	});
    }, 100);
}


function OAuth2ResponseCallback(xhr, callback) {
    return function() {
	if (xhr.readyState != 4) {
	    return;
	}
	var result = JSON.parse(xhr.responseText);
	localStorage.setItem('upload_sheet_token', result['access_token']);
	localStorage.setItem('upload_expires', (new Date()).getTime() + result['expires_in'] * 1000);
	if (result['refresh_token']) {
	    localStorage.setItem('upload_refresh_token', result['refresh_token']);
	} else {
	    localStorage.setTime('upload_refresh_token', null);
	}
	if (callback) {
	    callback(true);
	}
    }
}

function handleOAuth2Code(code) {
    var body = 'code=' + code + '&client_id=' + encodeURIComponent(client_id) +
	'&client_secret=' + encodeURIComponent(client_secret) +
	'&redirect_uri=urn:ietf:wg:oauth:2.0:oob&grant_type=authorization_code';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://accounts.google.com/o/oauth2/token');
    xhr.onreadystatechange = OAuth2ResponseCallback(xhr);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send(body);
}


function refreshOAuth2Token(callback) {
    var refresh_token = localStorage.getItem('upload_refresh_token');
    if (!refresh_token) {
	callback(false);
	return;
    }

    var body = 'refresh_token=' + refresh_token +
	'&client_id=' + encodeURIComponent(client_id) +
	'&cleint_secret=' + encodeURIComponent(client_secret) +
	'&grant_type=refresh_token';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://accounts.google.com/o/oauth2/token');
    xhr.onreadystatechange = OAuth2ResponseCallback(xhr, callback);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.send(body);
}
