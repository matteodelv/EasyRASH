var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var utils = require('./utils.js');

router.get('/', function(req, res) {
	var filePath = path.resolve('storage/events.json');
	if (fs.existsSync(filePath)) {
		fs.readFile(filePath, (err, data) => {
			var events = JSON.parse(data);
			var conferences = [];
			events.forEach(event => {
				var c = {
					conference: event.conference,
					acronym: event.acronym,
					status: event.status
				};
				conferences.push(c);
			});
			res.json(conferences);
		});
	} else res.status(404).send('404 sorry not found');
});

router.get('/:id', function(req, res) {
	var eventsPath = path.resolve('storage/events.json');
	if (fs.existsSync(eventsPath)) {
		var data = fs.readFileSync(eventsPath);
		if (!data) return res.status(400).json({ success: false, message: 'Unable to load conference info...' });

		var confs = JSON.parse(data);
		var selectedConf = confs.find(elem => elem.acronym === req.params.id);
		if (selectedConf) res.json({ success: true, conference: selectedConf });
		else res.status(404).json({ success: false, message: 'Conference not found...' });
	} else res.status(400).json({ success: false, message: 'Unable to list conferences... Try again' });
});

router.post('/', function(req, res) {
	utils.checkAcronymUsage(req.body.acronym, result => {
		if (result) {
			var eventsPath = path.resolve('storage/events.json');
			var events;
			if (fs.existsSync(eventsPath)) {
				fs.readFile(eventsPath, (error, data) => {
					var newConf = {
						conference: req.body.title,
						acronym: req.body.acronym,
						chairs: [ req.jwtPayload.id ],
						pc_members: [],
						submissions: []
					};
					events = JSON.parse(data);
					events.push(newConf);

					if (events) {
						fs.writeFile(eventsPath, JSON.stringify(events, null, '\t'), error => {
							if (error) throw error;
							res.json({ success: true, message: 'Conference correctly created! Redirecting to admin panel...' });
						});
					} else res.status(400).json({ success: false, message: 'Problems fetching conferences... Try again.' });
				});
			} else res.status(404).json({ success: false, message: 'Error 404 - Events not found' });
		} else res.status(400).json({ success: false, message: 'Chosen acronym already in use! Please, try again.' });
	});
});

// Close Conference identified by :id
router.put('/:id/close', function(req, res) {
	var eventsPath = path.resolve('storage/events.json');
	if (fs.existsSync(eventsPath)) {
		fs.readFile(eventsPath, (error, data) => {
			var confs = JSON.parse(data);
			var selectedConf = confs.find(elem => elem.acronym === decodeURI(req.params.id));
			var paperCheck = selectedConf.submissions.some(paper => { return paper.status === "pending"; });
			if (selectedConf.status === "open" && !paperCheck && selectedConf.submissions.length > 0) {
				selectedConf.status = "closed";

				if (confs) {
					fs.writeFile(eventsPath, JSON.stringify(confs, null, '\t'), error => {
						if (error) throw error;
						res.json({ success: true, message: 'Conference successfully closed!' });
					});
				} else res.status(400).json({ success: false, message: 'Unable to close the conference. Please, try again later!' });
			}
			else res.status(400).json({ success: false, message: 'Conditions to close the conference are not met. This is an error condition. Try again!'})
		});
	} else res.status(400).json({ success: false, message: 'There are problems loading conferences. Please, try again later!' });
});

// Update Conference :id with data as argument
router.put('/:id', function(req, res) {
	var eventsPath = path.resolve('storage/events.json');
	if (fs.existsSync(eventsPath)) {
		fs.readFile(eventsPath, (error, data) => {
			var confs = JSON.parse(data);
			var selectedConf = confs.find(elem => elem.acronym === decodeURI(req.params.id));
			if (selectedConf.conference !== req.body.title) selectedConf.conference = req.body.title;
			if (selectedConf.acronym !== req.body.acronym) selectedConf.acronym = req.body.acronym;

			selectedConf.chairs = req.body['cochairs'];
			selectedConf.pc_members.push.apply(selectedConf.pc_members, req.body['reviewers']);

			if (confs) {
				fs.writeFile(eventsPath, JSON.stringify(confs, null, '\t'), error => {
					if (error) throw error;
					res.json({ success: true, message: 'Conference correctly updated!' });
				});
			} else res.status(400).json({ success: false, message: 'Problems updating conferences... Try again.' });
		});
	} else res.status(400).json({ success: false, message: 'Problems loading conference info... Try again.' });
});

router.get('/:id/papers', function(req, res) {
	var eventsPath = path.resolve("storage/events.json");
	if (fs.existsSync(eventsPath)) {
		fs.readFile(eventsPath, (err, data) => {
			var confs = JSON.parse(data);
			var selectedConf = confs.find(elem => elem.acronym === decodeURI(req.params.id));
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
			res.json(result);
		});
	} else res.status(404).send("404 Conference Non Found");
});

router.get('/:id/:paper/reviewers', function(req, res) {
	var eventsPath = path.resolve('storage/events.json');
	if (fs.existsSync(eventsPath)) {
		fs.readFile(eventsPath, (err, data) => {
			var confs = JSON.parse(data);
			var selectedConf = confs.find(elem => elem.acronym === decodeURI(req.params.id));
			if (selectedConf) {
				if (!selectedConf.pc_members) res.json([]);
				else {
					var paper = selectedConf.submissions.find(paper => paper.url === decodeURI(req.params.paper));
					if (paper) {
						var reviewers = [];
						// getting reviewers info
						var usersPath = path.resolve('storage/users.json');
						if (fs.existsSync(usersPath)) {
							var usersData = fs.readFileSync(usersPath);
							var users = JSON.parse(usersData);
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
						} else res.status(404).send('Reviewers data not found');

						reviewers = utils.sortUsersAlphabetically(reviewers);
						res.json(reviewers);
					}
				}
			}
		});
	} else res.status(404).send("Conferences data not found");
});

router.post('/:id/:paper/reviewers', function(req, res) {
	utils.loadDataFile('storage/events.json', (error, events) => {
		var selectedConf = events.find(conf => conf.acronym === decodeURI(req.params.id));
		if (selectedConf) {
			var paper = selectedConf.submissions.find(p => p.url === decodeURI(req.params.paper));
			if (paper) {
				var newRevs = req.body['revs'];
				paper.reviewers.push.apply(paper.reviewers, newRevs);

				if (paper.reviewers.length < 2) res.status(400).send({ message: 'Each paper must have two or more reviewers' });

				if (events) {
					fs.writeFile(eventsPath, JSON.stringify(events, null, '\t'), error => {
						if (error) throw error;
						res.json({ success: true, message: 'Reviewers correctly assigned to paper!' });
					});
				} else res.status(400).json({ success: false, message: 'Problems assigning reviewers to paper... Try again.' });
			} else res.status(404).json({ message: 'Paper not found. Please, try again!' });
		} else res.status(404).json({ message: 'Conference not found. Please, try again!' });
	});
});

module.exports = router;
