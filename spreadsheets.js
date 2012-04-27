function startUploadTask(key, token, in_activities, final_callback) {
    // Creates a shallow copy.
    var activities = [];
    for (var i = 0; i < in_activities.length - 1; i++) {
	activities.push(in_activities[i]);
    }

    function FillCommonHeaders(xhr) {
	xhr.setRequestHeader('GData-Version', '3.0');
	xhr.setRequestHeader('Authorization', 'Bearer ' + token);
    }

    function escapeParam(str) {
	return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    function RunSpreadsheetAPI(path, callback) {
	var xhr = new XMLHttpRequest();
	xhr.open('GET', 'https://spreadsheets.google.com/feeds/' + path);
	xhr.onreadystatechange = function() {
	    if (xhr.readyState != 4) {
		return;
	    }
	    if (callback) {
		callback(xhr);
	    }
	}
	FillCommonHeaders(xhr);
	xhr.send();
    }

    function uploadCells(worksheet_id, last_row) {
	var callback_count = activities.length * 6;
	var callback_called = 0;

	function postData(row, col, data) {
	    var postdata = '<?xml version="1.0" encoding="UTF-8"?><entry xmlns="http://www.w3.org/2005/Atom" xmlns:gs="http://schemas.google.com/spreadsheets/2006" ><id>https://spreadsheets.google.com/feeds/cells/' + worksheet_id + '/private/full/R' + row + 'C' + col + '</id><link rel="edit" type="application/atom+xml" href="https://spreadsheets.google.com/feeds/cells/' + worksheet_id + '/private/full/R' + row + 'C' + col + '"/><gs:cell row="' + row + '" col="' + col + '" inputValue="' + escapeParam(data) + '"/></entry>';
	    var xhr = new XMLHttpRequest();
	    xhr.open('PUT', 'https://spreadsheets.google.com/feeds/cells/' + worksheet_id + '/private/full/R' + row + 'C' + col);
	    FillCommonHeaders(xhr);
	    xhr.setRequestHeader('Content-Type', 'application/atom+xml');
	    xhr.setRequestHeader('If-None-Match', '');
	    xhr.onreadystatechange = function() {
		if (xhr.readyState != 4) {
		    return;
		}
		callback_called += 1;
		console.log(callback_called, callback_count);
		if (callback_called >= callback_count) {
		    final_callback(activities);
		}
	    }
	    xhr.send(postdata);
	}

	for (var i = 0; i < activities.length; i++) {
	    var row = last_row + i + 1;
	    var activity = activities[i];
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
	RunSpreadsheetAPI('cells/' + worksheet_id + '/private/full?alt=json', function(xhr) {
	    var data = JSON.parse(xhr.responseText);
	    var entries = data.feed.entry;
	    var max_row = 0;
	    for (var i = 0; i < entries.length; i++) {
		var entry = entries[i];
		var row = Number(entry['gs$cell']['row']);
		var val = entry['gs$cell']['inputValue'];
		// skip empty cells
		if (!val) {
		    continue;
		}
		if (max_row < row) {
		    max_row = row;
		}
	    }
	    uploadCells(worksheet_id, max_row);
	});
    }
	
    function findWorksheet() {
	RunSpreadsheetAPI('worksheets/' + key + '/private/full?alt=json', function(xhr) {
	    var data = JSON.parse(xhr.responseText);
	    var sheet_id = data.feed.entry[0].id['$t'];
	    var prefix = 'https://spreadsheets.google.com/feeds/worksheets/';
	    if (sheet_id.indexOf(prefix) == 0) {
		findLastCell(sheet_id.substring(prefix.length));
	    }
	});
    }

    findWorksheet();
}

