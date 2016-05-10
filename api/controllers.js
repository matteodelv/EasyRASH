var path = require('path');
var fs = require('fs');
var jwt = require('jsonwebtoken');
'use strict';

//Responds with a paper given the parameter
exports.getPaper = function(req, res){
   if (req.accepts(['application/xhtml+xml', 'text/html'])){
      filePath = path.resolve('storage/papers/' + req.params.id + '.html');
      if (fs.existsSync(filePath))
      {
         res.sendFile(filePath);
      }
      else
      {
         res.statusCode = 404;
         res.write('404 sorry not found');
         res.end();
      }
   } else {
      res.statusCode = 406;
      res.write('406 - Not acceptable: ' + req.get('content-type') + ' not acceptable');
      res.end();
   }
}

exports.authenticate = function(req, res){
   fs.readFile('./storage/users.json', 'utf8', (err, data) => {
      if (err) throw err;
      var users = JSON.parse(data);
      var usersArray = Object.keys(users).map(k => { //Returning the objects as an array
         users[k].key = k; //Adding the key as an bject
         return users[k];
      });
      var user = usersArray.find(u => u.email == req.body.email);
      if (!user || user.pass != req.body.password) {
         res.json({ success: false, message: 'Authentication failed. Wrong ' + (!user?'email.':'password.') });
      } else {
         // If user is found and password is right, we create a JWT
         var token = jwt.sign(user, app.get('secret'), {
            expiresIn: 1440 // expires in 24 hours
         });
         // Return JWT and info as JSON
         res.json({
            success: true,
            message: 'Authentication successful.',
            token: token
         });
      }
   });
}
