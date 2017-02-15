/* 
	Helper module for recurrent server side tasks
*/

var path = require('path');
var fs = require('fs');

exports.checkAcronymUsage = function(acronym, callback) {
	var check = false;
	var eventsPath = path.resolve('storage/events.json');
	if (fs.existsSync(eventsPath)) {
		var data = fs.readFileSync(eventsPath); // richiesta sincrona necessaria
		var confs = JSON.parse(data);
		check = confs.every(function(aConf) {
			console.log(aConf.acronym !== acronym);
			if (aConf.acronym !== acronym) return true;
			else return false;
		});
	}
	return callback(check);
};

exports.sortUsersAlphabetically = function(usersArray) {
	usersArray.sort((a, b) => {
		a = a.family_name.toLowerCase();
		b = b.family_name.toLowerCase();
		return a < b ? -1 : a > b ? 1 : 0;
	});
	return usersArray;
};

exports.loadJsonFile = function(file, callback) {

	var filePath = path.resolve(file);

	if (fs.existsSync(filePath)) {
		var data = fs.readFileSync(filePath);
		if (!data) {
			var error = { status: 400, message: 'Unable to load requested data. Please, try again!' };
			return callback(error, null);
		} else {
			var parsed = JSON.parse(data);
			var save = function() {
				fs.writeFileSync(filePath, JSON.stringify(parsed, null, "\t"));
			}
			return callback(null, parsed, save);
		}
	} else return callback({ status: 404, message: 'Requested data file not found. Please, try again!' }, null);
}

exports.findSubmission = function(events, submissionUrl) {
	var submission;
	events.some(event => {
		submission = event.submissions.find(s => s.url === submissionUrl); //search for the submission in the current event, and store it in a variable
		return submission; //returns truthy value if submission is found and exits some
	});
	return submission;
};

exports.findUser = function(users, userId) {
	return users.find(u => u.id === userId);
};
