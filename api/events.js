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
			var submitted = [];
			var reviewed = [];
			var result = {
				selectedConf: selectedConf.conference,
				articles: {}	// oggetto contenente gli array degli articoli, in base al ruolo dell'utente
			};
			if (selectedConf.chairs.indexOf(req.jwtPayload.id) > -1) { // L'utente è chair
				result.userRole = "Chair";
				result.articles.user_submitted = [];
				selectedConf.submissions.forEach(submission => {
					result.articles.user_submitted.push(submission);
				});
			}
			// TODO: Gestire gli articoli ritornati per gli altri ruoli
			else {
				selectedConf.submissions.forEach(submission => {
					if (submission.authors.some(author => author === req.jwtPayload.id)) {
						submitted.push(submission);
					}
					if (submission.reviewers.some(reviewer => reviewer === req.jwtPayload.id)) {
						reviewed.push(submission);
					}
				});
			}
			res.json(result);
			/*res.json({
				selectedConf: selectedConf.conference,
				submitted: submitted,
				reviewable: reviewed
			});*/
		});
	} else res.status(404).send("404 Conference Non Found");
});

module.exports = router;