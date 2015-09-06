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
  var window = jsdom.env.sync(jsdom, body);
  var $ = jquery(window);
  var selector = function(domType, content) {
    var regexText = content[0];
    for(var i = 1; i < content.length; i++) {
      regexText += '\\s*' + content[i];
    }
    var regex = new RegExp(regexText);
    return $(domType).filter(function() {
      return regex.test($(this).text().trim());
    });
  }

  var keys = ['공고번호', '품종', '색상',
      '성별', '중성화여부', '나이/체중',
      '접수일시', '발생장소', '특징',
      '공고기한', '보호센터이름', '전화번호',
      '보호장소', '관할기관', '담당자', '연락처',
      '특이사항'];
  var data = {
    '사진' : $('#aniPhoto img.photoArea').attr('src'),
  };
  for(var i = 0; i < keys.length; i++) {
    var key = keys[i];
    data[key] = selector('th', key).next().text().trim().replace(/\s+/g, ' ');
  }
  window.close();

  //축종 분류
  var regex = /\[(.+)\]\s*(.+)/;
  var group = regex.exec(data['품종']);
  data['축종'] = group[1];
  data['품종'] = group[2];
  //나이/체중 분류
  regex = /(\S+)\s*\/\s*(\S+)\s*\(kg\)/i;
  var group = regex.exec(data['나이/체중']);
  data['나이'] = group[1];
  data['체중'] = group[2];
  delete data['나이/체중'];
  //공고기한 시작끝 분류
  regex = /(\S+)\s*~\s*(\S+)/;
  var group = regex.exec(data['공고기한']);
  data['공고시작'] = group[1];
  data['공고끝'] = group[2];
  delete data['공고기한'];

  return data;
};

var getDetail = function(no) {
  var response_and_body = request.sync(null, {
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
    return { 'no' : no, '상태' : status };
  }).get();
  window.close();
  return items;
};

var getListFromOnePage = function(start_date, end_date, page) {
  var response_and_body = request.sync(null, {
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
  var status = item['상태'];
  if(typeof(status) == 'undefined') return;
  if(status.indexOf('종료') > -1) {
    deleteItem(no);
  }else {
    var detail = getDetail(no);
    detail['no'] = no;
    detail['상태'] = status;
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
  col.deleteMany.sync(col, { '접수일시': { '$lt': dateToString(before) } });
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
    console.log(err.stack);
  }
});
