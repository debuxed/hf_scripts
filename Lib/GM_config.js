/*
Copyright 2009-2013, GM_config Contributors
All rights reserved.
GM_config Contributors:
    Mike Medley <medleymind@gmail.com>
    Joe Simmons
    Izzy Soft
    Marti Martz
GM_config is distributed under the terms of the GNU Lesser General Public License.
    GM_config is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.
    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// The GM_config constructor
function GM_configStruct() {
  // call init() if settings were passed to constructor
  if (arguments.length)
    GM_configInit(this, arguments);
}

// This is the initializer function
function GM_configInit(config, args) {
  // Initialize instance variables
  if (typeof config.fields == "undefined") {
    config.fields = {};
    config.onInit = config.onInit || null;
    config.onOpen = config.onOpen || function() {};
    config.onSave = config.onSave || function() {};
    config.onClose = config.onClose || function() {};
    config.onReset = config.onReset || function() {};
    config.isOpen = false;
    config.title = 'User Script Settings';
    config.css = {
      basic: "#GM_config * { font-family: arial,tahoma,myriad pro,sans-serif; }"
             + '\n' + "#GM_config { background: #FFF; }"
             + '\n' + "#GM_config input[type='radio'] { margin-right: 8px; }"
             + '\n' + "#GM_config .indent40 { margin-left: 40%; }"
             + '\n' + "#GM_config .field_label { font-size: 12px; font-weight: bold; margin-right: 6px; }"
             + '\n' + "#GM_config .block { display: block; }"
             + '\n' + "#GM_config .saveclose_buttons { margin: 16px 10px 10px; padding: 2px 12px; }"
             + '\n' + "#GM_config .reset, #GM_config .reset a,"
                    + " #GM_config_buttons_holder { color: #000; text-align: right; }"
             + '\n' + "#GM_config .config_header { font-size: 20pt; margin: 0; }"
             + '\n' + "#GM_config .config_desc, #GM_config .section_desc, #GM_config .reset { font-size: 9pt; }"
             + '\n' + "#GM_config .center { text-align: center; }"
             + '\n' + "#GM_config .section_header_holder { margin-top: 8px; }"
             + '\n' + "#GM_config .config_var { margin: 0 0 4px; }"
             + '\n' + "#GM_config .section_header { background: #414141; border: 1px solid #000; color: #FFF;"
                    + " font-size: 13pt; margin: 0; }"
             + '\n' + "#GM_config .section_desc { background: #EFEFEF; border: 1px solid #CCC; color: #575757;"
                    + " font-size: 9pt; margin: 0 0 6px; }"
             + '\n',
      stylish: ""
    };
  }

  // Save the previous initialize callback
  var oldInitCb = config.onInit;

  if (args.length == 1 &&
    typeof args[0].id == "string" &&
    typeof args[0].appendChild != "function") var settings = args[0];
  else {
    // Provide backwards-compatibility with argument style intialization
    var settings = {};

    // loop through GM_config.init() arguments
    for (var i = 0, l = args.length, arg; i < l; ++i) {
      arg = args[i];

      // An element to use as the config window
      if (typeof arg.appendChild == "function") {
        settings.frame = arg;
        continue;
      }

      switch (typeof arg) {
        case 'object':
          for (var j in arg) { // could be a callback functions or settings object
            if (typeof arg[j] != "function") { // we are in the settings object
              settings.fields = arg; // store settings object
              break; // leave the loop
            } // otherwise it must be a callback function
            if (!settings.events) settings.events = {};
            settings.events[j] = arg[j];
          }
          break;
        case 'function': // passing a bare function is set to open callback
          settings.events = {onOpen: arg};
          break;
        case 'string': // could be custom CSS or the title string
          if (/\w+\s*\{\s*\w+\s*:\s*\w+[\s|\S]*\}/.test(arg))
            settings.css = arg;
          else
            settings.title = arg;
          break;
      }
    }
  }

  /* Initialize everything using the new settings object */
  // Set the id
  if (settings.id) config.id = settings.id;
  else if (typeof config.id == "undefined") config.id = 'GM_config';

  // Set the title
  if (settings.title) config.title = settings.title;

  // Set the custom css
  if (settings.css) config.css.stylish = settings.css;

  // Set the frame
  if (settings.frame) config.frame = settings.frame;

  // Set the event callbacks
  if (settings.events) {
    var events = settings.events;
    for (e in events) 
      config["on" + e.charAt(0).toUpperCase() + e.slice(1)] = events[e];
  }

  // Create the fields
  if (settings.fields) {
    var stored = config.read(), // read the stored settings
        fields = settings.fields,
        customTypes = settings.types || {};

    for (var id in fields) {
      var field = fields[id];

      // for each field definition create a field object
      if (field)
        config.fields[id] = new GM_configField(field, stored[id], id,
          customTypes[field.type]);
      else if (config.fields[id]) delete config.fields[id];
    }
  }

  // If the id has changed we must modify the default style
  if (config.id != 'GM_config')
    config.css.basic = config.css.basic.replace(/#GM_config/gm, '#' + config.id);

  // Call the previous init() callback function if set
  (oldInitCb || config.onInit || (function() {}))();
}

GM_configStruct.prototype = {
  // Support old method of initalizing
  init: function() { GM_configInit(this, arguments); },

  // call GM_config.open() from your script to open the menu
  open: function () {
    // Die if the menu is already open on this page
    // You can have multiple instances but they can't be open at the same time
    var match = document.getElementById(this.id);
    if (match && (match.tagName == "IFRAME" || match.childNodes.length > 0)) return;

    // Sometimes "this" gets overwritten so create an alias
    var config = this;

    // Function to build the mighty config window :)
    function buildConfigWin (body, head) {
      var create = config.create,
          fields = config.fields,
          configId = config.id,
          bodyWrapper = create('div', {id: configId + '_wrapper'});

      // Append the style which is our default style plus the user style
      head.appendChild(
        create('style', {
        type: 'text/css',
        textContent: config.css.basic + config.css.stylish
      }));

      // Add header and title
      bodyWrapper.appendChild(create('div', {
        id: configId + '_header',
        className: 'config_header block center',
        innerHTML: config.title
      }));

      // Append elements
      var section = bodyWrapper,
          secNum = 0; // Section count

      // loop through fields
      for (var id in fields) {
        var field = fields[id].settings;

        if (field.section) { // the start of a new section
          section = bodyWrapper.appendChild(create('div', {
              className: 'section_header_holder',
              id: configId + '_section_' + secNum
            }));

          if (typeof field.section == "string") field.section = [field.section];

          if (typeof field.section[0] == "string")
            section.appendChild(create('div', {
              className: 'section_header center',
              id: configId + '_section_header_' + secNum,
              innerHTML: field.section[0]
            }));

          if (typeof field.section[1] == "string")
            section.appendChild(create('p', {
              className: 'section_desc center',
              id: configId + '_section_desc_' + secNum,
              innerHTML: field.section[1]
            }));
          ++secNum;
        }

        // Create field elements and append to current section
        section.appendChild(fields[id].toNode(configId));
      }

      // Add save and close buttons
      bodyWrapper.appendChild(create('div',
        {id: configId + '_buttons_holder'},

        create('button', {
          id: configId + '_saveBtn',
          textContent: 'Save',
          title: 'Save settings',
          className: 'saveclose_buttons',
          onclick: function () { config.save();config.close(); }
        }),

        create('button', {
          id: configId + '_closeBtn',
          textContent: 'Close',
          title: 'Close window',
          className: 'saveclose_buttons',
          onclick: function () {config.close();}
        }),

        create('div',
          {className: 'reset_holder block'},

          // Reset link
          create('a', {
            id: configId + '_resetLink',
            textContent: 'Reset all Settings',
            href: '#',
            title: 'Restore settings to default',
            className: 'reset',
            onclick: function(e) {e.preventDefault();config.reset();}
          })
      )));

      body.appendChild(bodyWrapper); // Paint everything to window at once
      config.center(); // Show and center iframe
      window.addEventListener('resize', config.center, false); // Center frame on resize

      // Call the open() callback function
      config.onOpen(config.frame.contentDocument || config.frame.ownerDocument,
                    config.frame.contentWindow || window,
                    config.frame);

      // Close frame on window close
      window.addEventListener('beforeunload', function () {
          config.close();
      }, false);

      // Now that everything is loaded, make it visible
      config.frame.style.display = "block";
      config.isOpen = true;
    }

    // Either use the element passed to init() or create an iframe
    var defaultStyle = 'bottom: auto; border: 1px solid #000; display: none; height: 75%;'
                       + ' left: 0; margin: 0; max-height: 95%; max-width: 95%; opacity: 0;'
                       + ' overflow: auto; padding: 0; position: fixed; right: auto; top: 0;'
                       + ' width: 75%; z-index: 999;';


    if (this.frame) {
      this.frame.id = this.id;
      this.frame.setAttribute('style', defaultStyle);
      buildConfigWin(this.frame, this.frame.ownerDocument.getElementsByTagName('head')[0]);
    } else {
      // Create frame
      document.body.appendChild((this.frame = this.create('iframe', {
        id: this.id,
        style: defaultStyle
      })));

      this.frame.src = 'about:blank'; // In WebKit src can't be set until it is added to the page
      // we wait for the iframe to load before we can modify it
      this.frame.addEventListener('load', function(e) {
          var frame = config.frame;
          var body = frame.contentDocument.getElementsByTagName('body')[0];
          body.id = config.id; // Allows for prefixing styles with "#GM_config"
          buildConfigWin(body, frame.contentDocument.getElementsByTagName('head')[0]);
      }, false);
    }
  },

  save: function () {
    var fields = this.fields;
    for (var id in fields)
      if (fields[id].toValue() === null) // invalid value encountered
        return;

    var forgotten = this.write();
    this.onSave(forgotten); // Call the save() callback function
  },

  close: function() {
    // If frame is an iframe then remove it
    if (this.frame.contentDocument) {
      this.remove(this.frame);
      this.frame = null;
    } else { // else wipe its content
      this.frame.innerHTML = "";
      this.frame.style.display = "none";
    }

    // Null out all the fields so we don't leak memory
    var fields = this.fields;
    for (var id in fields)
      fields[id].node = null;

    this.onClose(); //  Call the close() callback function
    this.isOpen = false;
  },

  set: function (name, val) {
    this.fields[name].value = val;
  },

  get: function (name) {
    return this.fields[name].value;
  },

  write: function (store, obj) {
    if (!obj) {
      var values = {},
          forgotten = {},
          fields = this.fields;

      for (var id in fields) {
        var field = fields[id];
        if (field.save) {
          if (field.settings.type != "button")
            values[id] = field.value;
        } else
          forgotten[id] = field.value;
      }
    }
    try {
      this.setValue(store || this.id, this.stringify(obj || values));
    } catch(e) {
      this.log("GM_config failed to save settings!");
    }

    return forgotten;
  },

  read: function (store) {
    try {
      var rval = this.parser(this.getValue(store || this.id, '{}'));
    } catch(e) {
      this.log("GM_config failed to read saved settings!");
      var rval = {};
    }
    return rval;
  },

  reset: function () {
    var fields = this.fields;

    // Reset all the fields
    for (var id in fields) fields[id].reset();

    this.onReset(); // Call the reset() callback function
  },

  create: function () {
    switch(arguments.length) {
      case 1:
        var A = document.createTextNode(arguments[0]);
        break;
      default:
        var A = document.createElement(arguments[0]),
            B = arguments[1];
        for (var b in B) {
          if (b.indexOf("on") == 0)
            A.addEventListener(b.substring(2), B[b], false);
          else if (",style,accesskey,id,name,src,href,which,for".indexOf("," +
                   b.toLowerCase()) != -1)
            A.setAttribute(b, B[b]);
          else
            A[b] = B[b];
        }
        for (var i = 2, len = arguments.length; i < len; ++i)
          A.appendChild(arguments[i]);
    }
    return A;
  },

  center: function () {
    var node = this.frame;
    if (!node) return;
    var style = node.style,
        beforeOpacity = style.opacity;
    if (style.display == 'none') style.opacity = '0';
    style.display = '';
    style.top = Math.floor((window.innerHeight / 2) - (node.offsetHeight / 2)) + 'px';
    style.left = Math.floor((window.innerWidth / 2) - (node.offsetWidth / 2)) + 'px';
    style.opacity = '1';
  },

  remove: function (el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
};

// Define a bunch of API stuff
(function() {
  var isGM = typeof GM_getValue != 'undefined' &&
             typeof GM_getValue('a', 'b') != 'undefined',
      setValue, getValue, stringify, parser;

  // Define value storing and reading API
  if (!isGM) {
    setValue = function (name, value) {
      return localStorage.setItem(name, value);
    };
    getValue = function(name, def){
      var s = localStorage.getItem(name);
      return s == null ? def : s
    };

    // We only support JSON parser outside GM
    stringify = JSON.stringify;
    parser = JSON.parse;
  } else {
    setValue = GM_setValue;
    getValue = GM_getValue;
    stringify = typeof JSON == "undefined" ?
      function(obj) {
        return obj.toSource();
    } : JSON.stringify;
    parser = typeof JSON == "undefined" ?
      function(jsonData) {
        return (new Function('return ' + jsonData + ';'))();
    } : JSON.parse;
  }

  GM_configStruct.prototype.isGM = isGM;
  GM_configStruct.prototype.setValue = setValue;
  GM_configStruct.prototype.getValue = getValue;
  GM_configStruct.prototype.stringify = stringify;
  GM_configStruct.prototype.parser = parser;
  GM_configStruct.prototype.log = isGM ? GM_log : (window.opera ? opera.postError : console.log);
})();

function GM_configDefaultValue(type, options) {
  var value;

  if (type.indexOf('unsigned ') == 0)
    type = type.substring(9);

  switch (type) {
    case 'radio': case 'select':
      value = options[0];
      break;
    case 'checkbox':
      value = false;
      break;
    case 'int': case 'integer':
    case 'float': case 'number':
      value = 0;
      break;
    default:
      value = '';
  }

  return value;
}

function GM_configField(settings, stored, id, customType) {
  // Store the field's settings
  this.settings = settings;
  this.id = id;
  this.node = null;
  this.save = typeof settings.save == "undefined" ? true : settings.save;

  // if a setting was passed to init but wasn't stored then
  //   if a default value wasn't passed through init() then
  //     if the type is custom use its default
  //       else use default value for type
  //   else use the default value passed through init()
  // else use the stored value
  var value = typeof stored == "undefined" ?
                typeof settings['default'] == "undefined" ?
                  customType ? 
                    customType['default']
                    : GM_configDefaultValue(settings.type, settings.options)
                : settings['default']
              : stored;

  // Store the field's value
  this.value = value;

  // Setup methods for a custom type
  if (customType) {
    this.toNode = customType.toNode;
    this.toValue = customType.toValue;
    this.reset = customType.reset;
  }
}

GM_configField.prototype = {
  create: GM_configStruct.prototype.create,

  toNode: function(configId) {
    var field = this.settings,
        value = this.value,
        options = field.options,
        id = this.id,
        create = this.create;

    var retNode = create('div', { className: 'config_var',
          id: configId + '_' + this.id + '_var',
          title: field.title || '' }),
        firstProp;

    // Retrieve the first prop
    for (var i in field) { firstProp = i; break; }

    var label = typeof field.label == "string" && field.type != "button" ? 
      create('label', {
        innerHTML: field.label,
        id: configId + '_' + this.id + '_field_label',
        for: configId + '_field_' + this.id,
        className: 'field_label'
      }) : null;

    switch (field.type) {
      case 'textarea':
        retNode.appendChild((this.node = create('textarea', {
          id: configId + '_field_' + this.id,
          innerHTML: value,
          cols: (field.cols ? field.cols : 20),
          rows: (field.rows ? field.rows : 2)
        })));
        break;
      case 'radio':
        var wrap = create('div', {
          id: configId + '_field_' + id
        });
        this.node = wrap;

        for (var i = 0, len = options.length; i < len; ++i) {
          var labelI = create('label', {});

          var radLabel = labelI.appendChild(create('span', {
            innerHTML: options[i]
          }));

          var rad = labelI.appendChild(create('input', {
            value: options[i],
            type: 'radio',
            name: id,
            checked: options[i] == value ? true : false
          }));

          if (firstProp == "options")
            labelI.insertBefore(radLabel, rad);
          else
            labelI.appendChild(radLabel);

          wrap.appendChild(labelI);
        }

        retNode.appendChild(wrap);
        break;
      case 'select':
        var wrap = create('select', {
          id: configId + '_field_' + id
        });
        this.node = wrap;

        for (var i in options)
          wrap.appendChild(create('option', {
            innerHTML: options[i],
            value: i,
            selected: i == value
          }));

        retNode.appendChild(wrap);
        break;
      case 'checkbox':
        retNode.appendChild((this.node = create('input', {
          id: configId + '_field_' + id,
          type: 'checkbox',
          value: value,
          checked: value
        })));
        break;
      case 'button':
        var btn = create('input', {
          id: configId + '_field_' + id,
          type: 'button',
          value: field.label,
          size: (field.size ? field.size : 25),
          title: field.title || ''
        });
        this.node = btn;

        if (field.script || field.click) {
          btn.addEventListener('click', function () {
            field[field.script ? 'script' : 'click']();
          }, false);
        }

        retNode.appendChild(btn);
        break;
      case 'hidden':
        retNode.appendChild((this.node = create('input', {
          id: configId + '_field_' + id,
          type: 'hidden',
          value: value
        })));
        break;
      default:
        // type = text, int, or float
        retNode.appendChild((this.node = create('input', {
          id: configId + '_field_' + id,
          type: 'text',
          value: value,
          size: (field.size ? field.size : 25)
        })));
    }

    // If the label is passed first, insert it before the field
    // else insert it after
    if (label) {
      if (firstProp == "label" || field.type == "radio")
        retNode.insertBefore(label, retNode.firstChild);
      else
        retNode.appendChild(label);
    }

    return retNode;
  },

  toValue: function() {
    var node = this.node,
        field = this.settings,
        type = field.type,
        unsigned = false,
        rval;

    if (!node) return null;

    if (type.indexOf('unsigned ') == 0) {
      type = type.substring(9);
      unsigned = true;
    }

    switch (type) {
      case 'checkbox':
        this.value = node.checked;
        break;
      case 'select':
        this.value = node[node.selectedIndex].value;
        break;
      case 'radio':
        var radios = node.getElementsByTagName('input');
        for (var i = 0, len = radios.length; i < len; ++i)
          if (radios[i].checked)
            this.value = radios[i].value;
        break;
      case 'button':
        break;
      case 'int': case 'integer':
        var num = Number(node.value);
        var warn = 'Field labeled "' + field.label + '" expects a' +
          (unsigned ? ' positive ' : 'n ') + 'integer value';
        if (isNaN(num) || Math.ceil(num) != Math.floor(num) ||
            (unsigned && num < 0)) {
          alert(warn + '.');
          return null;
        }
        if (!this._checkNumberRange(num, warn))
          return null;
        this.value = num;
        break;
      case 'float': case 'number':
        var num = Number(node.value);
        var warn = 'Field labeled "' + field.label + '" expects a ' +
          (unsigned ? 'positive ' : '') + 'number value';
        if (isNaN(num) || (unsigned && num < 0)) {
          alert(warn + '.');
          return null;
        }
        if (!this._checkNumberRange(num, warn))
          return null;
        this.value = num;
        break;
      default:
        this.value = node.value;
        break;
    }

    return this.value; // value read successfully
  },

  reset: function() {
    var node = this.node,
        field = this.settings,
        noDefault = typeof field['default'] == "undefined",
        type = field.type;

    if (!node) return;

    switch (type) {
      case 'checkbox':
        node.checked = noDefault ? GM_configDefaultValue(type) : field['default'];
        break;
      case 'select':
        if (field['default']) {
          for (var i = 0, len = node.options.length; i < len; ++i)
            if (node.options[i].textContent == field['default'])
              node.selectedIndex = i;
        } else
          node.selectedIndex = 0;
        break;
      case 'radio':
        var radios = node.getElementsByTagName('input');
        for (var i = 0, len = radios.length; i < len; ++i)
          if (radios[i].value == field['default'])
            radios[i].checked = true;
        break;
      case 'button' :
        break;
      default:
        node.value = noDefault ? GM_configDefaultValue(type) : field['default'];
        break;
      }
  },

  _checkNumberRange: function(num, warn) {
    var field = this.settings;
    if (typeof field.min == "number" && num < field.min) {
      alert(warn + ' greater than or equal to ' + field.min + '.');
      return null;
    }

    if (typeof field.max == "number" && num > field.max) {
      alert(warn + ' less than or equal to ' + field.max + '.');
      return null;
    }
    return true;
  }
};

// Create default instance of GM_config
var GM_config = new GM_configStruct();