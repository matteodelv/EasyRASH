'use strict';

var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
	host: 'mail.matteodv.me',
	port: 25,
	secure: false,
	auth: {
		user: "easyrashservice@matteodv.me",
		pass: "#lickahorse19"
	},
	tls: {
		rejectUnauthorized:false
	}
});

router.post('/signin', function(req, res) {
	fs.readFile('./storage/users.json', 'utf8', (err, data) => {
		if (err) throw err;
		var users = JSON.parse(data);
		var user = users.find(u => u.email.toLowerCase() === (req.body.email || "").toLowerCase());
		if (!user || user.pass != req.body.password) {
			return res.status(401).json({
				success: false,
				message: 'Authentication failed. Wrong email or password.'
			});
		} else {
			// If user is found and password is right, we create a JWT
			var accessToken = jwt.sign(user, req.app.get('secret'), {
				expiresIn: 86400 //Expires in 24 hours
			});
			// Return JWT and info as JSON
			res.json({
				success: true,
				message: 'Authentication successful',
				id: user.id,
				email: user.email,
				fullname: user.given_name + ' ' + user.family_name,
				accessToken: accessToken
			});
		}
	});
});

router.post('/signup', function(req, res) {
	transporter.verify(function(error, success){
		if (error){
			console.log(error);
		} else {
			console.log("Il servizio email funziona correttamente");
		}
	});
	fs.readFile('./storage/users.json', 'utf8', (err, data) => {
		if (err) throw err;
		var users = JSON.parse(data);
		//Consider changing this to avoid network enumeration
		if (users.find(u => u.id.toLowerCase() === req.body.username.toLowerCase())) {
			//Username already registered
			return res.status(409).send({
				success: false,
				error: 'UsernameAlreadyInUse',
				message: 'Registration failed. Username is already in use.'
			});
		}
		if (users.find(u => u.email.toLowerCase() === req.body.email.toLowerCase())) {
			//Email already registered
			return res.status(409).send({
				success: false,
				error: 'EmailAlreadyInUse',
				message: 'Registration failed. Email is already in use.'
			});
		} else {
			crypto.randomBytes(48, function(err, buffer) {
				//Generate token for verification
				var token = buffer.toString('hex');
				fs.readFile('./storage/usersUnverified.json', 'utf8', (err, data) => {
					if (err) throw err;
					var usersUnverified = JSON.parse(data);
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

					fs.writeFile('./storage/usersUnverified.json', JSON.stringify(usersUnverified, null, "\t"), err => {
						if (err) throw err;
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
						res.json({
							success: true,
							message: 'Registration successful.',
							email: req.body.email
						});
					});
				});
			});
		}
	});
});
router.get('/verify/:token', function(req, res) {
	fs.readFile('./storage/usersUnverified.json', 'utf8', (err, data) => {
		if (err) throw err;
		var usersUnverified = JSON.parse(data);
		var user = usersUnverified.find(u => u.verificationToken === req.params.token);
		if (user) {
			//Remove all users with the id or email of the matching token
			for (var i = usersUnverified.length - 1; i >= 0; i--) {
				if (usersUnverified[i].id.toLowerCase() === user.id.toLowerCase() || usersUnverified[i].email.toLowerCase() === user.email.toLowerCase()) {
					usersUnverified.splice(i, 1);
				}
			}
			fs.writeFile('./storage/usersUnverified.json', JSON.stringify(usersUnverified, null, "\t"), function(err) {
				if (err) throw err;
			});
			fs.readFile('./storage/users.json', 'utf8', (err, data) => {
				//User is now verified, add it to the users storage
				if (err) throw err;
				delete user.verificationToken;
				var users = JSON.parse(data);
				users.push(user);
				fs.writeFile('./storage/users.json', JSON.stringify(users, null, "\t"), function(err) {
					console.log('New user verified: ' + user.id);
					if (err) throw err;
					res.redirect('/');
				});
			});
		} else {
			res.status(400).json({
				success: false,
				message: 'Invalid validation url.'
			});
		}
	});
});

module.exports = router;
