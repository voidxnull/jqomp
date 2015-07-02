# jqomp
A micro-framework to organize JavaScript code with jQuery as components (modules).

## Example
```javascript
// Create an application
var App = new Application();

// Create a component
App.component('ExampleComponent', {
  selector: '.component-class',

  init: function (app) {
    // Initialize state here
  }
});

// Initialize the application
App.init();
```
