/* Alef.Fit — first-run Setup wizard (v0.39, docs/ROLES-SETUP-PLAN.md).
   Shown once on an UNCLAIMED fresh install (no deviceId, setup not done).
   Ladder: 1 import sync info (the identity key) → 2 Google sign-in →
   3 Full Sync → 4 claim a role (S26 main / PC main) → optional Vault
   import for the S26. The tier-1 backup file holds client ID + SECRET +
   toggles — possession of it IS the privilege confirmation. */
'use strict';

window.Screens = window.Screens || {};

Screens.setup = (function () {

  var _syncedNow = false; /* v0.49: a Full Sync finished during this setup */

  function render(el) {
    el.appendChild(UI.header({ title: 'Set up this app' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);

    pad.appendChild(UI.el('<div class="sub" style="margin-bottom:10px">Fresh install. ' +
      'Three steps to reconnect, then choose this app\'s role. Backup files live in ' +
      '<b>S26 › Documents › S26-Alef-Fit</b> (or your Downloads folder).</div>'));

    /* ---- step 1 · import sync info (highlighted) ---- */
    var c1 = UI.el('<div class="card"></div>');
    var b1 = UI.el('<button class="btn btn-primary btn-block su-glow">' + UI.icon('upload') + ' 1 · Import sync info</button>');
    var f1 = UI.el('<input type="file" accept=".json,.AFdd,.zip,application/json,application/zip,application/octet-stream" class="hidden">');
    var s1 = UI.el('<div class="sub" style="margin-top:6px"></div>');
    function paintStep1() {
      var s = DB.getSettings() || {};
      s1.textContent = (s.gdriveClientId && s.gdriveClientSecret)
        ? '✓ Google connection settings loaded' : 'Restores the Google connection settings (any backup file works — the type is detected).';
    }
    b1.addEventListener('click', function () { f1.click(); });
    f1.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        /* v0.52: also reads the disguised .AFdd/.zip Vault files */
        window.VaultKeep.parseBackup(fr.result).then(function (json) {
        var done = function (msg) { UI.toast(msg); paintStep1(); };
        if (json && json.kind === 'syncinfo-backup') {
          DB.importSyncInfo(json).then(function (n) { done('Sync settings restored (' + n + ' values)'); })
            .catch(function (err2) { UI.toast(String(err2.message || err2)); });
        } else if (json && json.kind === 'vault-backup') {
          DB.importVault(json).then(function (c) { done('Vault restored: +' + c.added + ' entries'); })
            .catch(function (err2) { UI.toast(String(err2.message || err2)); });
        } else if (json && json.app === 'alef.fit-todo') {
          DB.importTodoBackup(json).then(function (c) { done('To-dos restored: +' + c.added); })
            .catch(function (err2) { UI.toast(String(err2.message || err2)); });
        } else {
          DB.importAll(json, { mode: 'merge' }).then(function (c) {
            done('Backup merged: +' + c.added + ' / ~' + c.updated);
          }).catch(function (err2) { UI.toast(String(err2.message || err2)); });
        }
        }).catch(function (err) { UI.toast(String(err.message || err)); });
      };
      fr.readAsArrayBuffer(f);
      e.target.value = '';
    });
    paintStep1();
    c1.appendChild(b1); c1.appendChild(f1); c1.appendChild(s1);
    pad.appendChild(c1);

    /* ---- step 2 · Google sign-in ---- */
    var c2 = UI.el('<div class="card"></div>');
    var b2 = UI.el('<button class="btn btn-block">' + UI.icon('upload') + ' 2 · Connect Google (sign-in)</button>');
    var s2 = UI.el('<div class="sub" style="margin-top:6px">One popup; the token is kept so later syncs are silent.</div>');
    DB.get('meta', 'gdriveRefreshToken').then(function (r) {
      if (r && r.value) s2.textContent = '✓ Already connected';
    });
    b2.addEventListener('click', function () {
      if (!Sync.hasClientId()) { UI.toast('Do step 1 first (client ID + secret)'); return; }
      Sync.reconnect().then(function () { s2.textContent = '✓ Connected'; UI.toast('Google connected'); })
        .catch(function (err) { UI.toast(String(err.message || err)); });
    });
    c2.appendChild(b2); c2.appendChild(s2);
    pad.appendChild(c2);

    /* ---- step 3 · Full Sync ---- */
    var c3 = UI.el('<div class="card"></div>');
    var b3 = UI.el('<button class="btn btn-block">' + UI.icon('upload') + ' 3 · Full Sync — pull everything</button>');
    var s3 = UI.el('<div class="sub" style="margin-top:6px">Brings all data from your Drive to this app.</div>');
    b3.addEventListener('click', function () {
      if (!Sync.hasClientId()) { UI.toast('Do step 1 first'); return; }
      b3.disabled = true;
      Sync.syncNow(function (msg) { s3.textContent = msg || '…'; })
        .then(function (res) {
          b3.disabled = false;
          _syncedNow = true; /* v0.49: unlocks step 4 — claim AFTER the data is here */
          var p = res.pulled || { added: 0, updated: 0 };
          s3.textContent = '✓ Synced: +' + p.added + ' / ~' + p.updated + ' · media ↓' + res.mediaDown;
        })
        .catch(function (err) { b3.disabled = false; s3.textContent = String(err.message || err); });
    });
    c3.appendChild(b3); c3.appendChild(s3);
    pad.appendChild(c3);

    /* ---- step 4 · role ---- */
    pad.appendChild(UI.el('<div class="section-title">4 · Who is this app?</div>'));
    var c4 = UI.el('<div class="card"></div>');
    var bS = UI.el('<button class="btn btn-primary btn-block" style="margin-bottom:8px">This is the S26 — main phone</button>');
    var bP = UI.el('<button class="btn btn-block" style="margin-bottom:8px">This is the PC — main workstation</button>');
    c4.appendChild(UI.el('<div class="sub" style="margin-bottom:8px">S26: Vault, Claude share writer, real alarms. ' +
      'PC: development seat — edits travel as proposals. Claiming a role RETIRES any older install of the same role ' +
      '(it stops sharing/alarming; its data stays). <b>Finish 3 · Full Sync first</b> — the claim unlocks after your data has arrived.</div>'));
    function reallyClaim(role) {
      UI.confirm('Make THIS app the main ' + role + '? An older ' + role + ' install will retire on its next sync.', 'Claim ' + role)
        .then(function (ok) {
          if (!ok) return;
          DB.claimRole(role).then(function () {
            UI.toast('This app is now the main ' + role);
            if (role === 'S26') { vaultCard.classList.remove('hidden'); doneBtn.classList.remove('hidden'); }
            else { location.hash = '#/discipline/todo'; }
          });
        });
    }
    /* v0.49: claiming a role BEFORE the data has synced made a fresh, empty
       install the main writer. The claim now requires a finished Full Sync
       (this session, or an earlier one on this install). Only when NO Google
       connection exists at all (a true from-scratch start) may the user
       claim after an explicit extra warning. */
    function claim(role) {
      DB.get('meta', 'lastSyncAt').then(function (r) {
        if (_syncedNow || (r && r.value)) { reallyClaim(role); return; }
        if (Sync.hasClientId()) {
          UI.toast('Run 3 · Full Sync first — claim the role after your data has arrived');
          return;
        }
        UI.confirm('No Google sync is set up and nothing has been pulled. Claim ' + role +
          ' main with ONLY the data currently on this device? (For a new phone: do steps 1–3 first.)', 'Claim anyway')
          .then(function (ok) { if (ok) reallyClaim(role); });
      });
    }
    bS.addEventListener('click', function () { claim('S26'); });
    bP.addEventListener('click', function () { claim('PC'); });
    c4.appendChild(bS); c4.appendChild(bP);
    var skip = UI.el('<button class="btn btn-block" style="margin-top:2px">Skip setup for now</button>');
    skip.addEventListener('click', function () {
      DB.saveSettings({ setupDone: true }).then(function () { location.hash = '#/discipline/todo'; });
    });
    c4.appendChild(skip);
    pad.appendChild(c4);

    /* ---- optional (S26): Vault backup + done ---- */
    var vaultCard = UI.el('<div class="card hidden"></div>');
    var bV = UI.el('<button class="btn btn-block" style="margin-bottom:6px">' + UI.icon('upload') + ' Import Vault backup (optional, .AFdd / .zip / .json)</button>');
    var fV = UI.el('<input type="file" accept=".json,.AFdd,.zip,application/json,application/zip,application/octet-stream" class="hidden">');
    bV.addEventListener('click', function () { fV.click(); });
    fV.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        window.VaultKeep.parseBackup(fr.result).then(function (json) {
          return DB.importVault(json).then(function (c) { UI.toast('Vault restored: +' + c.added + ' entries'); });
        }).catch(function (err2) { UI.toast(String(err2.message || err2)); });
      };
      fr.readAsArrayBuffer(f);
      e.target.value = '';
    });
    vaultCard.appendChild(UI.el('<div class="sub" style="margin-bottom:6px">The Vault never rides the cloud — restore it from its own file if you have one.</div>'));
    vaultCard.appendChild(bV); vaultCard.appendChild(fV);
    pad.appendChild(vaultCard);
    var doneBtn = UI.el('<button class="btn btn-primary btn-block hidden" style="margin-top:4px">Done — open Alef.do</button>');
    doneBtn.addEventListener('click', function () { location.hash = '#/discipline/todo'; });
    pad.appendChild(doneBtn);
  }

  return { render: render };
})();
