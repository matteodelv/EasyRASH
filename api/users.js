var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var utils = require('./utils.js');
var jwt = require('jsonwebtoken');

//TODO: use loadData function from utils
router.get('/', function(req, res) {
	var usersPath = path.resolve('storage/users.json');
	if (fs.existsSync(usersPath)) {
		fs.readFile(usersPath, 'utf8', (err, data) => {
			if (err) throw err;

			var users = JSON.parse(data);
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
	} else res.status(404).send('404 - User List not found');
});

// Returns all info about the logged in user
router.get('/profile', function(req, res) {
	var usersPath = path.resolve('storage/users.json');
	if (fs.existsSync(usersPath)) {
		fs.readFile(usersPath, 'utf8', (error, data) => {
			if (error) throw error;

			var users = JSON.parse(data);
			var loggedUser = users.find(u => u.id === req.jwtPayload.id);
			if (loggedUser) {
				delete loggedUser.id;
				delete loggedUser.pass;
				res.json(loggedUser);
			} else res.status(404).json({ success: false, message: 'Unable to find logged user info!' });
		});
	} else res.status(404).json({ success: false, message: 'Unable to locate users info!' });
});

router.put('/profile', function(req, res) {
	utils.loadDataFile('storage/users.json', (error, users) => {
		if (error) res.status(error.status).json(error);

		var loggedUser = users.find(u => u.id === req.jwtPayload.id);
		if (loggedUser) {
			if (req.body['family_name']) loggedUser.family_name = req.body['family_name'];
			if (req.body['given_name']) loggedUser.given_name = req.body['given_name'];
			if (req.body['sex']) loggedUser.sex = req.body['sex'];

			fs.writeFile(path.resolve('storage/users.json'), JSON.stringify(users, null, '\t'), error => {
				if (error) throw error;
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

router.put('/profile/password', function(req, res) {
	utils.loadDataFile('storage/users.json', (error, users) => {
		if (error) res.status(error.status).json(error);
		
		if (!req.body['newPassword'] || !req.body['newPasswordVerify']) 
			res.status(400).json({ message: 'One or both fields were empty. Please, try again!' });
		else if (req.body['newPassword'] !== req.body['newPasswordVerify'])
			res.status(400).json({ message: 'New passwords didn\'t match. Please, try again!' });
		else {
			var loggedUser = users.find(u => u.id === req.jwtPayload.id);
			if (loggedUser) {
				loggedUser.pass = req.body['newPassword'];

				fs.writeFile(path.resolve('storage/users.json'), JSON.stringify(users, null, '\t'), error => {
					if (error) throw error;
					res.json({ message: "Password correctly updated!" });
				});
			} else res.status(404).json({ message: 'Unable to find logged user info!' });
		}
	});
});

router.get('/:id', function(req, res){
   if (req.accepts(['application/json'])){
      fs.readFile('./storage/users.json', 'utf8', (err, data) => {
         if (err) throw err;
         var users = JSON.parse(data);
         var user = users.find(x => x.id === req.params.id);
         res.json(user.email);
      });
   } else res.status(406).send('406 - Not acceptable: ' + req.get('Accept') + ' not acceptable');
});

module.exports = router;
