var currentSelection;
var $addAnnotationPopup = $('<button id="add-annotation-btn" class="add-annotation-btn no_select hidden"><i class="fa fa-plus" aria-hidden="true"></i></button>');
var $addBlockAnnotationPopup = $('<button id="add-block-annotation-btn" class="add-block-annotation-btn no_select"><i class="fa fa-plus" aria-hidden="true"></i></button>');
var addAnnotationPopupDisplayDelayTimeout;
var shouldShowPopup = false;
var reviewerColor;
var activeMode = 'reader';
var blockAnnotationElements = ['p', 'div', 'section', 'figure', 'footer', 'header'];
var inlineAnnotationElements = ['span', 'em', 'code', 'a', 'time', 'cite', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

// release lock on current paper, if opened 
window.onbeforeunload = function(event) {
	if (activeMode === 'reviewer' && $('#paper-container').children().length !== 0) {
		var status = { exiting: true };
		var paperID = document.location.pathname.split('papers/').pop().replace('/','');

		$.ajax({
			method: 'PUT',
			data: status,
			url: encodeURI('/api/papers/' + paperID + '/locking'),
			success: function(result) {
				updateModeCheckbox(result.lockAcquired);
			},
			error: function(error) {
				updateModeCheckbox(false);	
			}
		});
	}

	return undefined;	// Must be undefined for avoiding the default pop up to show
};

$(document).ready(function() {
	var colorIndex = Math.floor(Math.random() * distinctColors.length);
	reviewerColor = hexToRgbA(distinctColors[colorIndex], 0.4);
	distinctColors.splice(colorIndex, 1);

	$('#mode-checkbox').on('click', function(event) {
		if ($('#paper-container').children().length === 0) {
			event.preventDefault();
			$.notify({
				message: "You are not allowed to change mode if no paper is selected",
				icon: "fa fa-exclamation-triangle"
			}, {
				type: "danger",
				delay: 3000,
				z_index: 1051,
				mouse_over: "pause"
			});
		}
		else {
			if (sessionStorage.paperRole) {
				var alreadyReviewed = JSON.parse(sessionStorage.alreadyReviewed);
				if (sessionStorage.paperRole !== "Reviewer") {
					event.preventDefault();
					$.notify({
						message: "You are not allowed to review this paper because you are " + sessionStorage.paperRole + "!",
						icon: "fa fa-exclamation-triangle"
					}, {
						type: "danger",
						delay: 3000,
						z_index: 1051,
						mouse_over: "pause"
					});
				}
				else if (alreadyReviewed) {
					event.preventDefault();
					$.notify({
						message: "You have already reviewed this paper!",
						icon: "fa fa-exclamation-triangle"
					}, {
						type: "danger",
						delay: 3000,
						z_index: 1051,
						mouse_over: "pause"
					});
				}
				else {	// L'utente è un reviewer per il paper ma prima bisogna controllare il lock sull'articolo
					var status = {};
					status.exiting = !$(this).is(':checked') ? true : false;
					var paperID = document.location.pathname.split('papers/').pop().replace('/','');

					$.ajax({
						method: 'PUT',
						data: status,
						url: encodeURI('/api/papers/' + paperID + '/locking'),
						success: function(result) {
							updateModeCheckbox(result.lockAcquired);
						},
						error: function(error) {
							$.notify({
								message: JSON.parse(error.responseText).message,
								icon: "fa fa-exclamation-triangle"
							}, {
								type: "danger",
								delay: 3000,
								mouse_over: "pause"
							});

							updateModeCheckbox(false);	
						}
					});
				}
			}
		}
	});
});

function updateModeCheckbox(checked) {
	$('#mode-checkbox').prop('checked', checked);

	if ($('#mode-checkbox').is(':checked')) {
		activeMode = 'reviewer';
	} else {
		activeMode = 'reader';
	}
	refreshMode();
}

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
	$(document).mouseup(function() {
		//Make button visible
		if (activeMode === 'reviewer' && shouldShowPopup) {
			$addAnnotationPopup.removeClass('hidden').animateCss('tada');
		}

		$('.send-review-btn').off('click').click(function(e){
			openReviewAnnotationsModal();
			//sendReview();
		});
		$addAnnotationPopup.off('click').click(function(e) {
			if (activeMode !== 'reviewer') {
				return;
			}
			var currentNode;
			var annotation = {};

			/* Build path strings 
			currentNode = currentSelection.anchorNode;
			while (!currentNode.tagName || currentNode.tagName.toLowerCase() !== 'section' && $('.paper-container').has($(currentNode))) {
				currentNode = currentNode.parentNode;
			}
			if (currentNode.tagName.toLowerCase() === 'section') {
				annotation.sectionId = currentNode.id;
				annotation.sectionIndex = getNodeIndex(currentNode);
				annotation.characterRanges = currentSelection.saveCharacterRanges(currentNode);
				// annotation.sectionStart = bounds.characterRange.start;
				// annotation.sectionEnd = bounds.characterRange.end;
			}
			currentNode = currentSelection.anchorNode;
			annotation.start = '^' + currentSelection.anchorOffset;
			while (!currentNode.id) {
				annotation.start = '/' + getNodeIndex(currentNode) + annotation.start;
				currentNode = currentNode.parentNode;
			}
			annotation.start = currentNode.id + annotation.start;

			currentNode = currentSelection.focusNode;
			annotation.end = '^' + currentSelection.focusOffset;
			while (!currentNode.id) {
				annotation.end = '/' + getNodeIndex(currentNode) + annotation.end;
				currentNode = currentNode.parentNode;
			}
			annotation.end = '#' + currentNode.id + annotation.end;
			
			/* END Build path strings */
			annotation.text = currentSelection.text();

			annotation.isBackwards = currentSelection.isBackwards();

			annotation.content = '';
			
			annotation.startXPath = getXPath(currentSelection.anchorNode);
			annotation.startOffset = currentSelection.anchorOffset;
			annotation.endXPath = getXPath(currentSelection.focusNode);
			annotation.endOffset = currentSelection.focusOffset;

			loadDraftAnnotation(annotation);
		});
	});

	var repositionAddAnnotationButton = function() {
		var parent = currentSelection.anchorNode.parentNode;
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

		/* Cases in which the button should be hidden*/
		if (currentSelection.anchorNode.parentNode !== currentSelection.focusNode.parentNode //Different parent
			|| !$('.paper-container').has(currentSelection.anchorNode).length || !$('.paper-container').has(currentSelection.focusNode).length //Out of bounds
			|| $('.cgen').has($(currentSelection.anchorNode)).length || $('.cgen').has($(currentSelection.focusNode)).length || currentSelection.anchorNode === currentSelection.focusNode && currentSelection.anchorOffset === currentSelection.focusOffset // Nothing selected
		) {
			$addAnnotationPopup.addClass('hidden');
			return;
		}

		/* Repositioning add annotation popup */
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

function loadDraftAnnotations() {
	var paperId = document.location.pathname.split('/papers/')[1].replace(/\/?$/, '/');
	if (localStorage.getItem(paperId + 'draftAnnotations')) {
		var draftAnnotations = JSON.parse(localStorage.getItem(paperId + 'draftAnnotations'));
		Object.keys(draftAnnotations).forEach(function(annotationKey) {
			loadDraftAnnotation(draftAnnotations[annotationKey]);
		});
	}
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
	});
}

function getElementByXpath(path) {
  return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function loadDraftAnnotation(annotation) {

	//Restoring selection
	var section = annotation.sectionId ? $('#' + annotation.sectionId)[0] : $('.paper-container')[0].childNodes[annotation.sectionIndex];
	var range = rangy.createRange();
	//range.selectCharacters(section, annotation.characterRanges[0].characterRange.start, annotation.characterRanges[0].characterRange.end);
	var startNode = getElementByXpath(annotation.startXPath);
	if (!startNode) return;
	range.setStart(startNode, Math.min(annotation.startOffset, startNode.length));
	var endNode = getElementByXpath(annotation.endXPath);
	if (!endNode) return;
	range.setEnd(endNode, Math.min(annotation.endOffset, endNode.length));
	var limitRange = rangy.createRange();
	limitRange.selectNode(range.endContainer);
	range = limitRange.intersection(range);
	/*characterOptions: {
      ignoreCharacters: '\u200B'
    }*/

	var $wrapper = $('<span></span>)');
	range.surroundContents($wrapper[0]);
	$wrapper[0].parentNode.normalize();
	var isNewWrapper = $wrapper[0].nextSibling && $wrapper[0].nextSibling.nodeType === 3 || $wrapper[0].previousSibling && $wrapper[0].previousSibling.nodeType === 3;
	if (!isNewWrapper) {
		var p = $wrapper.parent();
		$wrapper.contents().unwrap();
		$wrapper[0].normalize();
		$wrapper = p;
	}
	annotation.id = $wrapper[0].id;
	if (!$wrapper[0].id) {
		annotation.id = getUniqueInlineAnnotationId();
		$wrapper.attr('id', annotation.id);
	}
	$wrapper.addClass('inline-annotation');
	$wrapper.addClass($wrapper.attr('id'));
	var statement = ".inline-annotation." + $wrapper.attr('id');
	$.injectCSS({
		[statement]: {
			'background': reviewerColor
		}
	});

	var $popover = $wrapper.webuiPopover({
		placement: 'top',
		trigger: 'click',
		type: 'html',
		animation: 'pop',
		closeable: true,
		content: getInlineAnnotationEditor($wrapper.attr('id'), annotation.content),
		delay: { "show": 0, "hide": 300 }
	});

	if (!annotation.content) {
		setTimeout(function() {
			$popover.webuiPopover('show');
			$('textarea').focus();
		}, 1);
	}

	$popover.on("shown.webui.popover", function(e) {
		$('#' + $wrapper.attr('id') + '-editor button.remove-annotation').click(function() {
			$('#' + $wrapper.attr('id') + '-editor textarea').val(''); //Empty text on popup and close
			WebuiPopovers.hideAll();
		});
		$('#' + $wrapper.attr('id') + '-editor button.confirm-annotation').click(function() {
			WebuiPopovers.hideAll();
		});
	});

	$popover.on("hidden.webui.popover", function(e) {
		//Text is empty on popup close
		if (!$('#' + $wrapper.attr('id') + '-editor textarea').val().length) {
			var isNewWrapper = $wrapper[0].nextSibling && $wrapper[0].nextSibling.nodeType === 3 || $wrapper[0].previousSibling && $wrapper[0].previousSibling.nodeType === 3;
			if (isNewWrapper) {
				var p = $wrapper.parent();
				$wrapper.contents().unwrap();
				p[0].normalize();
				$wrapper.remove();
				$('#' + $wrapper.attr('id') + '-editor textarea').parent().remove();
			} else {
				$wrapper.webuiPopover('destroy');
				$wrapper.off('click');
				$wrapper.removeClass('inline-annotation');
			}
		}
		//Saving annotation locally
		annotation.content = $('#' + $wrapper.attr('id') + '-editor textarea').val();
		var paperId = document.location.pathname.split('/papers/')[1].replace(/\/?$/, '/'); //Add trailing slash
		if (!localStorage.getItem(paperId + 'draftAnnotations')) {
			localStorage.setItem(paperId + 'draftAnnotations', JSON.stringify({}));
		}
		var annotations = JSON.parse(localStorage.getItem(paperId + 'draftAnnotations'));
		annotations[annotation.id] = annotation;
		//Remove annotation if empty
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
		    window.scrollTo(0, scrollTarget - 50);
		});
		$('#annotationsTable>tbody').append(annRow);
	});
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
			$.notify({ 
				message: 'Review sent successfully.',
				icon: "fa fa-check"
			}, {
				type: 'success',
				delay: 3000,
				z_index: 1051,
				mouse_over: "pause"
			});
			localStorage.removeItem(paperId + 'draftAnnotations');
			$('#reviewAnnotationsModal').modal('hide');
			loadCurrentPaperContent();
		},
		error: function(result) {
			$('.send-review-btn').animateCss('shake');
			$.notify({
				message: result.responseText,
				icon: "fa fa-exclamation-triangle"
			}, {
				type: "danger",
				delay: 3000,
				z_index: 1051,
				mouse_over: "pause"
			});
		}
	});
}

function getUniqueInlineAnnotationId() {
	var max = 0;
	$('.inline-annotation').each(function() {
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

function loadAnnotations() {
	//Comments and reviews
	reviews = [];
	//Global variable
	annotationsById = {};
	console.log("Loading annotations.");
	$addedHeadTags.filter('script[type="application/ld+json"]').each(function() {
		var review = JSON.parse($(this).html());
		console.log($(this).html);
		reviews.push(review);
		review.forEach(function(annotation) {
			if (annotation.ref) {
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
	});
	Object.keys(annotationsById).forEach(function(id) {
		annotationsById[id].sort(function(a, b) {
			return b.text.length - a.text.length
		});
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
		//Inline annotations appear as highlighted text and popover (plus h1, h2, h3)
		if (inlineAnnotationElements.indexOf($('#'+id.replace('#', '')).prop('tagName').toLowerCase()) >= 0) {
			var $elem = $('#'+id.replace('#', ''));

			//TODO: Should be replaced with author(s) with formatted string
			var statement = ".inline-annotation." + id.replace('#', '');
			$.injectCSS({
				[statement]: {
					'background': rgbaColor
				}
			});
			$elem.addClass('inline-annotation');
			annotationsById[id].forEach(function(reviewer) {
				$elem.addClass(id.replace('#', ''));
			});
			if (annotationsById[id].length > 1) {
				gradients.forEach(function(gradient) {
					$.injectCSS({
						[statement]: {
							'background': gradient
						}
					});
				});
			}

			var $popover = $elem.webuiPopover({
				placement: 'top',
				trigger: 'click',
				type: 'html',
				animation: 'pop',
				closeable: true,
				content: getInlineAnnotationHtml(id, annotationsById[id]),
				delay: { "show": 0, "hide": 300 }
			});

			$elem.click(function(e) {
				// $popover.webuiPopover('show');
				e.stopPropagation();
			});

			$popover.on("shown.webui.popover", function(e) {
				carouselNormalization('#carousel-' + id.replace('#', '') + ' .item');
			});

			$('#carousel-' + id).carousel();
			//Block annotations appear on the side with a hover effect
		} else if (blockAnnotationElements.indexOf($(id).prop('tagName').toLowerCase()) >= 0) {
			var $anchor = $('<div class="comment-anchor cgen hidden-print"></div>');
			var $elem = $(id);

			var statement = ".comment-anchor." + id.replace('#', '');
			$.injectCSS({
				[statement]: {
					'background': rgbaColor
				}
			});
			$anchor.addClass(id.replace('#', ''));

			var inner = ['section', 'footer', 'header'].indexOf($(id).prop('tagName').toLowerCase()) < 0;
			if (inner) {
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

			/*$anchor.mouseenter(function() {
				$popover.webuiPopover('show');
			});*/

			$popover.on("shown.webui.popover", function(e) {
				carouselNormalization('#carousel-' + id.replace('#', '') + ' .item');
			});
			$('#carousel-' + id).carousel();
		}
	});
}

//Returns the content of a popup annotation
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
								<div class="comment-header" style="border-color:' + reviewerColors[annotations[index].author] + '"><a href="' + annotation.author + '">' + annotation.author + '</a><time datetime="' + annotation.date + '" >' + moment(annotation.date).fromNow() + '</time></div>\
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

//Causes all carousel slides to be the height of the tallest one
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

function hexToAlphaBlended(hex, bgHex, opacity) {
	var sourceRGB = hexToRgb(hex);
	var bgRGB = hexToRgb(bgHex);
	var targetR = ((1 - opacity) * bgRGB.r) + (1 * sourceRGB.r);
	var targetG = ((1 - opacity) * bgRGB.g) + (1 * sourceRGB.g);
	var targetB = ((1 - opacity) * bgRGB.b) + (1 * sourceRGB.b);
	return rgbToHex(targetR, targetG, targetB);
}

function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16)
	} : null;
}

function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}


function rgbToHex(r, g, b) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
