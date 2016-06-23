$.fn.extend({
   animateCss: function(animationName) {
      var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
      $(this).addClass('animated ' + animationName).one(animationEnd, function() {
         $(this).removeClass('animated ' + animationName);
      });
      return $(this);
   }
});

window.onpopstate = function(event) {
   loadCurrentPaperContent()
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
      $('#paper-container').empty();
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
            $('#paper-container').empty().append($body.children());
            rasherize();
            $('.sections-sidebar>ul').empty();
            var $root = $('html, body');
            $('.sections-sidebar>ul').append($('<li class="active"><a href="#top">' + $("head title").html().split(" -- ")[0] + '</a></li>'));
            $('#paper-container>section[id]').each(function(index) {
               var $link = $('<a href="#' + $(this).attr('id') + '">' + $(this).find('h1').eq(0).text() + '</a>');
               $('.sections-sidebar>ul').append($('<li></li>').append($link));
               if ($('section[id]', $(this)).size()) {
                  var $sub = $('<ul class="nav"></ul>');
                  $('section[id]', $(this)).each(function(index) {
                     var $sublink = $('<li><a href="#' + $(this).attr('id') + '">' + $(this).find('h2').eq(0).text() + '</a></li>');
                     if ($sublink.text()){
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
            var scrollTarget = window.location.hash ? $(window.location.hash).offset().top : $('#top').offset().top;
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

function auth() {
   $.ajax({
      url: '/api/authenticate',
      method: 'POST',
      data: {
         email: $('#email').val(),
         password: $('#password').val()
      },
      success: function(result) {
         localStorage.accessToken = result.accessToken;
         $('#login-modal').modal('hide');
         $.notify({ //http://bootstrap-notify.remabledesigns.com/
            message: 'Welcome ' + result.id
         }, {
            type: 'success',
            delay: 2000
         });
         getPapers();
      },
      error: function(result) {
         $('#loginbutton').animateCss('shake').prev('.help-inline').animateCss('bounceIn').text(JSON.parse(result.responseText).message);
      }
   });
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
            message: 'Error: ' + result.responseJSON.message + '-' + result.responseJSON.error.message
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
