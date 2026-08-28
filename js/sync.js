/* Alef.Fit — Google Drive sync (hidden appDataFolder).
   Flow per "Sync now": pull remote alef-sync.json → merge into local DB
   (LWW + tombstones) → push merged data back → exchange media blobs by
   content hash (upload missing there, download missing here) → trim remote
   blobs nothing references anymore.
   Needs a Google OAuth client id (Setting → Sync); loads Google's sign-in
   script only when the user taps Sync — the rest of the app stays offline. */
'use strict';

window.Sync = (function () {
  var SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  var SCOPE_FILE = 'https://www.googleapis.com/auth/drive.file';
  var SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive'; /* v0.44: Fitness Motivation folder (user's own files) */
  /* v0.55: the v0.53 calendar.events scope was dropped with the Schedules
     section — the app never touches Google Calendar again. */
  /* the Claude share file is visible → needs drive.file too; only ask when on */
  function scopes() {
    var st = DB.getSettings() || {};
    return SCOPE + (st.claudeShareOn ? ' ' + SCOPE_FILE : '') + ' ' + SCOPE_DRIVE;
  }
  var API = 'https://www.googleapis.com/drive/v3/';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3/';
  var SYNC_NAME = 'alef-sync.json';
  var _token = null, _tokenExp = 0;
  var _busy = false, _touchTimer = null, _autoBound = false;

  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load Google sign-in — are you online?')); };
      document.head.appendChild(s);
    });
  }

  /* Auth = authorization-code flow (Google blocks the old implicit/token
     flow for OAuth clients created after 2025). First sync opens a Google
     popup once; the refresh token is kept locally so later syncs are
     silent. Needs client ID + client secret from the Cloud Console. */
  /* v0.49: hard offline guard. In airplane mode the refresh-token POST
     fails as a NETWORK error, which used to fall through to an interactive
     sign-in — an endless credentials popup while offline. Now: no network →
     one clear error, never a popup. */
  function isOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }
  var OFFLINE_MSG = 'No internet connection — sync will resume when you are back online';

  function creds() {
    var st = DB.getSettings() || {};
    return { id: (st.gdriveClientId || '').trim(), secret: (st.gdriveClientSecret || '').trim() };
  }

  function tokenPost(params) {
    return fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: Object.keys(params).map(function (k) {
        return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
      }).join('&')
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error('Google token error: ' + (j.error_description || j.error || r.status));
        return j;
      });
    });
  }

  var REDIRECT_NATIVE = 'https://aialef.github.io/Alef-Fit/oauth.html';

  function storeTok(tok) {
    _token = tok.access_token;
    _tokenExp = Date.now() + (tok.expires_in || 3600) * 1000;
    if (tok.refresh_token) {
      return DB.putRaw('meta', { key: 'gdriveRefreshToken', value: tok.refresh_token })
        .then(function () { return _token; });
    }
    return _token;
  }

  /* APK path: Google refuses OAuth inside WebViews — open the system
     browser, land on oauth.html (shows the code), user pastes it back. */
  function nativeInteractive() {
    var c = creds();
    var url = 'https://accounts.google.com/o/oauth2/v2/auth' +
      '?client_id=' + encodeURIComponent(c.id) +
      '&redirect_uri=' + encodeURIComponent(REDIRECT_NATIVE) +
      '&response_type=code&access_type=offline&prompt=consent' +
      '&scope=' + encodeURIComponent(scopes());
    var opener = (window.Native && window.Native.openExternal)
      ? window.Native.openExternal(url)
      : Promise.resolve(false);
    return opener.then(function () {
      return new Promise(function (resolve, reject) {
        var body = UI.el('<div><p class="sub">Google opened in your browser. Approve access there — it will show a CODE. Copy it and paste here:</p>' +
          UI.field('Code from Google', '<input type="text" id="oa-code" autocomplete="off" autocapitalize="off">') + '</div>');
        UI.modal('Google sign-in', body, [
          { label: 'Cancel', onClick: function (close) { close(); reject(new Error('Sign-in cancelled')); } },
          {
            label: 'Connect', primary: true, onClick: function (close) {
              var v = body.querySelector('#oa-code').value.trim();
              if (!v) return;
              close();
              resolve(v);
            }
          }
        ]);
      });
    }).then(function (code) {
      return tokenPost({
        code: code, client_id: c.id, client_secret: c.secret,
        redirect_uri: REDIRECT_NATIVE, grant_type: 'authorization_code'
      });
    }).then(storeTok);
  }

  function interactiveCode() {
    if (isOffline()) return Promise.reject(new Error(OFFLINE_MSG)); /* v0.49: never pop sign-in while offline */
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return nativeInteractive();
    }
    var c = creds();
    return loadGis().then(function () {
      return new Promise(function (resolve, reject) {
        var cc = window.google.accounts.oauth2.initCodeClient({
          client_id: c.id,
          scope: scopes(),
          ux_mode: 'popup',
          callback: function (resp) {
            if (resp && resp.code) resolve(resp.code);
            else reject(new Error('Google sign-in was cancelled'));
          },
          error_callback: function (e) {
            reject(new Error('Google sign-in failed' + (e && e.type ? ': ' + e.type : '')));
          }
        });
        cc.requestCode();
      });
    }).then(function (code) {
      return tokenPost({
        code: code, client_id: c.id, client_secret: c.secret,
        redirect_uri: 'postmessage', grant_type: 'authorization_code'
      });
    }).then(function (tok) {
      _token = tok.access_token;
      _tokenExp = Date.now() + (tok.expires_in || 3600) * 1000;
      if (tok.refresh_token) {
        return DB.putRaw('meta', { key: 'gdriveRefreshToken', value: tok.refresh_token })
          .then(function () { return _token; });
      }
      return _token;
    });
  }

  function getToken() {
    if (_token && Date.now() < _tokenExp - 60000) return Promise.resolve(_token);
    if (isOffline()) return Promise.reject(new Error(OFFLINE_MSG)); /* v0.49 */
    var c = creds();
    if (!c.id || !c.secret) return Promise.reject(new Error('Set the Google client ID and secret in Setting → Google Drive sync'));
    return DB.get('meta', 'gdriveRefreshToken').then(function (row) {
      if (!row || !row.value) return interactiveCode();
      return tokenPost({
        client_id: c.id, client_secret: c.secret,
        refresh_token: row.value, grant_type: 'refresh_token'
      }).then(function (tok) {
        _token = tok.access_token;
        _tokenExp = Date.now() + (tok.expires_in || 3600) * 1000;
        return _token;
      }).catch(function (err) {
        /* v0.49: only a REAL rejection from Google (revoked/expired token —
           "Google token error: …") may open the sign-in. A network failure
           (offline, DNS, captive portal) surfaces as a plain error. */
        var m = String(err && err.message || err);
        if (isOffline() || m.indexOf('Google token error') !== 0) {
          throw new Error(OFFLINE_MSG);
        }
        return interactiveCode();
      });
    });
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Authorization: 'Bearer ' + _token }, opts.headers || {});
    return fetch((opts.upload ? UPLOAD : API) + path, opts).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          throw new Error('Drive error ' + r.status + ': ' + t.slice(0, 180));
        });
      }
      return opts.raw ? r : r.json();
    });
  }

  function findFile(name) {
    return api('files?spaces=appDataFolder&q=' + encodeURIComponent("name='" + name + "'") +
      '&fields=files(id,name,modifiedTime)&pageSize=1').then(function (r) {
      return (r.files || [])[0] || null;
    });
  }

  function download(id) {
    return api('files/' + id + '?alt=media', { raw: true }).then(function (r) { return r.json(); });
  }

  function uploadJson(name, existingId, obj, parent) {
    var meta = existingId ? {} : { name: name, parents: [parent || 'appDataFolder'] };
    var boundary = 'alefb' + Date.now().toString(36);
    var payload = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n' +
      JSON.stringify(obj) + '\r\n--' + boundary + '--';
    return api('files' + (existingId ? '/' + existingId : '') + '?uploadType=multipart', {
      method: existingId ? 'PATCH' : 'POST',
      upload: true,
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body: payload
    });
  }

  function listMedia() {
    var out = [];
    function page(tok) {
      return api('files?spaces=appDataFolder&q=' + encodeURIComponent("name contains 'media-'") +
        '&fields=nextPageToken,files(id,name)&pageSize=1000' + (tok ? '&pageToken=' + tok : ''))
        .then(function (r) {
          out = out.concat(r.files || []);
          return r.nextPageToken ? page(r.nextPageToken) : out;
        });
    }
    return page(null);
  }

  /* ---- Claude share: visible Drive copy for the AI secretary ----
     Folder "Alef.Fit" in My Drive, file alef-fit-claude-share.json —
     filtered data only (DB.buildClaudeShare), created/updated after each
     sync while Setting → Share with Claude is on. With drive.file scope
     the app only ever sees files it created itself. */
  var SHARE_FOLDER = 'Alef.Fit';
  var SHARE_NAME = 'alef-fit-claude-share.json';
  var INBOX_NAME = 'alef-fit-claude-inbox.json';

  function findVisible(q) {
    return api('files?q=' + encodeURIComponent(q + ' and trashed=false') +
      '&fields=files(id,name)&pageSize=1').then(function (r) {
      return (r.files || [])[0] || null;
    });
  }

  function ensureShareFolder() {
    return findVisible("name='" + SHARE_FOLDER + "' and mimeType='application/vnd.google-apps.folder'")
      .then(function (f) {
        if (f) return f;
        return api('files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: SHARE_FOLDER, mimeType: 'application/vnd.google-apps.folder' })
        });
      })
      .then(function (f) { return f.id; });
  }

  function uploadShare(folderId) {
    _shareDirty = false; /* edits made during the upload re-dirty it */
    return findVisible("name='" + SHARE_NAME + "' and '" + folderId + "' in parents")
      .then(function (f) {
        return DB.buildClaudeShare().then(function (data) {
          return uploadJson(SHARE_NAME, f ? f.id : null, data, folderId);
        });
      })
      .then(function () { return DB.putRaw('meta', { key: 'claudeShareAt', value: Date.now() }); })
      .then(function () { return DB.putRaw('meta', { key: 'claudeShareErr', value: '' }); });
  }

  /* Claude suggestions inbox: app-created so the app may read it; Claude
     UPDATES this file with suggestion batches. Read + convert/apply, then
     acknowledge so a batch imports only once. Resolves to the handler's
     counts ({applied,imported,skipped}) or null when there was nothing. */
  function processInbox(folderId) {
    if ((DB.getSettings() || {}).claudeInboxOn === false) return Promise.resolve(null);
    return findVisible("name='" + INBOX_NAME + "' and '" + folderId + "' in parents")
      .then(function (f) {
        if (!f) {
          return uploadJson(INBOX_NAME, null, {
            app: 'alef.fit-claude-inbox',
            note: 'Claude secretary: write suggestion batches here (docs/CLAUDE-INBOX.md). The app converts them to review-inbox proposals and then clears this file.',
            batch: null, suggestions: []
          }, folderId).then(function () { return null; });
        }
        return download(f.id).then(function (json) {
          if (!json || !json.batch || !(json.suggestions || []).length) return null;
          var handler = json.mode === 'direct' ? DB.applyClaudeDirect : DB.importClaudeInbox;
          return handler(json).then(function (c) {
            var didWork = c && ((c.imported || 0) + (c.applied || 0) > 0 || c.reason === 'already-processed');
            if (!didWork) return c || null;
            return uploadJson(INBOX_NAME, f.id, {
              app: 'alef.fit-claude-inbox',
              note: 'Processed. Write the next batch as a fresh object with a new "batch" id.',
              processedBatch: json.batch, processedAt: new Date().toISOString(),
              mode: json.mode === 'direct' ? 'direct' : 'review',
              applied: c.applied || 0, imported: c.imported || 0, skipped: c.skipped || 0,
              batch: null, suggestions: []
            }, folderId).then(function () { return c; });
          });
        }).catch(function () { return null; /* unreadable inbox — next sync retries */ });
      });
  }

  function pushClaudeShare() {
    /* v0.39: a superseded (retired) install must never write the share
       or ack the inbox — the new main owns those. */
    if (DB.isSuperseded && DB.isSuperseded()) return Promise.resolve(null);
    /* v0.31: inbox FIRST, share second — the uploaded share then already
       includes whatever Claude's batch just changed (no stale window). */
    return ensureShareFolder().then(function (folderId) {
      return processInbox(folderId).then(function () { return uploadShare(folderId); });
    });
  }

  /* ---- v0.31 instant sync (docs/LUCILIUS-INTEROP-PLAN.md Part D) ---- */
  var _rtBusy = false, _lastRT = 0;
  var _shareDirty = false, _fastTimer = null, _lastInput = 0;
  var IDLE_MS = 7000;   /* fast share fires after 7 s without any input */

  /* One round-trip: pull + apply Claude's pending batch, then push a fresh
     share. Used by the Alef.do header button (interactive) and pull-on-open
     (silent). Resolves to a status object — callers decide what to show. */
  function claudeRoundTrip(opts) {
    opts = opts || {};
    var st = DB.getSettings() || {};
    if (DB.isSuperseded && DB.isSuperseded()) return Promise.resolve({ retired: true });
    if (!st.claudeShareOn) return Promise.resolve({ off: true });
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve({ offline: true });
    if (_busy || _rtBusy) return Promise.resolve({ busy: true });
    if (Date.now() - _lastRT < (opts.minGap || 10000)) return Promise.resolve({ fresh: true });
    var pre = opts.interactive
      ? getToken()
      : canAuto().then(function (ok) { return ok ? getToken() : Promise.reject({ quiet: true }); });
    _rtBusy = true;
    var counts = null;
    return pre
      .then(function () { return ensureShareFolder(); })
      .then(function (folderId) {
        return processInbox(folderId).then(function (c) { counts = c; return uploadShare(folderId); });
      })
      .then(function () {
        _rtBusy = false;
        _lastRT = Date.now();
        return { ok: true, applied: (counts && counts.applied) || 0,
                 imported: (counts && counts.imported) || 0,
                 skipped: (counts && counts.skipped) || 0 };
      })
      .catch(function (e) {
        _rtBusy = false;
        if (e && e.quiet) return null;   /* silent path had no stored auth */
        throw e;
      });
  }

  /* Pull-on-open: silent + throttled (once per 2 min). Never prompts. */
  function claudeAutoRefresh() {
    return claudeRoundTrip({ minGap: 120000 }).catch(function () { return null; });
  }

  /* Fast share: after an edit, wait until Alef is idle (no touch/typing
     for 7 s), then push just the Claude share — cheap single-file upload. */
  function armFastShare() {
    if (_fastTimer) clearTimeout(_fastTimer);
    var wait = Math.max(600, IDLE_MS - (Date.now() - _lastInput));
    _fastTimer = setTimeout(function () {
      _fastTimer = null;
      if (!_shareDirty) return;
      if (Date.now() - _lastInput < IDLE_MS) { armFastShare(); return; }  /* still busy typing */
      fastSharePush();
    }, wait);
  }

  function fastSharePush() {
    var st = DB.getSettings() || {};
    if (DB.isSuperseded && DB.isSuperseded()) { _shareDirty = false; return; }
    if (!st.claudeShareOn) { _shareDirty = false; return; }
    if (_busy || _rtBusy) { armFastShare(); return; }   /* a sync is running — retry after */
    canAuto().then(function (ok) {
      if (!ok) return;   /* offline or no silent auth — the 45 s sync catches it */
      return getToken()
        .then(function () { return ensureShareFolder(); })
        .then(uploadShare)
        .catch(function () { /* stays dirty; a later push retries */ });
    });
  }

  function canAuto() {
    var st = DB.getSettings() || {};
    if (st.autoSync === false) return Promise.resolve(false);
    if (!(st.gdriveClientId && st.gdriveClientSecret)) return Promise.resolve(false);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(false);
    /* silent only — never pop a Google window from an auto trigger */
    return DB.get('meta', 'gdriveRefreshToken').then(function (r) { return !!(r && r.value); });
  }

  function silentSync() {
    if (_busy) return Promise.resolve(null);
    return canAuto().then(function (okA) {
      if (!okA) return null;
      return syncNow(function () {}).catch(function () { return null; });
    });
  }

  /* an edit happened → fast share once idle 7 s (v0.31) + full quiet sync
     after the usual 45 s pause */
  function autoTouch() {
    var st = DB.getSettings() || {};
    if (st.autoSync === false) return;
    if (st.claudeShareOn) {
      _shareDirty = true;
      _lastInput = Date.now();   /* the edit itself counts as input */
      armFastShare();
    }
    if (_touchTimer) clearTimeout(_touchTimer);
    _touchTimer = setTimeout(function () {
      _touchTimer = null;
      silentSync();
    }, 45000);
  }

  function autoInit() {
    if (_autoBound) return;
    _autoBound = true;
    setTimeout(silentSync, 2500); /* on launch */
    if (typeof document !== 'undefined' && document.addEventListener) {
      /* idle detector for the fast share — any touch/typing restarts the 7 s clock */
      ['pointerdown', 'keydown', 'input'].forEach(function (ev) {
        document.addEventListener(ev, function () { _lastInput = Date.now(); }, true);
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          DB.get('meta', 'lastDriveSyncAt').then(function (r) {
            if (!r || Date.now() - r.value > 120000) silentSync();
          });
          /* back on Alef.do → quietly pick up anything Claude left (D2) */
          if (location.hash === '#/discipline/todo') {
            claudeAutoRefresh().then(function (r) {
              if (r && ((r.applied || 0) + (r.imported || 0) > 0) &&
                  location.hash === '#/discipline/todo' && window.App) App.route();
            });
          }
        } else if (document.visibilityState === 'hidden') {
          if (_fastTimer) { clearTimeout(_fastTimer); _fastTimer = null; }
          if (_touchTimer) {
            clearTimeout(_touchTimer);
            _touchTimer = null;
            silentSync(); /* push before leaving (includes the Claude share) */
          } else if (_shareDirty) {
            fastSharePush(); /* only the share was pending — push it now */
          }
        }
      });
    }
  }

  /* v0.36 "Sync Workout": scope limited to the training content */
  var WORKOUT_STORES = ['exercises', 'programs', 'logs'];

  function syncNow(onStatus, scope) {
    if (_busy) return Promise.reject(new Error('Sync already running'));
    _busy = true;
    var workout = scope === 'workout';
    var say = onStatus || function () {};
    var result = { pulled: null, mediaUp: 0, mediaDown: 0, mediaTrimmed: 0, share: null };
    var fileId = null;
    var remoteMap = {};
    var remoteData = null;
    say('Connecting to Google…');
    return getToken()
      .then(function () { say('Checking Drive…'); return findFile(SYNC_NAME); })
      .then(function (f) {
        if (!f) return null;
        fileId = f.id;
        say('Downloading sync data…');
        return download(f.id);
      })
      .then(function (remote) {
        remoteData = remote || null;
        if (remote) {
          say('Merging…');
          return DB.importAll(remote, { mode: 'merge', only: workout ? WORKOUT_STORES : null })
            .then(function (c) { result.pulled = c; });
        }
      })
      .then(function () { say('Uploading data…'); return DB.exportAll({ media: 'none' }); })
      .then(function (data) {
        if (workout && remoteData) {
          /* patch ONLY the workout parts into the remote file — never
             clobber the other device's newer to-dos/notes/settings */
          WORKOUT_STORES.forEach(function (s) { remoteData.stores[s] = data.stores[s] || []; });
          var tomb = {};
          (remoteData.stores.tombstones || []).forEach(function (t) { tomb[t.id] = t; });
          (data.stores.tombstones || []).forEach(function (t) {
            if (WORKOUT_STORES.indexOf(t.store) < 0) return;
            var r = tomb[t.id];
            if (!r || (t.deletedAt || 0) > (r.deletedAt || 0)) tomb[t.id] = t;
          });
          remoteData.stores.tombstones = Object.keys(tomb).map(function (k) { return tomb[k]; });
          var locPC = (data.stores.meta || []).find(function (r) { return r.key === 'programCats'; });
          if (locPC) {
            remoteData.stores.meta = (remoteData.stores.meta || [])
              .filter(function (r) { return r.key !== 'programCats'; }).concat([locPC]);
          }
          remoteData.mediaIndex = data.mediaIndex;
          remoteData.exportedAt = data.exportedAt;
          data = remoteData;
        }
        return uploadJson(SYNC_NAME, fileId, data);
      })
      .then(function () { say('Comparing media…'); return Promise.all([listMedia(), DB.all('media')]); })
      .then(function (r) {
        r[0].forEach(function (f) { remoteMap[f.name.slice(6)] = f.id; });
        var local = {};
        r[1].forEach(function (m) { local[m.id] = m; });
        var chain = Promise.resolve();
        Object.keys(local).forEach(function (id) {
          if (remoteMap[id]) return;
          chain = chain.then(function () {
            result.mediaUp++;
            say('Uploading media ' + result.mediaUp + '…');
            var m = local[id];
            return uploadJson('media-' + id, null, { id: m.id, type: m.type, dataUrl: m.dataUrl, createdAt: m.createdAt });
          });
        });
        Object.keys(remoteMap).forEach(function (id) {
          if (local[id]) return;
          chain = chain.then(function () {
            result.mediaDown++;
            say('Downloading media ' + result.mediaDown + '…');
            return download(remoteMap[id]).then(function (m) { return DB.putRaw('media', m); });
          });
        });
        return chain;
      })
      .then(function () { return DB.gcMedia(); })
      .then(function () { return DB.all('media'); })
      .then(function (rows) {
        /* trim remote blobs nothing references after the merge */
        var keep = {};
        rows.forEach(function (m) { keep[m.id] = 1; });
        var chain = Promise.resolve();
        Object.keys(remoteMap).forEach(function (id) {
          if (keep[id]) return;
          chain = chain.then(function () {
            result.mediaTrimmed++;
            return api('files/' + remoteMap[id], { method: 'DELETE', raw: true });
          });
        });
        return chain;
      })
      .then(function () {
        /* Claude share file — never fails the sync; errors surface in Setting */
        var st = DB.getSettings() || {};
        if (!st.claudeShareOn) return;
        say('Updating Claude share…');
        result.share = 'ok';
        return pushClaudeShare().catch(function (e) {
          result.share = String(e.message || e);
          return DB.putRaw('meta', { key: 'claudeShareErr', value: result.share });
        });
      })
      .then(function () { return DB.putRaw('meta', { key: 'lastDriveSyncAt', value: Date.now() }); })
      .then(function () { say(''); _busy = false; return result; })
      .catch(function (e) { _busy = false; throw e; });
  }

  /* ---- v0.44: Fitness Motivation — video clips in the user's own Drive
     folder. Needs the full drive scope (SCOPE_DRIVE); tokens granted before
     v0.44 lack it → callers show a "Reconnect Google" hint on 403. ---- */
  var MOTIV_DEFAULT_FOLDER = '1KfNiyo6D_49zUFxudMXv6hKiqgUVt6jC';
  var AESTH_DEFAULT_FOLDER = '1mZgP--GYrWuX7OvpoKDK38AbPzV4CZsC'; /* v0.47: Aesthetic Collection (images) */
  function extractFolderId(v) {
    var m = String(v).match(/folders\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : String(v);
  }
  function motivFolderId() {
    var s = DB.getSettings() || {};
    return extractFolderId(s.motivFolder || MOTIV_DEFAULT_FOLDER);
  }
  function aesthFolderId() {
    var s = DB.getSettings() || {};
    return extractFolderId(s.aesthFolder || AESTH_DEFAULT_FOLDER);
  }
  function motivList(folderId, mimePrefix) {
    var fid = folderId || motivFolderId();
    var mp = mimePrefix || 'video/';
    return getToken().then(function () {
      return api('files?q=' + encodeURIComponent("'" + fid + "' in parents and trashed=false and mimeType contains '" + mp + "'") +
        '&fields=files(id,name,mimeType,size,thumbnailLink,modifiedTime)&pageSize=200&orderBy=name');
    }).then(function (r) { return r.files || []; });
  }
  function motivPatch(id, body) {
    return getToken().then(function () {
      return api('files/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    });
  }
  function motivBlob(id) {
    return getToken().then(function () {
      return api('files/' + id + '?alt=media', { raw: true });
    }).then(function (r) { return r.blob(); });
  }
  /* v0.49: upload a NEW file (added from the phone gallery) into the
     collection's Drive folder — multipart/related with the raw bytes. */
  function motivUpload(name, mime, buf, folderId) {
    var boundary = 'alefb' + Date.now().toString(36);
    var head = '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: name, parents: [folderId] }) +
      '\r\n--' + boundary + '\r\nContent-Type: ' + (mime || 'application/octet-stream') + '\r\n\r\n';
    var tail = '\r\n--' + boundary + '--';
    var body;
    try { body = new Blob([head, buf, tail]); }
    catch (e) { body = head + tail; /* jsdom only — real browsers take the Blob */ }
    return getToken().then(function () {
      return api('files?uploadType=multipart&fields=id,name,mimeType,thumbnailLink', {
        method: 'POST', upload: true,
        headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
        body: body
      });
    });
  }

  function motivThumb(url) {
    if (!url) return Promise.resolve(null);
    return getToken().then(function () {
      return fetch(url, { headers: { Authorization: 'Bearer ' + _token } });
    }).then(function (r) { return r && r.ok ? r.blob() : null; }).then(function (b) {
      if (!b) return null;
      return new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { resolve(null); };
        fr.readAsDataURL(b);
      });
    }).catch(function () { return null; });
  }

  /* (v0.53 Schedules calendar API removed in v0.55 — AwesomeCalendar
     owns the work calendar; the app never calls Google Calendar.) */

  return {
    syncNow: syncNow, autoInit: autoInit, autoTouch: autoTouch,
    /* v0.31 instant sync: header button + pull-on-open (Part D) */
    claudeRoundTrip: claudeRoundTrip, claudeAutoRefresh: claudeAutoRefresh,
    /* v0.44 Fitness Motivation + v0.47 Aesthetic Collection (Drive folders) */
    motivList: motivList, motivPatch: motivPatch, motivBlob: motivBlob,
    motivThumb: motivThumb, motivUpload: motivUpload,
    motivFolderId: motivFolderId, aesthFolderId: aesthFolderId,
    /* fresh consent popup — used when enabling Claude share (adds drive.file) */
    reconnect: function () { _token = null; return interactiveCode(); },
    hasClientId: function () { var s = DB.getSettings() || {}; return !!(s.gdriveClientId && s.gdriveClientSecret); }
  };
})();
