'use strict';
/* 
	Helper module for recurrent server side tasks
*/

var path = require('path');
var fs = require('fs');

/* Sorts a list of users alphabetically */
exports.sortUsersAlphabetically = function(usersArray) {
	usersArray.sort((a, b) => {
		a = a.family_name.toLowerCase();
		b = b.family_name.toLowerCase();
		return a < b ? -1 : a > b ? 1 : 0;
	});
	return usersArray;
};

/* Loads and parses a json file, provides a quick way to save the changes back to it in a formatted way, returns errors in an object within the callback */
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
};

/* Finds a submission by its id in a list of events */
exports.findSubmission = function(events, submissionUrl) {
	var submission;
	events.some(event => {
		submission = event.submissions.find(s => s.url === submissionUrl); //search for the submission in the current event, and store it in a variable
		return submission; //returns truthy value if submission is found and exits some
	});
	return submission;
};

/* Finds an user in a list of users */
exports.findUser = function(users, userId) {
	return users.find(u => u.id === userId);
};
