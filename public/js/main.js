$.fn.extend({
   animateCss: function(animationName) {
      var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
      $(this).addClass('animated ' + animationName).one(animationEnd, function() {
         $(this).removeClass('animated ' + animationName);
      });
      return $(this);
   }
});

$.ajaxSetup({
   beforeSend: function(xhr) {
      if (localStorage.accessToken) {
         xhr.setRequestHeader('Authorization', 'Bearer ' + localStorage.accessToken);
      }
   }
});

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

function loadCurrentPaperContent() {

   if (document.location.pathname === "/") {
      $addedHeadTags && $addedHeadTags.remove();
      $('.paper-container').empty();
   }

   if (document.location.pathname.startsWith("/papers/")) {
      var parsed = JSON.parse(sessionStorage.papers);
      var papers = parsed.submitted.concat(parsed.reviewable);
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
            $addedHeadTags = $xml.find('meta, link, title').not('[rel="stylesheet"]');
            $('head').append($addedHeadTags);
            //Body
            var $body = $xml.find('body');
            $('.paper-container').empty().append($body.children());
            rasherize();
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

function userReady(fullname) {
   $('.profile-panel').removeClass('hidden').animateCss('bounceIn');
   $('.profile-panel>h4').text(fullname);
   getPapers();
}

$(document).ready(function() {
	responsiveFooter();
	$(window).resize(responsiveFooter);
	
	$(".scrollToTop").click(function() {
		$("html, body").animate({scrollTop: 0}, 200);
		return false;
	});
	
	$("#signUpModal").on("hidden.bs.modal", function(e) {
		console.log("on hidden.bs.modal");
		$("#signUpForm")[0].reset();
	});
});

var responsiveFooter = function() {
	if ($(window).width() < 768) {
		$(".footer").css("padding-bottom", "20px");
		$(".footer p").removeClass("pull-left");
		$(".footer a").removeClass("pull-right");
		$(".footer .container").addClass("text-center");
	}
	else {
		$(".footer").css("padding-bottom", "0px");
		$(".footer p").addClass("pull-left");
		$(".footer a").addClass("pull-right");
		$(".footer .container").removeClass("text-center");
	}
}

function logIn() {
	var data = {};
	$('#loginForm input[name]').each(function(index){
		data[$(this).attr('name')] = $(this).val();
	});
	$.ajax({
		url: '/api/authentication/signin',
		method: 'POST',
		data: data,
		success: function(result) {
			localStorage.accessToken = result.accessToken;
			// $('#login-modal').modal('hide');
			$.notify({ //http://bootstrap-notify.remabledesigns.com/
				message: 'Welcome ' + result.id + ". Redirecting to User Panel...",
				icon: "fa fa-check"
			}, {
				type: 'success',
				delay: 3000,
				mouse_over: "pause"
			});
			userReady(result.fullname);
		},
		error: function(result) {
			//$('#loginbutton').animateCss('shake').prev('.help-inline').animateCss('bounceIn').text(JSON.parse(result.responseText).message);
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

function signUp(){
   var data = {};
   $('#signUpForm input[name], #signUpForm select[name]').each(function(index){
      data[$(this).attr('name')] = $(this).val();
   });
   $.ajax({
      url: '/api/authentication/signup',
      method: 'POST',
      data: data,
      success: function(result) {
         //$('.nav-tabs a[href="#login"]').tab('show');
         //$('.nav-tabs a[href="#signup"]').addClass('hidden');
         //$('#signUpForm .modal-body').prepend($('<div class="alert alert-warning" role="alert">We sent an email to '+data.email+'. Check it to validate your account.</div>'));
         $("#signUpModal").modal("hide");
		 $.notify({ //http://bootstrap-notify.remabledesigns.com/
            message: 'We sent an email to '+data.email+'. Read it and follow the instructions to validate your account',
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

function getPapers() {
   $.ajax({
      url: '/api/papers/',
      method: 'GET',
      success: function(result) {
         sessionStorage.papers = JSON.stringify(result);

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
