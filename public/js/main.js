//JQuery animation of an element
$.fn.extend({
	animateCss: function(animationName) {
		var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
		$(this).addClass('animated ' + animationName).one(animationEnd, function() {
			$(this).removeClass('animated ' + animationName);
		});
		return $(this);
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

//Verify if user agent has a valid token, if not show login form
window.onload = function() {
	if (localStorage.accessToken) {
		$.ajax({
			url: '/api/verify',
			type: 'POST',
			success: function(result) {
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
var annotations; //Contains RASH annotations
//Loads the content of the current paper in the appropriate div
function loadCurrentPaperContent() {

	if (document.location.pathname === "/") {
		$addedHeadTags && $addedHeadTags.remove();
		$('.paper-container').empty();
	}

	if (document.location.pathname.startsWith("/papers/")) {
		var parsed = JSON.parse(sessionStorage.papers);
		//var papers = parsed.submitted.concat(parsed.reviewable);
		var papers = [];
		for (var category in parsed.articles) {
			if (parsed.articles.hasOwnProperty(category)) {
				papers = papers.concat(parsed.articles[category]);
			}
		}
		
		var paper = papers.find(function(paper) {
			if (document.location.pathname.replace(/\/$/, "").endsWith(paper.url)) {
				return paper;
			}
		})
		paper && $('title').remove();

		$.ajax({
			url: '/api' + document.location.pathname,
			method: 'GET',
			success: function(result) {
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
				annotations = [];
				$addedHeadTags.filter('script[type="application/ld+json"]').each(function() {
					annotations.push(JSON.parse($(this).html()));
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

function getConferences() {
	$.ajax({
		url: "/api/events",
		method: "GET",
		success: function(res) {
			var conferencesUl = $("#conferenceSelector .dropdown-menu");
			//console.log(conferencesUl);
			
			for (var i = 0; i < res.length; i++) {
				//var li = document.createElement("li");
				//var a = document.createElement("a");
				var $li = $('<li><a>'+res[i].conference+'</a></li>');
				//a.href = encodeURI("/api/events/" + res[i].acronym + "/papers");
				//a.text = res[i].conference;
				//var acronym = res[i].acronym;
				//$(a).data('acronym', res[i].acronym);
				$('a', $li).data('acronym', res[i].acronym);
				$('a', $li).on("click", function() {
					var a = $(this);
					$.ajax({
						url: encodeURI("/api/events/" + a.data('acronym') + "/papers"),
						method: "GET",
						success: function(result) {
							$("#sidebar-wrapper .profile-panel .userRole").text("Role: " + result.userRole);
							$("#conferenceSelector button").html(result.selectedConf + "<span class='caret'></span>");
							
							console.log("AJAX request for conference " + a.data('acronym'));
							//console.log(result);
							fetchAndBuildSidebarMenu(result, function() {
								loadCurrentPaperContent();
							});
						},
						error: function(err) {
							console.log(err);
						}
					});
				});
				//li.appendChild(a);
				conferencesUl.append($li);
			}
		},
		error: function(err) {
			console.log(err);
		}
	});
}

function fetchAndBuildSidebarMenu(result, callback) {
	sessionStorage.papers = JSON.stringify(result); // NON rimuovere altrimenti gli articoli non vengono caricati
	//var liCat = $('<li class="sidebar-brand submitted"><a href="#">Submitted</a></li><li class="sidebar-brand reviewable"><a href="#">Reviewable</a></li>');
	$("#sidebar").empty();//.append(liCat);
	var articles = result.articles;
	if (articles) {
		for (var type in articles) {
			if (articles.hasOwnProperty(type)) {
				// Il nome delle categorie di articoli è gestito dal server in base al ruolo dell'utente loggato
				var liCat = $('<li class="sidebar-brand ' + type + '">' + type.replace("_", " ") + '</li>');
				$("#sidebar").append(liCat);
				
				articles[type].forEach(function(paper) {
					var urlComplete = '/papers/' + paper.url;
					var li = $('<li><a href="' + urlComplete + '">' + paper.title.split(" -- ")[0] + '</a></li>\n').insertAfter($('#sidebar-wrapper .sidebar-brand.' + type));
					li.on('click', function() {
						redirectToPaper(urlComplete, paper);
						return false;
					});
				});
			}
		}
	}
	
	if (callback) callback();
}

function userReady(fullname) {
	$('.profile-panel').removeClass('hidden').animateCss('bounceIn');
	$('.profile-panel>h4').text(fullname);
	//getPapers();
	getConferences();
}

$(document).ready(function() {
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
}

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

//Gets the papers of the logged in user
function getPapers() {
	$.ajax({
		url: '/api/papers/',
		method: 'GET',
		success: function(result) {
			sessionStorage.papers = JSON.stringify(result);
			//Populating sidebar
			for (var key in result) {
				if (result.hasOwnProperty(key)) {
					result[key].forEach(function(paper) {
						var urlComplete = '/papers/' + paper.url;
						var li = $('<li><a href="' + urlComplete + '">' + paper.title.split(" -- ")[0] + '</a></li>\n').insertAfter($('#sidebar-wrapper .sidebar-brand.' + key));
						li.on('click', function() {
							redirectToPaper(urlComplete, paper);
							return false;
						});
					})
				}
			}

			loadCurrentPaperContent();
		},
		error: function(result) {
			$.notify({
				message: result.responseJSON ? 'Error: ' + result.responseJSON.message + '-' + result.responseJSON.error.message : 'Error: ' + result.responseText
			}, {
				type: 'danger',
				delay: 2000
			});
		}
	});
}

function redirectToPaper(url, paper) {
	History.pushState(paper, paper.title, url);
}
