/* Alef.Fit — native bridge (Capacitor). When running inside the Android
   APK this schedules REAL system alarms via LocalNotifications, so Alarm
   Reminders fire with the app closed or the phone asleep. In the browser /
   PWA it is inert and the in-app ticker keeps working as before. */
'use strict';

window.Native = (function () {

  function plugin() {
    var C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
    return (C.Plugins && C.Plugins.LocalNotifications) || null;
  }
  function isNative() { return !!plugin(); }

  /* stable numeric id per alarm + weekday slot (0 = daily, 1..7 = Sun..Sat) */
  function numId(alarmId, slot) {
    var h = 0, s = String(alarmId);
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (Math.abs(h) % 100000000) * 10 + slot;
  }

  function requestPermission() {
    var p = plugin();
    if (!p) return Promise.resolve(false);
    return p.checkPermissions().then(function (r) {
      if (r.display === 'granted') return true;
      return p.requestPermissions().then(function (r2) { return r2.display === 'granted'; });
    }).catch(function () { return false; });
  }

  /* Re-schedule everything from the alarms store (idempotent: cancel ours,
     then schedule all enabled alarms as repeating system notifications). */
  function syncAlarms() {
    var p = plugin();
    if (!p) return Promise.resolve(false);
    return requestPermission().then(function (granted) {
      if (!granted) return false;
      return p.getPending().then(function (r) {
        var mine = (r && r.notifications || []).filter(function (n) { return n.extra && n.extra.alefAlarm; });
        if (!mine.length) return null;
        return p.cancel({ notifications: mine.map(function (n) { return { id: n.id }; }) });
      }).then(function () {
        return DB.all('alarms');
      }).then(function (rows) {
        var list = [];
        rows.filter(function (a) { return a.enabled; }).forEach(function (a) {
          var hm = (a.time || '18:00').split(':');
          var hour = parseInt(hm[0], 10) || 0, minute = parseInt(hm[1], 10) || 0;
          function entry(id, on) {
            return {
              id: id,
              title: '⏰ ' + (a.label || 'Alef.Fit alarm'),
              body: a.time,
              channelId: 'alef-alarms',
              extra: { alefAlarm: a.id },
              schedule: { on: on, allowWhileIdle: true }
            };
          }
          if (a.days && a.days.length) {
            a.days.forEach(function (d) {   // app 0=Sun..6=Sat → Capacitor weekday 1=Sun..7=Sat
              list.push(entry(numId(a.id, d + 1), { weekday: d + 1, hour: hour, minute: minute }));
            });
          } else {                          // every day
            list.push(entry(numId(a.id, 0), { hour: hour, minute: minute }));
          }
        });
        return list.length ? p.schedule({ notifications: list }) : null;
      }).then(function () { return true; });
    });
  }

  function init() {
    var p = plugin();
    if (!p) return;
    if (p.createChannel) {
      p.createChannel({
        id: 'alef-alarms', name: 'Alarm Reminders', description: 'Alef.Fit training alarms',
        importance: 5, visibility: 1, vibration: true
      }).catch(function () { /* channel may already exist */ });
    }
    syncAlarms();
  }

  return { isNative: isNative, syncAlarms: syncAlarms, init: init };
})();
