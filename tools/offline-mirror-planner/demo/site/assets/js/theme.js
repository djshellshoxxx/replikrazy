/* Lantern Field Notes - theme toggle (synthetic demo script).
 * Remembers the reader's light/dark choice in localStorage. */
(function () {
  'use strict';

  var STORAGE_KEY = 'lantern-theme';

  function readPref() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function writePref(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* storage unavailable: keep the choice for this page only */
    }
  }

  function apply(theme) {
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }

  apply(readPref());

  document.addEventListener('DOMContentLoaded', function () {
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        var next = current === 'dark' ? 'light' : 'dark';
        apply(next);
        writePref(next);
      });
    });
  });
}());
