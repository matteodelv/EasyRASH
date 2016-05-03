'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./controllers');

router.get('/', controller.main); //GET Requests on /api, carried out by controllers.main

module.exports = router;
