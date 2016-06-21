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
            var $body = $xml.find('body');
            $addedHeadTags && $addedHeadTags.remove();
            $addedHeadTags = $xml.find('meta, link, title').not('[rel="stylesheet"]');
            $('head').append($addedHeadTags);
            $('#paper-container').empty().append($body);
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
         $('#sidebar-wrapper ul').append('<li class="sidebar-brand"><a href="#">Submitted</a></li>\n');
         result.submitted.forEach(function(paper) {
            var urlComplete = '/papers/' + paper.url;
            var li = $('<li><a href="' + urlComplete + '">' + paper.title + '</a></li>\n').appendTo($('#sidebar-wrapper ul'));
            li.on('click', function() {
               redirectToPaper(urlComplete, paper);
               return false;
            });
         });
         $('#sidebar-wrapper ul').append('<li class="sidebar-brand"><a href="#">Reviewable</a></li>\n');
         result.reviewable.forEach(function(paper) {
            var urlComplete = '/papers/' + paper.url;
            var li = $('<li><a href="' + urlComplete + '">' + paper.title + '</a></li>\n').appendTo($('#sidebar-wrapper ul'));
            li.on('click', function() {
               redirectToPaper(urlComplete, paper);
               return false;
            });
         });
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
