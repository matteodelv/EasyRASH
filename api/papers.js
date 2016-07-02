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
					if (submission.authors.some(author => author === req.jwtPayload.id)) {
						submittedArticles.push(submission);
					}
					if (submission.reviewers.some(reviewer => reviewer === req.jwtPayload.id)) {
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
	//Filter out comments by permissions: /(<script type="application\/ld\+json">)((.|\n)*?)<\/script>/igm
	if (req.accepts(['application/xhtml+xml', 'text/html'])) {
		var eventsFilePath = path.resolve('storage/events.json');
		if (fs.existsSync(eventsFilePath)) {
			fs.readFile(eventsFilePath, (err, data) => {
				var events = JSON.parse(data);
				//User can get paper if it's one of its authors, one of its reviewers or one of its chairs, or if the submission has been accepted
				var eligible = events.some(event =>
					event.submissions.some(submission => {
						return submission.url === req.params.id && (
							submission.status === 'accepted' ||
							(submission.authors.some(author => author === req.jwtPayload.id) || submission.reviewers.some(reviewer => reviewer === req.jwtPayload.id) || event.chairs.some(chair => chair === req.jwtPayload.id)))
					})
				);
				//User can see annotations if the paper is accepted, he's a chair, or paper isn't pending and is the author or a pc_member
				var canSeeAnnotations = events.some(event =>
					event.submissions.some(submission => {
						return submission.url === req.params.id && (
							submission.status === 'accepted' ||
							(event.chairs.some(chair => chair === req.jwtPayload.id)) ||
							submission.status !== 'pending' && (submission.authors.some(author => author === req.jwtPayload.id) || (event.pc_members.some(pcmember => pcmember === req.jwtPayload.id))))
					})
				);
				var filePath = path.resolve('storage/papers/' + req.params.id + '.html');
				if (eligible) {
					if (fs.existsSync(filePath)) {
						console.log(canSeeAnnotations ? 'User CAN see annotations' : 'User can NOT see annotations');
						fs.readFile(filePath, "utf-8", function(err, data) {
							var emptyLineRegex = new RegExp(/^\s*\n/gm);
							if (!canSeeAnnotations) {
								//Remove all annotations
								var annotationsRegex = new RegExp(/(?:<script)(?:.*)(?:type="application\/ld\+json")(?:>)((\s|\S)*?)(?:<\/script>)/igm);
								var xmlCommentsRegex = new RegExp(/(<!--)((\s|\S)*?)(-->)/igm);
								var clean = data.replace(annotationsRegex, '').replace(xmlCommentsRegex, '').replace(emptyLineRegex, '');
								res.send(clean);
							} else {
								res.send(data.replace(emptyLineRegex,''));
							}
						});

					} else res.status(404).send('404 sorry not found');
				} else res.status(403).send('403 Forbidden');
			});
		} else res.status(404).send('404 sorry not found');

	} else res.status(406).send('406 - Not acceptable: ' + req.get('Accept') + ' not acceptable');
});

module.exports = router;
