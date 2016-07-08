//JQuery animation of an element
$.fn.extend({
	animateCss: function(animationName) {
		var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
		$(this).addClass('animated ' + animationName).one(animationEnd, function() {
			$(this).removeClass('animated ' + animationName);
		});
		return $(this);
	},
	ignore: function(sel) {
		return this.clone().find(sel || ">*").remove().end();
	}
});

//Add authorization header before each request
$.ajaxSetup({
	beforeSend: function(xhr) {
		if (localStorage.accessToken) {
			xhr.setRequestHeader('Authorization', 'Bearer ' + localStorage.accessToken);
		}
	}
});

var distinctColors = ['#ff5972', '#a6637c', '#ff1a9f', '#ff99eb', '#c91aff', '#bb99ff', '#3419ff', '#1a62ff', '#1a94ff', '#1ac6ff', '#13babf', '#1affd5', '#1aff40', '#abf291', '#baff1a', '#ffe01a', '#ffdb99', '#ffaf1a', '#ff7d1a', '#ffaf99', '#ff1a1a'];
var reviewerColors = {};

//Verify if user agent has a valid token, if not show login form
window.onload = function() {
	if (localStorage.accessToken) {
		$.ajax({
			url: '/api/verify',
			type: 'POST',
			success: function(result) {
				sessionStorage.userID = result.id;
				userReady(result.fullname);
			},
			error: function(result) {
				$('#login-modal').modal('show');
			}
		});
	} else {
		$(window).load(function() {
			$('#login-modal').modal('show');
		});
	}
};

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


$(document).ready(function() {
	//moment.locale('it');
	$('#signupemail').keyup(function() {
		var username = $(this).val().split("@")[0];
		if (username.indexOf($('#signupusername').val()) >= 0 || $('#signupusername').val().indexOf(username) >= 0) {
			$('#signupusername').val(username);
		}
	});

	//Fixes affix width changing when on top
	$('[data-clampedwidth]').each(function() {
		var elem = $(this);
		var parentPanel = elem.data('clampedwidth');
		var resizeFn = function() {
			var sideBarNavWidth = $(parentPanel).width() - parseInt(elem.css('paddingLeft')) - parseInt(elem.css('paddingRight')) - parseInt(elem.css('marginLeft')) - parseInt(elem.css('marginRight')) - parseInt(elem.css('borderLeftWidth')) - parseInt(elem.css('borderRightWidth'));
			elem.css('width', sideBarNavWidth);
		};

		resizeFn();
		$(window).resize(resizeFn);
	});

	responsiveFooter();
	$(window).resize(responsiveFooter);

	$(".scrollToTop").click(function() {
		$("html, body").animate({ scrollTop: 0 }, 200);
		return false;
	});

	$("#signUpModal").on("hidden.bs.modal", function(e) {
		$("#signUpForm")[0].reset();
	});
});


//When the user agent's url changes load the new paper
window.onstatechange = function(event) {
	loadCurrentPaperContent();
};

// Stop the animation if the user scrolls. Defaults on .stop() should be fine
var $viewport = $('html, body');
$viewport.bind("scroll mousedown DOMMouseScroll mousewheel keyup", function(e) {
	if (e.which > 0 || e.type === "mousedown" || e.type === "mousewheel") {
		// This identifies the scroll as a user action, stops the animation, then unbinds the event straight after (optional)
		$viewport.stop().unbind('scroll mousedown DOMMouseScroll mousewheel keyup');
	}
});

var $addedHeadTags; //Contains head tags belonging to a single paper, to be removed when a paper view is replaced
var reviews; //Contains RASH review
//Loads the content of the current paper in the appropriate div
function loadCurrentPaperContent() {

	if (document.location.pathname === "/") {
		$addedHeadTags && $addedHeadTags.remove();
		$('.paper-container').empty();
	}

	if (document.location.pathname.startsWith("/papers/")) {
		/*TODO: do we need this part?*/
		if (sessionStorage.papers) {
			var parsed = JSON.parse(sessionStorage.papers);
			//var papers = parsed.submitted.concat(parsed.reviewable);
			var papers = [];
			for (var category in parsed.articles) {
				if (parsed.articles.hasOwnProperty(category)) {
					papers = papers.concat(parsed.articles[category]);
				}
			}

			var paper = papers.find(function(paper) {
				//Remove pound part
				if (document.location.pathname.replace(/\/$/, "").endsWith(paper.url)) {
					return paper;
				}
			});
		}

		$('title').remove();

		$.ajax({
			url: '/api' + document.location.pathname,
			method: 'GET',
			success: function(result) {
				$('#placeholder').remove();
				var xmlParsed = $.parseXML(result);
				var $xml = $(xmlParsed);
				//Head
				$addedHeadTags && $addedHeadTags.remove();
				$addedHeadTags = $xml.find('meta, link, title, script[type="application/ld+json"]').not('link[rel="stylesheet"]');
				$('head').append($addedHeadTags);
				//Body
				var $body = $xml.find('body');
				$('.paper-container').empty().append($body.children());
				rasherize(); //Add extra paper elements
				//Scroll Spy sections
				$('.sections-sidebar>ul').empty();
				var $root = $('html, body');
				$('.sections-sidebar>ul').append($('<li class="active"><a href="#top">' + $("head title").html().split(" -- ")[0] + '</a></li>'));
				$('.paper-container>section[id]').each(function(index) {
					var $link = $('<a href="#' + $(this).attr('id') + '">' + $(this).find('h1').eq(0).text() + '</a>');
					$('.sections-sidebar>ul').append($('<li></li>').append($link));
					if ($('section[id]', $(this)).size()) {
						var $sub = $('<ul class="nav"></ul>');
						$('section[id]', $(this)).each(function(index) {
							var $sublink = $('<li><a href="#' + $(this).attr('id') + '">' + $(this).find('h2').eq(0).text() + '</a></li>');
							if ($sublink.text()) {
								$sub.append($sublink);
							}
						});
						$('.sections-sidebar>ul>li:last-child').append($sub);
					}
				});
				$('.sections-sidebar>ul a').each(function(index) {
					$(this).on('click', function(event) {
						var href = $(this).attr('href');
						event.preventDefault();
						$root.animate({
							scrollTop: $(href).offset().top
						}, 400, function() {
							history.pushState({}, '', href);
						});
						return false;
					});
				});
				var scrollTarget = window.location.hash && $(window.location.hash).offset() ? $(window.location.hash).offset().top : $('#top').offset().top;
				if (scrollTarget !== $(window).scrollTop()) {
					$root.animate({
						scrollTop: scrollTarget
					}, 400);
				}
				$('[data-spy="scroll"]').each(function() {
					var $spy = $(this).scrollspy('refresh');
				});
				//END: Scroll Spy Sections

				//Comments and reviews
				reviews = [];
				var annotationsById = {};
				$addedHeadTags.filter('script[type="application/ld+json"]').each(function() {
					var review = JSON.parse($(this).html());
					reviews.push(review);
					review.forEach(function(annotation) {
						if (annotation.ref) {
							if (annotationsById[annotation.ref]) {
								annotationsById[annotation.ref].push(annotation);
							} else {
								annotationsById[annotation.ref] = [annotation];
							}
							if (!reviewerColors[annotation.author]) {
								var colorIndex = Math.floor(Math.random() * distinctColors.length);
								reviewerColors[annotation.author] = distinctColors[colorIndex];
								distinctColors.splice(colorIndex, 1);
							}
						}
					});
				});
				Object.keys(annotationsById).forEach(function(id) {
					//Highlight color default to first reviewer's color
					var rgbColor = reviewerColors[annotationsById[id][0].author];
					var rgbaColor = hexToRgbA(rgbColor, 0.5);
					//Inline annotations appear as highlighted text and popover (plus h1, h2, h3)
					if (['span', 'em', 'code', 'a', 'time', 'cite', 'h1', 'h2', 'h3'].indexOf($(id).prop('tagName').toLowerCase()) >= 0) {
						var $elem = $(id);

						$elem.css({
							'border-radius': '0.3em',
							'background-color': rgbaColor
						});

						var $popover = $elem.popover({
							placement: 'top',
							trigger: 'hover',
							html: true,
							container: $elem,
							content: getInlineAnnotationHtml(id, annotationsById[id]),
							delay: { "show": 0, "hide": 300 }
						});

						$popover.on("shown.bs.popover", function(e) {
							carouselNormalization('#carousel-' + id.replace('#', '') + ' .item');
						});

						/*$popover.on("show.bs.popover", function(e) {
							$('.popover').popover('hide');
						});*/
						$('#carousel-' + id).carousel();
						//Block annotations appear on the side with a hover effect
					} else if (['p', 'div', 'section', 'figure'].indexOf($(id).prop('tagName').toLowerCase()) >= 0) {
						var $anchor = $('<div class="comment-anchor hidden-print"></div>');
						var $elem = $(id);
						$anchor.css({
							'background-color': rgbColor,
							'height': $elem.height()
						});
						//$elem.children().wrapAll($wrapper);
						$elem.prepend($anchor);

						var $popover = $anchor.popover({
							placement: 'bottom',
							trigger: 'manual',
							html: true,
							container: $anchor,
							content: getInlineAnnotationHtml(id, annotationsById[id]),
							delay: { "show": 0, "hide": 300 }
						});

						$anchor.mouseenter(function() {
							$popover.popover('show');
							console.log('enter' + this);
						});
						$elem.mouseleave(function(){
							console.log('left'  + this);
							$popover.popover('hide');
						});

						$popover.on("shown.bs.popover", function(e) {
							carouselNormalization('#carousel-' + id.replace('#', '') + ' .item');
						});
						/*$popover.on("show.bs.popover", function(e) {
							$('.popover').popover('hide');
						});*/
						$('#carousel-' + id).carousel();
					}
				});
			},
			error: function(result) {
				if (result.responseJSON && result.responseJSON.error.name === "TokenExpiredError") {
					$('#login-modal').modal('show');
				}
				$.notify({
					message: result.responseJSON ? 'Error: ' + result.responseJSON.message + '-' + result.responseJSON.error.message : 'Error: ' + result.responseText
				}, {
					type: 'danger',
					delay: 2000
				});
			}
		});
	}
}

function getInlineAnnotationHtml(id, annotations) {
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

//Causes all carousel slides to be the height of the tallest one
function carouselNormalization(selector) {
	var items = $(selector), //grab all slides
		heights = [], //create empty array to store height values
		tallest; //create variable to make note of the tallest slide

	if (items.length) {
		function normalizeHeights() {
			items.each(function() { //add heights to array
				heights.push($(this).height());
			});
			tallest = Math.max.apply(null, heights); //cache largest value
			items.each(function() {
				$(this).css('min-height', tallest + 'px');
			});
		};
		normalizeHeights();

		$(window).on('resize orientationchange', function() {
			tallest = 0, heights.length = 0; //reset vars
			items.each(function() {
				$(this).css('min-height', '0'); //reset min-height
			});
			normalizeHeights(); //run it again 
		});
	}
}

function getConferences() {
	$.ajax({
		url: "/api/events",
		method: "GET",
		success: function(res) {
			var conferencesUl = $("#conferenceSelector .dropdown-menu");

			for (var i = 0; i < res.length; i++) {
				var $li = $('<li><a>' + res[i].conference + '</a></li>');
				$('a', $li).data('acronym', res[i].acronym);
				$('a', $li).on("click", function() {
					var a = $(this);
					$("#conferenceSelector .btn:first-child *:first-child").text($(this).text());
					$("#conferenceSelector .btn:first-child *:first-child").val($(this).text());
					$.ajax({
						url: encodeURI("/api/events/" + a.data('acronym') + "/papers"),
						method: "GET",
						success: function(result) {
							$("#sidebar-wrapper .profile-panel .userRole").text("Role: " + result.userRole);
							sessionStorage.userRole = result.userRole;

							console.log("AJAX request for conference " + a.data('acronym'));

							fetchAndBuildSidebarMenu(result, true, function() {
								loadCurrentPaperContent();
							});
						},
						error: function(err) {
							console.log(err);
						}
					});
				});
				conferencesUl.append($li);
			}
		},
		error: function(err) {
			console.log(err);
		}
	});
}

function getUserPapers() {
	$.ajax({
		url: "/api/papers/user",
		method: "GET",
		success: function(res) {
			fetchAndBuildSidebarMenu(res, false, function() {
				loadCurrentPaperContent();
			});
		},
		error: function(err) {
			console.log("Unable to get user papers");
			console.log(err);
		}
	});
}

// Helper functions to keep code clean
String.prototype.camelCaseToString = function() {
	var splitted = this.replace(/([A-Z]([a-z]+))/g, ' $1').trim();
	return splitted.charAt(0).toUpperCase() + splitted.slice(1);
}

function applyStatusLabel(paper, loadingConf) {
	var statusLabel = "";

	if (paper.hasOwnProperty("status") && !loadingConf) {
		statusLabel = ' <span class="label label-primary">' + paper.conference + '</span> <span class="label $labelClass">$labelText</span>';

		if (paper.status === "accepted") statusLabel = statusLabel.replace("$labelClass", "label-success");
		else statusLabel = statusLabel.replace("$labelClass", "label-warning");

		statusLabel = statusLabel.replace("$labelText", paper.status.camelCaseToString());
	}

	if (loadingConf) {
		if (paper.authors.indexOf(sessionStorage.userID) !== -1) statusLabel += ' <span class="fa fa-user"></span>';
		if (sessionStorage.userRole !== "Chair") {
			if (paper.reviewers.indexOf(sessionStorage.userID) !== -1) {
				if (paper.reviewedBy.indexOf(sessionStorage.userID) !== -1) statusLabel += ' <span class="fa fa-certificate"></span>';
				else statusLabel += ' <span class="fa fa-exclamation-circle"></span>';
			}
		} else {
			if (paper.reviewers.length === paper.reviewedBy.length) statusLabel += ' <span class="fa fa-certificate"></span>';
			else statusLabel += ' <span class="fa fa-exclamation-circle"></span>';
		}
		if (paper.status === "accepted") statusLabel += ' <span class="fa fa-check"></span>';
	}

	return statusLabel;
}

function fetchAndBuildSidebarMenu(result, loadingConf, callback) {
	sessionStorage.papers = JSON.stringify(result); // NON rimuovere altrimenti gli articoli non vengono caricati
	var parentObj = "";

	if (loadingConf) {
		parentObj = "#conferenceSidebar";
		$(parentObj).empty();
		$(parentObj).append($('<li class="sidebar-brand">Conference Papers</li>'));
	} else {
		parentObj = "#sidebar";
		$(parentObj + ", #conferenceSidebar").empty();
	}

	for (var type in result) {
		if (result.hasOwnProperty(type) && Array.isArray(result[type])) {
			if (!loadingConf) {
				var liCat = $('<li class="sidebar-brand ' + type + '">' + type.split("_").join(" ") + '</li>');
				$(parentObj).append(liCat);
			}

			result[type].forEach(function(paper) {
				var urlComplete = "/papers/" + paper.url;
				var liHtml = '<li><a href="' + urlComplete + '">' + paper.title.split(" -- ")[0] + '$label</a></li>\n';
				liHtml = liHtml.replace("$label", applyStatusLabel(paper, loadingConf));

				var li = $(liHtml);
				if (loadingConf) li.insertAfter($(parentObj + ' .sidebar-brand'));
				else li.insertAfter($(parentObj + ' .sidebar-brand.' + type));

				li.on('click', function() {
					redirectToPaper(urlComplete, paper);
					return false;
				});
			});
		}
	}
	if (loadingConf) $("#conferenceSidebar").css("border-bottom", "1px solid #E5E5E5");

	if (callback) callback();
}

function userReady(fullname) {
	$('.profile-panel').removeClass('hidden').animateCss('bounceIn');
	$('.profile-panel>h4').text(fullname);
	getConferences();
	getUserPapers();
}

//TODO: Move to a different file
var responsiveFooter = function() {
	if ($(window).width() < 768) {
		$(".footer").css("padding-bottom", "20px");
		$(".footer p").removeClass("pull-left");
		$(".footer a").removeClass("pull-right");
		$(".footer .container").addClass("text-center");
	} else {
		$(".footer").css("padding-bottom", "0px");
		$(".footer p").addClass("pull-left");
		$(".footer a").addClass("pull-right");
		$(".footer .container").removeClass("text-center");
	}
};

function logIn() {
	var data = {};
	$('#login input[name]').each(function(index) {
		data[$(this).attr('name')] = $(this).val();
	});
	$.ajax({
		url: '/api/authentication/signin',
		method: 'POST',
		data: data,
		success: function(result) {
			localStorage.accessToken = result.accessToken;
			$('#login-modal').modal('hide');
			$.notify({ //http://bootstrap-notify.remabledesigns.com/
				message: 'Welcome ' + result.id,
				icon: "fa fa-check"
			}, {
				type: 'success',
				delay: 3000,
				mouse_over: "pause"
			});
			sessionStorage.userID = result.id;
			userReady(result.fullname);
		},
		error: function(result) {
			$('#loginbutton').animateCss('shake').prev('.help-inline').animateCss('bounceIn').text(JSON.parse(result.responseText).message);
			$('#submitButtonLogin').animateCss('shake');
			$.notify({
				message: JSON.parse(result.responseText).message,
				icon: "fa fa-exclamation-triangle"
			}, {
				type: "danger",
				delay: 3000,
				mouse_over: "pause"
			});
			$("#emailFieldLogin").val("");
			$("#passFieldLogin").val("");
		}
	});
}

function signUp() {
	var data = {};
	$('#signup input[name], #signUpForm select[name]').each(function(index) {
		data[$(this).attr('name')] = $(this).val();
	});
	$.ajax({
		url: '/api/authentication/signup',
		method: 'POST',
		data: data,
		success: function(result) {
			$('.nav-tabs a[href="#login"]').tab('show');
			$('.nav-tabs a[href="#signup"]').addClass('hidden');
			$('#signUpForm .modal-body').prepend($('<div class="alert alert-warning" role="alert">We sent an email to ' + data.email + '. Check it to validate your account.</div>'));
			$("#signUpModal").modal("hide");
			$.notify({ //http://bootstrap-notify.remabledesigns.com/
				message: 'We sent an email to ' + data.email + '. Read it and follow the instructions to validate your account',
				icon: "fa fa-envelope"
			}, {
				type: 'warning',
				mouse_over: 'pause',
				delay: 5000
			});
		}, // TODO: Error graphic management to be tested
		error: function(result) {
			$('#submitButtonSignUp').animateCss('shake').prev('.help-inline').animateCss('bounceIn').text(JSON.parse(result.responseText).message);
		}
	});
}

function logOut() {
	localStorage.accessToken = null;
	window.location.replace("/");
	return false;
}

function redirectToPaper(url, paper) {
	History.pushState(paper, paper.title, url);
}
