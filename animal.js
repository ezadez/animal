'use strict';

var MongoClient = require('mongodb').MongoClient;
var express = require('express');
var app = express();
app.use(express.static('public'));

var server = app.listen(9200, 'localhost', function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Animal app listening at http://%s:%s', host, port);
});
