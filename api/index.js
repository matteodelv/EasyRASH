'use strict';

var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');

router.use('/authenticate', require('./auth')); //POST Requests on /api/authenticate
//JWT Authentication (used for all requests on /api)
router.use(function(req, res, next) {
   //Decode token
   if (req.token) {
      //Verifies secret and checks exp
      jwt.verify(req.token, app.get('secret'), function(err, decoded) {
         if (err) {
            if (err.name === 'TokenExpiredError'){
               return res.status(401).json({ success: false, message: 'Failed to authenticate token.', error: err, jwt: req.token });
            }
            return res.status(400).json({ success: false, message: 'Failed to authenticate token.', error: err, jwt: req.token });
         } else {
            // if everything is good, save to request for use in other routes
            req.jwtPayload = decoded;
            next();
         }
      });
   } else {
      return res.status(403).json({
         success: false,
         message: 'No token provided.'
      });
   }
});

router.post('/verify', (req, res) => {
   return res.json({ success: true, message: 'Token active and verified.' });
}); 

//Routing for RESTful api
router.use('/papers', require('./papers')); //GET Requests for /api/papers, carried out by papersController
router.use('/users', require('./users'));

module.exports = router;
