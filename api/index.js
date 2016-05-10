'use strict';

var express = require('express');
var router = express.Router();
var controller = require('./controllers');
var jwt = require('jsonwebtoken');

router.post('/authenticate', controller.authenticate); //POST Requests on /api/authenticate, carried out by controllers.main

//JWT Authentication (used for all requests on /api)
router.use(function(req, res, next) {
   /*
   if (req.originalUrl.startsWith('/api/css/')){
      return next();
   }*/
   //Check header or url parameters or post parameters for token
   var token = req.body.token || req.query.token || req.headers['x-access-token'] || req.headers['Authorization'];
   // decode token
   if (token) {
      //Verifies secret and checks exp
      jwt.verify(token, app.get('secret'), function(err, decoded) {
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

router.get('/papers/:id', controller.getPaper); //GET Requests for /api/papers, carried out by controllers.main

module.exports = router;
