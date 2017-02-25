/*
 *	APP.JS
 *
 *	Authors:
 *	Matteo Del Vecchio
 *	Filippo Vigani
 */

'use strict';

var express = require('express');
var fs = require('fs');
var app = express();
var morgan = require('morgan');
var config = require('./config');
var bodyParser = require('body-parser');
var bearerToken = require('express-bearer-token');

app.disable('x-powered-by');
app.set('secret', config.secret);
app.set('usersFilePath', config.usersFilePath);
app.set('eventsFilePath', config.eventsFilePath);
app.set('usersUnverifiedFilePath', config.usersUnverifiedFilePath);

app.use(bodyParser.urlencoded({ extended: true })); //Used to automatically parse requests body
app.use(bodyParser.json());
app.use(morgan('dev')); //Used to log HTTP requests

app.use('/api', bearerToken());
app.use('/api', require('./api')) //Routes defined in api folder

app.use('/', express.static('./public')); //serving static files under public folder
app.use('/papers/:id', express.static('./public'));
app.use('/papers/img', express.static('./storage/papers/img'));
app.use('/papers/:id/img', express.static('./storage/papers/img'));
app.use('/papers/css', express.static('./storage/papers/css'));
app.use('/papers/js', express.static('./storage/papers/js'));
app.use('/js', express.static('./node_modules/babel-es6-polyfill'));
app.use('/papers/fonts', express.static('./storage/papers/fonts'));
app.use('/api', express.static('./rash')); //serving static files for rash as api root (?)

var server = app.listen(8080, "0.0.0.0", function () {
   console.log('EasyRASH listening on port ' + server.address().port + ' hosting at ' + server.address().address);
});

module.exports = app;