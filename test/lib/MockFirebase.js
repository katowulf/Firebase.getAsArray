/**
 * MockFirebase: A Firebase stub/spy library for writing unit tests
 * https://github.com/katowulf/mockfirebase
 * @version 0.0.1-modified
 */
(function(exports) {
  var DEBUG = false;
  var PUSH_COUNTER = 0;

  // some hoop jumping for node require() vs browser usage
  var _, sinon;
  exports.Firebase = MockFirebase; //todo use MockFirebase.stub() instead of forcing overwrite of window.Firebase
  if( typeof module !== "undefined" && module.exports && typeof(require) === 'function' ) {
    _ = require('lodash');
    sinon = require('sinon');
  }
  else {
    _ = exports._;
    sinon = exports.sinon;
  }

  /**
   * A mock that simulates Firebase operations for use in unit tests.
   *
   * ## Setup
   *
   *     // in windows
   *     <script src="lib/lodash.js"></script> <!-- dependency -->
   *     <script src="lib/MockFirebase.js"></script> <!-- the lib -->
   *     <!-- not working yet: MockFirebase.stub(window, 'Firebase'); // replace window.Firebase -->
   *
   *     // in node.js
   *     var Firebase = require('../lib/MockFirebase');
   *
   * ## Usage Examples
   *
   *     var fb = new Firebase('Mock://foo/bar');
   *     fb.on('value', function(snap) {
    *        console.log(snap.val());
    *     });
   *
   *     // do something async or synchronously...
   *
   *     // trigger callbacks and event listeners
   *     fb.flush();
   *
   *     // spy on methods
   *     expect(fb.on.called).toBe(true);
   *
   * ## Trigger events automagically instead of calling flush()
   *
   *     var fb = new MockFirebase('Mock://hello/world');
   *     fb.autoFlush(1000); // triggers events after 1 second (asynchronous)
   *     fb.autoFlush(); // triggers events immediately (synchronous)
   *
   * ## Simulating Errors
   *
   *     var fb = new MockFirebase('Mock://fails/a/lot');
   *     fb.failNext('set', new Error('PERMISSION_DENIED'); // create an error to be invoked on the next set() op
   *     fb.set({foo: bar}, function(err) {
    *         // err.message === 'PERMISSION_DENIED'
    *     });
   *     fb.flush();
   *
   * @param {string} [currentPath] use a relative path here or a url, all .child() calls will append to this
   * @param {Object} [data] specify the data in this Firebase instance (defaults to MockFirebase.DEFAULT_DATA)
   * @param {MockFirebase} [parent] for internal use
   * @param {string} [name] for internal use
   * @constructor
   */
  function MockFirebase(currentPath, data, parent, name) {
    // these are set whenever startAt(), limit() or endAt() get invoked
    this._queryProps = { limit: undefined, startAt: undefined, endAt: undefined };

    // represents the fake url
    this.currentPath = currentPath || 'Mock://';

    // do not modify this directly, use set() and flush(true)
    this.data = _.cloneDeep(arguments.length > 1? data||null : MockFirebase.DEFAULT_DATA);

    // see failNext()
    this.errs = {};

    // used for setPriorty and moving records
    this.priority = null;

    // null for the root path
    this.myName = parent? name : extractName(currentPath);

    // see autoFlush()
    this.flushDelay = false;

    // stores the listeners for various event types
    this._events = { value: [], child_added: [], child_removed: [], child_changed: [], child_moved: [] };

    // allows changes to be propagated between child/parent instances
    this.parent = parent||null;
    this.children = [];
    parent && parent.children.push(this);

    // stores the operations that have been queued until a flush() event is triggered
    this.ops = [];


    // turn all our public methods into spies so they can be monitored for calls and return values
    // see jasmine spies: https://github.com/pivotal/jasmine/wiki/Spies
    // the Firebase constructor can be spied on using spyOn(window, 'Firebase') from within the test unit
    for(var key in this) {
      if( !key.match(/^_/) && typeof(this[key]) === 'function' ) {
        sinon.spy(this, key);
      }
    }
  }

  MockFirebase.prototype = {
    /*****************************************************
     * Test Unit tools (not part of Firebase API)
     *****************************************************/

    /**
     * Invoke all the operations that have been queued thus far. If a numeric delay is specified, this
     * occurs asynchronously. Otherwise, it is a synchronous event.
     *
     * This allows Firebase to be used in synchronous tests without waiting for async callbacks. It also
     * provides a rudimentary mechanism for simulating locally cached data (events are triggered
     * synchronously when you do on('value') or on('child_added') against locally cached data)
     *
     * If you call this multiple times with different delay values, you could invoke the events out
     * of order; make sure that is your intention.
     *
     * @param {boolean|int} [delay]
     * @returns {MockFirebase}
     */
    flush: function(delay) {
      var self = this, list = self.ops;
      self.ops = [];
      if( _.isNumber(delay) ) {
        setTimeout(process, delay);
      }
      else {
        process();
      }
      function process() {
        list.forEach(function(parts) {
          parts[0].apply(self, parts.slice(1));
        });

        self.children.forEach(function(c) {
          c.flush();
        });
      }
      return self;
    },

    /**
     * Automatically trigger a flush event after each operation. If a numeric delay is specified, this is an
     * asynchronous event. If value is set to true, it is synchronous (flush is triggered immediately). Setting
     * this to false disables autoFlush
     *
     * @param {int|boolean} [delay]
     */
    autoFlush: function(delay){
      this.flushDelay = _.isUndefined(delay)? true : delay;
      this.children.forEach(function(c) {
        c.autoFlush(delay);
      });
      delay !== false && this.flush(delay);
      return this;
    },

    /**
     * Simulate a failure by specifying that the next invocation of methodName should
     * fail with the provided error.
     *
     * @param {String} methodName currently only supports `set` and `transaction`
     * @param {String|Error} error
     */
    failNext: function(methodName, error) {
      this.errs[methodName] = error;
    },

    /**
     * Returns a copy of the current data
     * @returns {*}
     */
    getData: function() {
      return _.cloneDeep(this.data);
    },

    /**
     * Returns the last automatically generated ID
     * @returns {string|string|*}
     */
    getLastAutoId: function() {
      return 'mock'+PUSH_COUNTER;
    },

    /*****************************************************
     * Firebase API methods
     *****************************************************/

    toString: function() {
      return this.currentPath;
    },

    child: function(childPath) {
      if( !childPath ) { throw new Error('bad child path '+this.toString()); }
      var parts = _.isArray(childPath)? childPath : childPath.split('/');
      var childKey = parts.shift();
      var child = _.find(this.children, function(c) {
        return c.name() === childKey;
      });
      if( !child ) {
        child = new MockFirebase(mergePaths(this.currentPath, childKey), this._childData(childKey), this, childKey);
        child.flushDelay = this.flushDelay;
      }
      if( parts.length ) {
        child = child.child(parts);
      }
      return child;
    },

    set: function(data, callback) {
      var self = this;
      var err = this._nextErr('set');
      data = _.cloneDeep(data);
      DEBUG && console.log('set called',this.toString(), data); //debug
      this._defer(function() {
        DEBUG && console.log('set completed',this.toString(), data); //debug
        if( err === null ) {
          self._dataChanged(data);
        }
        callback && callback(err);
      });
      return this;
    },

    update: function(changes, callback) {
      if( !_.isObject(changes) ) {
        throw new Error('First argument must be an object when calling $update');
      }
      var self = this;
      var err = this._nextErr('update');
      var base = this.getData();
      var data = _.assign(_.isObject(base)? base : {}, changes);
      DEBUG && console.log('update called', this.toString(), data); //debug
      this._defer(function() {
        DEBUG && console.log('update completed', this.toString(), data); //debug
        if( err === null ) {
          self._dataChanged(data);
        }
        callback && callback(err);
      });
    },

    setPriority: function(newPriority) {
      this._priChanged(newPriority);
    },

    name: function() {
      return this.myName;
    },

    ref: function() {
      return this;
    },

    parent: function() {
      return this.parent? this.parent : this;
    },

    root: function() {
      var next = this;
      while(next.parent()) {
        next = next.parent();
      }
      return next;
    },

    push: function(data) {
      var id = 'mock'+(++PUSH_COUNTER);
      var child = this.child(id);
      if( data ) {
        child.set(data);
      }
      return child;
    },

    once: function(event, callback) {
      function fn(snap) {
        this.off(event, fn);
        callback(snap);
      }
      this.on(event, fn);
    },

    remove: function() {
      this._dataChanged(null);
    },

    on: function(event, callback) { //todo cancelCallback?
      this._events[event].push(callback);
      var data = this.getData(), self = this, pri = this.priority;
      if( event === 'value' ) {
        this._defer(function() {
          callback(makeSnap(self, data, pri));
        });
      }
      else if( event === 'child_added' ) {
        this._defer(function() {
          var prev = null;
          _.each(data, function(v, k) {
            callback(makeSnap(self.child(k), v, pri), prev);
            prev = k;
          });
        });
      }
    },

    off: function(event, callback) {
      if( !event ) {
        for (var key in this._events)
          if( this._events.hasOwnProperty(key) )
            this.off(key);
      }
      else if( callback ) {
        this._events[event] = _.without(this._events[event], callback);
      }
      else {
        this._events[event] = [];
      }
    },

    transaction: function(valueFn, finishedFn, applyLocally) {
      var valueSpy = sinon.spy(valueFn);
      var finishedSpy = sinon.spy(finishedFn);
      this._defer(function() {
        var err = this._nextErr('transaction');
        // unlike most defer methods, this will use the value as it exists at the time
        // the transaction is actually invoked, which is the eventual consistent value
        // it would have in reality
        var res = valueSpy(this.getData());
        var newData = _.isUndefined(res) || err? this.getData() : res;
        finishedSpy(err, err === null && !_.isUndefined(res), makeSnap(this, newData, this.priority));
        this._dataChanged(newData);
      });
      return [valueSpy, finishedSpy, applyLocally];
    },

    /**
     * If token is valid and parses, returns the contents of token as exected. If not, the error is returned.
     * Does not change behavior in any way (since we don't really auth anywhere)
     *
     * @param {String} token
     * @param {Function} [callback]
     */
    auth: function(token, callback) {
      //todo invoke callback with the parsed token contents
      callback && this._defer(callback);
    },

    /**
     * Just a stub at this point.
     * @param {int} limit
     */
    limit: function(limit) {
      this._queryProps.limit = limit;
      //todo
    },

    startAt: function(priority, recordId) {
      this._queryProps.startAt = [priority, recordId];
      //todo
    },

    endAt: function(priority, recordId) {
      this._queryProps.endAt = [priority, recordId];
      //todo
    },

    /*****************************************************
     * Private/internal methods
     *****************************************************/

    _childChanged: function(ref) {
      var data = ref.getData(), pri = ref.priority;
      if( !_.isObject(this.data) && data !== null ) { this.data = {}; }
      var exists = this.data.hasOwnProperty(ref.name());
      DEBUG && console.log('_childChanged', this.toString() + ' -> ' + ref.name(), data); //debug
      if( data === null && exists ) {
        delete this.data[ref.name()];
        this._trigger('child_removed', data, pri, ref.name());
        this._trigger('value', this.data, this.priority);
      }
      else if( data !== null ) {
        this.data[ref.name()] = _.cloneDeep(data);
        this._trigger(exists? 'child_changed' : 'child_added', data, pri, ref.name());
        this._trigger('value', this.data, this.priority);
        this.parent && this.parent._childChanged(this);
      }
    },

    _dataChanged: function(data) {
      var self = this;
      if(_.isObject(data) && _.has(data, '.priority')) {
        this._priChanged(data['.priority']);
        delete data['.priority'];
      }
      if( !_.isEqual(data, this.data) ) {
        this.data = _.cloneDeep(data);
        DEBUG && console.log('_dataChanged', this.toString(), data); //debug
        this._trigger('value', this.data, this.priority);
        if(this.children.length) {
          this._resort();
          _.each(this.children, function(child) {
            child._dataChanged(self._childData(child.name()));
          });
        }
        if( this.parent && _.isObject(this.parent.data) ) {
          this.parent._childChanged(this);
        }
      }
    },

    _priChanged: function(newPriority) {
      DEBUG && console.log('_priChanged', this.toString(), newPriority); //debug
      this.priority = newPriority;
      if( this.parent ) {
        this.parent._resort(this.name());
      }
    },

    _resort: function(childKeyMoved) {
      this.children.sort(childComparator);
      if( !_.isUndefined(childKeyMoved) ) {
        var child = this.child(childKeyMoved);
        this._trigger('child_moved', child.getData(), child.priority, childKeyMoved);
      }
    },

    _defer: function(fn) {
      //todo should probably be taking some sort of snapshot of my data here and passing
      //todo that into `fn` for reference
      this.ops.push(Array.prototype.slice.call(arguments, 0));
      if( this.flushDelay !== false ) { this.flush(this.flushDelay); }
    },

    _trigger: function(event, data, pri, key) {
      var self = this, ref = event==='value'? self : self.child(key);
      var snap = makeSnap(ref, data, pri);
      _.each(self._events[event], function(fn) {
        if(_.contains(['child_added', 'child_moved'], event)) {
          fn(snap, self._getPrevChild(key, pri));
        }
        else {
          //todo allow scope by changing fn to an array? for use with on() and once() which accept scope?
          fn(snap);
        }
      });
    },

    _nextErr: function(type) {
      var err = this.errs[type];
      delete this.errs[type];
      return err||null;
    },

    _childData: function(key) {
      return _.isObject(this.data) && _.has(this.data, key)? this.data[key] : null;
    },

    _getPrevChild: function(key) {

    }
  };

  function ref(path, autoSyncDelay) {
    var ref = new MockFirebase();
    ref.flushDelay = _.isUndefined(autoSyncDelay)? true : autoSyncDelay;
    if( path ) { ref = ref.child(path); }
    return ref;
  }

  function mergePaths(base, add) {
    return base.replace(/\/$/, '')+'/'+add.replace(/^\//, '');
  }

  function makeSnap(ref, data, pri) {
    data = _.cloneDeep(data);
    return {
      val: function() { return data; },
      ref: function() { return ref; },
      name: function() { return ref.name() },
      getPriority: function() { return pri; }, //todo
      forEach: function(cb, scope) {
        _.each(data, function(v, k, list) {
          var child = ref.child(k);
          //todo the priority here is inaccurate if child pri modified
          //todo between calling makeSnap and forEach() on that snap
          var res = cb.call(scope, makeSnap(child, v, child.priority));
          return !(res === true);
        });
      }
    }
  }

  function extractName(path) {
    return ((path || '').match(/\/([^.$\[\]#\/]+)$/)||[null, null])[1];
  }

  function childComparator(a, b) {
    if(a.priority === b.priority) {
      var key1 = a.name(), key2 = b.name();
      return ( ( key1 == key2 ) ? 0 : ( ( key1 > key2 ) ? 1 : -1 ) );
    }
    else {
      return a.priority < b.priority? -1 : 1;
    }
  }

  // a polyfill for window.atob to allow JWT token parsing
  // credits: https://github.com/davidchambers/Base64.js
  ;(function (object) {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    function InvalidCharacterError(message) {
      this.message = message;
    }
    InvalidCharacterError.prototype = new Error;
    InvalidCharacterError.prototype.name = 'InvalidCharacterError';

    // encoder
    // [https://gist.github.com/999166] by [https://github.com/nignag]
    object.btoa || (
      object.btoa = function (input) {
        for (
          // initialize result and counter
          var block, charCode, idx = 0, map = chars, output = '';
          // if the next input index does not exist:
          //   change the mapping table to "="
          //   check if d has no fractional digits
          input.charAt(idx | 0) || (map = '=', idx % 1);
          // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
          output += map.charAt(63 & block >> 8 - idx % 1 * 8)
          ) {
          charCode = input.charCodeAt(idx += 3/4);
          if (charCode > 0xFF) {
            throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
          }
          block = block << 8 | charCode;
        }
        return output;
      });

    // decoder
    // [https://gist.github.com/1020396] by [https://github.com/atk]
    object.atob || (
      object.atob = function (input) {
        input = input.replace(/=+$/, '')
        if (input.length % 4 == 1) {
          throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
        }
        for (
          // initialize result and counters
          var bc = 0, bs, buffer, idx = 0, output = '';
          // get next character
          buffer = input.charAt(idx++);
          // character found in table? initialize bit storage and add its ascii value;
          ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
            // and if not first of each 4 characters,
            // convert the first 8 bits to one ascii character
            bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
          ) {
          // try to find character in table (0-63, not found => -1)
          buffer = chars.indexOf(buffer);
        }
        return output;
      });

  }(exports));

  MockFirebase._ = _; // expose for tests

  MockFirebase.stub = function(obj, key) {
    obj[key] = MockFirebase;
  };

  MockFirebase.ref = ref;
  MockFirebase.DEFAULT_DATA  = {
    'data': {
      'a': {
        hello: 'world',
        aNumber: 1,
        aBoolean: false
      },
      'b': {
        foo: 'bar',
        aNumber: 2,
        aBoolean: true
      },
      'c': {
        bar: 'baz',
        aNumber: 3,
        aBoolean: true
      }
    }
  };
})(module && module.exports? module.exports : this);