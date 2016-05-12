'use strict';

var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');

router.use('/authenticate', require('./auth')); //POST Requests on /api/authenticate, carried out by usersController
//JWT Authentication (used for all requests on /api)
router.use(function(req, res, next) {
   //Decode token
   if (req.token) {
      //Verifies secret and checks exp
      jwt.verify(req.token, app.get('secret'), function(err, decoded) {
         if (err) {
            return res.json({ success: false, message: 'Failed to authenticate token.' });
         } else {
            // if everything is good, save to request for use in other routes
            req.decoded = decoded;
            next();
         }
      });
   } else {
      return res.status(403).send({
         success: false,
         message: 'No token provided.'
      });
   }
});

//Routing for RESTful api
router.use('/papers', require('./papers')); //GET Requests for /api/papers, carried out by papersController

module.exports = router;
