/**
 * An event system.
 * Event naming:
 *   EventName - Common events
 *   ComponentName.EventName - Component-specific events
 * @type {{on: Function, off: Function, trigger: Function}}
 */
var ObservableMixin = {
  _initEvents: function () {
    this._eventCallbacks = {};
  },

  on: function (event, callback) {
    if (!this._eventCallbacks[event]) {
      this._eventCallbacks[event] = [];
    }
    this._eventCallbacks[event].push(callback);
  },

  off: function (event, callback) {
    if (Array.isArray(this._eventCallbacks[event])) {
      var index = this._eventCallbacks[event].indexOf(callback);

      if (index > -1) {
        this._eventCallbacks[event].splice(index, 1);
      }
    }
  },

  trigger: function (event, data) {
    if (Array.isArray(this._eventCallbacks[event])) {
      var len = this._eventCallbacks[event].length;
      for (var iCallback = 0; iCallback < len; ++iCallback) {
        this._eventCallbacks[event][iCallback](data);
      }
    }

    if (this.parent && this.parent.trigger) {
      this.parent.trigger(event, data);
    }
  }
};

function copyProperties(from, to) {
  for (var attr in from) {
    if (from.hasOwnProperty(attr)) {
      to[attr] = from[attr];
    }
  }
}

/**
 * An Application
 * Handles components
 *
 * Usage:
 *   // Create an application
 *   var App = new Application();
 *
 *   // Create a component
 *   App.component('Example', {
 *     selector: '.component-class',
 *
 *     init: function (app) {
 *       // Initialize state here
 *     }
 *   });
 *
 *   // Initialize the application
 *   App.init();
 *
 * @constructor
 */
function Application() {
  copyProperties(ObservableMixin, this);

  this._initEvents();

  this.components = [];
  this.uninitComponents = [];
  this.inactiveComponents = [];
  this.initialized = false;
}

Application.prototype = {
  constructor: Application,

  /**
   * Initializes the application
   */
  init: function () {
    var components = this.uninitComponents;
    var component;

    for (var iComp = 0; iComp < components.length; ++iComp) {
      component = components[iComp];
      component._prepare(this);
      if (component._shouldInitialize()) {
        component.init(this);
        this.components.push(component);
        console.log('Component ' + component.name + ' initialized.');
      } else {
        component._reset();
        this.inactiveComponents.push(component);
      }
    }

    this.uninitComponents.length = 0;
  },

  /**
   * Reset all the components
   */
  reset: function () {
    var components = this.components.concat(this.inactiveComponents);

    this.uninitComponents = components;
    this.components = [];
    this.inactiveComponents = [];

    for (var iComp = 0; iComp < components.length; ++iComp) {
      components[iComp]._reset();
    }

    this.initialized = false;
  },

  /**
   * Creates a component and add it the application
   * @param name
   * @param opts
   */
  component: function (name, opts) {
    opts.name = name;
    var component = new Component(opts);

    this.addComponent(component);
  },

  /**
   * Adds and initializes the component
   * @param component
   */
  addComponent: function (component) {
    if (this.initialized) {
      component._prepare(this);
      if (component._shouldInitialize()) {
        component.init(this);
        this.components.push(component);
      } else {
        component._reset();
      }
    } else {
      this.uninitComponents.push(component);
    }
  },

  /**
   * Get a component by the name.
   * @param name
   */
  getComponent: function (name) {
    var components = this.components;
    for (var iComp = 0; components.length; ++iComp) {
      if (components[iComp].name == name) {
        return components[iComp]
      }
    }
  }
};


/**
 * A Component
 * @param opts {object}
 * @constructor
 */
function Component(opts) {
  copyProperties(ObservableMixin, this);

  this._initEvents();

  this.guard = function () { return true; };
  this.init = function () { console.warn('An init method is not provided for the ' + this.name + ' component.'); };
  this.state = {};

  for (var opt in opts) {
    if (opts.hasOwnProperty(opt)) {
      this[opt] = opts[opt];
    }
  }
}

Component.prototype = {
  constructor: Component,

  /**
   * Prepares the component for initialization
   * Sets this.element using this.selector
   * @private
   */
  _prepare: function (app) {
    if (!this.selector) {
      throw 'A selector is not provided for the ' + this.name + ' component.';
    }
    this.element = $(this.selector);
    this.engine = app;
    this.parent = app;
  },

  /**
   * Resets the component's state
   * @private
   */
  _reset: function () {
    this.state = {};
    delete this.engine;
    delete this.parent;
    delete this.element;
  },

  /**
   * @returns {boolean}
   * @private
   */
  _shouldInitialize: function () {
    return this.guard() && this.element.length;
  }
};
