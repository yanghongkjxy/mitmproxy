(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

module.exports.Dispatcher = require('./lib/Dispatcher')

},{"./lib/Dispatcher":3}],3:[function(require,module,exports){
/*
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule Dispatcher
 * @typechecks
 */

"use strict";

var invariant = require('./invariant');

var _lastID = 1;
var _prefix = 'ID_';

/**
 * Dispatcher is used to broadcast payloads to registered callbacks. This is
 * different from generic pub-sub systems in two ways:
 *
 *   1) Callbacks are not subscribed to particular events. Every payload is
 *      dispatched to every registered callback.
 *   2) Callbacks can be deferred in whole or part until other callbacks have
 *      been executed.
 *
 * For example, consider this hypothetical flight destination form, which
 * selects a default city when a country is selected:
 *
 *   var flightDispatcher = new Dispatcher();
 *
 *   // Keeps track of which country is selected
 *   var CountryStore = {country: null};
 *
 *   // Keeps track of which city is selected
 *   var CityStore = {city: null};
 *
 *   // Keeps track of the base flight price of the selected city
 *   var FlightPriceStore = {price: null}
 *
 * When a user changes the selected city, we dispatch the payload:
 *
 *   flightDispatcher.dispatch({
 *     actionType: 'city-update',
 *     selectedCity: 'paris'
 *   });
 *
 * This payload is digested by `CityStore`:
 *
 *   flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'city-update') {
 *       CityStore.city = payload.selectedCity;
 *     }
 *   });
 *
 * When the user selects a country, we dispatch the payload:
 *
 *   flightDispatcher.dispatch({
 *     actionType: 'country-update',
 *     selectedCountry: 'australia'
 *   });
 *
 * This payload is digested by both stores:
 *
 *    CountryStore.dispatchToken = flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'country-update') {
 *       CountryStore.country = payload.selectedCountry;
 *     }
 *   });
 *
 * When the callback to update `CountryStore` is registered, we save a reference
 * to the returned token. Using this token with `waitFor()`, we can guarantee
 * that `CountryStore` is updated before the callback that updates `CityStore`
 * needs to query its data.
 *
 *   CityStore.dispatchToken = flightDispatcher.register(function(payload) {
 *     if (payload.actionType === 'country-update') {
 *       // `CountryStore.country` may not be updated.
 *       flightDispatcher.waitFor([CountryStore.dispatchToken]);
 *       // `CountryStore.country` is now guaranteed to be updated.
 *
 *       // Select the default city for the new country
 *       CityStore.city = getDefaultCityForCountry(CountryStore.country);
 *     }
 *   });
 *
 * The usage of `waitFor()` can be chained, for example:
 *
 *   FlightPriceStore.dispatchToken =
 *     flightDispatcher.register(function(payload) {
 *       switch (payload.actionType) {
 *         case 'country-update':
 *           flightDispatcher.waitFor([CityStore.dispatchToken]);
 *           FlightPriceStore.price =
 *             getFlightPriceStore(CountryStore.country, CityStore.city);
 *           break;
 *
 *         case 'city-update':
 *           FlightPriceStore.price =
 *             FlightPriceStore(CountryStore.country, CityStore.city);
 *           break;
 *     }
 *   });
 *
 * The `country-update` payload will be guaranteed to invoke the stores'
 * registered callbacks in order: `CountryStore`, `CityStore`, then
 * `FlightPriceStore`.
 */

  function Dispatcher() {
    this.$Dispatcher_callbacks = {};
    this.$Dispatcher_isPending = {};
    this.$Dispatcher_isHandled = {};
    this.$Dispatcher_isDispatching = false;
    this.$Dispatcher_pendingPayload = null;
  }

  /**
   * Registers a callback to be invoked with every dispatched payload. Returns
   * a token that can be used with `waitFor()`.
   *
   * @param {function} callback
   * @return {string}
   */
  Dispatcher.prototype.register=function(callback) {
    var id = _prefix + _lastID++;
    this.$Dispatcher_callbacks[id] = callback;
    return id;
  };

  /**
   * Removes a callback based on its token.
   *
   * @param {string} id
   */
  Dispatcher.prototype.unregister=function(id) {
    invariant(
      this.$Dispatcher_callbacks[id],
      'Dispatcher.unregister(...): `%s` does not map to a registered callback.',
      id
    );
    delete this.$Dispatcher_callbacks[id];
  };

  /**
   * Waits for the callbacks specified to be invoked before continuing execution
   * of the current callback. This method should only be used by a callback in
   * response to a dispatched payload.
   *
   * @param {array<string>} ids
   */
  Dispatcher.prototype.waitFor=function(ids) {
    invariant(
      this.$Dispatcher_isDispatching,
      'Dispatcher.waitFor(...): Must be invoked while dispatching.'
    );
    for (var ii = 0; ii < ids.length; ii++) {
      var id = ids[ii];
      if (this.$Dispatcher_isPending[id]) {
        invariant(
          this.$Dispatcher_isHandled[id],
          'Dispatcher.waitFor(...): Circular dependency detected while ' +
          'waiting for `%s`.',
          id
        );
        continue;
      }
      invariant(
        this.$Dispatcher_callbacks[id],
        'Dispatcher.waitFor(...): `%s` does not map to a registered callback.',
        id
      );
      this.$Dispatcher_invokeCallback(id);
    }
  };

  /**
   * Dispatches a payload to all registered callbacks.
   *
   * @param {object} payload
   */
  Dispatcher.prototype.dispatch=function(payload) {
    invariant(
      !this.$Dispatcher_isDispatching,
      'Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch.'
    );
    this.$Dispatcher_startDispatching(payload);
    try {
      for (var id in this.$Dispatcher_callbacks) {
        if (this.$Dispatcher_isPending[id]) {
          continue;
        }
        this.$Dispatcher_invokeCallback(id);
      }
    } finally {
      this.$Dispatcher_stopDispatching();
    }
  };

  /**
   * Is this Dispatcher currently dispatching.
   *
   * @return {boolean}
   */
  Dispatcher.prototype.isDispatching=function() {
    return this.$Dispatcher_isDispatching;
  };

  /**
   * Call the callback stored with the given id. Also do some internal
   * bookkeeping.
   *
   * @param {string} id
   * @internal
   */
  Dispatcher.prototype.$Dispatcher_invokeCallback=function(id) {
    this.$Dispatcher_isPending[id] = true;
    this.$Dispatcher_callbacks[id](this.$Dispatcher_pendingPayload);
    this.$Dispatcher_isHandled[id] = true;
  };

  /**
   * Set up bookkeeping needed when dispatching.
   *
   * @param {object} payload
   * @internal
   */
  Dispatcher.prototype.$Dispatcher_startDispatching=function(payload) {
    for (var id in this.$Dispatcher_callbacks) {
      this.$Dispatcher_isPending[id] = false;
      this.$Dispatcher_isHandled[id] = false;
    }
    this.$Dispatcher_pendingPayload = payload;
    this.$Dispatcher_isDispatching = true;
  };

  /**
   * Clear bookkeeping used for dispatching.
   *
   * @internal
   */
  Dispatcher.prototype.$Dispatcher_stopDispatching=function() {
    this.$Dispatcher_pendingPayload = null;
    this.$Dispatcher_isDispatching = false;
  };


module.exports = Dispatcher;

},{"./invariant":4}],4:[function(require,module,exports){
/**
 * Copyright (c) 2014, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule invariant
 */

"use strict";

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var invariant = function(condition, format, a, b, c, d, e, f) {
  if (false) {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  }

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error(
        'Minified exception occurred; use the non-minified dev environment ' +
        'for the full error message and additional helpful warnings.'
      );
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(
        'Invariant Violation: ' +
        format.replace(/%s/g, function() { return args[argIndex++]; })
      );
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
};

module.exports = invariant;

},{}],5:[function(require,module,exports){
var $ = require("jquery");

var ActionTypes = {
    // Connection
    CONNECTION_OPEN: "connection_open",
    CONNECTION_CLOSE: "connection_close",
    CONNECTION_ERROR: "connection_error",

    // Stores
    SETTINGS_STORE: "settings",
    EVENT_STORE: "events",
    FLOW_STORE: "flows",
};

var StoreCmds = {
    ADD: "add",
    UPDATE: "update",
    REMOVE: "remove",
    RESET: "reset"
};

var ConnectionActions = {
    open: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_OPEN
        });
    },
    close: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_CLOSE
        });
    },
    error: function () {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.CONNECTION_ERROR
        });
    }
};

var SettingsActions = {
    update: function (settings) {

        $.ajax({
            type: "PUT",
            url: "/settings",
            data: settings
        });

        /*
        //Facebook Flux: We do an optimistic update on the client already.
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.SETTINGS_STORE,
            cmd: StoreCmds.UPDATE,
            data: settings
        });
        */
    }
};

var EventLogActions_event_id = 0;
var EventLogActions = {
    add_event: function (message) {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.EVENT_STORE,
            cmd: StoreCmds.ADD,
            data: {
                message: message,
                level: "web",
                id: "viewAction-" + EventLogActions_event_id++
            }
        });
    }
};

var FlowActions = {
    accept: function (flow) {
        $.post("/flows/" + flow.id + "/accept");
    },
    accept_all: function(){
        $.post("/flows/accept");
    },
    "delete": function(flow){
        $.ajax({
            type:"DELETE",
            url: "/flows/" + flow.id
        });
    },
    duplicate: function(flow){
        $.post("/flows/" + flow.id + "/duplicate");
    },
    replay: function(flow){
        $.post("/flows/" + flow.id + "/replay");
    },
    revert: function(flow){
        $.post("/flows/" + flow.id + "/revert");
    },
    update: function (flow) {
        AppDispatcher.dispatchViewAction({
            type: ActionTypes.FLOW_STORE,
            cmd: StoreCmds.UPDATE,
            data: flow
        });
    },
    clear: function(){
        $.post("/clear");
    }
};

Query = {
    FILTER: "f",
    HIGHLIGHT: "h",
    SHOW_EVENTLOG: "e"
};

module.exports = {
    ActionTypes: ActionTypes,
    ConnectionActions: ConnectionActions,
    FlowActions: FlowActions,
    StoreCmds: StoreCmds
};
},{"jquery":"jquery"}],6:[function(require,module,exports){

var React = require("react");
var ReactRouter = require("react-router");
var $ = require("jquery");

var Connection = require("./connection");
var proxyapp = require("./components/proxyapp.js");

$(function () {
    window.ws = new Connection("/updates");

    ReactRouter.run(proxyapp.routes, function (Handler) {
        React.render(React.createElement(Handler, null), document.body);
    });
});
},{"./components/proxyapp.js":15,"./connection":17,"jquery":"jquery","react":"react","react-router":"react-router"}],7:[function(require,module,exports){
var React = require("react");
var ReactRouter = require("react-router");
var _ = require("lodash");

// http://blog.vjeux.com/2013/javascript/scroll-position-with-react.html (also contains inverse example)
var AutoScrollMixin = {
    componentWillUpdate: function () {
        var node = this.getDOMNode();
        this._shouldScrollBottom = (
            node.scrollTop !== 0 &&
            node.scrollTop + node.clientHeight === node.scrollHeight
        );
    },
    componentDidUpdate: function () {
        if (this._shouldScrollBottom) {
            var node = this.getDOMNode();
            node.scrollTop = node.scrollHeight;
        }
    },
};


var StickyHeadMixin = {
    adjustHead: function () {
        // Abusing CSS transforms to set the element
        // referenced as head into some kind of position:sticky.
        var head = this.refs.head.getDOMNode();
        head.style.transform = "translate(0," + this.getDOMNode().scrollTop + "px)";
    }
};


var Navigation = _.extend({}, ReactRouter.Navigation, {
    setQuery: function (dict) {
        var q = this.context.getCurrentQuery();
        for(var i in dict){
            if(dict.hasOwnProperty(i)){
                q[i] = dict[i] || undefined; //falsey values shall be removed.
            }
        }
        q._ = "_"; // workaround for https://github.com/rackt/react-router/pull/599
        this.replaceWith(this.context.getCurrentPath(), this.context.getCurrentParams(), q);
    },
    replaceWith: function(routeNameOrPath, params, query) {
        if(routeNameOrPath === undefined){
            routeNameOrPath = this.context.getCurrentPath();
        }
        if(params === undefined){
            params = this.context.getCurrentParams();
        }
        if(query === undefined){
            query = this.context.getCurrentQuery();
        }
        ReactRouter.Navigation.replaceWith.call(this, routeNameOrPath, params, query);
    }
});
_.extend(Navigation.contextTypes, ReactRouter.State.contextTypes);

var State = _.extend({}, ReactRouter.State, {
    getInitialState: function () {
        this._query = this.context.getCurrentQuery();
        this._queryWatches = [];
        return null;
    },
    onQueryChange: function (key, callback) {
        this._queryWatches.push({
            key: key,
            callback: callback
        });
    },
    componentWillReceiveProps: function (nextProps, nextState) {
        var q = this.context.getCurrentQuery();
        for (var i = 0; i < this._queryWatches.length; i++) {
            var watch = this._queryWatches[i];
            if (this._query[watch.key] !== q[watch.key]) {
                watch.callback(this._query[watch.key], q[watch.key], watch.key);
            }
        }
        this._query = q;
    }
});

var Splitter = React.createClass({displayName: "Splitter",
    getDefaultProps: function () {
        return {
            axis: "x"
        };
    },
    getInitialState: function () {
        return {
            applied: false,
            startX: false,
            startY: false
        };
    },
    onMouseDown: function (e) {
        this.setState({
            startX: e.pageX,
            startY: e.pageY
        });
        window.addEventListener("mousemove", this.onMouseMove);
        window.addEventListener("mouseup", this.onMouseUp);
        // Occasionally, only a dragEnd event is triggered, but no mouseUp.
        window.addEventListener("dragend", this.onDragEnd);
    },
    onDragEnd: function () {
        this.getDOMNode().style.transform = "";
        window.removeEventListener("dragend", this.onDragEnd);
        window.removeEventListener("mouseup", this.onMouseUp);
        window.removeEventListener("mousemove", this.onMouseMove);
    },
    onMouseUp: function (e) {
        this.onDragEnd();

        var node = this.getDOMNode();
        var prev = node.previousElementSibling;
        var next = node.nextElementSibling;

        var dX = e.pageX - this.state.startX;
        var dY = e.pageY - this.state.startY;
        var flexBasis;
        if (this.props.axis === "x") {
            flexBasis = prev.offsetWidth + dX;
        } else {
            flexBasis = prev.offsetHeight + dY;
        }

        prev.style.flex = "0 0 " + Math.max(0, flexBasis) + "px";
        next.style.flex = "1 1 auto";

        this.setState({
            applied: true
        });
        this.onResize();
    },
    onMouseMove: function (e) {
        var dX = 0, dY = 0;
        if (this.props.axis === "x") {
            dX = e.pageX - this.state.startX;
        } else {
            dY = e.pageY - this.state.startY;
        }
        this.getDOMNode().style.transform = "translate(" + dX + "px," + dY + "px)";
    },
    onResize: function () {
        // Trigger a global resize event. This notifies components that employ virtual scrolling
        // that their viewport may have changed.
        window.setTimeout(function () {
            window.dispatchEvent(new CustomEvent("resize"));
        }, 1);
    },
    reset: function (willUnmount) {
        if (!this.state.applied) {
            return;
        }
        var node = this.getDOMNode();
        var prev = node.previousElementSibling;
        var next = node.nextElementSibling;

        prev.style.flex = "";
        next.style.flex = "";

        if (!willUnmount) {
            this.setState({
                applied: false
            });
        }
        this.onResize();
    },
    componentWillUnmount: function () {
        this.reset(true);
    },
    render: function () {
        var className = "splitter";
        if (this.props.axis === "x") {
            className += " splitter-x";
        } else {
            className += " splitter-y";
        }
        return (
            React.createElement("div", {className: className}, 
                React.createElement("div", {onMouseDown: this.onMouseDown, draggable: "true"})
            )
        );
    }
});

module.exports = {
    State: State,
    Navigation: Navigation,
    StickyHeadMixin: StickyHeadMixin,
    AutoScrollMixin: AutoScrollMixin,
    Splitter: Splitter
}
},{"lodash":"lodash","react":"react","react-router":"react-router"}],8:[function(require,module,exports){
var React = require("react");
var common = require("./common.js");
var VirtualScrollMixin = require("./virtualscroll.js");
var views = require("../store/view.js");

var LogMessage = React.createClass({displayName: "LogMessage",
    render: function () {
        var entry = this.props.entry;
        var indicator;
        switch (entry.level) {
            case "web":
                indicator = React.createElement("i", {className: "fa fa-fw fa-html5"});
                break;
            case "debug":
                indicator = React.createElement("i", {className: "fa fa-fw fa-bug"});
                break;
            default:
                indicator = React.createElement("i", {className: "fa fa-fw fa-info"});
        }
        return (
            React.createElement("div", null, 
                indicator, " ", entry.message
            )
        );
    },
    shouldComponentUpdate: function () {
        return false; // log entries are immutable.
    }
});

var EventLogContents = React.createClass({displayName: "EventLogContents",
    mixins: [common.AutoScrollMixin, VirtualScrollMixin],
    getInitialState: function () {
        return {
            log: []
        };
    },
    componentWillMount: function () {
        this.openView(this.props.eventStore);
    },
    componentWillUnmount: function () {
        this.closeView();
    },
    openView: function (store) {
        var view = new views.StoreView(store, function (entry) {
            return this.props.filter[entry.level];
        }.bind(this));
        this.setState({
            view: view
        });

        view.addListener("add recalculate", this.onEventLogChange);
    },
    closeView: function () {
        this.state.view.close();
    },
    onEventLogChange: function () {
        this.setState({
            log: this.state.view.list
        });
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.filter !== this.props.filter) {
            this.props.filter = nextProps.filter; // Dirty: Make sure that view filter sees the update.
            this.state.view.recalculate();
        }
        if (nextProps.eventStore !== this.props.eventStore) {
            this.closeView();
            this.openView(nextProps.eventStore);
        }
    },
    getDefaultProps: function () {
        return {
            rowHeight: 45,
            rowHeightMin: 15,
            placeholderTagName: "div"
        };
    },
    renderRow: function (elem) {
        return React.createElement(LogMessage, {key: elem.id, entry: elem});
    },
    render: function () {
        var rows = this.renderRows(this.state.log);

        return React.createElement("pre", {onScroll: this.onScroll}, 
             this.getPlaceholderTop(this.state.log.length), 
            rows, 
             this.getPlaceholderBottom(this.state.log.length) 
        );
    }
});

var ToggleFilter = React.createClass({displayName: "ToggleFilter",
    toggle: function (e) {
        e.preventDefault();
        return this.props.toggleLevel(this.props.name);
    },
    render: function () {
        var className = "label ";
        if (this.props.active) {
            className += "label-primary";
        } else {
            className += "label-default";
        }
        return (
            React.createElement("a", {
                href: "#", 
                className: className, 
                onClick: this.toggle}, 
                this.props.name
            )
        );
    }
});

var EventLog = React.createClass({displayName: "EventLog",
    getInitialState: function () {
        return {
            filter: {
                "debug": false,
                "info": true,
                "web": true
            }
        };
    },
    close: function () {
        var d = {};
        d[Query.SHOW_EVENTLOG] = undefined;
        this.setQuery(d);
    },
    toggleLevel: function (level) {
        var filter = _.extend({}, this.state.filter);
        filter[level] = !filter[level];
        this.setState({filter: filter});
    },
    render: function () {
        return (
            React.createElement("div", {className: "eventlog"}, 
                React.createElement("div", null, 
                    "Eventlog", 
                    React.createElement("div", {className: "pull-right"}, 
                        React.createElement(ToggleFilter, {name: "debug", active: this.state.filter.debug, toggleLevel: this.toggleLevel}), 
                        React.createElement(ToggleFilter, {name: "info", active: this.state.filter.info, toggleLevel: this.toggleLevel}), 
                        React.createElement(ToggleFilter, {name: "web", active: this.state.filter.web, toggleLevel: this.toggleLevel}), 
                        React.createElement("i", {onClick: this.close, className: "fa fa-close"})
                    )

                ), 
                React.createElement(EventLogContents, {filter: this.state.filter, eventStore: this.props.eventStore})
            )
        );
    }
});

module.exports = EventLog;
},{"../store/view.js":22,"./common.js":7,"./virtualscroll.js":16,"react":"react"}],9:[function(require,module,exports){
var React = require("react");
var _ = require("lodash");

var common = require("./common.js");
var actions = require("../actions.js");
var flowutils = require("../flow/utils.js");
var toputils = require("../utils.js");

var NavAction = React.createClass({displayName: "NavAction",
    onClick: function (e) {
        e.preventDefault();
        this.props.onClick();
    },
    render: function () {
        return (
            React.createElement("a", {title: this.props.title, 
                href: "#", 
                className: "nav-action", 
                onClick: this.onClick}, 
                React.createElement("i", {className: "fa fa-fw " + this.props.icon})
            )
        );
    }
});

var FlowDetailNav = React.createClass({displayName: "FlowDetailNav",
    render: function () {
        var flow = this.props.flow;

        var tabs = this.props.tabs.map(function (e) {
            var str = e.charAt(0).toUpperCase() + e.slice(1);
            var className = this.props.active === e ? "active" : "";
            var onClick = function (event) {
                this.props.selectTab(e);
                event.preventDefault();
            }.bind(this);
            return React.createElement("a", {key: e, 
                href: "#", 
                className: className, 
                onClick: onClick}, str);
        }.bind(this));

        var acceptButton = null;
        if(flow.intercepted){
            acceptButton = React.createElement(NavAction, {title: "[a]ccept intercepted flow", icon: "fa-play", onClick: actions.FlowActions.accept.bind(null, flow)});
        }
        var revertButton = null;
        if(flow.modified){
            revertButton = React.createElement(NavAction, {title: "revert changes to flow [V]", icon: "fa-history", onClick: actions.FlowActions.revert.bind(null, flow)});
        }

        return (
            React.createElement("nav", {ref: "head", className: "nav-tabs nav-tabs-sm"}, 
                tabs, 
                React.createElement(NavAction, {title: "[d]elete flow", icon: "fa-trash", onClick: actions.FlowActions.delete.bind(null, flow)}), 
                React.createElement(NavAction, {title: "[D]uplicate flow", icon: "fa-copy", onClick: actions.FlowActions.duplicate.bind(null, flow)}), 
                React.createElement(NavAction, {disabled: true, title: "[r]eplay flow", icon: "fa-repeat", onClick: actions.FlowActions.replay.bind(null, flow)}), 
                acceptButton, 
                revertButton
            )
        );
    }
});

var Headers = React.createClass({displayName: "Headers",
    render: function () {
        var rows = this.props.message.headers.map(function (header, i) {
            return (
                React.createElement("tr", {key: i}, 
                    React.createElement("td", {className: "header-name"}, header[0] + ":"), 
                    React.createElement("td", {className: "header-value"}, header[1])
                )
            );
        });
        return (
            React.createElement("table", {className: "header-table"}, 
                React.createElement("tbody", null, 
                    rows
                )
            )
        );
    }
});

var FlowDetailRequest = React.createClass({displayName: "FlowDetailRequest",
    render: function () {
        var flow = this.props.flow;
        var first_line = [
            flow.request.method,
            flowutils.RequestUtils.pretty_url(flow.request),
            "HTTP/" + flow.request.httpversion.join(".")
        ].join(" ");
        var content = null;
        if (flow.request.contentLength > 0) {
            content = "Request Content Size: " + toputils.formatSize(flow.request.contentLength);
        } else {
            content = React.createElement("div", {className: "alert alert-info"}, "No Content");
        }

        //TODO: Styling

        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "first-line"}, first_line ), 
                React.createElement(Headers, {message: flow.request}), 
                React.createElement("hr", null), 
                content
            )
        );
    }
});

var FlowDetailResponse = React.createClass({displayName: "FlowDetailResponse",
    render: function () {
        var flow = this.props.flow;
        var first_line = [
            "HTTP/" + flow.response.httpversion.join("."),
            flow.response.code,
            flow.response.msg
        ].join(" ");
        var content = null;
        if (flow.response.contentLength > 0) {
            content = "Response Content Size: " + toputils.formatSize(flow.response.contentLength);
        } else {
            content = React.createElement("div", {className: "alert alert-info"}, "No Content");
        }

        //TODO: Styling

        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "first-line"}, first_line ), 
                React.createElement(Headers, {message: flow.response}), 
                React.createElement("hr", null), 
                content
            )
        );
    }
});

var FlowDetailError = React.createClass({displayName: "FlowDetailError",
    render: function () {
        var flow = this.props.flow;
        return (
            React.createElement("section", null, 
                React.createElement("div", {className: "alert alert-warning"}, 
                flow.error.msg, 
                    React.createElement("div", null, 
                        React.createElement("small", null,  toputils.formatTimeStamp(flow.error.timestamp) )
                    )
                )
            )
        );
    }
});

var TimeStamp = React.createClass({displayName: "TimeStamp",
    render: function () {

        if (!this.props.t) {
            //should be return null, but that triggers a React bug.
            return React.createElement("tr", null);
        }

        var ts = toputils.formatTimeStamp(this.props.t);

        var delta;
        if (this.props.deltaTo) {
            delta = toputils.formatTimeDelta(1000 * (this.props.t - this.props.deltaTo));
            delta = React.createElement("span", {className: "text-muted"}, "(" + delta + ")");
        } else {
            delta = null;
        }

        return React.createElement("tr", null, 
            React.createElement("td", null, this.props.title + ":"), 
            React.createElement("td", null, ts, " ", delta)
        );
    }
});

var ConnectionInfo = React.createClass({displayName: "ConnectionInfo",

    render: function () {
        var conn = this.props.conn;
        var address = conn.address.address.join(":");

        var sni = React.createElement("tr", {key: "sni"}); //should be null, but that triggers a React bug.
        if (conn.sni) {
            sni = React.createElement("tr", {key: "sni"}, 
                React.createElement("td", null, 
                    React.createElement("abbr", {title: "TLS Server Name Indication"}, "TLS SNI:")
                ), 
                React.createElement("td", null, conn.sni)
            );
        }
        return (
            React.createElement("table", {className: "connection-table"}, 
                React.createElement("tbody", null, 
                    React.createElement("tr", {key: "address"}, 
                        React.createElement("td", null, "Address:"), 
                        React.createElement("td", null, address)
                    ), 
                    sni
                )
            )
        );
    }
});

var CertificateInfo = React.createClass({displayName: "CertificateInfo",
    render: function () {
        //TODO: We should fetch human-readable certificate representation
        // from the server
        var flow = this.props.flow;
        var client_conn = flow.client_conn;
        var server_conn = flow.server_conn;

        var preStyle = {maxHeight: 100};
        return (
            React.createElement("div", null, 
            client_conn.cert ? React.createElement("h4", null, "Client Certificate") : null, 
            client_conn.cert ? React.createElement("pre", {style: preStyle}, client_conn.cert) : null, 

            server_conn.cert ? React.createElement("h4", null, "Server Certificate") : null, 
            server_conn.cert ? React.createElement("pre", {style: preStyle}, server_conn.cert) : null
            )
        );
    }
});

var Timing = React.createClass({displayName: "Timing",
    render: function () {
        var flow = this.props.flow;
        var sc = flow.server_conn;
        var cc = flow.client_conn;
        var req = flow.request;
        var resp = flow.response;

        var timestamps = [
            {
                title: "Server conn. initiated",
                t: sc.timestamp_start,
                deltaTo: req.timestamp_start
            }, {
                title: "Server conn. TCP handshake",
                t: sc.timestamp_tcp_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "Server conn. SSL handshake",
                t: sc.timestamp_ssl_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "Client conn. established",
                t: cc.timestamp_start,
                deltaTo: req.timestamp_start
            }, {
                title: "Client conn. SSL handshake",
                t: cc.timestamp_ssl_setup,
                deltaTo: req.timestamp_start
            }, {
                title: "First request byte",
                t: req.timestamp_start,
            }, {
                title: "Request complete",
                t: req.timestamp_end,
                deltaTo: req.timestamp_start
            }
        ];

        if (flow.response) {
            timestamps.push(
                {
                    title: "First response byte",
                    t: resp.timestamp_start,
                    deltaTo: req.timestamp_start
                }, {
                    title: "Response complete",
                    t: resp.timestamp_end,
                    deltaTo: req.timestamp_start
                }
            );
        }

        //Add unique key for each row.
        timestamps.forEach(function (e) {
            e.key = e.title;
        });

        timestamps = _.sortBy(timestamps, 't');

        var rows = timestamps.map(function (e) {
            return React.createElement(TimeStamp, React.__spread({},  e));
        });

        return (
            React.createElement("div", null, 
                React.createElement("h4", null, "Timing"), 
                React.createElement("table", {className: "timing-table"}, 
                    React.createElement("tbody", null, 
                    rows
                    )
                )
            )
        );
    }
});

var FlowDetailConnectionInfo = React.createClass({displayName: "FlowDetailConnectionInfo",
    render: function () {
        var flow = this.props.flow;
        var client_conn = flow.client_conn;
        var server_conn = flow.server_conn;
        return (
            React.createElement("section", null, 

                React.createElement("h4", null, "Client Connection"), 
                React.createElement(ConnectionInfo, {conn: client_conn}), 

                React.createElement("h4", null, "Server Connection"), 
                React.createElement(ConnectionInfo, {conn: server_conn}), 

                React.createElement(CertificateInfo, {flow: flow}), 

                React.createElement(Timing, {flow: flow})

            )
        );
    }
});

var allTabs = {
    request: FlowDetailRequest,
    response: FlowDetailResponse,
    error: FlowDetailError,
    details: FlowDetailConnectionInfo
};

var FlowDetail = React.createClass({displayName: "FlowDetail",
    mixins: [common.StickyHeadMixin, common.Navigation, common.State],
    getTabs: function (flow) {
        var tabs = [];
        ["request", "response", "error"].forEach(function (e) {
            if (flow[e]) {
                tabs.push(e);
            }
        });
        tabs.push("details");
        return tabs;
    },
    nextTab: function (i) {
        var tabs = this.getTabs(this.props.flow);
        var currentIndex = tabs.indexOf(this.getParams().detailTab);
        // JS modulo operator doesn't correct negative numbers, make sure that we are positive.
        var nextIndex = (currentIndex + i + tabs.length) % tabs.length;
        this.selectTab(tabs[nextIndex]);
    },
    selectTab: function (panel) {
        this.replaceWith(
            "flow",
            {
                flowId: this.getParams().flowId,
                detailTab: panel
            }
        );
    },
    render: function () {
        var flow = this.props.flow;
        var tabs = this.getTabs(flow);
        var active = this.getParams().detailTab;

        if (!_.contains(tabs, active)) {
            if (active === "response" && flow.error) {
                active = "error";
            } else if (active === "error" && flow.response) {
                active = "response";
            } else {
                active = tabs[0];
            }
            this.selectTab(active);
        }

        var Tab = allTabs[active];
        return (
            React.createElement("div", {className: "flow-detail", onScroll: this.adjustHead}, 
                React.createElement(FlowDetailNav, {ref: "head", 
                    flow: flow, 
                    tabs: tabs, 
                    active: active, 
                    selectTab: this.selectTab}), 
                React.createElement(Tab, {flow: flow})
            )
        );
    }
});

module.exports = {
    FlowDetail: FlowDetail
};
},{"../actions.js":5,"../flow/utils.js":20,"../utils.js":23,"./common.js":7,"lodash":"lodash","react":"react"}],10:[function(require,module,exports){
var React = require("react");
var flowutils = require("../flow/utils.js");
var utils = require("../utils.js");

var TLSColumn = React.createClass({displayName: "TLSColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "tls", className: "col-tls"});
        }
    },
    render: function () {
        var flow = this.props.flow;
        var ssl = (flow.request.scheme == "https");
        var classes;
        if (ssl) {
            classes = "col-tls col-tls-https";
        } else {
            classes = "col-tls col-tls-http";
        }
        return React.createElement("td", {className: classes});
    }
});


var IconColumn = React.createClass({displayName: "IconColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "icon", className: "col-icon"});
        }
    },
    render: function () {
        var flow = this.props.flow;

        var icon;
        if (flow.response) {
            var contentType = flowutils.ResponseUtils.getContentType(flow.response);

            //TODO: We should assign a type to the flow somewhere else.
            if (flow.response.code == 304) {
                icon = "resource-icon-not-modified";
            } else if (300 <= flow.response.code && flow.response.code < 400) {
                icon = "resource-icon-redirect";
            } else if (contentType && contentType.indexOf("image") >= 0) {
                icon = "resource-icon-image";
            } else if (contentType && contentType.indexOf("javascript") >= 0) {
                icon = "resource-icon-js";
            } else if (contentType && contentType.indexOf("css") >= 0) {
                icon = "resource-icon-css";
            } else if (contentType && contentType.indexOf("html") >= 0) {
                icon = "resource-icon-document";
            }
        }
        if (!icon) {
            icon = "resource-icon-plain";
        }


        icon += " resource-icon";
        return React.createElement("td", {className: "col-icon"}, 
            React.createElement("div", {className: icon})
        );
    }
});

var PathColumn = React.createClass({displayName: "PathColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "path", className: "col-path"}, "Path");
        }
    },
    render: function () {
        var flow = this.props.flow;
        return React.createElement("td", {className: "col-path"}, 
            flow.request.is_replay ? React.createElement("i", {className: "fa fa-fw fa-repeat pull-right"}) : null, 
            flow.intercepted ? React.createElement("i", {className: "fa fa-fw fa-pause pull-right"}) : null, 
            flow.request.scheme + "://" + flow.request.host + flow.request.path
        );
    }
});


var MethodColumn = React.createClass({displayName: "MethodColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "method", className: "col-method"}, "Method");
        }
    },
    render: function () {
        var flow = this.props.flow;
        return React.createElement("td", {className: "col-method"}, flow.request.method);
    }
});


var StatusColumn = React.createClass({displayName: "StatusColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "status", className: "col-status"}, "Status");
        }
    },
    render: function () {
        var flow = this.props.flow;
        var status;
        if (flow.response) {
            status = flow.response.code;
        } else {
            status = null;
        }
        return React.createElement("td", {className: "col-status"}, status);
    }
});


var SizeColumn = React.createClass({displayName: "SizeColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "size", className: "col-size"}, "Size");
        }
    },
    render: function () {
        var flow = this.props.flow;

        var total = flow.request.contentLength;
        if (flow.response) {
            total += flow.response.contentLength || 0;
        }
        var size = utils.formatSize(total);
        return React.createElement("td", {className: "col-size"}, size);
    }
});


var TimeColumn = React.createClass({displayName: "TimeColumn",
    statics: {
        renderTitle: function () {
            return React.createElement("th", {key: "time", className: "col-time"}, "Time");
        }
    },
    render: function () {
        var flow = this.props.flow;
        var time;
        if (flow.response) {
            time = utils.formatTimeDelta(1000 * (flow.response.timestamp_end - flow.request.timestamp_start));
        } else {
            time = "...";
        }
        return React.createElement("td", {className: "col-time"}, time);
    }
});


var all_columns = [
    TLSColumn,
    IconColumn,
    PathColumn,
    MethodColumn,
    StatusColumn,
    SizeColumn,
    TimeColumn];


module.exports = all_columns;



},{"../flow/utils.js":20,"../utils.js":23,"react":"react"}],11:[function(require,module,exports){
var React = require("react");
var common = require("./common.js");
var VirtualScrollMixin = require("./virtualscroll.js");
var flowtable_columns = require("./flowtable-columns.js");

var FlowRow = React.createClass({displayName: "FlowRow",
    render: function () {
        var flow = this.props.flow;
        var columns = this.props.columns.map(function (Column) {
            return React.createElement(Column, {key: Column.displayName, flow: flow});
        }.bind(this));
        var className = "";
        if (this.props.selected) {
            className += " selected";
        }
        if (this.props.highlighted) {
            className += " highlighted";
        }
        if (flow.intercepted) {
            className += " intercepted";
        }
        if (flow.request) {
            className += " has-request";
        }
        if (flow.response) {
            className += " has-response";
        }

        return (
            React.createElement("tr", {className: className, onClick: this.props.selectFlow.bind(null, flow)}, 
                columns
            ));
    },
    shouldComponentUpdate: function (nextProps) {
        return true;
        // Further optimization could be done here
        // by calling forceUpdate on flow updates, selection changes and column changes.
        //return (
        //(this.props.columns.length !== nextProps.columns.length) ||
        //(this.props.selected !== nextProps.selected)
        //);
    }
});

var FlowTableHead = React.createClass({displayName: "FlowTableHead",
    render: function () {
        var columns = this.props.columns.map(function (column) {
            return column.renderTitle();
        }.bind(this));
        return React.createElement("thead", null, 
            React.createElement("tr", null, columns)
        );
    }
});


var ROW_HEIGHT = 32;

var FlowTable = React.createClass({displayName: "FlowTable",
    mixins: [common.StickyHeadMixin, common.AutoScrollMixin, VirtualScrollMixin],
    getInitialState: function () {
        return {
            columns: flowtable_columns
        };
    },
    componentWillMount: function () {
        if (this.props.view) {
            this.props.view.addListener("add update remove recalculate", this.onChange);
        }
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.view !== this.props.view) {
            if (this.props.view) {
                this.props.view.removeListener("add update remove recalculate");
            }
            nextProps.view.addListener("add update remove recalculate", this.onChange);
        }
    },
    getDefaultProps: function () {
        return {
            rowHeight: ROW_HEIGHT
        };
    },
    onScrollFlowTable: function () {
        this.adjustHead();
        this.onScroll();
    },
    onChange: function () {
        this.forceUpdate();
    },
    scrollIntoView: function (flow) {
        this.scrollRowIntoView(
            this.props.view.index(flow),
            this.refs.body.getDOMNode().offsetTop
        );
    },
    renderRow: function (flow) {
        var selected = (flow === this.props.selected);
        var highlighted =
            (
            this.props.view._highlight &&
            this.props.view._highlight[flow.id]
            );

        return React.createElement(FlowRow, {key: flow.id, 
            ref: flow.id, 
            flow: flow, 
            columns: this.state.columns, 
            selected: selected, 
            highlighted: highlighted, 
            selectFlow: this.props.selectFlow}
        );
    },
    render: function () {
        //console.log("render flowtable", this.state.start, this.state.stop, this.props.selected);
        var flows = this.props.view ? this.props.view.list : [];

        var rows = this.renderRows(flows);

        return (
            React.createElement("div", {className: "flow-table", onScroll: this.onScrollFlowTable}, 
                React.createElement("table", null, 
                    React.createElement(FlowTableHead, {ref: "head", 
                        columns: this.state.columns}), 
                    React.createElement("tbody", {ref: "body"}, 
                         this.getPlaceholderTop(flows.length), 
                        rows, 
                         this.getPlaceholderBottom(flows.length) 
                    )
                )
            )
        );
    }
});

module.exports = FlowTable;

},{"./common.js":7,"./flowtable-columns.js":10,"./virtualscroll.js":16,"react":"react"}],12:[function(require,module,exports){
var React = require("react");

var Footer = React.createClass({displayName: "Footer",
    render: function () {
        var mode = this.props.settings.mode;
        var intercept = this.props.settings.intercept;
        return (
            React.createElement("footer", null, 
                mode != "regular" ? React.createElement("span", {className: "label label-success"}, mode, " mode") : null, 
                " ", 
                intercept ? React.createElement("span", {className: "label label-success"}, "Intercept: ", intercept) : null
            )
        );
    }
});

module.exports = Footer;
},{"react":"react"}],13:[function(require,module,exports){
var React = require("react");
var $ = require("jquery");

var common = require("./common.js");

var FilterDocs = React.createClass({displayName: "FilterDocs",
    statics: {
        xhr: false,
        doc: false
    },
    componentWillMount: function () {
        if (!FilterDocs.doc) {
            FilterDocs.xhr = $.getJSON("/filter-help").done(function (doc) {
                FilterDocs.doc = doc;
                FilterDocs.xhr = false;
            });
        }
        if (FilterDocs.xhr) {
            FilterDocs.xhr.done(function () {
                this.forceUpdate();
            }.bind(this));
        }
    },
    render: function () {
        if (!FilterDocs.doc) {
            return React.createElement("i", {className: "fa fa-spinner fa-spin"});
        } else {
            var commands = FilterDocs.doc.commands.map(function (c) {
                return React.createElement("tr", null, 
                    React.createElement("td", null, c[0].replace(" ", '\u00a0')), 
                    React.createElement("td", null, c[1])
                );
            });
            commands.push(React.createElement("tr", null, 
                React.createElement("td", {colSpan: "2"}, 
                    React.createElement("a", {href: "https://mitmproxy.org/doc/features/filters.html", 
                        target: "_blank"}, 
                        React.createElement("i", {className: "fa fa-external-link"}), 
                    "  mitmproxy docs")
                )
            ));
            return React.createElement("table", {className: "table table-condensed"}, 
                React.createElement("tbody", null, commands)
            );
        }
    }
});
var FilterInput = React.createClass({displayName: "FilterInput",
    getInitialState: function () {
        // Consider both focus and mouseover for showing/hiding the tooltip,
        // because onBlur of the input is triggered before the click on the tooltip
        // finalized, hiding the tooltip just as the user clicks on it.
        return {
            value: this.props.value,
            focus: false,
            mousefocus: false
        };
    },
    componentWillReceiveProps: function (nextProps) {
        this.setState({value: nextProps.value});
    },
    onChange: function (e) {
        var nextValue = e.target.value;
        this.setState({
            value: nextValue
        });
        // Only propagate valid filters upwards.
        if (this.isValid(nextValue)) {
            this.props.onChange(nextValue);
        }
    },
    isValid: function (filt) {
        try {
            Filt.parse(filt || this.state.value);
            return true;
        } catch (e) {
            return false;
        }
    },
    getDesc: function () {
        var desc;
        try {
            desc = Filt.parse(this.state.value).desc;
        } catch (e) {
            desc = "" + e;
        }
        if (desc !== "true") {
            return desc;
        } else {
            return (
                React.createElement(FilterDocs, null)
            );
        }
    },
    onFocus: function () {
        this.setState({focus: true});
    },
    onBlur: function () {
        this.setState({focus: false});
    },
    onMouseEnter: function () {
        this.setState({mousefocus: true});
    },
    onMouseLeave: function () {
        this.setState({mousefocus: false});
    },
    onKeyDown: function (e) {
        if (e.keyCode === Key.ESC || e.keyCode === Key.ENTER) {
            this.blur();
            // If closed using ESC/ENTER, hide the tooltip.
            this.setState({mousefocus: false});
        }
    },
    blur: function () {
        this.refs.input.getDOMNode().blur();
    },
    focus: function () {
        this.refs.input.getDOMNode().select();
    },
    render: function () {
        var isValid = this.isValid();
        var icon = "fa fa-fw fa-" + this.props.type;
        var groupClassName = "filter-input input-group" + (isValid ? "" : " has-error");

        var popover;
        if (this.state.focus || this.state.mousefocus) {
            popover = (
                React.createElement("div", {className: "popover bottom", onMouseEnter: this.onMouseEnter, onMouseLeave: this.onMouseLeave}, 
                    React.createElement("div", {className: "arrow"}), 
                    React.createElement("div", {className: "popover-content"}, 
                    this.getDesc()
                    )
                )
            );
        }

        return (
            React.createElement("div", {className: groupClassName}, 
                React.createElement("span", {className: "input-group-addon"}, 
                    React.createElement("i", {className: icon, style: {color: this.props.color}})
                ), 
                React.createElement("input", {type: "text", placeholder: this.props.placeholder, className: "form-control", 
                    ref: "input", 
                    onChange: this.onChange, 
                    onFocus: this.onFocus, 
                    onBlur: this.onBlur, 
                    onKeyDown: this.onKeyDown, 
                    value: this.state.value}), 
                popover
            )
        );
    }
});

var MainMenu = React.createClass({displayName: "MainMenu",
    mixins: [common.Navigation, common.State],
    statics: {
        title: "Start",
        route: "flows"
    },
    onFilterChange: function (val) {
        var d = {};
        d[Query.FILTER] = val;
        this.setQuery(d);
    },
    onHighlightChange: function (val) {
        var d = {};
        d[Query.HIGHLIGHT] = val;
        this.setQuery(d);
    },
    onInterceptChange: function (val) {
        SettingsActions.update({intercept: val});
    },
    render: function () {
        var filter = this.getQuery()[Query.FILTER] || "";
        var highlight = this.getQuery()[Query.HIGHLIGHT] || "";
        var intercept = this.props.settings.intercept || "";

        return (
            React.createElement("div", null, 
                React.createElement("div", {className: "menu-row"}, 
                    React.createElement(FilterInput, {
                        placeholder: "Filter", 
                        type: "filter", 
                        color: "black", 
                        value: filter, 
                        onChange: this.onFilterChange}), 
                    React.createElement(FilterInput, {
                        placeholder: "Highlight", 
                        type: "tag", 
                        color: "hsl(48, 100%, 50%)", 
                        value: highlight, 
                        onChange: this.onHighlightChange}), 
                    React.createElement(FilterInput, {
                        placeholder: "Intercept", 
                        type: "pause", 
                        color: "hsl(208, 56%, 53%)", 
                        value: intercept, 
                        onChange: this.onInterceptChange})
                ), 
                React.createElement("div", {className: "clearfix"})
            )
        );
    }
});


var ViewMenu = React.createClass({displayName: "ViewMenu",
    statics: {
        title: "View",
        route: "flows"
    },
    mixins: [common.Navigation, common.State],
    toggleEventLog: function () {
        var d = {};

        if (this.getQuery()[Query.SHOW_EVENTLOG]) {
            d[Query.SHOW_EVENTLOG] = undefined;
        } else {
            d[Query.SHOW_EVENTLOG] = "t"; // any non-false value will do it, keep it short
        }

        this.setQuery(d);
    },
    render: function () {
        var showEventLog = this.getQuery()[Query.SHOW_EVENTLOG];
        return (
            React.createElement("div", null, 
                React.createElement("button", {
                    className: "btn " + (showEventLog ? "btn-primary" : "btn-default"), 
                    onClick: this.toggleEventLog}, 
                    React.createElement("i", {className: "fa fa-database"}), 
                " Show Eventlog"
                ), 
                React.createElement("span", null, " ")
            )
        );
    }
});


var ReportsMenu = React.createClass({displayName: "ReportsMenu",
    statics: {
        title: "Visualization",
        route: "reports"
    },
    render: function () {
        return React.createElement("div", null, "Reports Menu");
    }
});

var FileMenu = React.createClass({displayName: "FileMenu",
    getInitialState: function () {
        return {
            showFileMenu: false
        };
    },
    handleFileClick: function (e) {
        e.preventDefault();
        if (!this.state.showFileMenu) {
            var close = function () {
                this.setState({showFileMenu: false});
                document.removeEventListener("click", close);
            }.bind(this);
            document.addEventListener("click", close);

            this.setState({
                showFileMenu: true
            });
        }
    },
    handleNewClick: function (e) {
        e.preventDefault();
        if (confirm("Delete all flows?")) {
            FlowActions.clear();
        }
    },
    handleOpenClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleOpenClick");
    },
    handleSaveClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleSaveClick");
    },
    handleShutdownClick: function (e) {
        e.preventDefault();
        console.error("unimplemented: handleShutdownClick");
    },
    render: function () {
        var fileMenuClass = "dropdown pull-left" + (this.state.showFileMenu ? " open" : "");

        return (
            React.createElement("div", {className: fileMenuClass}, 
                React.createElement("a", {href: "#", className: "special", onClick: this.handleFileClick}, " mitmproxy "), 
                React.createElement("ul", {className: "dropdown-menu", role: "menu"}, 
                    React.createElement("li", null, 
                        React.createElement("a", {href: "#", onClick: this.handleNewClick}, 
                            React.createElement("i", {className: "fa fa-fw fa-file"}), 
                            "New"
                        )
                    ), 
                    React.createElement("li", {role: "presentation", className: "divider"}), 
                    React.createElement("li", null, 
                        React.createElement("a", {href: "http://mitm.it/", target: "_blank"}, 
                            React.createElement("i", {className: "fa fa-fw fa-external-link"}), 
                            "Install Certificates..."
                        )
                    )
                /*
                 <li>
                 <a href="#" onClick={this.handleOpenClick}>
                 <i className="fa fa-fw fa-folder-open"></i>
                 Open
                 </a>
                 </li>
                 <li>
                 <a href="#" onClick={this.handleSaveClick}>
                 <i className="fa fa-fw fa-save"></i>
                 Save
                 </a>
                 </li>
                 <li role="presentation" className="divider"></li>
                 <li>
                 <a href="#" onClick={this.handleShutdownClick}>
                 <i className="fa fa-fw fa-plug"></i>
                 Shutdown
                 </a>
                 </li>
                 */
                )
            )
        );
    }
});


var header_entries = [MainMenu, ViewMenu /*, ReportsMenu */];


var Header = React.createClass({displayName: "Header",
    mixins: [common.Navigation],
    getInitialState: function () {
        return {
            active: header_entries[0]
        };
    },
    handleClick: function (active, e) {
        e.preventDefault();
        this.replaceWith(active.route);
        this.setState({active: active});
    },
    render: function () {
        var header = header_entries.map(function (entry, i) {
            var classes = React.addons.classSet({
                active: entry == this.state.active
            });
            return (
                React.createElement("a", {key: i, 
                    href: "#", 
                    className: classes, 
                    onClick: this.handleClick.bind(this, entry)
                }, 
                     entry.title
                )
            );
        }.bind(this));

        return (
            React.createElement("header", null, 
                React.createElement("nav", {className: "nav-tabs nav-tabs-lg"}, 
                    React.createElement(FileMenu, null), 
                    header
                ), 
                React.createElement("div", {className: "menu"}, 
                    React.createElement(this.state.active, {settings: this.props.settings})
                )
            )
        );
    }
});


module.exports = {
    Header: Header
}
},{"./common.js":7,"jquery":"jquery","react":"react"}],14:[function(require,module,exports){
var React = require("react");

var common = require("./common.js");
var toputils = require("../utils.js");
var views = require("../store/view.js");
var Filt = require("../filt/filt.js");
FlowTable = require("./flowtable.js");
var flowdetail = require("./flowdetail.js");


var MainView = React.createClass({displayName: "MainView",
    mixins: [common.Navigation, common.State],
    getInitialState: function () {
        this.onQueryChange(Query.FILTER, function () {
            this.state.view.recalculate(this.getViewFilt(), this.getViewSort());
        }.bind(this));
        this.onQueryChange(Query.HIGHLIGHT, function () {
            this.state.view.recalculate(this.getViewFilt(), this.getViewSort());
        }.bind(this));
        return {
            flows: []
        };
    },
    getViewFilt: function () {
        try {
            var filt = Filt.parse(this.getQuery()[Query.FILTER] || "");
            var highlightStr = this.getQuery()[Query.HIGHLIGHT];
            var highlight = highlightStr ? Filt.parse(highlightStr) : false;
        } catch (e) {
            console.error("Error when processing filter: " + e);
        }

        return function filter_and_highlight(flow) {
            if (!this._highlight) {
                this._highlight = {};
            }
            this._highlight[flow.id] = highlight && highlight(flow);
            return filt(flow);
        };
    },
    getViewSort: function () {
    },
    componentWillReceiveProps: function (nextProps) {
        if (nextProps.flowStore !== this.props.flowStore) {
            this.closeView();
            this.openView(nextProps.flowStore);
        }
    },
    openView: function (store) {
        var view = new views.StoreView(store, this.getViewFilt(), this.getViewSort());
        this.setState({
            view: view
        });

        view.addListener("recalculate", this.onRecalculate);
        view.addListener("add update remove", this.onUpdate);
        view.addListener("remove", this.onRemove);
    },
    onRecalculate: function () {
        this.forceUpdate();
        var selected = this.getSelected();
        if (selected) {
            this.refs.flowTable.scrollIntoView(selected);
        }
    },
    onUpdate: function (flow) {
        if (flow.id === this.getParams().flowId) {
            this.forceUpdate();
        }
    },
    onRemove: function (flow_id, index) {
        if (flow_id === this.getParams().flowId) {
            var flow_to_select = this.state.view.list[Math.min(index, this.state.view.list.length -1)];
            this.selectFlow(flow_to_select);
        }
    },
    closeView: function () {
        this.state.view.close();
    },
    componentWillMount: function () {
        this.openView(this.props.flowStore);
    },
    componentWillUnmount: function () {
        this.closeView();
    },
    selectFlow: function (flow) {
        if (flow) {
            this.replaceWith(
                "flow",
                {
                    flowId: flow.id,
                    detailTab: this.getParams().detailTab || "request"
                }
            );
            this.refs.flowTable.scrollIntoView(flow);
        } else {
            this.replaceWith("flows", {});
        }
    },
    selectFlowRelative: function (shift) {
        var flows = this.state.view.list;
        var index;
        if (!this.getParams().flowId) {
            if (shift > 0) {
                index = flows.length - 1;
            } else {
                index = 0;
            }
        } else {
            var currFlowId = this.getParams().flowId;
            var i = flows.length;
            while (i--) {
                if (flows[i].id === currFlowId) {
                    index = i;
                    break;
                }
            }
            index = Math.min(
                Math.max(0, index + shift),
                flows.length - 1);
        }
        this.selectFlow(flows[index]);
    },
    onKeyDown: function (e) {
        var flow = this.getSelected();
        if (e.ctrlKey) {
            return;
        }
        switch (e.keyCode) {
            case toputils.Key.K:
            case toputils.Key.UP:
                this.selectFlowRelative(-1);
                break;
            case toputils.Key.J:
            case toputils.Key.DOWN:
                this.selectFlowRelative(+1);
                break;
            case toputils.Key.SPACE:
            case toputils.Key.PAGE_DOWN:
                this.selectFlowRelative(+10);
                break;
            case toputils.Key.PAGE_UP:
                this.selectFlowRelative(-10);
                break;
            case toputils.Key.END:
                this.selectFlowRelative(+1e10);
                break;
            case toputils.Key.HOME:
                this.selectFlowRelative(-1e10);
                break;
            case toputils.Key.ESC:
                this.selectFlow(null);
                break;
            case toputils.Key.H:
            case toputils.Key.LEFT:
                if (this.refs.flowDetails) {
                    this.refs.flowDetails.nextTab(-1);
                }
                break;
            case toputils.Key.L:
            case toputils.Key.TAB:
            case toputils.Key.RIGHT:
                if (this.refs.flowDetails) {
                    this.refs.flowDetails.nextTab(+1);
                }
                break;
            case toputils.Key.C:
                if (e.shiftKey) {
                    FlowActions.clear();
                }
                break;
            case toputils.Key.D:
                if (flow) {
                    if (e.shiftKey) {
                        FlowActions.duplicate(flow);
                    } else {
                        FlowActions.delete(flow);
                    }
                }
                break;
            case toputils.Key.A:
                if (e.shiftKey) {
                    FlowActions.accept_all();
                } else if (flow && flow.intercepted) {
                    FlowActions.accept(flow);
                }
                break;
            case toputils.Key.R:
                if (!e.shiftKey && flow) {
                    FlowActions.replay(flow);
                }
                break;
            case toputils.Key.V:
                if(e.shiftKey && flow && flow.modified) {
                    FlowActions.revert(flow);
                }
                break;
            default:
                console.debug("keydown", e.keyCode);
                return;
        }
        e.preventDefault();
    },
    getSelected: function () {
        return this.props.flowStore.get(this.getParams().flowId);
    },
    render: function () {
        var selected = this.getSelected();

        var details;
        if (selected) {
            details = [
                React.createElement(common.Splitter, {key: "splitter"}),
                React.createElement(flowdetail.FlowDetail, {key: "flowDetails", ref: "flowDetails", flow: selected})
            ];
        } else {
            details = null;
        }

        return (
            React.createElement("div", {className: "main-view", onKeyDown: this.onKeyDown, tabIndex: "0"}, 
                React.createElement(FlowTable, {ref: "flowTable", 
                    view: this.state.view, 
                    selectFlow: this.selectFlow, 
                    selected: selected}), 
                details
            )
        );
    }
});

module.exports = MainView;

},{"../filt/filt.js":19,"../store/view.js":22,"../utils.js":23,"./common.js":7,"./flowdetail.js":9,"./flowtable.js":11,"react":"react"}],15:[function(require,module,exports){
var React = require("react");
var ReactRouter = require("react-router");
var _ = require("lodash");

var common = require("./common.js");
var MainView = require("./mainview.js");
var Footer = require("./footer.js");
var header = require("./header.js");
var EventLog = require("./eventlog.js");
var store = require("../store/store.js");


//TODO: Move out of here, just a stub.
var Reports = React.createClass({displayName: "Reports",
    render: function () {
        return React.createElement("div", null, "ReportEditor");
    }
});


var ProxyAppMain = React.createClass({displayName: "ProxyAppMain",
    mixins: [common.State],
    getInitialState: function () {
        var eventStore = new store.EventLogStore();
        var flowStore = new store.FlowStore();
        var settings = new store.SettingsStore();

        // Default Settings before fetch
        _.extend(settings.dict,{
        });
        return {
            settings: settings,
            flowStore: flowStore,
            eventStore: eventStore
        };
    },
    componentDidMount: function () {
        this.state.settings.addListener("recalculate", this.onSettingsChange);
        window.app = this;
    },
    componentWillUnmount: function () {
        this.state.settings.removeListener("recalculate", this.onSettingsChange);
    },
    onSettingsChange: function(){
        this.setState({
            settings: this.state.settings
        });
    },
    render: function () {

        var eventlog;
        if (this.getQuery()[Query.SHOW_EVENTLOG]) {
            eventlog = [
                React.createElement(common.Splitter, {key: "splitter", axis: "y"}),
                React.createElement(EventLog, {key: "eventlog", eventStore: this.state.eventStore})
            ];
        } else {
            eventlog = null;
        }

        return (
            React.createElement("div", {id: "container"}, 
                React.createElement(header.Header, {settings: this.state.settings.dict}), 
                React.createElement(RouteHandler, {settings: this.state.settings.dict, flowStore: this.state.flowStore}), 
                eventlog, 
                React.createElement(Footer, {settings: this.state.settings.dict})
            )
        );
    }
});


var Route = ReactRouter.Route;
var RouteHandler = ReactRouter.RouteHandler;
var Redirect = ReactRouter.Redirect;
var DefaultRoute = ReactRouter.DefaultRoute;
var NotFoundRoute = ReactRouter.NotFoundRoute;


var routes = (
    React.createElement(Route, {path: "/", handler: ProxyAppMain}, 
        React.createElement(Route, {name: "flows", path: "flows", handler: MainView}), 
        React.createElement(Route, {name: "flow", path: "flows/:flowId/:detailTab", handler: MainView}), 
        React.createElement(Route, {name: "reports", handler: Reports}), 
        React.createElement(Redirect, {path: "/", to: "flows"})
    )
);

module.exports = {
    routes: routes
};


},{"../store/store.js":21,"./common.js":7,"./eventlog.js":8,"./footer.js":12,"./header.js":13,"./mainview.js":14,"lodash":"lodash","react":"react","react-router":"react-router"}],16:[function(require,module,exports){
var React = require("react");

var VirtualScrollMixin = {
    getInitialState: function () {
        return {
            start: 0,
            stop: 0
        };
    },
    componentWillMount: function () {
        if (!this.props.rowHeight) {
            console.warn("VirtualScrollMixin: No rowHeight specified", this);
        }
    },
    getPlaceholderTop: function (total) {
        var Tag = this.props.placeholderTagName || "tr";
        // When a large trunk of elements is removed from the button, start may be far off the viewport.
        // To make this issue less severe, limit the top placeholder to the total number of rows.
        var style = {
            height: Math.min(this.state.start, total) * this.props.rowHeight
        };
        var spacer = React.createElement(Tag, {key: "placeholder-top", style: style});

        if (this.state.start % 2 === 1) {
            // fix even/odd rows
            return [spacer, React.createElement(Tag, {key: "placeholder-top-2"})];
        } else {
            return spacer;
        }
    },
    getPlaceholderBottom: function (total) {
        var Tag = this.props.placeholderTagName || "tr";
        var style = {
            height: Math.max(0, total - this.state.stop) * this.props.rowHeight
        };
        return React.createElement(Tag, {key: "placeholder-bottom", style: style});
    },
    componentDidMount: function () {
        this.onScroll();
        window.addEventListener('resize', this.onScroll);
    },
    componentWillUnmount: function(){
        window.removeEventListener('resize', this.onScroll);
    },
    onScroll: function () {
        var viewport = this.getDOMNode();
        var top = viewport.scrollTop;
        var height = viewport.offsetHeight;
        var start = Math.floor(top / this.props.rowHeight);
        var stop = start + Math.ceil(height / (this.props.rowHeightMin || this.props.rowHeight));

        this.setState({
            start: start,
            stop: stop
        });
    },
    renderRows: function (elems) {
        var rows = [];
        var max = Math.min(elems.length, this.state.stop);

        for (var i = this.state.start; i < max; i++) {
            var elem = elems[i];
            rows.push(this.renderRow(elem));
        }
        return rows;
    },
    scrollRowIntoView: function (index, head_height) {

        var row_top = (index * this.props.rowHeight) + head_height;
        var row_bottom = row_top + this.props.rowHeight;

        var viewport = this.getDOMNode();
        var viewport_top = viewport.scrollTop;
        var viewport_bottom = viewport_top + viewport.offsetHeight;

        // Account for pinned thead
        if (row_top - head_height < viewport_top) {
            viewport.scrollTop = row_top - head_height;
        } else if (row_bottom > viewport_bottom) {
            viewport.scrollTop = row_bottom - viewport.offsetHeight;
        }
    },
};

module.exports  = VirtualScrollMixin;
},{"react":"react"}],17:[function(require,module,exports){

var actions = require("./actions.js");

function Connection(url) {
    if (url[0] === "/") {
        url = location.origin.replace("http", "ws") + url;
    }

    var ws = new WebSocket(url);
    ws.onopen = function () {
        actions.ConnectionActions.open();
    };
    ws.onmessage = function (message) {
        var m = JSON.parse(message.data);
        AppDispatcher.dispatchServerAction(m);
    };
    ws.onerror = function () {
        actions.ConnectionActions.error();
        EventLogActions.add_event("WebSocket connection error.");
    };
    ws.onclose = function () {
        actions.ConnectionActions.close();
        EventLogActions.add_event("WebSocket connection closed.");
    };
    return ws;
}

module.exports = Connection;
},{"./actions.js":5}],18:[function(require,module,exports){

var flux = require("flux");

const PayloadSources = {
    VIEW: "view",
    SERVER: "server"
};


AppDispatcher = new flux.Dispatcher();
AppDispatcher.dispatchViewAction = function (action) {
    action.source = PayloadSources.VIEW;
    this.dispatch(action);
};
AppDispatcher.dispatchServerAction = function (action) {
    action.source = PayloadSources.SERVER;
    this.dispatch(action);
};

module.exports = {
    AppDispatcher: AppDispatcher
};
},{"flux":2}],19:[function(require,module,exports){
/* jshint ignore:start */
Filt = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleFunctions = { start: peg$parsestart },
        peg$startRuleFunction  = peg$parsestart,

        peg$c0 = { type: "other", description: "filter expression" },
        peg$c1 = peg$FAILED,
        peg$c2 = function(orExpr) { return orExpr; },
        peg$c3 = [],
        peg$c4 = function() {return trueFilter; },
        peg$c5 = { type: "other", description: "whitespace" },
        peg$c6 = /^[ \t\n\r]/,
        peg$c7 = { type: "class", value: "[ \\t\\n\\r]", description: "[ \\t\\n\\r]" },
        peg$c8 = { type: "other", description: "control character" },
        peg$c9 = /^[|&!()~"]/,
        peg$c10 = { type: "class", value: "[|&!()~\"]", description: "[|&!()~\"]" },
        peg$c11 = { type: "other", description: "optional whitespace" },
        peg$c12 = "|",
        peg$c13 = { type: "literal", value: "|", description: "\"|\"" },
        peg$c14 = function(first, second) { return or(first, second); },
        peg$c15 = "&",
        peg$c16 = { type: "literal", value: "&", description: "\"&\"" },
        peg$c17 = function(first, second) { return and(first, second); },
        peg$c18 = "!",
        peg$c19 = { type: "literal", value: "!", description: "\"!\"" },
        peg$c20 = function(expr) { return not(expr); },
        peg$c21 = "(",
        peg$c22 = { type: "literal", value: "(", description: "\"(\"" },
        peg$c23 = ")",
        peg$c24 = { type: "literal", value: ")", description: "\")\"" },
        peg$c25 = function(expr) { return binding(expr); },
        peg$c26 = "~a",
        peg$c27 = { type: "literal", value: "~a", description: "\"~a\"" },
        peg$c28 = function() { return assetFilter; },
        peg$c29 = "~e",
        peg$c30 = { type: "literal", value: "~e", description: "\"~e\"" },
        peg$c31 = function() { return errorFilter; },
        peg$c32 = "~q",
        peg$c33 = { type: "literal", value: "~q", description: "\"~q\"" },
        peg$c34 = function() { return noResponseFilter; },
        peg$c35 = "~s",
        peg$c36 = { type: "literal", value: "~s", description: "\"~s\"" },
        peg$c37 = function() { return responseFilter; },
        peg$c38 = "true",
        peg$c39 = { type: "literal", value: "true", description: "\"true\"" },
        peg$c40 = function() { return trueFilter; },
        peg$c41 = "false",
        peg$c42 = { type: "literal", value: "false", description: "\"false\"" },
        peg$c43 = function() { return falseFilter; },
        peg$c44 = "~c",
        peg$c45 = { type: "literal", value: "~c", description: "\"~c\"" },
        peg$c46 = function(s) { return responseCode(s); },
        peg$c47 = "~d",
        peg$c48 = { type: "literal", value: "~d", description: "\"~d\"" },
        peg$c49 = function(s) { return domain(s); },
        peg$c50 = "~h",
        peg$c51 = { type: "literal", value: "~h", description: "\"~h\"" },
        peg$c52 = function(s) { return header(s); },
        peg$c53 = "~hq",
        peg$c54 = { type: "literal", value: "~hq", description: "\"~hq\"" },
        peg$c55 = function(s) { return requestHeader(s); },
        peg$c56 = "~hs",
        peg$c57 = { type: "literal", value: "~hs", description: "\"~hs\"" },
        peg$c58 = function(s) { return responseHeader(s); },
        peg$c59 = "~m",
        peg$c60 = { type: "literal", value: "~m", description: "\"~m\"" },
        peg$c61 = function(s) { return method(s); },
        peg$c62 = "~t",
        peg$c63 = { type: "literal", value: "~t", description: "\"~t\"" },
        peg$c64 = function(s) { return contentType(s); },
        peg$c65 = "~tq",
        peg$c66 = { type: "literal", value: "~tq", description: "\"~tq\"" },
        peg$c67 = function(s) { return requestContentType(s); },
        peg$c68 = "~ts",
        peg$c69 = { type: "literal", value: "~ts", description: "\"~ts\"" },
        peg$c70 = function(s) { return responseContentType(s); },
        peg$c71 = "~u",
        peg$c72 = { type: "literal", value: "~u", description: "\"~u\"" },
        peg$c73 = function(s) { return url(s); },
        peg$c74 = { type: "other", description: "integer" },
        peg$c75 = null,
        peg$c76 = /^['"]/,
        peg$c77 = { type: "class", value: "['\"]", description: "['\"]" },
        peg$c78 = /^[0-9]/,
        peg$c79 = { type: "class", value: "[0-9]", description: "[0-9]" },
        peg$c80 = function(digits) { return parseInt(digits.join(""), 10); },
        peg$c81 = { type: "other", description: "string" },
        peg$c82 = "\"",
        peg$c83 = { type: "literal", value: "\"", description: "\"\\\"\"" },
        peg$c84 = function(chars) { return chars.join(""); },
        peg$c85 = "'",
        peg$c86 = { type: "literal", value: "'", description: "\"'\"" },
        peg$c87 = void 0,
        peg$c88 = /^["\\]/,
        peg$c89 = { type: "class", value: "[\"\\\\]", description: "[\"\\\\]" },
        peg$c90 = { type: "any", description: "any character" },
        peg$c91 = function(char) { return char; },
        peg$c92 = "\\",
        peg$c93 = { type: "literal", value: "\\", description: "\"\\\\\"" },
        peg$c94 = /^['\\]/,
        peg$c95 = { type: "class", value: "['\\\\]", description: "['\\\\]" },
        peg$c96 = /^['"\\]/,
        peg$c97 = { type: "class", value: "['\"\\\\]", description: "['\"\\\\]" },
        peg$c98 = "n",
        peg$c99 = { type: "literal", value: "n", description: "\"n\"" },
        peg$c100 = function() { return "\n"; },
        peg$c101 = "r",
        peg$c102 = { type: "literal", value: "r", description: "\"r\"" },
        peg$c103 = function() { return "\r"; },
        peg$c104 = "t",
        peg$c105 = { type: "literal", value: "t", description: "\"t\"" },
        peg$c106 = function() { return "\t"; },

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$parsestart() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parse__();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseOrExpr();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse__();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c2(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = [];
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c4();
        }
        s0 = s1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c0); }
      }

      return s0;
    }

    function peg$parsews() {
      var s0, s1;

      peg$silentFails++;
      if (peg$c6.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c7); }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c5); }
      }

      return s0;
    }

    function peg$parsecc() {
      var s0, s1;

      peg$silentFails++;
      if (peg$c9.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c10); }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c8); }
      }

      return s0;
    }

    function peg$parse__() {
      var s0, s1;

      peg$silentFails++;
      s0 = [];
      s1 = peg$parsews();
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$parsews();
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c11); }
      }

      return s0;
    }

    function peg$parseOrExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$parseAndExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 124) {
            s3 = peg$c12;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c13); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseOrExpr();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c14(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseAndExpr();
      }

      return s0;
    }

    function peg$parseAndExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$parseNotExpr();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 38) {
            s3 = peg$c15;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c16); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseAndExpr();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c17(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseNotExpr();
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parsews();
            }
          } else {
            s2 = peg$c1;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseAndExpr();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c17(s1, s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseNotExpr();
        }
      }

      return s0;
    }

    function peg$parseNotExpr() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 33) {
        s1 = peg$c18;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c19); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseNotExpr();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c20(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseBindingExpr();
      }

      return s0;
    }

    function peg$parseBindingExpr() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 40) {
        s1 = peg$c21;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c22); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseOrExpr();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse__();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 41) {
                s5 = peg$c23;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c24); }
              }
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c25(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseExpr();
      }

      return s0;
    }

    function peg$parseExpr() {
      var s0;

      s0 = peg$parseNullaryExpr();
      if (s0 === peg$FAILED) {
        s0 = peg$parseUnaryExpr();
      }

      return s0;
    }

    function peg$parseNullaryExpr() {
      var s0, s1;

      s0 = peg$parseBooleanLiteral();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c26) {
          s1 = peg$c26;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c27); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c28();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c29) {
            s1 = peg$c29;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c30); }
          }
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c31();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 2) === peg$c32) {
              s1 = peg$c32;
              peg$currPos += 2;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c33); }
            }
            if (s1 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c34();
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 2) === peg$c35) {
                s1 = peg$c35;
                peg$currPos += 2;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c36); }
              }
              if (s1 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c37();
              }
              s0 = s1;
            }
          }
        }
      }

      return s0;
    }

    function peg$parseBooleanLiteral() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c38) {
        s1 = peg$c38;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c39); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c40();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c41) {
          s1 = peg$c41;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c42); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c43();
        }
        s0 = s1;
      }

      return s0;
    }

    function peg$parseUnaryExpr() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c44) {
        s1 = peg$c44;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c45); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parsews();
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parsews();
          }
        } else {
          s2 = peg$c1;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parseIntegerLiteral();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c46(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c47) {
          s1 = peg$c47;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c48); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parsews();
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parsews();
            }
          } else {
            s2 = peg$c1;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseStringLiteral();
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c49(s3);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2) === peg$c50) {
            s1 = peg$c50;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c51); }
          }
          if (s1 !== peg$FAILED) {
            s2 = [];
            s3 = peg$parsews();
            if (s3 !== peg$FAILED) {
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parsews();
              }
            } else {
              s2 = peg$c1;
            }
            if (s2 !== peg$FAILED) {
              s3 = peg$parseStringLiteral();
              if (s3 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c52(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 3) === peg$c53) {
              s1 = peg$c53;
              peg$currPos += 3;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c54); }
            }
            if (s1 !== peg$FAILED) {
              s2 = [];
              s3 = peg$parsews();
              if (s3 !== peg$FAILED) {
                while (s3 !== peg$FAILED) {
                  s2.push(s3);
                  s3 = peg$parsews();
                }
              } else {
                s2 = peg$c1;
              }
              if (s2 !== peg$FAILED) {
                s3 = peg$parseStringLiteral();
                if (s3 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c55(s3);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 3) === peg$c56) {
                s1 = peg$c56;
                peg$currPos += 3;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c57); }
              }
              if (s1 !== peg$FAILED) {
                s2 = [];
                s3 = peg$parsews();
                if (s3 !== peg$FAILED) {
                  while (s3 !== peg$FAILED) {
                    s2.push(s3);
                    s3 = peg$parsews();
                  }
                } else {
                  s2 = peg$c1;
                }
                if (s2 !== peg$FAILED) {
                  s3 = peg$parseStringLiteral();
                  if (s3 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c58(s3);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c1;
              }
              if (s0 === peg$FAILED) {
                s0 = peg$currPos;
                if (input.substr(peg$currPos, 2) === peg$c59) {
                  s1 = peg$c59;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c60); }
                }
                if (s1 !== peg$FAILED) {
                  s2 = [];
                  s3 = peg$parsews();
                  if (s3 !== peg$FAILED) {
                    while (s3 !== peg$FAILED) {
                      s2.push(s3);
                      s3 = peg$parsews();
                    }
                  } else {
                    s2 = peg$c1;
                  }
                  if (s2 !== peg$FAILED) {
                    s3 = peg$parseStringLiteral();
                    if (s3 !== peg$FAILED) {
                      peg$reportedPos = s0;
                      s1 = peg$c61(s3);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c1;
                }
                if (s0 === peg$FAILED) {
                  s0 = peg$currPos;
                  if (input.substr(peg$currPos, 2) === peg$c62) {
                    s1 = peg$c62;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c63); }
                  }
                  if (s1 !== peg$FAILED) {
                    s2 = [];
                    s3 = peg$parsews();
                    if (s3 !== peg$FAILED) {
                      while (s3 !== peg$FAILED) {
                        s2.push(s3);
                        s3 = peg$parsews();
                      }
                    } else {
                      s2 = peg$c1;
                    }
                    if (s2 !== peg$FAILED) {
                      s3 = peg$parseStringLiteral();
                      if (s3 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c64(s3);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c1;
                  }
                  if (s0 === peg$FAILED) {
                    s0 = peg$currPos;
                    if (input.substr(peg$currPos, 3) === peg$c65) {
                      s1 = peg$c65;
                      peg$currPos += 3;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c66); }
                    }
                    if (s1 !== peg$FAILED) {
                      s2 = [];
                      s3 = peg$parsews();
                      if (s3 !== peg$FAILED) {
                        while (s3 !== peg$FAILED) {
                          s2.push(s3);
                          s3 = peg$parsews();
                        }
                      } else {
                        s2 = peg$c1;
                      }
                      if (s2 !== peg$FAILED) {
                        s3 = peg$parseStringLiteral();
                        if (s3 !== peg$FAILED) {
                          peg$reportedPos = s0;
                          s1 = peg$c67(s3);
                          s0 = s1;
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c1;
                    }
                    if (s0 === peg$FAILED) {
                      s0 = peg$currPos;
                      if (input.substr(peg$currPos, 3) === peg$c68) {
                        s1 = peg$c68;
                        peg$currPos += 3;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c69); }
                      }
                      if (s1 !== peg$FAILED) {
                        s2 = [];
                        s3 = peg$parsews();
                        if (s3 !== peg$FAILED) {
                          while (s3 !== peg$FAILED) {
                            s2.push(s3);
                            s3 = peg$parsews();
                          }
                        } else {
                          s2 = peg$c1;
                        }
                        if (s2 !== peg$FAILED) {
                          s3 = peg$parseStringLiteral();
                          if (s3 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c70(s3);
                            s0 = s1;
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c1;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c1;
                      }
                      if (s0 === peg$FAILED) {
                        s0 = peg$currPos;
                        if (input.substr(peg$currPos, 2) === peg$c71) {
                          s1 = peg$c71;
                          peg$currPos += 2;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c72); }
                        }
                        if (s1 !== peg$FAILED) {
                          s2 = [];
                          s3 = peg$parsews();
                          if (s3 !== peg$FAILED) {
                            while (s3 !== peg$FAILED) {
                              s2.push(s3);
                              s3 = peg$parsews();
                            }
                          } else {
                            s2 = peg$c1;
                          }
                          if (s2 !== peg$FAILED) {
                            s3 = peg$parseStringLiteral();
                            if (s3 !== peg$FAILED) {
                              peg$reportedPos = s0;
                              s1 = peg$c73(s3);
                              s0 = s1;
                            } else {
                              peg$currPos = s0;
                              s0 = peg$c1;
                            }
                          } else {
                            peg$currPos = s0;
                            s0 = peg$c1;
                          }
                        } else {
                          peg$currPos = s0;
                          s0 = peg$c1;
                        }
                        if (s0 === peg$FAILED) {
                          s0 = peg$currPos;
                          s1 = peg$parseStringLiteral();
                          if (s1 !== peg$FAILED) {
                            peg$reportedPos = s0;
                            s1 = peg$c73(s1);
                          }
                          s0 = s1;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      return s0;
    }

    function peg$parseIntegerLiteral() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      if (peg$c76.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c77); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$c75;
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c78.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c79); }
        }
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            if (peg$c78.test(input.charAt(peg$currPos))) {
              s3 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c79); }
            }
          }
        } else {
          s2 = peg$c1;
        }
        if (s2 !== peg$FAILED) {
          if (peg$c76.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c77); }
          }
          if (s3 === peg$FAILED) {
            s3 = peg$c75;
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c80(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c74); }
      }

      return s0;
    }

    function peg$parseStringLiteral() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 34) {
        s1 = peg$c82;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c83); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parseDoubleStringChar();
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parseDoubleStringChar();
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 34) {
            s3 = peg$c82;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c83); }
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c84(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s1 = peg$c85;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c86); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parseSingleStringChar();
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parseSingleStringChar();
          }
          if (s2 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s3 = peg$c85;
              peg$currPos++;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c86); }
            }
            if (s3 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$currPos;
          peg$silentFails++;
          s2 = peg$parsecc();
          peg$silentFails--;
          if (s2 === peg$FAILED) {
            s1 = peg$c87;
          } else {
            peg$currPos = s1;
            s1 = peg$c1;
          }
          if (s1 !== peg$FAILED) {
            s2 = [];
            s3 = peg$parseUnquotedStringChar();
            if (s3 !== peg$FAILED) {
              while (s3 !== peg$FAILED) {
                s2.push(s3);
                s3 = peg$parseUnquotedStringChar();
              }
            } else {
              s2 = peg$c1;
            }
            if (s2 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c84(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c1;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        }
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c81); }
      }

      return s0;
    }

    function peg$parseDoubleStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      if (peg$c88.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c89); }
      }
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c92;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c93); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEscapeSequence();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c91(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      }

      return s0;
    }

    function peg$parseSingleStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      if (peg$c94.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c95); }
      }
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c92;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c93); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEscapeSequence();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c91(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c1;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      }

      return s0;
    }

    function peg$parseUnquotedStringChar() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      s2 = peg$parsews();
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c87;
      } else {
        peg$currPos = s1;
        s1 = peg$c1;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c91(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c1;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c1;
      }

      return s0;
    }

    function peg$parseEscapeSequence() {
      var s0, s1;

      if (peg$c96.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c97); }
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 110) {
          s1 = peg$c98;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c99); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c100();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 114) {
            s1 = peg$c101;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c102); }
          }
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c103();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 116) {
              s1 = peg$c104;
              peg$currPos++;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c105); }
            }
            if (s1 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c106();
            }
            s0 = s1;
          }
        }
      }

      return s0;
    }


    function or(first, second) {
        // Add explicit function names to ease debugging.
        function orFilter() {
            return first.apply(this, arguments) || second.apply(this, arguments);
        }
        orFilter.desc = first.desc + " or " + second.desc;
        return orFilter;
    }
    function and(first, second) {
        function andFilter() {
            return first.apply(this, arguments) && second.apply(this, arguments);
        }
        andFilter.desc = first.desc + " and " + second.desc;
        return andFilter;
    }
    function not(expr) {
        function notFilter() {
            return !expr.apply(this, arguments);
        }
        notFilter.desc = "not " + expr.desc;
        return notFilter;
    }
    function binding(expr) {
        function bindingFilter() {
            return expr.apply(this, arguments);
        }
        bindingFilter.desc = "(" + expr.desc + ")";
        return bindingFilter;
    }
    function trueFilter(flow) {
        return true;
    }
    trueFilter.desc = "true";
    function falseFilter(flow) {
        return false;
    }
    falseFilter.desc = "false";

    var ASSET_TYPES = [
        new RegExp("text/javascript"),
        new RegExp("application/x-javascript"),
        new RegExp("application/javascript"),
        new RegExp("text/css"),
        new RegExp("image/.*"),
        new RegExp("application/x-shockwave-flash")
    ];
    function assetFilter(flow) {
        if (flow.response) {
            var ct = ResponseUtils.getContentType(flow.response);
            var i = ASSET_TYPES.length;
            while (i--) {
                if (ASSET_TYPES[i].test(ct)) {
                    return true;
                }
            }
        }
        return false;
    }
    assetFilter.desc = "is asset";
    function responseCode(code){
        function responseCodeFilter(flow){
            return flow.response && flow.response.code === code;
        }
        responseCodeFilter.desc = "resp. code is " + code;
        return responseCodeFilter;
    }
    function domain(regex){
        regex = new RegExp(regex, "i");
        function domainFilter(flow){
            return flow.request && regex.test(flow.request.host);
        }
        domainFilter.desc = "domain matches " + regex;
        return domainFilter;
    }
    function errorFilter(flow){
        return !!flow.error;
    }
    errorFilter.desc = "has error";
    function header(regex){
        regex = new RegExp(regex, "i");
        function headerFilter(flow){
            return (
                (flow.request && RequestUtils.match_header(flow.request, regex))
                ||
                (flow.response && ResponseUtils.match_header(flow.response, regex))
            );
        }
        headerFilter.desc = "header matches " + regex;
        return headerFilter;
    }
    function requestHeader(regex){
        regex = new RegExp(regex, "i");
        function requestHeaderFilter(flow){
            return (flow.request && RequestUtils.match_header(flow.request, regex));
        }
        requestHeaderFilter.desc = "req. header matches " + regex;
        return requestHeaderFilter;
    }
    function responseHeader(regex){
        regex = new RegExp(regex, "i");
        function responseHeaderFilter(flow){
            return (flow.response && ResponseUtils.match_header(flow.response, regex));
        }
        responseHeaderFilter.desc = "resp. header matches " + regex;
        return responseHeaderFilter;
    }
    function method(regex){
        regex = new RegExp(regex, "i");
        function methodFilter(flow){
            return flow.request && regex.test(flow.request.method);
        }
        methodFilter.desc = "method matches " + regex;
        return methodFilter;
    }
    function noResponseFilter(flow){
        return flow.request && !flow.response;
    }
    noResponseFilter.desc = "has no response";
    function responseFilter(flow){
        return !!flow.response;
    }
    responseFilter.desc = "has response";

    function contentType(regex){
        regex = new RegExp(regex, "i");
        function contentTypeFilter(flow){
            return (
                (flow.request && regex.test(RequestUtils.getContentType(flow.request)))
                ||
                (flow.response && regex.test(ResponseUtils.getContentType(flow.response)))
            );
        }
        contentTypeFilter.desc = "content type matches " + regex;
        return contentTypeFilter;
    }
    function requestContentType(regex){
        regex = new RegExp(regex, "i");
        function requestContentTypeFilter(flow){
            return flow.request && regex.test(RequestUtils.getContentType(flow.request));
        }
        requestContentTypeFilter.desc = "req. content type matches " + regex;
        return requestContentTypeFilter;
    }
    function responseContentType(regex){
        regex = new RegExp(regex, "i");
        function responseContentTypeFilter(flow){
            return flow.response && regex.test(ResponseUtils.getContentType(flow.response));
        }
        responseContentTypeFilter.desc = "resp. content type matches " + regex;
        return responseContentTypeFilter;
    }
    function url(regex){
        regex = new RegExp(regex, "i");
        function urlFilter(flow){
            return flow.request && regex.test(RequestUtils.pretty_url(flow.request));
        }
        urlFilter.desc = "url matches " + regex;
        return urlFilter;
    }


    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();
/* jshint ignore:end */

module.exports = Filt;

},{}],20:[function(require,module,exports){
var _ = require("lodash");

var _MessageUtils = {
    getContentType: function (message) {
        return this.get_first_header(message, /^Content-Type$/i);
    },
    get_first_header: function (message, regex) {
        //FIXME: Cache Invalidation.
        if (!message._headerLookups)
            Object.defineProperty(message, "_headerLookups", {
                value: {},
                configurable: false,
                enumerable: false,
                writable: false
            });
        if (!(regex in message._headerLookups)) {
            var header;
            for (var i = 0; i < message.headers.length; i++) {
                if (!!message.headers[i][0].match(regex)) {
                    header = message.headers[i];
                    break;
                }
            }
            message._headerLookups[regex] = header ? header[1] : undefined;
        }
        return message._headerLookups[regex];
    },
    match_header: function (message, regex) {
        var headers = message.headers;
        var i = headers.length;
        while (i--) {
            if (regex.test(headers[i].join(" "))) {
                return headers[i];
            }
        }
        return false;
    }
};

var defaultPorts = {
    "http": 80,
    "https": 443
};

var RequestUtils = _.extend(_MessageUtils, {
    pretty_host: function (request) {
        //FIXME: Add hostheader
        return request.host;
    },
    pretty_url: function (request) {
        var port = "";
        if (defaultPorts[request.scheme] !== request.port) {
            port = ":" + request.port;
        }
        return request.scheme + "://" + this.pretty_host(request) + port + request.path;
    }
});

var ResponseUtils = _.extend(_MessageUtils, {});


module.exports = {
    ResponseUtils: ResponseUtils,
    RequestUtils: RequestUtils

}
},{"lodash":"lodash"}],21:[function(require,module,exports){

var _ = require("lodash");
var $ = require("jquery");
var EventEmitter = require('events').EventEmitter;

var utils = require("../utils.js");
var actions = require("../actions.js");
var dispatcher = require("../dispatcher.js");


function ListStore() {
    EventEmitter.call(this);
    this.reset();
}
_.extend(ListStore.prototype, EventEmitter.prototype, {
    add: function (elem) {
        if (elem.id in this._pos_map) {
            return;
        }
        this._pos_map[elem.id] = this.list.length;
        this.list.push(elem);
        this.emit("add", elem);
    },
    update: function (elem) {
        if (!(elem.id in this._pos_map)) {
            return;
        }
        this.list[this._pos_map[elem.id]] = elem;
        this.emit("update", elem);
    },
    remove: function (elem_id) {
        if (!(elem_id in this._pos_map)) {
            return;
        }
        this.list.splice(this._pos_map[elem_id], 1);
        this._build_map();
        this.emit("remove", elem_id);
    },
    reset: function (elems) {
        this.list = elems || [];
        this._build_map();
        this.emit("recalculate");
    },
    _build_map: function () {
        this._pos_map = {};
        for (var i = 0; i < this.list.length; i++) {
            var elem = this.list[i];
            this._pos_map[elem.id] = i;
        }
    },
    get: function (elem_id) {
        return this.list[this._pos_map[elem_id]];
    },
    index: function (elem_id) {
        return this._pos_map[elem_id];
    }
});


function DictStore() {
    EventEmitter.call(this);
    this.reset();
}
_.extend(DictStore.prototype, EventEmitter.prototype, {
    update: function (dict) {
        _.merge(this.dict, dict);
        this.emit("recalculate");
    },
    reset: function (dict) {
        this.dict = dict || {};
        this.emit("recalculate");
    }
});

function LiveStoreMixin(type) {
    this.type = type;

    this._updates_before_fetch = undefined;
    this._fetchxhr = false;

    this.handle = this.handle.bind(this);
    dispatcher.AppDispatcher.register(this.handle);

    // Avoid double-fetch on startup.
    if (!(window.ws && window.ws.readyState === WebSocket.CONNECTING)) {
        this.fetch();
    }
}
_.extend(LiveStoreMixin.prototype, {
    handle: function (event) {
        if (event.type === actions.ActionTypes.CONNECTION_OPEN) {
            return this.fetch();
        }
        if (event.type === this.type) {
            if (event.cmd === actions.StoreCmds.RESET) {
                this.fetch(event.data);
            } else if (this._updates_before_fetch) {
                console.log("defer update", event);
                this._updates_before_fetch.push(event);
            } else {
                this[event.cmd](event.data);
            }
        }
    },
    close: function () {
        dispatcher.AppDispatcher.unregister(this.handle);
    },
    fetch: function (data) {
        console.log("fetch " + this.type);
        if (this._fetchxhr) {
            this._fetchxhr.abort();
        }
        this._updates_before_fetch = []; // (JS: empty array is true)
        if (data) {
            this.handle_fetch(data);
        } else {
            this._fetchxhr = $.getJSON("/" + this.type)
                .done(function (message) {
                    this.handle_fetch(message.data);
                }.bind(this))
                .fail(function () {
                    EventLogActions.add_event("Could not fetch " + this.type);
                }.bind(this));
        }
    },
    handle_fetch: function (data) {
        this._fetchxhr = false;
        console.log(this.type + " fetched.", this._updates_before_fetch);
        this.reset(data);
        var updates = this._updates_before_fetch;
        this._updates_before_fetch = false;
        for (var i = 0; i < updates.length; i++) {
            this.handle(updates[i]);
        }
    },
});

function LiveListStore(type) {
    ListStore.call(this);
    LiveStoreMixin.call(this, type);
}
_.extend(LiveListStore.prototype, ListStore.prototype, LiveStoreMixin.prototype);

function LiveDictStore(type) {
    DictStore.call(this);
    LiveStoreMixin.call(this, type);
}
_.extend(LiveDictStore.prototype, DictStore.prototype, LiveStoreMixin.prototype);


function FlowStore() {
    return new LiveListStore(actions.ActionTypes.FLOW_STORE);
}

function SettingsStore() {
    return new LiveDictStore(actions.ActionTypes.SETTINGS_STORE);
}

function EventLogStore() {
    LiveListStore.call(this, actions.ActionTypes.EVENT_STORE);
}
_.extend(EventLogStore.prototype, LiveListStore.prototype, {
    fetch: function(){
        LiveListStore.prototype.fetch.apply(this, arguments);

        // Make sure to display updates even if fetching all events failed.
        // This way, we can send "fetch failed" log messages to the log.
        if(this._fetchxhr){
            this._fetchxhr.fail(function(){
                this.handle_fetch(null);
            }.bind(this));
        }
    }
});


module.exports = {
    EventLogStore: EventLogStore,
    SettingsStore: SettingsStore,
    FlowStore: FlowStore
};
},{"../actions.js":5,"../dispatcher.js":18,"../utils.js":23,"events":1,"jquery":"jquery","lodash":"lodash"}],22:[function(require,module,exports){

var EventEmitter = require('events').EventEmitter;
var _ = require("lodash");


var utils = require("../utils.js");

function SortByStoreOrder(elem) {
    return this.store.index(elem.id);
}

var default_sort = SortByStoreOrder;
var default_filt = function(elem){
    return true;
};

function StoreView(store, filt, sortfun) {
    EventEmitter.call(this);
    filt = filt || default_filt;
    sortfun = sortfun || default_sort;

    this.store = store;

    this.add = this.add.bind(this);
    this.update = this.update.bind(this);
    this.remove = this.remove.bind(this);
    this.recalculate = this.recalculate.bind(this);
    this.store.addListener("add", this.add);
    this.store.addListener("update", this.update);
    this.store.addListener("remove", this.remove);
    this.store.addListener("recalculate", this.recalculate);

    this.recalculate(filt, sortfun);
}

_.extend(StoreView.prototype, EventEmitter.prototype, {
    close: function () {
        this.store.removeListener("add", this.add);
        this.store.removeListener("update", this.update);
        this.store.removeListener("remove", this.remove);
        this.store.removeListener("recalculate", this.recalculate);
        },
        recalculate: function (filt, sortfun) {
        if (filt) {
            this.filt = filt.bind(this);
        }
        if (sortfun) {
            this.sortfun = sortfun.bind(this);
        }

        this.list = this.store.list.filter(this.filt);
        this.list.sort(function (a, b) {
            return this.sortfun(a) - this.sortfun(b);
        }.bind(this));
        this.emit("recalculate");
    },
    index: function (elem) {
        return _.sortedIndex(this.list, elem, this.sortfun);
    },
    add: function (elem) {
        if (this.filt(elem)) {
            var idx = this.index(elem);
            if (idx === this.list.length) { //happens often, .push is way faster.
                this.list.push(elem);
            } else {
                this.list.splice(idx, 0, elem);
            }
            this.emit("add", elem, idx);
        }
    },
    update: function (elem) {
        var idx;
        var i = this.list.length;
        // Search from the back, we usually update the latest entries.
        while (i--) {
            if (this.list[i].id === elem.id) {
                idx = i;
                break;
            }
        }

        if (idx === -1) { //not contained in list
            this.add(elem);
        } else if (!this.filt(elem)) {
            this.remove(elem.id);
        } else {
            if (this.sortfun(this.list[idx]) !== this.sortfun(elem)) { //sortpos has changed
                this.remove(this.list[idx]);
                this.add(elem);
            } else {
                this.list[idx] = elem;
                this.emit("update", elem, idx);
            }
        }
    },
    remove: function (elem_id) {
        var idx = this.list.length;
        while (idx--) {
            if (this.list[idx].id === elem_id) {
                this.list.splice(idx, 1);
                this.emit("remove", elem_id, idx);
                break;
            }
        }
    }
});

module.exports = {
    StoreView: StoreView
};
},{"../utils.js":23,"events":1,"lodash":"lodash"}],23:[function(require,module,exports){
var $ = require("jquery");


var Key = {
    UP: 38,
    DOWN: 40,
    PAGE_UP: 33,
    PAGE_DOWN: 34,
    HOME: 36,
    END: 35,
    LEFT: 37,
    RIGHT: 39,
    ENTER: 13,
    ESC: 27,
    TAB: 9,
    SPACE: 32,
    BACKSPACE: 8,
};
// Add A-Z
for (var i = 65; i <= 90; i++) {
    Key[String.fromCharCode(i)] = i;
}


var formatSize = function (bytes) {
    var size = bytes;
    var prefix = ["B", "KB", "MB", "GB", "TB"];
    var i = 0;
    while (Math.abs(size) >= 1024 && i < prefix.length - 1) {
        i++;
        size = size / 1024;
    }
    return (Math.floor(size * 100) / 100.0).toFixed(2) + prefix[i];
};


var formatTimeDelta = function (milliseconds) {
    var time = milliseconds;
    var prefix = ["ms", "s", "min", "h"];
    var div = [1000, 60, 60];
    var i = 0;
    while (Math.abs(time) >= div[i] && i < div.length) {
        time = time / div[i];
        i++;
    }
    return Math.round(time) + prefix[i];
};


var formatTimeStamp = function (seconds) {
    var ts = (new Date(seconds * 1000)).toISOString();
    return ts.replace("T", " ").replace("Z", "");
};


function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}
var xsrf = $.param({_xsrf: getCookie("_xsrf")});

//Tornado XSRF Protection.
$.ajaxPrefilter(function (options) {
    if (["post", "put", "delete"].indexOf(options.type.toLowerCase()) >= 0 && options.url[0] === "/") {
        if (options.data) {
            options.data += ("&" + xsrf);
        } else {
            options.data = xsrf;
        }
    }
});
// Log AJAX Errors
$(document).ajaxError(function (event, jqXHR, ajaxSettings, thrownError) {
    var message = jqXHR.responseText;
    console.error(message, arguments);
    EventLogActions.add_event(thrownError + ": " + message);
    window.alert(message);
});

module.exports = {
    formatSize: formatSize,
    formatTimeDelta: formatTimeDelta,
    formatTimeStamp: formatTimeStamp,
    Key: Key
};
},{"jquery":"jquery"}]},{},[6])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy9mbHV4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZsdXgvbGliL0Rpc3BhdGNoZXIuanMiLCJub2RlX21vZHVsZXMvZmx1eC9saWIvaW52YXJpYW50LmpzIiwic3JjL2pzL2FjdGlvbnMuanMiLCJzcmMvanMvYXBwLmpzIiwic3JjL2pzL2NvbXBvbmVudHMvY29tbW9uLmpzIiwic3JjL2pzL2NvbXBvbmVudHMvZXZlbnRsb2cuanMiLCJzcmMvanMvY29tcG9uZW50cy9mbG93ZGV0YWlsLmpzIiwic3JjL2pzL2NvbXBvbmVudHMvZmxvd3RhYmxlLWNvbHVtbnMuanMiLCJzcmMvanMvY29tcG9uZW50cy9mbG93dGFibGUuanMiLCJzcmMvanMvY29tcG9uZW50cy9mb290ZXIuanMiLCJzcmMvanMvY29tcG9uZW50cy9oZWFkZXIuanMiLCJzcmMvanMvY29tcG9uZW50cy9tYWludmlldy5qcyIsInNyYy9qcy9jb21wb25lbnRzL3Byb3h5YXBwLmpzIiwic3JjL2pzL2NvbXBvbmVudHMvdmlydHVhbHNjcm9sbC5qcyIsInNyYy9qcy9jb25uZWN0aW9uLmpzIiwic3JjL2pzL2Rpc3BhdGNoZXIuanMiLCJzcmMvanMvZmlsdC9maWx0LmpzIiwic3JjL2pzL2Zsb3cvdXRpbHMuanMiLCJzcmMvanMvc3RvcmUvc3RvcmUuanMiLCJzcmMvanMvc3RvcmUvdmlldy5qcyIsInNyYy9qcy91dGlscy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOVlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqWUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4T0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNodkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9XG4gICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxubW9kdWxlLmV4cG9ydHMuRGlzcGF0Y2hlciA9IHJlcXVpcmUoJy4vbGliL0Rpc3BhdGNoZXInKVxuIiwiLypcbiAqIENvcHlyaWdodCAoYykgMjAxNCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIEBwcm92aWRlc01vZHVsZSBEaXNwYXRjaGVyXG4gKiBAdHlwZWNoZWNrc1xuICovXG5cblwidXNlIHN0cmljdFwiO1xuXG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnLi9pbnZhcmlhbnQnKTtcblxudmFyIF9sYXN0SUQgPSAxO1xudmFyIF9wcmVmaXggPSAnSURfJztcblxuLyoqXG4gKiBEaXNwYXRjaGVyIGlzIHVzZWQgdG8gYnJvYWRjYXN0IHBheWxvYWRzIHRvIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLiBUaGlzIGlzXG4gKiBkaWZmZXJlbnQgZnJvbSBnZW5lcmljIHB1Yi1zdWIgc3lzdGVtcyBpbiB0d28gd2F5czpcbiAqXG4gKiAgIDEpIENhbGxiYWNrcyBhcmUgbm90IHN1YnNjcmliZWQgdG8gcGFydGljdWxhciBldmVudHMuIEV2ZXJ5IHBheWxvYWQgaXNcbiAqICAgICAgZGlzcGF0Y2hlZCB0byBldmVyeSByZWdpc3RlcmVkIGNhbGxiYWNrLlxuICogICAyKSBDYWxsYmFja3MgY2FuIGJlIGRlZmVycmVkIGluIHdob2xlIG9yIHBhcnQgdW50aWwgb3RoZXIgY2FsbGJhY2tzIGhhdmVcbiAqICAgICAgYmVlbiBleGVjdXRlZC5cbiAqXG4gKiBGb3IgZXhhbXBsZSwgY29uc2lkZXIgdGhpcyBoeXBvdGhldGljYWwgZmxpZ2h0IGRlc3RpbmF0aW9uIGZvcm0sIHdoaWNoXG4gKiBzZWxlY3RzIGEgZGVmYXVsdCBjaXR5IHdoZW4gYSBjb3VudHJ5IGlzIHNlbGVjdGVkOlxuICpcbiAqICAgdmFyIGZsaWdodERpc3BhdGNoZXIgPSBuZXcgRGlzcGF0Y2hlcigpO1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2Ygd2hpY2ggY291bnRyeSBpcyBzZWxlY3RlZFxuICogICB2YXIgQ291bnRyeVN0b3JlID0ge2NvdW50cnk6IG51bGx9O1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2Ygd2hpY2ggY2l0eSBpcyBzZWxlY3RlZFxuICogICB2YXIgQ2l0eVN0b3JlID0ge2NpdHk6IG51bGx9O1xuICpcbiAqICAgLy8gS2VlcHMgdHJhY2sgb2YgdGhlIGJhc2UgZmxpZ2h0IHByaWNlIG9mIHRoZSBzZWxlY3RlZCBjaXR5XG4gKiAgIHZhciBGbGlnaHRQcmljZVN0b3JlID0ge3ByaWNlOiBudWxsfVxuICpcbiAqIFdoZW4gYSB1c2VyIGNoYW5nZXMgdGhlIHNlbGVjdGVkIGNpdHksIHdlIGRpc3BhdGNoIHRoZSBwYXlsb2FkOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gKiAgICAgYWN0aW9uVHlwZTogJ2NpdHktdXBkYXRlJyxcbiAqICAgICBzZWxlY3RlZENpdHk6ICdwYXJpcydcbiAqICAgfSk7XG4gKlxuICogVGhpcyBwYXlsb2FkIGlzIGRpZ2VzdGVkIGJ5IGBDaXR5U3RvcmVgOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5yZWdpc3RlcihmdW5jdGlvbihwYXlsb2FkKSB7XG4gKiAgICAgaWYgKHBheWxvYWQuYWN0aW9uVHlwZSA9PT0gJ2NpdHktdXBkYXRlJykge1xuICogICAgICAgQ2l0eVN0b3JlLmNpdHkgPSBwYXlsb2FkLnNlbGVjdGVkQ2l0eTtcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFdoZW4gdGhlIHVzZXIgc2VsZWN0cyBhIGNvdW50cnksIHdlIGRpc3BhdGNoIHRoZSBwYXlsb2FkOlxuICpcbiAqICAgZmxpZ2h0RGlzcGF0Y2hlci5kaXNwYXRjaCh7XG4gKiAgICAgYWN0aW9uVHlwZTogJ2NvdW50cnktdXBkYXRlJyxcbiAqICAgICBzZWxlY3RlZENvdW50cnk6ICdhdXN0cmFsaWEnXG4gKiAgIH0pO1xuICpcbiAqIFRoaXMgcGF5bG9hZCBpcyBkaWdlc3RlZCBieSBib3RoIHN0b3JlczpcbiAqXG4gKiAgICBDb3VudHJ5U3RvcmUuZGlzcGF0Y2hUb2tlbiA9IGZsaWdodERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkge1xuICogICAgIGlmIChwYXlsb2FkLmFjdGlvblR5cGUgPT09ICdjb3VudHJ5LXVwZGF0ZScpIHtcbiAqICAgICAgIENvdW50cnlTdG9yZS5jb3VudHJ5ID0gcGF5bG9hZC5zZWxlY3RlZENvdW50cnk7XG4gKiAgICAgfVxuICogICB9KTtcbiAqXG4gKiBXaGVuIHRoZSBjYWxsYmFjayB0byB1cGRhdGUgYENvdW50cnlTdG9yZWAgaXMgcmVnaXN0ZXJlZCwgd2Ugc2F2ZSBhIHJlZmVyZW5jZVxuICogdG8gdGhlIHJldHVybmVkIHRva2VuLiBVc2luZyB0aGlzIHRva2VuIHdpdGggYHdhaXRGb3IoKWAsIHdlIGNhbiBndWFyYW50ZWVcbiAqIHRoYXQgYENvdW50cnlTdG9yZWAgaXMgdXBkYXRlZCBiZWZvcmUgdGhlIGNhbGxiYWNrIHRoYXQgdXBkYXRlcyBgQ2l0eVN0b3JlYFxuICogbmVlZHMgdG8gcXVlcnkgaXRzIGRhdGEuXG4gKlxuICogICBDaXR5U3RvcmUuZGlzcGF0Y2hUb2tlbiA9IGZsaWdodERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkge1xuICogICAgIGlmIChwYXlsb2FkLmFjdGlvblR5cGUgPT09ICdjb3VudHJ5LXVwZGF0ZScpIHtcbiAqICAgICAgIC8vIGBDb3VudHJ5U3RvcmUuY291bnRyeWAgbWF5IG5vdCBiZSB1cGRhdGVkLlxuICogICAgICAgZmxpZ2h0RGlzcGF0Y2hlci53YWl0Rm9yKFtDb3VudHJ5U3RvcmUuZGlzcGF0Y2hUb2tlbl0pO1xuICogICAgICAgLy8gYENvdW50cnlTdG9yZS5jb3VudHJ5YCBpcyBub3cgZ3VhcmFudGVlZCB0byBiZSB1cGRhdGVkLlxuICpcbiAqICAgICAgIC8vIFNlbGVjdCB0aGUgZGVmYXVsdCBjaXR5IGZvciB0aGUgbmV3IGNvdW50cnlcbiAqICAgICAgIENpdHlTdG9yZS5jaXR5ID0gZ2V0RGVmYXVsdENpdHlGb3JDb3VudHJ5KENvdW50cnlTdG9yZS5jb3VudHJ5KTtcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFRoZSB1c2FnZSBvZiBgd2FpdEZvcigpYCBjYW4gYmUgY2hhaW5lZCwgZm9yIGV4YW1wbGU6XG4gKlxuICogICBGbGlnaHRQcmljZVN0b3JlLmRpc3BhdGNoVG9rZW4gPVxuICogICAgIGZsaWdodERpc3BhdGNoZXIucmVnaXN0ZXIoZnVuY3Rpb24ocGF5bG9hZCkge1xuICogICAgICAgc3dpdGNoIChwYXlsb2FkLmFjdGlvblR5cGUpIHtcbiAqICAgICAgICAgY2FzZSAnY291bnRyeS11cGRhdGUnOlxuICogICAgICAgICAgIGZsaWdodERpc3BhdGNoZXIud2FpdEZvcihbQ2l0eVN0b3JlLmRpc3BhdGNoVG9rZW5dKTtcbiAqICAgICAgICAgICBGbGlnaHRQcmljZVN0b3JlLnByaWNlID1cbiAqICAgICAgICAgICAgIGdldEZsaWdodFByaWNlU3RvcmUoQ291bnRyeVN0b3JlLmNvdW50cnksIENpdHlTdG9yZS5jaXR5KTtcbiAqICAgICAgICAgICBicmVhaztcbiAqXG4gKiAgICAgICAgIGNhc2UgJ2NpdHktdXBkYXRlJzpcbiAqICAgICAgICAgICBGbGlnaHRQcmljZVN0b3JlLnByaWNlID1cbiAqICAgICAgICAgICAgIEZsaWdodFByaWNlU3RvcmUoQ291bnRyeVN0b3JlLmNvdW50cnksIENpdHlTdG9yZS5jaXR5KTtcbiAqICAgICAgICAgICBicmVhaztcbiAqICAgICB9XG4gKiAgIH0pO1xuICpcbiAqIFRoZSBgY291bnRyeS11cGRhdGVgIHBheWxvYWQgd2lsbCBiZSBndWFyYW50ZWVkIHRvIGludm9rZSB0aGUgc3RvcmVzJ1xuICogcmVnaXN0ZXJlZCBjYWxsYmFja3MgaW4gb3JkZXI6IGBDb3VudHJ5U3RvcmVgLCBgQ2l0eVN0b3JlYCwgdGhlblxuICogYEZsaWdodFByaWNlU3RvcmVgLlxuICovXG5cbiAgZnVuY3Rpb24gRGlzcGF0Y2hlcigpIHtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrcyA9IHt9O1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNQZW5kaW5nID0ge307XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0hhbmRsZWQgPSB7fTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmcgPSBmYWxzZTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX3BlbmRpbmdQYXlsb2FkID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlcnMgYSBjYWxsYmFjayB0byBiZSBpbnZva2VkIHdpdGggZXZlcnkgZGlzcGF0Y2hlZCBwYXlsb2FkLiBSZXR1cm5zXG4gICAqIGEgdG9rZW4gdGhhdCBjYW4gYmUgdXNlZCB3aXRoIGB3YWl0Rm9yKClgLlxuICAgKlxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS5yZWdpc3Rlcj1mdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciBpZCA9IF9wcmVmaXggKyBfbGFzdElEKys7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3NbaWRdID0gY2FsbGJhY2s7XG4gICAgcmV0dXJuIGlkO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgY2FsbGJhY2sgYmFzZWQgb24gaXRzIHRva2VuLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaWRcbiAgICovXG4gIERpc3BhdGNoZXIucHJvdG90eXBlLnVucmVnaXN0ZXI9ZnVuY3Rpb24oaWQpIHtcbiAgICBpbnZhcmlhbnQoXG4gICAgICB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrc1tpZF0sXG4gICAgICAnRGlzcGF0Y2hlci51bnJlZ2lzdGVyKC4uLik6IGAlc2AgZG9lcyBub3QgbWFwIHRvIGEgcmVnaXN0ZXJlZCBjYWxsYmFjay4nLFxuICAgICAgaWRcbiAgICApO1xuICAgIGRlbGV0ZSB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrc1tpZF07XG4gIH07XG5cbiAgLyoqXG4gICAqIFdhaXRzIGZvciB0aGUgY2FsbGJhY2tzIHNwZWNpZmllZCB0byBiZSBpbnZva2VkIGJlZm9yZSBjb250aW51aW5nIGV4ZWN1dGlvblxuICAgKiBvZiB0aGUgY3VycmVudCBjYWxsYmFjay4gVGhpcyBtZXRob2Qgc2hvdWxkIG9ubHkgYmUgdXNlZCBieSBhIGNhbGxiYWNrIGluXG4gICAqIHJlc3BvbnNlIHRvIGEgZGlzcGF0Y2hlZCBwYXlsb2FkLlxuICAgKlxuICAgKiBAcGFyYW0ge2FycmF5PHN0cmluZz59IGlkc1xuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUud2FpdEZvcj1mdW5jdGlvbihpZHMpIHtcbiAgICBpbnZhcmlhbnQoXG4gICAgICB0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmcsXG4gICAgICAnRGlzcGF0Y2hlci53YWl0Rm9yKC4uLik6IE11c3QgYmUgaW52b2tlZCB3aGlsZSBkaXNwYXRjaGluZy4nXG4gICAgKTtcbiAgICBmb3IgKHZhciBpaSA9IDA7IGlpIDwgaWRzLmxlbmd0aDsgaWkrKykge1xuICAgICAgdmFyIGlkID0gaWRzW2lpXTtcbiAgICAgIGlmICh0aGlzLiREaXNwYXRjaGVyX2lzUGVuZGluZ1tpZF0pIHtcbiAgICAgICAgaW52YXJpYW50KFxuICAgICAgICAgIHRoaXMuJERpc3BhdGNoZXJfaXNIYW5kbGVkW2lkXSxcbiAgICAgICAgICAnRGlzcGF0Y2hlci53YWl0Rm9yKC4uLik6IENpcmN1bGFyIGRlcGVuZGVuY3kgZGV0ZWN0ZWQgd2hpbGUgJyArXG4gICAgICAgICAgJ3dhaXRpbmcgZm9yIGAlc2AuJyxcbiAgICAgICAgICBpZFxuICAgICAgICApO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGludmFyaWFudChcbiAgICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3NbaWRdLFxuICAgICAgICAnRGlzcGF0Y2hlci53YWl0Rm9yKC4uLik6IGAlc2AgZG9lcyBub3QgbWFwIHRvIGEgcmVnaXN0ZXJlZCBjYWxsYmFjay4nLFxuICAgICAgICBpZFxuICAgICAgKTtcbiAgICAgIHRoaXMuJERpc3BhdGNoZXJfaW52b2tlQ2FsbGJhY2soaWQpO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogRGlzcGF0Y2hlcyBhIHBheWxvYWQgdG8gYWxsIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gcGF5bG9hZFxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUuZGlzcGF0Y2g9ZnVuY3Rpb24ocGF5bG9hZCkge1xuICAgIGludmFyaWFudChcbiAgICAgICF0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmcsXG4gICAgICAnRGlzcGF0Y2guZGlzcGF0Y2goLi4uKTogQ2Fubm90IGRpc3BhdGNoIGluIHRoZSBtaWRkbGUgb2YgYSBkaXNwYXRjaC4nXG4gICAgKTtcbiAgICB0aGlzLiREaXNwYXRjaGVyX3N0YXJ0RGlzcGF0Y2hpbmcocGF5bG9hZCk7XG4gICAgdHJ5IHtcbiAgICAgIGZvciAodmFyIGlkIGluIHRoaXMuJERpc3BhdGNoZXJfY2FsbGJhY2tzKSB7XG4gICAgICAgIGlmICh0aGlzLiREaXNwYXRjaGVyX2lzUGVuZGluZ1tpZF0pIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLiREaXNwYXRjaGVyX2ludm9rZUNhbGxiYWNrKGlkKTtcbiAgICAgIH1cbiAgICB9IGZpbmFsbHkge1xuICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9zdG9wRGlzcGF0Y2hpbmcoKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIElzIHRoaXMgRGlzcGF0Y2hlciBjdXJyZW50bHkgZGlzcGF0Y2hpbmcuXG4gICAqXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59XG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS5pc0Rpc3BhdGNoaW5nPWZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLiREaXNwYXRjaGVyX2lzRGlzcGF0Y2hpbmc7XG4gIH07XG5cbiAgLyoqXG4gICAqIENhbGwgdGhlIGNhbGxiYWNrIHN0b3JlZCB3aXRoIHRoZSBnaXZlbiBpZC4gQWxzbyBkbyBzb21lIGludGVybmFsXG4gICAqIGJvb2trZWVwaW5nLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gaWRcbiAgICogQGludGVybmFsXG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS4kRGlzcGF0Y2hlcl9pbnZva2VDYWxsYmFjaz1mdW5jdGlvbihpZCkge1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNQZW5kaW5nW2lkXSA9IHRydWU7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9jYWxsYmFja3NbaWRdKHRoaXMuJERpc3BhdGNoZXJfcGVuZGluZ1BheWxvYWQpO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNIYW5kbGVkW2lkXSA9IHRydWU7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNldCB1cCBib29ra2VlcGluZyBuZWVkZWQgd2hlbiBkaXNwYXRjaGluZy5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHBheWxvYWRcbiAgICogQGludGVybmFsXG4gICAqL1xuICBEaXNwYXRjaGVyLnByb3RvdHlwZS4kRGlzcGF0Y2hlcl9zdGFydERpc3BhdGNoaW5nPWZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgICBmb3IgKHZhciBpZCBpbiB0aGlzLiREaXNwYXRjaGVyX2NhbGxiYWNrcykge1xuICAgICAgdGhpcy4kRGlzcGF0Y2hlcl9pc1BlbmRpbmdbaWRdID0gZmFsc2U7XG4gICAgICB0aGlzLiREaXNwYXRjaGVyX2lzSGFuZGxlZFtpZF0gPSBmYWxzZTtcbiAgICB9XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9wZW5kaW5nUGF5bG9hZCA9IHBheWxvYWQ7XG4gICAgdGhpcy4kRGlzcGF0Y2hlcl9pc0Rpc3BhdGNoaW5nID0gdHJ1ZTtcbiAgfTtcblxuICAvKipcbiAgICogQ2xlYXIgYm9va2tlZXBpbmcgdXNlZCBmb3IgZGlzcGF0Y2hpbmcuXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgRGlzcGF0Y2hlci5wcm90b3R5cGUuJERpc3BhdGNoZXJfc3RvcERpc3BhdGNoaW5nPWZ1bmN0aW9uKCkge1xuICAgIHRoaXMuJERpc3BhdGNoZXJfcGVuZGluZ1BheWxvYWQgPSBudWxsO1xuICAgIHRoaXMuJERpc3BhdGNoZXJfaXNEaXNwYXRjaGluZyA9IGZhbHNlO1xuICB9O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gRGlzcGF0Y2hlcjtcbiIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogQHByb3ZpZGVzTW9kdWxlIGludmFyaWFudFxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIFVzZSBpbnZhcmlhbnQoKSB0byBhc3NlcnQgc3RhdGUgd2hpY2ggeW91ciBwcm9ncmFtIGFzc3VtZXMgdG8gYmUgdHJ1ZS5cbiAqXG4gKiBQcm92aWRlIHNwcmludGYtc3R5bGUgZm9ybWF0IChvbmx5ICVzIGlzIHN1cHBvcnRlZCkgYW5kIGFyZ3VtZW50c1xuICogdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IGJyb2tlIGFuZCB3aGF0IHlvdSB3ZXJlXG4gKiBleHBlY3RpbmcuXG4gKlxuICogVGhlIGludmFyaWFudCBtZXNzYWdlIHdpbGwgYmUgc3RyaXBwZWQgaW4gcHJvZHVjdGlvbiwgYnV0IHRoZSBpbnZhcmlhbnRcbiAqIHdpbGwgcmVtYWluIHRvIGVuc3VyZSBsb2dpYyBkb2VzIG5vdCBkaWZmZXIgaW4gcHJvZHVjdGlvbi5cbiAqL1xuXG52YXIgaW52YXJpYW50ID0gZnVuY3Rpb24oY29uZGl0aW9uLCBmb3JtYXQsIGEsIGIsIGMsIGQsIGUsIGYpIHtcbiAgaWYgKGZhbHNlKSB7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFyaWFudCByZXF1aXJlcyBhbiBlcnJvciBtZXNzYWdlIGFyZ3VtZW50Jyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFjb25kaXRpb24pIHtcbiAgICB2YXIgZXJyb3I7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcihcbiAgICAgICAgJ01pbmlmaWVkIGV4Y2VwdGlvbiBvY2N1cnJlZDsgdXNlIHRoZSBub24tbWluaWZpZWQgZGV2IGVudmlyb25tZW50ICcgK1xuICAgICAgICAnZm9yIHRoZSBmdWxsIGVycm9yIG1lc3NhZ2UgYW5kIGFkZGl0aW9uYWwgaGVscGZ1bCB3YXJuaW5ncy4nXG4gICAgICApO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYXJncyA9IFthLCBiLCBjLCBkLCBlLCBmXTtcbiAgICAgIHZhciBhcmdJbmRleCA9IDA7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcihcbiAgICAgICAgJ0ludmFyaWFudCBWaW9sYXRpb246ICcgK1xuICAgICAgICBmb3JtYXQucmVwbGFjZSgvJXMvZywgZnVuY3Rpb24oKSB7IHJldHVybiBhcmdzW2FyZ0luZGV4KytdOyB9KVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBlcnJvci5mcmFtZXNUb1BvcCA9IDE7IC8vIHdlIGRvbid0IGNhcmUgYWJvdXQgaW52YXJpYW50J3Mgb3duIGZyYW1lXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaW52YXJpYW50O1xuIiwidmFyICQgPSByZXF1aXJlKFwianF1ZXJ5XCIpO1xuXG52YXIgQWN0aW9uVHlwZXMgPSB7XG4gICAgLy8gQ29ubmVjdGlvblxuICAgIENPTk5FQ1RJT05fT1BFTjogXCJjb25uZWN0aW9uX29wZW5cIixcbiAgICBDT05ORUNUSU9OX0NMT1NFOiBcImNvbm5lY3Rpb25fY2xvc2VcIixcbiAgICBDT05ORUNUSU9OX0VSUk9SOiBcImNvbm5lY3Rpb25fZXJyb3JcIixcblxuICAgIC8vIFN0b3Jlc1xuICAgIFNFVFRJTkdTX1NUT1JFOiBcInNldHRpbmdzXCIsXG4gICAgRVZFTlRfU1RPUkU6IFwiZXZlbnRzXCIsXG4gICAgRkxPV19TVE9SRTogXCJmbG93c1wiLFxufTtcblxudmFyIFN0b3JlQ21kcyA9IHtcbiAgICBBREQ6IFwiYWRkXCIsXG4gICAgVVBEQVRFOiBcInVwZGF0ZVwiLFxuICAgIFJFTU9WRTogXCJyZW1vdmVcIixcbiAgICBSRVNFVDogXCJyZXNldFwiXG59O1xuXG52YXIgQ29ubmVjdGlvbkFjdGlvbnMgPSB7XG4gICAgb3BlbjogZnVuY3Rpb24gKCkge1xuICAgICAgICBBcHBEaXNwYXRjaGVyLmRpc3BhdGNoVmlld0FjdGlvbih7XG4gICAgICAgICAgICB0eXBlOiBBY3Rpb25UeXBlcy5DT05ORUNUSU9OX09QRU5cbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICBBcHBEaXNwYXRjaGVyLmRpc3BhdGNoVmlld0FjdGlvbih7XG4gICAgICAgICAgICB0eXBlOiBBY3Rpb25UeXBlcy5DT05ORUNUSU9OX0NMT1NFXG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgZXJyb3I6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgQXBwRGlzcGF0Y2hlci5kaXNwYXRjaFZpZXdBY3Rpb24oe1xuICAgICAgICAgICAgdHlwZTogQWN0aW9uVHlwZXMuQ09OTkVDVElPTl9FUlJPUlxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG52YXIgU2V0dGluZ3NBY3Rpb25zID0ge1xuICAgIHVwZGF0ZTogZnVuY3Rpb24gKHNldHRpbmdzKSB7XG5cbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICAgIHR5cGU6IFwiUFVUXCIsXG4gICAgICAgICAgICB1cmw6IFwiL3NldHRpbmdzXCIsXG4gICAgICAgICAgICBkYXRhOiBzZXR0aW5nc1xuICAgICAgICB9KTtcblxuICAgICAgICAvKlxuICAgICAgICAvL0ZhY2Vib29rIEZsdXg6IFdlIGRvIGFuIG9wdGltaXN0aWMgdXBkYXRlIG9uIHRoZSBjbGllbnQgYWxyZWFkeS5cbiAgICAgICAgQXBwRGlzcGF0Y2hlci5kaXNwYXRjaFZpZXdBY3Rpb24oe1xuICAgICAgICAgICAgdHlwZTogQWN0aW9uVHlwZXMuU0VUVElOR1NfU1RPUkUsXG4gICAgICAgICAgICBjbWQ6IFN0b3JlQ21kcy5VUERBVEUsXG4gICAgICAgICAgICBkYXRhOiBzZXR0aW5nc1xuICAgICAgICB9KTtcbiAgICAgICAgKi9cbiAgICB9XG59O1xuXG52YXIgRXZlbnRMb2dBY3Rpb25zX2V2ZW50X2lkID0gMDtcbnZhciBFdmVudExvZ0FjdGlvbnMgPSB7XG4gICAgYWRkX2V2ZW50OiBmdW5jdGlvbiAobWVzc2FnZSkge1xuICAgICAgICBBcHBEaXNwYXRjaGVyLmRpc3BhdGNoVmlld0FjdGlvbih7XG4gICAgICAgICAgICB0eXBlOiBBY3Rpb25UeXBlcy5FVkVOVF9TVE9SRSxcbiAgICAgICAgICAgIGNtZDogU3RvcmVDbWRzLkFERCxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiBtZXNzYWdlLFxuICAgICAgICAgICAgICAgIGxldmVsOiBcIndlYlwiLFxuICAgICAgICAgICAgICAgIGlkOiBcInZpZXdBY3Rpb24tXCIgKyBFdmVudExvZ0FjdGlvbnNfZXZlbnRfaWQrK1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59O1xuXG52YXIgRmxvd0FjdGlvbnMgPSB7XG4gICAgYWNjZXB0OiBmdW5jdGlvbiAoZmxvdykge1xuICAgICAgICAkLnBvc3QoXCIvZmxvd3MvXCIgKyBmbG93LmlkICsgXCIvYWNjZXB0XCIpO1xuICAgIH0sXG4gICAgYWNjZXB0X2FsbDogZnVuY3Rpb24oKXtcbiAgICAgICAgJC5wb3N0KFwiL2Zsb3dzL2FjY2VwdFwiKTtcbiAgICB9LFxuICAgIFwiZGVsZXRlXCI6IGZ1bmN0aW9uKGZsb3cpe1xuICAgICAgICAkLmFqYXgoe1xuICAgICAgICAgICAgdHlwZTpcIkRFTEVURVwiLFxuICAgICAgICAgICAgdXJsOiBcIi9mbG93cy9cIiArIGZsb3cuaWRcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBkdXBsaWNhdGU6IGZ1bmN0aW9uKGZsb3cpe1xuICAgICAgICAkLnBvc3QoXCIvZmxvd3MvXCIgKyBmbG93LmlkICsgXCIvZHVwbGljYXRlXCIpO1xuICAgIH0sXG4gICAgcmVwbGF5OiBmdW5jdGlvbihmbG93KXtcbiAgICAgICAgJC5wb3N0KFwiL2Zsb3dzL1wiICsgZmxvdy5pZCArIFwiL3JlcGxheVwiKTtcbiAgICB9LFxuICAgIHJldmVydDogZnVuY3Rpb24oZmxvdyl7XG4gICAgICAgICQucG9zdChcIi9mbG93cy9cIiArIGZsb3cuaWQgKyBcIi9yZXZlcnRcIik7XG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChmbG93KSB7XG4gICAgICAgIEFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uKHtcbiAgICAgICAgICAgIHR5cGU6IEFjdGlvblR5cGVzLkZMT1dfU1RPUkUsXG4gICAgICAgICAgICBjbWQ6IFN0b3JlQ21kcy5VUERBVEUsXG4gICAgICAgICAgICBkYXRhOiBmbG93XG4gICAgICAgIH0pO1xuICAgIH0sXG4gICAgY2xlYXI6IGZ1bmN0aW9uKCl7XG4gICAgICAgICQucG9zdChcIi9jbGVhclwiKTtcbiAgICB9XG59O1xuXG5RdWVyeSA9IHtcbiAgICBGSUxURVI6IFwiZlwiLFxuICAgIEhJR0hMSUdIVDogXCJoXCIsXG4gICAgU0hPV19FVkVOVExPRzogXCJlXCJcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIEFjdGlvblR5cGVzOiBBY3Rpb25UeXBlcyxcbiAgICBDb25uZWN0aW9uQWN0aW9uczogQ29ubmVjdGlvbkFjdGlvbnMsXG4gICAgRmxvd0FjdGlvbnM6IEZsb3dBY3Rpb25zLFxuICAgIFN0b3JlQ21kczogU3RvcmVDbWRzXG59OyIsIlxudmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xudmFyIFJlYWN0Um91dGVyID0gcmVxdWlyZShcInJlYWN0LXJvdXRlclwiKTtcbnZhciAkID0gcmVxdWlyZShcImpxdWVyeVwiKTtcblxudmFyIENvbm5lY3Rpb24gPSByZXF1aXJlKFwiLi9jb25uZWN0aW9uXCIpO1xudmFyIHByb3h5YXBwID0gcmVxdWlyZShcIi4vY29tcG9uZW50cy9wcm94eWFwcC5qc1wiKTtcblxuJChmdW5jdGlvbiAoKSB7XG4gICAgd2luZG93LndzID0gbmV3IENvbm5lY3Rpb24oXCIvdXBkYXRlc1wiKTtcblxuICAgIFJlYWN0Um91dGVyLnJ1bihwcm94eWFwcC5yb3V0ZXMsIGZ1bmN0aW9uIChIYW5kbGVyKSB7XG4gICAgICAgIFJlYWN0LnJlbmRlcihSZWFjdC5jcmVhdGVFbGVtZW50KEhhbmRsZXIsIG51bGwpLCBkb2N1bWVudC5ib2R5KTtcbiAgICB9KTtcbn0pOyIsInZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcbnZhciBSZWFjdFJvdXRlciA9IHJlcXVpcmUoXCJyZWFjdC1yb3V0ZXJcIik7XG52YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XG5cbi8vIGh0dHA6Ly9ibG9nLnZqZXV4LmNvbS8yMDEzL2phdmFzY3JpcHQvc2Nyb2xsLXBvc2l0aW9uLXdpdGgtcmVhY3QuaHRtbCAoYWxzbyBjb250YWlucyBpbnZlcnNlIGV4YW1wbGUpXG52YXIgQXV0b1Njcm9sbE1peGluID0ge1xuICAgIGNvbXBvbmVudFdpbGxVcGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmdldERPTU5vZGUoKTtcbiAgICAgICAgdGhpcy5fc2hvdWxkU2Nyb2xsQm90dG9tID0gKFxuICAgICAgICAgICAgbm9kZS5zY3JvbGxUb3AgIT09IDAgJiZcbiAgICAgICAgICAgIG5vZGUuc2Nyb2xsVG9wICsgbm9kZS5jbGllbnRIZWlnaHQgPT09IG5vZGUuc2Nyb2xsSGVpZ2h0XG4gICAgICAgICk7XG4gICAgfSxcbiAgICBjb21wb25lbnREaWRVcGRhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Nob3VsZFNjcm9sbEJvdHRvbSkge1xuICAgICAgICAgICAgdmFyIG5vZGUgPSB0aGlzLmdldERPTU5vZGUoKTtcbiAgICAgICAgICAgIG5vZGUuc2Nyb2xsVG9wID0gbm9kZS5zY3JvbGxIZWlnaHQ7XG4gICAgICAgIH1cbiAgICB9LFxufTtcblxuXG52YXIgU3RpY2t5SGVhZE1peGluID0ge1xuICAgIGFkanVzdEhlYWQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gQWJ1c2luZyBDU1MgdHJhbnNmb3JtcyB0byBzZXQgdGhlIGVsZW1lbnRcbiAgICAgICAgLy8gcmVmZXJlbmNlZCBhcyBoZWFkIGludG8gc29tZSBraW5kIG9mIHBvc2l0aW9uOnN0aWNreS5cbiAgICAgICAgdmFyIGhlYWQgPSB0aGlzLnJlZnMuaGVhZC5nZXRET01Ob2RlKCk7XG4gICAgICAgIGhlYWQuc3R5bGUudHJhbnNmb3JtID0gXCJ0cmFuc2xhdGUoMCxcIiArIHRoaXMuZ2V0RE9NTm9kZSgpLnNjcm9sbFRvcCArIFwicHgpXCI7XG4gICAgfVxufTtcblxuXG52YXIgTmF2aWdhdGlvbiA9IF8uZXh0ZW5kKHt9LCBSZWFjdFJvdXRlci5OYXZpZ2F0aW9uLCB7XG4gICAgc2V0UXVlcnk6IGZ1bmN0aW9uIChkaWN0KSB7XG4gICAgICAgIHZhciBxID0gdGhpcy5jb250ZXh0LmdldEN1cnJlbnRRdWVyeSgpO1xuICAgICAgICBmb3IodmFyIGkgaW4gZGljdCl7XG4gICAgICAgICAgICBpZihkaWN0Lmhhc093blByb3BlcnR5KGkpKXtcbiAgICAgICAgICAgICAgICBxW2ldID0gZGljdFtpXSB8fCB1bmRlZmluZWQ7IC8vZmFsc2V5IHZhbHVlcyBzaGFsbCBiZSByZW1vdmVkLlxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHEuXyA9IFwiX1wiOyAvLyB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vcmFja3QvcmVhY3Qtcm91dGVyL3B1bGwvNTk5XG4gICAgICAgIHRoaXMucmVwbGFjZVdpdGgodGhpcy5jb250ZXh0LmdldEN1cnJlbnRQYXRoKCksIHRoaXMuY29udGV4dC5nZXRDdXJyZW50UGFyYW1zKCksIHEpO1xuICAgIH0sXG4gICAgcmVwbGFjZVdpdGg6IGZ1bmN0aW9uKHJvdXRlTmFtZU9yUGF0aCwgcGFyYW1zLCBxdWVyeSkge1xuICAgICAgICBpZihyb3V0ZU5hbWVPclBhdGggPT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICByb3V0ZU5hbWVPclBhdGggPSB0aGlzLmNvbnRleHQuZ2V0Q3VycmVudFBhdGgoKTtcbiAgICAgICAgfVxuICAgICAgICBpZihwYXJhbXMgPT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICBwYXJhbXMgPSB0aGlzLmNvbnRleHQuZ2V0Q3VycmVudFBhcmFtcygpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHF1ZXJ5ID09PSB1bmRlZmluZWQpe1xuICAgICAgICAgICAgcXVlcnkgPSB0aGlzLmNvbnRleHQuZ2V0Q3VycmVudFF1ZXJ5KCk7XG4gICAgICAgIH1cbiAgICAgICAgUmVhY3RSb3V0ZXIuTmF2aWdhdGlvbi5yZXBsYWNlV2l0aC5jYWxsKHRoaXMsIHJvdXRlTmFtZU9yUGF0aCwgcGFyYW1zLCBxdWVyeSk7XG4gICAgfVxufSk7XG5fLmV4dGVuZChOYXZpZ2F0aW9uLmNvbnRleHRUeXBlcywgUmVhY3RSb3V0ZXIuU3RhdGUuY29udGV4dFR5cGVzKTtcblxudmFyIFN0YXRlID0gXy5leHRlbmQoe30sIFJlYWN0Um91dGVyLlN0YXRlLCB7XG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuX3F1ZXJ5ID0gdGhpcy5jb250ZXh0LmdldEN1cnJlbnRRdWVyeSgpO1xuICAgICAgICB0aGlzLl9xdWVyeVdhdGNoZXMgPSBbXTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgICBvblF1ZXJ5Q2hhbmdlOiBmdW5jdGlvbiAoa2V5LCBjYWxsYmFjaykge1xuICAgICAgICB0aGlzLl9xdWVyeVdhdGNoZXMucHVzaCh7XG4gICAgICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgICAgIGNhbGxiYWNrOiBjYWxsYmFja1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHM6IGZ1bmN0aW9uIChuZXh0UHJvcHMsIG5leHRTdGF0ZSkge1xuICAgICAgICB2YXIgcSA9IHRoaXMuY29udGV4dC5nZXRDdXJyZW50UXVlcnkoKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLl9xdWVyeVdhdGNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciB3YXRjaCA9IHRoaXMuX3F1ZXJ5V2F0Y2hlc1tpXTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9xdWVyeVt3YXRjaC5rZXldICE9PSBxW3dhdGNoLmtleV0pIHtcbiAgICAgICAgICAgICAgICB3YXRjaC5jYWxsYmFjayh0aGlzLl9xdWVyeVt3YXRjaC5rZXldLCBxW3dhdGNoLmtleV0sIHdhdGNoLmtleSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcXVlcnkgPSBxO1xuICAgIH1cbn0pO1xuXG52YXIgU3BsaXR0ZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiU3BsaXR0ZXJcIixcbiAgICBnZXREZWZhdWx0UHJvcHM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGF4aXM6IFwieFwiXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGFwcGxpZWQ6IGZhbHNlLFxuICAgICAgICAgICAgc3RhcnRYOiBmYWxzZSxcbiAgICAgICAgICAgIHN0YXJ0WTogZmFsc2VcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIG9uTW91c2VEb3duOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHN0YXJ0WDogZS5wYWdlWCxcbiAgICAgICAgICAgIHN0YXJ0WTogZS5wYWdlWVxuICAgICAgICB9KTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZW1vdmVcIiwgdGhpcy5vbk1vdXNlTW92ZSk7XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFwibW91c2V1cFwiLCB0aGlzLm9uTW91c2VVcCk7XG4gICAgICAgIC8vIE9jY2FzaW9uYWxseSwgb25seSBhIGRyYWdFbmQgZXZlbnQgaXMgdHJpZ2dlcmVkLCBidXQgbm8gbW91c2VVcC5cbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnZW5kXCIsIHRoaXMub25EcmFnRW5kKTtcbiAgICB9LFxuICAgIG9uRHJhZ0VuZDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmdldERPTU5vZGUoKS5zdHlsZS50cmFuc2Zvcm0gPSBcIlwiO1xuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgdGhpcy5vbkRyYWdFbmQpO1xuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNldXBcIiwgdGhpcy5vbk1vdXNlVXApO1xuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcihcIm1vdXNlbW92ZVwiLCB0aGlzLm9uTW91c2VNb3ZlKTtcbiAgICB9LFxuICAgIG9uTW91c2VVcDogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdGhpcy5vbkRyYWdFbmQoKTtcblxuICAgICAgICB2YXIgbm9kZSA9IHRoaXMuZ2V0RE9NTm9kZSgpO1xuICAgICAgICB2YXIgcHJldiA9IG5vZGUucHJldmlvdXNFbGVtZW50U2libGluZztcbiAgICAgICAgdmFyIG5leHQgPSBub2RlLm5leHRFbGVtZW50U2libGluZztcblxuICAgICAgICB2YXIgZFggPSBlLnBhZ2VYIC0gdGhpcy5zdGF0ZS5zdGFydFg7XG4gICAgICAgIHZhciBkWSA9IGUucGFnZVkgLSB0aGlzLnN0YXRlLnN0YXJ0WTtcbiAgICAgICAgdmFyIGZsZXhCYXNpcztcbiAgICAgICAgaWYgKHRoaXMucHJvcHMuYXhpcyA9PT0gXCJ4XCIpIHtcbiAgICAgICAgICAgIGZsZXhCYXNpcyA9IHByZXYub2Zmc2V0V2lkdGggKyBkWDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZsZXhCYXNpcyA9IHByZXYub2Zmc2V0SGVpZ2h0ICsgZFk7XG4gICAgICAgIH1cblxuICAgICAgICBwcmV2LnN0eWxlLmZsZXggPSBcIjAgMCBcIiArIE1hdGgubWF4KDAsIGZsZXhCYXNpcykgKyBcInB4XCI7XG4gICAgICAgIG5leHQuc3R5bGUuZmxleCA9IFwiMSAxIGF1dG9cIjtcblxuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIGFwcGxpZWQ6IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMub25SZXNpemUoKTtcbiAgICB9LFxuICAgIG9uTW91c2VNb3ZlOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICB2YXIgZFggPSAwLCBkWSA9IDA7XG4gICAgICAgIGlmICh0aGlzLnByb3BzLmF4aXMgPT09IFwieFwiKSB7XG4gICAgICAgICAgICBkWCA9IGUucGFnZVggLSB0aGlzLnN0YXRlLnN0YXJ0WDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRZID0gZS5wYWdlWSAtIHRoaXMuc3RhdGUuc3RhcnRZO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZ2V0RE9NTm9kZSgpLnN0eWxlLnRyYW5zZm9ybSA9IFwidHJhbnNsYXRlKFwiICsgZFggKyBcInB4LFwiICsgZFkgKyBcInB4KVwiO1xuICAgIH0sXG4gICAgb25SZXNpemU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gVHJpZ2dlciBhIGdsb2JhbCByZXNpemUgZXZlbnQuIFRoaXMgbm90aWZpZXMgY29tcG9uZW50cyB0aGF0IGVtcGxveSB2aXJ0dWFsIHNjcm9sbGluZ1xuICAgICAgICAvLyB0aGF0IHRoZWlyIHZpZXdwb3J0IG1heSBoYXZlIGNoYW5nZWQuXG4gICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHdpbmRvdy5kaXNwYXRjaEV2ZW50KG5ldyBDdXN0b21FdmVudChcInJlc2l6ZVwiKSk7XG4gICAgICAgIH0sIDEpO1xuICAgIH0sXG4gICAgcmVzZXQ6IGZ1bmN0aW9uICh3aWxsVW5tb3VudCkge1xuICAgICAgICBpZiAoIXRoaXMuc3RhdGUuYXBwbGllZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciBub2RlID0gdGhpcy5nZXRET01Ob2RlKCk7XG4gICAgICAgIHZhciBwcmV2ID0gbm9kZS5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xuICAgICAgICB2YXIgbmV4dCA9IG5vZGUubmV4dEVsZW1lbnRTaWJsaW5nO1xuXG4gICAgICAgIHByZXYuc3R5bGUuZmxleCA9IFwiXCI7XG4gICAgICAgIG5leHQuc3R5bGUuZmxleCA9IFwiXCI7XG5cbiAgICAgICAgaWYgKCF3aWxsVW5tb3VudCkge1xuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICAgICAgYXBwbGllZDogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMub25SZXNpemUoKTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucmVzZXQodHJ1ZSk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNsYXNzTmFtZSA9IFwic3BsaXR0ZXJcIjtcbiAgICAgICAgaWYgKHRoaXMucHJvcHMuYXhpcyA9PT0gXCJ4XCIpIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcIiBzcGxpdHRlci14XCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCIgc3BsaXR0ZXIteVwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIHtjbGFzc05hbWU6IGNsYXNzTmFtZX0sIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiwge29uTW91c2VEb3duOiB0aGlzLm9uTW91c2VEb3duLCBkcmFnZ2FibGU6IFwidHJ1ZVwifSlcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgU3RhdGU6IFN0YXRlLFxuICAgIE5hdmlnYXRpb246IE5hdmlnYXRpb24sXG4gICAgU3RpY2t5SGVhZE1peGluOiBTdGlja3lIZWFkTWl4aW4sXG4gICAgQXV0b1Njcm9sbE1peGluOiBBdXRvU2Nyb2xsTWl4aW4sXG4gICAgU3BsaXR0ZXI6IFNwbGl0dGVyXG59IiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xudmFyIGNvbW1vbiA9IHJlcXVpcmUoXCIuL2NvbW1vbi5qc1wiKTtcbnZhciBWaXJ0dWFsU2Nyb2xsTWl4aW4gPSByZXF1aXJlKFwiLi92aXJ0dWFsc2Nyb2xsLmpzXCIpO1xudmFyIHZpZXdzID0gcmVxdWlyZShcIi4uL3N0b3JlL3ZpZXcuanNcIik7XG5cbnZhciBMb2dNZXNzYWdlID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIkxvZ01lc3NhZ2VcIixcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGVudHJ5ID0gdGhpcy5wcm9wcy5lbnRyeTtcbiAgICAgICAgdmFyIGluZGljYXRvcjtcbiAgICAgICAgc3dpdGNoIChlbnRyeS5sZXZlbCkge1xuICAgICAgICAgICAgY2FzZSBcIndlYlwiOlxuICAgICAgICAgICAgICAgIGluZGljYXRvciA9IFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJpXCIsIHtjbGFzc05hbWU6IFwiZmEgZmEtZncgZmEtaHRtbDVcIn0pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcImRlYnVnXCI6XG4gICAgICAgICAgICAgICAgaW5kaWNhdG9yID0gUmVhY3QuY3JlYXRlRWxlbWVudChcImlcIiwge2NsYXNzTmFtZTogXCJmYSBmYS1mdyBmYS1idWdcIn0pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBpbmRpY2F0b3IgPSBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaVwiLCB7Y2xhc3NOYW1lOiBcImZhIGZhLWZ3IGZhLWluZm9cIn0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIG51bGwsIFxuICAgICAgICAgICAgICAgIGluZGljYXRvciwgXCIgXCIsIGVudHJ5Lm1lc3NhZ2VcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9LFxuICAgIHNob3VsZENvbXBvbmVudFVwZGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7IC8vIGxvZyBlbnRyaWVzIGFyZSBpbW11dGFibGUuXG4gICAgfVxufSk7XG5cbnZhciBFdmVudExvZ0NvbnRlbnRzID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIkV2ZW50TG9nQ29udGVudHNcIixcbiAgICBtaXhpbnM6IFtjb21tb24uQXV0b1Njcm9sbE1peGluLCBWaXJ0dWFsU2Nyb2xsTWl4aW5dLFxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbG9nOiBbXVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgY29tcG9uZW50V2lsbE1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMub3BlblZpZXcodGhpcy5wcm9wcy5ldmVudFN0b3JlKTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuY2xvc2VWaWV3KCk7XG4gICAgfSxcbiAgICBvcGVuVmlldzogZnVuY3Rpb24gKHN0b3JlKSB7XG4gICAgICAgIHZhciB2aWV3ID0gbmV3IHZpZXdzLlN0b3JlVmlldyhzdG9yZSwgZnVuY3Rpb24gKGVudHJ5KSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9wcy5maWx0ZXJbZW50cnkubGV2ZWxdO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHZpZXc6IHZpZXdcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmlldy5hZGRMaXN0ZW5lcihcImFkZCByZWNhbGN1bGF0ZVwiLCB0aGlzLm9uRXZlbnRMb2dDaGFuZ2UpO1xuICAgIH0sXG4gICAgY2xvc2VWaWV3OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RhdGUudmlldy5jbG9zZSgpO1xuICAgIH0sXG4gICAgb25FdmVudExvZ0NoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIGxvZzogdGhpcy5zdGF0ZS52aWV3Lmxpc3RcbiAgICAgICAgfSk7XG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzOiBmdW5jdGlvbiAobmV4dFByb3BzKSB7XG4gICAgICAgIGlmIChuZXh0UHJvcHMuZmlsdGVyICE9PSB0aGlzLnByb3BzLmZpbHRlcikge1xuICAgICAgICAgICAgdGhpcy5wcm9wcy5maWx0ZXIgPSBuZXh0UHJvcHMuZmlsdGVyOyAvLyBEaXJ0eTogTWFrZSBzdXJlIHRoYXQgdmlldyBmaWx0ZXIgc2VlcyB0aGUgdXBkYXRlLlxuICAgICAgICAgICAgdGhpcy5zdGF0ZS52aWV3LnJlY2FsY3VsYXRlKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5leHRQcm9wcy5ldmVudFN0b3JlICE9PSB0aGlzLnByb3BzLmV2ZW50U3RvcmUpIHtcbiAgICAgICAgICAgIHRoaXMuY2xvc2VWaWV3KCk7XG4gICAgICAgICAgICB0aGlzLm9wZW5WaWV3KG5leHRQcm9wcy5ldmVudFN0b3JlKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByb3dIZWlnaHQ6IDQ1LFxuICAgICAgICAgICAgcm93SGVpZ2h0TWluOiAxNSxcbiAgICAgICAgICAgIHBsYWNlaG9sZGVyVGFnTmFtZTogXCJkaXZcIlxuICAgICAgICB9O1xuICAgIH0sXG4gICAgcmVuZGVyUm93OiBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChMb2dNZXNzYWdlLCB7a2V5OiBlbGVtLmlkLCBlbnRyeTogZWxlbX0pO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciByb3dzID0gdGhpcy5yZW5kZXJSb3dzKHRoaXMuc3RhdGUubG9nKTtcblxuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInByZVwiLCB7b25TY3JvbGw6IHRoaXMub25TY3JvbGx9LCBcbiAgICAgICAgICAgICB0aGlzLmdldFBsYWNlaG9sZGVyVG9wKHRoaXMuc3RhdGUubG9nLmxlbmd0aCksIFxuICAgICAgICAgICAgcm93cywgXG4gICAgICAgICAgICAgdGhpcy5nZXRQbGFjZWhvbGRlckJvdHRvbSh0aGlzLnN0YXRlLmxvZy5sZW5ndGgpIFxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgVG9nZ2xlRmlsdGVyID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIlRvZ2dsZUZpbHRlclwiLFxuICAgIHRvZ2dsZTogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICByZXR1cm4gdGhpcy5wcm9wcy50b2dnbGVMZXZlbCh0aGlzLnByb3BzLm5hbWUpO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBjbGFzc05hbWUgPSBcImxhYmVsIFwiO1xuICAgICAgICBpZiAodGhpcy5wcm9wcy5hY3RpdmUpIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcImxhYmVsLXByaW1hcnlcIjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcImxhYmVsLWRlZmF1bHRcIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImFcIiwge1xuICAgICAgICAgICAgICAgIGhyZWY6IFwiI1wiLCBcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU6IGNsYXNzTmFtZSwgXG4gICAgICAgICAgICAgICAgb25DbGljazogdGhpcy50b2dnbGV9LCBcbiAgICAgICAgICAgICAgICB0aGlzLnByb3BzLm5hbWVcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIEV2ZW50TG9nID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIkV2ZW50TG9nXCIsXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBmaWx0ZXI6IHtcbiAgICAgICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgICAgIFwiaW5mb1wiOiB0cnVlLFxuICAgICAgICAgICAgICAgIFwid2ViXCI6IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkID0ge307XG4gICAgICAgIGRbUXVlcnkuU0hPV19FVkVOVExPR10gPSB1bmRlZmluZWQ7XG4gICAgICAgIHRoaXMuc2V0UXVlcnkoZCk7XG4gICAgfSxcbiAgICB0b2dnbGVMZXZlbDogZnVuY3Rpb24gKGxldmVsKSB7XG4gICAgICAgIHZhciBmaWx0ZXIgPSBfLmV4dGVuZCh7fSwgdGhpcy5zdGF0ZS5maWx0ZXIpO1xuICAgICAgICBmaWx0ZXJbbGV2ZWxdID0gIWZpbHRlcltsZXZlbF07XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe2ZpbHRlcjogZmlsdGVyfSk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiwge2NsYXNzTmFtZTogXCJldmVudGxvZ1wifSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICAgICAgXCJFdmVudGxvZ1wiLCBcbiAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCB7Y2xhc3NOYW1lOiBcInB1bGwtcmlnaHRcIn0sIFxuICAgICAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChUb2dnbGVGaWx0ZXIsIHtuYW1lOiBcImRlYnVnXCIsIGFjdGl2ZTogdGhpcy5zdGF0ZS5maWx0ZXIuZGVidWcsIHRvZ2dsZUxldmVsOiB0aGlzLnRvZ2dsZUxldmVsfSksIFxuICAgICAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChUb2dnbGVGaWx0ZXIsIHtuYW1lOiBcImluZm9cIiwgYWN0aXZlOiB0aGlzLnN0YXRlLmZpbHRlci5pbmZvLCB0b2dnbGVMZXZlbDogdGhpcy50b2dnbGVMZXZlbH0pLCBcbiAgICAgICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVG9nZ2xlRmlsdGVyLCB7bmFtZTogXCJ3ZWJcIiwgYWN0aXZlOiB0aGlzLnN0YXRlLmZpbHRlci53ZWIsIHRvZ2dsZUxldmVsOiB0aGlzLnRvZ2dsZUxldmVsfSksIFxuICAgICAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImlcIiwge29uQ2xpY2s6IHRoaXMuY2xvc2UsIGNsYXNzTmFtZTogXCJmYSBmYS1jbG9zZVwifSlcbiAgICAgICAgICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICAgICAgKSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChFdmVudExvZ0NvbnRlbnRzLCB7ZmlsdGVyOiB0aGlzLnN0YXRlLmZpbHRlciwgZXZlbnRTdG9yZTogdGhpcy5wcm9wcy5ldmVudFN0b3JlfSlcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudExvZzsiLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XG52YXIgXyA9IHJlcXVpcmUoXCJsb2Rhc2hcIik7XG5cbnZhciBjb21tb24gPSByZXF1aXJlKFwiLi9jb21tb24uanNcIik7XG52YXIgYWN0aW9ucyA9IHJlcXVpcmUoXCIuLi9hY3Rpb25zLmpzXCIpO1xudmFyIGZsb3d1dGlscyA9IHJlcXVpcmUoXCIuLi9mbG93L3V0aWxzLmpzXCIpO1xudmFyIHRvcHV0aWxzID0gcmVxdWlyZShcIi4uL3V0aWxzLmpzXCIpO1xuXG52YXIgTmF2QWN0aW9uID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIk5hdkFjdGlvblwiLFxuICAgIG9uQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgdGhpcy5wcm9wcy5vbkNsaWNrKCk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJhXCIsIHt0aXRsZTogdGhpcy5wcm9wcy50aXRsZSwgXG4gICAgICAgICAgICAgICAgaHJlZjogXCIjXCIsIFxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogXCJuYXYtYWN0aW9uXCIsIFxuICAgICAgICAgICAgICAgIG9uQ2xpY2s6IHRoaXMub25DbGlja30sIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJpXCIsIHtjbGFzc05hbWU6IFwiZmEgZmEtZncgXCIgKyB0aGlzLnByb3BzLmljb259KVxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgRmxvd0RldGFpbE5hdiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJGbG93RGV0YWlsTmF2XCIsXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuXG4gICAgICAgIHZhciB0YWJzID0gdGhpcy5wcm9wcy50YWJzLm1hcChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgdmFyIHN0ciA9IGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBlLnNsaWNlKDEpO1xuICAgICAgICAgICAgdmFyIGNsYXNzTmFtZSA9IHRoaXMucHJvcHMuYWN0aXZlID09PSBlID8gXCJhY3RpdmVcIiA6IFwiXCI7XG4gICAgICAgICAgICB2YXIgb25DbGljayA9IGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMuc2VsZWN0VGFiKGUpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcyk7XG4gICAgICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcImFcIiwge2tleTogZSwgXG4gICAgICAgICAgICAgICAgaHJlZjogXCIjXCIsIFxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZTogY2xhc3NOYW1lLCBcbiAgICAgICAgICAgICAgICBvbkNsaWNrOiBvbkNsaWNrfSwgc3RyKTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcblxuICAgICAgICB2YXIgYWNjZXB0QnV0dG9uID0gbnVsbDtcbiAgICAgICAgaWYoZmxvdy5pbnRlcmNlcHRlZCl7XG4gICAgICAgICAgICBhY2NlcHRCdXR0b24gPSBSZWFjdC5jcmVhdGVFbGVtZW50KE5hdkFjdGlvbiwge3RpdGxlOiBcIlthXWNjZXB0IGludGVyY2VwdGVkIGZsb3dcIiwgaWNvbjogXCJmYS1wbGF5XCIsIG9uQ2xpY2s6IGFjdGlvbnMuRmxvd0FjdGlvbnMuYWNjZXB0LmJpbmQobnVsbCwgZmxvdyl9KTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcmV2ZXJ0QnV0dG9uID0gbnVsbDtcbiAgICAgICAgaWYoZmxvdy5tb2RpZmllZCl7XG4gICAgICAgICAgICByZXZlcnRCdXR0b24gPSBSZWFjdC5jcmVhdGVFbGVtZW50KE5hdkFjdGlvbiwge3RpdGxlOiBcInJldmVydCBjaGFuZ2VzIHRvIGZsb3cgW1ZdXCIsIGljb246IFwiZmEtaGlzdG9yeVwiLCBvbkNsaWNrOiBhY3Rpb25zLkZsb3dBY3Rpb25zLnJldmVydC5iaW5kKG51bGwsIGZsb3cpfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcIm5hdlwiLCB7cmVmOiBcImhlYWRcIiwgY2xhc3NOYW1lOiBcIm5hdi10YWJzIG5hdi10YWJzLXNtXCJ9LCBcbiAgICAgICAgICAgICAgICB0YWJzLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KE5hdkFjdGlvbiwge3RpdGxlOiBcIltkXWVsZXRlIGZsb3dcIiwgaWNvbjogXCJmYS10cmFzaFwiLCBvbkNsaWNrOiBhY3Rpb25zLkZsb3dBY3Rpb25zLmRlbGV0ZS5iaW5kKG51bGwsIGZsb3cpfSksIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoTmF2QWN0aW9uLCB7dGl0bGU6IFwiW0RddXBsaWNhdGUgZmxvd1wiLCBpY29uOiBcImZhLWNvcHlcIiwgb25DbGljazogYWN0aW9ucy5GbG93QWN0aW9ucy5kdXBsaWNhdGUuYmluZChudWxsLCBmbG93KX0pLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KE5hdkFjdGlvbiwge2Rpc2FibGVkOiB0cnVlLCB0aXRsZTogXCJbcl1lcGxheSBmbG93XCIsIGljb246IFwiZmEtcmVwZWF0XCIsIG9uQ2xpY2s6IGFjdGlvbnMuRmxvd0FjdGlvbnMucmVwbGF5LmJpbmQobnVsbCwgZmxvdyl9KSwgXG4gICAgICAgICAgICAgICAgYWNjZXB0QnV0dG9uLCBcbiAgICAgICAgICAgICAgICByZXZlcnRCdXR0b25cbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIEhlYWRlcnMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiSGVhZGVyc1wiLFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcm93cyA9IHRoaXMucHJvcHMubWVzc2FnZS5oZWFkZXJzLm1hcChmdW5jdGlvbiAoaGVhZGVyLCBpKSB7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0clwiLCB7a2V5OiBpfSwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCB7Y2xhc3NOYW1lOiBcImhlYWRlci1uYW1lXCJ9LCBoZWFkZXJbMF0gKyBcIjpcIiksIFxuICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGRcIiwge2NsYXNzTmFtZTogXCJoZWFkZXItdmFsdWVcIn0sIGhlYWRlclsxXSlcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0YWJsZVwiLCB7Y2xhc3NOYW1lOiBcImhlYWRlci10YWJsZVwifSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcInRib2R5XCIsIG51bGwsIFxuICAgICAgICAgICAgICAgICAgICByb3dzXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgRmxvd0RldGFpbFJlcXVlc3QgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiRmxvd0RldGFpbFJlcXVlc3RcIixcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHZhciBmaXJzdF9saW5lID0gW1xuICAgICAgICAgICAgZmxvdy5yZXF1ZXN0Lm1ldGhvZCxcbiAgICAgICAgICAgIGZsb3d1dGlscy5SZXF1ZXN0VXRpbHMucHJldHR5X3VybChmbG93LnJlcXVlc3QpLFxuICAgICAgICAgICAgXCJIVFRQL1wiICsgZmxvdy5yZXF1ZXN0Lmh0dHB2ZXJzaW9uLmpvaW4oXCIuXCIpXG4gICAgICAgIF0uam9pbihcIiBcIik7XG4gICAgICAgIHZhciBjb250ZW50ID0gbnVsbDtcbiAgICAgICAgaWYgKGZsb3cucmVxdWVzdC5jb250ZW50TGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29udGVudCA9IFwiUmVxdWVzdCBDb250ZW50IFNpemU6IFwiICsgdG9wdXRpbHMuZm9ybWF0U2l6ZShmbG93LnJlcXVlc3QuY29udGVudExlbmd0aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250ZW50ID0gUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCB7Y2xhc3NOYW1lOiBcImFsZXJ0IGFsZXJ0LWluZm9cIn0sIFwiTm8gQ29udGVudFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vVE9ETzogU3R5bGluZ1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIHtjbGFzc05hbWU6IFwiZmlyc3QtbGluZVwifSwgZmlyc3RfbGluZSApLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KEhlYWRlcnMsIHttZXNzYWdlOiBmbG93LnJlcXVlc3R9KSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImhyXCIsIG51bGwpLCBcbiAgICAgICAgICAgICAgICBjb250ZW50XG4gICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cbnZhciBGbG93RGV0YWlsUmVzcG9uc2UgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiRmxvd0RldGFpbFJlc3BvbnNlXCIsXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuICAgICAgICB2YXIgZmlyc3RfbGluZSA9IFtcbiAgICAgICAgICAgIFwiSFRUUC9cIiArIGZsb3cucmVzcG9uc2UuaHR0cHZlcnNpb24uam9pbihcIi5cIiksXG4gICAgICAgICAgICBmbG93LnJlc3BvbnNlLmNvZGUsXG4gICAgICAgICAgICBmbG93LnJlc3BvbnNlLm1zZ1xuICAgICAgICBdLmpvaW4oXCIgXCIpO1xuICAgICAgICB2YXIgY29udGVudCA9IG51bGw7XG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlLmNvbnRlbnRMZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBjb250ZW50ID0gXCJSZXNwb25zZSBDb250ZW50IFNpemU6IFwiICsgdG9wdXRpbHMuZm9ybWF0U2l6ZShmbG93LnJlc3BvbnNlLmNvbnRlbnRMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29udGVudCA9IFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiwge2NsYXNzTmFtZTogXCJhbGVydCBhbGVydC1pbmZvXCJ9LCBcIk5vIENvbnRlbnRcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvL1RPRE86IFN0eWxpbmdcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcInNlY3Rpb25cIiwgbnVsbCwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCB7Y2xhc3NOYW1lOiBcImZpcnN0LWxpbmVcIn0sIGZpcnN0X2xpbmUgKSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChIZWFkZXJzLCB7bWVzc2FnZTogZmxvdy5yZXNwb25zZX0pLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaHJcIiwgbnVsbCksIFxuICAgICAgICAgICAgICAgIGNvbnRlbnRcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIEZsb3dEZXRhaWxFcnJvciA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJGbG93RGV0YWlsRXJyb3JcIixcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIHtjbGFzc05hbWU6IFwiYWxlcnQgYWxlcnQtd2FybmluZ1wifSwgXG4gICAgICAgICAgICAgICAgZmxvdy5lcnJvci5tc2csIFxuICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIG51bGwsIFxuICAgICAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcInNtYWxsXCIsIG51bGwsICB0b3B1dGlscy5mb3JtYXRUaW1lU3RhbXAoZmxvdy5lcnJvci50aW1lc3RhbXApIClcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIFRpbWVTdGFtcCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJUaW1lU3RhbXBcIixcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICBpZiAoIXRoaXMucHJvcHMudCkge1xuICAgICAgICAgICAgLy9zaG91bGQgYmUgcmV0dXJuIG51bGwsIGJ1dCB0aGF0IHRyaWdnZXJzIGEgUmVhY3QgYnVnLlxuICAgICAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0clwiLCBudWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB0cyA9IHRvcHV0aWxzLmZvcm1hdFRpbWVTdGFtcCh0aGlzLnByb3BzLnQpO1xuXG4gICAgICAgIHZhciBkZWx0YTtcbiAgICAgICAgaWYgKHRoaXMucHJvcHMuZGVsdGFUbykge1xuICAgICAgICAgICAgZGVsdGEgPSB0b3B1dGlscy5mb3JtYXRUaW1lRGVsdGEoMTAwMCAqICh0aGlzLnByb3BzLnQgLSB0aGlzLnByb3BzLmRlbHRhVG8pKTtcbiAgICAgICAgICAgIGRlbHRhID0gUmVhY3QuY3JlYXRlRWxlbWVudChcInNwYW5cIiwge2NsYXNzTmFtZTogXCJ0ZXh0LW11dGVkXCJ9LCBcIihcIiArIGRlbHRhICsgXCIpXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGVsdGEgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0clwiLCBudWxsLCBcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCBudWxsLCB0aGlzLnByb3BzLnRpdGxlICsgXCI6XCIpLCBcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCBudWxsLCB0cywgXCIgXCIsIGRlbHRhKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgQ29ubmVjdGlvbkluZm8gPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiQ29ubmVjdGlvbkluZm9cIixcblxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY29ubiA9IHRoaXMucHJvcHMuY29ubjtcbiAgICAgICAgdmFyIGFkZHJlc3MgPSBjb25uLmFkZHJlc3MuYWRkcmVzcy5qb2luKFwiOlwiKTtcblxuICAgICAgICB2YXIgc25pID0gUmVhY3QuY3JlYXRlRWxlbWVudChcInRyXCIsIHtrZXk6IFwic25pXCJ9KTsgLy9zaG91bGQgYmUgbnVsbCwgYnV0IHRoYXQgdHJpZ2dlcnMgYSBSZWFjdCBidWcuXG4gICAgICAgIGlmIChjb25uLnNuaSkge1xuICAgICAgICAgICAgc25pID0gUmVhY3QuY3JlYXRlRWxlbWVudChcInRyXCIsIHtrZXk6IFwic25pXCJ9LCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGRcIiwgbnVsbCwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJhYmJyXCIsIHt0aXRsZTogXCJUTFMgU2VydmVyIE5hbWUgSW5kaWNhdGlvblwifSwgXCJUTFMgU05JOlwiKVxuICAgICAgICAgICAgICAgICksIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCBudWxsLCBjb25uLnNuaSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0YWJsZVwiLCB7Y2xhc3NOYW1lOiBcImNvbm5lY3Rpb24tdGFibGVcIn0sIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0Ym9keVwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcInRyXCIsIHtrZXk6IFwiYWRkcmVzc1wifSwgXG4gICAgICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGRcIiwgbnVsbCwgXCJBZGRyZXNzOlwiKSwgXG4gICAgICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGRcIiwgbnVsbCwgYWRkcmVzcylcbiAgICAgICAgICAgICAgICAgICAgKSwgXG4gICAgICAgICAgICAgICAgICAgIHNuaVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIENlcnRpZmljYXRlSW5mbyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJDZXJ0aWZpY2F0ZUluZm9cIixcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy9UT0RPOiBXZSBzaG91bGQgZmV0Y2ggaHVtYW4tcmVhZGFibGUgY2VydGlmaWNhdGUgcmVwcmVzZW50YXRpb25cbiAgICAgICAgLy8gZnJvbSB0aGUgc2VydmVyXG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuICAgICAgICB2YXIgY2xpZW50X2Nvbm4gPSBmbG93LmNsaWVudF9jb25uO1xuICAgICAgICB2YXIgc2VydmVyX2Nvbm4gPSBmbG93LnNlcnZlcl9jb25uO1xuXG4gICAgICAgIHZhciBwcmVTdHlsZSA9IHttYXhIZWlnaHQ6IDEwMH07XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIG51bGwsIFxuICAgICAgICAgICAgY2xpZW50X2Nvbm4uY2VydCA/IFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJoNFwiLCBudWxsLCBcIkNsaWVudCBDZXJ0aWZpY2F0ZVwiKSA6IG51bGwsIFxuICAgICAgICAgICAgY2xpZW50X2Nvbm4uY2VydCA/IFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJwcmVcIiwge3N0eWxlOiBwcmVTdHlsZX0sIGNsaWVudF9jb25uLmNlcnQpIDogbnVsbCwgXG5cbiAgICAgICAgICAgIHNlcnZlcl9jb25uLmNlcnQgPyBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaDRcIiwgbnVsbCwgXCJTZXJ2ZXIgQ2VydGlmaWNhdGVcIikgOiBudWxsLCBcbiAgICAgICAgICAgIHNlcnZlcl9jb25uLmNlcnQgPyBSZWFjdC5jcmVhdGVFbGVtZW50KFwicHJlXCIsIHtzdHlsZTogcHJlU3R5bGV9LCBzZXJ2ZXJfY29ubi5jZXJ0KSA6IG51bGxcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIFRpbWluZyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJUaW1pbmdcIixcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHZhciBzYyA9IGZsb3cuc2VydmVyX2Nvbm47XG4gICAgICAgIHZhciBjYyA9IGZsb3cuY2xpZW50X2Nvbm47XG4gICAgICAgIHZhciByZXEgPSBmbG93LnJlcXVlc3Q7XG4gICAgICAgIHZhciByZXNwID0gZmxvdy5yZXNwb25zZTtcblxuICAgICAgICB2YXIgdGltZXN0YW1wcyA9IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTZXJ2ZXIgY29ubi4gaW5pdGlhdGVkXCIsXG4gICAgICAgICAgICAgICAgdDogc2MudGltZXN0YW1wX3N0YXJ0LFxuICAgICAgICAgICAgICAgIGRlbHRhVG86IHJlcS50aW1lc3RhbXBfc3RhcnRcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJTZXJ2ZXIgY29ubi4gVENQIGhhbmRzaGFrZVwiLFxuICAgICAgICAgICAgICAgIHQ6IHNjLnRpbWVzdGFtcF90Y3Bfc2V0dXAsXG4gICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIHRpdGxlOiBcIlNlcnZlciBjb25uLiBTU0wgaGFuZHNoYWtlXCIsXG4gICAgICAgICAgICAgICAgdDogc2MudGltZXN0YW1wX3NzbF9zZXR1cCxcbiAgICAgICAgICAgICAgICBkZWx0YVRvOiByZXEudGltZXN0YW1wX3N0YXJ0XG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiQ2xpZW50IGNvbm4uIGVzdGFibGlzaGVkXCIsXG4gICAgICAgICAgICAgICAgdDogY2MudGltZXN0YW1wX3N0YXJ0LFxuICAgICAgICAgICAgICAgIGRlbHRhVG86IHJlcS50aW1lc3RhbXBfc3RhcnRcbiAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICB0aXRsZTogXCJDbGllbnQgY29ubi4gU1NMIGhhbmRzaGFrZVwiLFxuICAgICAgICAgICAgICAgIHQ6IGNjLnRpbWVzdGFtcF9zc2xfc2V0dXAsXG4gICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxuICAgICAgICAgICAgfSwge1xuICAgICAgICAgICAgICAgIHRpdGxlOiBcIkZpcnN0IHJlcXVlc3QgYnl0ZVwiLFxuICAgICAgICAgICAgICAgIHQ6IHJlcS50aW1lc3RhbXBfc3RhcnQsXG4gICAgICAgICAgICB9LCB7XG4gICAgICAgICAgICAgICAgdGl0bGU6IFwiUmVxdWVzdCBjb21wbGV0ZVwiLFxuICAgICAgICAgICAgICAgIHQ6IHJlcS50aW1lc3RhbXBfZW5kLFxuICAgICAgICAgICAgICAgIGRlbHRhVG86IHJlcS50aW1lc3RhbXBfc3RhcnRcbiAgICAgICAgICAgIH1cbiAgICAgICAgXTtcblxuICAgICAgICBpZiAoZmxvdy5yZXNwb25zZSkge1xuICAgICAgICAgICAgdGltZXN0YW1wcy5wdXNoKFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiRmlyc3QgcmVzcG9uc2UgYnl0ZVwiLFxuICAgICAgICAgICAgICAgICAgICB0OiByZXNwLnRpbWVzdGFtcF9zdGFydCxcbiAgICAgICAgICAgICAgICAgICAgZGVsdGFUbzogcmVxLnRpbWVzdGFtcF9zdGFydFxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgdGl0bGU6IFwiUmVzcG9uc2UgY29tcGxldGVcIixcbiAgICAgICAgICAgICAgICAgICAgdDogcmVzcC50aW1lc3RhbXBfZW5kLFxuICAgICAgICAgICAgICAgICAgICBkZWx0YVRvOiByZXEudGltZXN0YW1wX3N0YXJ0XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vQWRkIHVuaXF1ZSBrZXkgZm9yIGVhY2ggcm93LlxuICAgICAgICB0aW1lc3RhbXBzLmZvckVhY2goZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIGUua2V5ID0gZS50aXRsZTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGltZXN0YW1wcyA9IF8uc29ydEJ5KHRpbWVzdGFtcHMsICd0Jyk7XG5cbiAgICAgICAgdmFyIHJvd3MgPSB0aW1lc3RhbXBzLm1hcChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGltZVN0YW1wLCBSZWFjdC5fX3NwcmVhZCh7fSwgIGUpKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiwgbnVsbCwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImg0XCIsIG51bGwsIFwiVGltaW5nXCIpLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGFibGVcIiwge2NsYXNzTmFtZTogXCJ0aW1pbmctdGFibGVcIn0sIFxuICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGJvZHlcIiwgbnVsbCwgXG4gICAgICAgICAgICAgICAgICAgIHJvd3NcbiAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxudmFyIEZsb3dEZXRhaWxDb25uZWN0aW9uSW5mbyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJGbG93RGV0YWlsQ29ubmVjdGlvbkluZm9cIixcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHZhciBjbGllbnRfY29ubiA9IGZsb3cuY2xpZW50X2Nvbm47XG4gICAgICAgIHZhciBzZXJ2ZXJfY29ubiA9IGZsb3cuc2VydmVyX2Nvbm47XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwic2VjdGlvblwiLCBudWxsLCBcblxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJoNFwiLCBudWxsLCBcIkNsaWVudCBDb25uZWN0aW9uXCIpLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KENvbm5lY3Rpb25JbmZvLCB7Y29ubjogY2xpZW50X2Nvbm59KSwgXG5cbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaDRcIiwgbnVsbCwgXCJTZXJ2ZXIgQ29ubmVjdGlvblwiKSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChDb25uZWN0aW9uSW5mbywge2Nvbm46IHNlcnZlcl9jb25ufSksIFxuXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChDZXJ0aWZpY2F0ZUluZm8sIHtmbG93OiBmbG93fSksIFxuXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChUaW1pbmcsIHtmbG93OiBmbG93fSlcblxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgYWxsVGFicyA9IHtcbiAgICByZXF1ZXN0OiBGbG93RGV0YWlsUmVxdWVzdCxcbiAgICByZXNwb25zZTogRmxvd0RldGFpbFJlc3BvbnNlLFxuICAgIGVycm9yOiBGbG93RGV0YWlsRXJyb3IsXG4gICAgZGV0YWlsczogRmxvd0RldGFpbENvbm5lY3Rpb25JbmZvXG59O1xuXG52YXIgRmxvd0RldGFpbCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJGbG93RGV0YWlsXCIsXG4gICAgbWl4aW5zOiBbY29tbW9uLlN0aWNreUhlYWRNaXhpbiwgY29tbW9uLk5hdmlnYXRpb24sIGNvbW1vbi5TdGF0ZV0sXG4gICAgZ2V0VGFiczogZnVuY3Rpb24gKGZsb3cpIHtcbiAgICAgICAgdmFyIHRhYnMgPSBbXTtcbiAgICAgICAgW1wicmVxdWVzdFwiLCBcInJlc3BvbnNlXCIsIFwiZXJyb3JcIl0uZm9yRWFjaChmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgaWYgKGZsb3dbZV0pIHtcbiAgICAgICAgICAgICAgICB0YWJzLnB1c2goZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICB0YWJzLnB1c2goXCJkZXRhaWxzXCIpO1xuICAgICAgICByZXR1cm4gdGFicztcbiAgICB9LFxuICAgIG5leHRUYWI6IGZ1bmN0aW9uIChpKSB7XG4gICAgICAgIHZhciB0YWJzID0gdGhpcy5nZXRUYWJzKHRoaXMucHJvcHMuZmxvdyk7XG4gICAgICAgIHZhciBjdXJyZW50SW5kZXggPSB0YWJzLmluZGV4T2YodGhpcy5nZXRQYXJhbXMoKS5kZXRhaWxUYWIpO1xuICAgICAgICAvLyBKUyBtb2R1bG8gb3BlcmF0b3IgZG9lc24ndCBjb3JyZWN0IG5lZ2F0aXZlIG51bWJlcnMsIG1ha2Ugc3VyZSB0aGF0IHdlIGFyZSBwb3NpdGl2ZS5cbiAgICAgICAgdmFyIG5leHRJbmRleCA9IChjdXJyZW50SW5kZXggKyBpICsgdGFicy5sZW5ndGgpICUgdGFicy5sZW5ndGg7XG4gICAgICAgIHRoaXMuc2VsZWN0VGFiKHRhYnNbbmV4dEluZGV4XSk7XG4gICAgfSxcbiAgICBzZWxlY3RUYWI6IGZ1bmN0aW9uIChwYW5lbCkge1xuICAgICAgICB0aGlzLnJlcGxhY2VXaXRoKFxuICAgICAgICAgICAgXCJmbG93XCIsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZmxvd0lkOiB0aGlzLmdldFBhcmFtcygpLmZsb3dJZCxcbiAgICAgICAgICAgICAgICBkZXRhaWxUYWI6IHBhbmVsXG4gICAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG4gICAgICAgIHZhciB0YWJzID0gdGhpcy5nZXRUYWJzKGZsb3cpO1xuICAgICAgICB2YXIgYWN0aXZlID0gdGhpcy5nZXRQYXJhbXMoKS5kZXRhaWxUYWI7XG5cbiAgICAgICAgaWYgKCFfLmNvbnRhaW5zKHRhYnMsIGFjdGl2ZSkpIHtcbiAgICAgICAgICAgIGlmIChhY3RpdmUgPT09IFwicmVzcG9uc2VcIiAmJiBmbG93LmVycm9yKSB7XG4gICAgICAgICAgICAgICAgYWN0aXZlID0gXCJlcnJvclwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhY3RpdmUgPT09IFwiZXJyb3JcIiAmJiBmbG93LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgYWN0aXZlID0gXCJyZXNwb25zZVwiO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhY3RpdmUgPSB0YWJzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5zZWxlY3RUYWIoYWN0aXZlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBUYWIgPSBhbGxUYWJzW2FjdGl2ZV07XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIHtjbGFzc05hbWU6IFwiZmxvdy1kZXRhaWxcIiwgb25TY3JvbGw6IHRoaXMuYWRqdXN0SGVhZH0sIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoRmxvd0RldGFpbE5hdiwge3JlZjogXCJoZWFkXCIsIFxuICAgICAgICAgICAgICAgICAgICBmbG93OiBmbG93LCBcbiAgICAgICAgICAgICAgICAgICAgdGFiczogdGFicywgXG4gICAgICAgICAgICAgICAgICAgIGFjdGl2ZTogYWN0aXZlLCBcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0VGFiOiB0aGlzLnNlbGVjdFRhYn0pLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFRhYiwge2Zsb3c6IGZsb3d9KVxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBGbG93RGV0YWlsOiBGbG93RGV0YWlsXG59OyIsInZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcbnZhciBmbG93dXRpbHMgPSByZXF1aXJlKFwiLi4vZmxvdy91dGlscy5qc1wiKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoXCIuLi91dGlscy5qc1wiKTtcblxudmFyIFRMU0NvbHVtbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJUTFNDb2x1bW5cIixcbiAgICBzdGF0aWNzOiB7XG4gICAgICAgIHJlbmRlclRpdGxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInRoXCIsIHtrZXk6IFwidGxzXCIsIGNsYXNzTmFtZTogXCJjb2wtdGxzXCJ9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuICAgICAgICB2YXIgc3NsID0gKGZsb3cucmVxdWVzdC5zY2hlbWUgPT0gXCJodHRwc1wiKTtcbiAgICAgICAgdmFyIGNsYXNzZXM7XG4gICAgICAgIGlmIChzc2wpIHtcbiAgICAgICAgICAgIGNsYXNzZXMgPSBcImNvbC10bHMgY29sLXRscy1odHRwc1wiO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2xhc3NlcyA9IFwiY29sLXRscyBjb2wtdGxzLWh0dHBcIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInRkXCIsIHtjbGFzc05hbWU6IGNsYXNzZXN9KTtcbiAgICB9XG59KTtcblxuXG52YXIgSWNvbkNvbHVtbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJJY29uQ29sdW1uXCIsXG4gICAgc3RhdGljczoge1xuICAgICAgICByZW5kZXJUaXRsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0aFwiLCB7a2V5OiBcImljb25cIiwgY2xhc3NOYW1lOiBcImNvbC1pY29uXCJ9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuXG4gICAgICAgIHZhciBpY29uO1xuICAgICAgICBpZiAoZmxvdy5yZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIGNvbnRlbnRUeXBlID0gZmxvd3V0aWxzLlJlc3BvbnNlVXRpbHMuZ2V0Q29udGVudFR5cGUoZmxvdy5yZXNwb25zZSk7XG5cbiAgICAgICAgICAgIC8vVE9ETzogV2Ugc2hvdWxkIGFzc2lnbiBhIHR5cGUgdG8gdGhlIGZsb3cgc29tZXdoZXJlIGVsc2UuXG4gICAgICAgICAgICBpZiAoZmxvdy5yZXNwb25zZS5jb2RlID09IDMwNCkge1xuICAgICAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24tbm90LW1vZGlmaWVkXCI7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKDMwMCA8PSBmbG93LnJlc3BvbnNlLmNvZGUgJiYgZmxvdy5yZXNwb25zZS5jb2RlIDwgNDAwKSB7XG4gICAgICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1yZWRpcmVjdFwiO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb250ZW50VHlwZSAmJiBjb250ZW50VHlwZS5pbmRleE9mKFwiaW1hZ2VcIikgPj0gMCkge1xuICAgICAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24taW1hZ2VcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29udGVudFR5cGUgJiYgY29udGVudFR5cGUuaW5kZXhPZihcImphdmFzY3JpcHRcIikgPj0gMCkge1xuICAgICAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24tanNcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29udGVudFR5cGUgJiYgY29udGVudFR5cGUuaW5kZXhPZihcImNzc1wiKSA+PSAwKSB7XG4gICAgICAgICAgICAgICAgaWNvbiA9IFwicmVzb3VyY2UtaWNvbi1jc3NcIjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY29udGVudFR5cGUgJiYgY29udGVudFR5cGUuaW5kZXhPZihcImh0bWxcIikgPj0gMCkge1xuICAgICAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24tZG9jdW1lbnRcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoIWljb24pIHtcbiAgICAgICAgICAgIGljb24gPSBcInJlc291cmNlLWljb24tcGxhaW5cIjtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgaWNvbiArPSBcIiByZXNvdXJjZS1pY29uXCI7XG4gICAgICAgIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGRcIiwge2NsYXNzTmFtZTogXCJjb2wtaWNvblwifSwgXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIHtjbGFzc05hbWU6IGljb259KVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgUGF0aENvbHVtbiA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJQYXRoQ29sdW1uXCIsXG4gICAgc3RhdGljczoge1xuICAgICAgICByZW5kZXJUaXRsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0aFwiLCB7a2V5OiBcInBhdGhcIiwgY2xhc3NOYW1lOiBcImNvbC1wYXRoXCJ9LCBcIlBhdGhcIik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcbiAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCB7Y2xhc3NOYW1lOiBcImNvbC1wYXRoXCJ9LCBcbiAgICAgICAgICAgIGZsb3cucmVxdWVzdC5pc19yZXBsYXkgPyBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaVwiLCB7Y2xhc3NOYW1lOiBcImZhIGZhLWZ3IGZhLXJlcGVhdCBwdWxsLXJpZ2h0XCJ9KSA6IG51bGwsIFxuICAgICAgICAgICAgZmxvdy5pbnRlcmNlcHRlZCA/IFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJpXCIsIHtjbGFzc05hbWU6IFwiZmEgZmEtZncgZmEtcGF1c2UgcHVsbC1yaWdodFwifSkgOiBudWxsLCBcbiAgICAgICAgICAgIGZsb3cucmVxdWVzdC5zY2hlbWUgKyBcIjovL1wiICsgZmxvdy5yZXF1ZXN0Lmhvc3QgKyBmbG93LnJlcXVlc3QucGF0aFxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5cbnZhciBNZXRob2RDb2x1bW4gPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiTWV0aG9kQ29sdW1uXCIsXG4gICAgc3RhdGljczoge1xuICAgICAgICByZW5kZXJUaXRsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0aFwiLCB7a2V5OiBcIm1ldGhvZFwiLCBjbGFzc05hbWU6IFwiY29sLW1ldGhvZFwifSwgXCJNZXRob2RcIik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcbiAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCB7Y2xhc3NOYW1lOiBcImNvbC1tZXRob2RcIn0sIGZsb3cucmVxdWVzdC5tZXRob2QpO1xuICAgIH1cbn0pO1xuXG5cbnZhciBTdGF0dXNDb2x1bW4gPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiU3RhdHVzQ29sdW1uXCIsXG4gICAgc3RhdGljczoge1xuICAgICAgICByZW5kZXJUaXRsZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0aFwiLCB7a2V5OiBcInN0YXR1c1wiLCBjbGFzc05hbWU6IFwiY29sLXN0YXR1c1wifSwgXCJTdGF0dXNcIik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMucHJvcHMuZmxvdztcbiAgICAgICAgdmFyIHN0YXR1cztcbiAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHN0YXR1cyA9IGZsb3cucmVzcG9uc2UuY29kZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHN0YXR1cyA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCB7Y2xhc3NOYW1lOiBcImNvbC1zdGF0dXNcIn0sIHN0YXR1cyk7XG4gICAgfVxufSk7XG5cblxudmFyIFNpemVDb2x1bW4gPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiU2l6ZUNvbHVtblwiLFxuICAgIHN0YXRpY3M6IHtcbiAgICAgICAgcmVuZGVyVGl0bGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGhcIiwge2tleTogXCJzaXplXCIsIGNsYXNzTmFtZTogXCJjb2wtc2l6ZVwifSwgXCJTaXplXCIpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZsb3cgPSB0aGlzLnByb3BzLmZsb3c7XG5cbiAgICAgICAgdmFyIHRvdGFsID0gZmxvdy5yZXF1ZXN0LmNvbnRlbnRMZW5ndGg7XG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICB0b3RhbCArPSBmbG93LnJlc3BvbnNlLmNvbnRlbnRMZW5ndGggfHwgMDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgc2l6ZSA9IHV0aWxzLmZvcm1hdFNpemUodG90YWwpO1xuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInRkXCIsIHtjbGFzc05hbWU6IFwiY29sLXNpemVcIn0sIHNpemUpO1xuICAgIH1cbn0pO1xuXG5cbnZhciBUaW1lQ29sdW1uID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIlRpbWVDb2x1bW5cIixcbiAgICBzdGF0aWNzOiB7XG4gICAgICAgIHJlbmRlclRpdGxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInRoXCIsIHtrZXk6IFwidGltZVwiLCBjbGFzc05hbWU6IFwiY29sLXRpbWVcIn0sIFwiVGltZVwiKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuICAgICAgICB2YXIgdGltZTtcbiAgICAgICAgaWYgKGZsb3cucmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHRpbWUgPSB1dGlscy5mb3JtYXRUaW1lRGVsdGEoMTAwMCAqIChmbG93LnJlc3BvbnNlLnRpbWVzdGFtcF9lbmQgLSBmbG93LnJlcXVlc3QudGltZXN0YW1wX3N0YXJ0KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aW1lID0gXCIuLi5cIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInRkXCIsIHtjbGFzc05hbWU6IFwiY29sLXRpbWVcIn0sIHRpbWUpO1xuICAgIH1cbn0pO1xuXG5cbnZhciBhbGxfY29sdW1ucyA9IFtcbiAgICBUTFNDb2x1bW4sXG4gICAgSWNvbkNvbHVtbixcbiAgICBQYXRoQ29sdW1uLFxuICAgIE1ldGhvZENvbHVtbixcbiAgICBTdGF0dXNDb2x1bW4sXG4gICAgU2l6ZUNvbHVtbixcbiAgICBUaW1lQ29sdW1uXTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGFsbF9jb2x1bW5zO1xuXG5cbiIsInZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcbnZhciBjb21tb24gPSByZXF1aXJlKFwiLi9jb21tb24uanNcIik7XG52YXIgVmlydHVhbFNjcm9sbE1peGluID0gcmVxdWlyZShcIi4vdmlydHVhbHNjcm9sbC5qc1wiKTtcbnZhciBmbG93dGFibGVfY29sdW1ucyA9IHJlcXVpcmUoXCIuL2Zsb3d0YWJsZS1jb2x1bW5zLmpzXCIpO1xuXG52YXIgRmxvd1JvdyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJGbG93Um93XCIsXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmbG93ID0gdGhpcy5wcm9wcy5mbG93O1xuICAgICAgICB2YXIgY29sdW1ucyA9IHRoaXMucHJvcHMuY29sdW1ucy5tYXAoZnVuY3Rpb24gKENvbHVtbikge1xuICAgICAgICAgICAgcmV0dXJuIFJlYWN0LmNyZWF0ZUVsZW1lbnQoQ29sdW1uLCB7a2V5OiBDb2x1bW4uZGlzcGxheU5hbWUsIGZsb3c6IGZsb3d9KTtcbiAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgdmFyIGNsYXNzTmFtZSA9IFwiXCI7XG4gICAgICAgIGlmICh0aGlzLnByb3BzLnNlbGVjdGVkKSB7XG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCIgc2VsZWN0ZWRcIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5wcm9wcy5oaWdobGlnaHRlZCkge1xuICAgICAgICAgICAgY2xhc3NOYW1lICs9IFwiIGhpZ2hsaWdodGVkXCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZsb3cuaW50ZXJjZXB0ZWQpIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcIiBpbnRlcmNlcHRlZFwiO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbG93LnJlcXVlc3QpIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZSArPSBcIiBoYXMtcmVxdWVzdFwiO1xuICAgICAgICB9XG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICBjbGFzc05hbWUgKz0gXCIgaGFzLXJlc3BvbnNlXCI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcInRyXCIsIHtjbGFzc05hbWU6IGNsYXNzTmFtZSwgb25DbGljazogdGhpcy5wcm9wcy5zZWxlY3RGbG93LmJpbmQobnVsbCwgZmxvdyl9LCBcbiAgICAgICAgICAgICAgICBjb2x1bW5zXG4gICAgICAgICAgICApKTtcbiAgICB9LFxuICAgIHNob3VsZENvbXBvbmVudFVwZGF0ZTogZnVuY3Rpb24gKG5leHRQcm9wcykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgLy8gRnVydGhlciBvcHRpbWl6YXRpb24gY291bGQgYmUgZG9uZSBoZXJlXG4gICAgICAgIC8vIGJ5IGNhbGxpbmcgZm9yY2VVcGRhdGUgb24gZmxvdyB1cGRhdGVzLCBzZWxlY3Rpb24gY2hhbmdlcyBhbmQgY29sdW1uIGNoYW5nZXMuXG4gICAgICAgIC8vcmV0dXJuIChcbiAgICAgICAgLy8odGhpcy5wcm9wcy5jb2x1bW5zLmxlbmd0aCAhPT0gbmV4dFByb3BzLmNvbHVtbnMubGVuZ3RoKSB8fFxuICAgICAgICAvLyh0aGlzLnByb3BzLnNlbGVjdGVkICE9PSBuZXh0UHJvcHMuc2VsZWN0ZWQpXG4gICAgICAgIC8vKTtcbiAgICB9XG59KTtcblxudmFyIEZsb3dUYWJsZUhlYWQgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiRmxvd1RhYmxlSGVhZFwiLFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgY29sdW1ucyA9IHRoaXMucHJvcHMuY29sdW1ucy5tYXAoZnVuY3Rpb24gKGNvbHVtbikge1xuICAgICAgICAgICAgcmV0dXJuIGNvbHVtbi5yZW5kZXJUaXRsZSgpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInRoZWFkXCIsIG51bGwsIFxuICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcInRyXCIsIG51bGwsIGNvbHVtbnMpXG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cblxudmFyIFJPV19IRUlHSFQgPSAzMjtcblxudmFyIEZsb3dUYWJsZSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJGbG93VGFibGVcIixcbiAgICBtaXhpbnM6IFtjb21tb24uU3RpY2t5SGVhZE1peGluLCBjb21tb24uQXV0b1Njcm9sbE1peGluLCBWaXJ0dWFsU2Nyb2xsTWl4aW5dLFxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29sdW1uczogZmxvd3RhYmxlX2NvbHVtbnNcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxNb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodGhpcy5wcm9wcy52aWV3KSB7XG4gICAgICAgICAgICB0aGlzLnByb3BzLnZpZXcuYWRkTGlzdGVuZXIoXCJhZGQgdXBkYXRlIHJlbW92ZSByZWNhbGN1bGF0ZVwiLCB0aGlzLm9uQ2hhbmdlKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wczogZnVuY3Rpb24gKG5leHRQcm9wcykge1xuICAgICAgICBpZiAobmV4dFByb3BzLnZpZXcgIT09IHRoaXMucHJvcHMudmlldykge1xuICAgICAgICAgICAgaWYgKHRoaXMucHJvcHMudmlldykge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5yZW1vdmVMaXN0ZW5lcihcImFkZCB1cGRhdGUgcmVtb3ZlIHJlY2FsY3VsYXRlXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbmV4dFByb3BzLnZpZXcuYWRkTGlzdGVuZXIoXCJhZGQgdXBkYXRlIHJlbW92ZSByZWNhbGN1bGF0ZVwiLCB0aGlzLm9uQ2hhbmdlKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgZ2V0RGVmYXVsdFByb3BzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByb3dIZWlnaHQ6IFJPV19IRUlHSFRcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIG9uU2Nyb2xsRmxvd1RhYmxlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuYWRqdXN0SGVhZCgpO1xuICAgICAgICB0aGlzLm9uU2Nyb2xsKCk7XG4gICAgfSxcbiAgICBvbkNoYW5nZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmZvcmNlVXBkYXRlKCk7XG4gICAgfSxcbiAgICBzY3JvbGxJbnRvVmlldzogZnVuY3Rpb24gKGZsb3cpIHtcbiAgICAgICAgdGhpcy5zY3JvbGxSb3dJbnRvVmlldyhcbiAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5pbmRleChmbG93KSxcbiAgICAgICAgICAgIHRoaXMucmVmcy5ib2R5LmdldERPTU5vZGUoKS5vZmZzZXRUb3BcbiAgICAgICAgKTtcbiAgICB9LFxuICAgIHJlbmRlclJvdzogZnVuY3Rpb24gKGZsb3cpIHtcbiAgICAgICAgdmFyIHNlbGVjdGVkID0gKGZsb3cgPT09IHRoaXMucHJvcHMuc2VsZWN0ZWQpO1xuICAgICAgICB2YXIgaGlnaGxpZ2h0ZWQgPVxuICAgICAgICAgICAgKFxuICAgICAgICAgICAgdGhpcy5wcm9wcy52aWV3Ll9oaWdobGlnaHQgJiZcbiAgICAgICAgICAgIHRoaXMucHJvcHMudmlldy5faGlnaGxpZ2h0W2Zsb3cuaWRdXG4gICAgICAgICAgICApO1xuXG4gICAgICAgIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KEZsb3dSb3csIHtrZXk6IGZsb3cuaWQsIFxuICAgICAgICAgICAgcmVmOiBmbG93LmlkLCBcbiAgICAgICAgICAgIGZsb3c6IGZsb3csIFxuICAgICAgICAgICAgY29sdW1uczogdGhpcy5zdGF0ZS5jb2x1bW5zLCBcbiAgICAgICAgICAgIHNlbGVjdGVkOiBzZWxlY3RlZCwgXG4gICAgICAgICAgICBoaWdobGlnaHRlZDogaGlnaGxpZ2h0ZWQsIFxuICAgICAgICAgICAgc2VsZWN0RmxvdzogdGhpcy5wcm9wcy5zZWxlY3RGbG93fVxuICAgICAgICApO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJyZW5kZXIgZmxvd3RhYmxlXCIsIHRoaXMuc3RhdGUuc3RhcnQsIHRoaXMuc3RhdGUuc3RvcCwgdGhpcy5wcm9wcy5zZWxlY3RlZCk7XG4gICAgICAgIHZhciBmbG93cyA9IHRoaXMucHJvcHMudmlldyA/IHRoaXMucHJvcHMudmlldy5saXN0IDogW107XG5cbiAgICAgICAgdmFyIHJvd3MgPSB0aGlzLnJlbmRlclJvd3MoZmxvd3MpO1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIHtjbGFzc05hbWU6IFwiZmxvdy10YWJsZVwiLCBvblNjcm9sbDogdGhpcy5vblNjcm9sbEZsb3dUYWJsZX0sIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0YWJsZVwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChGbG93VGFibGVIZWFkLCB7cmVmOiBcImhlYWRcIiwgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2x1bW5zOiB0aGlzLnN0YXRlLmNvbHVtbnN9KSwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0Ym9keVwiLCB7cmVmOiBcImJvZHlcIn0sIFxuICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2V0UGxhY2Vob2xkZXJUb3AoZmxvd3MubGVuZ3RoKSwgXG4gICAgICAgICAgICAgICAgICAgICAgICByb3dzLCBcbiAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFBsYWNlaG9sZGVyQm90dG9tKGZsb3dzLmxlbmd0aCkgXG4gICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRmxvd1RhYmxlO1xuIiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xuXG52YXIgRm9vdGVyID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIkZvb3RlclwiLFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbW9kZSA9IHRoaXMucHJvcHMuc2V0dGluZ3MubW9kZTtcbiAgICAgICAgdmFyIGludGVyY2VwdCA9IHRoaXMucHJvcHMuc2V0dGluZ3MuaW50ZXJjZXB0O1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImZvb3RlclwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICBtb2RlICE9IFwicmVndWxhclwiID8gUmVhY3QuY3JlYXRlRWxlbWVudChcInNwYW5cIiwge2NsYXNzTmFtZTogXCJsYWJlbCBsYWJlbC1zdWNjZXNzXCJ9LCBtb2RlLCBcIiBtb2RlXCIpIDogbnVsbCwgXG4gICAgICAgICAgICAgICAgXCLCoFwiLCBcbiAgICAgICAgICAgICAgICBpbnRlcmNlcHQgPyBSZWFjdC5jcmVhdGVFbGVtZW50KFwic3BhblwiLCB7Y2xhc3NOYW1lOiBcImxhYmVsIGxhYmVsLXN1Y2Nlc3NcIn0sIFwiSW50ZXJjZXB0OiBcIiwgaW50ZXJjZXB0KSA6IG51bGxcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBGb290ZXI7IiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xudmFyICQgPSByZXF1aXJlKFwianF1ZXJ5XCIpO1xuXG52YXIgY29tbW9uID0gcmVxdWlyZShcIi4vY29tbW9uLmpzXCIpO1xuXG52YXIgRmlsdGVyRG9jcyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJGaWx0ZXJEb2NzXCIsXG4gICAgc3RhdGljczoge1xuICAgICAgICB4aHI6IGZhbHNlLFxuICAgICAgICBkb2M6IGZhbHNlXG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCFGaWx0ZXJEb2NzLmRvYykge1xuICAgICAgICAgICAgRmlsdGVyRG9jcy54aHIgPSAkLmdldEpTT04oXCIvZmlsdGVyLWhlbHBcIikuZG9uZShmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgICAgICAgRmlsdGVyRG9jcy5kb2MgPSBkb2M7XG4gICAgICAgICAgICAgICAgRmlsdGVyRG9jcy54aHIgPSBmYWxzZTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIGlmIChGaWx0ZXJEb2NzLnhocikge1xuICAgICAgICAgICAgRmlsdGVyRG9jcy54aHIuZG9uZShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mb3JjZVVwZGF0ZSgpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghRmlsdGVyRG9jcy5kb2MpIHtcbiAgICAgICAgICAgIHJldHVybiBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaVwiLCB7Y2xhc3NOYW1lOiBcImZhIGZhLXNwaW5uZXIgZmEtc3BpblwifSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgY29tbWFuZHMgPSBGaWx0ZXJEb2NzLmRvYy5jb21tYW5kcy5tYXAoZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInRyXCIsIG51bGwsIFxuICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGRcIiwgbnVsbCwgY1swXS5yZXBsYWNlKFwiIFwiLCAnXFx1MDBhMCcpKSwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCBudWxsLCBjWzFdKVxuICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGNvbW1hbmRzLnB1c2goUmVhY3QuY3JlYXRlRWxlbWVudChcInRyXCIsIG51bGwsIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJ0ZFwiLCB7Y29sU3BhbjogXCIyXCJ9LCBcbiAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImFcIiwge2hyZWY6IFwiaHR0cHM6Ly9taXRtcHJveHkub3JnL2RvYy9mZWF0dXJlcy9maWx0ZXJzLmh0bWxcIiwgXG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXQ6IFwiX2JsYW5rXCJ9LCBcbiAgICAgICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJpXCIsIHtjbGFzc05hbWU6IFwiZmEgZmEtZXh0ZXJuYWwtbGlua1wifSksIFxuICAgICAgICAgICAgICAgICAgICBcIsKgIG1pdG1wcm94eSBkb2NzXCIpXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcInRhYmxlXCIsIHtjbGFzc05hbWU6IFwidGFibGUgdGFibGUtY29uZGVuc2VkXCJ9LCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidGJvZHlcIiwgbnVsbCwgY29tbWFuZHMpXG4gICAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgfVxufSk7XG52YXIgRmlsdGVySW5wdXQgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiRmlsdGVySW5wdXRcIixcbiAgICBnZXRJbml0aWFsU3RhdGU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gQ29uc2lkZXIgYm90aCBmb2N1cyBhbmQgbW91c2VvdmVyIGZvciBzaG93aW5nL2hpZGluZyB0aGUgdG9vbHRpcCxcbiAgICAgICAgLy8gYmVjYXVzZSBvbkJsdXIgb2YgdGhlIGlucHV0IGlzIHRyaWdnZXJlZCBiZWZvcmUgdGhlIGNsaWNrIG9uIHRoZSB0b29sdGlwXG4gICAgICAgIC8vIGZpbmFsaXplZCwgaGlkaW5nIHRoZSB0b29sdGlwIGp1c3QgYXMgdGhlIHVzZXIgY2xpY2tzIG9uIGl0LlxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMucHJvcHMudmFsdWUsXG4gICAgICAgICAgICBmb2N1czogZmFsc2UsXG4gICAgICAgICAgICBtb3VzZWZvY3VzOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wczogZnVuY3Rpb24gKG5leHRQcm9wcykge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHt2YWx1ZTogbmV4dFByb3BzLnZhbHVlfSk7XG4gICAgfSxcbiAgICBvbkNoYW5nZTogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgdmFyIG5leHRWYWx1ZSA9IGUudGFyZ2V0LnZhbHVlO1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgICAgIHZhbHVlOiBuZXh0VmFsdWVcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIE9ubHkgcHJvcGFnYXRlIHZhbGlkIGZpbHRlcnMgdXB3YXJkcy5cbiAgICAgICAgaWYgKHRoaXMuaXNWYWxpZChuZXh0VmFsdWUpKSB7XG4gICAgICAgICAgICB0aGlzLnByb3BzLm9uQ2hhbmdlKG5leHRWYWx1ZSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGlzVmFsaWQ6IGZ1bmN0aW9uIChmaWx0KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBGaWx0LnBhcnNlKGZpbHQgfHwgdGhpcy5zdGF0ZS52YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXREZXNjOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBkZXNjO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgZGVzYyA9IEZpbHQucGFyc2UodGhpcy5zdGF0ZS52YWx1ZSkuZGVzYztcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgZGVzYyA9IFwiXCIgKyBlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChkZXNjICE9PSBcInRydWVcIikge1xuICAgICAgICAgICAgcmV0dXJuIGRlc2M7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoRmlsdGVyRG9jcywgbnVsbClcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIG9uRm9jdXM6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7Zm9jdXM6IHRydWV9KTtcbiAgICB9LFxuICAgIG9uQmx1cjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtmb2N1czogZmFsc2V9KTtcbiAgICB9LFxuICAgIG9uTW91c2VFbnRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHttb3VzZWZvY3VzOiB0cnVlfSk7XG4gICAgfSxcbiAgICBvbk1vdXNlTGVhdmU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7bW91c2Vmb2N1czogZmFsc2V9KTtcbiAgICB9LFxuICAgIG9uS2V5RG93bjogZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gS2V5LkVTQyB8fCBlLmtleUNvZGUgPT09IEtleS5FTlRFUikge1xuICAgICAgICAgICAgdGhpcy5ibHVyKCk7XG4gICAgICAgICAgICAvLyBJZiBjbG9zZWQgdXNpbmcgRVNDL0VOVEVSLCBoaWRlIHRoZSB0b29sdGlwLlxuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7bW91c2Vmb2N1czogZmFsc2V9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgYmx1cjogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnJlZnMuaW5wdXQuZ2V0RE9NTm9kZSgpLmJsdXIoKTtcbiAgICB9LFxuICAgIGZvY3VzOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMucmVmcy5pbnB1dC5nZXRET01Ob2RlKCkuc2VsZWN0KCk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGlzVmFsaWQgPSB0aGlzLmlzVmFsaWQoKTtcbiAgICAgICAgdmFyIGljb24gPSBcImZhIGZhLWZ3IGZhLVwiICsgdGhpcy5wcm9wcy50eXBlO1xuICAgICAgICB2YXIgZ3JvdXBDbGFzc05hbWUgPSBcImZpbHRlci1pbnB1dCBpbnB1dC1ncm91cFwiICsgKGlzVmFsaWQgPyBcIlwiIDogXCIgaGFzLWVycm9yXCIpO1xuXG4gICAgICAgIHZhciBwb3BvdmVyO1xuICAgICAgICBpZiAodGhpcy5zdGF0ZS5mb2N1cyB8fCB0aGlzLnN0YXRlLm1vdXNlZm9jdXMpIHtcbiAgICAgICAgICAgIHBvcG92ZXIgPSAoXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCB7Y2xhc3NOYW1lOiBcInBvcG92ZXIgYm90dG9tXCIsIG9uTW91c2VFbnRlcjogdGhpcy5vbk1vdXNlRW50ZXIsIG9uTW91c2VMZWF2ZTogdGhpcy5vbk1vdXNlTGVhdmV9LCBcbiAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCB7Y2xhc3NOYW1lOiBcImFycm93XCJ9KSwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiwge2NsYXNzTmFtZTogXCJwb3BvdmVyLWNvbnRlbnRcIn0sIFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmdldERlc2MoKVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIHtjbGFzc05hbWU6IGdyb3VwQ2xhc3NOYW1lfSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcInNwYW5cIiwge2NsYXNzTmFtZTogXCJpbnB1dC1ncm91cC1hZGRvblwifSwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJpXCIsIHtjbGFzc05hbWU6IGljb24sIHN0eWxlOiB7Y29sb3I6IHRoaXMucHJvcHMuY29sb3J9fSlcbiAgICAgICAgICAgICAgICApLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaW5wdXRcIiwge3R5cGU6IFwidGV4dFwiLCBwbGFjZWhvbGRlcjogdGhpcy5wcm9wcy5wbGFjZWhvbGRlciwgY2xhc3NOYW1lOiBcImZvcm0tY29udHJvbFwiLCBcbiAgICAgICAgICAgICAgICAgICAgcmVmOiBcImlucHV0XCIsIFxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZTogdGhpcy5vbkNoYW5nZSwgXG4gICAgICAgICAgICAgICAgICAgIG9uRm9jdXM6IHRoaXMub25Gb2N1cywgXG4gICAgICAgICAgICAgICAgICAgIG9uQmx1cjogdGhpcy5vbkJsdXIsIFxuICAgICAgICAgICAgICAgICAgICBvbktleURvd246IHRoaXMub25LZXlEb3duLCBcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHRoaXMuc3RhdGUudmFsdWV9KSwgXG4gICAgICAgICAgICAgICAgcG9wb3ZlclxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG52YXIgTWFpbk1lbnUgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiTWFpbk1lbnVcIixcbiAgICBtaXhpbnM6IFtjb21tb24uTmF2aWdhdGlvbiwgY29tbW9uLlN0YXRlXSxcbiAgICBzdGF0aWNzOiB7XG4gICAgICAgIHRpdGxlOiBcIlN0YXJ0XCIsXG4gICAgICAgIHJvdXRlOiBcImZsb3dzXCJcbiAgICB9LFxuICAgIG9uRmlsdGVyQ2hhbmdlOiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIHZhciBkID0ge307XG4gICAgICAgIGRbUXVlcnkuRklMVEVSXSA9IHZhbDtcbiAgICAgICAgdGhpcy5zZXRRdWVyeShkKTtcbiAgICB9LFxuICAgIG9uSGlnaGxpZ2h0Q2hhbmdlOiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIHZhciBkID0ge307XG4gICAgICAgIGRbUXVlcnkuSElHSExJR0hUXSA9IHZhbDtcbiAgICAgICAgdGhpcy5zZXRRdWVyeShkKTtcbiAgICB9LFxuICAgIG9uSW50ZXJjZXB0Q2hhbmdlOiBmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIFNldHRpbmdzQWN0aW9ucy51cGRhdGUoe2ludGVyY2VwdDogdmFsfSk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZpbHRlciA9IHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5GSUxURVJdIHx8IFwiXCI7XG4gICAgICAgIHZhciBoaWdobGlnaHQgPSB0aGlzLmdldFF1ZXJ5KClbUXVlcnkuSElHSExJR0hUXSB8fCBcIlwiO1xuICAgICAgICB2YXIgaW50ZXJjZXB0ID0gdGhpcy5wcm9wcy5zZXR0aW5ncy5pbnRlcmNlcHQgfHwgXCJcIjtcblxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiZGl2XCIsIHtjbGFzc05hbWU6IFwibWVudS1yb3dcIn0sIFxuICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KEZpbHRlcklucHV0LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogXCJGaWx0ZXJcIiwgXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcImZpbHRlclwiLCBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbG9yOiBcImJsYWNrXCIsIFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGZpbHRlciwgXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZTogdGhpcy5vbkZpbHRlckNoYW5nZX0pLCBcbiAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChGaWx0ZXJJbnB1dCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGxhY2Vob2xkZXI6IFwiSGlnaGxpZ2h0XCIsIFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogXCJ0YWdcIiwgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb2xvcjogXCJoc2woNDgsIDEwMCUsIDUwJSlcIiwgXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogaGlnaGxpZ2h0LCBcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2hhbmdlOiB0aGlzLm9uSGlnaGxpZ2h0Q2hhbmdlfSksIFxuICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KEZpbHRlcklucHV0LCB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwbGFjZWhvbGRlcjogXCJJbnRlcmNlcHRcIiwgXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBcInBhdXNlXCIsIFxuICAgICAgICAgICAgICAgICAgICAgICAgY29sb3I6IFwiaHNsKDIwOCwgNTYlLCA1MyUpXCIsIFxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGludGVyY2VwdCwgXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZTogdGhpcy5vbkludGVyY2VwdENoYW5nZX0pXG4gICAgICAgICAgICAgICAgKSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCB7Y2xhc3NOYW1lOiBcImNsZWFyZml4XCJ9KVxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5cbnZhciBWaWV3TWVudSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJWaWV3TWVudVwiLFxuICAgIHN0YXRpY3M6IHtcbiAgICAgICAgdGl0bGU6IFwiVmlld1wiLFxuICAgICAgICByb3V0ZTogXCJmbG93c1wiXG4gICAgfSxcbiAgICBtaXhpbnM6IFtjb21tb24uTmF2aWdhdGlvbiwgY29tbW9uLlN0YXRlXSxcbiAgICB0b2dnbGVFdmVudExvZzogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZCA9IHt9O1xuXG4gICAgICAgIGlmICh0aGlzLmdldFF1ZXJ5KClbUXVlcnkuU0hPV19FVkVOVExPR10pIHtcbiAgICAgICAgICAgIGRbUXVlcnkuU0hPV19FVkVOVExPR10gPSB1bmRlZmluZWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkW1F1ZXJ5LlNIT1dfRVZFTlRMT0ddID0gXCJ0XCI7IC8vIGFueSBub24tZmFsc2UgdmFsdWUgd2lsbCBkbyBpdCwga2VlcCBpdCBzaG9ydFxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5zZXRRdWVyeShkKTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc2hvd0V2ZW50TG9nID0gdGhpcy5nZXRRdWVyeSgpW1F1ZXJ5LlNIT1dfRVZFTlRMT0ddO1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiYnV0dG9uXCIsIHtcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiBcImJ0biBcIiArIChzaG93RXZlbnRMb2cgPyBcImJ0bi1wcmltYXJ5XCIgOiBcImJ0bi1kZWZhdWx0XCIpLCBcbiAgICAgICAgICAgICAgICAgICAgb25DbGljazogdGhpcy50b2dnbGVFdmVudExvZ30sIFxuICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaVwiLCB7Y2xhc3NOYW1lOiBcImZhIGZhLWRhdGFiYXNlXCJ9KSwgXG4gICAgICAgICAgICAgICAgXCLCoFNob3cgRXZlbnRsb2dcIlxuICAgICAgICAgICAgICAgICksIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIsIG51bGwsIFwiIFwiKVxuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5cbnZhciBSZXBvcnRzTWVudSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJSZXBvcnRzTWVudVwiLFxuICAgIHN0YXRpY3M6IHtcbiAgICAgICAgdGl0bGU6IFwiVmlzdWFsaXphdGlvblwiLFxuICAgICAgICByb3V0ZTogXCJyZXBvcnRzXCJcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCBudWxsLCBcIlJlcG9ydHMgTWVudVwiKTtcbiAgICB9XG59KTtcblxudmFyIEZpbGVNZW51ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIkZpbGVNZW51XCIsXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzaG93RmlsZU1lbnU6IGZhbHNlXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBoYW5kbGVGaWxlQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgaWYgKCF0aGlzLnN0YXRlLnNob3dGaWxlTWVudSkge1xuICAgICAgICAgICAgdmFyIGNsb3NlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2V0U3RhdGUoe3Nob3dGaWxlTWVudTogZmFsc2V9KTtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgY2xvc2UpO1xuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGNsb3NlKTtcblxuICAgICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICAgICAgc2hvd0ZpbGVNZW51OiB0cnVlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgaGFuZGxlTmV3Q2xpY2s6IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgaWYgKGNvbmZpcm0oXCJEZWxldGUgYWxsIGZsb3dzP1wiKSkge1xuICAgICAgICAgICAgRmxvd0FjdGlvbnMuY2xlYXIoKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgaGFuZGxlT3BlbkNsaWNrOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJ1bmltcGxlbWVudGVkOiBoYW5kbGVPcGVuQ2xpY2tcIik7XG4gICAgfSxcbiAgICBoYW5kbGVTYXZlQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihcInVuaW1wbGVtZW50ZWQ6IGhhbmRsZVNhdmVDbGlja1wiKTtcbiAgICB9LFxuICAgIGhhbmRsZVNodXRkb3duQ2xpY2s6IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgY29uc29sZS5lcnJvcihcInVuaW1wbGVtZW50ZWQ6IGhhbmRsZVNodXRkb3duQ2xpY2tcIik7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZpbGVNZW51Q2xhc3MgPSBcImRyb3Bkb3duIHB1bGwtbGVmdFwiICsgKHRoaXMuc3RhdGUuc2hvd0ZpbGVNZW51ID8gXCIgb3BlblwiIDogXCJcIik7XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiwge2NsYXNzTmFtZTogZmlsZU1lbnVDbGFzc30sIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJhXCIsIHtocmVmOiBcIiNcIiwgY2xhc3NOYW1lOiBcInNwZWNpYWxcIiwgb25DbGljazogdGhpcy5oYW5kbGVGaWxlQ2xpY2t9LCBcIiBtaXRtcHJveHkgXCIpLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwidWxcIiwge2NsYXNzTmFtZTogXCJkcm9wZG93bi1tZW51XCIsIHJvbGU6IFwibWVudVwifSwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJsaVwiLCBudWxsLCBcbiAgICAgICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJhXCIsIHtocmVmOiBcIiNcIiwgb25DbGljazogdGhpcy5oYW5kbGVOZXdDbGlja30sIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJpXCIsIHtjbGFzc05hbWU6IFwiZmEgZmEtZncgZmEtZmlsZVwifSksIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiTmV3XCJcbiAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgKSwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJsaVwiLCB7cm9sZTogXCJwcmVzZW50YXRpb25cIiwgY2xhc3NOYW1lOiBcImRpdmlkZXJcIn0pLCBcbiAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImxpXCIsIG51bGwsIFxuICAgICAgICAgICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImFcIiwge2hyZWY6IFwiaHR0cDovL21pdG0uaXQvXCIsIHRhcmdldDogXCJfYmxhbmtcIn0sIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJpXCIsIHtjbGFzc05hbWU6IFwiZmEgZmEtZncgZmEtZXh0ZXJuYWwtbGlua1wifSksIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiSW5zdGFsbCBDZXJ0aWZpY2F0ZXMuLi5cIlxuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgICAgPGxpPlxuICAgICAgICAgICAgICAgICA8YSBocmVmPVwiI1wiIG9uQ2xpY2s9e3RoaXMuaGFuZGxlT3BlbkNsaWNrfT5cbiAgICAgICAgICAgICAgICAgPGkgY2xhc3NOYW1lPVwiZmEgZmEtZncgZmEtZm9sZGVyLW9wZW5cIj48L2k+XG4gICAgICAgICAgICAgICAgIE9wZW5cbiAgICAgICAgICAgICAgICAgPC9hPlxuICAgICAgICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICAgICAgICA8bGk+XG4gICAgICAgICAgICAgICAgIDxhIGhyZWY9XCIjXCIgb25DbGljaz17dGhpcy5oYW5kbGVTYXZlQ2xpY2t9PlxuICAgICAgICAgICAgICAgICA8aSBjbGFzc05hbWU9XCJmYSBmYS1mdyBmYS1zYXZlXCI+PC9pPlxuICAgICAgICAgICAgICAgICBTYXZlXG4gICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgICAgICAgPGxpIHJvbGU9XCJwcmVzZW50YXRpb25cIiBjbGFzc05hbWU9XCJkaXZpZGVyXCI+PC9saT5cbiAgICAgICAgICAgICAgICAgPGxpPlxuICAgICAgICAgICAgICAgICA8YSBocmVmPVwiI1wiIG9uQ2xpY2s9e3RoaXMuaGFuZGxlU2h1dGRvd25DbGlja30+XG4gICAgICAgICAgICAgICAgIDxpIGNsYXNzTmFtZT1cImZhIGZhLWZ3IGZhLXBsdWdcIj48L2k+XG4gICAgICAgICAgICAgICAgIFNodXRkb3duXG4gICAgICAgICAgICAgICAgIDwvYT5cbiAgICAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cblxudmFyIGhlYWRlcl9lbnRyaWVzID0gW01haW5NZW51LCBWaWV3TWVudSAvKiwgUmVwb3J0c01lbnUgKi9dO1xuXG5cbnZhciBIZWFkZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiSGVhZGVyXCIsXG4gICAgbWl4aW5zOiBbY29tbW9uLk5hdmlnYXRpb25dLFxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgYWN0aXZlOiBoZWFkZXJfZW50cmllc1swXVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgaGFuZGxlQ2xpY2s6IGZ1bmN0aW9uIChhY3RpdmUsIGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB0aGlzLnJlcGxhY2VXaXRoKGFjdGl2ZS5yb3V0ZSk7XG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe2FjdGl2ZTogYWN0aXZlfSk7XG4gICAgfSxcbiAgICByZW5kZXI6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGhlYWRlciA9IGhlYWRlcl9lbnRyaWVzLm1hcChmdW5jdGlvbiAoZW50cnksIGkpIHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gUmVhY3QuYWRkb25zLmNsYXNzU2V0KHtcbiAgICAgICAgICAgICAgICBhY3RpdmU6IGVudHJ5ID09IHRoaXMuc3RhdGUuYWN0aXZlXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImFcIiwge2tleTogaSwgXG4gICAgICAgICAgICAgICAgICAgIGhyZWY6IFwiI1wiLCBcbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiBjbGFzc2VzLCBcbiAgICAgICAgICAgICAgICAgICAgb25DbGljazogdGhpcy5oYW5kbGVDbGljay5iaW5kKHRoaXMsIGVudHJ5KVxuICAgICAgICAgICAgICAgIH0sIFxuICAgICAgICAgICAgICAgICAgICAgZW50cnkudGl0bGVcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFwiaGVhZGVyXCIsIG51bGwsIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJuYXZcIiwge2NsYXNzTmFtZTogXCJuYXYtdGFicyBuYXYtdGFicy1sZ1wifSwgXG4gICAgICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoRmlsZU1lbnUsIG51bGwpLCBcbiAgICAgICAgICAgICAgICAgICAgaGVhZGVyXG4gICAgICAgICAgICAgICAgKSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCB7Y2xhc3NOYW1lOiBcIm1lbnVcIn0sIFxuICAgICAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KHRoaXMuc3RhdGUuYWN0aXZlLCB7c2V0dGluZ3M6IHRoaXMucHJvcHMuc2V0dGluZ3N9KVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgIClcbiAgICAgICAgKTtcbiAgICB9XG59KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBIZWFkZXI6IEhlYWRlclxufSIsInZhciBSZWFjdCA9IHJlcXVpcmUoXCJyZWFjdFwiKTtcblxudmFyIGNvbW1vbiA9IHJlcXVpcmUoXCIuL2NvbW1vbi5qc1wiKTtcbnZhciB0b3B1dGlscyA9IHJlcXVpcmUoXCIuLi91dGlscy5qc1wiKTtcbnZhciB2aWV3cyA9IHJlcXVpcmUoXCIuLi9zdG9yZS92aWV3LmpzXCIpO1xudmFyIEZpbHQgPSByZXF1aXJlKFwiLi4vZmlsdC9maWx0LmpzXCIpO1xuRmxvd1RhYmxlID0gcmVxdWlyZShcIi4vZmxvd3RhYmxlLmpzXCIpO1xudmFyIGZsb3dkZXRhaWwgPSByZXF1aXJlKFwiLi9mbG93ZGV0YWlsLmpzXCIpO1xuXG5cbnZhciBNYWluVmlldyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtkaXNwbGF5TmFtZTogXCJNYWluVmlld1wiLFxuICAgIG1peGluczogW2NvbW1vbi5OYXZpZ2F0aW9uLCBjb21tb24uU3RhdGVdLFxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLm9uUXVlcnlDaGFuZ2UoUXVlcnkuRklMVEVSLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlLnZpZXcucmVjYWxjdWxhdGUodGhpcy5nZXRWaWV3RmlsdCgpLCB0aGlzLmdldFZpZXdTb3J0KCkpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB0aGlzLm9uUXVlcnlDaGFuZ2UoUXVlcnkuSElHSExJR0hULCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLnN0YXRlLnZpZXcucmVjYWxjdWxhdGUodGhpcy5nZXRWaWV3RmlsdCgpLCB0aGlzLmdldFZpZXdTb3J0KCkpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZmxvd3M6IFtdXG4gICAgICAgIH07XG4gICAgfSxcbiAgICBnZXRWaWV3RmlsdDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGZpbHQgPSBGaWx0LnBhcnNlKHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5GSUxURVJdIHx8IFwiXCIpO1xuICAgICAgICAgICAgdmFyIGhpZ2hsaWdodFN0ciA9IHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5ISUdITElHSFRdO1xuICAgICAgICAgICAgdmFyIGhpZ2hsaWdodCA9IGhpZ2hsaWdodFN0ciA/IEZpbHQucGFyc2UoaGlnaGxpZ2h0U3RyKSA6IGZhbHNlO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3Igd2hlbiBwcm9jZXNzaW5nIGZpbHRlcjogXCIgKyBlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBmaWx0ZXJfYW5kX2hpZ2hsaWdodChmbG93KSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuX2hpZ2hsaWdodCkge1xuICAgICAgICAgICAgICAgIHRoaXMuX2hpZ2hsaWdodCA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5faGlnaGxpZ2h0W2Zsb3cuaWRdID0gaGlnaGxpZ2h0ICYmIGhpZ2hsaWdodChmbG93KTtcbiAgICAgICAgICAgIHJldHVybiBmaWx0KGZsb3cpO1xuICAgICAgICB9O1xuICAgIH0sXG4gICAgZ2V0Vmlld1NvcnQ6IGZ1bmN0aW9uICgpIHtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHM6IGZ1bmN0aW9uIChuZXh0UHJvcHMpIHtcbiAgICAgICAgaWYgKG5leHRQcm9wcy5mbG93U3RvcmUgIT09IHRoaXMucHJvcHMuZmxvd1N0b3JlKSB7XG4gICAgICAgICAgICB0aGlzLmNsb3NlVmlldygpO1xuICAgICAgICAgICAgdGhpcy5vcGVuVmlldyhuZXh0UHJvcHMuZmxvd1N0b3JlKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgb3BlblZpZXc6IGZ1bmN0aW9uIChzdG9yZSkge1xuICAgICAgICB2YXIgdmlldyA9IG5ldyB2aWV3cy5TdG9yZVZpZXcoc3RvcmUsIHRoaXMuZ2V0Vmlld0ZpbHQoKSwgdGhpcy5nZXRWaWV3U29ydCgpKTtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICB2aWV3OiB2aWV3XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZpZXcuYWRkTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLm9uUmVjYWxjdWxhdGUpO1xuICAgICAgICB2aWV3LmFkZExpc3RlbmVyKFwiYWRkIHVwZGF0ZSByZW1vdmVcIiwgdGhpcy5vblVwZGF0ZSk7XG4gICAgICAgIHZpZXcuYWRkTGlzdGVuZXIoXCJyZW1vdmVcIiwgdGhpcy5vblJlbW92ZSk7XG4gICAgfSxcbiAgICBvblJlY2FsY3VsYXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuZm9yY2VVcGRhdGUoKTtcbiAgICAgICAgdmFyIHNlbGVjdGVkID0gdGhpcy5nZXRTZWxlY3RlZCgpO1xuICAgICAgICBpZiAoc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgIHRoaXMucmVmcy5mbG93VGFibGUuc2Nyb2xsSW50b1ZpZXcoc2VsZWN0ZWQpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBvblVwZGF0ZTogZnVuY3Rpb24gKGZsb3cpIHtcbiAgICAgICAgaWYgKGZsb3cuaWQgPT09IHRoaXMuZ2V0UGFyYW1zKCkuZmxvd0lkKSB7XG4gICAgICAgICAgICB0aGlzLmZvcmNlVXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIG9uUmVtb3ZlOiBmdW5jdGlvbiAoZmxvd19pZCwgaW5kZXgpIHtcbiAgICAgICAgaWYgKGZsb3dfaWQgPT09IHRoaXMuZ2V0UGFyYW1zKCkuZmxvd0lkKSB7XG4gICAgICAgICAgICB2YXIgZmxvd190b19zZWxlY3QgPSB0aGlzLnN0YXRlLnZpZXcubGlzdFtNYXRoLm1pbihpbmRleCwgdGhpcy5zdGF0ZS52aWV3Lmxpc3QubGVuZ3RoIC0xKV07XG4gICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3coZmxvd190b19zZWxlY3QpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBjbG9zZVZpZXc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5zdGF0ZS52aWV3LmNsb3NlKCk7XG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsTW91bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5vcGVuVmlldyh0aGlzLnByb3BzLmZsb3dTdG9yZSk7XG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsVW5tb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLmNsb3NlVmlldygpO1xuICAgIH0sXG4gICAgc2VsZWN0RmxvdzogZnVuY3Rpb24gKGZsb3cpIHtcbiAgICAgICAgaWYgKGZsb3cpIHtcbiAgICAgICAgICAgIHRoaXMucmVwbGFjZVdpdGgoXG4gICAgICAgICAgICAgICAgXCJmbG93XCIsXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICBmbG93SWQ6IGZsb3cuaWQsXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbFRhYjogdGhpcy5nZXRQYXJhbXMoKS5kZXRhaWxUYWIgfHwgXCJyZXF1ZXN0XCJcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgdGhpcy5yZWZzLmZsb3dUYWJsZS5zY3JvbGxJbnRvVmlldyhmbG93KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMucmVwbGFjZVdpdGgoXCJmbG93c1wiLCB7fSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHNlbGVjdEZsb3dSZWxhdGl2ZTogZnVuY3Rpb24gKHNoaWZ0KSB7XG4gICAgICAgIHZhciBmbG93cyA9IHRoaXMuc3RhdGUudmlldy5saXN0O1xuICAgICAgICB2YXIgaW5kZXg7XG4gICAgICAgIGlmICghdGhpcy5nZXRQYXJhbXMoKS5mbG93SWQpIHtcbiAgICAgICAgICAgIGlmIChzaGlmdCA+IDApIHtcbiAgICAgICAgICAgICAgICBpbmRleCA9IGZsb3dzLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluZGV4ID0gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBjdXJyRmxvd0lkID0gdGhpcy5nZXRQYXJhbXMoKS5mbG93SWQ7XG4gICAgICAgICAgICB2YXIgaSA9IGZsb3dzLmxlbmd0aDtcbiAgICAgICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgICAgICBpZiAoZmxvd3NbaV0uaWQgPT09IGN1cnJGbG93SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpbmRleCA9IE1hdGgubWluKFxuICAgICAgICAgICAgICAgIE1hdGgubWF4KDAsIGluZGV4ICsgc2hpZnQpLFxuICAgICAgICAgICAgICAgIGZsb3dzLmxlbmd0aCAtIDEpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc2VsZWN0RmxvdyhmbG93c1tpbmRleF0pO1xuICAgIH0sXG4gICAgb25LZXlEb3duOiBmdW5jdGlvbiAoZSkge1xuICAgICAgICB2YXIgZmxvdyA9IHRoaXMuZ2V0U2VsZWN0ZWQoKTtcbiAgICAgICAgaWYgKGUuY3RybEtleSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAoZS5rZXlDb2RlKSB7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5LOlxuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuVVA6XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RGbG93UmVsYXRpdmUoLTEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuSjpcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkRPV046XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RGbG93UmVsYXRpdmUoKzEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuU1BBQ0U6XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5QQUdFX0RPV046XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RGbG93UmVsYXRpdmUoKzEwKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LlBBR0VfVVA6XG4gICAgICAgICAgICAgICAgdGhpcy5zZWxlY3RGbG93UmVsYXRpdmUoLTEwKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkVORDpcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3dSZWxhdGl2ZSgrMWUxMCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5IT01FOlxuICAgICAgICAgICAgICAgIHRoaXMuc2VsZWN0Rmxvd1JlbGF0aXZlKC0xZTEwKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkVTQzpcbiAgICAgICAgICAgICAgICB0aGlzLnNlbGVjdEZsb3cobnVsbCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5IOlxuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuTEVGVDpcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5yZWZzLmZsb3dEZXRhaWxzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcy5mbG93RGV0YWlscy5uZXh0VGFiKC0xKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5MOlxuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuVEFCOlxuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuUklHSFQ6XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMucmVmcy5mbG93RGV0YWlscykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZnMuZmxvd0RldGFpbHMubmV4dFRhYigrMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSB0b3B1dGlscy5LZXkuQzpcbiAgICAgICAgICAgICAgICBpZiAoZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgICAgICAgICBGbG93QWN0aW9ucy5jbGVhcigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkQ6XG4gICAgICAgICAgICAgICAgaWYgKGZsb3cpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGUuc2hpZnRLZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLmR1cGxpY2F0ZShmbG93KTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLmRlbGV0ZShmbG93KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgdG9wdXRpbHMuS2V5LkE6XG4gICAgICAgICAgICAgICAgaWYgKGUuc2hpZnRLZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgRmxvd0FjdGlvbnMuYWNjZXB0X2FsbCgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZmxvdyAmJiBmbG93LmludGVyY2VwdGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLmFjY2VwdChmbG93KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5SOlxuICAgICAgICAgICAgICAgIGlmICghZS5zaGlmdEtleSAmJiBmbG93KSB7XG4gICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLnJlcGxheShmbG93KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHRvcHV0aWxzLktleS5WOlxuICAgICAgICAgICAgICAgIGlmKGUuc2hpZnRLZXkgJiYgZmxvdyAmJiBmbG93Lm1vZGlmaWVkKSB7XG4gICAgICAgICAgICAgICAgICAgIEZsb3dBY3Rpb25zLnJldmVydChmbG93KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoXCJrZXlkb3duXCIsIGUua2V5Q29kZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9LFxuICAgIGdldFNlbGVjdGVkOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BzLmZsb3dTdG9yZS5nZXQodGhpcy5nZXRQYXJhbXMoKS5mbG93SWQpO1xuICAgIH0sXG4gICAgcmVuZGVyOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzZWxlY3RlZCA9IHRoaXMuZ2V0U2VsZWN0ZWQoKTtcblxuICAgICAgICB2YXIgZGV0YWlscztcbiAgICAgICAgaWYgKHNlbGVjdGVkKSB7XG4gICAgICAgICAgICBkZXRhaWxzID0gW1xuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoY29tbW9uLlNwbGl0dGVyLCB7a2V5OiBcInNwbGl0dGVyXCJ9KSxcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KGZsb3dkZXRhaWwuRmxvd0RldGFpbCwge2tleTogXCJmbG93RGV0YWlsc1wiLCByZWY6IFwiZmxvd0RldGFpbHNcIiwgZmxvdzogc2VsZWN0ZWR9KVxuICAgICAgICAgICAgXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRldGFpbHMgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiwge2NsYXNzTmFtZTogXCJtYWluLXZpZXdcIiwgb25LZXlEb3duOiB0aGlzLm9uS2V5RG93biwgdGFiSW5kZXg6IFwiMFwifSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChGbG93VGFibGUsIHtyZWY6IFwiZmxvd1RhYmxlXCIsIFxuICAgICAgICAgICAgICAgICAgICB2aWV3OiB0aGlzLnN0YXRlLnZpZXcsIFxuICAgICAgICAgICAgICAgICAgICBzZWxlY3RGbG93OiB0aGlzLnNlbGVjdEZsb3csIFxuICAgICAgICAgICAgICAgICAgICBzZWxlY3RlZDogc2VsZWN0ZWR9KSwgXG4gICAgICAgICAgICAgICAgZGV0YWlsc1xuICAgICAgICAgICAgKVxuICAgICAgICApO1xuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1haW5WaWV3O1xuIiwidmFyIFJlYWN0ID0gcmVxdWlyZShcInJlYWN0XCIpO1xudmFyIFJlYWN0Um91dGVyID0gcmVxdWlyZShcInJlYWN0LXJvdXRlclwiKTtcbnZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcblxudmFyIGNvbW1vbiA9IHJlcXVpcmUoXCIuL2NvbW1vbi5qc1wiKTtcbnZhciBNYWluVmlldyA9IHJlcXVpcmUoXCIuL21haW52aWV3LmpzXCIpO1xudmFyIEZvb3RlciA9IHJlcXVpcmUoXCIuL2Zvb3Rlci5qc1wiKTtcbnZhciBoZWFkZXIgPSByZXF1aXJlKFwiLi9oZWFkZXIuanNcIik7XG52YXIgRXZlbnRMb2cgPSByZXF1aXJlKFwiLi9ldmVudGxvZy5qc1wiKTtcbnZhciBzdG9yZSA9IHJlcXVpcmUoXCIuLi9zdG9yZS9zdG9yZS5qc1wiKTtcblxuXG4vL1RPRE86IE1vdmUgb3V0IG9mIGhlcmUsIGp1c3QgYSBzdHViLlxudmFyIFJlcG9ydHMgPSBSZWFjdC5jcmVhdGVDbGFzcyh7ZGlzcGxheU5hbWU6IFwiUmVwb3J0c1wiLFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChcImRpdlwiLCBudWxsLCBcIlJlcG9ydEVkaXRvclwiKTtcbiAgICB9XG59KTtcblxuXG52YXIgUHJveHlBcHBNYWluID0gUmVhY3QuY3JlYXRlQ2xhc3Moe2Rpc3BsYXlOYW1lOiBcIlByb3h5QXBwTWFpblwiLFxuICAgIG1peGluczogW2NvbW1vbi5TdGF0ZV0sXG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBldmVudFN0b3JlID0gbmV3IHN0b3JlLkV2ZW50TG9nU3RvcmUoKTtcbiAgICAgICAgdmFyIGZsb3dTdG9yZSA9IG5ldyBzdG9yZS5GbG93U3RvcmUoKTtcbiAgICAgICAgdmFyIHNldHRpbmdzID0gbmV3IHN0b3JlLlNldHRpbmdzU3RvcmUoKTtcblxuICAgICAgICAvLyBEZWZhdWx0IFNldHRpbmdzIGJlZm9yZSBmZXRjaFxuICAgICAgICBfLmV4dGVuZChzZXR0aW5ncy5kaWN0LHtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzZXR0aW5nczogc2V0dGluZ3MsXG4gICAgICAgICAgICBmbG93U3RvcmU6IGZsb3dTdG9yZSxcbiAgICAgICAgICAgIGV2ZW50U3RvcmU6IGV2ZW50U3RvcmVcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGNvbXBvbmVudERpZE1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RhdGUuc2V0dGluZ3MuYWRkTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLm9uU2V0dGluZ3NDaGFuZ2UpO1xuICAgICAgICB3aW5kb3cuYXBwID0gdGhpcztcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxVbm1vdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuc3RhdGUuc2V0dGluZ3MucmVtb3ZlTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLm9uU2V0dGluZ3NDaGFuZ2UpO1xuICAgIH0sXG4gICAgb25TZXR0aW5nc0NoYW5nZTogZnVuY3Rpb24oKXtcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgICAgICBzZXR0aW5nczogdGhpcy5zdGF0ZS5zZXR0aW5nc1xuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHJlbmRlcjogZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIHZhciBldmVudGxvZztcbiAgICAgICAgaWYgKHRoaXMuZ2V0UXVlcnkoKVtRdWVyeS5TSE9XX0VWRU5UTE9HXSkge1xuICAgICAgICAgICAgZXZlbnRsb2cgPSBbXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChjb21tb24uU3BsaXR0ZXIsIHtrZXk6IFwic3BsaXR0ZXJcIiwgYXhpczogXCJ5XCJ9KSxcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KEV2ZW50TG9nLCB7a2V5OiBcImV2ZW50bG9nXCIsIGV2ZW50U3RvcmU6IHRoaXMuc3RhdGUuZXZlbnRTdG9yZX0pXG4gICAgICAgICAgICBdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXZlbnRsb2cgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIiwge2lkOiBcImNvbnRhaW5lclwifSwgXG4gICAgICAgICAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChoZWFkZXIuSGVhZGVyLCB7c2V0dGluZ3M6IHRoaXMuc3RhdGUuc2V0dGluZ3MuZGljdH0pLCBcbiAgICAgICAgICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFJvdXRlSGFuZGxlciwge3NldHRpbmdzOiB0aGlzLnN0YXRlLnNldHRpbmdzLmRpY3QsIGZsb3dTdG9yZTogdGhpcy5zdGF0ZS5mbG93U3RvcmV9KSwgXG4gICAgICAgICAgICAgICAgZXZlbnRsb2csIFxuICAgICAgICAgICAgICAgIFJlYWN0LmNyZWF0ZUVsZW1lbnQoRm9vdGVyLCB7c2V0dGluZ3M6IHRoaXMuc3RhdGUuc2V0dGluZ3MuZGljdH0pXG4gICAgICAgICAgICApXG4gICAgICAgICk7XG4gICAgfVxufSk7XG5cblxudmFyIFJvdXRlID0gUmVhY3RSb3V0ZXIuUm91dGU7XG52YXIgUm91dGVIYW5kbGVyID0gUmVhY3RSb3V0ZXIuUm91dGVIYW5kbGVyO1xudmFyIFJlZGlyZWN0ID0gUmVhY3RSb3V0ZXIuUmVkaXJlY3Q7XG52YXIgRGVmYXVsdFJvdXRlID0gUmVhY3RSb3V0ZXIuRGVmYXVsdFJvdXRlO1xudmFyIE5vdEZvdW5kUm91dGUgPSBSZWFjdFJvdXRlci5Ob3RGb3VuZFJvdXRlO1xuXG5cbnZhciByb3V0ZXMgPSAoXG4gICAgUmVhY3QuY3JlYXRlRWxlbWVudChSb3V0ZSwge3BhdGg6IFwiL1wiLCBoYW5kbGVyOiBQcm94eUFwcE1haW59LCBcbiAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChSb3V0ZSwge25hbWU6IFwiZmxvd3NcIiwgcGF0aDogXCJmbG93c1wiLCBoYW5kbGVyOiBNYWluVmlld30pLCBcbiAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChSb3V0ZSwge25hbWU6IFwiZmxvd1wiLCBwYXRoOiBcImZsb3dzLzpmbG93SWQvOmRldGFpbFRhYlwiLCBoYW5kbGVyOiBNYWluVmlld30pLCBcbiAgICAgICAgUmVhY3QuY3JlYXRlRWxlbWVudChSb3V0ZSwge25hbWU6IFwicmVwb3J0c1wiLCBoYW5kbGVyOiBSZXBvcnRzfSksIFxuICAgICAgICBSZWFjdC5jcmVhdGVFbGVtZW50KFJlZGlyZWN0LCB7cGF0aDogXCIvXCIsIHRvOiBcImZsb3dzXCJ9KVxuICAgIClcbik7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHJvdXRlczogcm91dGVzXG59O1xuXG4iLCJ2YXIgUmVhY3QgPSByZXF1aXJlKFwicmVhY3RcIik7XG5cbnZhciBWaXJ0dWFsU2Nyb2xsTWl4aW4gPSB7XG4gICAgZ2V0SW5pdGlhbFN0YXRlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGFydDogMCxcbiAgICAgICAgICAgIHN0b3A6IDBcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIGNvbXBvbmVudFdpbGxNb3VudDogZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXRoaXMucHJvcHMucm93SGVpZ2h0KSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJWaXJ0dWFsU2Nyb2xsTWl4aW46IE5vIHJvd0hlaWdodCBzcGVjaWZpZWRcIiwgdGhpcyk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGdldFBsYWNlaG9sZGVyVG9wOiBmdW5jdGlvbiAodG90YWwpIHtcbiAgICAgICAgdmFyIFRhZyA9IHRoaXMucHJvcHMucGxhY2Vob2xkZXJUYWdOYW1lIHx8IFwidHJcIjtcbiAgICAgICAgLy8gV2hlbiBhIGxhcmdlIHRydW5rIG9mIGVsZW1lbnRzIGlzIHJlbW92ZWQgZnJvbSB0aGUgYnV0dG9uLCBzdGFydCBtYXkgYmUgZmFyIG9mZiB0aGUgdmlld3BvcnQuXG4gICAgICAgIC8vIFRvIG1ha2UgdGhpcyBpc3N1ZSBsZXNzIHNldmVyZSwgbGltaXQgdGhlIHRvcCBwbGFjZWhvbGRlciB0byB0aGUgdG90YWwgbnVtYmVyIG9mIHJvd3MuXG4gICAgICAgIHZhciBzdHlsZSA9IHtcbiAgICAgICAgICAgIGhlaWdodDogTWF0aC5taW4odGhpcy5zdGF0ZS5zdGFydCwgdG90YWwpICogdGhpcy5wcm9wcy5yb3dIZWlnaHRcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIHNwYWNlciA9IFJlYWN0LmNyZWF0ZUVsZW1lbnQoVGFnLCB7a2V5OiBcInBsYWNlaG9sZGVyLXRvcFwiLCBzdHlsZTogc3R5bGV9KTtcblxuICAgICAgICBpZiAodGhpcy5zdGF0ZS5zdGFydCAlIDIgPT09IDEpIHtcbiAgICAgICAgICAgIC8vIGZpeCBldmVuL29kZCByb3dzXG4gICAgICAgICAgICByZXR1cm4gW3NwYWNlciwgUmVhY3QuY3JlYXRlRWxlbWVudChUYWcsIHtrZXk6IFwicGxhY2Vob2xkZXItdG9wLTJcIn0pXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBzcGFjZXI7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGdldFBsYWNlaG9sZGVyQm90dG9tOiBmdW5jdGlvbiAodG90YWwpIHtcbiAgICAgICAgdmFyIFRhZyA9IHRoaXMucHJvcHMucGxhY2Vob2xkZXJUYWdOYW1lIHx8IFwidHJcIjtcbiAgICAgICAgdmFyIHN0eWxlID0ge1xuICAgICAgICAgICAgaGVpZ2h0OiBNYXRoLm1heCgwLCB0b3RhbCAtIHRoaXMuc3RhdGUuc3RvcCkgKiB0aGlzLnByb3BzLnJvd0hlaWdodFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gUmVhY3QuY3JlYXRlRWxlbWVudChUYWcsIHtrZXk6IFwicGxhY2Vob2xkZXItYm90dG9tXCIsIHN0eWxlOiBzdHlsZX0pO1xuICAgIH0sXG4gICAgY29tcG9uZW50RGlkTW91bnQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdGhpcy5vblNjcm9sbCgpO1xuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgdGhpcy5vblNjcm9sbCk7XG4gICAgfSxcbiAgICBjb21wb25lbnRXaWxsVW5tb3VudDogZnVuY3Rpb24oKXtcbiAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHRoaXMub25TY3JvbGwpO1xuICAgIH0sXG4gICAgb25TY3JvbGw6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHZpZXdwb3J0ID0gdGhpcy5nZXRET01Ob2RlKCk7XG4gICAgICAgIHZhciB0b3AgPSB2aWV3cG9ydC5zY3JvbGxUb3A7XG4gICAgICAgIHZhciBoZWlnaHQgPSB2aWV3cG9ydC5vZmZzZXRIZWlnaHQ7XG4gICAgICAgIHZhciBzdGFydCA9IE1hdGguZmxvb3IodG9wIC8gdGhpcy5wcm9wcy5yb3dIZWlnaHQpO1xuICAgICAgICB2YXIgc3RvcCA9IHN0YXJ0ICsgTWF0aC5jZWlsKGhlaWdodCAvICh0aGlzLnByb3BzLnJvd0hlaWdodE1pbiB8fCB0aGlzLnByb3BzLnJvd0hlaWdodCkpO1xuXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgICAgICAgc3RhcnQ6IHN0YXJ0LFxuICAgICAgICAgICAgc3RvcDogc3RvcFxuICAgICAgICB9KTtcbiAgICB9LFxuICAgIHJlbmRlclJvd3M6IGZ1bmN0aW9uIChlbGVtcykge1xuICAgICAgICB2YXIgcm93cyA9IFtdO1xuICAgICAgICB2YXIgbWF4ID0gTWF0aC5taW4oZWxlbXMubGVuZ3RoLCB0aGlzLnN0YXRlLnN0b3ApO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSB0aGlzLnN0YXRlLnN0YXJ0OyBpIDwgbWF4OyBpKyspIHtcbiAgICAgICAgICAgIHZhciBlbGVtID0gZWxlbXNbaV07XG4gICAgICAgICAgICByb3dzLnB1c2godGhpcy5yZW5kZXJSb3coZWxlbSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByb3dzO1xuICAgIH0sXG4gICAgc2Nyb2xsUm93SW50b1ZpZXc6IGZ1bmN0aW9uIChpbmRleCwgaGVhZF9oZWlnaHQpIHtcblxuICAgICAgICB2YXIgcm93X3RvcCA9IChpbmRleCAqIHRoaXMucHJvcHMucm93SGVpZ2h0KSArIGhlYWRfaGVpZ2h0O1xuICAgICAgICB2YXIgcm93X2JvdHRvbSA9IHJvd190b3AgKyB0aGlzLnByb3BzLnJvd0hlaWdodDtcblxuICAgICAgICB2YXIgdmlld3BvcnQgPSB0aGlzLmdldERPTU5vZGUoKTtcbiAgICAgICAgdmFyIHZpZXdwb3J0X3RvcCA9IHZpZXdwb3J0LnNjcm9sbFRvcDtcbiAgICAgICAgdmFyIHZpZXdwb3J0X2JvdHRvbSA9IHZpZXdwb3J0X3RvcCArIHZpZXdwb3J0Lm9mZnNldEhlaWdodDtcblxuICAgICAgICAvLyBBY2NvdW50IGZvciBwaW5uZWQgdGhlYWRcbiAgICAgICAgaWYgKHJvd190b3AgLSBoZWFkX2hlaWdodCA8IHZpZXdwb3J0X3RvcCkge1xuICAgICAgICAgICAgdmlld3BvcnQuc2Nyb2xsVG9wID0gcm93X3RvcCAtIGhlYWRfaGVpZ2h0O1xuICAgICAgICB9IGVsc2UgaWYgKHJvd19ib3R0b20gPiB2aWV3cG9ydF9ib3R0b20pIHtcbiAgICAgICAgICAgIHZpZXdwb3J0LnNjcm9sbFRvcCA9IHJvd19ib3R0b20gLSB2aWV3cG9ydC5vZmZzZXRIZWlnaHQ7XG4gICAgICAgIH1cbiAgICB9LFxufTtcblxubW9kdWxlLmV4cG9ydHMgID0gVmlydHVhbFNjcm9sbE1peGluOyIsIlxudmFyIGFjdGlvbnMgPSByZXF1aXJlKFwiLi9hY3Rpb25zLmpzXCIpO1xuXG5mdW5jdGlvbiBDb25uZWN0aW9uKHVybCkge1xuICAgIGlmICh1cmxbMF0gPT09IFwiL1wiKSB7XG4gICAgICAgIHVybCA9IGxvY2F0aW9uLm9yaWdpbi5yZXBsYWNlKFwiaHR0cFwiLCBcIndzXCIpICsgdXJsO1xuICAgIH1cblxuICAgIHZhciB3cyA9IG5ldyBXZWJTb2NrZXQodXJsKTtcbiAgICB3cy5vbm9wZW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGFjdGlvbnMuQ29ubmVjdGlvbkFjdGlvbnMub3BlbigpO1xuICAgIH07XG4gICAgd3Mub25tZXNzYWdlID0gZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgdmFyIG0gPSBKU09OLnBhcnNlKG1lc3NhZ2UuZGF0YSk7XG4gICAgICAgIEFwcERpc3BhdGNoZXIuZGlzcGF0Y2hTZXJ2ZXJBY3Rpb24obSk7XG4gICAgfTtcbiAgICB3cy5vbmVycm9yID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBhY3Rpb25zLkNvbm5lY3Rpb25BY3Rpb25zLmVycm9yKCk7XG4gICAgICAgIEV2ZW50TG9nQWN0aW9ucy5hZGRfZXZlbnQoXCJXZWJTb2NrZXQgY29ubmVjdGlvbiBlcnJvci5cIik7XG4gICAgfTtcbiAgICB3cy5vbmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBhY3Rpb25zLkNvbm5lY3Rpb25BY3Rpb25zLmNsb3NlKCk7XG4gICAgICAgIEV2ZW50TG9nQWN0aW9ucy5hZGRfZXZlbnQoXCJXZWJTb2NrZXQgY29ubmVjdGlvbiBjbG9zZWQuXCIpO1xuICAgIH07XG4gICAgcmV0dXJuIHdzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbm5lY3Rpb247IiwiXG52YXIgZmx1eCA9IHJlcXVpcmUoXCJmbHV4XCIpO1xuXG5jb25zdCBQYXlsb2FkU291cmNlcyA9IHtcbiAgICBWSUVXOiBcInZpZXdcIixcbiAgICBTRVJWRVI6IFwic2VydmVyXCJcbn07XG5cblxuQXBwRGlzcGF0Y2hlciA9IG5ldyBmbHV4LkRpc3BhdGNoZXIoKTtcbkFwcERpc3BhdGNoZXIuZGlzcGF0Y2hWaWV3QWN0aW9uID0gZnVuY3Rpb24gKGFjdGlvbikge1xuICAgIGFjdGlvbi5zb3VyY2UgPSBQYXlsb2FkU291cmNlcy5WSUVXO1xuICAgIHRoaXMuZGlzcGF0Y2goYWN0aW9uKTtcbn07XG5BcHBEaXNwYXRjaGVyLmRpc3BhdGNoU2VydmVyQWN0aW9uID0gZnVuY3Rpb24gKGFjdGlvbikge1xuICAgIGFjdGlvbi5zb3VyY2UgPSBQYXlsb2FkU291cmNlcy5TRVJWRVI7XG4gICAgdGhpcy5kaXNwYXRjaChhY3Rpb24pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgQXBwRGlzcGF0Y2hlcjogQXBwRGlzcGF0Y2hlclxufTsiLCIvKiBqc2hpbnQgaWdub3JlOnN0YXJ0ICovXG5GaWx0ID0gKGZ1bmN0aW9uKCkge1xuICAvKlxuICAgKiBHZW5lcmF0ZWQgYnkgUEVHLmpzIDAuOC4wLlxuICAgKlxuICAgKiBodHRwOi8vcGVnanMubWFqZGEuY3ovXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHBlZyRzdWJjbGFzcyhjaGlsZCwgcGFyZW50KSB7XG4gICAgZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9XG4gICAgY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlO1xuICAgIGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7XG4gIH1cblxuICBmdW5jdGlvbiBTeW50YXhFcnJvcihtZXNzYWdlLCBleHBlY3RlZCwgZm91bmQsIG9mZnNldCwgbGluZSwgY29sdW1uKSB7XG4gICAgdGhpcy5tZXNzYWdlICA9IG1lc3NhZ2U7XG4gICAgdGhpcy5leHBlY3RlZCA9IGV4cGVjdGVkO1xuICAgIHRoaXMuZm91bmQgICAgPSBmb3VuZDtcbiAgICB0aGlzLm9mZnNldCAgID0gb2Zmc2V0O1xuICAgIHRoaXMubGluZSAgICAgPSBsaW5lO1xuICAgIHRoaXMuY29sdW1uICAgPSBjb2x1bW47XG5cbiAgICB0aGlzLm5hbWUgICAgID0gXCJTeW50YXhFcnJvclwiO1xuICB9XG5cbiAgcGVnJHN1YmNsYXNzKFN5bnRheEVycm9yLCBFcnJvcik7XG5cbiAgZnVuY3Rpb24gcGFyc2UoaW5wdXQpIHtcbiAgICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYXJndW1lbnRzWzFdIDoge30sXG5cbiAgICAgICAgcGVnJEZBSUxFRCA9IHt9LFxuXG4gICAgICAgIHBlZyRzdGFydFJ1bGVGdW5jdGlvbnMgPSB7IHN0YXJ0OiBwZWckcGFyc2VzdGFydCB9LFxuICAgICAgICBwZWckc3RhcnRSdWxlRnVuY3Rpb24gID0gcGVnJHBhcnNlc3RhcnQsXG5cbiAgICAgICAgcGVnJGMwID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcImZpbHRlciBleHByZXNzaW9uXCIgfSxcbiAgICAgICAgcGVnJGMxID0gcGVnJEZBSUxFRCxcbiAgICAgICAgcGVnJGMyID0gZnVuY3Rpb24ob3JFeHByKSB7IHJldHVybiBvckV4cHI7IH0sXG4gICAgICAgIHBlZyRjMyA9IFtdLFxuICAgICAgICBwZWckYzQgPSBmdW5jdGlvbigpIHtyZXR1cm4gdHJ1ZUZpbHRlcjsgfSxcbiAgICAgICAgcGVnJGM1ID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcIndoaXRlc3BhY2VcIiB9LFxuICAgICAgICBwZWckYzYgPSAvXlsgXFx0XFxuXFxyXS8sXG4gICAgICAgIHBlZyRjNyA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbIFxcXFx0XFxcXG5cXFxccl1cIiwgZGVzY3JpcHRpb246IFwiWyBcXFxcdFxcXFxuXFxcXHJdXCIgfSxcbiAgICAgICAgcGVnJGM4ID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcImNvbnRyb2wgY2hhcmFjdGVyXCIgfSxcbiAgICAgICAgcGVnJGM5ID0gL15bfCYhKCl+XCJdLyxcbiAgICAgICAgcGVnJGMxMCA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbfCYhKCl+XFxcIl1cIiwgZGVzY3JpcHRpb246IFwiW3wmISgpflxcXCJdXCIgfSxcbiAgICAgICAgcGVnJGMxMSA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJvcHRpb25hbCB3aGl0ZXNwYWNlXCIgfSxcbiAgICAgICAgcGVnJGMxMiA9IFwifFwiLFxuICAgICAgICBwZWckYzEzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifFwiLCBkZXNjcmlwdGlvbjogXCJcXFwifFxcXCJcIiB9LFxuICAgICAgICBwZWckYzE0ID0gZnVuY3Rpb24oZmlyc3QsIHNlY29uZCkgeyByZXR1cm4gb3IoZmlyc3QsIHNlY29uZCk7IH0sXG4gICAgICAgIHBlZyRjMTUgPSBcIiZcIixcbiAgICAgICAgcGVnJGMxNiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIiZcIiwgZGVzY3JpcHRpb246IFwiXFxcIiZcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxNyA9IGZ1bmN0aW9uKGZpcnN0LCBzZWNvbmQpIHsgcmV0dXJuIGFuZChmaXJzdCwgc2Vjb25kKTsgfSxcbiAgICAgICAgcGVnJGMxOCA9IFwiIVwiLFxuICAgICAgICBwZWckYzE5ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiIVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiIVxcXCJcIiB9LFxuICAgICAgICBwZWckYzIwID0gZnVuY3Rpb24oZXhwcikgeyByZXR1cm4gbm90KGV4cHIpOyB9LFxuICAgICAgICBwZWckYzIxID0gXCIoXCIsXG4gICAgICAgIHBlZyRjMjIgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIoXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIoXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMjMgPSBcIilcIixcbiAgICAgICAgcGVnJGMyNCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIilcIiwgZGVzY3JpcHRpb246IFwiXFxcIilcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyNSA9IGZ1bmN0aW9uKGV4cHIpIHsgcmV0dXJuIGJpbmRpbmcoZXhwcik7IH0sXG4gICAgICAgIHBlZyRjMjYgPSBcIn5hXCIsXG4gICAgICAgIHBlZyRjMjcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+YVwiLCBkZXNjcmlwdGlvbjogXCJcXFwifmFcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyOCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gYXNzZXRGaWx0ZXI7IH0sXG4gICAgICAgIHBlZyRjMjkgPSBcIn5lXCIsXG4gICAgICAgIHBlZyRjMzAgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+ZVwiLCBkZXNjcmlwdGlvbjogXCJcXFwifmVcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMzMSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gZXJyb3JGaWx0ZXI7IH0sXG4gICAgICAgIHBlZyRjMzIgPSBcIn5xXCIsXG4gICAgICAgIHBlZyRjMzMgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+cVwiLCBkZXNjcmlwdGlvbjogXCJcXFwifnFcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMzNCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gbm9SZXNwb25zZUZpbHRlcjsgfSxcbiAgICAgICAgcGVnJGMzNSA9IFwifnNcIixcbiAgICAgICAgcGVnJGMzNiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5zXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+c1xcXCJcIiB9LFxuICAgICAgICBwZWckYzM3ID0gZnVuY3Rpb24oKSB7IHJldHVybiByZXNwb25zZUZpbHRlcjsgfSxcbiAgICAgICAgcGVnJGMzOCA9IFwidHJ1ZVwiLFxuICAgICAgICBwZWckYzM5ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwidHJ1ZVwiLCBkZXNjcmlwdGlvbjogXCJcXFwidHJ1ZVxcXCJcIiB9LFxuICAgICAgICBwZWckYzQwID0gZnVuY3Rpb24oKSB7IHJldHVybiB0cnVlRmlsdGVyOyB9LFxuICAgICAgICBwZWckYzQxID0gXCJmYWxzZVwiLFxuICAgICAgICBwZWckYzQyID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiZmFsc2VcIiwgZGVzY3JpcHRpb246IFwiXFxcImZhbHNlXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNDMgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGZhbHNlRmlsdGVyOyB9LFxuICAgICAgICBwZWckYzQ0ID0gXCJ+Y1wiLFxuICAgICAgICBwZWckYzQ1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifmNcIiwgZGVzY3JpcHRpb246IFwiXFxcIn5jXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNDYgPSBmdW5jdGlvbihzKSB7IHJldHVybiByZXNwb25zZUNvZGUocyk7IH0sXG4gICAgICAgIHBlZyRjNDcgPSBcIn5kXCIsXG4gICAgICAgIHBlZyRjNDggPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+ZFwiLCBkZXNjcmlwdGlvbjogXCJcXFwifmRcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM0OSA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIGRvbWFpbihzKTsgfSxcbiAgICAgICAgcGVnJGM1MCA9IFwifmhcIixcbiAgICAgICAgcGVnJGM1MSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5oXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+aFxcXCJcIiB9LFxuICAgICAgICBwZWckYzUyID0gZnVuY3Rpb24ocykgeyByZXR1cm4gaGVhZGVyKHMpOyB9LFxuICAgICAgICBwZWckYzUzID0gXCJ+aHFcIixcbiAgICAgICAgcGVnJGM1NCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5ocVwiLCBkZXNjcmlwdGlvbjogXCJcXFwifmhxXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNTUgPSBmdW5jdGlvbihzKSB7IHJldHVybiByZXF1ZXN0SGVhZGVyKHMpOyB9LFxuICAgICAgICBwZWckYzU2ID0gXCJ+aHNcIixcbiAgICAgICAgcGVnJGM1NyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5oc1wiLCBkZXNjcmlwdGlvbjogXCJcXFwifmhzXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNTggPSBmdW5jdGlvbihzKSB7IHJldHVybiByZXNwb25zZUhlYWRlcihzKTsgfSxcbiAgICAgICAgcGVnJGM1OSA9IFwifm1cIixcbiAgICAgICAgcGVnJGM2MCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn5tXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ+bVxcXCJcIiB9LFxuICAgICAgICBwZWckYzYxID0gZnVuY3Rpb24ocykgeyByZXR1cm4gbWV0aG9kKHMpOyB9LFxuICAgICAgICBwZWckYzYyID0gXCJ+dFwiLFxuICAgICAgICBwZWckYzYzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifnRcIiwgZGVzY3JpcHRpb246IFwiXFxcIn50XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNjQgPSBmdW5jdGlvbihzKSB7IHJldHVybiBjb250ZW50VHlwZShzKTsgfSxcbiAgICAgICAgcGVnJGM2NSA9IFwifnRxXCIsXG4gICAgICAgIHBlZyRjNjYgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ+dHFcIiwgZGVzY3JpcHRpb246IFwiXFxcIn50cVxcXCJcIiB9LFxuICAgICAgICBwZWckYzY3ID0gZnVuY3Rpb24ocykgeyByZXR1cm4gcmVxdWVzdENvbnRlbnRUeXBlKHMpOyB9LFxuICAgICAgICBwZWckYzY4ID0gXCJ+dHNcIixcbiAgICAgICAgcGVnJGM2OSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIn50c1wiLCBkZXNjcmlwdGlvbjogXCJcXFwifnRzXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNzAgPSBmdW5jdGlvbihzKSB7IHJldHVybiByZXNwb25zZUNvbnRlbnRUeXBlKHMpOyB9LFxuICAgICAgICBwZWckYzcxID0gXCJ+dVwiLFxuICAgICAgICBwZWckYzcyID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifnVcIiwgZGVzY3JpcHRpb246IFwiXFxcIn51XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNzMgPSBmdW5jdGlvbihzKSB7IHJldHVybiB1cmwocyk7IH0sXG4gICAgICAgIHBlZyRjNzQgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwiaW50ZWdlclwiIH0sXG4gICAgICAgIHBlZyRjNzUgPSBudWxsLFxuICAgICAgICBwZWckYzc2ID0gL15bJ1wiXS8sXG4gICAgICAgIHBlZyRjNzcgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWydcXFwiXVwiLCBkZXNjcmlwdGlvbjogXCJbJ1xcXCJdXCIgfSxcbiAgICAgICAgcGVnJGM3OCA9IC9eWzAtOV0vLFxuICAgICAgICBwZWckYzc5ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlswLTldXCIsIGRlc2NyaXB0aW9uOiBcIlswLTldXCIgfSxcbiAgICAgICAgcGVnJGM4MCA9IGZ1bmN0aW9uKGRpZ2l0cykgeyByZXR1cm4gcGFyc2VJbnQoZGlnaXRzLmpvaW4oXCJcIiksIDEwKTsgfSxcbiAgICAgICAgcGVnJGM4MSA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJzdHJpbmdcIiB9LFxuICAgICAgICBwZWckYzgyID0gXCJcXFwiXCIsXG4gICAgICAgIHBlZyRjODMgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJcXFwiXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJcXFxcXFxcIlxcXCJcIiB9LFxuICAgICAgICBwZWckYzg0ID0gZnVuY3Rpb24oY2hhcnMpIHsgcmV0dXJuIGNoYXJzLmpvaW4oXCJcIik7IH0sXG4gICAgICAgIHBlZyRjODUgPSBcIidcIixcbiAgICAgICAgcGVnJGM4NiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIidcIiwgZGVzY3JpcHRpb246IFwiXFxcIidcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM4NyA9IHZvaWQgMCxcbiAgICAgICAgcGVnJGM4OCA9IC9eW1wiXFxcXF0vLFxuICAgICAgICBwZWckYzg5ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIltcXFwiXFxcXFxcXFxdXCIsIGRlc2NyaXB0aW9uOiBcIltcXFwiXFxcXFxcXFxdXCIgfSxcbiAgICAgICAgcGVnJGM5MCA9IHsgdHlwZTogXCJhbnlcIiwgZGVzY3JpcHRpb246IFwiYW55IGNoYXJhY3RlclwiIH0sXG4gICAgICAgIHBlZyRjOTEgPSBmdW5jdGlvbihjaGFyKSB7IHJldHVybiBjaGFyOyB9LFxuICAgICAgICBwZWckYzkyID0gXCJcXFxcXCIsXG4gICAgICAgIHBlZyRjOTMgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJcXFxcXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJcXFxcXFxcXFxcXCJcIiB9LFxuICAgICAgICBwZWckYzk0ID0gL15bJ1xcXFxdLyxcbiAgICAgICAgcGVnJGM5NSA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbJ1xcXFxcXFxcXVwiLCBkZXNjcmlwdGlvbjogXCJbJ1xcXFxcXFxcXVwiIH0sXG4gICAgICAgIHBlZyRjOTYgPSAvXlsnXCJcXFxcXS8sXG4gICAgICAgIHBlZyRjOTcgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWydcXFwiXFxcXFxcXFxdXCIsIGRlc2NyaXB0aW9uOiBcIlsnXFxcIlxcXFxcXFxcXVwiIH0sXG4gICAgICAgIHBlZyRjOTggPSBcIm5cIixcbiAgICAgICAgcGVnJGM5OSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIm5cIiwgZGVzY3JpcHRpb246IFwiXFxcIm5cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMDAgPSBmdW5jdGlvbigpIHsgcmV0dXJuIFwiXFxuXCI7IH0sXG4gICAgICAgIHBlZyRjMTAxID0gXCJyXCIsXG4gICAgICAgIHBlZyRjMTAyID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiclwiLCBkZXNjcmlwdGlvbjogXCJcXFwiclxcXCJcIiB9LFxuICAgICAgICBwZWckYzEwMyA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJcXHJcIjsgfSxcbiAgICAgICAgcGVnJGMxMDQgPSBcInRcIixcbiAgICAgICAgcGVnJGMxMDUgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ0XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ0XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTA2ID0gZnVuY3Rpb24oKSB7IHJldHVybiBcIlxcdFwiOyB9LFxuXG4gICAgICAgIHBlZyRjdXJyUG9zICAgICAgICAgID0gMCxcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zICAgICAgPSAwLFxuICAgICAgICBwZWckY2FjaGVkUG9zICAgICAgICA9IDAsXG4gICAgICAgIHBlZyRjYWNoZWRQb3NEZXRhaWxzID0geyBsaW5lOiAxLCBjb2x1bW46IDEsIHNlZW5DUjogZmFsc2UgfSxcbiAgICAgICAgcGVnJG1heEZhaWxQb3MgICAgICAgPSAwLFxuICAgICAgICBwZWckbWF4RmFpbEV4cGVjdGVkICA9IFtdLFxuICAgICAgICBwZWckc2lsZW50RmFpbHMgICAgICA9IDAsXG5cbiAgICAgICAgcGVnJHJlc3VsdDtcblxuICAgIGlmIChcInN0YXJ0UnVsZVwiIGluIG9wdGlvbnMpIHtcbiAgICAgIGlmICghKG9wdGlvbnMuc3RhcnRSdWxlIGluIHBlZyRzdGFydFJ1bGVGdW5jdGlvbnMpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IHN0YXJ0IHBhcnNpbmcgZnJvbSBydWxlIFxcXCJcIiArIG9wdGlvbnMuc3RhcnRSdWxlICsgXCJcXFwiLlwiKTtcbiAgICAgIH1cblxuICAgICAgcGVnJHN0YXJ0UnVsZUZ1bmN0aW9uID0gcGVnJHN0YXJ0UnVsZUZ1bmN0aW9uc1tvcHRpb25zLnN0YXJ0UnVsZV07XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdGV4dCgpIHtcbiAgICAgIHJldHVybiBpbnB1dC5zdWJzdHJpbmcocGVnJHJlcG9ydGVkUG9zLCBwZWckY3VyclBvcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb2Zmc2V0KCkge1xuICAgICAgcmV0dXJuIHBlZyRyZXBvcnRlZFBvcztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaW5lKCkge1xuICAgICAgcmV0dXJuIHBlZyRjb21wdXRlUG9zRGV0YWlscyhwZWckcmVwb3J0ZWRQb3MpLmxpbmU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY29sdW1uKCkge1xuICAgICAgcmV0dXJuIHBlZyRjb21wdXRlUG9zRGV0YWlscyhwZWckcmVwb3J0ZWRQb3MpLmNvbHVtbjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBleHBlY3RlZChkZXNjcmlwdGlvbikge1xuICAgICAgdGhyb3cgcGVnJGJ1aWxkRXhjZXB0aW9uKFxuICAgICAgICBudWxsLFxuICAgICAgICBbeyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBkZXNjcmlwdGlvbiB9XSxcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zXG4gICAgICApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVycm9yKG1lc3NhZ2UpIHtcbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihtZXNzYWdlLCBudWxsLCBwZWckcmVwb3J0ZWRQb3MpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRjb21wdXRlUG9zRGV0YWlscyhwb3MpIHtcbiAgICAgIGZ1bmN0aW9uIGFkdmFuY2UoZGV0YWlscywgc3RhcnRQb3MsIGVuZFBvcykge1xuICAgICAgICB2YXIgcCwgY2g7XG5cbiAgICAgICAgZm9yIChwID0gc3RhcnRQb3M7IHAgPCBlbmRQb3M7IHArKykge1xuICAgICAgICAgIGNoID0gaW5wdXQuY2hhckF0KHApO1xuICAgICAgICAgIGlmIChjaCA9PT0gXCJcXG5cIikge1xuICAgICAgICAgICAgaWYgKCFkZXRhaWxzLnNlZW5DUikgeyBkZXRhaWxzLmxpbmUrKzsgfVxuICAgICAgICAgICAgZGV0YWlscy5jb2x1bW4gPSAxO1xuICAgICAgICAgICAgZGV0YWlscy5zZWVuQ1IgPSBmYWxzZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGNoID09PSBcIlxcclwiIHx8IGNoID09PSBcIlxcdTIwMjhcIiB8fCBjaCA9PT0gXCJcXHUyMDI5XCIpIHtcbiAgICAgICAgICAgIGRldGFpbHMubGluZSsrO1xuICAgICAgICAgICAgZGV0YWlscy5jb2x1bW4gPSAxO1xuICAgICAgICAgICAgZGV0YWlscy5zZWVuQ1IgPSB0cnVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkZXRhaWxzLmNvbHVtbisrO1xuICAgICAgICAgICAgZGV0YWlscy5zZWVuQ1IgPSBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHBlZyRjYWNoZWRQb3MgIT09IHBvcykge1xuICAgICAgICBpZiAocGVnJGNhY2hlZFBvcyA+IHBvcykge1xuICAgICAgICAgIHBlZyRjYWNoZWRQb3MgPSAwO1xuICAgICAgICAgIHBlZyRjYWNoZWRQb3NEZXRhaWxzID0geyBsaW5lOiAxLCBjb2x1bW46IDEsIHNlZW5DUjogZmFsc2UgfTtcbiAgICAgICAgfVxuICAgICAgICBhZHZhbmNlKHBlZyRjYWNoZWRQb3NEZXRhaWxzLCBwZWckY2FjaGVkUG9zLCBwb3MpO1xuICAgICAgICBwZWckY2FjaGVkUG9zID0gcG9zO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcGVnJGNhY2hlZFBvc0RldGFpbHM7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJGZhaWwoZXhwZWN0ZWQpIHtcbiAgICAgIGlmIChwZWckY3VyclBvcyA8IHBlZyRtYXhGYWlsUG9zKSB7IHJldHVybjsgfVxuXG4gICAgICBpZiAocGVnJGN1cnJQb3MgPiBwZWckbWF4RmFpbFBvcykge1xuICAgICAgICBwZWckbWF4RmFpbFBvcyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBwZWckbWF4RmFpbEV4cGVjdGVkID0gW107XG4gICAgICB9XG5cbiAgICAgIHBlZyRtYXhGYWlsRXhwZWN0ZWQucHVzaChleHBlY3RlZCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJGJ1aWxkRXhjZXB0aW9uKG1lc3NhZ2UsIGV4cGVjdGVkLCBwb3MpIHtcbiAgICAgIGZ1bmN0aW9uIGNsZWFudXBFeHBlY3RlZChleHBlY3RlZCkge1xuICAgICAgICB2YXIgaSA9IDE7XG5cbiAgICAgICAgZXhwZWN0ZWQuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICAgICAgaWYgKGEuZGVzY3JpcHRpb24gPCBiLmRlc2NyaXB0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgfSBlbHNlIGlmIChhLmRlc2NyaXB0aW9uID4gYi5kZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgd2hpbGUgKGkgPCBleHBlY3RlZC5sZW5ndGgpIHtcbiAgICAgICAgICBpZiAoZXhwZWN0ZWRbaSAtIDFdID09PSBleHBlY3RlZFtpXSkge1xuICAgICAgICAgICAgZXhwZWN0ZWQuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGJ1aWxkTWVzc2FnZShleHBlY3RlZCwgZm91bmQpIHtcbiAgICAgICAgZnVuY3Rpb24gc3RyaW5nRXNjYXBlKHMpIHtcbiAgICAgICAgICBmdW5jdGlvbiBoZXgoY2gpIHsgcmV0dXJuIGNoLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCk7IH1cblxuICAgICAgICAgIHJldHVybiBzXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxcXC9nLCAgICdcXFxcXFxcXCcpXG4gICAgICAgICAgICAucmVwbGFjZSgvXCIvZywgICAgJ1xcXFxcIicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx4MDgvZywgJ1xcXFxiJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgICAnXFxcXHQnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcbi9nLCAgICdcXFxcbicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxmL2csICAgJ1xcXFxmJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHIvZywgICAnXFxcXHInKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHgwMC1cXHgwN1xceDBCXFx4MEVcXHgwRl0vZywgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxceDAnICsgaGV4KGNoKTsgfSlcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx4MTAtXFx4MUZcXHg4MC1cXHhGRl0vZywgICAgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxceCcgICsgaGV4KGNoKTsgfSlcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx1MDE4MC1cXHUwRkZGXS9nLCAgICAgICAgIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHUwJyArIGhleChjaCk7IH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xcdTEwODAtXFx1RkZGRl0vZywgICAgICAgICBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx1JyAgKyBoZXgoY2gpOyB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBleHBlY3RlZERlc2NzID0gbmV3IEFycmF5KGV4cGVjdGVkLmxlbmd0aCksXG4gICAgICAgICAgICBleHBlY3RlZERlc2MsIGZvdW5kRGVzYywgaTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgZXhwZWN0ZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBleHBlY3RlZERlc2NzW2ldID0gZXhwZWN0ZWRbaV0uZGVzY3JpcHRpb247XG4gICAgICAgIH1cblxuICAgICAgICBleHBlY3RlZERlc2MgPSBleHBlY3RlZC5sZW5ndGggPiAxXG4gICAgICAgICAgPyBleHBlY3RlZERlc2NzLnNsaWNlKDAsIC0xKS5qb2luKFwiLCBcIilcbiAgICAgICAgICAgICAgKyBcIiBvciBcIlxuICAgICAgICAgICAgICArIGV4cGVjdGVkRGVzY3NbZXhwZWN0ZWQubGVuZ3RoIC0gMV1cbiAgICAgICAgICA6IGV4cGVjdGVkRGVzY3NbMF07XG5cbiAgICAgICAgZm91bmREZXNjID0gZm91bmQgPyBcIlxcXCJcIiArIHN0cmluZ0VzY2FwZShmb3VuZCkgKyBcIlxcXCJcIiA6IFwiZW5kIG9mIGlucHV0XCI7XG5cbiAgICAgICAgcmV0dXJuIFwiRXhwZWN0ZWQgXCIgKyBleHBlY3RlZERlc2MgKyBcIiBidXQgXCIgKyBmb3VuZERlc2MgKyBcIiBmb3VuZC5cIjtcbiAgICAgIH1cblxuICAgICAgdmFyIHBvc0RldGFpbHMgPSBwZWckY29tcHV0ZVBvc0RldGFpbHMocG9zKSxcbiAgICAgICAgICBmb3VuZCAgICAgID0gcG9zIDwgaW5wdXQubGVuZ3RoID8gaW5wdXQuY2hhckF0KHBvcykgOiBudWxsO1xuXG4gICAgICBpZiAoZXhwZWN0ZWQgIT09IG51bGwpIHtcbiAgICAgICAgY2xlYW51cEV4cGVjdGVkKGV4cGVjdGVkKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG5ldyBTeW50YXhFcnJvcihcbiAgICAgICAgbWVzc2FnZSAhPT0gbnVsbCA/IG1lc3NhZ2UgOiBidWlsZE1lc3NhZ2UoZXhwZWN0ZWQsIGZvdW5kKSxcbiAgICAgICAgZXhwZWN0ZWQsXG4gICAgICAgIGZvdW5kLFxuICAgICAgICBwb3MsXG4gICAgICAgIHBvc0RldGFpbHMubGluZSxcbiAgICAgICAgcG9zRGV0YWlscy5jb2x1bW5cbiAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlc3RhcnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlX18oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZU9yRXhwcigpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMyKHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgczEgPSBbXTtcbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzQoKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMCk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXdzKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBpZiAocGVnJGM2LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczAgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNyk7IH1cbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzUpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VjYygpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgaWYgKHBlZyRjOS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMwID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEwKTsgfVxuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOCk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZV9fKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IFtdO1xuICAgICAgczEgPSBwZWckcGFyc2V3cygpO1xuICAgICAgd2hpbGUgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwLnB1c2goczEpO1xuICAgICAgICBzMSA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMSk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU9yRXhwcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VBbmRFeHByKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyNCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzEyO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEzKTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZU9yRXhwcigpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMTQoczEsIHM1KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlQW5kRXhwcigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQW5kRXhwcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VOb3RFeHByKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM4KSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMTU7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTYpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlQW5kRXhwcigpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMTcoczEsIHM1KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMxID0gcGVnJHBhcnNlTm90RXhwcigpO1xuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRwYXJzZUFuZEV4cHIoKTtcbiAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzE3KHMxLCBzMyk7XG4gICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJHBhcnNlTm90RXhwcigpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VOb3RFeHByKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzMykge1xuICAgICAgICBzMSA9IHBlZyRjMTg7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxOSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlTm90RXhwcigpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMjAoczMpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZUJpbmRpbmdFeHByKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VCaW5kaW5nRXhwcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0MCkge1xuICAgICAgICBzMSA9IHBlZyRjMjE7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMik7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlT3JFeHByKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0MSkge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMyMztcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjQpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzI1KHMzKTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlRXhwcigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRXhwcigpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgczAgPSBwZWckcGFyc2VOdWxsYXJ5RXhwcigpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlVW5hcnlFeHByKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VOdWxsYXJ5RXhwcigpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHMwID0gcGVnJHBhcnNlQm9vbGVhbkxpdGVyYWwoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMyNikge1xuICAgICAgICAgIHMxID0gcGVnJGMyNjtcbiAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjcpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzI4KCk7XG4gICAgICAgIH1cbiAgICAgICAgczAgPSBzMTtcbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMyOSkge1xuICAgICAgICAgICAgczEgPSBwZWckYzI5O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzMwKTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzMxKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMzIpIHtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzMyO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzMpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGMzNCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMzNSkge1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGMzNTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzYpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzM3KCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUJvb2xlYW5MaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDQpID09PSBwZWckYzM4KSB7XG4gICAgICAgIHMxID0gcGVnJGMzODtcbiAgICAgICAgcGVnJGN1cnJQb3MgKz0gNDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzM5KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjNDAoKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgNSkgPT09IHBlZyRjNDEpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjNDE7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgKz0gNTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQyKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM0MygpO1xuICAgICAgICB9XG4gICAgICAgIHMwID0gczE7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VVbmFyeUV4cHIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGM0NCkge1xuICAgICAgICBzMSA9IHBlZyRjNDQ7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0NSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlSW50ZWdlckxpdGVyYWwoKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzQ2KHMzKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjNDcpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjNDc7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQ4KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjNDkoczMpO1xuICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzUwKSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRjNTA7XG4gICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTEpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTIoczMpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMykgPT09IHBlZyRjNTMpIHtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzUzO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTQpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzU1KHMzKTtcbiAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMykgPT09IHBlZyRjNTYpIHtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTY7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzU3KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTgoczMpO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzU5KSB7XG4gICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjApOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjEoczMpO1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjNjIpIHtcbiAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzYyO1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjMpOyB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzY0KHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMykgPT09IHBlZyRjNjUpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjU7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzY2KTsgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHMyID0gW107XG4gICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjcoczMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDMpID09PSBwZWckYzY4KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjg7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAzO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjkpOyB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNld3MoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZXdzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMyID0gcGVnJGMxO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNzAoczMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjNzEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzcxO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzIpOyB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2V3cygpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzczKHMzKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM3MyhzMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUludGVnZXJMaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAocGVnJGM3Ni50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMxID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzc3KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM3NTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBpZiAocGVnJGM3OC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgczMgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3OSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgICAgaWYgKHBlZyRjNzgudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICBzMyA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3OSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKHBlZyRjNzYudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgczMgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzc3KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGM3NTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM4MChzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzQpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM0KSB7XG4gICAgICAgIHMxID0gcGVnJGM4MjtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzgzKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJHBhcnNlRG91YmxlU3RyaW5nQ2hhcigpO1xuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZURvdWJsZVN0cmluZ0NoYXIoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM0KSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjODI7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODMpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjODQoczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM5KSB7XG4gICAgICAgICAgczEgPSBwZWckYzg1O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4Nik7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IFtdO1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlU2luZ2xlU3RyaW5nQ2hhcigpO1xuICAgICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVNpbmdsZVN0cmluZ0NoYXIoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM5KSB7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGM4NTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg2KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjODQoczIpO1xuICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VjYygpO1xuICAgICAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczEgPSBwZWckYzg3O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgICAgczEgPSBwZWckYzE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBbXTtcbiAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlVW5xdW90ZWRTdHJpbmdDaGFyKCk7XG4gICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VVbnF1b3RlZFN0cmluZ0NoYXIoKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczIgPSBwZWckYzE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGM4NChzMik7XG4gICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODEpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VEb3VibGVTdHJpbmdDaGFyKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBpZiAocGVnJGM4OC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg5KTsgfVxuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzg3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgczEgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5MCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjOTEoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mikge1xuICAgICAgICAgIHMxID0gcGVnJGM5MjtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTMpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VFc2NhcGVTZXF1ZW5jZSgpO1xuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjOTEoczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTaW5nbGVTdHJpbmdDaGFyKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBpZiAocGVnJGM5NC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzk1KTsgfVxuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzg3O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgczEgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5MCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjOTEoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mikge1xuICAgICAgICAgIHMxID0gcGVnJGM5MjtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTMpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VFc2NhcGVTZXF1ZW5jZSgpO1xuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjOTEoczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VVbnF1b3RlZFN0cmluZ0NoYXIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMyID0gcGVnJHBhcnNld3MoKTtcbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM4NztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgIHMxID0gcGVnJGMxO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzkxKHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzE7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRXNjYXBlU2VxdWVuY2UoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBpZiAocGVnJGM5Ni50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMwID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzk3KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTEwKSB7XG4gICAgICAgICAgczEgPSBwZWckYzk4O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5OSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTAwKCk7XG4gICAgICAgIH1cbiAgICAgICAgczAgPSBzMTtcbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDExNCkge1xuICAgICAgICAgICAgczEgPSBwZWckYzEwMTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMDIpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTAzKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTYpIHtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzEwNDtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEwNSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzEwNigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuXG4gICAgZnVuY3Rpb24gb3IoZmlyc3QsIHNlY29uZCkge1xuICAgICAgICAvLyBBZGQgZXhwbGljaXQgZnVuY3Rpb24gbmFtZXMgdG8gZWFzZSBkZWJ1Z2dpbmcuXG4gICAgICAgIGZ1bmN0aW9uIG9yRmlsdGVyKCkge1xuICAgICAgICAgICAgcmV0dXJuIGZpcnN0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cykgfHwgc2Vjb25kLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cbiAgICAgICAgb3JGaWx0ZXIuZGVzYyA9IGZpcnN0LmRlc2MgKyBcIiBvciBcIiArIHNlY29uZC5kZXNjO1xuICAgICAgICByZXR1cm4gb3JGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGFuZChmaXJzdCwgc2Vjb25kKSB7XG4gICAgICAgIGZ1bmN0aW9uIGFuZEZpbHRlcigpIHtcbiAgICAgICAgICAgIHJldHVybiBmaXJzdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpICYmIHNlY29uZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgICAgIGFuZEZpbHRlci5kZXNjID0gZmlyc3QuZGVzYyArIFwiIGFuZCBcIiArIHNlY29uZC5kZXNjO1xuICAgICAgICByZXR1cm4gYW5kRmlsdGVyO1xuICAgIH1cbiAgICBmdW5jdGlvbiBub3QoZXhwcikge1xuICAgICAgICBmdW5jdGlvbiBub3RGaWx0ZXIoKSB7XG4gICAgICAgICAgICByZXR1cm4gIWV4cHIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuICAgICAgICBub3RGaWx0ZXIuZGVzYyA9IFwibm90IFwiICsgZXhwci5kZXNjO1xuICAgICAgICByZXR1cm4gbm90RmlsdGVyO1xuICAgIH1cbiAgICBmdW5jdGlvbiBiaW5kaW5nKGV4cHIpIHtcbiAgICAgICAgZnVuY3Rpb24gYmluZGluZ0ZpbHRlcigpIHtcbiAgICAgICAgICAgIHJldHVybiBleHByLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIH1cbiAgICAgICAgYmluZGluZ0ZpbHRlci5kZXNjID0gXCIoXCIgKyBleHByLmRlc2MgKyBcIilcIjtcbiAgICAgICAgcmV0dXJuIGJpbmRpbmdGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHRydWVGaWx0ZXIoZmxvdykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgdHJ1ZUZpbHRlci5kZXNjID0gXCJ0cnVlXCI7XG4gICAgZnVuY3Rpb24gZmFsc2VGaWx0ZXIoZmxvdykge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZhbHNlRmlsdGVyLmRlc2MgPSBcImZhbHNlXCI7XG5cbiAgICB2YXIgQVNTRVRfVFlQRVMgPSBbXG4gICAgICAgIG5ldyBSZWdFeHAoXCJ0ZXh0L2phdmFzY3JpcHRcIiksXG4gICAgICAgIG5ldyBSZWdFeHAoXCJhcHBsaWNhdGlvbi94LWphdmFzY3JpcHRcIiksXG4gICAgICAgIG5ldyBSZWdFeHAoXCJhcHBsaWNhdGlvbi9qYXZhc2NyaXB0XCIpLFxuICAgICAgICBuZXcgUmVnRXhwKFwidGV4dC9jc3NcIiksXG4gICAgICAgIG5ldyBSZWdFeHAoXCJpbWFnZS8uKlwiKSxcbiAgICAgICAgbmV3IFJlZ0V4cChcImFwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoXCIpXG4gICAgXTtcbiAgICBmdW5jdGlvbiBhc3NldEZpbHRlcihmbG93KSB7XG4gICAgICAgIGlmIChmbG93LnJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgY3QgPSBSZXNwb25zZVV0aWxzLmdldENvbnRlbnRUeXBlKGZsb3cucmVzcG9uc2UpO1xuICAgICAgICAgICAgdmFyIGkgPSBBU1NFVF9UWVBFUy5sZW5ndGg7XG4gICAgICAgICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgICAgICAgICAgaWYgKEFTU0VUX1RZUEVTW2ldLnRlc3QoY3QpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGFzc2V0RmlsdGVyLmRlc2MgPSBcImlzIGFzc2V0XCI7XG4gICAgZnVuY3Rpb24gcmVzcG9uc2VDb2RlKGNvZGUpe1xuICAgICAgICBmdW5jdGlvbiByZXNwb25zZUNvZGVGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXNwb25zZSAmJiBmbG93LnJlc3BvbnNlLmNvZGUgPT09IGNvZGU7XG4gICAgICAgIH1cbiAgICAgICAgcmVzcG9uc2VDb2RlRmlsdGVyLmRlc2MgPSBcInJlc3AuIGNvZGUgaXMgXCIgKyBjb2RlO1xuICAgICAgICByZXR1cm4gcmVzcG9uc2VDb2RlRmlsdGVyO1xuICAgIH1cbiAgICBmdW5jdGlvbiBkb21haW4ocmVnZXgpe1xuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcbiAgICAgICAgZnVuY3Rpb24gZG9tYWluRmlsdGVyKGZsb3cpe1xuICAgICAgICAgICAgcmV0dXJuIGZsb3cucmVxdWVzdCAmJiByZWdleC50ZXN0KGZsb3cucmVxdWVzdC5ob3N0KTtcbiAgICAgICAgfVxuICAgICAgICBkb21haW5GaWx0ZXIuZGVzYyA9IFwiZG9tYWluIG1hdGNoZXMgXCIgKyByZWdleDtcbiAgICAgICAgcmV0dXJuIGRvbWFpbkZpbHRlcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gZXJyb3JGaWx0ZXIoZmxvdyl7XG4gICAgICAgIHJldHVybiAhIWZsb3cuZXJyb3I7XG4gICAgfVxuICAgIGVycm9yRmlsdGVyLmRlc2MgPSBcImhhcyBlcnJvclwiO1xuICAgIGZ1bmN0aW9uIGhlYWRlcihyZWdleCl7XG4gICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleCwgXCJpXCIpO1xuICAgICAgICBmdW5jdGlvbiBoZWFkZXJGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIChmbG93LnJlcXVlc3QgJiYgUmVxdWVzdFV0aWxzLm1hdGNoX2hlYWRlcihmbG93LnJlcXVlc3QsIHJlZ2V4KSlcbiAgICAgICAgICAgICAgICB8fFxuICAgICAgICAgICAgICAgIChmbG93LnJlc3BvbnNlICYmIFJlc3BvbnNlVXRpbHMubWF0Y2hfaGVhZGVyKGZsb3cucmVzcG9uc2UsIHJlZ2V4KSlcbiAgICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgaGVhZGVyRmlsdGVyLmRlc2MgPSBcImhlYWRlciBtYXRjaGVzIFwiICsgcmVnZXg7XG4gICAgICAgIHJldHVybiBoZWFkZXJGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlcXVlc3RIZWFkZXIocmVnZXgpe1xuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcbiAgICAgICAgZnVuY3Rpb24gcmVxdWVzdEhlYWRlckZpbHRlcihmbG93KXtcbiAgICAgICAgICAgIHJldHVybiAoZmxvdy5yZXF1ZXN0ICYmIFJlcXVlc3RVdGlscy5tYXRjaF9oZWFkZXIoZmxvdy5yZXF1ZXN0LCByZWdleCkpO1xuICAgICAgICB9XG4gICAgICAgIHJlcXVlc3RIZWFkZXJGaWx0ZXIuZGVzYyA9IFwicmVxLiBoZWFkZXIgbWF0Y2hlcyBcIiArIHJlZ2V4O1xuICAgICAgICByZXR1cm4gcmVxdWVzdEhlYWRlckZpbHRlcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gcmVzcG9uc2VIZWFkZXIocmVnZXgpe1xuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcbiAgICAgICAgZnVuY3Rpb24gcmVzcG9uc2VIZWFkZXJGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gKGZsb3cucmVzcG9uc2UgJiYgUmVzcG9uc2VVdGlscy5tYXRjaF9oZWFkZXIoZmxvdy5yZXNwb25zZSwgcmVnZXgpKTtcbiAgICAgICAgfVxuICAgICAgICByZXNwb25zZUhlYWRlckZpbHRlci5kZXNjID0gXCJyZXNwLiBoZWFkZXIgbWF0Y2hlcyBcIiArIHJlZ2V4O1xuICAgICAgICByZXR1cm4gcmVzcG9uc2VIZWFkZXJGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG1ldGhvZChyZWdleCl7XG4gICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleCwgXCJpXCIpO1xuICAgICAgICBmdW5jdGlvbiBtZXRob2RGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXF1ZXN0ICYmIHJlZ2V4LnRlc3QoZmxvdy5yZXF1ZXN0Lm1ldGhvZCk7XG4gICAgICAgIH1cbiAgICAgICAgbWV0aG9kRmlsdGVyLmRlc2MgPSBcIm1ldGhvZCBtYXRjaGVzIFwiICsgcmVnZXg7XG4gICAgICAgIHJldHVybiBtZXRob2RGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG5vUmVzcG9uc2VGaWx0ZXIoZmxvdyl7XG4gICAgICAgIHJldHVybiBmbG93LnJlcXVlc3QgJiYgIWZsb3cucmVzcG9uc2U7XG4gICAgfVxuICAgIG5vUmVzcG9uc2VGaWx0ZXIuZGVzYyA9IFwiaGFzIG5vIHJlc3BvbnNlXCI7XG4gICAgZnVuY3Rpb24gcmVzcG9uc2VGaWx0ZXIoZmxvdyl7XG4gICAgICAgIHJldHVybiAhIWZsb3cucmVzcG9uc2U7XG4gICAgfVxuICAgIHJlc3BvbnNlRmlsdGVyLmRlc2MgPSBcImhhcyByZXNwb25zZVwiO1xuXG4gICAgZnVuY3Rpb24gY29udGVudFR5cGUocmVnZXgpe1xuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcbiAgICAgICAgZnVuY3Rpb24gY29udGVudFR5cGVGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgIChmbG93LnJlcXVlc3QgJiYgcmVnZXgudGVzdChSZXF1ZXN0VXRpbHMuZ2V0Q29udGVudFR5cGUoZmxvdy5yZXF1ZXN0KSkpXG4gICAgICAgICAgICAgICAgfHxcbiAgICAgICAgICAgICAgICAoZmxvdy5yZXNwb25zZSAmJiByZWdleC50ZXN0KFJlc3BvbnNlVXRpbHMuZ2V0Q29udGVudFR5cGUoZmxvdy5yZXNwb25zZSkpKVxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBjb250ZW50VHlwZUZpbHRlci5kZXNjID0gXCJjb250ZW50IHR5cGUgbWF0Y2hlcyBcIiArIHJlZ2V4O1xuICAgICAgICByZXR1cm4gY29udGVudFR5cGVGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlcXVlc3RDb250ZW50VHlwZShyZWdleCl7XG4gICAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChyZWdleCwgXCJpXCIpO1xuICAgICAgICBmdW5jdGlvbiByZXF1ZXN0Q29udGVudFR5cGVGaWx0ZXIoZmxvdyl7XG4gICAgICAgICAgICByZXR1cm4gZmxvdy5yZXF1ZXN0ICYmIHJlZ2V4LnRlc3QoUmVxdWVzdFV0aWxzLmdldENvbnRlbnRUeXBlKGZsb3cucmVxdWVzdCkpO1xuICAgICAgICB9XG4gICAgICAgIHJlcXVlc3RDb250ZW50VHlwZUZpbHRlci5kZXNjID0gXCJyZXEuIGNvbnRlbnQgdHlwZSBtYXRjaGVzIFwiICsgcmVnZXg7XG4gICAgICAgIHJldHVybiByZXF1ZXN0Q29udGVudFR5cGVGaWx0ZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlc3BvbnNlQ29udGVudFR5cGUocmVnZXgpe1xuICAgICAgICByZWdleCA9IG5ldyBSZWdFeHAocmVnZXgsIFwiaVwiKTtcbiAgICAgICAgZnVuY3Rpb24gcmVzcG9uc2VDb250ZW50VHlwZUZpbHRlcihmbG93KXtcbiAgICAgICAgICAgIHJldHVybiBmbG93LnJlc3BvbnNlICYmIHJlZ2V4LnRlc3QoUmVzcG9uc2VVdGlscy5nZXRDb250ZW50VHlwZShmbG93LnJlc3BvbnNlKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzcG9uc2VDb250ZW50VHlwZUZpbHRlci5kZXNjID0gXCJyZXNwLiBjb250ZW50IHR5cGUgbWF0Y2hlcyBcIiArIHJlZ2V4O1xuICAgICAgICByZXR1cm4gcmVzcG9uc2VDb250ZW50VHlwZUZpbHRlcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gdXJsKHJlZ2V4KXtcbiAgICAgICAgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4LCBcImlcIik7XG4gICAgICAgIGZ1bmN0aW9uIHVybEZpbHRlcihmbG93KXtcbiAgICAgICAgICAgIHJldHVybiBmbG93LnJlcXVlc3QgJiYgcmVnZXgudGVzdChSZXF1ZXN0VXRpbHMucHJldHR5X3VybChmbG93LnJlcXVlc3QpKTtcbiAgICAgICAgfVxuICAgICAgICB1cmxGaWx0ZXIuZGVzYyA9IFwidXJsIG1hdGNoZXMgXCIgKyByZWdleDtcbiAgICAgICAgcmV0dXJuIHVybEZpbHRlcjtcbiAgICB9XG5cblxuICAgIHBlZyRyZXN1bHQgPSBwZWckc3RhcnRSdWxlRnVuY3Rpb24oKTtcblxuICAgIGlmIChwZWckcmVzdWx0ICE9PSBwZWckRkFJTEVEICYmIHBlZyRjdXJyUG9zID09PSBpbnB1dC5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBwZWckcmVzdWx0O1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocGVnJHJlc3VsdCAhPT0gcGVnJEZBSUxFRCAmJiBwZWckY3VyclBvcyA8IGlucHV0Lmxlbmd0aCkge1xuICAgICAgICBwZWckZmFpbCh7IHR5cGU6IFwiZW5kXCIsIGRlc2NyaXB0aW9uOiBcImVuZCBvZiBpbnB1dFwiIH0pO1xuICAgICAgfVxuXG4gICAgICB0aHJvdyBwZWckYnVpbGRFeGNlcHRpb24obnVsbCwgcGVnJG1heEZhaWxFeHBlY3RlZCwgcGVnJG1heEZhaWxQb3MpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgU3ludGF4RXJyb3I6IFN5bnRheEVycm9yLFxuICAgIHBhcnNlOiAgICAgICBwYXJzZVxuICB9O1xufSkoKTtcbi8qIGpzaGludCBpZ25vcmU6ZW5kICovXG5cbm1vZHVsZS5leHBvcnRzID0gRmlsdDtcbiIsInZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcblxudmFyIF9NZXNzYWdlVXRpbHMgPSB7XG4gICAgZ2V0Q29udGVudFR5cGU6IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldF9maXJzdF9oZWFkZXIobWVzc2FnZSwgL15Db250ZW50LVR5cGUkL2kpO1xuICAgIH0sXG4gICAgZ2V0X2ZpcnN0X2hlYWRlcjogZnVuY3Rpb24gKG1lc3NhZ2UsIHJlZ2V4KSB7XG4gICAgICAgIC8vRklYTUU6IENhY2hlIEludmFsaWRhdGlvbi5cbiAgICAgICAgaWYgKCFtZXNzYWdlLl9oZWFkZXJMb29rdXBzKVxuICAgICAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG1lc3NhZ2UsIFwiX2hlYWRlckxvb2t1cHNcIiwge1xuICAgICAgICAgICAgICAgIHZhbHVlOiB7fSxcbiAgICAgICAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIGlmICghKHJlZ2V4IGluIG1lc3NhZ2UuX2hlYWRlckxvb2t1cHMpKSB7XG4gICAgICAgICAgICB2YXIgaGVhZGVyO1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtZXNzYWdlLmhlYWRlcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBpZiAoISFtZXNzYWdlLmhlYWRlcnNbaV1bMF0ubWF0Y2gocmVnZXgpKSB7XG4gICAgICAgICAgICAgICAgICAgIGhlYWRlciA9IG1lc3NhZ2UuaGVhZGVyc1tpXTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWVzc2FnZS5faGVhZGVyTG9va3Vwc1tyZWdleF0gPSBoZWFkZXIgPyBoZWFkZXJbMV0gOiB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG1lc3NhZ2UuX2hlYWRlckxvb2t1cHNbcmVnZXhdO1xuICAgIH0sXG4gICAgbWF0Y2hfaGVhZGVyOiBmdW5jdGlvbiAobWVzc2FnZSwgcmVnZXgpIHtcbiAgICAgICAgdmFyIGhlYWRlcnMgPSBtZXNzYWdlLmhlYWRlcnM7XG4gICAgICAgIHZhciBpID0gaGVhZGVycy5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICAgIGlmIChyZWdleC50ZXN0KGhlYWRlcnNbaV0uam9pbihcIiBcIikpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGhlYWRlcnNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbn07XG5cbnZhciBkZWZhdWx0UG9ydHMgPSB7XG4gICAgXCJodHRwXCI6IDgwLFxuICAgIFwiaHR0cHNcIjogNDQzXG59O1xuXG52YXIgUmVxdWVzdFV0aWxzID0gXy5leHRlbmQoX01lc3NhZ2VVdGlscywge1xuICAgIHByZXR0eV9ob3N0OiBmdW5jdGlvbiAocmVxdWVzdCkge1xuICAgICAgICAvL0ZJWE1FOiBBZGQgaG9zdGhlYWRlclxuICAgICAgICByZXR1cm4gcmVxdWVzdC5ob3N0O1xuICAgIH0sXG4gICAgcHJldHR5X3VybDogZnVuY3Rpb24gKHJlcXVlc3QpIHtcbiAgICAgICAgdmFyIHBvcnQgPSBcIlwiO1xuICAgICAgICBpZiAoZGVmYXVsdFBvcnRzW3JlcXVlc3Quc2NoZW1lXSAhPT0gcmVxdWVzdC5wb3J0KSB7XG4gICAgICAgICAgICBwb3J0ID0gXCI6XCIgKyByZXF1ZXN0LnBvcnQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlcXVlc3Quc2NoZW1lICsgXCI6Ly9cIiArIHRoaXMucHJldHR5X2hvc3QocmVxdWVzdCkgKyBwb3J0ICsgcmVxdWVzdC5wYXRoO1xuICAgIH1cbn0pO1xuXG52YXIgUmVzcG9uc2VVdGlscyA9IF8uZXh0ZW5kKF9NZXNzYWdlVXRpbHMsIHt9KTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBSZXNwb25zZVV0aWxzOiBSZXNwb25zZVV0aWxzLFxuICAgIFJlcXVlc3RVdGlsczogUmVxdWVzdFV0aWxzXG5cbn0iLCJcbnZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcbnZhciAkID0gcmVxdWlyZShcImpxdWVyeVwiKTtcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXI7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoXCIuLi91dGlscy5qc1wiKTtcbnZhciBhY3Rpb25zID0gcmVxdWlyZShcIi4uL2FjdGlvbnMuanNcIik7XG52YXIgZGlzcGF0Y2hlciA9IHJlcXVpcmUoXCIuLi9kaXNwYXRjaGVyLmpzXCIpO1xuXG5cbmZ1bmN0aW9uIExpc3RTdG9yZSgpIHtcbiAgICBFdmVudEVtaXR0ZXIuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnJlc2V0KCk7XG59XG5fLmV4dGVuZChMaXN0U3RvcmUucHJvdG90eXBlLCBFdmVudEVtaXR0ZXIucHJvdG90eXBlLCB7XG4gICAgYWRkOiBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICBpZiAoZWxlbS5pZCBpbiB0aGlzLl9wb3NfbWFwKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fcG9zX21hcFtlbGVtLmlkXSA9IHRoaXMubGlzdC5sZW5ndGg7XG4gICAgICAgIHRoaXMubGlzdC5wdXNoKGVsZW0pO1xuICAgICAgICB0aGlzLmVtaXQoXCJhZGRcIiwgZWxlbSk7XG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChlbGVtKSB7XG4gICAgICAgIGlmICghKGVsZW0uaWQgaW4gdGhpcy5fcG9zX21hcCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxpc3RbdGhpcy5fcG9zX21hcFtlbGVtLmlkXV0gPSBlbGVtO1xuICAgICAgICB0aGlzLmVtaXQoXCJ1cGRhdGVcIiwgZWxlbSk7XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uIChlbGVtX2lkKSB7XG4gICAgICAgIGlmICghKGVsZW1faWQgaW4gdGhpcy5fcG9zX21hcCkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmxpc3Quc3BsaWNlKHRoaXMuX3Bvc19tYXBbZWxlbV9pZF0sIDEpO1xuICAgICAgICB0aGlzLl9idWlsZF9tYXAoKTtcbiAgICAgICAgdGhpcy5lbWl0KFwicmVtb3ZlXCIsIGVsZW1faWQpO1xuICAgIH0sXG4gICAgcmVzZXQ6IGZ1bmN0aW9uIChlbGVtcykge1xuICAgICAgICB0aGlzLmxpc3QgPSBlbGVtcyB8fCBbXTtcbiAgICAgICAgdGhpcy5fYnVpbGRfbWFwKCk7XG4gICAgICAgIHRoaXMuZW1pdChcInJlY2FsY3VsYXRlXCIpO1xuICAgIH0sXG4gICAgX2J1aWxkX21hcDogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLl9wb3NfbWFwID0ge307XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5saXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgZWxlbSA9IHRoaXMubGlzdFtpXTtcbiAgICAgICAgICAgIHRoaXMuX3Bvc19tYXBbZWxlbS5pZF0gPSBpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBnZXQ6IGZ1bmN0aW9uIChlbGVtX2lkKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmxpc3RbdGhpcy5fcG9zX21hcFtlbGVtX2lkXV07XG4gICAgfSxcbiAgICBpbmRleDogZnVuY3Rpb24gKGVsZW1faWQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Bvc19tYXBbZWxlbV9pZF07XG4gICAgfVxufSk7XG5cblxuZnVuY3Rpb24gRGljdFN0b3JlKCkge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIHRoaXMucmVzZXQoKTtcbn1cbl8uZXh0ZW5kKERpY3RTdG9yZS5wcm90b3R5cGUsIEV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChkaWN0KSB7XG4gICAgICAgIF8ubWVyZ2UodGhpcy5kaWN0LCBkaWN0KTtcbiAgICAgICAgdGhpcy5lbWl0KFwicmVjYWxjdWxhdGVcIik7XG4gICAgfSxcbiAgICByZXNldDogZnVuY3Rpb24gKGRpY3QpIHtcbiAgICAgICAgdGhpcy5kaWN0ID0gZGljdCB8fCB7fTtcbiAgICAgICAgdGhpcy5lbWl0KFwicmVjYWxjdWxhdGVcIik7XG4gICAgfVxufSk7XG5cbmZ1bmN0aW9uIExpdmVTdG9yZU1peGluKHR5cGUpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuXG4gICAgdGhpcy5fdXBkYXRlc19iZWZvcmVfZmV0Y2ggPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fZmV0Y2h4aHIgPSBmYWxzZTtcblxuICAgIHRoaXMuaGFuZGxlID0gdGhpcy5oYW5kbGUuYmluZCh0aGlzKTtcbiAgICBkaXNwYXRjaGVyLkFwcERpc3BhdGNoZXIucmVnaXN0ZXIodGhpcy5oYW5kbGUpO1xuXG4gICAgLy8gQXZvaWQgZG91YmxlLWZldGNoIG9uIHN0YXJ0dXAuXG4gICAgaWYgKCEod2luZG93LndzICYmIHdpbmRvdy53cy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuQ09OTkVDVElORykpIHtcbiAgICAgICAgdGhpcy5mZXRjaCgpO1xuICAgIH1cbn1cbl8uZXh0ZW5kKExpdmVTdG9yZU1peGluLnByb3RvdHlwZSwge1xuICAgIGhhbmRsZTogZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICAgIGlmIChldmVudC50eXBlID09PSBhY3Rpb25zLkFjdGlvblR5cGVzLkNPTk5FQ1RJT05fT1BFTikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmV0Y2goKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZXZlbnQudHlwZSA9PT0gdGhpcy50eXBlKSB7XG4gICAgICAgICAgICBpZiAoZXZlbnQuY21kID09PSBhY3Rpb25zLlN0b3JlQ21kcy5SRVNFVCkge1xuICAgICAgICAgICAgICAgIHRoaXMuZmV0Y2goZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJkZWZlciB1cGRhdGVcIiwgZXZlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoLnB1c2goZXZlbnQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzW2V2ZW50LmNtZF0oZXZlbnQuZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIGNsb3NlOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGRpc3BhdGNoZXIuQXBwRGlzcGF0Y2hlci51bnJlZ2lzdGVyKHRoaXMuaGFuZGxlKTtcbiAgICB9LFxuICAgIGZldGNoOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcImZldGNoIFwiICsgdGhpcy50eXBlKTtcbiAgICAgICAgaWYgKHRoaXMuX2ZldGNoeGhyKSB7XG4gICAgICAgICAgICB0aGlzLl9mZXRjaHhoci5hYm9ydCgpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoID0gW107IC8vIChKUzogZW1wdHkgYXJyYXkgaXMgdHJ1ZSlcbiAgICAgICAgaWYgKGRhdGEpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlX2ZldGNoKGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fZmV0Y2h4aHIgPSAkLmdldEpTT04oXCIvXCIgKyB0aGlzLnR5cGUpXG4gICAgICAgICAgICAgICAgLmRvbmUoZnVuY3Rpb24gKG1lc3NhZ2UpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVfZmV0Y2gobWVzc2FnZS5kYXRhKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICAgICAgICAgICAgLmZhaWwoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBFdmVudExvZ0FjdGlvbnMuYWRkX2V2ZW50KFwiQ291bGQgbm90IGZldGNoIFwiICsgdGhpcy50eXBlKTtcbiAgICAgICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBoYW5kbGVfZmV0Y2g6IGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIHRoaXMuX2ZldGNoeGhyID0gZmFsc2U7XG4gICAgICAgIGNvbnNvbGUubG9nKHRoaXMudHlwZSArIFwiIGZldGNoZWQuXCIsIHRoaXMuX3VwZGF0ZXNfYmVmb3JlX2ZldGNoKTtcbiAgICAgICAgdGhpcy5yZXNldChkYXRhKTtcbiAgICAgICAgdmFyIHVwZGF0ZXMgPSB0aGlzLl91cGRhdGVzX2JlZm9yZV9mZXRjaDtcbiAgICAgICAgdGhpcy5fdXBkYXRlc19iZWZvcmVfZmV0Y2ggPSBmYWxzZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB1cGRhdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmhhbmRsZSh1cGRhdGVzW2ldKTtcbiAgICAgICAgfVxuICAgIH0sXG59KTtcblxuZnVuY3Rpb24gTGl2ZUxpc3RTdG9yZSh0eXBlKSB7XG4gICAgTGlzdFN0b3JlLmNhbGwodGhpcyk7XG4gICAgTGl2ZVN0b3JlTWl4aW4uY2FsbCh0aGlzLCB0eXBlKTtcbn1cbl8uZXh0ZW5kKExpdmVMaXN0U3RvcmUucHJvdG90eXBlLCBMaXN0U3RvcmUucHJvdG90eXBlLCBMaXZlU3RvcmVNaXhpbi5wcm90b3R5cGUpO1xuXG5mdW5jdGlvbiBMaXZlRGljdFN0b3JlKHR5cGUpIHtcbiAgICBEaWN0U3RvcmUuY2FsbCh0aGlzKTtcbiAgICBMaXZlU3RvcmVNaXhpbi5jYWxsKHRoaXMsIHR5cGUpO1xufVxuXy5leHRlbmQoTGl2ZURpY3RTdG9yZS5wcm90b3R5cGUsIERpY3RTdG9yZS5wcm90b3R5cGUsIExpdmVTdG9yZU1peGluLnByb3RvdHlwZSk7XG5cblxuZnVuY3Rpb24gRmxvd1N0b3JlKCkge1xuICAgIHJldHVybiBuZXcgTGl2ZUxpc3RTdG9yZShhY3Rpb25zLkFjdGlvblR5cGVzLkZMT1dfU1RPUkUpO1xufVxuXG5mdW5jdGlvbiBTZXR0aW5nc1N0b3JlKCkge1xuICAgIHJldHVybiBuZXcgTGl2ZURpY3RTdG9yZShhY3Rpb25zLkFjdGlvblR5cGVzLlNFVFRJTkdTX1NUT1JFKTtcbn1cblxuZnVuY3Rpb24gRXZlbnRMb2dTdG9yZSgpIHtcbiAgICBMaXZlTGlzdFN0b3JlLmNhbGwodGhpcywgYWN0aW9ucy5BY3Rpb25UeXBlcy5FVkVOVF9TVE9SRSk7XG59XG5fLmV4dGVuZChFdmVudExvZ1N0b3JlLnByb3RvdHlwZSwgTGl2ZUxpc3RTdG9yZS5wcm90b3R5cGUsIHtcbiAgICBmZXRjaDogZnVuY3Rpb24oKXtcbiAgICAgICAgTGl2ZUxpc3RTdG9yZS5wcm90b3R5cGUuZmV0Y2guYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgICAgICAvLyBNYWtlIHN1cmUgdG8gZGlzcGxheSB1cGRhdGVzIGV2ZW4gaWYgZmV0Y2hpbmcgYWxsIGV2ZW50cyBmYWlsZWQuXG4gICAgICAgIC8vIFRoaXMgd2F5LCB3ZSBjYW4gc2VuZCBcImZldGNoIGZhaWxlZFwiIGxvZyBtZXNzYWdlcyB0byB0aGUgbG9nLlxuICAgICAgICBpZih0aGlzLl9mZXRjaHhocil7XG4gICAgICAgICAgICB0aGlzLl9mZXRjaHhoci5mYWlsKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgdGhpcy5oYW5kbGVfZmV0Y2gobnVsbCk7XG4gICAgICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB9XG4gICAgfVxufSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgRXZlbnRMb2dTdG9yZTogRXZlbnRMb2dTdG9yZSxcbiAgICBTZXR0aW5nc1N0b3JlOiBTZXR0aW5nc1N0b3JlLFxuICAgIEZsb3dTdG9yZTogRmxvd1N0b3JlXG59OyIsIlxudmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcbnZhciBfID0gcmVxdWlyZShcImxvZGFzaFwiKTtcblxuXG52YXIgdXRpbHMgPSByZXF1aXJlKFwiLi4vdXRpbHMuanNcIik7XG5cbmZ1bmN0aW9uIFNvcnRCeVN0b3JlT3JkZXIoZWxlbSkge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLmluZGV4KGVsZW0uaWQpO1xufVxuXG52YXIgZGVmYXVsdF9zb3J0ID0gU29ydEJ5U3RvcmVPcmRlcjtcbnZhciBkZWZhdWx0X2ZpbHQgPSBmdW5jdGlvbihlbGVtKXtcbiAgICByZXR1cm4gdHJ1ZTtcbn07XG5cbmZ1bmN0aW9uIFN0b3JlVmlldyhzdG9yZSwgZmlsdCwgc29ydGZ1bikge1xuICAgIEV2ZW50RW1pdHRlci5jYWxsKHRoaXMpO1xuICAgIGZpbHQgPSBmaWx0IHx8IGRlZmF1bHRfZmlsdDtcbiAgICBzb3J0ZnVuID0gc29ydGZ1biB8fCBkZWZhdWx0X3NvcnQ7XG5cbiAgICB0aGlzLnN0b3JlID0gc3RvcmU7XG5cbiAgICB0aGlzLmFkZCA9IHRoaXMuYWRkLmJpbmQodGhpcyk7XG4gICAgdGhpcy51cGRhdGUgPSB0aGlzLnVwZGF0ZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMucmVtb3ZlID0gdGhpcy5yZW1vdmUuYmluZCh0aGlzKTtcbiAgICB0aGlzLnJlY2FsY3VsYXRlID0gdGhpcy5yZWNhbGN1bGF0ZS5iaW5kKHRoaXMpO1xuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJhZGRcIiwgdGhpcy5hZGQpO1xuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJ1cGRhdGVcIiwgdGhpcy51cGRhdGUpO1xuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJyZW1vdmVcIiwgdGhpcy5yZW1vdmUpO1xuICAgIHRoaXMuc3RvcmUuYWRkTGlzdGVuZXIoXCJyZWNhbGN1bGF0ZVwiLCB0aGlzLnJlY2FsY3VsYXRlKTtcblxuICAgIHRoaXMucmVjYWxjdWxhdGUoZmlsdCwgc29ydGZ1bik7XG59XG5cbl8uZXh0ZW5kKFN0b3JlVmlldy5wcm90b3R5cGUsIEV2ZW50RW1pdHRlci5wcm90b3R5cGUsIHtcbiAgICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnN0b3JlLnJlbW92ZUxpc3RlbmVyKFwiYWRkXCIsIHRoaXMuYWRkKTtcbiAgICAgICAgdGhpcy5zdG9yZS5yZW1vdmVMaXN0ZW5lcihcInVwZGF0ZVwiLCB0aGlzLnVwZGF0ZSk7XG4gICAgICAgIHRoaXMuc3RvcmUucmVtb3ZlTGlzdGVuZXIoXCJyZW1vdmVcIiwgdGhpcy5yZW1vdmUpO1xuICAgICAgICB0aGlzLnN0b3JlLnJlbW92ZUxpc3RlbmVyKFwicmVjYWxjdWxhdGVcIiwgdGhpcy5yZWNhbGN1bGF0ZSk7XG4gICAgICAgIH0sXG4gICAgICAgIHJlY2FsY3VsYXRlOiBmdW5jdGlvbiAoZmlsdCwgc29ydGZ1bikge1xuICAgICAgICBpZiAoZmlsdCkge1xuICAgICAgICAgICAgdGhpcy5maWx0ID0gZmlsdC5iaW5kKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzb3J0ZnVuKSB7XG4gICAgICAgICAgICB0aGlzLnNvcnRmdW4gPSBzb3J0ZnVuLmJpbmQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxpc3QgPSB0aGlzLnN0b3JlLmxpc3QuZmlsdGVyKHRoaXMuZmlsdCk7XG4gICAgICAgIHRoaXMubGlzdC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zb3J0ZnVuKGEpIC0gdGhpcy5zb3J0ZnVuKGIpO1xuICAgICAgICB9LmJpbmQodGhpcykpO1xuICAgICAgICB0aGlzLmVtaXQoXCJyZWNhbGN1bGF0ZVwiKTtcbiAgICB9LFxuICAgIGluZGV4OiBmdW5jdGlvbiAoZWxlbSkge1xuICAgICAgICByZXR1cm4gXy5zb3J0ZWRJbmRleCh0aGlzLmxpc3QsIGVsZW0sIHRoaXMuc29ydGZ1bik7XG4gICAgfSxcbiAgICBhZGQ6IGZ1bmN0aW9uIChlbGVtKSB7XG4gICAgICAgIGlmICh0aGlzLmZpbHQoZWxlbSkpIHtcbiAgICAgICAgICAgIHZhciBpZHggPSB0aGlzLmluZGV4KGVsZW0pO1xuICAgICAgICAgICAgaWYgKGlkeCA9PT0gdGhpcy5saXN0Lmxlbmd0aCkgeyAvL2hhcHBlbnMgb2Z0ZW4sIC5wdXNoIGlzIHdheSBmYXN0ZXIuXG4gICAgICAgICAgICAgICAgdGhpcy5saXN0LnB1c2goZWxlbSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMubGlzdC5zcGxpY2UoaWR4LCAwLCBlbGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZW1pdChcImFkZFwiLCBlbGVtLCBpZHgpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICB1cGRhdGU6IGZ1bmN0aW9uIChlbGVtKSB7XG4gICAgICAgIHZhciBpZHg7XG4gICAgICAgIHZhciBpID0gdGhpcy5saXN0Lmxlbmd0aDtcbiAgICAgICAgLy8gU2VhcmNoIGZyb20gdGhlIGJhY2ssIHdlIHVzdWFsbHkgdXBkYXRlIHRoZSBsYXRlc3QgZW50cmllcy5cbiAgICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICAgICAgaWYgKHRoaXMubGlzdFtpXS5pZCA9PT0gZWxlbS5pZCkge1xuICAgICAgICAgICAgICAgIGlkeCA9IGk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaWR4ID09PSAtMSkgeyAvL25vdCBjb250YWluZWQgaW4gbGlzdFxuICAgICAgICAgICAgdGhpcy5hZGQoZWxlbSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIXRoaXMuZmlsdChlbGVtKSkge1xuICAgICAgICAgICAgdGhpcy5yZW1vdmUoZWxlbS5pZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5zb3J0ZnVuKHRoaXMubGlzdFtpZHhdKSAhPT0gdGhpcy5zb3J0ZnVuKGVsZW0pKSB7IC8vc29ydHBvcyBoYXMgY2hhbmdlZFxuICAgICAgICAgICAgICAgIHRoaXMucmVtb3ZlKHRoaXMubGlzdFtpZHhdKTtcbiAgICAgICAgICAgICAgICB0aGlzLmFkZChlbGVtKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5saXN0W2lkeF0gPSBlbGVtO1xuICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcInVwZGF0ZVwiLCBlbGVtLCBpZHgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICByZW1vdmU6IGZ1bmN0aW9uIChlbGVtX2lkKSB7XG4gICAgICAgIHZhciBpZHggPSB0aGlzLmxpc3QubGVuZ3RoO1xuICAgICAgICB3aGlsZSAoaWR4LS0pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmxpc3RbaWR4XS5pZCA9PT0gZWxlbV9pZCkge1xuICAgICAgICAgICAgICAgIHRoaXMubGlzdC5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICAgICAgICB0aGlzLmVtaXQoXCJyZW1vdmVcIiwgZWxlbV9pZCwgaWR4KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBTdG9yZVZpZXc6IFN0b3JlVmlld1xufTsiLCJ2YXIgJCA9IHJlcXVpcmUoXCJqcXVlcnlcIik7XG5cblxudmFyIEtleSA9IHtcbiAgICBVUDogMzgsXG4gICAgRE9XTjogNDAsXG4gICAgUEFHRV9VUDogMzMsXG4gICAgUEFHRV9ET1dOOiAzNCxcbiAgICBIT01FOiAzNixcbiAgICBFTkQ6IDM1LFxuICAgIExFRlQ6IDM3LFxuICAgIFJJR0hUOiAzOSxcbiAgICBFTlRFUjogMTMsXG4gICAgRVNDOiAyNyxcbiAgICBUQUI6IDksXG4gICAgU1BBQ0U6IDMyLFxuICAgIEJBQ0tTUEFDRTogOCxcbn07XG4vLyBBZGQgQS1aXG5mb3IgKHZhciBpID0gNjU7IGkgPD0gOTA7IGkrKykge1xuICAgIEtleVtTdHJpbmcuZnJvbUNoYXJDb2RlKGkpXSA9IGk7XG59XG5cblxudmFyIGZvcm1hdFNpemUgPSBmdW5jdGlvbiAoYnl0ZXMpIHtcbiAgICB2YXIgc2l6ZSA9IGJ5dGVzO1xuICAgIHZhciBwcmVmaXggPSBbXCJCXCIsIFwiS0JcIiwgXCJNQlwiLCBcIkdCXCIsIFwiVEJcIl07XG4gICAgdmFyIGkgPSAwO1xuICAgIHdoaWxlIChNYXRoLmFicyhzaXplKSA+PSAxMDI0ICYmIGkgPCBwcmVmaXgubGVuZ3RoIC0gMSkge1xuICAgICAgICBpKys7XG4gICAgICAgIHNpemUgPSBzaXplIC8gMTAyNDtcbiAgICB9XG4gICAgcmV0dXJuIChNYXRoLmZsb29yKHNpemUgKiAxMDApIC8gMTAwLjApLnRvRml4ZWQoMikgKyBwcmVmaXhbaV07XG59O1xuXG5cbnZhciBmb3JtYXRUaW1lRGVsdGEgPSBmdW5jdGlvbiAobWlsbGlzZWNvbmRzKSB7XG4gICAgdmFyIHRpbWUgPSBtaWxsaXNlY29uZHM7XG4gICAgdmFyIHByZWZpeCA9IFtcIm1zXCIsIFwic1wiLCBcIm1pblwiLCBcImhcIl07XG4gICAgdmFyIGRpdiA9IFsxMDAwLCA2MCwgNjBdO1xuICAgIHZhciBpID0gMDtcbiAgICB3aGlsZSAoTWF0aC5hYnModGltZSkgPj0gZGl2W2ldICYmIGkgPCBkaXYubGVuZ3RoKSB7XG4gICAgICAgIHRpbWUgPSB0aW1lIC8gZGl2W2ldO1xuICAgICAgICBpKys7XG4gICAgfVxuICAgIHJldHVybiBNYXRoLnJvdW5kKHRpbWUpICsgcHJlZml4W2ldO1xufTtcblxuXG52YXIgZm9ybWF0VGltZVN0YW1wID0gZnVuY3Rpb24gKHNlY29uZHMpIHtcbiAgICB2YXIgdHMgPSAobmV3IERhdGUoc2Vjb25kcyAqIDEwMDApKS50b0lTT1N0cmluZygpO1xuICAgIHJldHVybiB0cy5yZXBsYWNlKFwiVFwiLCBcIiBcIikucmVwbGFjZShcIlpcIiwgXCJcIik7XG59O1xuXG5cbmZ1bmN0aW9uIGdldENvb2tpZShuYW1lKSB7XG4gICAgdmFyIHIgPSBkb2N1bWVudC5jb29raWUubWF0Y2goXCJcXFxcYlwiICsgbmFtZSArIFwiPShbXjtdKilcXFxcYlwiKTtcbiAgICByZXR1cm4gciA/IHJbMV0gOiB1bmRlZmluZWQ7XG59XG52YXIgeHNyZiA9ICQucGFyYW0oe194c3JmOiBnZXRDb29raWUoXCJfeHNyZlwiKX0pO1xuXG4vL1Rvcm5hZG8gWFNSRiBQcm90ZWN0aW9uLlxuJC5hamF4UHJlZmlsdGVyKGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgaWYgKFtcInBvc3RcIiwgXCJwdXRcIiwgXCJkZWxldGVcIl0uaW5kZXhPZihvcHRpb25zLnR5cGUudG9Mb3dlckNhc2UoKSkgPj0gMCAmJiBvcHRpb25zLnVybFswXSA9PT0gXCIvXCIpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuZGF0YSkge1xuICAgICAgICAgICAgb3B0aW9ucy5kYXRhICs9IChcIiZcIiArIHhzcmYpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3B0aW9ucy5kYXRhID0geHNyZjtcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuLy8gTG9nIEFKQVggRXJyb3JzXG4kKGRvY3VtZW50KS5hamF4RXJyb3IoZnVuY3Rpb24gKGV2ZW50LCBqcVhIUiwgYWpheFNldHRpbmdzLCB0aHJvd25FcnJvcikge1xuICAgIHZhciBtZXNzYWdlID0ganFYSFIucmVzcG9uc2VUZXh0O1xuICAgIGNvbnNvbGUuZXJyb3IobWVzc2FnZSwgYXJndW1lbnRzKTtcbiAgICBFdmVudExvZ0FjdGlvbnMuYWRkX2V2ZW50KHRocm93bkVycm9yICsgXCI6IFwiICsgbWVzc2FnZSk7XG4gICAgd2luZG93LmFsZXJ0KG1lc3NhZ2UpO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGZvcm1hdFNpemU6IGZvcm1hdFNpemUsXG4gICAgZm9ybWF0VGltZURlbHRhOiBmb3JtYXRUaW1lRGVsdGEsXG4gICAgZm9ybWF0VGltZVN0YW1wOiBmb3JtYXRUaW1lU3RhbXAsXG4gICAgS2V5OiBLZXlcbn07Il19
