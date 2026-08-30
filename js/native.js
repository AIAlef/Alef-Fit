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

  /* open a URL in the system browser (Custom Tab) — Google blocks OAuth
     inside WebViews, so the APK signs in through the real browser */
  function openExternal(url) {
    var C = window.Capacitor;
    var b = C && C.Plugins && C.Plugins.Browser;
    if (b && b.open) {
      return b.open({ url: url }).then(function () { return true; }).catch(function () { return false; });
    }
    try { window.open(url, '_system'); return Promise.resolve(true); }
    catch (e) { return Promise.resolve(false); }
  }

  /* ---- file saving (v0.32) ----
     The Android WebView silently ignores <a download>, so exports never
     reached the Downloads folder in the APK. With the Filesystem plugin
     the APK writes REAL files into Documents/S26-Alef-Fit instead. */
  var SAVE_DIR = 'S26-Alef-Fit';
  function fsPlugin() {
    var C = window.Capacitor;
    if (!C || !C.isNativePlatform || !C.isNativePlatform()) return null;
    return (C.Plugins && C.Plugins.Filesystem) || null;
  }
  function canSaveFiles() { return !!fsPlugin(); }
  var _lastSaveError = '';
  function lastSaveError() { return _lastSaveError; }
  /* text files (JSON backups); resolves the human-readable path or null.
     v0.53 BUGFIX: a Full backup is one giant JSON string (all media as
     base64) — pushing it through the Capacitor bridge in ONE writeFile
     call fails on Android ("cannot save full backup, Vault works").
     Now: big payloads stream in ~3 MB chunks via appendFile. */
  var CHUNK = 3 * 1024 * 1024;
  /* v0.57 C2: never end a chunk on the HIGH half of a surrogate pair —
     the bridge's utf8 conversion would turn a split emoji into �� */
  function chunkEnd(text, want) {
    if (want < text.length) {
      var c = text.charCodeAt(want - 1);
      if (c >= 0xD800 && c <= 0xDBFF) return want - 1;
    }
    return want;
  }
  function saveText(filename, text, onProgress) {
    var p = fsPlugin();
    if (!p) return Promise.resolve(null);
    _lastSaveError = '';
    var path = SAVE_DIR + '/' + filename;
    var human = 'Documents/' + SAVE_DIR + '/' + filename;
    var total = text.length;
    /* v0.57 C2: ATOMIC — stream into a .part file and swap it in only
       after every chunk landed, so a failed save can never destroy the
       previous good backup of the same name. (Very old plugin builds
       without rename() fall back to the direct write.) */
    var atomic = !!p.rename;
    var target = atomic ? path + '.part' : path;
    function report(done) { if (onProgress) { try { onProgress(done, total); } catch (e) { /* ok */ } } }
    var firstEnd = chunkEnd(text, Math.min(CHUNK, total));
    var off = firstEnd;
    var chain = p.writeFile({
      path: target, data: text.slice(0, firstEnd),
      directory: 'DOCUMENTS', encoding: 'utf8', recursive: true
    }).then(function () { report(firstEnd); });
    function step() {
      if (off >= total) return null;
      var end = chunkEnd(text, Math.min(off + CHUNK, total));
      var piece = text.slice(off, end);
      off = end;
      return p.appendFile({
        path: target, data: piece,
        directory: 'DOCUMENTS', encoding: 'utf8'
      }).then(function () { report(off); }).then(step);
    }
    return chain.then(step).then(function () {
      if (!atomic) return null;
      /* replace the real file only now that the payload is complete */
      return p.deleteFile({ path: path, directory: 'DOCUMENTS' })
        .catch(function () { /* first save of this name */ })
        .then(function () {
          return p.rename({ from: target, to: path, directory: 'DOCUMENTS', toDirectory: 'DOCUMENTS' });
        });
    }).then(function () { return human; })
      .catch(function (err) {
        _lastSaveError = String((err && err.message) || err || 'unknown error');
        return null;
      });
  }
  /* binary files from a base64 payload (photos/videos) */
  function saveBase64(filename, b64) {
    var p = fsPlugin();
    if (!p) return Promise.resolve(null);
    return p.writeFile({
      path: SAVE_DIR + '/' + filename, data: b64,
      directory: 'DOCUMENTS', recursive: true
    }).then(function () { return 'Documents/' + SAVE_DIR + '/' + filename; })
      .catch(function () { return null; });
  }

  return { isNative: isNative, syncAlarms: syncAlarms, init: init, openExternal: openExternal,
           canSaveFiles: canSaveFiles, saveText: saveText, saveBase64: saveBase64,
           lastSaveError: lastSaveError };
})();
