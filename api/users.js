var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var utils = require('./utils.js');
var jwt = require('jsonwebtoken');

// Is this really used anywhere?!
router.get('/', function(req, res) {
	utils.loadJsonFile(utils.USERS_FILE_PATH, (error, users, save) => {
		if (error) res.status(error.status).json(error);

		var result = [];
		users.forEach(user => {
			result.push({
				"id": user.id,
				"given_name": user.given_name,
				"family_name": user.family_name,
				"email": user.email
			});
		});
		result = utils.sortUsersAlphabetically(result);
		res.json(result);
	});
});

// Returns all info about the logged in user
router.get('/profile', function(req, res) {
	utils.loadJsonFile(utils.USERS_FILE_PATH, (error, users, save) => {
		if (error) res.status(error.status).json(error);

		var loggedUser = users.find(u => u.id === req.jwtPayload.id);
		if (loggedUser) {
			delete loggedUser.id;
			delete loggedUser.pass;
			res.json(loggedUser);
		} else res.status(404).json({ message: 'Unable to find logged user info!' });
	});
});

// Updates profile info of the logged in user
router.put('/profile', function(req, res) {
	utils.loadJsonFile(utils.USERS_FILE_PATH, (error, users, save) => {
		if (error) res.status(error.status).json(error);

		var loggedUser = users.find(u => u.id === req.jwtPayload.id);
		if (loggedUser) {
			if (req.body['family_name']) loggedUser.family_name = req.body['family_name'];
			if (req.body['given_name']) loggedUser.given_name = req.body['given_name'];
			if (req.body['sex']) loggedUser.sex = req.body['sex'];

			fs.writeFile(path.resolve(utils.USERS_FILE_PATH), JSON.stringify(users, null, '\t'), error => {
				if (error) res.status(400).json({ message: 'An error occurred while saving profile info. Please, try again!' });
				
				var accessToken = jwt.sign(loggedUser, app.get('secret'), {
					expiresIn: 86400
				});
				res.json({
					success: true,
					message: 'User profile correctly updated!',
					id: loggedUser.id,
					email: loggedUser.email,
					fullname: loggedUser.given_name + ' ' + loggedUser.family_name,
					accessToken: accessToken
				});
			});
		} else res.status(404).json({ message: 'Unable to find logged user info!' });
	});
});

// Updates password of the logged in user
router.put('/profile/password', function(req, res) {
	utils.loadJsonFile(utils.USERS_FILE_PATH, (error, users, save) => {
		if (error) res.status(error.status).json(error);
		
		if (!req.body['newPassword'] || !req.body['newPasswordVerify']) 
			res.status(400).json({ message: 'One or both fields were empty. Please, try again!' });
		else if (req.body['newPassword'] !== req.body['newPasswordVerify'])
			res.status(400).json({ message: 'New passwords didn\'t match. Please, try again!' });
		else {
			var loggedUser = users.find(u => u.id === req.jwtPayload.id);
			if (loggedUser) {
				loggedUser.pass = req.body['newPassword'];

				fs.writeFile(path.resolve(utils.USERS_FILE_PATH), JSON.stringify(users, null, '\t'), error => {
					if (error) res.status(400).json({ message: 'An error occurred while saving the updated password. Please, try again! '});
					
					res.json({ message: "Password correctly updated!" });
				});
			} else res.status(404).json({ message: 'Unable to find logged user info!' });
		}
	});
});

// Returns email of the specified user
router.get('/:id', function(req, res){
	if (req.accepts(['application/json'])){
		utils.loadJsonFile(utils.USERS_FILE_PATH, (error, users, save) => {
			var user = users.find(x => x.id === req.params.id);
			if (user) res.json(user.email);
			else res.status(404).json({ message: 'Unable to find specified user!' });
		});
	} else res.status(406).json({ message: 'Unable to fulfill the request: JSON not accepted!' });
});

module.exports = router;
