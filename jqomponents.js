/**
 * Engine.
 * Handles components
 * @constructor
 */
function ComponentEngine() {
  this.components = {};
  this.eventListeners = {};
  this.initialized = false;
  this.deferredEvents = [];
}

ComponentEngine.prototype = {
  constructor: ComponentEngine,

  /**
   * Initializes components, dispatches events after initialization of all the components.
   */
  init: function () {
    var self = this;

    // Initializing components
    for (var c in this.components) {
      if (this.components.hasOwnProperty(c)) {
        var component = this.components[c];
        if ((component.selector ? component.tryToSetElements() : true) && component.guard(this)) {
          this._initComponent(component);
        }
      }
    }
    this.initialized = true;

    // Dispatching deferred events
    for (var e in this.deferredEvents) {
      if (this.deferredEvents.hasOwnProperty(e)) {
        var event = this.deferredEvents[e];
        this.dispatchEvent(event.event, event.data);
      }
    }
    this.deferredEvents.length = 0;

    // Adding listeners for actions ([data-action])
    function actionHandler() {
      var action = $(this).data('action');
      for (var c in self.components) {
        if (self.components.hasOwnProperty(c)) {
          self.components[c].executeAction(action, this);
        }
      }
    }

    $('body').on('click', '[data-action]:not([data-trigger])', actionHandler)
             .on('change', '[data-action][data-trigger="change"]', actionHandler);
  },

  /**
   * Adds the component and initializes it if the engine is initialized.
   * @param {Component} component
   */
  addComponent: function (component) {
      if (this.components[component.name]) {
        console.error('Component with name "' + component.name + '" already exists.');
        return;
      }
      if (this.initialized && component.guard(this)) {
        this._initComponent(component);
      }
      this.components[component.name] = component;
  },

  /**
   * Gets the component by its name.
   * @param {string|Component} component
   * @returns {Component}
   */
  getComponent: function (component) {
    var name;
    if (typeof component == 'string' || component instanceof String) {
      name = component;
    } else {
      name = component.name;
    }
    return this.components[name];
  },

  /**
   * Invokes 'disableComponent' for the component and removes it from the list of all components. 
   * @param {string|Component} component
   */
  removeComponent: function (component) {
    component = this.getComponent(component);
    this.disableComponent(component);
    component.engine = undefined;
    delete this.components[component];
  },

  /**
   * Initializes the component.
   * @param {string|Component} component
   */
  enableComponent: function (component) {
    component = this.getComponent(component);
    if (!component.enabled) {
      this._initComponent(component);
    }
  },

  /**
   * Invokes 'remove' of the component, removes event handlers of the component from the engine.
   * @param {string|Component} component
   */
  disableComponent: function (component) {
    component = this.getComponent(component);
    if (component.enabled) {
      component.remove(this);
      component.enabled = false;
      // Removing event handlers of the component
      for (var ls in this.eventListeners) {
        if (this.eventListeners.hasOwnProperty(ls)) {
          var listeners = this.eventListeners[ls];
          for (var i = 0; i < listeners.length; i++) {
            if (listeners[i].component === component) {
              listeners.splice(i, 1);
            }
          }
        }
      }
    }
  },

  /**
   * Adds the event listener to 'this.listeners[event]'
   * @param {string} event
   * @param {function} listener
   */
  addEventListener: function (event, listener) {
    var listeners = this.eventListeners;
    listeners[event] = listeners[event] || [];
    listeners[event].push(listener);
  },

  /**
   * Removes the event listener.
   * @param {string} event
   * @param {function} listener
   */
  removeEventListener: function (event, listener) {
    if (!Array.isArray(this.eventListeners[event])) {
      return;
    }
    var listeners = this.eventListeners[event];
    listeners.splice(listeners.indexOf(listener), 1);
  },

  /**
   * Dispatches the event.
   * @param {string} event
   * @param {object} data - Any data.
   */
  dispatchEvent: function (event, data) {
    if (this.initialized) {
      var listeners = this.eventListeners[event];
      if (Array.isArray(listeners)) {
        for (var i = 0; i < listeners.length; i++) {
          listeners[i](data);
        }
      }
    } else {
      this.deferredEvents.push({event: event, data: data});
    }
  },

  /**
   * Recursively initializes the component and its subcomponents.
   * @param {string|Component} component
   * @param {string} [scopeStr]
   * @private
   */
  _initComponent: function (component, scopeStr) {
    scopeStr = scopeStr || component.name;
    component.engine = this;
    component.init(this);
    component.enabled = true;
    console.log("Component '" + scopeStr + "' initialized.", component);
    for (var i = 0; i < component.subcomponents.length; i++) {
      var subcomponent = component.subcomponents[i];
      if (subcomponent.guard(this)) {
        subcomponent.parent = component;
        this._initComponent(subcomponent, scopeStr + '.' + subcomponent.name);
      }
    }
  }
};

/**
 * Component.
 * @param {string} name - The name of the component. It must be unique.
 * @param {object} options - Definitions of 'guard', 'init', 'remove', 'selector' etc.
 * @constructor
 */
function Component(name, options) {
  var self = this;

  this.name = name;
  this.subcomponents = options.subcomponents || [];
  this.engine = undefined;
  this.data = {};
  this.enabled = false;
  this.parent = undefined;
  this.actions = {};
  this.selector = undefined;
  for (var option in options) {
    if (options.hasOwnProperty(option)) {
      this[option] = options[option];
    }
  }
}

Component.prototype = {
  constructor: Component,

  /**
   * Determines whether or not to add the component to the engine.
   * @param {ComponentEngine} app - Вызывающий движок.
   * @returns {boolean}
   */
  guard: function (app) {
    return true;
  },

  /**
   * Sets 'this.element' to an element obtained throught '$(this.selector)'.
   * @returns {boolean}
   * @internal
   */
  tryToSetElements: function () {
    var elements = $(this.selector);
    if (elements.length > 0) {
      this.elements = elements;
    }
    return !!elements.length;
  },

  /**
   * Resets the component's state.
   */
  reset: function () {
    this.data = undefined;
    this.elements = undefined;
    this.initialized = false;
  },

  /**
   * Called by the engine when the component is being initialized.
   * @param {ComponentEngine} app - Вызывающий движок.
   */
  init: function (app) {
    console.warn("Function 'init' is not specified for the '" + this.name + "' component.");
  },

  /**
   * Called by the engine before removing the component.
   * @param {ComponentEngine} app - Вызывающий движок.
   */
  remove: function (app) {
    console.warn("Function 'remove' is not specified for the '" + this.name + "' component.");
  },

  /**
   * Adds the action callback for all the elements with '[data-action=name]'.
   * The action callback invoked on the 'click' or 'change' event.
   * @param {string} name - Значение [data-action].
   * @param {function} callback
   */
  addAction: function (name, callback) {
    this.actions[name] = this.actions[name] || [];
    this.actions[name].push(callback);
  },

  /**
   * Removes an action handler for elements with '[data-action=name]'.
   * @param {string} name
   * @param {function} callback
   */
  removeAction: function (name, callback) {
    if (!Array.isArray(this.actions[event])) {
      return;
    }
    var actions = this.actions[name];
    actions.splice(actions.indexOf(callback), 1);
  },

  /**
   * Recursively calls the functions associated with the event. 
   * @param {string} name
   * @param {jQuery} element - 'this' for the action handler.
   */
  executeAction: function (name, element) {
    if (this.actions.hasOwnProperty(name)) {
      if (Array.isArray(this.actions[name])) {
        for (var i = 0; i < this.actions.length; i++) {
          this.actions[name][i].apply(element, [this]);
        }
      } else {
        this.actions[name].apply(element, [this]);
      }
    }
    for (var subI = 0; subI < this.subcomponents.length; subI++) {
      this.subcomponents[subI].executeAction(name, element);
    }
  },

  /**
   *
   * @param {string} event
   * @param {function} listener
   */
  addEventListener: function (event, listener) {
    listener.component = this;
    this.engine.addEventListener(event, listener);
  },

  /**
   *
   * @param {string} event
   * @param {function} listener
   */
  removeEventListener: function (event, listener) {
    this.engine.removeEventListener(event, listener);
  },

  /**
   *
   * @param {string} event
   * @param {object} data
   */
  dispatchEvent: function (event, data) {
    this.engine.dispatchEvent(event, data);
  }
};
