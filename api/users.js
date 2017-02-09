var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var utils = require('../utils.js');

router.get('/list', function(req, res) {
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
