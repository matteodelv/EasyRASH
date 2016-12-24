var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var utils = require('../utils.js');

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

// add a PUT/POST endpoint to create a new conference and make the user that created it as chair
router.post('/create', function(req, res) {
	// checking user email existance
	/*
	if (req.body.cochairs || req.body.reviewers) {
		var usersPath = path.resolve('storage/users.json');
		if (fs.existsSync(usersPath)) {
			fs.readFile(usersPath, (error, data) => {
				var users = JSON.parse(data);
				var coChairCheck = req.body.cochairs.every(function (aCoChair) {
					if (!users.find(x => x.email === aCoChair)) return true;
					else return false;
				});
				var revCheck = req.body.reviewers.every(function (aRev) {
					if (!users.find(x => x.email === aRev)) return true;
					else return false;
				});
				if (!coChairCheck || !revCheck) res.status(400).send('Please check emails... Some of them appear don\'t exist.');
			});
		} else res.status(404).send('404 Users Not Found');
	}*/

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

// Update Conference :id with data as argument
router.put('/update/:id', function(req, res) {
	// 1- Find specific event to update
	// 2- Check co-chairs and reviewers conflicts
	// 3- Update event info
	// 4- Write edit to file

	var eventsPath = path.resolve('storage/events.json');
	if (fs.existsSync(eventsPath)) {
		fs.readFile(eventsPath, (error, data) => {
			var confs = JSON.parse(data);
			var selectedConf = confs.find(elem => elem.acronym === decodeURI(req.params.id));
			if (selectedConf.conference !== req.body.title) selectedConf.conference = req.body.title;
			if (selectedConf.acronym = req.body.acronym) selectedConf.acronym = req.body.acronym;
			selectedConf.chairs = req.body['cochairs[]'].slice(0);
			selectedConf.pc_members = req.body['reviewers[]'].slice(0);

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
