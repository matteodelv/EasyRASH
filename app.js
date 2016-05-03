var express = require('express');
var app = express();

app.get('/', function (req, res) { //GET Requests received on root
  res.send('Hello World!');
});

app.use('/api', require('./api')) //Routes defined in api folder

//app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static('./public'));

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
