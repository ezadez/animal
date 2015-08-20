var http = require('http');
var querystring = require('querystring');
var jsdom = require('jsdom');
var jquery = require('jquery');
var Iconv = require('iconv').Iconv;
var Buffer = require('buffer').Buffer;
var MongoClient = require('mongodb').MongoClient;

var dbUrl = 'mongodb://localhost:27017/animal';

var toDateString = function (date) {
  var month = '' + (date.getMonth() + 1),
      day = '' + date.getDate(),
      year = date.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
};

var insertItem = function(desertionNo) {
  MongoClient.connect(dbUrl, function(err, db) {
    if(err != null) {
      console.log('db error : ' + err);
      return;
    }
    var collection = db.collection('list');
    collection.insert({'desertionNo' : desertionNo},
    function (err, result) {
      if(err != null) {
        console.log('insert error : ' + err);
        return;
      }
      console.log(desertionNo);
      db.close();
    });
  });
};

var getListOfOnePage = function(startdateString, enddateString, pagecnt) {

  var postData = querystring.stringify({
    's_date' : startdateString,
    'e_date' : enddateString,
    'pagecnt' : pagecnt
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
      jsdom.env(body, function(err, window) {
        var $ = require('jquery')(window);
        var i = 0;
        var newDesertionNos = $('.thumbnail_btn01_2 a').map(function() {
          var regEx = /[?&]desertion_no=(\d+)/g;
          var href = regEx.exec($(this).attr('href'))[1];
          return href;
        }).get();

        if(newDesertionNos.length > 0) {
          for( ; i < newDesertionNos.length ; i++) {
            insertItem(newDesertionNos[i]);
          }
          setTimeout(function() {
            getListOfOnePage(startdateString, enddateString, pagecnt + 1);
          }, 1);
        }
      });
    });
  });

  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
  });

  req.write(postData);
  req.end();

};

(function() {
  var enddate = new Date();
  var startdate = new Date(enddate);
  startdate.setDate(enddate.getDate() - 60);
  getListOfOnePage(toDateString(startdate), toDateString(enddate), 1);
})();

