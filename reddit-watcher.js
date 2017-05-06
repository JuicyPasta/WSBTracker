'use strict';

const http = require('http');
const events = require('events');
const EventEmitter = events.EventEmitter;

module.exports = (function() {
  
  let emitter;

  return {
    getEmitter(options) {
      emitter = new EventEmitter();
      return emitter;
    }
  };

})();



