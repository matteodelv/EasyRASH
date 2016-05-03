var express = require('express');
var fs = require('fs');
var app = express();

app.get('/', function (req, res) { //GET Requests received on root

   //Redirecting root requests to index.html static file
   //res.redirect('/index.html');

   //Sending static file
   filePath = __dirname + '/public/index.html'
   if (fs.existsSync(filePath))
   {
      res.sendfile(filePath);
   }
   else
   {
      res.statusCode = 404;
      res.write('404 sorry not found');
      res.end();
   }
});

app.use('/api', require('./api')) //Routes defined in api folder

//app.use(express.static(path.join(__dirname, 'public')));
app.use('/', express.static('./public')); //serving static files under public folder

app.listen(3000, function () {
   console.log('Example app listening on port 3000!');
});
