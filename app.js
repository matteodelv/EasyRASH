var express = require('express');
var fs = require('fs');
app = express();
var morgan = require('morgan');
var config = require('./config');
var bodyParser = require('body-parser');
var bearerToken = require('express-bearer-token');

app.disable('x-powered-by');
app.set('secret', config.secret);

app.use(bodyParser.urlencoded({ extended: false })); //Used to automatically parse requests body
app.use(bodyParser.json());
app.use(morgan('dev')); //Used to log HTTP requests

app.use('/api', bearerToken());
app.use('/api', require('./api')) //Routes defined in api folder

app.use('/', express.static('./public')); //serving static files under public folder
app.use('/api', express.static('./rash')); //serving static files for rash as api root

app.listen(3000, function () {
   console.log('Easy RASH listening on port 3000!');
});
