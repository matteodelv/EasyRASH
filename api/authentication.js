'use strict';

var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var nodemailer = require('nodemailer');
var utils = require('./utils.js');

//Object that handles the email service
// Fill in with your email service config (more info on nodemailer support)
var transporter = nodemailer.createTransport({
	host: '',
	port: 25,
	secure: false,
	auth: {
		user: '',
		pass: ''
	},
	tls: {
		rejectUnauthorized:false
	}
});

//Verify that email transporter works
console.log('Checking email service...');
transporter.verify(function(error, success){
	if (error){
		console.log('Email service isn\'t working properly: ', error);
		console.log('...continuing without email service');
	} else {
		console.log('Email service working properly');
	}
});

/* Checks whether the user credentials match ones the ones of a specific users, in that case creates a JWT and returns it */
router.post('/signin', function(req, res) {
	utils.loadJsonFile(req.app.get('usersFilePath'), (error, users, save) => {
		if (error) return res.status(error.status).json(error);

		var user = users.find(u => u.email.toLowerCase() === (req.body.email || "").toLowerCase());
		if (!user || user.pass != req.body.password) {
			return res.status(401).json({ message: 'Authentication failed. Wrong email or password.' });
		} else {
			// If user is found and password is right, we create a JWT
			var accessToken = jwt.sign(user, req.app.get('secret'), {
				expiresIn: 86400 //Expires in 24 hours
			});
			// Return JWT and info as JSON
			return res.json({
				message: 'Authentication successful',
				id: user.id,
				email: user.email,
				fullname: user.given_name + ' ' + user.family_name,
				accessToken: accessToken
			});
		}
	});
});

/* Creates a new entry for an unverified user, generates an url to verify it, and sends an email with the verification url */
router.post('/signup', function(req, res) {
	utils.loadJsonFile(req.app.get('usersFilePath'), (error, users, save) => {
		if (error) return res.status(error.status).json(error);

		//Consider changing this to avoid network enumeration
		if (users.find(u => u.id.toLowerCase() === req.body.username.toLowerCase())) {
			//Username already registered
			return res.status(409).json({
				error: 'UsernameAlreadyInUse',
				message: 'Registration failed. Username is already in use.'
			});
		}
		if (users.find(u => u.email.toLowerCase() === req.body.email.toLowerCase())) {
			//Email already registered
			return res.status(409).send({
				error: 'EmailAlreadyInUse',
				message: 'Registration failed. Email is already in use.'
			});
		} else {
			crypto.randomBytes(48, function(err, buffer) {
				//Generate token for verification
				var token = buffer.toString('hex');
				utils.loadJsonFile(req.app.get('usersUnverifiedFilePath'), (error, usersUnverified, save) => {
					var newUser = {
						id: req.body.username,
						given_name: req.body.name,
						family_name: req.body.surname,
						email: req.body.email,
						pass: req.body.password,
						sex: req.body.sex,
						verificationToken: token
					}
					usersUnverified.push(newUser);

					fs.writeFile(req.app.get('usersUnverifiedFilePath'), JSON.stringify(usersUnverified, null, "\t"), err => {
						if (err) return res.status(400).json({ message: 'An error occurred while saving new user. Please, try again!' });
						
						var verifyLink = req.get('host') ? req.protocol + '://' + req.get('host') + '/api/authentication/verify/' + token : req.protocol + '://' + server.address().address + ':' + server.address().port + '/api/authentication/verify/' + token;
						// setup e-mail data with unicode symbols
						var mailOptions = {
							from: '"EasyRASH" <easyrashservice@matteodv.me>',
							to: req.body.email,
							subject: 'Easy RASH account verification ✔',
							html: '<p><b>It looks like you created a new account at Easy Rash.</b></p><p>In order to verify your account and be able to log in, please click on the following link: <a href="' + verifyLink + '">' + verifyLink + '</a></p>'
						}
						// send mail with defined transport object
						transporter.sendMail(mailOptions, function(error, info) {
							if (error) {
								return console.log(error);
							}
							console.log('Email message sent: ' + info.response);
						});
						return res.json({
							message: 'Registration successful.',
							email: req.body.email
						});
					});
				});
			});
		}
	});
});

/* Verifies the unverified user and saves it in the users list */
router.get('/verify/:token', function(req, res) {
	utils.loadJsonFile(req.app.get('usersUnverifiedFilePath'), (error, usersUnverified, save) => {
		if (error) return res.status(error.status).json(error);

		var user = usersUnverified.find(u => u.verificationToken === req.params.token);
		if (user) {
			//Remove all users with the id or email of the matching token
			for (var i = usersUnverified.length - 1; i >= 0; i--) {
				if (usersUnverified[i].id.toLowerCase() === user.id.toLowerCase() || usersUnverified[i].email.toLowerCase() === user.email.toLowerCase()) {
					usersUnverified.splice(i, 1);
				}
			}
			fs.writeFile(req.app.get('usersUnverifiedFilePath'), JSON.stringify(usersUnverified, null, "\t"), function(err) {
				if (err) return res.status(400).json(error);

				utils.loadJsonFile(req.app.get('usersFilePath'), (error, users, save) => {
					if (error) return res.status(error.status).json(error);

					delete user.verificationToken;
					users.push(user);
					save();
					return res.redirect('/');
				});
			});
		} else return res.status(400).json({ message: 'Invalid validation url.' });
	});
});

module.exports = router;
