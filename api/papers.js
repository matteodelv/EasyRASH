var router = require('express').Router();
var path = require('path');
var fs = require('fs');

//Responds with all the paper associated with a particular user
router.get('/', function(req, res) {
	var filePath = path.resolve('storage/events.json');
	if (fs.existsSync(filePath)) {
		fs.readFile(filePath, (err, data) => {
			var events = JSON.parse(data);
			var submittedArticles = [];
			var reviewableArticles = [];
			events.forEach(event => {
				event.submissions.forEach(submission => {
					//TODO: change full description to ids
					if (submission.authors.some(author => {
							return author.indexOf(req.jwtPayload.id) > -1; })) {
						submittedArticles.push(submission);
					}
					if (submission.reviewers.some(reviewer => {
							return reviewer.indexOf(req.jwtPayload.id) > -1; })) {
						reviewableArticles.push(submission);
					}
				});
			});
			res.json({
				submitted: submittedArticles,
				reviewable: reviewableArticles
			});
		});
	} else res.status(404).send('404 sorry not found');
});

//Responds with a paper given the id
router.get('/:id', function(req, res) {
	if (req.accepts(['application/xhtml+xml', 'text/html'])) {
		var filePath = path.resolve('storage/papers/' + req.params.id + '.html');
		if (fs.existsSync(filePath)) {
			res.sendFile(filePath);
		} else res.status(404).send('404 sorry not found');
	} else res.status(406).send('406 - Not acceptable: ' + req.get('Accept') + ' not acceptable');
});

module.exports = router;
