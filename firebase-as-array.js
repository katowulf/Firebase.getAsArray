/*! Firebase.getAsArray - v0.0.1 - 2014-04-14
* Copyright (c) 2014 Kato
* MIT LICENSE */

(function(exports) {

  exports.getAsArray = function(ref, eventCallback) {
    return new ReadOnlySynchronizedArray(ref, eventCallback).getList();
  };

  function ReadOnlySynchronizedArray(ref, eventCallback) {
    this.ids = [];
    this.list = [];
    this.ref = ref;
    this.eventCallback = eventCallback;
    this._initList();
    this._initListeners();
  }

  ReadOnlySynchronizedArray.prototype = {
    getList: function() {
      return this.list;
    },

    add: function(data) {
      var key = this.ref.push().name();
      var ref = this.ref.child(key);
      if( arguments.length > 0 ) { ref.set(data, this._handleErrors.bind(this, key)); }
      return ref;
    },

    set: function(key, newValue) {
      this.ref.child(key).set(newValue, this._handleErrors.bind(this, key));
    },

    update: function(key, newValue) {
      this.ref.child(key).update(newValue, this._handleErrors.bind(this, key));
    },

    setPriority: function(key, newPriority) {
      this.ref.child(key).setPriority(newPriority);
    },

    remove: function(key) {
      this.ref.child(key).remove(this._handleErrors.bind(null, key));
    },

    posByKey: function(key) {
      return this.ids.indexOf(key);
    },

    keyForPos: function(pos) {
      return this.ids[pos];
    },

    _serverAdd: function(snap, prevId) {
      this._moveTo(snap.name(), snap.val(), prevId);
      this._handleEvent('child_added', snap.name(), snap.val());
    },

    _serverRemove: function(snap) {
      var pos = this.posByKey(snap.name());
      if( pos !== -1 ) {
        this.list.splice(pos, 1);
        this.ids.splice(pos, 1);
        this._handleEvent('child_removed', snap.name(), this.list[pos]);
      }
    },

    _serverChange: function(snap) {
      var pos = this.posByKey(snap.name());
      if( pos !== -1 ) {
        this.list[pos] = applyToBase(this.list[pos], snap.val());
        this._handleEvent('child_changed', snap.name(), this.list[pos]);
      }
    },

    _serverMove: function(snap, prevId) {
      var id = snap.name();
      var oldPos = this.posByKey(id);
      if( oldPos !== -1 ) {
        var data = this.list[oldPos];
        this.list.splice(oldPos, 1);
        this.ids.splice(oldPos, 1);
        this._moveTo(id, data, prevId);
        this._handleEvent('child_moved', snap.name(), data);
      }
    },

    _moveTo: function(id, data, prevId) {
      if( prevId === null ) {
        this.ids.unshift(id);
        this.list.unshift(data);
      }
      else {
        var pos = this.posByKey(id);
        if( pos === -1 ) {
          pos = this.list.length;
        }
        else {
          pos++;
        }
        this.ids.splice(pos, 0, id);
        this.list.splice(pos, 0, data);
      }
    },

    _handleErrors: function(key, err) {
      if( err ) {
        this._handleEvent('error', null, key);
        console.error(err);
      }
    },

    _handleEvent: function(eventType, recordId, data) {
      // console.log(eventType, recordId);
      this.eventCallback && this.eventCallback(eventType, recordId, data);
    },

    _initList: function() {
      this.list.$keyFor = this.keyForPos.bind(this);
      this.list.$indexOf = this.posByKey.bind(this);
      this.list.$add = this.add.bind(this);
      this.list.$remove = this.remove.bind(this);
      this.list.$set = this.set.bind(this);
      this.list.$update = this.update.bind(this);
      this.list.$move = this.setPriority.bind(this);
    },

    _initListeners: function() {
      this.ref.on('child_added', this._serverAdd.bind(this));
      this.ref.on('child_removed', this._serverRemove.bind(this));
      this.ref.on('child_changed', this._serverChange.bind(this));
      this.ref.on('child_moved', this._serverMove.bind(this));
    }
  };

  function applyToBase(base, data) {
    // do not replace the reference to objects contained in the data
    // instead, just update their child values
    if( isObject(base) && isObject(data) ) {
      var key;
      for(key in base) {
        if( base.hasOwnProperty(key) && !data.hasOwnProperty(key) ) {
          delete base[key];
        }
      }
      for(key in data) {
        if( data.hasOwnProperty(key) ) {
          base[key] = data[key];
        }
      }
      return base;
    }
    else {
      return data;
    }
  }

  function isObject(x) {
    return typeof(x) === 'object' && x !== null;
  }
})(typeof(window)==='undefined'? exports : window.Firebase);