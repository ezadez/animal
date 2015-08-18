var http = require('http');
var querystring = require('querystring');
var jsdom = require('jsdom');
var jquery = require('jquery');
var Iconv = require('iconv').Iconv;
var Buffer = require('buffer').Buffer;

var postData = querystring.stringify({
  's_date' : '2015-08-18',
  'e_date' : '2015-08-18',
  'pagecnt' : '1'
});

var options = {
  hostname: 'www.animal.go.kr',
  port: 80,
  path: '/portal_rnl/abandonment/public_list.jsp',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': postData.length
  }
};

var req = http.request(options, function(res) {
  var chunks = [];
  var iconv = new Iconv('EUC-KR', 'UTF-8');

  res.on('data', function(chunk) {
    chunks.push(chunk);
  });

  res.on('end', function() {
    var body = iconv.convert(Buffer.concat(chunks)).toString();
    console.log(body);
    jsdom.env(body, function(err, window) {
      var $ = require('jquery')(window);
    });
  });
});

req.on('error', function(e) {
  console.log('problem with request: ' + e.message);
});

req.write(postData);
req.end();