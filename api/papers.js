var router = require('express').Router();
var path = require('path');
var fs = require('fs');

/*
router.get('/', function(req, res) {
   //return all papers?
});*/
//Responds with a paper given the id
router.get('/:id', function(req, res){
   if (req.accepts(['application/xhtml+xml', 'text/html'])){
      filePath = path.resolve('storage/papers/' + req.params.id + '.html');
      if (fs.existsSync(filePath))
      {
         res.sendFile(filePath);
      }
      else res.status(404).send('404 sorry not found');
   } else res.status(406).send('406 - Not acceptable: ' + req.get('Accept') + ' not acceptable');
});

module.exports = router;
