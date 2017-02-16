'use strict';

var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var utils = require('./utils.js');

/* Responds with all the info regarding events */
router.get('/', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events) => {
		if (error) return res.status(error.status).json(error);
		var conferences = [];
		events.forEach(event => {
			var c = {
				conference: event.conference,
				acronym: event.acronym,
				status: event.status
			};
			conferences.push(c);
		});
		return res.json(conferences);
	});
});

/* Responds with information regarding a specific event */
router.get('/:id', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events) => {
		if (error) return res.status(error.status).json(error);
		var selectedConf = events.find(elem => elem.acronym === req.params.id);
		if (selectedConf) return res.json({ success: true, conference: selectedConf });
		else return res.status(404).json({ success: false, message: 'Error: Conference not found.' });
	});
});

/* Creates a new event */
router.post('/', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events, save) => {
		if (error) return res.status(error.status).json(error);
		if (events.every(event => {event.acronym !== acronym})){
			var newConf = {
				conference: req.body.title,
				acronym: req.body.acronym,
				chairs: [ req.jwtPayload.id ],
				pc_members: [],
				submissions: []
			};
			events.push(newConf);
			save();
			return res.json({ success: true, message: 'Conference correctly created! Redirecting to admin panel...' });
		} else return res.status(409).json({ success: false, message: 'Chosen acronym already in use! Please, try again.' });
	});
	//

});

// Close Conference identified by :id
router.put('/:id/close', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events, save) => {
		if (error) return res.status(error.status).json(error);
		var selectedConf = events.find(elem => elem.acronym === req.params.id);
		var paperCheck = selectedConf.submissions.some(paper => { return paper.status === "pending"; });
		if (selectedConf.status === "open" && !paperCheck && selectedConf.submissions.length > 0) {
			selectedConf.status = "closed";
			save();
			return res.json({ success: true, message: 'Conference successfully closed!' });
		}
		else return res.status(409).json({ success: false, message: 'Conditions to close the conference are not met. This is an error condition. Try again!'})
	});
});

/* Update Conference :id with data as argument */
router.put('/:id', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events, save) => {
		if (error) return res.status(error.status).json(error);
		var selectedConf = events.find(elem => elem.acronym === req.params.id);
		if (selectedConf.conference !== req.body.title) selectedConf.conference = req.body.title;
		if (selectedConf.acronym !== req.body.acronym) selectedConf.acronym = req.body.acronym;

		selectedConf.chairs = req.body['cochairs'];
		selectedConf.pc_members.push.apply(selectedConf.pc_members, req.body['reviewers']);

		save();
		return res.json({ success: true, message: 'Conference correctly updated!' });
	});
});

/* Responds with the papers of the specified conference */
router.get('/:id/papers', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events, save) => {
		if (error) return res.status(error.status).json(error);
		var selectedConf = events.find(elem => elem.acronym === req.params.id);
		var result = {
			selectedConf: selectedConf.conference,
			acronym: selectedConf.acronym,
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
		return res.json(result);
	});
});

/* Reponds with the reviewers available for the specified paper */
router.get('/:id/:paper/reviewers', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events, save) => {
		if (error) return res.status(error.status).json(error);
		var selectedConf = events.find(elem => elem.acronym === req.params.id);
		if (selectedConf) {
			if (!selectedConf.pc_members) return res.json([]);
			else {
				var paper = selectedConf.submissions.find(paper => paper.url === req.params.paper);
				if (paper) {
					var reviewers = [];
					// getting reviewers info
					utils.loadJsonFile(req.app.get('usersFilePath'), (error, users, save) => {
						if (error) return res.status(error.status).json(error);
						selectedConf.pc_members.forEach(user => {
							var selUser = users.find(u => u.id === user);
							if (selUser && paper.authors.indexOf(selUser.id) === -1) {
								var alreadyRev = (paper.reviewers.indexOf(selUser.id) !== -1) ? true : false;
								reviewers.push({
									id: selUser.id,
									family_name: selUser.family_name,
									given_name: selUser.given_name,
									email: selUser.email,
									alreadyReviewer: alreadyRev
								});
							}
						});
					});

					reviewers = utils.sortUsersAlphabetically(reviewers);
					return res.json(reviewers);
				}
			}
		}
	});
});

/* Assigns the reviewers to the specified paper */
router.post('/:id/:paper/reviewers', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events, save) => {
		if (error) return res.status(error.status).json(error);
		var selectedConf = events.find(conf => conf.acronym === req.params.id);
		if (selectedConf) {
			var paper = selectedConf.submissions.find(p => p.url === req.params.paper);
			if (paper) {
				var newRevs = req.body['revs'];
				paper.reviewers.push.apply(paper.reviewers, newRevs);

				if (paper.reviewers.length < 2) return res.status(400).send({ message: 'Each paper must have two or more reviewers' });

				save();
				return res.json({ success: true, message: 'Reviewers correctly assigned to paper!' });
			} else return res.status(404).json({ message: 'Paper not found. Please, try again!' });
		} else return res.status(404).json({ message: 'Conference not found. Please, try again!' });
	});
});

module.exports = router;
