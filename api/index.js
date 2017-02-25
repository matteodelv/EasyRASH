/*
 *	INDEX.JS (API)
 *
 *	Authors:
 *	Matteo Del Vecchio
 *	Filippo Vigani
 */

'use strict';

var express = require('express');
var router = express.Router();
var jwt = require('jsonwebtoken');

//Ask for no caching
router.use(function (req, res, next) {
	res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
	res.header('Expires', '-1');
	res.header('Pragma', 'no-cache');
	next();
});

router.use('/authentication', require('./authentication')); //POST Requests on /api/authenticate
//JWT Authentication (used for all requests on /api)
router.use(function(req, res, next) {
	//Decode token
	if (req.token) {
		//Verifies secret and checks exp
		jwt.verify(req.token, req.app.get('secret'), function(err, decoded) {
			if (err) {
				if (err.name === 'TokenExpiredError'){
					return res.status(403).json({ message: 'Failed to authenticate token. Please try logging out and signing in again.', error: err, jwt: req.token });
				}
				return res.status(403).json({ message: 'Failed to authenticate token. Please try logging out and signing in again.', error: err, jwt: req.token });
			} else {
				// if everything is good, save to request for use in other routes
				//jwt.refresh(decoded, 1440, req.app.get('secret')); //https://github.com/jppellerin/node-jsonwebtoken/tree/refresh-token
				req.jwtPayload = decoded;
				next();
			}
		});
	} else return res.status(403).json({ message: 'No token provided.' });
});

router.post('/verify', (req, res) => {
	return res.json({ message: 'Token active and verified.', id: req.jwtPayload.id, fullname: req.jwtPayload.given_name + ' ' + req.jwtPayload.family_name });
}); 

//Routing for RESTful api
router.use('/papers', require('./papers')); //GET Requests for /api/papers, carried out by papersController
router.use('/users', require('./users'));
router.use('/events', require('./events'));

module.exports = router;
