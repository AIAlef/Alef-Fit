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
       without rename() fall back to the direct write.)
       v0.61 (#85, the v0.60 Full-backup failure): every phase now TAGS
       its own error so the status line names the failing step, and a
       failed finalize (delete/rename of an existing same-name file —
       some Android storage builds refuse it) RESCUES the run by writing
       the completed payload straight to the real name. */
    var atomic = !!p.rename;
    var target = atomic ? path + '.part' : path;
    var phase = 'start';
    function report(done) { if (onProgress) { try { onProgress(done, total); } catch (e) { /* ok */ } } }
    function writeTo(dst) {
      var firstEnd = chunkEnd(text, Math.min(CHUNK, total));
      var off = firstEnd;
      function step() {
        if (off >= total) return null;
        var end = chunkEnd(text, Math.min(off + CHUNK, total));
        var piece = text.slice(off, end);
        off = end;
        phase = 'write ' + Math.round(off / total * 100) + '%';
        return p.appendFile({
          path: dst, data: piece,
          directory: 'DOCUMENTS', encoding: 'utf8'
        }).then(function () { report(off); }).then(step);
      }
      phase = 'write start';
      return p.writeFile({
        path: dst, data: text.slice(0, firstEnd),
        directory: 'DOCUMENTS', encoding: 'utf8', recursive: true
      }).then(function () { report(firstEnd); }).then(step);
    }
    return writeTo(target).then(function () {
      if (!atomic) return null;
      /* replace the real file only now that the payload is complete */
      phase = 'replace old file';
      return p.deleteFile({ path: path, directory: 'DOCUMENTS' })
        .catch(function () { /* first save of this name */ })
        .then(function () {
          phase = 'swap in new file';
          return p.rename({ from: target, to: path, directory: 'DOCUMENTS', toDirectory: 'DOCUMENTS' });
        })
        .catch(function () {
          /* the .part payload is COMPLETE — only the swap failed. Land
             the data under the real name directly, then tidy the .part. */
          return writeTo(path).then(function () {
            return p.deleteFile({ path: target, directory: 'DOCUMENTS' }).catch(function () { /* ok */ });
          }).catch(function (e2) {
            phase = 'rescue ' + phase;
            throw e2;
          });
        });
    }).then(function () { return human; })
      .catch(function (err) {
        _lastSaveError = '[' + phase + '] ' + String((err && err.message) || err || 'unknown error');
        return null;
      });
  }
  /* binary files from a base64 payload (photos/videos, .AFdd zips).
     v0.62 (#88): ATOMIC like saveText — write .part, swap it in, and a
     refused swap rescues by writing the payload straight to the real
     name. The Vault's rolling mirror (AFvault-current.AFdd — the
     reinstall lifeline) rides this path, so a failed write can never
     leave it half-written: either the swap happens or the old good
     file stays. Phases tag _lastSaveError here too. */
  function saveBase64(filename, b64) {
    var p = fsPlugin();
    if (!p) return Promise.resolve(null);
    _lastSaveError = '';
    var path = SAVE_DIR + '/' + filename;
    var human = 'Documents/' + SAVE_DIR + '/' + filename;
    var atomic = !!p.rename;
    var target = atomic ? path + '.part' : path;
    var phase = 'start';
    function writeTo(dst) {
      phase = 'write';
      return p.writeFile({ path: dst, data: b64, directory: 'DOCUMENTS', recursive: true });
    }
    return writeTo(target).then(function () {
      if (!atomic) return null;
      phase = 'replace old file';
      return p.deleteFile({ path: path, directory: 'DOCUMENTS' })
        .catch(function () { /* first save of this name */ })
        .then(function () {
          phase = 'swap in new file';
          return p.rename({ from: target, to: path, directory: 'DOCUMENTS', toDirectory: 'DOCUMENTS' });
        })
        .catch(function () {
          /* the .part payload is complete — land it directly, tidy the .part */
          return writeTo(path).then(function () {
            return p.deleteFile({ path: target, directory: 'DOCUMENTS' }).catch(function () { /* ok */ });
          }).catch(function (e2) {
            phase = 'rescue ' + phase;
            throw e2;
          });
        });
    }).then(function () { return human; })
      .catch(function (err) {
        _lastSaveError = '[' + phase + '] ' + String((err && err.message) || err || 'unknown error');
        return null;
      });
  }

  /* ---- v0.61 (#84): collection media as REAL phone files ----
     Bytes live in Documents/S26-Alef-Fit/AFmedia/<motiv|aesth>/<fileId><ext>
     — public storage, so they SURVIVE an app uninstall/reinstall: a fresh
     install rescans the folder and finds the whole collection without
     re-downloading. Writes cross the bridge as base64 chunks CUT AT
     3-BYTE MULTIPLES (each chunk's base64 is padding-free, so appended
     chunks decode into one continuous file). Reads never cross the
     bridge: the WebView streams straight from the local file URL
     (convertFileSrc), so big videos play without loading into RAM. */
  var MEDIA_DIR = SAVE_DIR + '/AFmedia';
  var MCHUNK = 3 * 1024 * 1024; /* divisible by 3 — keeps base64 unpadded */
  function canMediaFiles() { return !!fsPlugin(); }
  function b64Of(u8, start, end) {
    var s = '';
    for (var i = start; i < end; i += 32768) {
      s += String.fromCharCode.apply(null, u8.subarray(i, Math.min(i + 32768, end)));
    }
    return btoa(s);
  }
  function mediaPut(sub, name, buf) {
    var p = fsPlugin();
    if (!p) return Promise.resolve(false);
    var u8 = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf);
    var path = MEDIA_DIR + '/' + sub + '/' + name;
    var off = Math.min(MCHUNK, u8.length);
    var chain = p.writeFile({ path: path, data: b64Of(u8, 0, off), directory: 'DOCUMENTS', recursive: true });
    function step() {
      if (off >= u8.length) return null;
      var end = Math.min(off + MCHUNK, u8.length);
      var piece = b64Of(u8, off, end);
      off = end;
      return p.appendFile({ path: path, data: piece, directory: 'DOCUMENTS' }).then(step);
    }
    return chain.then(step).then(function () {
      /* trust the file only at the EXACT byte count */
      if (!p.stat) return true;
      return p.stat({ path: path, directory: 'DOCUMENTS' }).then(function (st) {
        if (parseInt(st && st.size, 10) === u8.length) return true;
        return p.deleteFile({ path: path, directory: 'DOCUMENTS' })
          .catch(function () { /* ok */ }).then(function () { return false; });
      });
    }).catch(function () { return false; });
  }
  function mediaList(sub) {
    var p = fsPlugin();
    if (!p || !p.readdir) return Promise.resolve(null);
    return p.readdir({ path: MEDIA_DIR + '/' + sub, directory: 'DOCUMENTS' }).then(function (r) {
      var out = [];
      ((r && r.files) || []).forEach(function (f) {
        if (typeof f === 'string') { out.push({ name: f, size: 0, mtime: 0 }); return; }
        if (f.type === 'directory') return;
        out.push({ name: f.name, size: parseInt(f.size, 10) || 0, mtime: f.mtime || 0 });
      });
      return out;
    }).catch(function () { return []; }); /* no folder yet = nothing stored */
  }
  function mediaUrl(sub, name) {
    var p = fsPlugin();
    if (!p || !p.getUri) return Promise.resolve(null);
    return p.getUri({ path: MEDIA_DIR + '/' + sub + '/' + name, directory: 'DOCUMENTS' }).then(function (r) {
      var C = window.Capacitor;
      var u = r && r.uri;
      if (!u) return null;
      return (C && C.convertFileSrc) ? C.convertFileSrc(u) : u;
    }).catch(function () { return null; });
  }
  function mediaRead(sub, name) {
    return mediaUrl(sub, name).then(function (u) {
      if (!u || !window.fetch) return null;
      return fetch(u).then(function (r) {
        if (!r.ok) return null;
        return r.arrayBuffer();
      });
    }).catch(function () { return null; });
  }
  function mediaDel(sub, name) {
    var p = fsPlugin();
    if (!p) return Promise.resolve(false);
    return p.deleteFile({ path: MEDIA_DIR + '/' + sub + '/' + name, directory: 'DOCUMENTS' })
      .then(function () { return true; }).catch(function () { return false; });
  }
  function mediaRename(sub, from, to) {
    var p = fsPlugin();
    if (!p || !p.rename) return Promise.resolve(false);
    var base = MEDIA_DIR + '/' + sub + '/';
    return p.rename({ from: base + from, to: base + to, directory: 'DOCUMENTS', toDirectory: 'DOCUMENTS' })
      .then(function () { return true; }).catch(function () { return false; });
  }

  /* v0.61 (#86): the restore pages list the backup files THEMSELVES,
     newest first, instead of sending Alef into the system picker blind. */
  function listBackups() {
    var p = fsPlugin();
    if (!p || !p.readdir) return Promise.resolve(null);
    return p.readdir({ path: SAVE_DIR, directory: 'DOCUMENTS' }).then(function (r) {
      var out = [];
      ((r && r.files) || []).forEach(function (f) {
        if (typeof f === 'string') { out.push({ name: f, size: 0, mtime: 0 }); return; }
        if (f.type === 'directory') return;
        out.push({ name: f.name, size: parseInt(f.size, 10) || 0, mtime: f.mtime || 0 });
      });
      out.sort(function (a, b) { return (b.mtime || 0) - (a.mtime || 0); });
      return out;
    }).catch(function () { return null; });
  }
  function readBackupFile(name) {
    var p = fsPlugin();
    if (!p || !p.getUri || !window.fetch) return Promise.resolve(null);
    return p.getUri({ path: SAVE_DIR + '/' + name, directory: 'DOCUMENTS' }).then(function (r) {
      var C = window.Capacitor;
      var u = r && r.uri;
      if (!u) return null;
      if (C && C.convertFileSrc) u = C.convertFileSrc(u);
      return fetch(u).then(function (res) {
        if (!res.ok) return null;
        return res.arrayBuffer();
      });
    }).catch(function () { return null; });
  }

  return { isNative: isNative, syncAlarms: syncAlarms, init: init, openExternal: openExternal,
           canSaveFiles: canSaveFiles, saveText: saveText, saveBase64: saveBase64,
           lastSaveError: lastSaveError,
           canMediaFiles: canMediaFiles, mediaPut: mediaPut, mediaList: mediaList,
           mediaUrl: mediaUrl, mediaRead: mediaRead, mediaDel: mediaDel, mediaRename: mediaRename,
           listBackups: listBackups, readBackupFile: readBackupFile };
})();
