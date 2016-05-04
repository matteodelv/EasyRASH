var path = require('path');
var fs = require('fs');
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
