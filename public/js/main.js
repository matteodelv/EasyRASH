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
		$('#login-modal').modal('show');
	}
	$(document).keyup(function(e) {
		if (e.keyCode == 27) { // escape key maps to keycode `27`
			WebuiPopovers.hideAll();
		}
	});
};

$(document).ready(function() {
	//moment.locale('it');
	$('[data-toggle="tooltip"]').tooltip(); 
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

	// Chiamata aggiunta solo per testare il pannello di amministrazione delle conferenze; da togliere in deploy
<<<<<<< HEAD
	//showConferenceAdminPanel({ title: "Conference Title", acronym: "CA16" });
=======
	//showConferenceAdminPanel({ acronym: "CA161234" });
>>>>>>> c58023d528e829a2f03fb4fe4822d3c4d3782e15
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

	WebuiPopovers.hideAll();

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
				try {
					var xmlParsed = $.parseXML(result);
				} catch (err) {
					$.notify({
						message: 'Error while parsing XML.'
					}, {
						type: 'danger',
						delay: 2000
					});
					return;
				}
				$('#placeholder').remove();
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
						//remove topnav distance
						$root.animate({
							scrollTop: $(href).offset().top - 50
						}, 400, function() {
							history.pushState({}, '', href);
						});
						return false;
					});
				});
				var scrollTarget = window.location.hash && $(window.location.hash).offset() ? $(window.location.hash).offset().top : $('#top').offset().top;
				if (scrollTarget !== $(window).scrollTop()) {
					$root.animate({
						scrollTop: scrollTarget - 50
					}, 400);
				}
				$('[data-spy="scroll"]').each(function() {
					var $spy = $(this).scrollspy('refresh');
				});
				//END: Scroll Spy Sections
				loadAnnotations();
				loadDraftAnnotations();
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

function getConferences() {
	$.ajax({
		url: "/api/events",
		method: "GET",
		success: function(res) {
			var conferencesUl = $("#conferenceSelector .dropdown-menu");
			conferencesUl.empty(); 		// To avoid duplicate entries

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
			var $divider = $("<li class='divider'></li>");
			conferencesUl.append($divider);
			var $newConfButton = $('<li><a>New Conference...</a></li>');
			$('a', $newConfButton).on("click", function() {
				$('#newConfModal').modal('show');
			});
			conferencesUl.append($newConfButton);
		},
		error: function(err) {
			console.log(err);		// TODO: Manage error situation
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
		$(parentObj).append($('<li class="sidebar-brand hidden">Conference Papers</li>'));
		$('.conferences-panel .panel-body').removeClass('hidden');
		$('.conferences-panel .panel-heading .btn').css('border-radius', '4px 4px 0px 0px');
	} else {
		parentObj = "#sidebar";
		$(parentObj + ", #conferenceSidebar").empty();
	}

	console.log(result);

	for (var type in result) {
		console.log('Insiede for loop');
		console.log('Type = ' + type);
		if (result.hasOwnProperty(type) && Array.isArray(result[type])) {
			if (!loadingConf) {
				var liCat = $('<li class="sidebar-brand ' + type + '">' + type.split("_").join(" ") + '</li>');
				$(parentObj).append(liCat);
			}

			if (result[type].length > 0) {
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
			else {
				var li = $('<li>No Submitted Papers Yet</li>');
				if (loadingConf) li.insertAfter($(parentObj + ' .sidebar-brand'));
			}
		}
	}

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

function createNewConference() {
	var data = {};
	$('#newConfForm input[name]').each(function(index) {
		data[$(this).attr('name')] = $(this).val();
	});

	$.ajax({
		url: '/api/events/create',
		method: 'POST',
		data: data,
		success: function(result) {
			$('#newConfForm .modal-body .alert').empty();
			$('#newConfForm .modal-body').prepend($('<div class="alert alert-success fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + result.message + '</div>'));
			
			getConferences();

			window.setTimeout(function() {
				$('#newConfModal').modal('hide');
			}, 1500);

			// TODO: Remove "your paper will apper here" and show conference admin panel
			showConferenceAdminPanel(data.acronym);
		},
		error: function(error) {
			$('#newConfForm .modal-body .alert').empty();
			$('#newConfForm .modal-body').prepend($('<div class="alert alert-danger fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + JSON.parse(error.responseText).message + '</div>'));

			window.setTimeout(function() {
				$("#newConfForm .alert").fadeTo(500, 0).slideUp(500, function() {
					$(this).remove(); 
				});
			}, 2000);
		}
	});
}

var $pageContentWrapper;

function showConferenceAdminPanel(acronym) {
	// window.setTimeout(function() {
	 	//$('#page-content-wrapper #top').show();
	//}, 10000);
	
	$.ajax({
		method: 'GET',
		url: encodeURI('/api/events/' + acronym),
		success: function(res) {
			$pageContentWrapper = $('#page-content-wrapper #top').html();
			
			$("#page-content-wrapper #top").fadeTo(500, 0).slideUp(500, function() {
				$(this).remove();
				buildConfAdminPanel(res.conference);
			});
		},
		error: function(err) {
			$.notify({
				message: JSON.parse(result.responseText).message,
				icon: "fa fa-exclamation-triangle"
			}, {
				type: "danger",
				delay: 3000,
				mouse_over: "pause"
			});
		}
	});
}

function buildConfAdminPanel(confData) {
	var panel = $('<div id="conf-admin-panel"><div class="row"><div class="panel-content col-md-8 col-md-offset-2"></div></div></div>');
	$('#page-content-wrapper').append(panel);

	var headTitle = $('<h4>Chair Admin Panel - </h4>').append(confData.conference);
	var headText = $('<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam feugiat turpis vel leo aliquam, id ultrices ligula sodales. Nam venenatis bibendum ipsum nec aliquam. Praesent ut rutrum lorem. Nulla nec odio dolor. Aenean varius magna ut pretium ornare. Phasellus sit amet gravida lacus. Curabitur lacinia lorem vestibulum velit lacinia venenatis. In finibus erat vitae dui tincidunt, sed vulputate justo commodo. Aliquam gravida vestibulum orci, volutpat maximus justo semper eget. Fusce a purus felis.</p>');

	var ids = ["confTitle", "confAcronym", "confCochairs", "confReviewers"];
	var texts = ["Title:", "Acronym:", "Co-Chairs:", "Reviewers:", "Update Conference", "Close Admin Panel"];
	var types = ["text", "text", "email", "email"];
	var names = ["title", "acronym", "cochairs", "reviewers"];

	var form = $('<form class="form-horizontal"></form>');

	var ccSelect = $('<select></select>');
	ccSelect.addClass('form-control');
	ccSelect.attr('multiple', 'multiple');
	
	var defOption = $('<option value="notset">Choose...</option>');
	$(ccSelect).append(defOption);

	var rSelect = ccSelect.clone();

	$.ajax({
		url: "/api/users/list",
		method: "GET",
		success: function(res) {
			res.forEach(user => {
				var option = $('<option></option>');
				option.attr('value', user.id);
				if (confData.chairs.indexOf(user.id) > -1) option.attr('selected', 'selected');
				$(option).append(user.family_name + ' ' + user.given_name + ' &lt;' + user.email + '&gt;');
				$(ccSelect).append(option);
				option = option.clone();
				option.removeAttr('selected');
				if (confData.pc_members.indexOf(user.id) > -1) option.attr('selected', 'selected'); // PERCHE' su chrome non funziona?
				$(rSelect).append(option);
			});
		},
		error: function(err) {
			$(form).prepend('<div class="alert alert-warning fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + JSON.parse(err.responseText).message + ' Try again later...</div>');

			window.setTimeout(function() {
				$("#conf-admin-panel .alert").fadeTo(500, 0).slideUp(500, function() {
					$(this).remove(); 
				});
			}, 2000);
		}
	});

	for (var $i = 0; $i < 4; $i++) {
		var formGroup = $('<div class="form-group"></div>');
		$(formGroup).empty();

		var label = $('<label class="control-label col-sm-3"></label>');
		$(label).attr('for', ids[$i]);
		$(label).text(texts[$i]);
		$(formGroup).append(label);

		var div = $('<div class="col-sm-7"></div>');
		$(formGroup).append(div);

		if ($i < 2) {
			var input = $('<input class="form-control">');
			$(input).attr('type', types[$i]);
			$(input).attr('id', ids[$i]);
			$(input).attr('value', $i == 0 ? confData.conference : confData.acronym);
			$(input).attr('name', names[$i]);

			$(div).append(input);
		}
		else {
			if ($i == 2) {
				ccSelect.attr('id', ids[$i]);
				ccSelect.attr('name', names[$i]);
				$(div).append(ccSelect);
			}
			else {
				rSelect.attr('id', ids[$i]);
				rSelect.attr('name', names[$i]);
				$(div).append(rSelect);
			}
		}

		$(form).append(formGroup);
	}

	var formGroup = $('<div class="form-group"></div>');
	var group = $('<div class="col-sm-offset-3 col-sm-7"></div>');
	$(formGroup).append(group);
	$(form).append(formGroup);
	
	for (var $i = 4; $i < 6; $i++) {
		var button = $('<button type="submit"></button>');
		$(button).empty();

		$(button).append(texts[$i]);
		$(button).addClass($i == 4 ? 'btn btn-primary' : 'btn btn-default');
		if ($i == 5) $(button).addClass('pull-right');

		$(group).append(button);
	}

	$('#conf-admin-panel .panel-content').append(headTitle).append(headText).append(form);

	$('#conf-admin-panel .btn-primary').on('click', function(e) {
		e.preventDefault();
		console.log('Update Conference button pressed');

		var data = {		// confData.acronym serve ancora?
			oldAcronym: confData.acronym
		};
		$('#conf-admin-panel input[name], #conf-admin-panel select[name]').each(function(index) {
			data[$(this).attr('name')] = $(this).val();

			var curName = $(this).attr('name');
			if (curName === 'cochairs' || curName === 'reviewers') {
				if (data[curName] && data[curName][0] === 'notset') data[curName] = data[curName].slice(1, data[curName].length);
			}
		});
		if (!data['cochairs']) delete data['cochairs'];
		if (!data['reviewers']) delete data['reviewers'];

		$.ajax({
			method:'PUT',
			data: data,
			url: encodeURI('/api/events/update/' + confData.acronym),
			success: function(res) {
				console.log('Success received!');
				$(form).prepend('<div class="alert alert-success fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + res.message + '</div>');

				getConferences();

				window.setTimeout(function() {
					$("#conf-admin-panel .alert").fadeTo(500, 0).slideUp(500, function() {
						$(this).remove(); 
					});
				}, 2000);
			},
			error: function(err) {
				$(form).prepend('<div class="alert alert-warning fade in" role="alert"><a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' + JSON.parse(err.responseText).message + '</div>');

				window.setTimeout(function() {
					$("#conf-admin-panel .alert").fadeTo(500, 0).slideUp(500, function() {
						$(this).remove(); 
					});
				}, 2000);
			}
		});
	});

	$('#conf-admin-panel .btn-default').on('click', function(e) {
		e.preventDefault();
		console.log('Close Conference Admin Panel button pressed');

		// Remove admin panel and restore "your paper will appear here"
		$("#conf-admin-panel").fadeTo(500, 0).slideUp(500, function() {
			$(this).remove();
			$('#page-content-wrapper').html($pageContentWrapper);
		});
	});
}

function redirectToPaper(url, paper) {
	History.pushState(paper, paper.title, url);
}
