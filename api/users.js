var router = require('express').Router();
var path = require('path');
var fs = require('fs');

/*
router.get('/', function(req, res) {
   //return all papers?
});*/
//Responds with a user given the id
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
