var path = require('path');
var fs = require('fs');
'use strict';

exports.main = function(req, res){
   //res.send("You requested paper " + req.params.id);
   filePath = path.resolve('rash/examples/evaluating-citation-functions-in-cito.html');
   //res.write(filePath);
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
}
