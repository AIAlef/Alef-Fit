/* Alef.Fit — data layer. IndexedDB + migrations + settings + backup + sync.
   v3: tombstones (deletion tracking), media store (content-hashed blobs),
   merge import (last-write-wins + tombstones + note conflict copies). */
'use strict';

var DB = (function () {
  var DB_NAME = 'alef-fit';
  var DB_VERSION = 6;
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
  var DATA_STORES = ['exercises', 'programs', 'logs', 'todos', 'notes', 'folders', 'tags', 'alarms', 'weights', 'walks', 'proposals'];
  var STORES = DATA_STORES.concat(['meta']);

  /* settings keys that stay per-device (never overwritten by sync/merge).
     v0.39: claudeShareOn/InboxOn/Direct became device-local — exactly ONE
     device (the main S26) may write the Claude share / ack the inbox, so
     those switches must never ride the settings merge to another device. */
  var DEVICE_KEYS = ['textScale', 'mediaSize', 'alertRev', 'mediaRev', 'devTextEdit', 'todoCompact', 'deviceId', 'autoSync', 'pcProposals',
    'instanceId', 'setupDone', 'claudeShareOn', 'claudeInboxOn', 'claudeDirect', '_ts'];

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
    todoCompact: true,          // Alef.do: tight task rows (device-local)
    deviceId: '',               // this device: 'S26' | 'PC' (device-local)
    autoSync: true,             // Drive auto-sync triggers (device-local)
    pcProposals: true,          // PC: governed edits become proposals (device-local)
    landingPage: 'todo',        // page the app opens on: todo|exercise|discipline|program|retro|setting
    devTextEdit: false,         // Developer: tap-to-edit app texts (device-local)
    gdriveClientId: '',         // Google OAuth client id for Drive sync
    gdriveClientSecret: '',     // its client secret (code-flow exchange)
    claudeShareOn: false,       // write a visible Drive file for the Claude secretary
    claudeShareTodo: true,      // Claude share: include Alef.do tasks
    claudeShareWorkout: true,   // Claude share: include programs, logs, incline walks
    claudeInboxOn: true,        // Claude may leave suggestions (reviewed on the S26)
    claudeDirect: true,         // Alef.Lucilius: batches marked mode:'direct' apply without review
    instanceId: '',             // v0.39: random id of THIS install (device-local)
    setupDone: false,           // v0.39: first-run Setup wizard completed (device-local)
    mainClaim: null,            // v0.39: SYNCED succession stamp {role, instanceId, at}
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
    if (v === 4) {
      /* PC proposal pipeline: staged changes awaiting review on the S26 */
      db.createObjectStore('proposals', { keyPath: 'id' });
    }
    if (v === 5) {
      /* v0.37: refreshed exercise library (145 bundled-photo exercises).
         Drop the old placeholder exercises + sample programs and their seed
         flags so boot re-seeds from the new SEED_EXERCISES / SEED_PROGRAMS.
         Logs, todos, notes and settings are untouched. */
      try {
        tx.objectStore('exercises').clear();
        tx.objectStore('programs').clear();
        tx.objectStore('meta').delete('seeded');
        tx.objectStore('meta').delete('seededPrograms');
      } catch (e) { /* fresh install: nothing to clear yet */ }
    }
    if (v === 6) {
      /* v0.38: added muscle groups + technique/caution to every seeded
         exercise. Clear exercises and the seed flag so boot re-seeds with the
         new detail. Programs (and their exercise links), logs, todos, notes
         and settings are untouched — the exercise order/ids are unchanged. */
      try {
        tx.objectStore('exercises').clear();
        tx.objectStore('meta').delete('seeded');
      } catch (e) { /* nothing to clear */ }
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
  /* ---- PC proposal staging (Phase 2) ----
     On the PC (deviceId 'PC', proposal mode on), writes to the governed
     stores become DRAFT proposals instead of touching live data. Drafts
     stay on the PC until sent; the S26 reviews and applies them. */
  var GOVERNED = { todos: 1, exercises: 1, programs: 1, notes: 1, folders: 1, tags: 1 };
  function proposalMode() {
    return !!(_settings && _settings.deviceId === 'PC' && _settings.pcProposals !== false);
  }
  function stageProposal(store, action, rec, recId) {
    var rid = recId || (rec && rec.id);
    var pid = 'd|' + store + '|' + rid;
    return get(store, rid).then(function (live) {
      var act = action;
      if (act !== 'delete') act = live ? 'edit' : 'add';
      var p = {
        id: pid, store: store, recId: rid, action: act,
        data: act === 'delete' ? (live ? JSON.parse(JSON.stringify(live)) : null)
                               : JSON.parse(JSON.stringify(rec)),
        base: live ? (live.updatedAt || 0) : 0,
        status: 'draft', proposedAt: Date.now(), updatedAt: Date.now(),
        by: _settings.deviceId
      };
      if (window.UI && UI.toast) UI.toast('Draft saved — Send to S26 when ready');
      return putRaw('proposals', p);
    });
  }
  function stageMetaProposal(key, value) {
    var pid = 'd|meta|' + key;
    return get('meta', key).then(function (live) {
      var p = {
        id: pid, store: 'meta', recId: key, action: 'edit',
        data: JSON.parse(JSON.stringify(value)),
        base: live ? (live.updatedAt || 0) : 0,
        status: 'draft', proposedAt: Date.now(), updatedAt: Date.now(),
        by: _settings.deviceId
      };
      if (window.UI && UI.toast) UI.toast('Draft saved — Send to S26 when ready');
      return putRaw('proposals', p);
    });
  }
  function listProposals() {
    return all('proposals').then(function (rows) {
      return rows.sort(function (a, b) { return (a.proposedAt || 0) - (b.proposedAt || 0); });
    });
  }
  function sendProposals(ids) {
    return listProposals().then(function (rows) {
      return Promise.all(rows.filter(function (r) { return ids.indexOf(r.id) >= 0; })
        .map(function (r) {
          r.status = 'sent';
          r.updatedAt = Date.now();
          return putRaw('proposals', r);
        }));
    }).then(function () {
      if (window.Sync && window.Sync.autoTouch) window.Sync.autoTouch();
    });
  }
  function applyProposal(p) {
    if (p.store === 'meta') {
      if (p.recId === 'todoCats') return saveTodoCats(p.data);
      if (p.recId === 'programCats') return saveProgramCats(p.data);
      return Promise.resolve();
    }
    if (p.action === 'delete') return del(p.store, p.recId);
    return put(p.store, p.data);
  }
  function propSummary(p) {
    if (p.store === 'meta') {
      return 'Edit ' + (p.recId === 'todoCats' ? 'task lists' : 'program categories');
    }
    var what = { todos: 'task', exercises: 'exercise', programs: 'program', notes: 'note', folders: 'folder', tags: 'tag' }[p.store] || p.store;
    var name = (p.data && (p.data.title || p.data.name)) || p.recId;
    var act = p.action === 'add' ? 'Add' : p.action === 'delete' ? 'Delete' : 'Edit';
    return act + ' ' + what + ' "' + name + '"';
  }

  function put(store, obj) {
    if (store === 'todos') return putTodo(obj);
    if (GOVERNED[store] && proposalMode()) return stageProposal(store, 'save', obj);
    if (DATA_STORES.indexOf(store) >= 0) {
      obj.updatedAt = Date.now();
      var dev = _settings && _settings.deviceId;
      if (dev) obj.by = dev;
      if (window.Sync && window.Sync.autoTouch) window.Sync.autoTouch();
    }
    return putRaw(store, obj);
  }
  /* todos go through vault handling: Vault tasks (cat 'vault') live on THIS
     device only — they bypass the proposal pipeline and sync triggers, and
     moving a previously-synced task INTO the vault writes a tombstone so
     other devices drop their copy (moving it out removes the tombstone so
     the task can rejoin sync). */
  function putTodo(obj) {
    var isVault = obj && obj.cat === 'vault';
    if (proposalMode() && !isVault) return stageProposal('todos', 'save', obj);
    return get('todos', obj.id).then(function (old) {
      obj.updatedAt = Date.now();
      var dev = _settings && _settings.deviceId;
      if (dev) obj.by = dev;
      var pre = Promise.resolve();
      var touch = !isVault;
      if (isVault && old && old.cat !== 'vault') {
        var tb = { id: 'todos|' + obj.id, store: 'todos', recId: obj.id, deletedAt: obj.updatedAt - 1 };
        if (dev) tb.by = dev;
        pre = putRaw('tombstones', tb);
        touch = true; /* push the removal to the other devices */
      } else if (!isVault && old && old.cat === 'vault') {
        pre = delRaw('tombstones', 'todos|' + obj.id);
      }
      if (touch && window.Sync && window.Sync.autoTouch) window.Sync.autoTouch();
      return pre.then(function () { return putRaw('todos', obj); });
    });
  }
  function get(store, key) { return reqP(tx(store).get(key)); }
  function delRaw(store, key) { return reqP(tx(store, 'readwrite').delete(key)); }
  function del(store, key) {
    var pre = store === 'todos' ? get('todos', key) : Promise.resolve(null);
    return pre.then(function (rec) {
      /* vault tasks: local-only — no proposal, no tombstone, no sync trace */
      if (rec && rec.cat === 'vault') return delRaw(store, key);
      if (GOVERNED[store] && proposalMode()) return stageProposal(store, 'delete', null, key);
      if (DATA_STORES.indexOf(store) >= 0) {
        var tb = { id: store + '|' + key, store: store, recId: key, deletedAt: Date.now() };
        if (_settings && _settings.deviceId) tb.by = _settings.deviceId;
        if (window.Sync && window.Sync.autoTouch) window.Sync.autoTouch();
        return putRaw('tombstones', tb)
          .then(function () { return delRaw(store, key); });
      }
      return delRaw(store, key);
    });
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
      if (m.src) {                              /* bundled app image — keep the path ref */
        var b = { type: m.type || 'image', src: m.src };
        if (m.crop) b.crop = m.crop;
        if (m.name) b.name = m.name;
        return Promise.resolve(b);
      }
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
        if (m.dataUrl) return null;
        if (m.src) { m.dataUrl = m.src; return null; }   /* bundled app image path */
        if (!m.mediaId) return null;
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
    return Promise.all([all('exercises'), all('notes'), all('media'), get('meta', 'undoSnapshot')]).then(function (r) {
      var refs = {};
      var snap = r[3] && r[3].value && r[3].value.data && r[3].value.data.stores;
      if (snap) {
        (snap.exercises || []).forEach(function (x) {
          (x.media || []).forEach(function (m) { if (m.mediaId) refs[m.mediaId] = 1; });
        });
        (snap.notes || []).forEach(function (n) {
          JSON.stringify(n).replace(/"(m[0-9a-z]{6,})"/g, function (_, id) { refs[id] = 1; return _; });
        });
      }
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
      /* v0.39: every install gets a stable random identity once */
      if (!_settings.instanceId) {
        _settings.instanceId = uid();
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

  /* ---- v0.39: app roles + succession (docs/ROLES-SETUP-PLAN.md) ----
     claimRole writes the SYNCED succession stamp and applies the role's
     defaults; isSuperseded is true when a NEWER install claimed MY role —
     the retired copy stops writing the Claude share / scheduling alarms. */
  function claimRole(role) {
    var patch = {
      deviceId: role, setupDone: true,
      mainClaim: { role: role, instanceId: _settings.instanceId, at: Date.now() }
    };
    if (role === 'S26') {
      patch.claudeShareOn = true;
      patch.claudeInboxOn = true;
      patch.claudeDirect = true;
      patch.claudeShareTodo = true;
      patch.claudeShareWorkout = false;   /* Alef's standing choice */
    } else if (role === 'PC') {
      patch.pcProposals = true;
      patch.claudeShareOn = false;
    }
    return saveSettings(patch);
  }
  function isSuperseded() {
    var s = _settings || {};
    return !!(s.mainClaim && s.deviceId && s.mainClaim.role === s.deviceId &&
      s.mainClaim.instanceId && s.instanceId &&
      s.mainClaim.instanceId !== s.instanceId);
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
    if (proposalMode()) return stageMetaProposal('programCats', list.slice());
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
    if (proposalMode()) return stageMetaProposal('todoCats', list);
    return put('meta', { key: 'todoCats', value: list, updatedAt: Date.now() });
  }

  /* one-time: old To-do priority ratings become Alef.do categories */
  function migrateTodosOnce() {
    return get('meta', 'tdRev').then(function (f) {
      if (f && f.value >= 2) return false;
      var map = { now: 'now', today: 'today', soon: 'later', later: 'later', dont: 'never' };
      return all('todos').then(function (rows) {
        return Promise.all(rows.map(function (t) {
          var dirty = false;
          if (!t.cat) { t.cat = map[t.priority] || 'now'; dirty = true; }
          if (!t.prio) { t.prio = 'none'; dirty = true; }
          if (!t.subs) { t.subs = []; dirty = true; }
          if (!t.tags) { t.tags = []; dirty = true; }
          /* v2: NOW became a flag — tasks that lived in NOW move home to TODAY */
          if (t.cat === 'now') { t.now = true; t.cat = 'today'; dirty = true; }
          return dirty ? putRaw('todos', t) : null;
        }));
      }).then(function () { return put('meta', { key: 'tdRev', value: 2 }); }).then(function () { return true; });
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
            steps: s.s, media: s.media || [], seeded: true, createdAt: now, updatedAt: now
          });
        });
        return Promise.all(puts).then(function () {
          return put('meta', { key: 'seeded', value: true });
        }).then(function () { return true; });
      });
    });
  }

  /* v0.42: seed top-up — when SEED_REV (seed-data.js) is newer than this
     install's stored rev, ADD any seed exercise whose name is not in the
     library yet. Never overwrites or deletes anything the user has; ids are
     deterministic (name slug) so every device adds the SAME record and the
     Drive merge cannot duplicate it. Bypasses the PC proposal pipeline —
     a library top-up is app maintenance, not a user edit. */
  function seedTopUp() {
    var target = window.SEED_REV || 1;
    return get('meta', 'seedRev').then(function (row) {
      var have = row ? row.value : 1;
      if (have >= target) return 0;
      return all('exercises').then(function (rows) {
        var names = {};
        rows.forEach(function (r) { names[String(r.name || '').trim().toLowerCase()] = 1; });
        var now = Date.now();
        var adds = (window.SEED_EXERCISES || []).filter(function (s) {
          return !names[String(s.n || '').trim().toLowerCase()];
        });
        return Promise.all(adds.map(function (s) {
          var slug = String(s.n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
          return putRaw('exercises', {
            id: 'seed-x-' + slug, name: s.n, categoryId: s.c, muscles: s.m,
            steps: s.s, media: s.media || [], seeded: true,
            createdAt: now, updatedAt: now
          });
        })).then(function () {
          return put('meta', { key: 'seedRev', value: target });
        }).then(function () { return adds.length; });
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
        if (s === 'todos') rows = rows.filter(function (r) { return r.cat !== 'vault'; }); /* Vault never leaves the device */
        if (s === 'meta') rows = rows.filter(function (r) { return r.key !== 'gdriveRefreshToken' && r.key !== 'undoSnapshot'; });
        if (s === 'proposals') rows = rows.filter(function (r) { return r.status !== 'draft'; });
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
    var pre = opts.noSnapshot ? Promise.resolve() : exportAll({ media: 'none' }).then(function (snap) {
      return putRaw('meta', { key: 'undoSnapshot', value: { at: Date.now(), mode: mode, data: snap } });
    });
    return pre.then(function () {
      return (mode === 'replace' ? importReplace(json) : importMerge(json, opts.only || null));
    });
  }

  function undoInfo() {
    return get('meta', 'undoSnapshot').then(function (r) {
      return r && r.value ? { at: r.value.at, mode: r.value.mode } : null;
    });
  }
  function undoLastMerge() {
    return get('meta', 'undoSnapshot').then(function (r) {
      if (!r || !r.value || !r.value.data) return Promise.reject(new Error('Nothing to undo'));
      var snap = r.value.data;
      return importAll(snap, { mode: 'replace', noSnapshot: true }).then(function () {
        return delRaw('meta', 'undoSnapshot');
      });
    });
  }

  function importReplace(json) {
    var keepScale = _settings ? _settings.textScale : null;
    var keepSize = _settings ? _settings.mediaSize : 'm';
    var vaultKeep = [];
    /* Vault entries never ride backups — carry them across the wipe */
    var chain = all('todos').then(function (rows) {
      vaultKeep = rows.filter(function (r) { return r.cat === 'vault'; });
    });
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
    }).then(function () {
      return Promise.all(vaultKeep.map(function (r) { return putRaw('todos', r); }));
    });
    return chain.then(function () { _mediaCache = {}; return loadSettings(); })
      .then(function () { return saveSettings({ textScale: keepScale, mediaSize: keepSize }); })
      .then(gcMedia)
      .then(function () { return { mode: 'replace' }; });
  }

  function recTs(r) { return r.updatedAt || r.createdAt || 0; }

  function noteSig(n) { return JSON.stringify([n.title, n.body, n.bg, n.images, n.videos, n.tags, n.folderId]); }

  function todoSig(t) { return JSON.stringify([t.title, t.note, t.cat, t.now, t.prio, t.subs, t.tags, t.done, t.locked, t.order]); }

  /* a record is copy-protected in merges when it is a locked task, or a
     note edited on both sides since the last sync */
  function keepBoth(s2, l, inc, lastSync) {
    if (s2 === 'notes') return recTs(l) > lastSync && recTs(inc) > lastSync && noteSig(l) !== noteSig(inc);
    if (s2 === 'todos') return (l.locked || inc.locked) && todoSig(l) !== todoSig(inc);
    return false;
  }

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
            if (s === 'todos' && l.cat === 'vault') return; /* vault: local version always wins */
            if (s === 'todos' && l.locked) {
              /* protected: the local locked version wins; keep theirs as a copy */
              if (todoSig(l) !== todoSig(inc)) {
                counts.conflicts++;
                return putRaw(s, conflictCopy(inc));
              }
              return;
            }
            counts.updated++;
            var p = putRaw(s, inc);
            if (keepBoth(s, l, inc, lastSync)) {
              counts.conflicts++;
              p = p.then(function () { return putRaw(s, conflictCopy(l)); });
            }
            return p;
          }
          if (its < lts && keepBoth(s, l, inc, lastSync)) {
            counts.conflicts++;
            return putRaw(s, conflictCopy(inc));
          }
        });
      });
      incTombs.forEach(function (t) {
        if (t.store !== s) return;
        chain = chain.then(function () {
          var l = loc[t.recId];
          if (l && (l.locked || l.cat === 'vault')) return; /* protected + vault tasks ignore incoming deletes */
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

  function mergeMetaKeys(rows, keys) {
    var chain = Promise.resolve();
    keys.forEach(function (key) {
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
  function mergeMeta(json) {
    var rows = json.stores.meta || [];
    var chain = Promise.resolve();
    var incSet = rows.find(function (r) { return r.key === 'settings'; });
    if (incSet && incSet.value) chain = chain.then(function () { return mergeSettings(incSet.value); });
    return chain.then(function () {
      return mergeMetaKeys(rows, ['programCats', 'todoCats', 'textOverrides', 'todoReflect']);
    });
  }

  /* v0.36: `only` (array of store names) scopes the merge — used by
     "Sync Workout" to touch exercises/programs/logs and nothing else. */
  function importMerge(json, only) {
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
          if (only && only.indexOf(s) < 0) return;
          chain = chain.then(function () {
            return mergeStore(s, json.stores[s] || [], incTombs, locTombMap, counts, lastSync);
          });
        });
        chain = chain.then(function () {
          return Promise.all(incTombs.map(function (t) {
            if (only && only.indexOf(t.store) < 0) return null;
            var lt = locTombMap[t.id];
            if (!lt || lt.deletedAt < t.deletedAt) return putRaw('tombstones', t);
            return null;
          }));
        });
        return chain;
      })
      .then(function () {
        if (only) {
          /* scoped: only the program categories ride along */
          return only.indexOf('programs') >= 0
            ? mergeMetaKeys(json.stores.meta || [], ['programCats']) : null;
        }
        return mergeMeta(json);
      })
      .then(function () { return only ? null : putRaw('meta', { key: 'lastSyncAt', value: Date.now() }); })
      .then(loadSettings)
      .then(gcMedia)
      .then(function () { return counts; });
  }

  /* ---- Claude share: filtered export for the AI secretary ----
     Sync uploads this as a VISIBLE Drive file (folder Alef.Fit) that the
     user's Claude can read. Only sections switched on in Setting → Share
     with Claude, minus records marked noShare. Data only — no media, no
     raw ids, never notes/alarms. */
  function buildClaudeShare() {
    var s = _settings || {};
    var out = {
      app: 'alef.fit', kind: 'claude-share', shareVersion: 1,
      appVersion: window.APP_VERSION || '0',
      generatedAt: new Date().toISOString(),
      shared: { tasks: s.claudeShareTodo !== false, workout: s.claudeShareWorkout !== false }
    };
    var chain = Promise.resolve();
    if (out.shared.tasks) {
      chain = chain.then(function () {
        return Promise.all([getTodoCats(), all('todos'), byIndex('tags', 'module', 'todo')]);
      }).then(function (r) {
        var catName = {}, tagName = {};
        r[0].forEach(function (c) { catName[c.id] = c.name; });
        r[2].forEach(function (t) { tagName[t.id] = t.name; });
        out.tasks = {
          lists: r[0].map(function (c) { return c.name; }),
          items: r[1].filter(function (t) { return !t.noShare && t.cat !== 'vault' && !t.archived; }).map(function (t) {
            return {
              id: t.id,
              title: t.title, list: catName[t.cat] || t.cat || '', now: !!t.now,
              nowAt: t.nowAt || null, locked: !!t.locked,
              priority: t.prio || 'none', done: !!t.done, note: t.note || '',
              dueDate: t.dueDate || null, time: t.time || null,
              tags: (t.tags || []).map(function (id) { return tagName[id]; }).filter(Boolean),
              subtasks: (t.subs || []).map(function (x) { return { title: x.title, done: !!x.done }; }),
              updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null
            };
          })
        };
      });
    }
    if (out.shared.workout) {
      chain = chain.then(function () {
        return Promise.all([all('programs'), all('logs'), all('exercises'), all('walks')]);
      }).then(function (r) {
        var exName = {}, progName = {}, hidden = {};
        r[2].forEach(function (x) { exName[x.id] = x.name; });
        r[0].forEach(function (p) { if (p.noShare) hidden[p.id] = 1; else progName[p.id] = p.name; });
        out.workout = {
          programs: r[0].filter(function (p) { return !p.noShare; }).map(function (p) {
            return {
              name: p.name, category: p.category, status: p.status || 'reserve',
              days: (p.days || []).map(function (d) {
                return {
                  day: d.dayNo, name: d.name || '',
                  exercises: (d.items || []).map(function (it) {
                    return {
                      exercise: exName[it.exerciseId] || it.exerciseId,
                      targetSets: it.targetSets || null, targetReps: it.targetReps || '',
                      note: it.note || ''
                    };
                  })
                };
              })
            };
          }),
          logs: r[1].filter(function (l) { return !hidden[l.programId]; })
            .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); })
            .map(function (l) {
              return {
                date: l.date, exercise: exName[l.exerciseId] || l.exerciseId,
                program: progName[l.programId] || null, day: l.dayNo || null,
                sets: (l.sets || []).map(function (st) { return { weight: st.weight, reps: st.reps }; }),
                note: l.note || ''
              };
            }),
          inclineWalks: r[3].slice()
            .sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); })
            .map(function (w) { return { date: w.date, incline: w.incline, speed: w.speed, minutes: w.minutes }; })
        };
      });
    }
    return chain.then(function () { return out; });
  }

  /* ---- Vault backup: the ONLY way vault entries leave the device ----
     A plain file the user downloads on the S26 and copies wherever they
     want (e.g. USB drive). Import restores every entry as a NEW,
     date-stamped copy (no merge, no overwrite). */
  function exportVault() {
    return all('todos').then(function (rows) {
      return {
        app: 'alef.fit', kind: 'vault-backup', appVersion: window.APP_VERSION || '0',
        exportedAt: new Date().toISOString(),
        vault: rows.filter(function (r) { return r.cat === 'vault'; })
      };
    });
  }
  function importVault(json) {
    if (!json || json.app !== 'alef.fit' || json.kind !== 'vault-backup' || !Array.isArray(json.vault)) {
      return Promise.reject(new Error('Not an Alef.Fit Vault backup file'));
    }
    /* restore-as-new: every entry gets a fresh id and the backup's date-time
       stamped into its name — never merged, never overwritten; the user
       reviews and removes duplicates by hand */
    var d = json.exportedAt ? new Date(json.exportedAt) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') +
      ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    var counts = { added: 0, stamp: stamp };
    var chain = Promise.resolve();
    json.vault.forEach(function (src) {
      chain = chain.then(function () {
        var inc = JSON.parse(JSON.stringify(src));
        inc.id = uid();
        inc.cat = 'vault';
        inc.now = false;
        inc.title = (inc.title || '(untitled)') + ' (' + stamp + ')';
        inc.updatedAt = Date.now();
        counts.added++;
        return putRaw('todos', inc);
      });
    });
    return chain.then(function () { return counts; });
  }

  /* tasks with a "Now at" time become Now when the clock reaches it */
  function promoteNowDue() {
    if (proposalMode()) return Promise.resolve(0);
    var d = new Date();
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    return all('todos').then(function (rows) {
      var due = rows.filter(function (t) {
        return !t.done && !t.now && t.nowAt && t.nowAt <= hm && t.cat !== 'vault';
      });
      return Promise.all(due.map(function (t) {
        t.now = true;
        t.nowAt = null;
        return put('todos', t);
      })).then(function () { return due.length; });
    });
  }

  /* ---- local To-do backup: tasks (incl. Vault) + lists + tags ---- */
  function exportTodoBackup() {
    /* v0.32: Vault EXCLUDED — the Vault-only backup (exportVault) is the
       one and only way Vault entries leave the device. Older todo-backup
       files that contain vault entries still import fine. */
    return Promise.all([all('todos'), get('meta', 'todoCats'), all('tags')]).then(function (r) {
      return {
        app: 'alef.fit-todo',
        appVersion: window.APP_VERSION || '0',
        exportedAt: new Date().toISOString(),
        todos: r[0].filter(function (t) { return t.cat !== 'vault'; }),
        todoCats: r[1] ? r[1].value : null,
        todoCatsAt: r[1] ? (r[1].updatedAt || 0) : 0,
        tags: r[2].filter(function (t) { return t.module === 'todo'; })
      };
    });
  }

  /* ---- Sync-info backup (v0.32): connection settings only, no data.
     Contains the Google client SECRET — treat the file like a password. */
  var SYNCINFO_KEYS = ['gdriveClientId', 'gdriveClientSecret', 'deviceId',
    'autoSync', 'claudeShareOn', 'claudeShareTodo', 'claudeShareWorkout',
    'claudeInboxOn', 'claudeDirect'];
  function exportSyncInfo() {
    var s = getSettings() || {};
    var out = {
      app: 'alef.fit', kind: 'syncinfo-backup',
      appVersion: window.APP_VERSION || '0',
      exportedAt: new Date().toISOString(),
      note: 'Google Drive connection settings for Alef.Fit. Contains the OAuth client secret — keep this file PRIVATE. Restore: Setting → Import backup file.',
      settings: {}
    };
    SYNCINFO_KEYS.forEach(function (k) { if (s[k] !== undefined) out.settings[k] = s[k]; });
    return Promise.resolve(out);
  }
  function importSyncInfo(json) {
    if (!json || json.app !== 'alef.fit' || json.kind !== 'syncinfo-backup' || !json.settings) {
      return Promise.reject(new Error('Not an Alef.Fit sync-info file'));
    }
    var patch = {};
    SYNCINFO_KEYS.forEach(function (k) { if (json.settings[k] !== undefined) patch[k] = json.settings[k]; });
    return saveSettings(patch).then(function () { return Object.keys(patch).length; });
  }
  function importTodoBackup(json) {
    if (!json || json.app !== 'alef.fit-todo' || !Array.isArray(json.todos)) {
      return Promise.reject(new Error('Not an Alef.Fit To-do backup'));
    }
    var counts = { added: 0, updated: 0, vault: 0 };
    return all('todos').then(function (rows) {
      var loc = {};
      rows.forEach(function (t) { loc[t.id] = t; });
      var chain = Promise.resolve();
      json.todos.forEach(function (inc) {
        chain = chain.then(function () {
          var l = loc[inc.id];
          if (l && (l.updatedAt || 0) >= (inc.updatedAt || 0)) return;
          if (l) counts.updated++; else counts.added++;
          if (inc.cat === 'vault') counts.vault++;
          return putRaw('todos', inc);
        });
      });
      (json.tags || []).forEach(function (tg) {
        chain = chain.then(function () {
          return get('tags', tg.id).then(function (l) {
            if (!l) return putRaw('tags', tg);
          });
        });
      });
      if (json.todoCats) {
        chain = chain.then(function () {
          return get('meta', 'todoCats').then(function (l) {
            if (!l || (json.todoCatsAt || 0) > (l.updatedAt || 0)) {
              return putRaw('meta', { key: 'todoCats', value: json.todoCats, updatedAt: json.todoCatsAt || Date.now() });
            }
          });
        });
      }
      return chain.then(function () { return counts; });
    });
  }

  /* ---- Claude suggestions inbox → proposals (reviewed on the S26) ----
     File written by the Claude secretary (docs/CLAUDE-INBOX.md). Every
     suggestion becomes a normal proposal (by 'Claude', status 'sent');
     nothing touches live data until accepted in the review inbox. */
  var CLAUDE_LISTS = { today: 1, later: 1, never: 1 };
  function importClaudeInbox(json) {
    if (!json || json.app !== 'alef.fit-claude-inbox' || !json.batch || !Array.isArray(json.suggestions)) {
      return Promise.resolve({ imported: 0, skipped: 0, reason: 'not-an-inbox' });
    }
    if ((_settings || {}).claudeInboxOn === false) return Promise.resolve({ imported: 0, skipped: 0, reason: 'off' });
    return get('meta', 'claudeBatchDone').then(function (doneRow) {
      if (doneRow && doneRow.value === json.batch) return { imported: 0, skipped: 0, reason: 'already-processed' };
      var sugg = json.suggestions.slice(0, 20); /* batch cap */
      var counts = { imported: 0, skipped: 0 };
      return Promise.all([all('todos'), byIndex('tags', 'module', 'todo')]).then(function (r) {
        var byId = {};
        r[0].forEach(function (t) { byId[t.id] = t; });
        var tagIdByName = {};
        r[1].forEach(function (tg) { tagIdByName[(tg.name || '').toLowerCase()] = tg.id; });
        var chain = Promise.resolve();
        sugg.forEach(function (sg, i) {
          chain = chain.then(function () {
            var pid = 'c|' + json.batch + '|' + i;
            var why = String(sg.why || '').slice(0, 300);
            function prop(store2, action, data, recId, base) {
              counts.imported++;
              return putRaw('proposals', {
                id: pid, store: store2, recId: recId, action: action, data: data,
                base: base || 0, status: 'sent', why: why,
                proposedAt: Date.now(), updatedAt: Date.now(), by: 'Claude'
              });
            }
            function liveOk(t) {
              return t && !t.locked && !t.noShare && t.cat !== 'vault';
            }
            if (sg.kind === 'add') {
              if (!sg.title) { counts.skipped++; return; }
              var cat = CLAUDE_LISTS[sg.list] ? sg.list : 'later';
              var rec = {
                id: uid(), title: String(sg.title).slice(0, 200), cat: cat,
                now: !!sg.now, nowAt: sg.nowAt || null,
                prio: sg.priority || 'none', note: String(sg.note || '').slice(0, 1000),
                tags: (sg.tags || []).map(function (n) { return tagIdByName[String(n).toLowerCase()]; }).filter(Boolean),
                subs: (sg.subtasks || []).slice(0, 15).map(function (st2) { return { id: uid(), title: String(st2).slice(0, 200), done: false }; }),
                done: false, createdAt: Date.now()
              };
              return prop('todos', 'add', rec, rec.id, 0);
            }
            if (sg.kind === 'alarm') {
              if (!sg.time) { counts.skipped++; return; }
              var al = { id: uid(), label: String(sg.label || sg.title || 'Alarm').slice(0, 100), time: sg.time, days: sg.days || [], enabled: true, createdAt: Date.now() };
              return prop('alarms', 'add', al, al.id, 0);
            }
            var live = byId[sg.id];
            if (!liveOk(live)) { counts.skipped++; return; }
            var copy = JSON.parse(JSON.stringify(live));
            if (sg.kind === 'delete') {
              return prop('todos', 'delete', copy, live.id, live.updatedAt || 0);
            }
            if (sg.kind === 'done') {
              copy.done = true;
              copy.doneAt = Date.now();
            } else if (sg.kind === 'move') {
              if (!CLAUDE_LISTS[sg.to]) { counts.skipped++; return; }
              copy.cat = sg.to;
              if (sg.now != null) copy.now = !!sg.now;
            } else if (sg.kind === 'edit') {
              var set = sg.set || {};
              if (set.title) copy.title = String(set.title).slice(0, 200);
              if (set.note != null) copy.note = String(set.note).slice(0, 1000);
              if (set.priority) copy.prio = set.priority;
              if (set.nowAt !== undefined) copy.nowAt = set.nowAt || null;
              if (set.now != null) copy.now = !!set.now;
            } else if (sg.kind === 'subtasks') {
              copy.subs = (copy.subs || []).concat((sg.add || []).slice(0, 15).map(function (st3) {
                return { id: uid(), title: String(st3).slice(0, 200), done: false };
              }));
            } else {
              counts.skipped++;
              return;
            }
            return prop('todos', 'edit', copy, live.id, live.updatedAt || 0);
          });
        });
        return chain.then(function () {
          return putRaw('meta', { key: 'claudeBatchDone', value: json.batch });
        }).then(function () {
          return putRaw('meta', { key: 'claudeBatchAt', value: Date.now() });
        }).then(function () { return counts; });
      });
    });
  }

  /* ---- Alef.Lucilius direct mode: apply a batch immediately (no review).
     Same hierarchy as an S26 edit (fresh timestamps win everywhere), but
     stamped by 'Claude'. Guards stay: locked / Vault / hidden untouchable,
     one-shot batches, snapshot first so Undo can roll the whole batch back. */
  function applyClaudeDirect(json) {
    if (!json || json.app !== 'alef.fit-claude-inbox' || !json.batch || !Array.isArray(json.suggestions)) {
      return Promise.resolve({ applied: 0, skipped: 0, reason: 'not-an-inbox' });
    }
    if ((_settings || {}).claudeDirect === false) return importClaudeInbox(json); /* revoked → review flow */
    if ((_settings || {}).claudeInboxOn === false) return Promise.resolve({ applied: 0, skipped: 0, reason: 'off' });
    return get('meta', 'claudeBatchDone').then(function (doneRow) {
      if (doneRow && doneRow.value === json.batch) return { applied: 0, skipped: 0, reason: 'already-processed' };
      var sugg = json.suggestions.slice(0, 50);
      var counts = { applied: 0, skipped: 0 };
      return exportAll({ media: 'none' }).then(function (snap) {
        return putRaw('meta', { key: 'undoSnapshot', value: { at: Date.now(), mode: 'claude-direct', data: snap } });
      }).then(function () {
        return Promise.all([all('todos'), byIndex('tags', 'module', 'todo'), getTodoCats()]);
      }).then(function (r) {
        var byId = {};
        r[0].forEach(function (t) { byId[t.id] = t; });
        var tagIdByName = {};
        r[1].forEach(function (tg) { tagIdByName[(tg.name || '').toLowerCase()] = tg.id; });
        var okCat = {};
        r[2].forEach(function (c) { if (c.id !== 'now' && c.id !== 'vault') okCat[c.id] = 1; });
        function stamp(rec) {
          rec.updatedAt = Date.now();
          rec.by = 'Claude';
          return rec;
        }
        var chain = Promise.resolve();
        sugg.forEach(function (sg) {
          chain = chain.then(function () {
            function liveOk(t) { return t && !t.locked && !t.noShare && t.cat !== 'vault'; }
            if (sg.kind === 'add') {
              if (!sg.title) { counts.skipped++; return; }
              var cat = okCat[sg.list] ? sg.list : 'later';
              counts.applied++;
              return putRaw('todos', stamp({
                id: uid(), title: String(sg.title).slice(0, 200), cat: cat,
                now: !!sg.now, nowAt: sg.nowAt || null,
                prio: sg.priority || 'none', note: String(sg.note || '').slice(0, 1000),
                tags: (sg.tags || []).map(function (n) { return tagIdByName[String(n).toLowerCase()]; }).filter(Boolean),
                subs: (sg.subtasks || []).slice(0, 15).map(function (st2) { return { id: uid(), title: String(st2).slice(0, 200), done: false }; }),
                done: false, createdAt: Date.now()
              }));
            }
            if (sg.kind === 'alarm') {
              if (!sg.time) { counts.skipped++; return; }
              counts.applied++;
              return putRaw('alarms', stamp({ id: uid(), label: String(sg.label || sg.title || 'Alarm').slice(0, 100), time: sg.time, days: sg.days || [], enabled: true, createdAt: Date.now() }));
            }
            var live = byId[sg.id];
            if (!liveOk(live)) { counts.skipped++; return; }
            if (sg.kind === 'delete') {
              counts.applied++;
              return putRaw('tombstones', { id: 'todos|' + live.id, store: 'todos', recId: live.id, deletedAt: Date.now(), by: 'Claude' })
                .then(function () { return delRaw('todos', live.id); });
            }
            var copy = JSON.parse(JSON.stringify(live));
            if (sg.kind === 'done') {
              copy.done = true;
              copy.doneAt = Date.now();
            } else if (sg.kind === 'move') {
              if (!okCat[sg.to]) { counts.skipped++; return; }
              copy.cat = sg.to;
              if (sg.now != null) copy.now = !!sg.now;
            } else if (sg.kind === 'edit') {
              var set = sg.set || {};
              if (set.title) copy.title = String(set.title).slice(0, 200);
              if (set.note != null) copy.note = String(set.note).slice(0, 1000);
              if (set.priority) copy.prio = set.priority;
              if (set.nowAt !== undefined) copy.nowAt = set.nowAt || null;
              if (set.now != null) copy.now = !!set.now;
            } else if (sg.kind === 'subtasks') {
              copy.subs = (copy.subs || []).concat((sg.add || []).slice(0, 15).map(function (st3) {
                return { id: uid(), title: String(st3).slice(0, 200), done: false };
              }));
            } else {
              counts.skipped++;
              return;
            }
            counts.applied++;
            byId[copy.id] = copy;
            return putRaw('todos', stamp(copy));
          });
        });
        return chain.then(function () {
          return putRaw('meta', { key: 'claudeBatchDone', value: json.batch });
        }).then(function () {
          return putRaw('meta', { key: 'claudeBatchAt', value: Date.now() });
        }).then(function () {
          if (window.Sync && window.Sync.autoTouch) window.Sync.autoTouch();
          return counts;
        });
      });
    });
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
    claimRole: claimRole, isSuperseded: isSuperseded,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    seedIfEmpty: seedIfEmpty, seedProgramsIfEmpty: seedProgramsIfEmpty, seedTopUp: seedTopUp,
    getTodoCats: getTodoCats, saveTodoCats: saveTodoCats, migrateTodosOnce: migrateTodosOnce,
    mediaUrl: mediaUrl, internMedia: internMedia, internExMedia: internExMedia,
    hydrateExMedia: hydrateExMedia, hydrateNote: hydrateNote, internUrlList: internUrlList,
    migrateMediaStore: migrateMediaStore, gcMedia: gcMedia, mediaIdFor: mediaIdFor,
    exportAll: exportAll, importAll: importAll, undoInfo: undoInfo, undoLastMerge: undoLastMerge,
    buildClaudeShare: buildClaudeShare,
    exportVault: exportVault, importVault: importVault,
    proposalMode: proposalMode, listProposals: listProposals, sendProposals: sendProposals,
    promoteNowDue: promoteNowDue, exportTodoBackup: exportTodoBackup, importTodoBackup: importTodoBackup,
    exportSyncInfo: exportSyncInfo, importSyncInfo: importSyncInfo,
    importClaudeInbox: importClaudeInbox, applyClaudeDirect: applyClaudeDirect,
    applyProposal: applyProposal, propSummary: propSummary,
    storageEstimate: storageEstimate
  };
})();
