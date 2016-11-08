var router = require('express').Router();
var path = require('path');
var fs = require('fs');

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
			result.sort((a, b) => {
				a = a.family_name.toLowerCase();
				b = b.family_name.toLowerCase();
				return a < b ? -1 : a > b ? 1 : 0;
			});
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
