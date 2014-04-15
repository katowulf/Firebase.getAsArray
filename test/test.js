
var sinon = require('sinon');
var _ = require('lodash');
var expect = require('chai').use(require('sinon-chai')).expect;
var Firebase = require('./lib/MockFirebase.js').Firebase;
var getAsArray = require('../firebase-as-array').getAsArray;

describe('Firebase.getAsArray', function() {
  var fb;

  beforeEach(function() {
    fb = new Firebase().child('data');
  });

  describe('#constructor', function() {

    it('should attach functions to array', function() {
      var list = getAsArray(fb);
      expect(list).is.instanceof(Array);
      _.each(['$indexOf', '$add', '$remove', '$update', '$move'], function(fn) {
        expect(list[fn]).is.a('function');
      });
    });

    it('should load initial data', function() {
      var list = getAsArray(fb);
      fb.flush();
      expect(list).to.have.length(_.keys(fb.getData()).length);
      var i = 0;
      _.each(fb.getData(), function(v) {
        expect(list[i++]).to.eql(v);
      });
    });

    it('should handle child_added from server', function() {
      var list = getAsArray(fb);
      fb.flush();
      var oldLength = list.length;
      fb.child('foo').set({hello: 'world'});
      fb.flush();
      expect(list).to.have.length(oldLength+1);
    });

    it('should handle child_removed from server', function() {
      var list = getAsArray(fb);
      fb.flush();
      var oldLength = list.length;
      fb.child('b').remove();
      fb.flush();
      expect(list).to.have.length(oldLength-1);
    });

    it('should handle child_changed from server', function() {
      var list = getAsArray(fb);
      var data = {hello: 'world'};
      fb.flush();

      var oldLength = list.length;
      fb.child('b').set(data);
      fb.flush();

      expect(list).has.length(oldLength);
      expect(list[1]).eqls(data);
    });

    it('should handle child_moved from server', function() {
      var list = getAsArray(fb);
      fb.flush();

      var oldLength = list.length;
      fb.child('a').setPriority(100);
      fb.flush();

      expect(list).has.length(oldLength);
      expect(list[oldLength-1]).eqls(fb.getData().a);
    });

    it('should trigger callback for add', function() {
      var spy = sinon.spy();
      var list = getAsArray(fb, spy);
      fb.flush();

      var len = list.length;
      expect(len).is.above(0);
      expect(spy.callCount).equals(len);

      fb.push({foo: 'bar'});
      fb.flush();
      expect(spy.callCount).equals(len+1);
    });

    it('should trigger callback for remove', function() {
      var spy = sinon.spy();
      var list = getAsArray(fb, spy);
      fb.flush();

      var len = list.length;
      expect(len).is.above(0);
      expect(spy.callCount).equals(len);

      fb.child('a').remove();
      fb.flush();
      expect(list.length).equals(len-1);
      expect(spy.callCount).equals(len+1);
    });

    it('should trigger callback for change', function() {
      var spy = sinon.spy();
      var list = getAsArray(fb, spy);
      fb.flush();

      var len = list.length;
      expect(len).is.above(0);
      expect(spy.callCount).equals(len);

      fb.child('a').set({hello: 'world'});
      fb.flush();

      expect(list.length).equals(len);
      expect(spy.callCount).equals(len+1);
    });

    it('should trigger callback for move', function() {
      var spy = sinon.spy();
      var list = getAsArray(fb, spy);
      fb.flush();

      var len = list.length;
      expect(len).is.above(0);
      expect(spy.callCount).equals(len);

      fb.child('a').setPriority(100);
      fb.flush();

      expect(list.length).equals(len);
      expect(spy.callCount).equals(len+1);
    });
  });

  describe('$indexOf', function() {
    it('should return correct index for existing records', function() {
      var list = getAsArray(fb);
      fb.flush();

      var i = 0;
      expect(list.length).is.gt(0);
      _.each(fb.getData(), function(dat, key) {
        expect(list.$indexOf(key)).equals(i++);
      });
    });

    it('should return -1 for missing record', function() {
      var list = getAsArray(fb);
      fb.flush();

      expect(list.length).is.gt(0);
      expect(list.$indexOf('notakey')).equals(-1);
    });
  });

  describe('$keyFor', function() {
    it('should return correct indices for each key', function() {
      var list = getAsArray(fb);
      fb.flush();

      var keys = _.keys(fb.getData());
      expect(keys.length).above(0);
      _.each(keys, function(k,i) {
        expect(list.$keyFor(i)).equals(k);
      });
    });

    it('should return undefined for a key that does not exist', function() {
      var list = getAsArray(fb);
      fb.flush();
      expect(list.$keyFor(99999)).equals(undefined);
    });
  });

  describe('$add', function() {
    it('should return a Firebase ref containing the record id', function() {
      var fb = new Firebase('Empty://', {});
      var list = getAsArray(fb);
      fb.flush();

      expect(list.length).equals(0);
      var ref = list.$add({foo: 'bar'});
      fb.flush();

      expect(list.$indexOf(ref.name())).equals(0);
    });

    it('should add primitives', function() {
      var fb = new Firebase('Empty://', {});
      var list = getAsArray(fb);
      fb.flush();

      expect(list.length).equals(0);
      list.$add(true);
      fb.flush();

      expect(list[0]).equals(true);
    });

    it('should add objects', function() {
      var fb = new Firebase('Empty://', {});
      var list = getAsArray(fb);
      fb.flush();

      expect(list.length).equals(0);
      list.$add({foo: 'bar'});
      fb.flush();

      expect(list[0]).eqls({foo: 'bar'});
    });

    it('should accept a custom id', function() {
      var fb = new Firebase('Empty://', {});
      var list = getAsArray(fb);
      fb.flush();

      expect(list.length).equals(0);
      list.$add({foo: 'bar'}, 'foobar');
      fb.flush();

      expect(list.$indexOf('foobar')).equals(0);
    });

    it('should create an id if one is not provided', function() {
      var fb = new Firebase('Empty://', {});
      var list = getAsArray(fb);
      fb.flush();

      expect(list.length).equals(0);
      var ref = list.$add({foo: 'bar'});
      fb.flush();

      expect(ref.name()).equals(fb.getLastAutoId());
    });
  });

  describe('$set', function() {
    it('should update existing primitive', function() {
      var fb = new Firebase('Simple://', {foo: 'bar', hello: 'world'});
      var list = getAsArray(fb);
      fb.flush();

      expect(list[0]).equals('bar');
      list.$set('foo', 'baz');
      fb.flush();

      expect(list[0]).equals('baz');
    });

    it('should update existing object', function() {
      var list = getAsArray(fb);
      fb.flush();

      var dat = fb.getData().a;
      dat.test = true;

      list.$set('a', dat);
      fb.flush();

      expect(list[0].test).equals(true);
    });

    it('should not replace object references', function() {
      var list = getAsArray(fb);
      fb.flush();

      var listCopy = list.slice();

      list.$set('a', {test: 'hello'});
      fb.flush();

      expect(list.length).is.above(0);
      _.each(list, function(item, i) {
        expect(list[i]).equals(listCopy[i]);
      });
    });

    it('should create record if does not exist', function() {
      var list = getAsArray(fb);
      fb.flush();

      var len = list.length;
      list.$set('notakey', {hello: 'world'});
      fb.flush();

      expect(list.length).equals(len+1);
      expect(list.$indexOf('notakey')).equals(len);
    });
  });

  describe('$update', function() {
    it('should throw error if passed a primitive', function() {
      var fb = new Firebase('Simple://', {foo: 'bar', hello: 'world'});
      var list = getAsArray(fb);
      fb.flush();

      expect(function() {
        list.$update('foo', true);
      }).to.throw(Error);
    });

    it('should replace a primitive', function() {
      var fb = new Firebase('Simple://', {foo: 'bar', hello: 'world'});
      var list = getAsArray(fb);
      fb.flush();

      list.$update('foo', {hello: 'world'});
      fb.flush();

      expect(list[0]).eqls({hello: 'world'});
    });

    it('should update object', function() {
      var list = getAsArray(fb);
      fb.flush();

      list.$update('a', {test: true});
      fb.flush();

      expect(list[0].test).equals(true);
    });

    it('should not affect data that is not part of the update', function() {
      var list = getAsArray(fb);
      fb.flush();

      var copy = _.assign({}, list[0]);
      list.$update('a', {test: true});
      fb.flush();

      _.each(copy, function(v,k) {
        expect(list[0][k]).equals(v);
      })
    });

    it('should not replace object references', function() {
      var list = getAsArray(fb);
      fb.flush();

      var listCopy = list.slice();

      list.$update('a', {test: 'hello'});
      fb.flush();

      expect(list.length).is.above(0);
      _.each(list, function(item, i) {
        expect(list[i]).equals(listCopy[i]);
      });
    });

    it('should create record if does not exist', function() {
      var list = getAsArray(fb);
      fb.flush();

      var len = list.length;
      list.$update('notakey', {hello: 'world'});
      fb.flush();

      expect(list.length).equals(len+1);
      expect(list.$indexOf('notakey')).equals(len);
    });
  });

  describe('$remove', function() {
    it('should remove existing records', function() {
      var list = getAsArray(fb);
      fb.flush();

      var len = list.length;
      list.$remove('a');
      fb.flush();

      expect(list.length).equals(len-1);
      expect(list.$indexOf('a')).equals(-1);
    });

    it('should not blow up if record does not exist', function() {
      var list = getAsArray(fb);
      fb.flush();

      var len = list.length;
      list.$remove('notakey');
      fb.flush();

      expect(list.length).equals(len);
      expect(list.$indexOf('notakey')).equals(-1);
    });
  });

  describe('$move', function() {
    it('should move existing records', function() {
      var list = getAsArray(fb);
      fb.flush();

      var keys = _.keys(fb.getData());
      keys.push(keys.splice(0, 1)[0]);
      list.$move('a', 100);
      fb.flush();

      _.each(keys, function(k, i) {
        expect(list.$indexOf(k)).equals(i);
      });
    });

    it('should not change if record does not exist', function() {
      var list = getAsArray(fb);
      fb.flush();

      var keys = _.keys(fb.getData());
      list.$move('notakey', 100);
      fb.flush();

      _.each(keys, function(k, i) {
        expect(list.$indexOf(k)).equals(i);
      });
    });
  });
});