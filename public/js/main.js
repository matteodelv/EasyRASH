$.fn.extend({
   animateCss: function(animationName) {
      var animationEnd = 'webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend';
      $(this).addClass('animated ' + animationName).one(animationEnd, function() {
         $(this).removeClass('animated ' + animationName);
      });
      return $(this);
   }
});

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
         $('#sidebar-wrapper ul').append('<li class="sidebar-brand"><a href="#">Submitted</a></li>\n');
         result.submitted.forEach(function(article) {
            var urlComplete = '/papers/' + article.url;
            var li = $('<li><a href="' + urlComplete + '">' + article.title + '</a></li>\n').appendTo($('#sidebar-wrapper ul'));
            li.on('click', function() {
               openPaper(urlComplete, article);
               return false;
            });
         });
         $('#sidebar-wrapper ul').append('<li class="sidebar-brand"><a href="#">Reviewable</a></li>\n');
         result.reviewable.forEach(function(article) {
            var urlComplete = '/papers/' + article.url;
            var li = $('<li><a href="' + urlComplete + '">' + article.title + '</a></li>\n').appendTo($('#sidebar-wrapper ul'));
            li.on('click', function() {
               openPaper(urlComplete, article);
               return false;
            });
         });
      },
      error: function(result) {
         $.notify({
            message: 'Error: ' + result
         }, {
            type: 'danger',
            delay: 2000
         });
      }
   });
}

function openPaper(url, article) {
   History.pushState(null, article.title, url);
   $.ajax({
      url: '/api' + url,
      method: 'GET',
      success: function(result) {
         $('#paper-container').text(result);
      },
      error: function(result) {
         $.notify({
            message: 'Error: ' + result.responseJSON.message
         }, {
            type: 'danger',
            delay: 2000
         });
      }
   });
}
