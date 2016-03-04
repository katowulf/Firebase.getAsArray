# Firebase.getAsArray

A simple library to demonstrate how arrays can be synchronized to a real-time, distributed system like Firebase.

This library demonstrates the following best practices for using arrays with collaborative, real-time data:

 - make the array read only (don't use splice, pop, etc; have setter methods)
 - when possible, refer to records using a uniqueId rather than array index
 - synchronize changes from the server directly into our array
 - push local changes to the server and letting them trickle back

In other words, our array is essentialy one-directional. Changes come from the server into the array, we read them out, we push our local edits to the server, they trickle back into the array.

Read more about synchronized arrays and this lib on the [Firebase Blog](https://www.firebase.com/blog/2014-05-06-synchronized-arrays.html).

## Installation

Download the [firebase-as-array.min.js](blob/master/firebase-as-array.min.js) file and include it in your HTML:

```html
<script src="firebase-as-array.min.js"></script>
<script>
    var ref = new Firebase(URL);
    var list = Firebase.getAsArray(ref);
</script>
```

Or in your node.js project:

```javascript
var Firebase = require('firebase');
var getAsArray = require('./firebase-as-array.js');

var ref = new Firebase(URL);
var list = getAsArray(ref);
```

## Usage

```javascript
var ref = new Firebase(URL);

// create a synchronized array
var list = getAsArray(ref);

// add a new record
var ref = list.$add({foo: 'bar'});

// remove record
list.$remove( key );

// set priority on a record
list.$move( key, newPriority );

// find position of a key in the list
list.$indexOf( key );

// find key for a record at position 1
list[1].$id;
```

## Limitations

All the records stored in the array are objects. Primitive values get stored as `{ '.value': primitive }`

Does not support IE 8 and below by default. To support these, simply include polyfills for
[Array.prototype.forEach](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach#Polyfill)
 and [Function.prototype.bind](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind#Compatibility) in your code base.

## API

### getAsArray(ref[, eventCallback])

```
@param {Firebase} ref
@param {Function} [callback]
@returns {Array}
```

Creates a new array and synchronizes it to the ref provided.

### $id

The record ID. This is the unique URL key used to store the record in Firebase (the equivalent of `firebaseRef.name()`).

### $indexOf(key)

```
@param {String} key the path name for a record to find in the array
@returns {int} the index of the element in the array or -1 if not found
```

A convenience method to find the array position of a given key.

### $add(data)

```
@param data  the data to be put in Firebase as a new child record
@returns {Firebase} the ref to the newly created record
```

Adds a record to Firebase and returns the reference. To obtain its id, use `ref.name()`, assuming `ref` is the variable assigned to the return value.

### $remove(key)

```
@param {string} key a record id to be removed locally and remotely
```

Removes a record locally and from Firebase

### $set(key, data)

```
@param {string} key a record id to be replaced
@param data what goes into it
```

Replaces the value of a record locally and in Firebase

### $update(key, data)

```
@param {string} key a record id to be updated
@param {object} data some keys to be replaced
```

Updates the value of a record locally, replacing any keys that are in `data` with the values provided and leaving the rest of the record alone.

### $move(key, newPriority)

```
@param {string} key record id to be moved
@param {string|int} newPriority the sort order to be applied
```

Moves a record locally and in the remote data list.

## Development

This lib is intended primarily to be an example. However, pull requests will be happily accepted.

```
git clone git@github.com:yourname/Firebase.getAsArray
npm install
grunt
grunt watch
# make your fixes
# verify tests are at 100%
grunt make
git commit -m "your changes"
git push
# create a pull request!
```

## Support

Use the issue tracker if you have questions or problems. Since this is meant primarily as an example, do not expect prompt replies!
