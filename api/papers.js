'use strict';

var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var xpath = require('xpath');
var parse5 = require('parse5');
var xmlser = require('xmlserializer');
var xmldom = require('xmldom');
var dom = xmldom.DOMParser;
var serializer = new xmldom.XMLSerializer();
var utils = require('./utils.js');

//Responds with all the paper associated with a particular user
router.get('/', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events) => {
		if (error) res.status(error.status).json(error);
		var submittedArticles = [];
		var reviewableArticles = [];
		events.forEach(event => {
			event.submissions.forEach(submission => {
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
});

//Finds the user's role in relation to the paper
router.get('/:id/role', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events) => {
		console.log(req.params.id);
		if (error) res.status(error.status).json(error);

		var paper = utils.findSubmission(events, req.params.id);

		if (paper) {
			var result = {
				isReviewer: false,
				alreadyReviewed: false
			};

			if (paper.reviewers.indexOf(req.jwtPayload.id) !== -1) {
				result.isReviewer = true;
				if (paper.reviewedBy.indexOf(req.jwtPayload.id) !== -1) result.alreadyReviewed = true;
			}

			res.json(result);
		} else res.status(404).json({ message: 'Current paper not found. Unable to verify reviewer rights!' });
	});
});

//Responds with a list of reviewer/review status tuples for the specified paper
router.get('/:id/reviews', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (err, events) => {
		if (err) res.status(err.status).json(err);

		var paper = utils.findSubmission(events, req.params.id);
		var reviews = [];

		utils.loadJsonFile(req.app.get('usersFilePath'), (err, users) => {
			if (err) res.status(err.status).json(err);

			var filePath = path.resolve('storage/papers/' + req.params.id + '.html');
			var reviewsJsonLd = [];
			if (fs.existsSync(filePath)) {
				fs.readFile(filePath, "utf-8", function(err, data) {
					//Get review info from RASH file
					//This helps a lot: http://regexr.com/3f9fr
					var annotationsRegex = new RegExp(/(?:<script)(?:[^.]*)(?:type="application\/ld\+json")(?:>)((\s|\S)*?)(?:<\/script>)/igm);
					var match;
					while(match = annotationsRegex.exec(data.toString())){
						var rb = JSON.parse(match[1]);
						reviewsJsonLd.push(rb); //Get first matching group
					};
					//Create record for reviewers
					paper.reviewers.forEach(reviewerId => {
						var review = {};
						var reviewer = utils.findUser(users, reviewerId);
						review['reviewer'] = {
							id: reviewer.id,
							fullName: reviewer.given_name + ' ' + reviewer.family_name,
							email: reviewer.email
						};
						if (!paper.reviewedBy.find(r => r === reviewer.id)){ //Reviewer hasn't reviewed the paper
							review['decision'] = 'pending';
						} else {
							reviewsJsonLd.forEach(reviewBlock => {
								if (reviewBlock.some(elem => elem["@type"] === 'person' && elem["@id"] === reviewerId)){ //This block belongs to the matching reviewer
									var reviewInfo = reviewBlock.find(elem => elem["@type"] === 'review');
									var status = reviewInfo["article"]["eval"]["status"];
									review['decision'] = status === 'pso:accepted-for-publication' ? 'accepted' : 'rejected';
								}
							});
						}
						reviews.push(review);
					});

					res.json({ reviews: reviews });
				});
			} else res.status(404).json({ message: 'Requested RASH file not found on server.' });
		});
	});
});

//Expresses a final decision about the specified paper
router.post('/:id/judge', (req, res) => {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events, save) => {
		if (error) res.status(error.status).json(error);

		var paper = utils.findSubmission(events, req.params.id);
		if (paper) {
			if (paper.authors.indexOf(req.jwtPayload.id) !== -1) res.status(400).json({ message: 'You are not allowed to judge this paper because you are one of its Authors, even though you are Chair!' });
			
			paper.status = req.body.decision;
			save();
			res.json({ message: 'Paper decision saved correctly!' });
		} else res.status(404).json({ message: 'There was a problem looking for the paper. Please, try again!' });
	});
});

//Requests to lock a paper to prevent other users from editing
router.put('/:id/lock', function(req, res) {
	checkPaperLock(req.app, req.params.id, req.jwtPayload.id, (err, isLocked) => {
		if (err) throw err;

		if (isLocked) {
			res.status(409).json({ lockAcquired: false, message: 'Another reviewer is currently reviewing this paper. Please, try again later! ' });
		}
		else {
			lockPaper(req.app, req.params.id, req.jwtPayload.id, (err) => {
				if (err) {
					res.status(409).json({lockAcquired: false,  message: 'Unable to acquire lock on the paper for reviewing it. Please, try again later! ' });
				} else {
					res.json({ lockAcquired: true });
				}
			});
		}
	});
});

//Releases the lock from a paper
router.delete('/:id/lock', function(req, res) {
	releasePaperLock(req.app, req.params.id, req.jwtPayload.id, (err) => {
		res.status(200).send();
	});
});

//Checks whether a paper is locked
function checkPaperLock(app, paperId, userId, callback){
	var isLocked = false;
	var err = {};
	utils.loadJsonFile(app.get('eventsFilePath'), (error, events) => {
		err = error;
		var submission;
		events.forEach(event => {
			if (!submission) {
				submission = event.submissions.find(s => paperId === s.url);
			};
		});
		if (submission){
			var lockedBySomeoneElse = submission.lockedBy && submission.lockedBy !== userId;
			var isLockExpired = (new Date).getTime() - submission.lockedAt > app.get('lockExpireTimeMs');
			if (lockedBySomeoneElse && !isLockExpired){
				isLocked = true;
			}
		} else err = { status: 404, message: 'Unable to find paper info!' };
	});

	return callback(err, isLocked);
}

//Locks a paper to prevent other users from editing
function lockPaper(app, paperId, userId, callback){
	var err = {};
	utils.loadJsonFile(app.get('eventsFilePath'), (error, events, save) => {
		err = error;
		if (err) return callback(err);
		var submission = utils.findSubmission(events, paperId);
		if (submission){
			var lockedBySomeoneElse = submission.lockedBy && submission.lockedBy !== userId;
			var isLockExpired = (new Date).getTime() - submission.lockedAt > app.get('lockExpireTimeMs');
			console.log('Locked by someone else: ' + lockedBySomeoneElse + ', lock expired: ' + isLockExpired);
			if (lockedBySomeoneElse && !isLockExpired){
				err = { message: 'Cannot lock paper. Paper is already locked by .' + submission.lockedBy}
				isLocked = true;
			} else {
				submission.lockedBy = userId;
				submission.lockedAt = (new Date).getTime();
			}
			save();
		} else err = { status: 404, message: 'Unable to find paper info!' };
	});

	return callback(err);
}

//Releases the lock from a paper
function releasePaperLock(app, paperId, userId, callback){
	var err = {};
	utils.loadJsonFile(app.get('eventsFilePath'), (error, events, save) => {
		err = error;
		if (err) return callback(err);
		var submission = utils.findSubmission(events, paperId);
		if (submission){
			submission.lockedBy = '';
			submission.lockedAt = null;
			save();
		} else err = { status: 404, message: 'Unable to find paper info!' };
	});

	return callback(err);
}

//Responds with a list of papers associated with the user
router.get("/user", function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events) => {
		if (error) res.status(error.status).json(error);
		var result = {
			authored_by_me: [], //Contains papers the user is author of
			pending_reviews: [] //Contains the papers the user has yet to review
		};
		events.forEach(event => {
			event.submissions.forEach(paper => {
				paper.conference = event.acronym;

				if (paper.authors.some(author => author === req.jwtPayload.id)) {
					result.authored_by_me.push(paper);
				}

				if (paper.reviewers.some(reviewer => reviewer === req.jwtPayload.id && paper.reviewedBy.indexOf(reviewer) === -1 && paper.status === "pending") && event.chairs.indexOf(req.jwtPayload.id) === -1) {
					result.pending_reviews.push(paper);
				}
			});
		});
		res.json(result);
	});
});

//Responds with a paper given the id
router.get('/:id', function(req, res) {
	//Filter out comments by permissions: /(<script type="application\/ld\+json">)((.|\n)*?)<\/script>/igm
	if (req.accepts(['application/xhtml+xml', 'text/html'])) {
		utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events) => {
		if (error) res.status(error.status).json(error);
			//User can get paper if it's one of its authors, one of its reviewers or one of its chairs, or if the submission has been accepted
			var eligible = events.some(event =>
				event.submissions.some(submission => {
					return submission.url === req.params.id && (
						submission.status === 'accepted' ||
						(submission.authors.some(author => author === req.jwtPayload.id) || submission.reviewers.some(reviewer => reviewer === req.jwtPayload.id) || event.chairs.some(chair => chair === req.jwtPayload.id)))
				})
			);
			//Determine whether the user can see the annotations
			var canSeeAnnotations = events.some(event =>
				event.submissions.some(submission => {
					if (submission.url === req.params.id) { //Found submission
						var paperIsAccepted = submission.status === 'accepted';
						var userIsChairOfThisEvent = (event.chairs.some(chair => chair === req.jwtPayload.id));
						var isAlreadyReviewedByUser = submission.reviewedBy.some(reviewer => reviewer == req.jwtPayload.id);

						var userIsAuthorOfPaper = submission.authors.some(author => author === req.jwtPayload.id);
						var paperIsNotPending = submission.status !== 'pending';
						var userIsPcMemberofThisEvent = event.pc_members.some(pcmember => pcmember === req.jwtPayload.id);

						var csa = paperIsAccepted || userIsChairOfThisEvent || isAlreadyReviewedByUser || (paperIsNotPending && (userIsAuthorOfPaper || userIsPcMemberofThisEvent));

						console.log(`Requested paper ${submission.url} ${paperIsAccepted ? "is" : "is not"} in accepted status and ${paperIsNotPending ? "is not" : "is"} pending.\n` + `User ${req.jwtPayload.id} ${userIsChairOfThisEvent ? "is" : "is not"} chair of event ${event.acronym}, ` + `${userIsAuthorOfPaper ? "is" : "is not"} author of this paper, ` + `${userIsPcMemberofThisEvent ? "is" : "is not"} pc member of this event, ` + `${isAlreadyReviewedByUser ? "has" : "has not"} reviewed this paper.\n` + `Therefore ${req.jwtPayload.sex === "female" ? "she" : (req.jwtPayload.sex === "male" ? "he" : "they")} ${csa ? "can" : "cannot"} view the underlying annotations.`);

						return csa;
					}
					return false;
				})
			);
			var filePath = path.resolve('storage/papers/' + req.params.id + '.html');
			if (eligible) {
				if (fs.existsSync(filePath)) {
					fs.readFile(filePath, "utf-8", function(err, data) {
						var emptyLineRegex = new RegExp(/^\s*\n/gm);
						if (!canSeeAnnotations) {
							//Remove all annotations
							var annotationsRegex = new RegExp(/(?:<script)(?:[^.]*)(?:type="application\/ld\+json")(?:>)((\s|\S)*?)(?:<\/script>)/igm);
							var xmlCommentsRegex = new RegExp(/(<!--)((\s|\S)*?)(-->)/igm);
							var clean = data.replace(annotationsRegex, '').replace(xmlCommentsRegex, '').replace(emptyLineRegex, '');
							res.send(clean);
						} else {
							res.send(data.replace(emptyLineRegex, ''));
						}
					});

				} else res.status(404).json({ message: 'Requested RASH file not found on server.' });
			} else res.status(403).json({ message: '403 Forbidden' });
		});
	} else res.status(406).json({ message: '406 - Not acceptable: ' + req.get('Accept') + ' not acceptable' });
});

/* Posts a review for the specified paper, using a list of annotations 
 * Uses XPATH queries to find the elements (or creates them with xml-dom) to attach the annotations to
 * And writes JSON+lD info in the scripts section (inside of the head) of the RASH file
*/
router.post('/:id/review', function(req, res) {
	utils.loadJsonFile(req.app.get('eventsFilePath'), (error, events, save) => {
		if (error) res.status(error.status).json(error);
		var submission = utils.findSubmission(events, req.params.id);
		if (!submission.reviewers.some(reviewer => reviewer === req.jwtPayload.id)) {
			//Not allowed to review
			res.status(403).json({message: "Error. You are not allowed to review this paper."});
		} else {
			if (submission.reviewedBy.some(reviewer => reviewer === req.jwtPayload.id)) {
				//Already reviewed
				res.status(403).json({message: "Error. You have already reviewed this paper."});
			} else {
				//Good to go
				var filePath = path.resolve('storage/papers/' + req.params.id + '.html');
				if (fs.existsSync(filePath)) {
					fs.readFile(filePath, function(err, html) {
						if (err) res.status(500).json({message: 'Something went wrong when trying to post your review. Please try again.'});
						var doc = new dom().parseFromString(html.toString());
						var select = xpath.useNamespaces({ "x": "http://www.w3.org/1999/xhtml" });
						Object.keys(req.body.annotations).forEach(a => {

							//Case where the annotation is linked to a pre-existing block id
							if (doc.getElementById(req.body.annotations[a].id)) {
								return;
							}
							//Creates xpath query with correct namespace
							var query = function(xpath) {
								return xpath.split('/').map(tag => tag === "" ? "" : (tag.indexOf("text()") !== -1 ? tag : "x:" + tag)).join('/');
							}

							var annotationElement = doc.createElement('span');
							annotationElement.setAttribute('id', req.body.annotations[a].id);

							//Split closing tag
							console.log('END XPATH: "%s" - OFFSET: %s', query(req.body.annotations[a].endXPath), req.body.annotations[a].endOffset);
							var endNode = select(query(req.body.annotations[a].endXPath), doc)[0];
							console.log("END NODE: %s", endNode.data);
							endNode.splitText(+req.body.annotations[a].endOffset);
							endNode = endNode.nextSibling;
							console.log("END NODE AFTER SPLIT: %s", endNode.data);

							//Split starting tag
							console.log('START XPATH: "%s" - OFFSET: %s', query(req.body.annotations[a].startXPath), req.body.annotations[a].startOffset);
							var startNode = select(query(req.body.annotations[a].startXPath), doc)[0];
							console.log("START NODE: %s", startNode.data);
							startNode.splitText(+req.body.annotations[a].startOffset);
							console.log("START NODE AFTER SPLIT: %s", startNode.data);

							var insertAfter = function(referenceNode, newNode) {
								referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
							}

							//Insert new span node
							console.log("Adding span node...");
							insertAfter(startNode, annotationElement);

							//Move all nodes between start and end to the new span node
							var current = annotationElement.nextSibling;
							while (current != endNode) {
								var next = current.nextSibling;
								console.log("Moving node: %s", current.data);
								current.parentNode.removeChild(current);
								annotationElement.appendChild(current);
								current = next;
							}
						});

						var jsonLDBlock = doc.createElement('script');
						jsonLDBlock.setAttribute('type', 'application/ld+json');
						// Insert JSON+LD annotations (done at the end to match offsets)
						// see example-annotations.html

						var reviewBlock = [];
						//The part about the whole review
						var review = {};
						review["@context"] = req.app.get('jsonLDcontext');
						review["@type"] = "review";
						var annotationsRegex = new RegExp(/(?:<script)(?:[^.]*)(?:type="application\/ld\+json")(?:>)((\s|\S)*?)(?:<\/script>)/igm);
						var matches = html.toString().match(annotationsRegex);
						var matchCount = matches ? matches.length : 0;
						var reviewId = "#review" + (matchCount + 1);
						review["@id"] = reviewId;
						var article = {};
						review["article"] = article;
						article["@id"] = "";
						var evaluation = {};
						evaluation["@id"] = reviewId + "-eval";
						evaluation["@type"] = "score";
						evaluation["status"] = req.body.decision === "accepted" ? "pso:accepted-for-publication" : "pso:rejected-for-publication"
						evaluation["author"] = req.jwtPayload.id;
						evaluation["date"] = new Date().toISOString();
						article["eval"] = evaluation;
						reviewBlock.push(review);

						//The part about single annotations
						var annotationIds = [];
						var i = 0;
						Object.keys(req.body.annotations).forEach(a => {
							var annotation = {};
							annotation["@context"] = req.app.get('jsonLDcontext');
							annotation["@type"] = "comment";
							var id = reviewId + '-c' + ++i;
							annotation["@id"] = id;
							annotationIds.push(id);
							annotation["text"] = req.body.annotations[a].content;
							annotation["ref"] = req.body.annotations[a].id; //TODO: This should be done server side
							annotation["author"] = req.jwtPayload.id;
							annotation["date"] = new Date().toISOString();
							reviewBlock.push(annotation);
						});

						review["comments"] = annotationIds;

						//The part about the reviewer
						var person = {};
						person["@content"] = req.app.get('jsonLDcontext');
						person["@type"] = "person";
						person["@id"] = req.jwtPayload.id;
						person["name"] = req.jwtPayload.given_name + " " + req.jwtPayload.family_name;
						var as = {}
						as["@id"] = "#role1"
						as["@type"] = "role";
						as["role_type"] = "pro:reviewer";
						as["in"] = "";
						person["as"] = as;
						var mbox = {};
						mbox["@id"] = 'mailto:' + req.jwtPayload.email;
						person["foaf:mbox"] = mbox;
						reviewBlock.push(person);

						//Append everything
						var jsonText = doc.createTextNode(JSON.stringify(reviewBlock, null, "\t"));
						jsonLDBlock.appendChild(jsonText);
						var head = select("//x:head", doc)[0];
						head.appendChild(jsonLDBlock);

						//Write back to RASH file
						fs.writeFileSync(filePath, serializer.serializeToString(doc));

						//Update event submission
						submission.reviewedBy.push(req.jwtPayload.id);
						save();
						//Release lock 
						releasePaperLock(req.app, req.params.id, req.jwtPayload.id, (err) => {
							if (err) res.status(409).json({message: err.toString()}); 
							else res.json({ message: 'Paper reviewed successfully.' });
						});
					});
				}
			}
		}
	});
});

//Used to standardize how papers are formatted
function normalizePapers() {
	return null;
	console.log("Normalizing all papers");
	fs.readdir("storage/papers", (err, files) => {
		files.forEach(file => {
			var filePath = "storage/papers/" + file;
			if (!fs.statSync(filePath).isDirectory()) {
				console.log("Normalizing" + "storage/papers/" + file);
				fs.readFile(filePath, function(err, html) {
					if (err) throw err;
					var doc = new dom().parseFromString(html.toString());
					fs.writeFileSync(filePath, serializer.serializeToString(doc));
				});
			}
		});
	});
}

module.exports = router;
