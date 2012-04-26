var scope = 'https://spreadsheets.google.com/feeds';
var client_id = '';
var client_secret = '';


function OAuth2TokenRequest() {
    var self_url = chrome.extension.getURL('/options.html');
    location.href = 'https://accounts.google.com/o/oauth2/auth?' +
	'response_type=token&client_id=' + encodeURIComponent(client_id) +
	'&redirect_uri=' + encodeURIComponent(self_url) + '&scope=' +
	encodeURIComponent(scope) + '&access_type=online';
}


function OAuth2ResponseCallback(xhr, callback) {
    return function() {
	if (xhr.readyState != 4) {
	    return;
	}
	var result = JSON.parse(xhr.responseText);
	localStorage.setItem('upload_sheet_token', result['access_token']);
	localStorage.setItem('upload_expires', (new Date()).getItem() + result['expires_in'] * 1000);
	localStorage.setItem('upload_refresh_token', result['refresh_token']);
	callback(true);
    }
}

function handleOAuth2Response(return_url) {
    var params = {};
    var param_array = location.search.substring(1).split('&');
    for (var i = 0; i < param_array.length; ++i) {
	var vs = param_array[i].split('=');
	if (vs.length != 2) {
	    continue;
	}
	params[vs[0]] = vs[1];
    }
    var body = 'code=' + encodeURIComponent(params['state']) +
	'&client_id=' + encodeURIComponent(client_id) + '&client_secret=' +
	encodeURIComponent(client_secret) + '&redirect_uri=' +
	encodeURIComponent(return_url) + '&grant_type=authorization_code';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://accounts.google.com/o/oauth2/token');
    xhr.onreadystatechange = OAuth2ResponseCallback(xhr, function() {
	location.href = return_url;
    });
    xhr.send(body);
}


function refreshOAuth2Token(callback) {
    var refresh_token = localStorage.getItem('upload_refresh_token');
    if (!refresh_token) {
	callback(false);
	return;
    }

    var body = 'refresh_token=' + encodeURIComponent(refresh_token) +
	'&client_id=' + encodeURIComponent(client_id) +
	'&cleint_secret=' + encodeURIComponent(client_secret) +
	'&grant_type=refresh_token';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://accounts.google.com/o/oauth2/token');
    xhr.onreadystatechange = OAuth2ResponseCallback(xhr, callback);
    xhr.send(body);
}
