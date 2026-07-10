/* Alef.Fit — data layer. IndexedDB + migrations + settings + backup + sync.
   v3: tombstones (deletion tracking), media store (content-hashed blobs),
   merge import (last-write-wins + tombstones + note conflict copies). */
'use strict';

var DB = (function () {
  var DB_NAME = 'alef-fit';
  var DB_VERSION = 3;
  var _db = null;

  /* Fixed category order = user priority: large → medium (top-down,
     front-back) → other. Calf lives in Leg; forearm flexor → Bicep,
     extensor → Triceps. */
  var CATEGORIES = [
    { id: 'chest',      name: 'Chest',      color: '#e05d5d' },
    { id: 'back',       name: 'Back',       color: '#4a90d9' },
    { id: 'leg',        name: 'Leg',        color: '#d9a441' },
    { id: 'shoulder',   name: 'Shoulder',   color: '#8e6fd8' },
    { id: 'bicep',      name: 'Bicep',      color: '#4fb06d' },
    { id: 'triceps',    name: 'Triceps',    color: '#3aa8a0' },
    { id: 'abs',        name: 'Abs',        color: '#e0884a' },
    { id: 'compound',   name: 'Compound',   color: '#b05d8e' },
    { id: 'functional', name: 'Functional', color: '#6d8ca0' },
    { id: 'stretching', name: 'Stretching', color: '#7fa05d' }
  ];

  var DEFAULT_PROGRAM_CATS = ['Maintenance', 'Bulking', 'Cutting', 'Endurance', 'Custom'];

  /* user-data stores: stamped with updatedAt on write, tombstoned on delete */
  var DATA_STORES = ['exercises', 'programs', 'logs', 'todos', 'notes', 'folders', 'tags', 'alarms', 'weights', 'walks'];
  var STORES = DATA_STORES.concat(['meta']);

  /* settings keys that stay per-device (never overwritten by sync/merge) */
  var DEVICE_KEYS = ['textScale', 'mediaSize', 'alertRev', 'mediaRev', 'devTextEdit', '_ts'];

  var DEFAULT_SETTINGS = {
    theme: 'system',            // system | light | dark
    textScale: null,            // null = follow OS; else 0.85–1.3 (device-local)
    alertRev: 2,                // one-time default-alert reset marker
    defaultAlertTimed: null,    // minutes before; null = None; 0 = at time
    defaultAlertAllDay: 'none', // none | P0D | P1D | P2D | P7D
    allDayAlertTime: '09:00',
    allDayWhenNoTime: true,
    saveToPhotos: true,
    imageQuality: 'original',   // original | normal | low
    mediaSize: 'm',             // s | m | l (device-local)
    bgTheme: 'carbon',          // carbon | steel | midnight | ember | forest | none
    colorTheme: 'classic',      // classic | steel | indigo | ember | forest
    mediaRev: 2,                // one-time media-defaults marker
    cardBg: {},
    todoTagsOn: false,          // Alef.do: show tag stamps on task rows
    landingPage: 'todo',        // page the app opens on: todo|exercise|discipline|program|retro|setting
    devTextEdit: false,         // Developer: tap-to-edit app texts (device-local)
    gdriveClientId: '',         // Google OAuth client id for Drive sync
    gdriveClientSecret: '',     // its client secret (code-flow exchange)
    _ts: {}                     // per-key change timestamps (for settings merge)
  };

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        for (var v = e.oldVersion + 1; v <= DB_VERSION; v++) migrate(db, v, e.target.transaction);
      };
      req.onsuccess = function () { _db = req.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /* Migration ladder — never edit old cases, only append. */
  function migrate(db, v, tx) {
    if (v === 1) {
      var ex = db.createObjectStore('exercises', { keyPath: 'id' });
      ex.createIndex('categoryId', 'categoryId');
      ex.createIndex('name', 'name');
      var pr = db.createObjectStore('programs', { keyPath: 'id' });
      pr.createIndex('category', 'category');
      var lg = db.createObjectStore('logs', { keyPath: 'id' });
      lg.createIndex('date', 'date');
      lg.createIndex('exerciseId', 'exerciseId');
      var td = db.createObjectStore('todos', { keyPath: 'id' });
      td.createIndex('dueDate', 'dueDate');
      var nt = db.createObjectStore('notes', { keyPath: 'id' });
      nt.createIndex('module', 'module');
      nt.createIndex('folderId', 'folderId');
      var fd = db.createObjectStore('folders', { keyPath: 'id' });
      fd.createIndex('module', 'module');
      var tg = db.createObjectStore('tags', { keyPath: 'id' });
      tg.createIndex('module', 'module');
      db.createObjectStore('alarms', { keyPath: 'id' });
      var wt = db.createObjectStore('weights', { keyPath: 'id' });
      wt.createIndex('date', 'date');
      db.createObjectStore('meta', { keyPath: 'key' });
    }
    if (v === 2) {
      /* Incline Walk recorder (replaces Weight trend UI; weights store kept
         so old data/backups still import). */
      var wk = db.createObjectStore('walks', { keyPath: 'id' });
      wk.createIndex('date', 'date');
    }
    if (v === 3) {
      /* Sync foundation: tombstones record deletions so a merge on another
         device removes the same records; media holds content-hashed
         photo/video blobs referenced by exercises and notes. */
      db.createObjectStore('tombstones', { keyPath: 'id' });
      db.createObjectStore('media', { keyPath: 'id' });
    }
  }

  function tx(store, mode) { return _db.transaction(store, mode || 'readonly').objectStore(store); }

  function reqP(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function putRaw(store, obj) { return reqP(tx(store, 'readwrite').put(obj)); }
  function put(store, obj) {
    if (DATA_STORES.indexOf(store) >= 0) obj.updatedAt = Date.now();
    return putRaw(store, obj);
  }
  function get(store, key) { return reqP(tx(store).get(key)); }
  function delRaw(store, key) { return reqP(tx(store, 'readwrite').delete(key)); }
  function del(store, key) {
    if (DATA_STORES.indexOf(store) >= 0) {
      return putRaw('tombstones', { id: store + '|' + key, store: store, recId: key, deletedAt: Date.now() })
        .then(function () { return delRaw(store, key); });
    }
    return delRaw(store, key);
  }
  function all(store) { return reqP(tx(store).getAll()); }
  function byIndex(store, index, value) { return reqP(tx(store).index(index).getAll(value)); }
  function clear(store) { return reqP(tx(store, 'readwrite').clear()); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---- media store: content-hashed immutable blobs ---- */
  var _mediaCache = {};

  /* cyrb53 string hash — deterministic content id, works everywhere */
  function hashStr(s) {
    var h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length;
    for (var i = 0; i < s.length; i++) {
      var ch = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  function mediaIdFor(dataUrl) { return 'm' + hashStr(dataUrl) + dataUrl.length.toString(36); }

  function mediaUrl(id) {
    if (!id) return Promise.resolve(null);
    if (_mediaCache[id]) return Promise.resolve(_mediaCache[id]);
    return get('media', id).then(function (m) {
      if (m) { _mediaCache[id] = m.dataUrl; return m.dataUrl; }
      return null;
    });
  }

  function internMedia(dataUrl, type) {
    var id = mediaIdFor(dataUrl);
    return get('media', id).then(function (row) {
      if (row) { _mediaCache[id] = row.dataUrl; return id; }
      return putRaw('media', { id: id, type: type || 'image', dataUrl: dataUrl, createdAt: Date.now() })
        .then(function () { _mediaCache[id] = dataUrl; return id; });
    });
  }

  /* exercise media items {type, dataUrl?|mediaId, name?, crop?} → stored form */
  function internExMedia(list) {
    return Promise.all((list || []).map(function (m) {
      if (m.dataUrl) {
        return internMedia(m.dataUrl, m.type).then(function (id) {
          var c = Object.assign({}, m, { mediaId: id });
          delete c.dataUrl;
          return c;
        });
      }
      var c = Object.assign({}, m);
      delete c.dataUrl;
      return Promise.resolve(c);
    }));
  }
  function hydrateExMedia(rows) {
    var arr = Array.isArray(rows) ? rows : [rows];
    return Promise.all(arr.map(function (x) {
      return Promise.all((x.media || []).map(function (m) {
        if (m.dataUrl || !m.mediaId) return null;
        return mediaUrl(m.mediaId).then(function (u) { m.dataUrl = u; });
      }));
    })).then(function () { return rows; });
  }

  /* note images/videos: arrays of mediaId (stored) or dataURL (in memory) */
  function internUrlList(vals, type) {
    return Promise.all((vals || []).map(function (v) {
      return (v && v.slice(0, 5) === 'data:') ? internMedia(v, type) : Promise.resolve(v);
    }));
  }
  function hydrateUrlList(vals) {
    return Promise.all((vals || []).map(function (v) {
      if (!v || v.slice(0, 5) === 'data:') return Promise.resolve(v);
      return mediaUrl(v).then(function (u) { return u; });
    })).then(function (r) { return r.filter(Boolean); });
  }
  function hydrateNote(n) {
    var blocks = Promise.all((n.blocks || []).map(function (b) {
      if (b.t !== 'img' || !b.ref) return Promise.resolve();
      if (b.ref.slice(0, 5) === 'data:') { b.url = b.ref; return Promise.resolve(); }
      return mediaUrl(b.ref).then(function (u) { b.url = u; });
    }));
    return Promise.all([hydrateUrlList(n.images), hydrateUrlList(n.videos), blocks]).then(function (r) {
      n.images = r[0];
      n.videos = r[1];
      return n;
    });
  }

  /* one-time data migration: move inline dataURLs into the media store */
  function migrateMediaStore() {
    return get('meta', 'mediaStoreRev').then(function (f) {
      if (f && f.value >= 1) return false;
      return all('exercises').then(function (exs) {
        return Promise.all(exs.map(function (x) {
          if (!(x.media || []).some(function (m) { return m.dataUrl; })) return null;
          return internExMedia(x.media).then(function (list) {
            x.media = list;
            return putRaw('exercises', x);
          });
        }));
      }).then(function () { return all('notes'); }).then(function (ns) {
        return Promise.all(ns.map(function (n) {
          var vals = (n.images || []).concat(n.videos || []);
          var inline = vals.some(function (v) { return v && v.slice(0, 5) === 'data:'; });
          if (!inline) return null;
          return Promise.all([internUrlList(n.images, 'image'), internUrlList(n.videos, 'video')]).then(function (r) {
            n.images = r[0];
            n.videos = r[1];
            return putRaw('notes', n);
          });
        }));
      }).then(function () {
        return put('meta', { key: 'mediaStoreRev', value: 1 });
      }).then(function () { return true; });
    });
  }

  /* remove media blobs no record references anymore */
  function gcMedia() {
    return Promise.all([all('exercises'), all('notes'), all('media')]).then(function (r) {
      var refs = {};
      r[0].forEach(function (x) {
        (x.media || []).forEach(function (m) { if (m.mediaId) refs[m.mediaId] = 1; });
      });
      r[1].forEach(function (n) {
        (n.images || []).concat(n.videos || []).forEach(function (v) {
          if (v && v.slice(0, 5) !== 'data:') refs[v] = 1;
        });
        (n.blocks || []).forEach(function (b) {
          if (b.t === 'img' && b.ref && b.ref.slice(0, 5) !== 'data:') refs[b.ref] = 1;
        });
        (n.files || []).forEach(function (f) {
          if (f.ref && f.ref.slice(0, 5) !== 'data:') refs[f.ref] = 1;
        });
      });
      var dead = r[2].filter(function (m) { return !refs[m.id]; });
      dead.forEach(function (m) { delete _mediaCache[m.id]; });
      return Promise.all(dead.map(function (m) { return delRaw('media', m.id); }))
        .then(function () { return dead.length; });
    });
  }

  /* ---- settings ---- */
  var _settings = null;
  function getSettings() { return _settings; }
  function loadSettings() {
    return get('meta', 'settings').then(function (row) {
      _settings = Object.assign({}, DEFAULT_SETTINGS, row ? row.value : {});
      if (!_settings._ts) _settings._ts = {};
      var dirty = false;
      /* 2026-07-02: default alerts changed to None — reset once. */
      if (_settings.alertRev !== 2) {
        _settings.alertRev = 2;
        _settings.defaultAlertTimed = null;
        _settings.defaultAlertAllDay = 'none';
        dirty = true;
      }
      /* 2026-07-04: media defaults — keep originals, save originals to album. */
      if (_settings.mediaRev !== 2) {
        _settings.mediaRev = 2;
        _settings.imageQuality = 'original';
        _settings.saveToPhotos = true;
        dirty = true;
      }
      if (dirty) {
        return put('meta', { key: 'settings', value: _settings }).then(function () { return _settings; });
      }
      return _settings;
    });
  }
  function saveSettings(patch) {
    var now = Date.now();
    Object.keys(patch).forEach(function (k) { if (k !== '_ts') _settings._ts[k] = now; });
    Object.assign(_settings, patch);
    return put('meta', { key: 'settings', value: _settings });
  }

  /* ---- program categories (user-editable, ordered names) ---- */
  function getProgramCats() {
    return get('meta', 'programCats').then(function (row) {
      if (row) return row.value;
      /* first run: seed defaults; 'Bodybuilding' was renamed 'Maintenance'
         (2026-07-03) — migrate any existing programs once. */
      return all('programs').then(function (ps) {
        return Promise.all(ps.filter(function (p) { return p.category === 'Bodybuilding'; })
          .map(function (p) { p.category = 'Maintenance'; return put('programs', p); }));
      }).then(function () {
        return put('meta', { key: 'programCats', value: DEFAULT_PROGRAM_CATS.slice(), updatedAt: Date.now() });
      }).then(function () { return DEFAULT_PROGRAM_CATS.slice(); });
    });
  }
  function saveProgramCats(list) {
    return put('meta', { key: 'programCats', value: list.slice(), updatedAt: Date.now() });
  }

  /* ---- Alef.do task lists (ordered, custom lists + text colors) ---- */
  var DEFAULT_TODO_CATS = [
    { id: 'now', name: 'NOW', color: '#d9a441' },
    { id: 'today', name: 'TODAY', color: '#e0884a' },
    { id: 'later', name: 'LATER', color: '#4fb06d' },
    { id: 'project', name: 'PROJECT (Follow Up)', color: '#4a90d9' },
    { id: 'never', name: 'NEVER', color: '#8e6fd8' }
  ];
  function getTodoCats() {
    return get('meta', 'todoCats').then(function (row) {
      if (row) return row.value;
      var v = JSON.parse(JSON.stringify(DEFAULT_TODO_CATS));
      return put('meta', { key: 'todoCats', value: v, updatedAt: Date.now() })
        .then(function () { return v; });
    });
  }
  function saveTodoCats(list) {
    return put('meta', { key: 'todoCats', value: list, updatedAt: Date.now() });
  }

  /* one-time: old To-do priority ratings become Alef.do categories */
  function migrateTodosOnce() {
    return get('meta', 'tdRev').then(function (f) {
      if (f && f.value >= 1) return false;
      var map = { now: 'now', today: 'today', soon: 'later', later: 'later', dont: 'never' };
      return all('todos').then(function (rows) {
        return Promise.all(rows.map(function (t) {
          var dirty = false;
          if (!t.cat) { t.cat = map[t.priority] || 'now'; dirty = true; }
          if (!t.prio) { t.prio = 'none'; dirty = true; }
          if (!t.subs) { t.subs = []; dirty = true; }
          if (!t.tags) { t.tags = []; dirty = true; }
          return dirty ? putRaw('todos', t) : null;
        }));
      }).then(function () { return put('meta', { key: 'tdRev', value: 1 }); }).then(function () { return true; });
    });
  }

  /* ---- seed ---- */
  function seedIfEmpty() {
    return get('meta', 'seeded').then(function (flag) {
      if (flag) return false;
      return all('exercises').then(function (rows) {
        if (rows.length) return put('meta', { key: 'seeded', value: true }).then(function () { return false; });
        var now = Date.now();
        var puts = (window.SEED_EXERCISES || []).map(function (s, i) {
          return put('exercises', {
            id: 'seed-' + i, name: s.n, categoryId: s.c, muscles: s.m,
            steps: s.s, media: [], seeded: true, createdAt: now, updatedAt: now
          });
        });
        return Promise.all(puts).then(function () {
          return put('meta', { key: 'seeded', value: true });
        }).then(function () { return true; });
      });
    });
  }

  /* One-time: give every empty program category a starter dummy program
     (user asked for examples to see the design; freely deletable). */
  function seedProgramsIfEmpty() {
    return get('meta', 'seededPrograms').then(function (flag) {
      if (flag) return false;
      return getProgramCats().then(function (cats) {
        return all('programs').then(function (ps) {
          var have = {};
          ps.forEach(function (p) { have[p.category] = 1; });
          var defs = window.SEED_PROGRAMS || [];
          var puts = [];
          defs.forEach(function (d, i) {
            if (cats.indexOf(d.category) < 0 || have[d.category]) return;
            puts.push(put('programs', {
              id: 'seedp-' + i, name: d.name, category: d.category,
              status: d.status || 'reserve', bg: d.bg || '',
              order: (i + 1) * 10, days: d.days, seeded: true, createdAt: Date.now()
            }));
          });
          return Promise.all(puts).then(function () {
            return put('meta', { key: 'seededPrograms', value: true });
          }).then(function () { return puts.length > 0; });
        });
      });
    });
  }

  /* ---- backup / sync files ----
     opts.media: 'all' (full backup) | 'since' (sync file: only media added
     since the previous export) | 'none' (data only — Drive sync JSON). */
  function exportAll(opts) {
    opts = opts || {};
    var mediaMode = opts.media || 'all';
    var out = {
      app: 'alef.fit', schemaVersion: DB_VERSION, appVersion: window.APP_VERSION || '0',
      exportedAt: new Date().toISOString(), mediaMode: mediaMode, stores: {}
    };
    var chain = Promise.resolve();
    DATA_STORES.concat(['meta', 'tombstones']).forEach(function (s) {
      chain = chain.then(function () { return all(s); }).then(function (rows) {
        if (s === 'meta') rows = rows.filter(function (r) { return r.key !== 'gdriveRefreshToken'; });
        out.stores[s] = rows;
      });
    });
    return chain.then(function () { return get('meta', 'lastExportAt'); }).then(function (r) {
      var since = r ? r.value : 0;
      return all('media').then(function (rows) {
        out.mediaIndex = rows.map(function (m) { return m.id; });
        if (mediaMode === 'all') out.stores.media = rows;
        else if (mediaMode === 'since') out.stores.media = rows.filter(function (m) { return (m.createdAt || 0) > since; });
        else out.stores.media = [];
      });
    }).then(function () {
      if (mediaMode !== 'none') return put('meta', { key: 'lastExportAt', value: Date.now() });
    }).then(function () { return out; });
  }

  /* Data-level migrations for old backup files: append steps as schema grows. */
  function migrateBackup(json) {
    if (!json.stores.tombstones) json.stores.tombstones = [];
    if (!json.stores.media) json.stores.media = [];
    var mediaMap = {};
    json.stores.media.forEach(function (m) { mediaMap[m.id] = 1; });
    function intern(dataUrl, type) {
      var id = mediaIdFor(dataUrl);
      if (!mediaMap[id]) {
        mediaMap[id] = 1;
        json.stores.media.push({ id: id, type: type, dataUrl: dataUrl, createdAt: 0 });
      }
      return id;
    }
    (json.stores.exercises || []).forEach(function (x) {
      (x.media || []).forEach(function (m) {
        if (m.dataUrl) { m.mediaId = intern(m.dataUrl, m.type); delete m.dataUrl; }
      });
    });
    (json.stores.notes || []).forEach(function (n) {
      ['images', 'videos'].forEach(function (f, fi) {
        n[f] = (n[f] || []).map(function (v) {
          return (v && v.slice(0, 5) === 'data:') ? intern(v, fi ? 'video' : 'image') : v;
        });
      });
    });
    DATA_STORES.forEach(function (s) {
      (json.stores[s] || []).forEach(function (r) {
        if (r.updatedAt == null) r.updatedAt = r.createdAt || 0;
      });
    });
    if (!json.mediaMode) json.mediaMode = 'all';
    return json;
  }

  function importAll(json, opts) {
    opts = opts || {};
    var mode = opts.mode || 'merge';
    if (!json || json.app !== 'alef.fit' || !json.stores) return Promise.reject(new Error('Not an Alef.Fit backup file'));
    if (json.schemaVersion > DB_VERSION) return Promise.reject(new Error('Backup is from a newer app version — update the app first'));
    json = migrateBackup(json);
    return (mode === 'replace' ? importReplace(json) : importMerge(json));
  }

  function importReplace(json) {
    var keepScale = _settings ? _settings.textScale : null;
    var keepSize = _settings ? _settings.mediaSize : 'm';
    var chain = Promise.resolve();
    DATA_STORES.concat(['meta', 'tombstones']).forEach(function (s) {
      chain = chain.then(function () { return clear(s); }).then(function () {
        return Promise.all((json.stores[s] || []).map(function (r) { return putRaw(s, r); }));
      });
    });
    /* media: only clear when the file carries the full media set */
    chain = chain.then(function () {
      if (json.mediaMode === 'all') return clear('media');
    }).then(function () {
      return Promise.all((json.stores.media || []).map(function (m) { return putRaw('media', m); }));
    });
    return chain.then(function () { _mediaCache = {}; return loadSettings(); })
      .then(function () { return saveSettings({ textScale: keepScale, mediaSize: keepSize }); })
      .then(gcMedia)
      .then(function () { return { mode: 'replace' }; });
  }

  function recTs(r) { return r.updatedAt || r.createdAt || 0; }

  function noteSig(n) { return JSON.stringify([n.title, n.body, n.bg, n.images, n.videos, n.tags, n.folderId]); }

  function conflictCopy(n) {
    var c = JSON.parse(JSON.stringify(n));
    c.id = uid();
    c.title = (n.title || '(untitled)') + ' (conflict copy)';
    c.pinned = false;
    c.updatedAt = Date.now();
    return c;
  }

  function mergeStore(s, incRows, incTombs, locTombMap, counts, lastSync) {
    return all(s).then(function (locRows) {
      var loc = {};
      locRows.forEach(function (r) { loc[r.id] = r; });
      var chain = Promise.resolve();
      incRows.forEach(function (inc) {
        chain = chain.then(function () {
          var its = recTs(inc);
          var lt = locTombMap[s + '|' + inc.id];
          if (lt && lt.deletedAt >= its) return; /* deleted locally, later */
          var l = loc[inc.id];
          if (!l) { counts.added++; return putRaw(s, inc); }
          var lts = recTs(l);
          if (its > lts) {
            counts.updated++;
            var p = putRaw(s, inc);
            if (s === 'notes' && lts > lastSync && noteSig(l) !== noteSig(inc)) {
              counts.conflicts++;
              p = p.then(function () { return putRaw(s, conflictCopy(l)); });
            }
            return p;
          }
          if (its < lts && s === 'notes' && its > lastSync && noteSig(l) !== noteSig(inc)) {
            counts.conflicts++;
            return putRaw(s, conflictCopy(inc));
          }
        });
      });
      incTombs.forEach(function (t) {
        if (t.store !== s) return;
        chain = chain.then(function () {
          var l = loc[t.recId];
          if (l && recTs(l) <= t.deletedAt) {
            counts.deleted++;
            return delRaw(s, t.recId);
          }
        });
      });
      return chain;
    });
  }

  function mergeSettings(inc) {
    var incTs = inc._ts || {};
    var locTs = _settings._ts || (_settings._ts = {});
    var changed = false;
    Object.keys(inc).forEach(function (k) {
      if (DEVICE_KEYS.indexOf(k) >= 0) return;
      if ((incTs[k] || 0) > (locTs[k] || 0)) {
        _settings[k] = inc[k];
        locTs[k] = incTs[k];
        changed = true;
      }
    });
    if (changed) return put('meta', { key: 'settings', value: _settings });
  }

  function mergeMeta(json) {
    var rows = json.stores.meta || [];
    var chain = Promise.resolve();
    var incSet = rows.find(function (r) { return r.key === 'settings'; });
    if (incSet && incSet.value) chain = chain.then(function () { return mergeSettings(incSet.value); });
    ['programCats', 'todoCats', 'textOverrides'].forEach(function (key) {
      var incRow = rows.find(function (r) { return r.key === key; });
      if (!incRow) return;
      chain = chain.then(function () {
        return get('meta', key).then(function (l) {
          if (!l || (incRow.updatedAt || 0) > (l.updatedAt || 0)) return putRaw('meta', incRow);
        });
      });
    });
    return chain;
  }

  function importMerge(json) {
    var counts = { added: 0, updated: 0, deleted: 0, conflicts: 0, mediaAdded: 0 };
    var lastSync = 0;
    return get('meta', 'lastSyncAt').then(function (r) { lastSync = r ? r.value : 0; })
      .then(function () {
        /* media first — records may reference the new blobs */
        var inc = json.stores.media || [];
        return all('media').then(function (locRows) {
          var have = {};
          locRows.forEach(function (m) { have[m.id] = 1; });
          return Promise.all(inc.filter(function (m) { return m.dataUrl && !have[m.id]; })
            .map(function (m) {
              counts.mediaAdded++;
              return putRaw('media', m);
            }));
        });
      })
      .then(function () { return all('tombstones'); })
      .then(function (locTombs) {
        var locTombMap = {};
        locTombs.forEach(function (t) { locTombMap[t.id] = t; });
        var incTombs = json.stores.tombstones || [];
        var chain = Promise.resolve();
        DATA_STORES.forEach(function (s) {
          chain = chain.then(function () {
            return mergeStore(s, json.stores[s] || [], incTombs, locTombMap, counts, lastSync);
          });
        });
        chain = chain.then(function () {
          return Promise.all(incTombs.map(function (t) {
            var lt = locTombMap[t.id];
            if (!lt || lt.deletedAt < t.deletedAt) return putRaw('tombstones', t);
            return null;
          }));
        });
        return chain;
      })
      .then(function () { return mergeMeta(json); })
      .then(function () { return putRaw('meta', { key: 'lastSyncAt', value: Date.now() }); })
      .then(loadSettings)
      .then(gcMedia)
      .then(function () { return counts; });
  }

  function storageEstimate() {
    if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
    return Promise.resolve(null);
  }

  return {
    open: open, put: put, putRaw: putRaw, get: get, del: del, all: all, byIndex: byIndex, clear: clear,
    uid: uid, todayISO: todayISO,
    CATEGORIES: CATEGORIES,
    getProgramCats: getProgramCats, saveProgramCats: saveProgramCats,
    catById: function (id) { return CATEGORIES.find(function (c) { return c.id === id; }); },
    loadSettings: loadSettings, getSettings: getSettings, saveSettings: saveSettings,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    seedIfEmpty: seedIfEmpty, seedProgramsIfEmpty: seedProgramsIfEmpty,
    getTodoCats: getTodoCats, saveTodoCats: saveTodoCats, migrateTodosOnce: migrateTodosOnce,
    mediaUrl: mediaUrl, internMedia: internMedia, internExMedia: internExMedia,
    hydrateExMedia: hydrateExMedia, hydrateNote: hydrateNote, internUrlList: internUrlList,
    migrateMediaStore: migrateMediaStore, gcMedia: gcMedia, mediaIdFor: mediaIdFor,
    exportAll: exportAll, importAll: importAll,
    storageEstimate: storageEstimate
  };
})();
