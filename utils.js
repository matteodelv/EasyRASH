/* 
	Helper module for recurrent server side tasks
*/

var path = require('path');
var fs = require('fs');

exports.checkAcronymUsage = function(acronym, callback) {
	var check = false;
	var eventsPath = path.resolve('storage/events.json');
	if (fs.existsSync(eventsPath)) {
		var data = fs.readFileSync(eventsPath);		// richiesta sincrona necessaria
		var confs = JSON.parse(data);
		check = confs.every(function (aConf) {
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

exports.loadDataFile = function(file, callback) {
	var filePath = path.resolve(file);
	if (fs.existsSync(filePath)) {
		var data = fs.readFileSync(filePath);
		if (!data) {
			var error = { status: 400, message: 'Unable to load requested data. Please, try again!' };
			return callback(error, null);
		} else {
			var parsed = JSON.parse(data);
			return callback(null, parsed);
		}
	} else return callback({ status: 404, message: 'Requested data file not found. Please, try again!' }, null);
}
