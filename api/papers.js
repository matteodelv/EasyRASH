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

const lock = require('proper-lockfile');

const CONTEXT = "http://vitali.web.cs.unibo.it/twiki/pub/TechWeb16/context.json";
const LOCK_EXPIRE_TIME_MS = 3600000;//3600000;

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

router.get('/:id/role', function(req, res) {
	utils.loadDataFile('storage/events.json', (error, events) => {
		if (error) res.status(error.status).json(error);

		var paper;
		events.some(event => {
			paper = event.submissions.find(p => p.url === decodeURI(req.params.id));
			if (paper) return true;
		});

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

	// var filePath = path.resolve('storage/events.json');
	// if (fs.existsSync(filePath)) {
	// 	fs.readFile(filePath, (err, data) => {
	// 		var events = JSON.parse(data);
	// 		var paper;
	// 		var result = {
	// 			alreadyReviewed: false,
	// 			isReviewer: false
	// 		};
	// 		for (i = 0; i < events.length; i++) {
	// 			paper = events[i].submissions.find(p => p.url === req.params.id);
	// 			if (paper) {
	// 				if (events[i].chairs.indexOf(req.jwtPayload.id) !== -1) result.role = "Chair";
	// 				break;
	// 			}
	// 		}
	// 		if (paper) {
	// 			if (result.role === "") {
	// 				if (paper.reviewers.indexOf(req.jwtPayload.id) !== -1) {
	// 					result.role = "Reviewer";
	// 					if (paper.reviewedBy.indexOf(req.jwtPayload.id) !== -1) result.alreadyReviewed = true;
	// 				} else if (paper.authors.indexOf(req.jwtPayload.id) !== -1) result.role = "Author";
	// 				else result.role = "Reader";
	// 			}
	// 		} else result.role = "Reader";

	// 		console.log(`User ${req.jwtPayload.id}'s role for paper ${paper.url} is ${result.role}`);

	// 		res.json(result); // Gestire situazione d'errore
	// 	});
	// } else res.json(404).send('404 Data not found');
});

router.get('/:id/reviews', function(req, res) {
	utils.loadDataFile('storage/events.json', (err, events) => {
		if (err) res.status(err.status).json(err);

		var paper = utils.findSubmission(events, req.params.id);
		var reviews = [];

		utils.loadDataFile('storage/users.json', (err, users) => {
			console.log("Loaded data file");

			var filePath = path.resolve('storage/papers/' + req.params.id + '.html');
			var reviewsJsonLd = [];
			if (fs.existsSync(filePath)) {
				fs.readFile(filePath, "utf-8", function(err, data) {
					//Get review info from RASH file
					//This helps a lot: http://regexr.com/3f9fr
					console.log("Searching for annotations");
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
			} else res.status(404).send('404 sorry not found');
		});
	});
});

router.put('/:id/lock', function(req, res) {
	checkPaperLock(req.params.id, req.jwtPayload.id, (err, isLocked) => {
		if (err) throw err;

		if (isLocked) {
			console.log('Il paper ' + req.params.id + ' è BLOCCATO');
			res.status(400).json({ lockAcquired: false, message: 'Another reviewer is currently reviewing this paper. Please, try again later! ' });
		}
		else {
			console.log('Il paper ' + req.params.id + ' NON è bloccato');
			lockPaper(req.params.id, req.jwtPayload.id, (err) => {
				if (err) {
					res.status(400).json({lockAcquired: false,  message: 'Unable to acquire lock on the paper for reviewing it. Please, try again later! ' });
				} else {
					console.log("Il lock sul paper è stato acquisito!");
					res.json({ lockAcquired: true });
				}
			});
		}
	});
});

router.delete('/:id/lock', function(req, res) {
	releasePaperLock(req.params.id, req.jwtPayload.id, (err) => {
		res.status(200).send();
	});
});

function checkPaperLock(paperId, userId, callback){
	var isLocked = false;
	var err = {};
	eventsFilePath = 'storage/events.json';
	utils.loadDataFile(eventsFilePath, (error, events) => {
		err = error;
		var submission;
		events.forEach(event => {
			if (!submission) {
				submission = event.submissions.find(s => paperId === s.url);
			};
		});
		if (submission){
			var lockedBySomeoneElse = submission.lockedBy && submission.lockedBy !== userId;
			var isLockExpired = (new Date).getTime() - submission.lockedAt > LOCK_EXPIRE_TIME_MS;
			console.log('Locked by someone else: ' + lockedBySomeoneElse + ', lock expired: ' + isLockExpired);
			if (lockedBySomeoneElse && !isLockExpired){
				isLocked = true;
			}
		} else err = { message: 'Unable to find paper info!' };
	});

	return callback(err, isLocked);
}

function lockPaper(paperId, userId, callback){
	var err = {};
	eventsFilePath = 'storage/events.json';
	utils.loadDataFile(eventsFilePath, (error, events, save) => {
		err = error;
		if (err) return callback(err);
		var submission;
		events.forEach(event => {
			if (!submission) {
				submission = event.submissions.find(s => paperId === s.url);
			};
		});
		if (submission){
			var lockedBySomeoneElse = submission.lockedBy && submission.lockedBy !== userId;
			var isLockExpired = (new Date).getTime() - submission.lockedAt > LOCK_EXPIRE_TIME_MS;
			console.log('Locked by someone else: ' + lockedBySomeoneElse + ', lock expired: ' + isLockExpired);
			if (lockedBySomeoneElse && !isLockExpired){
				err = { message: 'Cannot lock paper. Paper is already locked by .' + submission.lockedBy}
				isLocked = true;
			} else {
				submission.lockedBy = userId;
				submission.lockedAt = (new Date).getTime();
			}
			save();
			//fs.writeFileSync(eventsFilePath, JSON.stringify(events, null, "\t"));
		} else err = { message: 'Unable to find paper info!' };
	});

	return callback(err);
}

function releasePaperLock(paperId, userId, callback){
	var err = {};
	eventsFilePath = 'storage/events.json';
	utils.loadDataFile(eventsFilePath, (error, events) => {
		err = error;
		var submission;
		events.forEach(event => {
			if (!submission) {
				submission = event.submissions.find(s => paperId === s.url);
			};
		});
		if (submission){
			submission.lockedBy = '';
			submission.lockedAt = null;
			fs.writeFileSync(eventsFilePath, JSON.stringify(events, null, "\t"));
		} else err = { message: 'Unable to find paper info!' };
	});

	return callback(err);
}

router.get("/user", function(req, res) {
	var eventsPath = path.resolve("storage/events.json");
	if (fs.existsSync(eventsPath)) {
		fs.readFile(eventsPath, (err, data) => {
			var events = JSON.parse(data);
			var result = {
				authored_by_me: [], // contiene tutti gli articoli dell'utente loggato
				pending_reviews: [] // contiene tutti gli articoli che l'utente loggato deve ancora recensire
			};
			events.forEach(event => {
				event.submissions.forEach(paper => {
					paper.conference = event.acronym;

					if (paper.authors.some(author => author === req.jwtPayload.id)) {
						result.authored_by_me.push(paper);
					}

					if (paper.reviewers.some(reviewer => reviewer === req.jwtPayload.id && paper.reviewedBy.indexOf(reviewer) === -1 && paper.status !== "accepted") && event.chairs.indexOf(req.jwtPayload.id) === -1) {
						result.pending_reviews.push(paper);
					}
				});
			});
			res.json(result);
		});
	} else res.status(404).send("404 Data Not Found");
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

					} else res.status(404).send('404 sorry not found');
				} else res.status(403).send('403 Forbidden');
			});
		} else res.status(404).send('404 sorry not found');

	} else res.status(406).send('406 - Not acceptable: ' + req.get('Accept') + ' not acceptable');
});

router.post('/:id/review', function(req, res) {
	var eventsFilePath = path.resolve('storage/events.json');
	if (fs.existsSync(eventsFilePath)) {
		fs.readFile(eventsFilePath, (err, data) => {
			var events = JSON.parse(data);
			var submission;
			events.forEach(event => {
				if (!submission) {
					submission = event.submissions.find(s => req.params.id === s.url);
				};
			});
			if (!submission.reviewers.some(reviewer => reviewer === req.jwtPayload.id)) {
				//Not allowed to review
				res.status(403).send("Error. You are not allowed to review this paper.");
			} else {
				if (submission.reviewedBy.some(reviewer => reviewer === req.jwtPayload.id)) {
					//Already reviewed
					res.status(403).send("Error. You have already reviewed this paper.");
				} else {
					//Good to go
					console.log("Recensione " + req.params.id);
					var filePath = path.resolve('storage/papers/' + req.params.id + '.html');
					if (fs.existsSync(filePath)) {
						fs.readFile(filePath, function(err, html) {
							if (err) throw err;
							var doc = new dom().parseFromString(html.toString());
							var select = xpath.useNamespaces({ "x": "http://www.w3.org/1999/xhtml" });
							Object.keys(req.body.annotations).forEach(a => {
								console.log(a);

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
							//vedi example-annotations.html
							var reviewBlock = [];
							var review = {};
							review["@context"] = CONTEXT;
							review["@type"] = "review";
							var annotationsRegex = new RegExp(/(?:<script)(?:[^.]*)(?:type="application\/ld\+json")(?:>)((\s|\S)*?)(?:<\/script>)/igm);
							var matches = html.toString().match(annotationsRegex);
							var matchCount = matches ? matches.length : 0;
							var reviewId = "#review" + (matchCount + 1);
							review["@id"] = reviewId;
							var article = {};
							review["article"] = article;
							article["@id"] = "";
							var eval = {};
							eval["@id"] = reviewId + "-eval";
							eval["@type"] = "score";
							eval["status"] = req.body.decision === "accepted" ? "pso:accepted-for-publication" : "pso:rejected-for-publication"
							eval["author"] = req.jwtPayload.id;
							eval["date"] = new Date().toISOString();
							article["eval"] = eval;
							reviewBlock.push(review);
							var annotationIds = [];
							var i = 0;
							Object.keys(req.body.annotations).forEach(a => {
								var annotation = {};
								annotation["@context"] = CONTEXT;
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

							var person = {};
							person["@content"] = CONTEXT;
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

							var jsonText = doc.createTextNode(JSON.stringify(reviewBlock, null, "\t"));

							jsonLDBlock.appendChild(jsonText);

							var head = select("//x:head", doc)[0];

							head.appendChild(jsonLDBlock);

							//Write back to file
							fs.writeFileSync(filePath, serializer.serializeToString(doc));

							//Update event submission
							submission.reviewedBy.push(req.jwtPayload.id);
							fs.writeFileSync(eventsFilePath, JSON.stringify(events, null, "\t"));

							res.send('Paper reviewed successfully.')
						});
					}
				}
			}
		});
	} else res.status(404).send('404 sorry not found');
});

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
