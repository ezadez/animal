var http = require('http');
var querystring = require('querystring');
var jsdom = require('jsdom');
var jquery = require('jquery');
var Iconv = require('iconv').Iconv;
var Buffer = require('buffer').Buffer;
var async = require('async');

var desertionNos = [];

var toDateString = function (date) {
  var month = '' + (date.getMonth() + 1),
      day = '' + date.getDate(),
      year = date.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
};

var getListOfOnePage = function(dateString, pagecnt, notifyDone) {

  var postData = querystring.stringify({
    's_date' : dateString,
    'e_date' : dateString,
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
        var newDesertionNos = $('.thumbnail_btn01_2 a').map(function() {
          var regEx = /[?&]desertion_no=(\d+)/g;
          var href = regEx.exec($(this).attr('href'))[1];
          return href;
        }).get();
        if(newDesertionNos.length > 0) {
          desertionNos = desertionNos.concat(newDesertionNos);
          setTimeout(function() {
            getListOfOnePage(dateString, pagecnt + 1, notifyDone);
          }, 1);
        } else {
          console.log(dateString);
          notifyDone();
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

var getListOfOneDay = function(date, notifyDone) {
  var dateString = toDateString(date);
  getListOfOnePage(dateString, 1, notifyDone);
};

var today = new Date();
var dates = [];
var i = 0;
for( ; i < 2 ; i++) {
  var date = new Date(today);
  date.setDate(today.getDate() - i);
  dates.push(date);
}

async.each(dates,
  function(date, notifyDone) {
    getListOfOneDay(date, notifyDone);
  },
  function(err) {
    console.log("done, total count : " + desertionNos.length);
  }
);

