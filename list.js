var http = require('http');
var querystring = require('querystring');
var jsdom = require('jsdom');
var jquery = require('jquery');
var Iconv = require('iconv').Iconv;
var Buffer = require('buffer').Buffer;
var MongoClient = require('mongodb').MongoClient;
var co = require('co');

var dbUrl = 'mongodb://localhost:27017/animal';

var toDateString = function (date) {
  var month = '' + (date.getMonth() + 1),
      day = '' + date.getDate(),
      year = date.getFullYear();

  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;

  return [year, month, day].join('-');
};

var saveItem = function(no, item) {
  co(function *() {
    var db = yield MongoClient.connect(dbUrl);
    var col = db.collection('list');
    yield col.replaceOne({'no': no}, item, {'upsert': true});
    db.close();
  });
};

var insertItem = function(item) {
  var status = item['status'];
  var no = item['no'];
  if(typeof(status) == 'undfined') return;
  if(status.indexOf('종료') > -1) {
    co(function *() {
      var db = yield MongoClient.connect(dbUrl);
      var col = db.collection('list');
      yield col.deleteOne({'no': no });
      db.close();
    });
    return;
  }
  saveItem(no, item);
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
        var items = $('.thumbnail01').map(function() {
          var $detail =  $(this).find('.thumbnail_btn01_2 a');
          var regEx = /[?&]desertion_no=(\d+)/g;
          var no = regEx.exec($detail.attr('href'))[1];
          var status = $(this).find('img[alt=상태]').parent().next().text().trim();
          return {'no' : no, 'status' : status };
        }).get();

        if(items.length > 0) {
          for( ; i < items.length ; i++) {
            insertItem(items[i]);
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
  //TODO : 2달전 DB에서 지우기
  getListOfOnePage(toDateString(startdate), toDateString(enddate), 1);
})();

