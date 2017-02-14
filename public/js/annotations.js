var currentSelection;
var $addAnnotationPopup = $('<button id="add-annotation-btn" class="add-annotation-btn no_select hidden"><i class="fa fa-plus" aria-hidden="true"></i></button>');
var $addBlockAnnotationPopup = $('<button id="add-block-annotation-btn" class="add-block-annotation-btn no_select"><i class="fa fa-plus" aria-hidden="true"></i></button>');
var addAnnotationPopupDisplayDelayTimeout;
var shouldShowPopup = false;
var reviewerColor;
var activeMode = 'reader';
var blockAnnotationElements = ['p', 'div', 'section', 'figure', 'footer', 'header'];
var inlineAnnotationElements = ['span', 'em', 'code', 'a', 'time', 'cite', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// Release lock on current paper if there are no draft annotations
window.onbeforeunload = function(event) {
	console.log("onbeforeunload");
	automaticLockReleaseForReviewers();

	return undefined;	// Must be undefined for avoiding the default pop up to show
};

function automaticLockReleaseForReviewers() {
	console.log("automaticLockReleaseForReviewers");
	console.log("activeMode = " + activeMode);
	if (activeMode === 'reviewer' && $('#paper-container').children().length !== 0) {
		console.log("automaticLockReleaseForReviewers IF");
		var paperID = document.location.pathname.split('papers/').pop().replace('/','');
		var draftAnnotations = JSON.parse(localStorage.getItem(paperID + '/draftAnnotations'));
		if (!draftAnnotations){ //Release lock if there are no unsaved annotations
			$.ajax({
				method: 'DELETE',
				url: encodeURI('/api/papers/' + paperID + '/lock'),
				success: function(result) {
					updateModeCheckbox(result.lockAcquired);
				},
				error: function(error) {
					updateModeCheckbox(false);	
				}
			});
		}
	}
}

$(document).ready(function() {
	var colorIndex = Math.floor(Math.random() * distinctColors.length);
	reviewerColor = hexToRgbA(distinctColors[colorIndex], 0.5);
	distinctColors.splice(colorIndex, 1);

	$('#mode-checkbox').on('click', function(event) {
		if ($('#paper-container').children().length === 0) {
			event.preventDefault();
			showNotify('You are not allowed to change mode if no paper is selected', true);
		}
		else {
			var userIsRev = JSON.parse(sessionStorage.revForPaper);
			console.log("userIsRev = " + userIsRev);
			console.log("userRole = " + sessionStorage.userRole);
			//if (userIsRev) {
				console.log("is user a reviewer for this paper? " + sessionStorage.revForPaper);
				console.log("userRole = " + sessionStorage.userRole);
				var alreadyReviewed = JSON.parse(sessionStorage.alreadyReviewed);
				
				if (!userIsRev || sessionStorage.userRole === "Chair") {
					event.preventDefault();
					var message;
					if (sessionStorage.userRole === 'Chair')
						message = 'You are not allowed to enter Annotator Mode since you are Chair of the selected conference!';
					else message = "You are not allowed to enter Annotator Mode because you don't have Reviewer rights on this paper!";
					showNotify(message, true);
				}
				else if (alreadyReviewed) {
					event.preventDefault();
					showNotify('You have already reviewed this paper!', true);
				}
				else {	// L'utente è un reviewer per il paper ma prima bisogna controllare il lock sull'articolo
					var isEnteringAnnotator = $(this).is(':checked') ? true : false;
					var paperID = document.location.pathname.split('papers/').pop().replace('/','');
					if (isEnteringAnnotator){
						$.ajax({
							method: 'PUT',
							url: encodeURI('/api/papers/' + paperID + '/lock'),
							success: function(result) {
								updateModeCheckbox(result.lockAcquired);
							},
							error: function(error) {
								showNotify(JSON.parse(error.responseText).message, true);
								updateModeCheckbox(false);	
							}
						});
					} else {
						var paperID = document.location.pathname.split('papers/').pop().replace('/','');
						var draftAnnotations = JSON.parse(localStorage.getItem(paperID + 'draftAnnotations'));
						if (!draftAnnotations){ //Release lock if there are no unsaved annotations
							$.ajax({
								method: 'DELETE',
								url: encodeURI('/api/papers/' + paperID + '/lock'),
								success: function(result) {
									updateModeCheckbox(result.lockAcquired);
								},
								error: function(error) {
									updateModeCheckbox(false);	
								}
							});
						}
					}
				//}
			}
		}
	});
});

/* Handles the click of the annotator/reader checkbox */
function updateModeCheckbox(checked) {
	$('#mode-checkbox').prop('checked', checked);

	if ($('#mode-checkbox').is(':checked')) {
		activeMode = 'reviewer';
	} else {
		activeMode = 'reader';
	}
	refreshMode();
}

/* Deals with refreshing the current mode (annotator or reader) */
function refreshMode() {
	if (activeMode === 'reviewer') {
		//Reviewer mode
		$('section .cgen').addClass('hidden');
		$('.send-review-btn').removeClass('hidden').animateCss('fadeIn');
		$addBlockAnnotationPopup.removeClass('hidden');
		$addAnnotationPopup.removeClass('hidden');
	} else if (activeMode === 'reader') {
		//Annotator mode
		$('section .cgen').removeClass('hidden');
		$('.send-review-btn').addClass('hidden');
		$addBlockAnnotationPopup.addClass('hidden');
		$addAnnotationPopup.addClass('hidden');
	}
	$(document).trigger('modechanged');
}

/* Returns the xpath query for a given node. It attempts to get the closest parent id to the node and sets it as the first predicate */
function getXPath(node) {
    var comp, comps = [];
    var parent = null;
    var xpath = '';
    var getPos = function(node) {
        var position = 1, curNode;
        if (node.nodeType == Node.ATTRIBUTE_NODE) {
            return null;
        }
        for (curNode = node.previousSibling; curNode; curNode = curNode.previousSibling) {
            if (curNode.nodeName == node.nodeName) {
                ++position;
            }
        }
        return position;
     }

    if (node instanceof Document) {
        return '/';
    }

    var foundId = false;

    for (; node && !(node instanceof Document) && !foundId; node = node.nodeType == Node.ATTRIBUTE_NODE ? node.ownerElement : node.parentNode) {
        comp = comps[comps.length] = {};
        switch (node.nodeType) {
            case Node.TEXT_NODE:
                comp.name = 'text()';
                break;
            case Node.ATTRIBUTE_NODE:
                comp.name = '@' + node.nodeName;
                break;
            case Node.PROCESSING_INSTRUCTION_NODE:
                comp.name = 'processing-instruction()';
                break;
            case Node.COMMENT_NODE:
                comp.name = 'comment()';
                break;
            case Node.ELEMENT_NODE:
            	if (node.id && node.nodeName.toUpperCase() === "SECTION"){
            		foundId = true;
            		comp.id = node.id;
            	}
                comp.name = node.nodeName;
                break;
        }
        if (!foundId){
        	comp.position = getPos(node);
    	}
    }

    for (var i = comps.length - 1; i >= 0; i--) {
        comp = comps[i];
        if (comp.id){
        	xpath += '//' + comp.name.toLowerCase();
        	xpath += '[@id="' + comp.id + '"]';
        } else {
        	xpath += '/' + comp.name.toLowerCase();   	

	        if (comp.position != null) {
	            xpath += '[' + comp.position + ']';
	        }
        }
    }

    return xpath;

}

$(window).load(function() {
	refreshMode();
	selectionchange.start();
	$(document).mouseup(function() {
		//Make button visible
		if (activeMode === 'reviewer' && shouldShowPopup) {
			$addAnnotationPopup.removeClass('hidden').animateCss('tada');
		}

		$('.send-review-btn').off('click').click(function(e){
			openReviewAnnotationsModal();
		});
		//Handle click on inline annotation button
		$addAnnotationPopup.off('click').click(function(e) {
			if (activeMode !== 'reviewer') {
				return;
			}
			var currentNode;
			var annotation = {};
			
			annotation.text = currentSelection.text();

			annotation.content = '';
			annotation.type = 'inline';
			annotation.author = sessionStorage.userID.replace('mailto:', '').replace(/(@.*)/g, '').replace(/\s+/g, '-').replace(/[^a-zA-Z-]/g, '').toLowerCase();
			if (!currentSelection.isBackwards()){
				annotation.startXPath = getXPath(currentSelection.anchorNode);
				annotation.startOffset = currentSelection.anchorOffset;
				annotation.endXPath = getXPath(currentSelection.focusNode);
				annotation.endOffset = currentSelection.focusOffset;
			} else {
				annotation.startXPath = getXPath(currentSelection.focusNode);
				annotation.startOffset = currentSelection.focusOffset;
				annotation.endXPath = getXPath(currentSelection.anchorNode);
				annotation.endOffset = currentSelection.anchorOffset;
			}
			
			loadDraftAnnotation(annotation);
		});
		//Handle click on block annotation button
		/*
		$addBlockAnnotationPopup.off('click').click(function(e) {
			if (activeMode !== 'reviewer') {
				return;
			}
			var currentNode;
			var annotation = {};
			
			annotation.text = $addBlockAnnotationPopup.parent().text();
			annotation.content = '';
			annotation.type = 'block';
			annotation.author = sessionStorage.userID.replace('mailto:', '').replace(/(@.*)/g, '').replace(/\s+/g, '-').replace(/[^a-zA-Z-]/g, '').toLowerCase();
			annotation.startXPath = getXPath($addBlockAnnotationPopup.parent()[0]);

			loadDraftAnnotation(annotation);
		});*/
	});
	// Repositions the button to add an annotation
	var repositionAddAnnotationButton = function() {
		if (!currentSelection) return;
		var anchor = currentSelection.anchorNode;
		if (!anchor) return;
		var parent = anchor.parentNode;
		var relative = getRelativePosition(parent.getBoundingClientRect(), currentSelection.nativeSelection.getRangeAt(0).getBoundingClientRect());
		$addAnnotationPopup.css({
			'top': (relative.top - $addAnnotationPopup.height()) + 'px',
			'left': (relative.left + relative.childWidth) + 'px'
		});

		$(parent).prepend($addAnnotationPopup);
	}

	$(window).resize(function(e) {
		repositionAddAnnotationButton();
	});

	$(document).on('selectionchange', function(e) {
		shouldShowPopup = false;
		currentSelection = rangy.getSelection();
		if (currentSelection.rangeCount === 0) {
			return;
		}

		// Cases in which the button should be hidden
		if (currentSelection.anchorNode.parentNode !== currentSelection.focusNode.parentNode //Different parent
			|| !$('.paper-container').has(currentSelection.anchorNode).length || !$('.paper-container').has(currentSelection.focusNode).length //Out of bounds
			|| $('.cgen').has($(currentSelection.anchorNode)).length || $('.cgen').has($(currentSelection.focusNode)).length || currentSelection.anchorNode === currentSelection.focusNode && currentSelection.anchorOffset === currentSelection.focusOffset // Nothing selected
		) {
			$addAnnotationPopup.addClass('hidden');
			return;
		}

		//Get selection position relative to its parent
		repositionAddAnnotationButton();

		shouldShowPopup = true;

		clearTimeout(addAnnotationPopupDisplayDelayTimeout);

		addAnnotationPopupDisplayDelayTimeout = setTimeout(function() {
			if (activeMode === 'reviewer' && shouldShowPopup && $addAnnotationPopup.hasClass('hidden')) {
				$addAnnotationPopup.removeClass('hidden').animateCss('tada');
			}
		}, 500);
	});
});

/* Loads all draft (editing) annotations with their relative popups */
function loadDraftAnnotations() {
	var paperId = document.location.pathname.split('/papers/')[1].replace(/\/?$/, '/');
	if (localStorage.getItem(paperId + 'draftAnnotations')) {
		var draftAnnotations = JSON.parse(localStorage.getItem(paperId + 'draftAnnotations'));
		Object.keys(draftAnnotations).forEach(function(annotationKey) {
			loadDraftAnnotation(draftAnnotations[annotationKey]);
		});
	}
	/*
	var $blocks = $('.paper-container>*').not('.cgen').find(blockAnnotationElements.join(', ')).not('.cgen').add($('.paper-container>*').not('.cgen'));
	$blocks.mouseover(function(e) {
		e.stopPropagation();
		var $elem = $(this);
		$elem.prepend($addBlockAnnotationPopup);
		$addBlockAnnotationPopup.css('height', $elem.height());
	});
	$blocks.mouseleave(function(e){
		e.stopPropagation();
		$addBlockAnnotationPopup.detach();
	});*/
}

/* Returns the first element from its given xpath */
function getElementByXpath(path) {
  return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

/* Loads an annotation in draft mode, i.e. editing mode */
function loadDraftAnnotation(annotation) {
	var $wrapper;

	if (annotation.type === 'inline'){
		//Restore selection
		var range = rangy.createRange();
		var startNode = getElementByXpath(annotation.startXPath);
		if (!startNode) return;
		range.setStart(startNode, Math.min(annotation.startOffset, startNode.length));
		var endNode = getElementByXpath(annotation.endXPath);
		if (!endNode) return;
		range.setEnd(endNode, Math.min(annotation.endOffset, endNode.length));
		var limitRange = rangy.createRange();
		limitRange.selectNode(range.endContainer);
		range = limitRange.intersection(range);
		//Wrap selection
		$wrapper = $('<span></span>)');
		range.surroundContents($wrapper[0]);
		$wrapper[0].parentNode.normalize();
		var isNewWrapper = $wrapper[0].nextSibling && $wrapper[0].nextSibling.nodeType === 3 || $wrapper[0].previousSibling && $wrapper[0].previousSibling.nodeType === 3;
		if (!isNewWrapper) { //Find out if text is already wrapped by parent, if so, unwrap and change the actual wrapper
			var p = $wrapper.parent();
			$wrapper.contents().unwrap();
			$wrapper[0].normalize();
			$wrapper = p;
		}
		//Store info about whether the wrapper is newly generated, to be known in the eventuality of removal
		$wrapper.data('isNewWrapper', isNewWrapper); 
	} else {
		$wrapper = $(getElementByXpath(annotation.startXPath));
		$wrapper.data('isNewWrapper', false); 
	}
	
	//Find a proper id if none is found
	if (!$wrapper[0].id) {
		annotation.id = getUniqueAnnotationId();
		$wrapper.attr('id', annotation.id);
	} else {
		annotation.id = $wrapper[0].id;
	}
	
	$wrapper.addClass(annotation.type === 'inline' ? 'inline-annotation' : 'block-annotation');
	$wrapper.addClass(annotation.author);
	var statement = (annotation.type === 'inline' ? '.inline-annotation.' : '.block-annotation.') + annotation.author;
	var style = {};
	style[statement] = {'background' : reviewerColor};
	$.injectCSS(style);

	//Get popover for annotation editor
	var $popover = $wrapper.webuiPopover({
		placement: 'top',
		trigger: 'click',
		type: 'html',
		animation: 'pop',
		closeable: true,
		content: getInlineAnnotationEditor($wrapper.attr('id'), annotation.content), //TODO: Check this out
		delay: { "show": 0, "hide": 300 }
	});

	if (!annotation.content) {
		setTimeout(function() {
			$popover.webuiPopover('show');
			$('textarea').focus();
		}, 1);
	}

	//Hide all other popovers when one is opened
	$popover.on("shown.webui.popover", function(e) {
		$('#' + $wrapper.attr('id') + '-editor button.remove-annotation').click(function() {
			//Empty text on popup and close
			$('#' + $wrapper.attr('id') + '-editor textarea').val(''); 
			WebuiPopovers.hideAll();
		});
		$('#' + $wrapper.attr('id') + '-editor button.confirm-annotation').click(function() {
			WebuiPopovers.hideAll();
		});
	});

	//Manage popup closing (remove annotation if empty, store it in localStorage etc.)
	$popover.on("hidden.webui.popover", function(e) {
		
		annotation.content = $('#' + $wrapper.attr('id') + '-editor textarea').val();
		if (!annotation.content) {
			//Text is empty on popup close
			var isNewWrapper = $wrapper.data('isNewWrapper');
			if (isNewWrapper) {
				var p = $wrapper.parent();
				$wrapper.contents().unwrap();
				$wrapper.remove();
				$('#' + $wrapper.attr('id') + '-editor textarea').parent().remove();
				p[0].normalize();
			} else {
				$wrapper.webuiPopover('destroy');
				$wrapper.off('click');
				$wrapper.removeClass('inline-annotation');
				$wrapper.removeClass('block-annotation');
			}
		}
		//Save annotation locally
		var paperId = document.location.pathname.split('/papers/')[1].replace(/\/?$/, '/'); //Add trailing slash
		if (!localStorage.getItem(paperId + 'draftAnnotations')) {
			localStorage.setItem(paperId + 'draftAnnotations', JSON.stringify({}));
		}
		var annotations = JSON.parse(localStorage.getItem(paperId + 'draftAnnotations'));
		annotations[annotation.id] = annotation;

		//Remove annotation from localStorage if empty
		if (!annotation.content) {
			delete annotations[annotation.id];
		}
		localStorage.setItem(paperId + 'draftAnnotations', JSON.stringify(annotations));
	});

	$wrapper.on("click", function(e) {
		$('textarea').focus();
	});
}

function openReviewAnnotationsModal(){
	$('#reviewAnnotationsModal').modal('show');
	var paperId = document.location.pathname.split('/papers/')[1].replace(/\/?$/, '/'); //Add trailing slash
	if (!localStorage.getItem(paperId + 'draftAnnotations')) {
		localStorage.setItem(paperId + 'draftAnnotations', JSON.stringify({}));
	}
	$('#annotationsTable>tbody').empty();
	var draftAnnotations = JSON.parse(localStorage.getItem(paperId + 'draftAnnotations'));
	Object.keys(draftAnnotations).forEach(function(annotationKey) {
		loadDraftAnnotation(draftAnnotations[annotationKey]);

		var annRow = $('<tr><td>' + draftAnnotations[annotationKey].text + '</td><td>' + draftAnnotations[annotationKey].content + '</tr></td>');
		annRow.data('target', '#'+draftAnnotations[annotationKey].id);
		annRow.on('click', function(e){
			var hash = annRow.data('target');
			var scrollTarget = hash && $(hash).offset() ? $(hash).offset().top : $('#top').offset().top;
			$('#reviewAnnotationsModal').modal('hide');
		    window.scrollTo(0, scrollTarget - $('.topnav').height());
		});
		$('#annotationsTable>tbody').append(annRow);
	});

	// Are annotations removed from draftannotation when deleted? O.o
	if (Object.keys(draftAnnotations).length === 0) {
		$('#reviewSubmit').prop('disabled', true);
		showErrorAlert('#reviewAnnotationsModal .modal-body', 'There aren\'t annotations to save!', false);
	}
	else {
		$('#reviewSubmit').prop('disabled', false);
		$('#reviewAnnotationsModal .modal-body .alert').addClass('hidden');
	}
}

function sendReview(){
	var decision = $("input[name=decisionradio]:checked").val();
	var paperId = document.location.pathname.split('/papers/')[1].replace(/\/?$/, '/');
	
	var review = {
		annotations: JSON.parse(localStorage.getItem(paperId + 'draftAnnotations')),
		decision: decision
	}
	console.log(review);
	$.ajax({
		url: '/api/papers/' + paperId + 'review',
		method: 'POST',
		data: review,
		success: function(result) {
			showNotify('Review sent successfully!', false);
			localStorage.removeItem(paperId + 'draftAnnotations');
			$('#reviewAnnotationsModal').modal('hide');
			loadCurrentPaperContent();
			updateStatusLabel('/papers/' + paperId, UPDATE_ICON_REVIEW_SENT);
		},
		error: function(error) {
			$('.send-review-btn').animateCss('shake');
			showNotify(JSON.parse(error.responseText).message, true);		// Controllare formato errore ritornato
		}
	});
}

function getUniqueAnnotationId() {
	var max = 0;
	$('.inline-annotation, .block-annotation').each(function() {
		if (!$(this).attr('id')) {
			console.log($(this));
		}
		var n = $(this).attr('id').split('fragment')[1];
		if (n && !isNaN(parseInt(n))) {
			max = Math.max(max, parseInt(n));
		}
	});
	return 'fragment' + (max + 1);
}

function getNodeIndex(node) {
	return Array.prototype.indexOf.call(node.parentNode.childNodes, node) + (document.getElementById("add-annotation-btn").parentNode === node.parentNode ? -1 : 0);
}

function getRelativePosition(parentPos, childPos) {
	var relativePos = {};

	relativePos.top = childPos.top - parentPos.top;
	relativePos.right = childPos.right - parentPos.right;
	relativePos.bottom = childPos.bottom - parentPos.bottom;
	relativePos.left = childPos.left - parentPos.left;
	relativePos.childWidth = childPos.width;
	relativePos.childHeight = childPos.height;
	return relativePos;
}

/* Loads all annotations to be properly viewed */
function loadAnnotations() {
	reviews = []; //Comments and reviews
	annotationsById = {}; //Global variable
	//Find the json+ld contents
	$addedHeadTags.filter('script[type="application/ld+json"]').each(function() {
		var review = JSON.parse($(this).html());
		//console.log($(this).html);
		if (review.constructor === Array){
			reviews.push(review);
			var person = review.find(function(r) { return r['@type'] === 'person' });
			review.forEach(function(annotation) {
				//Fill up the annotations and styles info 
				if (annotation.ref) {
					annotation.name = person.name;
					annotation.email = person['foaf:mbox'] ? person['foaf:mbox']['@id'] : null;
					var refs = [].concat(annotation.ref);
					refs.forEach(function(ref) {
						if (annotationsById[ref]) {
							annotationsById[ref].push(annotation);
						} else {
							annotationsById[ref] = [annotation];
						}
					});
					if (!reviewerColors[annotation.author]) {
						var colorIndex = Math.floor(Math.random() * distinctColors.length);
						reviewerColors[annotation.author] = distinctColors[colorIndex];
						distinctColors.splice(colorIndex, 1);
					}
				}
			});
		}
	});
	Object.keys(annotationsById).forEach(function(id) {
		annotationsById[id].sort(function(a, b) {
			return b.text.length - a.text.length
		});
		//Deal with coloring the annotation background based on reviewer
		var colors = annotationsById[id].map(function(annotation) {
			return hexToRgbA(reviewerColors[annotation.author], 0.5);
		});
		colors = '(' + colors.join(',') + ')';
		var gradients = [
				'-webkit-linear-gradient' + colors,
				'-moz-linear-gradient' + colors,
				'-o-linear-gradient' + colors,
				'linear-gradient' + colors
			]
			//Highlight color default to first reviewer's color
		var rgbColor = reviewerColors[annotationsById[id][0].author];
		var rgbaColor = hexToRgbA(rgbColor, 0.4);
		//INLINE ANNOTATIONS appear as highlighted text and popover (plus h1, h2, h3)
		if (inlineAnnotationElements.indexOf($('#'+id.replace('#', '')).prop('tagName').toLowerCase()) >= 0) {
			var $elem = $('#'+id.replace('#', ''));
			
			$elem.addClass('inline-annotation');

			var statement = statement = ".inline-annotation";
			annotationsById[id].forEach(function(annotation) {
				if (annotation.author){
					var annotationClass = annotation.author.replace('mailto:', '').replace(/(@.*)/g, '').replace(/\s+/g, '-').replace(/[^a-zA-Z-]/g, '').toLowerCase();
					$elem.addClass(annotationClass);
					statement = statement + '.' + annotationClass;
				}
			});
			statement = statement + ":not(.filteredOut)";
			
			var style = {};
			
			if (annotationsById[id].length > 1) {
				gradients.forEach(function(gradient) {
					style[statement] = {'background' : gradient};
					$.injectCSS(style);
				});
			} else {
				style[statement] = {'background' : rgbaColor};
				$.injectCSS(style);
				
			}

			$elem.webuiPopover({
				placement: 'top',
				trigger: 'click',
				type: 'html',
				animation: 'pop',
				closeable: true,
				content: getInlineAnnotationHtml(id, annotationsById[id]),
				delay: { "show": 0, "hide": 300 }
			});

			$elem.click(function(e) {
				//$popover.webuiPopover('show');
				e.stopPropagation();
			});

			$elem.on("shown.webui.popover", function(e) {
				carouselNormalization('#carousel-' + id.replace('#', '') + ' .item');
			});

			$('#carousel-' + id).carousel();
		//BLOCK ANNOTATIONS appear on the side with a hover effect
		} else if (blockAnnotationElements.indexOf($(id).prop('tagName').toLowerCase()) >= 0) {
			var $anchor = $('<div class="comment-anchor cgen hidden-print"></div>');
			var $elem = $(id);

			var statement = ".comment-anchor." + id.replace('#', '');
			var style = {};
			style[statement] = {'background' : rgbaColor};
			$.injectCSS(style);
			$anchor.addClass(id.replace('#', ''));

			var inner = ['section', 'footer', 'header'].indexOf($(id).prop('tagName').toLowerCase()) < 0;
			if (inner) { //is section, footer or header
				//Do not set cgen to prevent from hiding
				var $wrapper = $('<div class=""></div>');
				$elem.replaceWith($wrapper);
				$wrapper.append($anchor);
				$wrapper.append($elem);
			} else {
				$elem.prepend($anchor);
			}

			var animateOut = function($element) {
				$anchor.stop(true, false).animate({ 'min-width': '0' }, {
					duration: 300,
					easing: 'easeInCubic'
				});
			};
			var $popover = $anchor.webuiPopover({
				placement: 'top-right',
				trigger: 'click',
				type: 'html',
				animation: 'pop',
				closeable: true,
				arrow: false,
				offsetTop: -10,
				content: getInlineAnnotationHtml(id),
				delay: { "show": 0, "hide": 0 },
				onShow: function($element) {
					var target = $anchor.parent().width() - parseInt($anchor.css('marginLeft')) * 2;
					$anchor.stop(true, false).animate({ 'min-width': target }, {
						duration: 400,
						easing: 'easeOutQuad',
						done: function() {
							if (!$popover.is(':visible')) {
								animateOut($element);
							}
						}
					});
				},
				onHide: animateOut
			});

			$popover.on("shown.webui.popover", function(e) {
				carouselNormalization('#carousel-' + id.replace('#', '') + ' .item');
			});
			$('#carousel-' + id).carousel();
		}
	});
}

/* Returns the content of a popup annotation */
function getInlineAnnotationHtml(id) {
	var annotations = annotationsById[id];
	var carouselId = 'carousel-' + id.replace('#', '');
	var $carouselContainer = $('<div id="' + carouselId + '" class="carousel slide" data-ride="carousel" data-interval="false"></div>');
	var $carouselIndicatorsContainer = $('<ol class="carousel-indicators"></ol>');
	var $carouselInner = $('<div class="carousel-inner" role="listbox"></div>');
	var $carouselControls = $('<div class="carousel-controls"><a class="oull-left" href="#' + carouselId + '" role="button" data-slide="prev">\
							   <span class="glyphicon glyphicon-chevron-left"></span>\
							   <span class="sr-only">Previous</span>\
							   </a>\
							   <a class="pull-right" href="#' + carouselId + '" role="button" data-slide="next">\
							   <span class="glyphicon glyphicon-chevron-right"></span>\
							   <span class="sr-only">Next</span>\
							   </a></div>');

	annotations.forEach(function(annotation, index) {
		$carouselIndicatorsContainer.append($('<li data-target="#' + carouselId + '" data-slide-to="' + index + '" ' + (index === 0 ? 'class="active"' : '') + '></li>'));
		$carouselInner.append($('<div class="item ' + (index === 0 ? 'active' : '') + '">\
								<div class="comment-header" style="border-color:' + reviewerColors[annotations[index].author] + '"><span>' 
								+ (annotation.email ? ('<a href="' + annotation.email + '">' + annotation.name + '</a>') : annotation.name)
								+ '</span><time datetime="' + annotation.date + '" >' + moment(annotation.date).fromNow() + '</time></div>\
								<p>' + annotation.text + '</p>\
								</div>'));
	});

	if (annotations.length <= 1) {
		$carouselControls.addClass('hidden');
	}
	$carouselControls.append($carouselIndicatorsContainer);
	$carouselContainer.append($carouselInner).append($carouselControls);
	return $carouselContainer[0].outerHTML;
}

/* Returns the jquery element for an annotation editor for inline annotations */
function getInlineAnnotationEditor(id, content) {
	var $container = $('<div id="' + id + '-editor' + '"></div>');
	var $textarea = $('<textarea class="inline-annotation-editor" type="text" ' + (activeMode === 'reader' ? 'disabled="disabled"' : '') + '>' + content + '</textarea>');
	$container.append($textarea);
	var $btngroup = $('<div class="btn-group pull-right ' + (activeMode === 'reader' ? 'hidden' : '') + '" role="group"></div>');
	$btngroup.append($('<button class="btn btn-danger remove-annotation">Delete</button>'));
	$btngroup.append($('<button class="btn btn-success confirm-annotation">Confirm</button>'));
	$container.append($btngroup);
	$(document).on('modechanged', function(e){
		if (activeMode === 'reviewer') {
			//Reviewer mode
			$textarea.prop("disabled", false);
			$btngroup.removeClass('hidden');
		} else if (activeMode === 'reader') {
			//Annotator mode
			$textarea.prop("disabled", true);
			$btngroup.addClass('hidden');
		}
	});
	return $container;
}

/* Causes all carousel slides to be the height of the tallest one */
function carouselNormalization(selector) {
	var items = $(selector), //grab all slides
		heights = [], //create empty array to store height values
		tallest, //create variable to make note of the tallest slide
		widths = [],
		largest;

	if (items.length) {
		function normalizeHeights() {
			items.each(function() { //add heights to array
				heights.push($(this).height());
				widths.push($(this).width());
			});
			tallest = Math.max.apply(null, heights); //cache largest value
			largest = Math.max.apply(null, widths);
			items.each(function() {
				$(this).css('min-height', tallest + 'px');
				$(this).css('min-width', largest + 'px');
			});
		};
		normalizeHeights();

		$(window).on('resize orientationchange', function() {
			tallest = 0, heights.length = 0; //reset vars
			largest = 0, widths.length = 0;
			items.each(function() {
				$(this).css('min-height', '0'); //reset min-height
				$(this).css('min-width', '0');
			});
			normalizeHeights(); //run it again 
		});
	}
}

/* Converts hex code to rgbA with the set opacity */
function hexToRgbA(hex, opacity) {
	var c;
	if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
		c = hex.substring(1).split('');
		if (c.length == 3) {
			c = [c[0], c[0], c[1], c[1], c[2], c[2]];
		}
		c = '0x' + c.join('');
		return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + opacity + ')';
	}
	throw new Error('Bad Hex: ' + hex);
}

/* Converts hex code to rgbA blended with the set opacity */
function hexToAlphaBlended(hex, bgHex, opacity) {
	var sourceRGB = hexToRgb(hex);
	var bgRGB = hexToRgb(bgHex);
	var targetR = ((1 - opacity) * bgRGB.r) + (1 * sourceRGB.r);
	var targetG = ((1 - opacity) * bgRGB.g) + (1 * sourceRGB.g);
	var targetB = ((1 - opacity) * bgRGB.b) + (1 * sourceRGB.b);
	return rgbToHex(targetR, targetG, targetB);
}

/* Converts hex code to rgb */
function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}

/* Converts rgb digit to hex digit */
function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}

/* Converts rgb code to hex */
function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
