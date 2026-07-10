/* Alef.Fit — boot, router, nav, theme/text-size, in-app alert ticker. */
'use strict';

var APP_VERSION = '0.18.0';

var App = (function () {

  var TABS = [
    { id: 'exercise',   label: 'Exercise',   icon: 'dumbbell' },
    { id: 'discipline', label: 'Discipline', icon: 'clipboard' },
    { id: 'program',    label: 'Program',    icon: 'calendar' },
    { id: 'retro',      label: 'Retro',      icon: 'clock' },
    { id: 'setting',    label: 'Setting',    icon: 'gear' }
  ];

  function applySettings() {
    var s = DB.getSettings();
    var theme = s.theme;
    if (theme === 'system') {
      theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.fontSize = s.textScale ? (16 * s.textScale) + 'px' : '';
    document.documentElement.dataset.msize = s.mediaSize || 'm';
    var bt = s.bgTheme || 'carbon';
    if (bt === 'none') { delete document.documentElement.dataset.bgtheme; }
    else { document.documentElement.dataset.bgtheme = bt; }
    var ct = s.colorTheme || 'classic';
    if (ct === 'classic') { delete document.documentElement.dataset.ctheme; }
    else { document.documentElement.dataset.ctheme = ct; }
  }

  function buildNav() {
    TABS.forEach(function (t) {
      var a = document.querySelector('[data-tab="' + t.id + '"]');
      a.innerHTML = UI.icon(t.icon) + '<span>' + t.label + '</span>';
    });
  }

  function route() {
    var hash = location.hash || '#/exercise';
    var parts = hash.replace(/^#\//, '').split('/');
    var tab = parts[0] || 'exercise';
    if (!Screens[tab]) { tab = 'exercise'; parts = ['exercise']; }
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      a.classList.toggle('active', a.dataset.tab === tab);
    });
    var screen = document.getElementById('screen');
    screen.innerHTML = '';
    window.scrollTo(0, 0);
    /* replay the enter animation */
    screen.style.animation = 'none';
    void screen.offsetWidth;
    screen.style.animation = '';
    Screens[tab].render(screen, parts.slice(1));
    if (window.DevText) DevText.sync();
  }

  /* In-app alert ticker: fires To-do alerts and Alarm Reminders while the
     app is open. Background alarms arrive with the Capacitor wrap (M4). */
  var _fired = {};
  function tickAlerts() {
    var now = new Date();
    var hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var today = DB.todayISO();
    DB.all('alarms').then(function (alarms) {
      alarms.forEach(function (a) {
        if (!a.enabled || a.time !== hm) return;
        if (a.days && a.days.length && a.days.indexOf(now.getDay()) < 0) return;
        var key = 'al-' + a.id + '-' + today + '-' + hm;
        if (_fired[key]) return;
        _fired[key] = 1;
        notify('Alarm: ' + (a.label || a.time), a.time);
      });
    });
    DB.all('todos').then(function (todos) {
      todos.forEach(function (t) {
        if (t.done || !t.dueDate) return;
        var alertAt = alertTime(t);
        if (!alertAt) return;
        var diff = alertAt.getTime() - now.getTime();
        if (diff <= 0 && diff > -60000) {
          var key = 'td-' + t.id;
          if (_fired[key]) return;
          _fired[key] = 1;
          notify('To-do: ' + t.title, t.allDay ? UI.fmtDate(t.dueDate) : UI.fmtDateTime(t.dueDate, t.time));
        }
      });
    });
  }

  function alertTime(t) {
    var s = DB.getSettings();
    if (t.allDay) {
      var offs = { none: null, P0D: 0, P1D: 1, P2D: 2, P7D: 7 };
      var key = t.alertAllDay != null ? t.alertAllDay : s.defaultAlertAllDay;
      if (key == null || key === 'none' || offs[key] == null) return null;
      var d = new Date(t.dueDate + 'T' + (s.allDayAlertTime || '09:00'));
      d.setDate(d.getDate() - offs[key]);
      return d;
    }
    if (!t.time) return null;
    var mins = t.alertOffsetMin != null ? t.alertOffsetMin : s.defaultAlertTimed;
    if (mins == null) return null;
    var dt = new Date(t.dueDate + 'T' + t.time);
    return new Date(dt.getTime() - mins * 60000);
  }

  function notify(title, body) {
    UI.toast(title);
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body: body || '', icon: 'assets/icons/icon-192.png' }); } catch (e) { /* ignore */ }
    }
  }

  function boot() {
    buildNav();
    DB.open()
      .then(DB.loadSettings)
      .then(function () { applySettings(); return DB.migrateMediaStore(); })
      .then(function () { return DB.migrateTodosOnce(); })
      .then(function () { return window.DevText ? DevText.init() : null; })
      .then(function () { return DB.seedIfEmpty(); })
      .then(function (seeded) {
        return DB.seedProgramsIfEmpty().then(function () { return seeded; });
      })
      .then(function (seeded) {
        /* landing page: where the app opens when launched without a hash */
        if (!location.hash) {
          var LANDING = { todo: '#/discipline/todo', exercise: '#/exercise', discipline: '#/discipline', program: '#/program', retro: '#/retro', setting: '#/setting' };
          var lp = LANDING[(DB.getSettings() || {}).landingPage || 'todo'] || '#/discipline/todo';
          try { history.replaceState(null, '', location.pathname + location.search + lp); }
          catch (e2) { location.hash = lp; }
        }
        route();
        if (seeded) UI.toast('Starter library loaded: ' + (window.SEED_EXERCISES || []).length + ' exercises');
        if (window.Native) Native.init();   // APK: schedule real background alarms
        setInterval(tickAlerts, 20000);
        setTimeout(function () { DB.gcMedia(); }, 4000);
        if (window.matchMedia) {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
        }
      })
      .catch(function (err) {
        document.getElementById('screen').appendChild(
          UI.emptyState('Could not start the app', String(err && err.message || err)));
      });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline shell optional */ });
    }
  }

  window.addEventListener('hashchange', route);
  document.addEventListener('DOMContentLoaded', boot);

  return { applySettings: applySettings, route: route, alertTime: alertTime, APP_VERSION: APP_VERSION };
})();
