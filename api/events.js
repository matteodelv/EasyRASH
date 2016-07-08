var router = require('express').Router();
var path = require('path');
var fs = require('fs');

router.get('/', function(req, res) {
	var filePath = path.resolve('storage/events.json');
	if (fs.existsSync(filePath)) {
		fs.readFile(filePath, (err, data) => {
			var events = JSON.parse(data);
			var conferences = [];
			events.forEach(event => {
				var c = {
					conference: event.conference,
					acronym: event.acronym
				};
				conferences.push(c);
			});
			res.json(conferences);
		});
	} else res.status(404).send('404 sorry not found');
});

router.get('/:id/papers', function(req, res) {
	var eventsPath = path.resolve("storage/events.json");
	if (fs.existsSync(eventsPath)) {
		fs.readFile(eventsPath, (err, data) => {
			var confs = JSON.parse(data);
			var selectedConf = confs.find(elem => elem.acronym === unescape(req.params.id));
			var result = {
				selectedConf: selectedConf.conference,
				papers: []	// array contenente gli articoli, in base al ruolo dell'utente
			};
			if (selectedConf.chairs.indexOf(req.jwtPayload.id) > -1) { // L'utente è chair
				result.userRole = "Chair";
				selectedConf.submissions.forEach(submission => {
					result.papers.push(submission);
				});
			}
			else {
				var asAuthor = [];
				var asReviewer = [];
				var asReader = [];
				
				selectedConf.submissions.forEach(submission => {
					if (submission.reviewers.indexOf(req.jwtPayload.id) !== -1) asReviewer.push(submission);
					else if (submission.authors.indexOf(req.jwtPayload.id) !== -1) asAuthor.push(submission);
					else if (submission.status === "accepted") asReader.push(submission);
				});
				
				if (asReviewer.length > 0) {
					result.userRole = "Reviewer";
					result.papers = asReviewer.concat(asAuthor);
				}
				else if (asAuthor.length > 0) {
					result.userRole = "Author";
					result.papers = asAuthor;
				}
				else {
					result.userRole = "Reader";
					result.papers = asReader;
				}
			}
			res.json(result);
		});
	} else res.status(404).send("404 Conference Non Found");
});

module.exports = router;