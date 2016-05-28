var router = require('express').Router();
var path = require('path');
var fs = require('fs');
var jwt = require('jsonwebtoken');
'use strict';

router.post('/', function(req, res){
   fs.readFile('./storage/users.json', 'utf8', (err, data) => {
      if (err) throw err;
      var users = JSON.parse(data);
      /*var usersArray = Object.keys(users).map(k => { //Returning the objects as an array
         users[k].key = k; //Adding the key as an bject
         return users[k];
      });*/
      var user = users.find(u => u.email == req.body.email);
      if (!user || user.pass != req.body.password) {
         return res.status(401).send({
            success: false,
            message: 'Authentication failed. Wrong email or password'
         });
      } else {
         // If user is found and password is right, we create a JWT
         var access_token = jwt.sign(user, app.get('secret'), {
            expiresIn: 1440 // expires in 24 hours
         });
         // Return JWT and info as JSON
         res.json({
            success: true,
            message: 'Authentication successful.',
            access_token: access_token
         });
      }
   });
});

module.exports = router;
