var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var xpath = require('xpath');
var parse5 = require('parse5');
var xmlser = require('xmlserializer');
var xmldom = require('xmldom');
var dom = xmldom.DOMParser;
var serializer =  new xmldom.XMLSerializer();
var util = require('util');

const CONTEXT = "http://vitali.web.cs.unibo.it/twiki/pub/TechWeb16/context.json";

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

router.get("/user", function(req, res) {
	var eventsPath = path.resolve("storage/events.json");
	if (fs.existsSync(eventsPath)) {
		fs.readFile(eventsPath, (err, data) => {
			var events = JSON.parse(data);
			var result = {
				authored_by_me: [],	// contiene tutti gli articoli dell'utente loggato
				pending_reviews: []	// contiene tutti gli articoli che l'utente loggato deve ancora recensire
			};
			events.forEach(event => {
				event.submissions.forEach(paper => {
					paper.conference = event.acronym;
					
					if (paper.authors.some(author => author === req.jwtPayload.id)) {
						result.authored_by_me.push(paper);
					}
					
					if (paper.reviewers.some(reviewer => reviewer === req.jwtPayload.id && paper.reviewedBy.indexOf(reviewer) === -1 && paper.status !== "accepted")) {
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

router.post('/:id/review', function(req, res) {
	//TODO: Check if user can actually review that paper
	console.log("Recensione " + req.params.id);
	console.log(req);
	var filePath = path.resolve('storage/papers/' + req.params.id + '.html');
	if (fs.existsSync(filePath)){
		fs.readFile(filePath, function (err, html) {
		    if (err) throw err; 
		    var doc = new dom().parseFromString(html.toString());
		    var select = xpath.useNamespaces({"x": "http://www.w3.org/1999/xhtml"});
		    Object.keys(req.body.annotations).forEach(a => {
		    	console.log(a);

		    	//Case where the annotation is linked to a pre-existing block id
		    	if (doc.getElementById(req.body.annotations[a].id)) {
		    		return;
		    	}
		    	//Creates xpath query with correct namespace
		    	var query = function(xpath){
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
		    	console.log("START NODE: %s",startNode.data);
		    	startNode.splitText(+req.body.annotations[a].startOffset);
		    	console.log("START NODE AFTER SPLIT: %s",startNode.data);

		    	var insertAfter = function(referenceNode, newNode){
		    		referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
		    	}

		    	//Insert new span node
		    	console.log("Adding span node...");
		    	insertAfter(startNode, annotationElement);

		    	//Move all nodes between start and end to the new span node
		    	var current = annotationElement.nextSibling;
		    	while (current != endNode){
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
		    var annotationsRegex = /(?:<script)(?:.*)(?:type="application\/ld\+json")(?:>)((\s|\S)*?)(?:<\/script>)/igm;
		    var match = annotationsRegex.exec(html.toString());
		    var reviewId = "#review" + (match != null ? match.length + 1 : 1);
		    review["@id"] = reviewId;
		    var article = {};
		    review["article"] = article;
		    article["@id"] = "";
		    var eval = {};
		    eval["@id"] = reviewId + "-eval";
		    eval["@type"] = "score";
		    eval["status"] = "pso:under-review" 
		    eval["author"] = req.jwtPayload.id;
		    eval["date"] = new Date().toISOString();
		    article["eval"] = eval;
		    reviewBlock.push(review);
		    var annotationIds = [];
		    var i=0;
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
		    reviewBlock.push(person);

		    var jsonText = doc.createTextNode(JSON.stringify(reviewBlock, null, "\t"));

		    jsonLDBlock.appendChild(jsonText);

		    var head = select("//x:head", doc)[0];

		    head.appendChild(jsonLDBlock);

		    //Write back to file
		    fs.writeFileSync(filePath, serializer.serializeToString(doc));

		    res.send('Paper reviewed successfully.')
		});
	} else res.status(404).send('404 sorry not found');
});

module.exports = router;
