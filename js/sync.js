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
  var API = 'https://www.googleapis.com/drive/v3/';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3/';
  var SYNC_NAME = 'alef-sync.json';
  var _token = null, _tokenExp = 0;

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

  function interactiveCode() {
    var c = creds();
    return loadGis().then(function () {
      return new Promise(function (resolve, reject) {
        var cc = window.google.accounts.oauth2.initCodeClient({
          client_id: c.id,
          scope: SCOPE,
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
      }).catch(function () {
        /* refresh token revoked/expired → one interactive round */
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

  function uploadJson(name, existingId, obj) {
    var meta = existingId ? {} : { name: name, parents: ['appDataFolder'] };
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

  function syncNow(onStatus) {
    var say = onStatus || function () {};
    var result = { pulled: null, mediaUp: 0, mediaDown: 0, mediaTrimmed: 0 };
    var fileId = null;
    var remoteMap = {};
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
        if (remote) {
          say('Merging…');
          return DB.importAll(remote, { mode: 'merge' }).then(function (c) { result.pulled = c; });
        }
      })
      .then(function () { say('Uploading data…'); return DB.exportAll({ media: 'none' }); })
      .then(function (data) { return uploadJson(SYNC_NAME, fileId, data); })
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
      .then(function () { return DB.putRaw('meta', { key: 'lastDriveSyncAt', value: Date.now() }); })
      .then(function () { say(''); return result; });
  }

  return {
    syncNow: syncNow,
    hasClientId: function () { var s = DB.getSettings() || {}; return !!(s.gdriveClientId && s.gdriveClientSecret); }
  };
})();
