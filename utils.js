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