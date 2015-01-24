/**
 * Движок.
 * Содержит, инициализирует, удаляет компоненты.
 * Предоставляет обработку событий (простой EventDispatcher)
 * и действий по клику и change ([data-action] у элементов).
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
   * Инициализирует компоненты, отправляет события,
   * созданные в методах init компонентов до полной инициализации движка.
   * Вешает обработчик кликов на элементы с [data-action].
   */
  init: function () {
    var self = this;

    // Инициализация компонентов
    for (var c in this.components) {
      if (this.components.hasOwnProperty(c)) {
        var component = this.components[c];
        if ((component.selector ? component.tryToSetElements() : true) && component.guard(this)) {
          this._initComponent(component);
        }
      }
    }
    this.initialized = true;

    // Отправка событий
    for (var e in this.deferredEvents) {
      if (this.deferredEvents.hasOwnProperty(e)) {
        var event = this.deferredEvents[e];
        this.dispatchEvent(event.event, event.data);
      }
    }
    this.deferredEvents.length = 0;

    // Обработчики действий
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
   * Добавляет компонент и инициализирует его, если движок уже инициализирован.
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
   * Получает компонент по имени.
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
   * Вызывает disableComponent и удаляет из components.
   * @param {string|Component} component
   */
  removeComponent: function (component) {
    component = this.getComponent(component);
    this.disableComponent(component);
    component.engine = undefined;
    delete this.components[component];
  },

  /**
   * Инициализирует компонент.
   * @param {string|Component} component
   */
  enableComponent: function (component) {
    component = this.getComponent(component);
    if (!component.enabled) {
      this._initComponent(component);
    }
  },

  /**
   * Вызывает remove у компонента, удаляет обработчики событий,
   * но не удаляет компонент из components.
   * @param {string|Component} component
   */
  disableComponent: function (component) {
    component = this.getComponent(component);
    if (component.enabled) {
      component.remove(this);
      component.enabled = false;
      // TODO: Если хранить события в компоненте, то возможно их удалять за O(N), но пока нет нужды.
      // Удаление обработчиков событий
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

  // TODO: Возможно, изменить систему событий или использовать стороннюю если потребуется.
  /**
   * Добавляет обработчик событий.
   * @param {string} event
   * @param {function} listener
   */
  addEventListener: function (event, listener) {
    var listeners = this.eventListeners;
    listeners[event] = listeners[event] || [];
    listeners[event].push(listener);
  },

  /**
   * Удаляет обработчик событий.
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
   * Создает событие.
   * @param {string} event
   * @param {object} data - Любые данные.
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
   * Рекурсивно инициализирует компонент и его подкомпоненты.
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
 * Компонент.
 * Методы необходимые для движка (есть заглушки в прототипе):
 *   guard, init, remove
 * @param {string} name - Имя компонента. Должно быть уникальным.
 * @param {object} options - Определения guard, init, remove и другие опции.
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
   * Определяет, добавлять компонент или нет.
   * Обычно определяется в опциях при создании компонента.
   * Вызывается движком.
   * @param {ComponentEngine} app - Вызывающий движок.
   * @returns {boolean}
   */
  guard: function (app) {
    return true;
  },

  /**
   * Устанавливает элементы по селектору.
   * Вызывается движком.
   * @returns {boolean}
   */
  tryToSetElements: function () {
    var elements = $(this.selector);
    if (elements.length > 0) {
      this.elements = elements;
    }
    return !!elements.length;
  },

  /**
   * Сбрасывает состояние компонента.
   */
  reset: function () {
    this.data = undefined;
    this.elements = undefined;
    this.initialized = false;
  },

  /**
   * Выполняет инициализацию.
   * Обычно определяется в опциях при создании компонента.
   * Вызывается движком.
   * @param {ComponentEngine} app - Вызывающий движок.
   */
  init: function (app) {
    console.warn("Function 'init' is not specified for the '" + this.name + "' component.");
  },

  /**
   * Выполняет действия, необходимые при удалении компонента.
   * Обычно определяется в опциях при создании компонента.
   * Вызывается движком.
   * @param {ComponentEngine} app - Вызывающий движок.
   */
  remove: function (app) {
    console.warn("Function 'remove' is not specified for the '" + this.name + "' component.");
  },

  /**
   * Добавляет обработчик для элементов с [data-action=name].
   * Обработчики применяются после инициализации компонента и
   * снимаются после удаления или отключения.
   * Вызывается по клику или change.
   * @param {string} name - Значение [data-action].
   * @param {function} callback
   */
  addAction: function (name, callback) {
    this.actions[name] = this.actions[name] || [];
    this.actions[name].push(callback);
  },

  /**
   * Удаляет обработчик для элементов с [data-action=name].
   * @param {string} name - Значение [data-action].
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
   * Выполняет обработчики действия у компонента и подкомпонентов.
   * @param {string} name
   * @param element
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