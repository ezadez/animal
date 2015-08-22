'use strict';

var Iconv = require('iconv').Iconv;
var jquery = require('jquery');
var jsdom = require('jsdom');
var MongoClient = require('mongodb').MongoClient;
var request = require('request');
var Sync = require('sync');

var DB_URL = 'mongodb://localhost:27017/animal';

var dateToString = function(date) {
  var month = '' + (date.getMonth() + 1);
  var day = '' + date.getDate();
  var year = date.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
};

var parseDetailPage = function(body) {
  // TODO
  return { 'key': 'value' };
};

var getDetail = function(no) {
  var response_and_body = request.sync(request, {
    'url': 'http://www.animal.go.kr' +
      '/portal_rnl/abandonment/public_view.jsp' +
      '?desertion_no=' + no,
    'encoding': null,
  });
  var response = response_and_body[0];
  var body = response_and_body[1];
  var iconv = new Iconv('EUC-KR', 'UTF-8');
  body = iconv.convert(body).toString();
  return parseDetailPage(body);
};

var parseListPage = function(body) {
  var window = jsdom.env.sync(jsdom, body);
  var $ = jquery(window);
  var items = $('.thumbnail01').map(function() {
    var $this = $(this);
    var $detail =  $this.find('.thumbnail_btn01_2 a');
    var regex = /[?&]desertion_no=(\d+)/g;
    var no = regex.exec($detail.attr('href'))[1];
    var status = $this.find('img[alt=상태]').parent().next().text().trim();
    return { 'no' : no, 'status' : status };
  }).get();
  window.close();
  return items;
};

var getListFromOnePage = function(start_date, end_date, page) {
  var response_and_body = request.sync(request, {
    'url': 'http://www.animal.go.kr' +
      '/portal_rnl/abandonment/public_list.jsp' +
      '?pagecnt=' + page +
      '&s_date=' + dateToString(start_date) +
      '&e_date=' + dateToString(end_date),
    'encoding': null,
  });
  var response = response_and_body[0];
  var body = response_and_body[1];
  var iconv = new Iconv('EUC-KR', 'UTF-8');
  body = iconv.convert(body).toString();
  return parseListPage(body);
};

var deleteItem = function(no) {
  var db = MongoClient.connect.sync(MongoClient, DB_URL);
  var col = db.collection('list');
  col.deleteOne.sync(col, { 'no': no });
  db.close.sync(db);
};

var saveItem = function(item) {
  var no = item['no'];
  var status = item['status'];
  if(typeof(status) == 'undefined') return;
  if(status.indexOf('종료') > -1) {
    deleteItem(no);
  }else {
    var detail = getDetail(no);
    detail['no'] = no;
    detail['status'] = status;
    var db = MongoClient.connect.sync(MongoClient, DB_URL);
    var col = db.collection('list');
    col.replaceOne.sync(col, { 'no': no }, detail, { 'upsert': true });
    db.close.sync(db);
    console.log('inserted ' + no);
  }
};

var saveItems = function(items) {
  var i;
  for(i = 0; i < items.length; i++) {
    var item = items[i];
    saveItem(item);
  }
};

var deleteOldItems = function(before) {
  var db = MongoClient.connect.sync(MongoClient, DB_URL);
  var col = db.collection('list');
  col.deleteMany.sync(col, { 'date': { '$lt': dateToString(before) } });
  db.close.sync(db);
};

var crawlList = function(start_date, end_date) {
  var page = 1;
  while(true) {
    var items = getListFromOnePage(start_date, end_date, page);
    if(items.length == 0) break;
    saveItems(items);
    page++;
  }
};

Sync(function() {
  var duration_in_days = 60;
  var today = new Date();
  var ago = new Date(today);
  ago.setDate(today.getDate() - duration_in_days);
  deleteOldItems(ago);
  crawlList(ago, today);
}, function(err, result) {
  if(err != null) {
    console.log('Something went wrong: ' + err);
  }
});
