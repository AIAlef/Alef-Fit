/* Alef.Fit — Setting tab: appearance, alerts, folders/tags, card backgrounds,
   image quality, backup, about. */
'use strict';

window.Screens = window.Screens || {};

Screens.setting = (function () {

  function render(el, parts) {
    if (parts[0] === 'folders') return renderFolderTags(el, parts[1]);
    if (parts[0] === 'cardbg') return renderCardBg(el);
    renderHome(el);
  }

  function renderHome(el) {
    el.appendChild(UI.header({ title: 'Setting' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var s = DB.getSettings();

    /* ---- appearance ---- */
    pad.appendChild(UI.el('<div class="section-title">Appearance</div>'));
    var ap = UI.el('<div class="card"></div>');
    ap.appendChild(UI.el(UI.field('Theme',
      '<select id="st-theme">' +
      ['system', 'light', 'dark'].map(function (t) {
        return '<option value="' + t + '"' + (s.theme === t ? ' selected' : '') + '>' +
          { system: 'Follow phone setting', light: 'Light', dark: 'Dark' }[t] + '</option>';
      }).join('') + '</select>')));
    ap.querySelector('#st-theme').addEventListener('change', function (e) {
      DB.saveSettings({ theme: e.target.value }).then(App.applySettings);
    });

    ap.appendChild(UI.el(UI.field('Background theme',
      '<select id="st-bgtheme">' +
      [['carbon', 'Carbon'], ['steel', 'Steel'], ['midnight', 'Midnight'], ['ember', 'Ember'], ['forest', 'Forest'], ['none', 'None (plain)']].map(function (o) {
        return '<option value="' + o[0] + '"' + ((s.bgTheme || 'carbon') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>')));
    ap.querySelector('#st-bgtheme').addEventListener('change', function (e) {
      DB.saveSettings({ bgTheme: e.target.value }).then(App.applySettings);
    });

    ap.appendChild(UI.el(UI.field('Accent theme color',
      '<select id="st-ctheme">' +
      [['classic', 'Classic Blue (current)'], ['steel', 'Steel Gray'], ['indigo', 'Indigo'], ['ember', 'Ember Orange'], ['forest', 'Forest Green']].map(function (o) {
        return '<option value="' + o[0] + '"' + ((s.colorTheme || 'classic') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>')));
    ap.querySelector('#st-ctheme').addEventListener('change', function (e) {
      DB.saveSettings({ colorTheme: e.target.value }).then(App.applySettings);
    });

    var followOS = s.textScale == null;
    ap.appendChild(UI.el('<label class="switch"><span>Text size — follow phone setting</span>' +
      '<input type="checkbox" id="st-ts-os"' + (followOS ? ' checked' : '') + '></label>'));
    ap.appendChild(UI.el('<div class="field' + (followOS ? ' hidden' : '') + '" id="st-ts-wrap">' +
      '<span class="field-label">Text size: <span id="st-ts-val">' + Math.round((s.textScale || 1) * 100) + '%</span></span>' +
      '<input type="range" id="st-ts" min="85" max="130" step="5" value="' + Math.round((s.textScale || 1) * 100) + '"></div>'));
    ap.querySelector('#st-ts-os').addEventListener('change', function (e) {
      if (e.target.checked) { DB.saveSettings({ textScale: null }).then(App.applySettings); ap.querySelector('#st-ts-wrap').classList.add('hidden'); }
      else { ap.querySelector('#st-ts-wrap').classList.remove('hidden'); }
    });
    ap.querySelector('#st-ts').addEventListener('input', function (e) {
      var v = parseInt(e.target.value, 10);
      ap.querySelector('#st-ts-val').textContent = v + '%';
      DB.saveSettings({ textScale: v / 100 }).then(App.applySettings);
    });
    ap.appendChild(UI.el(UI.field('Landing page — opens at launch',
      '<select id="st-land">' + [['todo', 'Alef.do — task list'], ['exercise', 'Exercise'], ['discipline', 'Discipline'], ['program', 'Program'], ['retro', 'Retro'], ['setting', 'Setting']].map(function (o) {
        return '<option value="' + o[0] + '"' + ((s.landingPage || 'todo') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>')));
    ap.querySelector('#st-land').addEventListener('change', function (e) {
      DB.saveSettings({ landingPage: e.target.value });
    });
    var cmpRow = UI.el('<label class="switch"><span>Compact task rows (Alef.do)</span>' +
      '<input type="checkbox" id="st-tdc"' + (s.todoCompact !== false ? ' checked' : '') + '></label>');
    cmpRow.querySelector('#st-tdc').addEventListener('change', function (e) {
      DB.saveSettings({ todoCompact: e.target.checked }).then(App.applySettings);
    });
    ap.appendChild(cmpRow);
    pad.appendChild(ap);

    /* ---- folders & tags ---- */
    pad.appendChild(UI.el('<div class="section-title">Folders & tags</div>'));
    var ft = UI.el('<div class="list"></div>');
    [['note', 'Fitness Note — folders & tags'], ['bb', 'Bodybuilding — folders & tags']].forEach(function (m) {
      var it = UI.el('<button class="list-item"><span class="li-thumb">' + UI.icon('folder') + '</span>' +
        '<span class="li-main"><span class="li-title">' + m[1] + '</span></span>' +
        '<span class="chev">' + UI.icon('chev') + '</span></button>');
      it.addEventListener('click', function () { location.hash = '#/setting/folders/' + m[0]; });
      ft.appendChild(it);
    });
    var bgIt = UI.el('<button class="list-item"><span class="li-thumb">' + UI.icon('camera') + '</span>' +
      '<span class="li-main"><span class="li-title">Card backgrounds</span>' +
      '<span class="li-sub">Section card images</span></span>' +
      '<span class="chev">' + UI.icon('chev') + '</span></button>');
    bgIt.addEventListener('click', function () { location.hash = '#/setting/cardbg'; });
    ft.appendChild(bgIt);
    pad.appendChild(ft);

    /* ---- images & media ---- */
    pad.appendChild(UI.el('<div class="section-title">Images & media</div>'));
    var im = UI.el('<div class="card"></div>');
    im.appendChild(UI.el(UI.field('Stored quality of added media',
      '<select id="st-iq">' +
      [['original', 'Original (no recompression)'], ['normal', 'Normal (resize to 1600px)'], ['low', 'Low (resize to 900px)']].map(function (o) {
        return '<option value="' + o[0] + '"' + (s.imageQuality === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>')));
    im.appendChild(UI.el('<div class="sub" style="margin:2px 0 10px">Applies to photos/videos you add to exercises, notes and card backgrounds. Larger originals = bigger backups.</div>'));
    im.appendChild(UI.el('<label class="switch"><span>Save to Photo album as original</span>' +
      '<input type="checkbox" id="st-photos"' + (s.saveToPhotos ? ' checked' : '') + '></label>'));
    im.appendChild(UI.el('<div class="sub" style="margin-top:2px">When exporting a photo/video from the app to the phone album, keep the original file. Album export arrives with the native APK (M5); the web app downloads files instead.</div>'));
    im.querySelector('#st-photos').addEventListener('change', function (e) { DB.saveSettings({ saveToPhotos: e.target.checked }); });
    im.querySelector('#st-iq').addEventListener('change', function (e) { DB.saveSettings({ imageQuality: e.target.value }); });
    pad.appendChild(im);

    /* ---- backup — lean two-button front (v0.57), how-to behind the
       ? icon on the headline (v0.58, Alef's ask) ---- */
    var canFs = !!(window.Native && Native.isNative && Native.isNative() &&
                   Native.canSaveFiles && Native.canSaveFiles());
    var whereTxt = canFs
      ? 'Files are saved to <b>Documents/S26-Alef-Fit</b> on this phone.'
      : (window.Native && Native.isNative && Native.isNative()
        ? '⚠ Update the app (apk-latest) to enable saving files.'
        : 'Files go to the browser\'s Downloads folder.');
    var BK_HELP =
      '<p><b>Full backup</b> — everything incl. media + Vault → <b>AFbak-DDMMYY.json</b>; the dated Vault file <b>AFvault-DDMMYY.AFdd</b> writes with it. One file per day (a re-run overwrites).</p>' +
      '<p><b>Vault backup</b> — the Vault alone (.AFdd). Monthly: copy the dated file to USB.</p>' +
      '<p><b>Where:</b> ' + whereTxt + '</p>' +
      '<p><b>Import</b> — restores ANY backup file, old long names included (the type is detected). <b>Merge</b> = combine, newest wins, never loses data. <b>Replace all</b> = wipe this device first — recovery only.</p>' +
      '<p><b>New phone</b> — "Import to new phone (Full + Vault)" here, or the Setup wizard\'s ⚡ one-stop restore.</p>' +
      '<p><b>Drive mirror</b> — uploads a VAULT-FREE full backup to My Drive › Alef.Fit › Archives (keeps the newest 3). The line turns RED past your reminder interval.</p>' +
      '<p><b>Advanced</b> — rare small exports: connection settings (AFinfo), tasks only (AFtodo), PC ↔ phone transfer (AFtrans).</p>';
    var bkHead = UI.el('<div class="section-title">Backup <button type="button" class="btn-icon sm bk-help" aria-label="How backup works">' + UI.icon('help') + '</button></div>');
    bkHead.querySelector('.bk-help').addEventListener('click', function () {
      UI.modal('Backup — how it works', UI.el('<div class="bk-help-body">' + BK_HELP + '</div>'), [{ label: 'Close', primary: true }]);
    });
    pad.appendChild(bkHead);
    var bk = UI.el('<div class="card"></div>');
    function bkBtn(label, primary) {
      return UI.el('<button class="btn ' + (primary ? 'btn-primary ' : '') + 'btn-block" style="margin-bottom:8px">' +
        UI.icon('download') + ' ' + label + '</button>');
    }
    /* v0.57: Alef's short filename scheme — AF family + DDMMYY */
    function shortDate() {
      var d = new Date();
      function p2(n) { return String(n).padStart(2, '0'); }
      return p2(d.getDate()) + p2(d.getMonth() + 1) + String(d.getFullYear()).slice(2);
    }
    /* Google Drive sync info (Advanced fold; includes the secret) */
    var bk1 = bkBtn('Google Drive sync info');
    bk1.addEventListener('click', function () {
      DB.exportSyncInfo().then(function (data) {
        UI.download('AFinfo-' + shortDate() + '.json', JSON.stringify(data, null, 2));
      });
    });
    /* Vault backup (S26 only) — dated .AFdd, serial, 30-day timer.
       v0.57 C3/C4: guarded against double-tap; failure reports honestly. */
    var bk2 = null;
    if ((s.deviceId || '') !== 'PC') {
      bk2 = bkBtn('Vault backup (.AFdd)');
      bk2.addEventListener('click', function () {
        if (bk2.disabled) return;
        bk2.disabled = true;
        VaultKeep.backupNow().then(function (r) {
          bk2.disabled = false;
          UI.toast('Vault backup #' + VaultKeep.fmtSerial(r.serial) + ' — ' + r.filename);
        }).catch(function (e2) {
          bk2.disabled = false;
          UI.toast('⚠ ' + String(e2 && e2.message || e2));
        });
      });
    }
    /* Alef.do tasks only (Advanced fold) */
    var bk3 = bkBtn('Alef.do tasks (no Vault)');
    bk3.addEventListener('click', function () {
      DB.exportTodoBackup().then(function (data) {
        UI.download('AFtodo-' + shortDate() + '.json', JSON.stringify(data));
      });
    });
    /* Full backup — everything incl. media. v0.49: the LOCAL full backup
       carries the Vault too (cloud sync files still never do). */
    var bk4 = bkBtn('Full backup (all data + Vault)', true);
    /* v0.53: save details live UNDER the button, not in popups/toasts —
       persistent "current backup" status + live progress while writing */
    var bk4Status = UI.el('<div class="sub bk4-status" style="margin:2px 0 8px"></div>');
    function fmtBk4(info) {
      if (!info) return 'No full backup made on this device yet.';
      if (!info.ok) {
        return '⚠ Last attempt ' + new Date(info.at).toLocaleString('en-GB') + ' FAILED — ' +
          (info.error || 'unknown error');
      }
      /* v0.58 (Alef's ask): show WHERE + BOTH filenames (data + Vault) */
      var loc, file;
      if (info.path) {
        var cut = info.path.lastIndexOf('/');
        loc = info.path.slice(0, cut);
        file = info.path.slice(cut + 1);
      } else {
        loc = 'Downloads (this browser)';
        file = 'AFbak file';
      }
      return '✓ Current backup: ' + new Date(info.at).toLocaleString('en-GB') + ' · ' + info.mb + ' MB\n' +
        loc + ' — ' + file + (info.vaultFile ? ' + ' + info.vaultFile : '');
    }
    /* v0.57 A2: staleness nudge — quiet while ≤ 7 days, red beyond */
    var bk4Age = UI.el('<div class="sub bk4-age" style="margin:0 0 8px"></div>');
    function paintAge(info) {
      if (!info || !info.ok) {
        bk4Age.textContent = 'No full backup on this device yet — make one.';
        bk4Age.classList.add('bk-warn');
        return;
      }
      var days = Math.floor((Date.now() - info.at) / 86400000);
      bk4Age.textContent = 'Full backup is ' + (days <= 0 ? 'from today' : days + ' day' + (days === 1 ? '' : 's') + ' old');
      bk4Age.classList.toggle('bk-warn', days > 7);
    }
    DB.get('meta', 'fullBackupInfo').then(function (r) {
      bk4Status.textContent = fmtBk4(r && r.value);
      paintAge(r && r.value);
    });
    bk4.addEventListener('click', function () {
      if (bk4.disabled) return; /* v0.57 C3: two runs used to interleave into one corrupt file */
      bk4.disabled = true;
      bk4Status.textContent = 'Preparing backup…';
      DB.exportAll({ media: 'all', vault: true }).then(function (data) {
        var text = JSON.stringify(data);
        var mb = (text.length / 1048576).toFixed(1);
        var fname = 'AFbak-' + shortDate() + '.json'; /* v0.57: Alef's short scheme */
        function finish(ok, path, error) {
          bk4.disabled = false;
          var info = { at: Date.now(), ok: ok, mb: mb, path: path || null, error: error || null };
          DB.put('meta', { key: 'fullBackupInfo', value: info, updatedAt: Date.now() });
          bk4Status.textContent = fmtBk4(info);
          paintAge(info);
          if (!ok) return;
          DB.stampExport(); /* v0.58 P7: a delivered full backup advances the 'since' window */
          /* v0.52 (plan decision 6): the Full backup ALSO writes the dated
             Vault .AFdd — serial bumps and the 30-day timer resets */
          if ((DB.getSettings().deviceId || '') !== 'PC' && window.VaultKeep) {
            DB.all('todos').then(function (rows) {
              if (!rows.some(function (r) { return r.cat === 'vault'; })) return;
              VaultKeep.backupNow().then(function (r) {
                UI.toast('Vault .AFdd #' + VaultKeep.fmtSerial(r.serial) + ' written too');
                /* v0.58: the Vault filename joins the status line, persisted */
                return DB.get('meta', 'fullBackupInfo').then(function (fi) {
                  var v = (fi && fi.value) || info;
                  v.vaultFile = r.filename;
                  return DB.put('meta', { key: 'fullBackupInfo', value: v, updatedAt: Date.now() })
                    .then(function () { bk4Status.textContent = fmtBk4(v); });
                });
              }).catch(function () { /* full backup itself already succeeded */ });
            });
          }
        }
        if (window.Native && Native.isNative && Native.isNative() &&
            Native.canSaveFiles && Native.canSaveFiles()) {
          /* v0.53 BUGFIX: big backups stream in chunks (Native.saveText) —
             one-shot writes failed for multi-MB files on the S26 */
          Native.saveText(fname, text, function (done, total) {
            bk4Status.textContent = 'Saving… ' + Math.round(done / total * 100) + '% of ' + mb + ' MB';
          }).then(function (path) {
            if (path) finish(true, path);
            else finish(false, null, (Native.lastSaveError && Native.lastSaveError()) || 'could not write the file');
          });
        } else {
          /* v0.57 C4: UI.download says whether anything was written */
          if (UI.download(fname, text)) finish(true, null);
          else finish(false, null, 'file saving unavailable — update the app (apk-latest)');
        }
      }).catch(function (err) {
        bk4.disabled = false;
        bk4Status.textContent = '⚠ Backup failed — ' + String((err && err.message) || err);
      });
    });
    bk.appendChild(bk4);
    bk.appendChild(bk4Status);
    bk.appendChild(bk4Age);
    if (bk2) bk.appendChild(bk2);
    /* device transfer moved into the Advanced fold (v0.57 ruling 8) */
    var expSyncBtn = UI.el('<button class="btn btn-block" style="margin-bottom:8px">' + UI.icon('download') + ' Export sync file</button>');
    expSyncBtn.addEventListener('click', function () {
      DB.exportAll({ media: 'since' }).then(function (data) {
        /* v0.58 P7: the 'since' window advances only when the file was
           actually handed over */
        if (UI.download('AFtrans-' + shortDate() + '.json', JSON.stringify(data))) DB.stampExport();
      });
    });
    /* (the where-to-find-it text lives in the ? help sheet since v0.58) */
    var impBtn = UI.el('<button class="btn btn-block">' + UI.icon('upload') + ' Import backup file</button>');
    var impFile = UI.el('<input type="file" accept=".json,.AFdd,.zip,application/json,application/zip,application/octet-stream" class="hidden">');
    impBtn.addEventListener('click', function () { impFile.click(); });
    impFile.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var fname = f.name || '(file)';
      var fr = new FileReader();
      fr.onload = function () {
        /* v0.32: one import button — route by the file's own type stamp.
           v0.49: every type gets a confirm dialog with a Cancel button
           BEFORE anything is written.
           v0.52: also reads .AFdd/.zip (VaultKeep) and every confirm shows
           the FULL filename with its extension. */
        function confirmImport(what, run) {
          UI.modal('Import backup', UI.el('<div><p class="vk-file">' + UI.esc(fname) + '</p><p>' + what + '</p></div>'), [
            { label: 'Cancel' },
            { label: 'Import', primary: true, onClick: function (close) { close(); run(); } }
          ]);
        }
        VaultKeep.parseBackup(fr.result).catch(function () { return null; }).then(function (json) {
        if (!json) { UI.toast('Not a valid backup file'); return; }
        if (json && json.kind === 'syncinfo-backup') {
          confirmImport('Google Drive <b>sync settings</b> file. Restore the connection settings on this device?', function () {
            DB.importSyncInfo(json).then(function (n) {
              UI.toast('Sync settings restored (' + n + ' values) — tap Full Sync to reconnect');
              App.route();
            }).catch(function (err2) { UI.toast(String(err2.message || err2)); });
          });
          return;
        }
        if (json && json.kind === 'vault-backup') {
          confirmImport('<b>Vault</b> backup with ' + ((json.vault || []).length) + ' entries. Each is added back as a NEW date-stamped copy — nothing merges or overwrites.', function () {
            DB.importVault(json).then(function (c) {
              UI.toast('Vault restored: +' + c.added + ' entries, added as new (' + c.stamp + ')');
              App.route();
            }).catch(function (err2) { UI.toast(String(err2.message || err2)); });
          });
          return;
        }
        if (json && json.app === 'alef.fit-todo') {
          confirmImport('<b>Alef.do tasks</b> backup from ' + UI.esc((json.exportedAt || '?').slice(0, 10)) + '. Restore these tasks (newer copies win, nothing is wiped)?', function () {
            DB.importTodoBackup(json).then(function (c) {
              UI.toast('To-do restored: +' + c.added + ' new, ' + c.updated + ' updated' + (c.vault ? ' (' + c.vault + ' Vault)' : ''));
              App.route();
            }).catch(function (err2) { UI.toast(String(err2.message || err2)); });
          });
          return;
        }
        var when = (json.exportedAt || '?').slice(0, 10);
        var body = UI.el('<div><p class="vk-file">' + UI.esc(fname) + '</p><p>File from <b>' + UI.esc(when) + '</b>. How should it be applied?</p>' +
          '<p class="sub"><b>Merge</b> (recommended): combines both sides — newest change per record wins, deletions carry over.<br><b>Replace</b>: wipes this device first, then loads the file.</p></div>');
        UI.modal('Import backup', body, [
          { label: 'Cancel' },
          {
            label: 'Replace all', danger: true, onClick: function (close) {
              close();
              UI.confirm('Really REPLACE everything on this device with the file from ' + when + '?', 'Replace').then(function (ok) {
                if (!ok) return;
                DB.importAll(json, { mode: 'replace' }).then(function () {
                  App.applySettings();
                  UI.toast('Backup restored (replaced)');
                  App.route();
                }).catch(function (err) { UI.toast(String(err.message || err)); });
              });
            }
          },
          {
            label: 'Merge', primary: true, onClick: function (close) {
              close();
              DB.importAll(json, { mode: 'merge' }).then(function (c) {
                App.applySettings();
                UI.toast('Merged: +' + c.added + ' new, ' + c.updated + ' updated, ' + c.deleted + ' deleted' +
                  (c.conflicts ? ', ' + c.conflicts + ' conflict copies' : '') +
                  (c.mediaAdded ? ', ' + c.mediaAdded + ' media' : ''));
                App.route();
              }).catch(function (err) { UI.toast(String(err.message || err)); });
            }
          }
        ]);
        });
      };
      fr.readAsArrayBuffer(f);
      e.target.value = '';
    });
    bk.appendChild(impBtn);
    bk.appendChild(impFile);
    /* v0.53: real full restore for a NEW phone — both files in one go */
    var impBothBtn = UI.el('<button class="btn btn-block" style="margin-top:8px">' + UI.icon('upload') + ' Import to new phone (Full + Vault)</button>');
    impBothBtn.addEventListener('click', function () {
      RestoreFlow.open(function () { App.route(); });
    });
    bk.appendChild(impBothBtn);
    var undoBtn = UI.el('<button class="btn btn-block" style="margin-top:8px;display:none">Undo last sync/merge</button>');
    DB.undoInfo().then(function (u) {
      if (u) {
        undoBtn.style.display = '';
        undoBtn.textContent = 'Undo last sync/merge (' + new Date(u.at).toLocaleString('en-GB') + ')';
      }
    });
    undoBtn.addEventListener('click', function () {
      UI.confirm('Restore the data exactly as it was before the last sync/merge?', 'Undo').then(function (okU) {
        if (!okU) return;
        DB.undoLastMerge().then(function () {
          App.applySettings();
          UI.toast('Restored pre-sync data');
          App.route();
        }).catch(function (err) { UI.toast(String(err.message || err)); });
      });
    });
    bk.appendChild(undoBtn);

    /* ---- v0.57 A3: elective Drive mirror (details in the ? help) ---- */
    var mirBtn = UI.el('<button class="btn btn-block" style="margin:12px 0 6px">' + UI.icon('upload') + ' Mirror backup to Drive</button>');
    var mirStat = UI.el('<div class="sub bk-mir-stat"></div>');
    var mirRow = UI.el('<div class="sub" style="margin:4px 0 0">Remind after <input type="number" id="bk-mir-int" min="1" max="365" style="width:58px"> days without a mirror</div>');
    mirRow.querySelector('#bk-mir-int').value = s.mirrorIntervalDays || 30;
    mirRow.querySelector('#bk-mir-int').addEventListener('change', function (e) {
      var v = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 30));
      e.target.value = v;
      DB.saveSettings({ mirrorIntervalDays: v }).then(paintMir);
    });
    function paintMir() {
      DB.get('meta', 'archiveMirrorAt').then(function (r) {
        var at = r && r.value;
        var iv = (DB.getSettings() || {}).mirrorIntervalDays || 30;
        if (!at) {
          mirStat.textContent = 'No Drive mirror yet.';
          mirStat.classList.add('bk-warn');
          return;
        }
        var days = Math.floor((Date.now() - at) / 86400000);
        mirStat.textContent = 'Last mirror upload: ' + new Date(at).toLocaleString('en-GB') +
          ' (' + days + ' day' + (days === 1 ? '' : 's') + ' ago)';
        mirStat.classList.toggle('bk-warn', days > iv);
      });
    }
    paintMir();
    mirBtn.addEventListener('click', function () {
      if (mirBtn.disabled) return;
      if (!Sync.hasClientId || !Sync.hasClientId()) { UI.toast('Connect Google first — Setting → Share with Claude → Connect'); return; }
      mirBtn.disabled = true;
      mirStat.classList.remove('bk-warn');
      mirStat.textContent = 'Building the mirror file…';
      DB.exportAll({ media: 'all' }).then(function (data) { /* vault EXCLUDED — never rides the cloud */
        var name = 'AFbak-' + shortDate() + '.json';
        mirStat.textContent = 'Uploading ' + name + ' to Drive…';
        return Sync.mirrorBackup(name, data);
      }).then(function () {
        mirBtn.disabled = false;
        return DB.put('meta', { key: 'archiveMirrorAt', value: Date.now() }).then(paintMir);
      }).catch(function (e3) {
        mirBtn.disabled = false;
        mirStat.textContent = '⚠ Mirror failed — ' + String((e3 && e3.message) || e3).slice(0, 140);
        mirStat.classList.add('bk-warn');
      });
    });
    bk.appendChild(mirBtn);
    bk.appendChild(mirStat);
    bk.appendChild(mirRow);

    /* ---- Advanced (rare) exports fold away — v0.57 ruling 8 ---- */
    var advHead = UI.el('<button type="button" class="btn btn-block" style="margin-top:12px">Advanced backups ▸</button>');
    var advBox = UI.el('<div class="hidden"></div>');
    advHead.addEventListener('click', function () {
      advBox.classList.toggle('hidden');
      advHead.textContent = advBox.classList.contains('hidden') ? 'Advanced backups ▸' : 'Advanced backups ▾';
    });
    bk.appendChild(advHead);
    advBox.appendChild(bk1);
    advBox.appendChild(bk3);
    advBox.appendChild(expSyncBtn);
    bk.appendChild(advBox);
    var usage = UI.el('<div class="sub" style="margin-top:10px">Storage: …</div>');
    DB.storageEstimate().then(function (est) {
      if (est) usage.textContent = 'Storage used: ' + (est.usage / 1048576).toFixed(1) + ' MB of ' + (est.quota / 1048576 / 1024).toFixed(1) + ' GB available';
      else usage.remove();
    });
    bk.appendChild(usage);
    pad.appendChild(bk);

    /* ---- device & sync ---- */
    pad.appendChild(UI.el('<div class="section-title">Device & sync</div>'));
    var dv = UI.el('<div class="card"></div>');
    /* v0.39: succession — retired banner + take-back / claim button */
    if (DB.isSuperseded && DB.isSuperseded()) {
      var mc = s.mainClaim || {};
      var when = mc.at ? new Date(mc.at).toLocaleDateString('en-GB') : '';
      dv.appendChild(UI.el('<div class="sub su-retired">⚠ A newer ' + UI.esc(s.deviceId) +
        ' took over' + (when ? ' on ' + UI.esc(when) : '') + ' — this copy no longer writes the Claude share or schedules alarms. Data stays readable.</div>'));
    }
    if (s.deviceId) {
      var claimBtn = UI.el('<button class="btn btn-block" style="margin-bottom:8px">Make THIS the main ' + UI.esc(s.deviceId) + '</button>');
      claimBtn.addEventListener('click', function () {
        UI.confirm('Claim the main ' + s.deviceId + ' role for THIS install? Any other ' + s.deviceId + ' retires on its next sync.', 'Claim')
          .then(function (ok) {
            if (!ok) return;
            DB.claimRole(s.deviceId).then(function () { UI.toast('This app is now the main ' + s.deviceId); App.route(); });
          });
      });
      dv.appendChild(claimBtn);
    }
    dv.appendChild(UI.el(UI.field('This device is',
      '<select id="dv-id"><option value="">(not set)</option>' +
      '<option value="S26"' + (s.deviceId === 'S26' ? ' selected' : '') + '>S26 — phone (primary)</option>' +
      '<option value="PC"' + (s.deviceId === 'PC' ? ' selected' : '') + '>PC — computer</option></select>')));
    dv.querySelector('#dv-id').addEventListener('change', function (e) {
      DB.saveSettings({ deviceId: e.target.value });
    });
    var asw = UI.el('<label class="switch"><span>Auto sync — launch / return / after edits</span>' +
      '<input type="checkbox" id="dv-as"' + (s.autoSync !== false ? ' checked' : '') + '></label>');
    asw.querySelector('#dv-as').addEventListener('change', function (e) {
      DB.saveSettings({ autoSync: e.target.checked });
    });
    dv.appendChild(asw);
    var psw = UI.el('<label class="switch"><span>PC proposal mode — edits become drafts for S26</span>' +
      '<input type="checkbox" id="dv-pp"' + (s.pcProposals !== false ? ' checked' : '') + '></label>');
    psw.querySelector('#dv-pp').addEventListener('change', function (e) {
      DB.saveSettings({ pcProposals: e.target.checked });
    });
    dv.appendChild(psw);
    var propLink = UI.el('<button class="btn btn-block" style="margin-top:8px;display:none"></button>');
    DB.listProposals().then(function (props) {
      if (DB.proposalMode() && props.length) {
        propLink.style.display = '';
        propLink.textContent = 'Send to S26 (' + props.length + ')';
        propLink.addEventListener('click', function () { location.hash = '#/discipline/todo/send'; });
      } else {
        var inbox = props.filter(function (x) { return x.status === 'sent'; });
        if (!DB.proposalMode() && inbox.length) {
          propLink.style.display = '';
          propLink.textContent = 'Review PC changes (' + inbox.length + ')';
          propLink.addEventListener('click', function () { location.hash = '#/discipline/todo/review'; });
        }
      }
    });
    dv.appendChild(propLink);
    dv.appendChild(UI.el('<div class="sub" style="margin-top:6px">Edits are stamped with this device name. Auto sync runs silently once Google Drive sync is connected (one manual Full Sync first). In proposal mode the PC never changes live data — its edits wait in Send to S26, then in the S26 review inbox.</div>'));
    pad.appendChild(dv);

    /* ---- Google Drive sync ---- */
    pad.appendChild(UI.el('<div class="section-title">Google Drive sync</div>'));
    var sy = UI.el('<div class="card"></div>');
    sy.appendChild(UI.el('<div class="sub" style="margin-bottom:10px">Two-way sync through your Google Drive (hidden app folder): pulls the other device\'s changes, merges, pushes yours — media transfers only what\'s missing. One-time setup: a Google OAuth client ID (see docs/SYNC-SETUP.md in the project).</div>'));
    /* v0.31: client ID in a wrapping textarea (full value visible for easy
       recheck); secret in a full-width field with an eye reveal toggle. */
    var cidRow = UI.el('<label class="field"><span class="field-label">Google OAuth client ID</span>' +
      '<textarea id="sy-cid" class="cred-mono cred-id" rows="2" spellcheck="false" autocapitalize="off" autocomplete="off" ' +
      'placeholder="…apps.googleusercontent.com">' + UI.esc(s.gdriveClientId || '') + '</textarea></label>');
    cidRow.querySelector('#sy-cid').addEventListener('change', function (e) {
      DB.saveSettings({ gdriveClientId: e.target.value.trim() });
    });
    sy.appendChild(cidRow);
    var secRow = UI.el('<label class="field"><span class="field-label">Google client secret</span>' +
      '<span class="cred-secret">' +
      '<input type="password" id="sy-sec" class="cred-mono" placeholder="GOCSPX-…" spellcheck="false" autocapitalize="off" autocomplete="off" value="' + UI.esc(s.gdriveClientSecret || '') + '">' +
      '<button type="button" class="btn-icon" id="sy-sec-eye" aria-label="Show secret">' + UI.icon('eye') + '</button>' +
      '</span></label>');
    secRow.querySelector('#sy-sec').addEventListener('change', function (e) {
      DB.saveSettings({ gdriveClientSecret: e.target.value.trim() });
    });
    secRow.querySelector('#sy-sec-eye').addEventListener('click', function (e) {
      e.preventDefault(); /* inside a <label> — stop it refocusing the input */
      var inp = secRow.querySelector('#sy-sec');
      var btn = secRow.querySelector('#sy-sec-eye');
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      btn.innerHTML = UI.icon(show ? 'eyeOff' : 'eye');
      btn.setAttribute('aria-label', show ? 'Hide secret' : 'Show secret');
    });
    sy.appendChild(secRow);
    /* v0.36: two syncs, named by what they do \u2014 Full Sync (everything)
       and Sync Workout (Exercise + Program entries + records + media) */
    var syBtn = UI.el('<button class="btn btn-primary btn-block" style="margin-bottom:8px">' + UI.icon('upload') + ' Full Sync (everything)</button>');
    var syWkBtn = UI.el('<button class="btn btn-block">' + UI.icon('upload') + ' Sync Workout (Exercise + Program)</button>');
    var syStatus = UI.el('<div class="sub" style="margin-top:8px"></div>');
    DB.get('meta', 'lastDriveSyncAt').then(function (r) {
      if (r) syStatus.textContent = 'Last synced: ' + new Date(r.value).toLocaleString('en-GB');
    });
    function runSync(scope) {
      if (!Sync.hasClientId()) { UI.toast('Set the Google client ID and secret first'); return; }
      syBtn.disabled = true; syWkBtn.disabled = true;
      Sync.syncNow(function (msg) { syStatus.textContent = msg; }, scope)
        .then(function (res) {
          syBtn.disabled = false; syWkBtn.disabled = false;
          var p = res.pulled || { added: 0, updated: 0, deleted: 0, conflicts: 0, mediaAdded: 0 };
          syStatus.textContent = 'Last synced: ' + new Date().toLocaleString('en-GB');
          UI.toast((scope === 'workout' ? 'Workout synced: ' : 'Synced: ') +
            '+' + p.added + ' / ~' + p.updated + ' / \u2212' + p.deleted +
            ' \u00b7 media \u2191' + res.mediaUp + ' \u2193' + res.mediaDown);
          App.applySettings();
        })
        .catch(function (err) {
          syBtn.disabled = false; syWkBtn.disabled = false;
          syStatus.textContent = String(err.message || err);
          UI.toast(String(err.message || err));
        });
    }
    syBtn.addEventListener('click', function () { runSync(); });
    syWkBtn.addEventListener('click', function () { runSync('workout'); });
    /* v0.39: the PC leads with Sync Workout — its edits travel as
       proposals, and workout content is what it moves most */
    if ((s.deviceId || '') === 'PC') {
      syWkBtn.classList.add('btn-primary');
      syWkBtn.style.marginBottom = '8px';
      syBtn.classList.remove('btn-primary');
      syBtn.style.marginBottom = '0';
      sy.appendChild(syWkBtn);
      sy.appendChild(syBtn);
    } else {
      sy.appendChild(syBtn);
      sy.appendChild(syWkBtn);
    }
    sy.appendChild(syStatus);
    pad.appendChild(sy);

    /* ---- Share with Claude (AI secretary reads a visible Drive file) ---- */
    pad.appendChild(UI.el('<div class="section-title">Share with Claude</div>'));
    var cs = UI.el('<div class="card"></div>');
    cs.appendChild(UI.el('<div class="sub" style="margin-bottom:8px">Lets your Claude AI secretary check the app: every sync also writes a small <b>visible</b> file to your Google Drive (folder <b>Alef.Fit</b> → alef-fit-claude-share.json) with only the sections below — never photos/videos, notes or alarms. Hide a single task with the 🤖 chip in its task sheet; hide a program and all its records via Edit program.</div>'));
    var csStatus = UI.el('<div class="sub" style="margin-top:8px"></div>');
    function csRefreshStatus() {
      Promise.all([DB.get('meta', 'claudeShareAt'), DB.get('meta', 'claudeShareErr')]).then(function (r) {
        if (r[1] && r[1].value) csStatus.textContent = 'Last update failed: ' + r[1].value + ' — tap Re-connect Google';
        else if (r[0]) csStatus.textContent = 'Share file updated: ' + new Date(r[0].value).toLocaleString('en-GB');
        else csStatus.textContent = '';
      });
    }
    csRefreshStatus();
    function csConnectAndPush() {
      csStatus.textContent = 'Connecting to Google…';
      return Sync.reconnect().then(function () {
        return Sync.syncNow(function (m) { csStatus.textContent = m; });
      }).then(function (res) {
        if (res.share && res.share !== 'ok') throw new Error(res.share);
        csRefreshStatus();
        UI.toast('Claude share file is in your Drive (Alef.Fit folder)');
      }).catch(function (err) {
        csStatus.textContent = String(err.message || err);
        UI.toast(String(err.message || err));
      });
    }
    var csOn = UI.el('<label class="switch"><span>Share data with Claude</span>' +
      '<input type="checkbox" id="cs-on"' + (s.claudeShareOn ? ' checked' : '') + '></label>');
    var csDetail = UI.el('<div' + (s.claudeShareOn ? '' : ' class="hidden"') + '></div>');
    csOn.querySelector('#cs-on').addEventListener('change', function (e) {
      var on = e.target.checked;
      if (on && !Sync.hasClientId()) {
        e.target.checked = false;
        UI.toast('Set up Google Drive sync first (client ID + secret above)');
        return;
      }
      DB.saveSettings({ claudeShareOn: on }).then(function () {
        csDetail.classList.toggle('hidden', !on);
        if (on) csConnectAndPush(); /* one popup: grants the visible-file permission */
      });
    });
    cs.appendChild(csOn);
    var ciRow = UI.el('<label class="switch"><span>Claude suggestions inbox — 🤖 proposals to review</span>' +
      '<input type="checkbox" id="cs-inbox"' + (s.claudeInboxOn !== false ? ' checked' : '') + '></label>');
    ciRow.querySelector('#cs-inbox').addEventListener('change', function (e) {
      DB.saveSettings({ claudeInboxOn: e.target.checked });
    });
    csDetail.appendChild(ciRow);
    var cdRow = UI.el('<label class="switch"><span>Claude direct edit (Alef.Lucilius) — applies without review</span>' +
      '<input type="checkbox" id="cs-direct"' + (s.claudeDirect !== false ? ' checked' : '') + '></label>');
    cdRow.querySelector('#cs-direct').addEventListener('change', function (e) {
      DB.saveSettings({ claudeDirect: e.target.checked });
    });
    csDetail.appendChild(cdRow);
    var ciStat = UI.el('<div class="sub" style="margin:2px 0 8px"></div>');
    DB.get('meta', 'claudeBatchAt').then(function (r) {
      ciStat.textContent = r ? 'Last suggestions processed: ' + new Date(r.value).toLocaleString('en-GB') : 'No suggestions processed yet — ask Claude in a chat to review your list.';
    });
    csDetail.appendChild(ciStat);
    [['cs-todo', 'Alef.do — tasks', 'claudeShareTodo'],
     ['cs-workout', 'Workout — programs, records, incline walks', 'claudeShareWorkout']].forEach(function (o) {
      var row = UI.el('<label class="switch"><span>' + o[1] + '</span>' +
        '<input type="checkbox" id="' + o[0] + '"' + (s[o[2]] !== false ? ' checked' : '') + '></label>');
      row.querySelector('input').addEventListener('change', function (e) {
        var patch = {};
        patch[o[2]] = e.target.checked;
        DB.saveSettings(patch).then(function () { if (window.Sync) Sync.autoTouch(); });
      });
      csDetail.appendChild(row);
    });
    var csBtn = UI.el('<button class="btn btn-block" style="margin-top:8px">' + UI.icon('upload') + ' Update share file now</button>');
    csBtn.addEventListener('click', function () {
      csBtn.disabled = true;
      Sync.syncNow(function (m) { csStatus.textContent = m; }).then(function (res) {
        csBtn.disabled = false;
        if (res.share && res.share !== 'ok') csStatus.textContent = 'Update failed: ' + res.share + ' — tap Re-connect Google';
        else csRefreshStatus();
      }).catch(function (err) {
        csBtn.disabled = false;
        csStatus.textContent = String(err.message || err);
      });
    });
    csDetail.appendChild(csBtn);
    var csRe = UI.el('<button class="btn btn-block" style="margin-top:8px">Re-connect Google — allow the share file</button>');
    csRe.addEventListener('click', function () { csConnectAndPush(); });
    csDetail.appendChild(csRe);
    cs.appendChild(csDetail);
    cs.appendChild(csStatus);
    pad.appendChild(cs);

    /* ---- developer: tap-to-edit app texts ---- */
    pad.appendChild(UI.el('<div class="section-title">Developer</div>'));
    var dev = UI.el('<div class="card"></div>');
    dev.appendChild(UI.el('<div class="sub" style="margin-bottom:8px">Text edit mode: tap any app text (titles, buttons, labels, placeholders) to change it. Changes apply instantly, sync between devices, and never touch your data. Export the change file and give it to Claude in Cowork to make the wording permanent in code.</div>'));
    var devSw = UI.el('<label class="switch"><span>Text edit mode</span><input type="checkbox" id="dev-te"' + (s.devTextEdit ? ' checked' : '') + '></label>');
    devSw.querySelector('input').addEventListener('change', function (e) {
      DB.saveSettings({ devTextEdit: e.target.checked }).then(function () {
        DevText.refreshBadge();
        UI.toast(e.target.checked ? 'Tap any text to edit it' : 'Text edit mode off');
      });
    });
    dev.appendChild(devSw);
    var devInfo = UI.el('<div class="sub" style="margin:8px 0"></div>');
    function devCount() {
      var n = DevText.count();
      devInfo.textContent = n + ' text change' + (n === 1 ? '' : 's') + ' saved';
    }
    devCount();
    dev.appendChild(devInfo);
    var revBtn = UI.el('<button class="btn btn-block" style="margin-bottom:8px">Review text changes</button>');
    revBtn.addEventListener('click', function () {
      var items = DevText.list();
      var body = UI.el('<div></div>');
      if (!items.length) body.appendChild(UI.el('<p class="sub">No text changes yet — switch on Text edit mode and tap any text.</p>'));
      items.forEach(function (it) {
        var row = UI.el('<div class="td-sub-row"><span class="td-sub-title" style="white-space:normal"><s>' + UI.esc(it.original) + '</s> → <b>' + UI.esc(it.text) + '</b><br><span class="sub">' + UI.esc(it.screen) + (it.placeholder ? ' · placeholder' : '') + '</span></span>' +
          '<button class="btn-icon sm" aria-label="remove">' + UI.icon('trash') + '</button></div>');
        row.querySelector('button').addEventListener('click', function () {
          DevText.remove(it.key).then(function () { row.remove(); devCount(); });
        });
        body.appendChild(row);
      });
      UI.modal('Text changes', body, [{ label: 'Close', primary: true }]);
    });
    dev.appendChild(revBtn);
    var expTBtn = UI.el('<button class="btn btn-primary btn-block">Export change file (for Cowork)</button>');
    expTBtn.addEventListener('click', function () {
      if (!DevText.count()) { UI.toast('No text changes to export'); return; }
      UI.download('alef-fit-texts-' + DB.todayISO() + '.json', JSON.stringify(DevText.exportFile(), null, 2));
      UI.toast('Change file exported — give it to Claude in Cowork');
    });
    dev.appendChild(expTBtn);
    pad.appendChild(dev);

    /* ---- Info directory: important guides about the app ---- */
    pad.appendChild(UI.el('<div class="section-title">Info</div>'));
    var infList = UI.el('<div class="list"></div>');
    function infoEntry(title, sub, bodyHtml) {
      var row = UI.el('<button class="list-item"><span class="li-thumb">' + UI.icon('note') + '</span>' +
        '<span class="li-main"><span class="li-title">' + UI.esc(title) + '</span>' +
        '<span class="li-sub">' + UI.esc(sub) + '</span></span>' +
        '<span class="chev">' + UI.icon('chev') + '</span></button>');
      row.addEventListener('click', function () {
        UI.modal(title, UI.el('<div>' + bodyHtml + '</div>'), [{ label: 'Close', primary: true }]);
      });
      infList.appendChild(row);
    }
    infoEntry('Backup guide', 'Which file, when — by situation',
      /* v0.53: rewritten per Alef — concise, one line per real situation */
      '<table class="info-table"><tr><th>Situation</th><th>What to do</th></tr>' +
      '<tr><td><b>NEW S26</b><br>(fresh install)</td><td>Setup wizard → <b>⚡ One-stop restore</b>: pick AFbak-….json + AFvault-….AFdd — sign-in, Full Sync and the S26 claim chain by themselves.</td></tr>' +
      '<tr><td><b>Mature S26</b><br>(routine backup)</td><td>Weekly (or after big changes): tap <b>Full backup</b> — writes AFbak-….json AND the dated AFvault-….AFdd together; the lines under the button show status + age.</td></tr>' +
      '<tr><td><b>Secure the Vault</b></td><td>The rolling mirror (AFvault-current) updates by itself. Monthly: Vault 🔒 → <b>Backup now</b> → copy the dated .AFdd to USB. The Vault NEVER rides the cloud.</td></tr>' +
      '<tr><td><b>Long retention</b></td><td><b>Mirror backup to Drive</b> — a vault-free AFbak copy into My Drive › Alef.Fit › Archives; the line turns RED past your interval (default 30 d).</td></tr>' +
      '<tr><td><b>Device transfer</b><br>(PC ↔ phone)</td><td>Advanced → Export <b>sync file</b> (AFtrans, small) → Import → <b>Merge</b> on the other device. Daily changes travel by <b>Sync now</b> instead.</td></tr></table>' +
      '<div class="sub" style="margin:6px 0"><b>Merge</b> = combine, newest wins, never loses data. <b>Replace all</b> = wipe this device first — recovery only.<br>' +
      'Files live in <b>Documents › S26-Alef-Fit</b> (phone) or Downloads (browser).</div>');
    infoEntry('Edit app text', 'Rename any label — then make it permanent',
      '<div class="sub"><b>1.</b> Setting → Developer → switch on <b>Text edit mode</b>.<br>' +
      '<b>2.</b> Tap any app text (title, button, label, grey placeholder) → type the new wording → Save. It applies instantly and syncs to the other device.<br>' +
      '<b>3.</b> Tap the gold badge to stop editing.<br>' +
      '<b>4.</b> Developer → <b>Review text changes</b> to check or undo entries.<br>' +
      '<b>5.</b> <b>Export change file</b> and give it to Claude in Cowork — the wording becomes permanent in code; clear the overrides after.<br>' +
      '<span style="opacity:.8">Overlays only — your tasks, notes and records are never changed.</span></div>');
    pad.appendChild(infList);

    /* ---- about ---- */
    pad.appendChild(UI.el('<div class="section-title">About</div>'));
    pad.appendChild(UI.el('<div class="card"><b>Alef.Fit</b> v' + APP_VERSION +
      '<div class="sub">Personal exercise management · dates in CE · code versioned in repo.bundle</div></div>'));
  }

  /* ---- folder & tag manager (per module) ---- */
  function renderFolderTags(el, module) {
    var title = module === 'bb' ? 'Bodybuilding' : 'Fitness Note';
    el.appendChild(UI.header({ title: title + ' — folders & tags', back: '#/setting' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);

    function draw() {
      wrap.innerHTML = '';
      Promise.all([DB.byIndex('folders', 'module', module), DB.byIndex('tags', 'module', module)]).then(function (res) {
        var folders = res[0].sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        var tags = res[1];

        wrap.appendChild(UI.el('<div class="section-title">Edit the folder list</div>'));
        var fl = UI.el('<div class="list"></div>');
        folders.forEach(function (f) {
          var it = UI.el('<div class="list-item"><span class="li-thumb">' + UI.icon('folder') + '</span>' +
            '<span class="li-main"><span class="li-title">' + UI.esc(f.name) + '</span></span>' +
            '<button class="btn-icon" data-a="ren" aria-label="rename">' + UI.icon('edit') + '</button>' +
            '<button class="btn-icon" data-a="del" aria-label="delete">' + UI.icon('trash') + '</button></div>');
          it.querySelector('[data-a=ren]').addEventListener('click', function () { nameForm('Rename folder', f.name, function (name) { f.name = name; DB.put('folders', f).then(draw); }); });
          it.querySelector('[data-a=del]').addEventListener('click', function () {
            UI.confirm('Delete folder "' + f.name + '"? Notes inside move to (no folder).', 'Delete').then(function (ok) {
              if (!ok) return;
              DB.byIndex('notes', 'folderId', f.id).then(function (notes) {
                return Promise.all(notes.map(function (n) { n.folderId = null; return DB.put('notes', n); }));
              }).then(function () { return DB.del('folders', f.id); }).then(draw);
            });
          });
          fl.appendChild(it);
        });
        if (!folders.length) fl.appendChild(UI.el('<div class="list-item"><span class="li-main sub">No folders yet</span></div>'));
        wrap.appendChild(fl);
        var addF = UI.el('<button class="btn btn-block" style="margin-bottom:16px">' + UI.icon('plus') + ' Add folder</button>');
        addF.addEventListener('click', function () {
          nameForm('New folder', '', function (name) {
            DB.put('folders', { id: DB.uid(), module: module, name: name, order: folders.length }).then(draw);
          });
        });
        wrap.appendChild(addF);

        wrap.appendChild(UI.el('<div class="section-title">Manage tags</div>'));
        var tagCard = UI.el('<div class="card"></div>');
        if (!tags.length) tagCard.appendChild(UI.el('<span class="sub">No tags yet</span>'));
        tags.forEach(function (t) {
          var chip = UI.el('<button type="button" class="chip" style="border:0;cursor:pointer;font:inherit" title="Tap to delete">' + UI.icon('tag') + ' ' + UI.esc(t.name) + ' ✕</button>');
          chip.addEventListener('click', function () {
            UI.confirm('Delete tag "' + t.name + '"? It is removed from all notes.', 'Delete').then(function (ok) {
              if (!ok) return;
              DB.byIndex('notes', 'module', module).then(function (notes) {
                return Promise.all(notes.filter(function (n) { return (n.tags || []).indexOf(t.id) >= 0; }).map(function (n) {
                  n.tags = n.tags.filter(function (id) { return id !== t.id; });
                  return DB.put('notes', n);
                }));
              }).then(function () { return DB.del('tags', t.id); }).then(draw);
            });
          });
          tagCard.appendChild(chip);
        });
        wrap.appendChild(tagCard);
        var addT = UI.el('<button class="btn btn-block">' + UI.icon('plus') + ' Add tag</button>');
        addT.addEventListener('click', function () {
          nameForm('New tag', '', function (name) {
            DB.put('tags', { id: DB.uid(), module: module, name: name }).then(draw);
          });
        });
        wrap.appendChild(addT);
      });
    }
    draw();
  }

  function nameForm(title, current, onSave) {
    var body = UI.el('<div>' + UI.field('Name', '<input type="text" id="nm" value="' + UI.esc(current) + '">') + '</div>');
    UI.modal(title, body, [
      { label: 'Cancel' },
      {
        label: 'Save', primary: true, onClick: function (close) {
          var name = body.querySelector('#nm').value.trim();
          if (!name) { UI.toast('Name is required'); return; }
          close(); onSave(name);
        }
      }
    ]);
  }

  /* ---- card backgrounds ---- */
  function renderCardBg(el) {
    el.appendChild(UI.header({ title: 'Card backgrounds', back: '#/setting' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    pad.appendChild(UI.el('<div class="card"><div class="sub">Pick a background image for each section card (like folders holding your own pictures). Tap a row to set; tap ✕ to clear.</div></div>'));

    /* grouped by section so each card family is easy to find */
    var groups = [
      ['Exercise — body parts', DB.CATEGORIES.map(function (c) { return { key: 'cat-' + c.id, label: c.name }; })],
      /* v0.51: Incline Walk card moved to Program (its old artwork now
         backs the Cardiovascular exercise category above) */
      ['Discipline — modules', [['todo', 'Alef.do'], ['note', 'Fitness Note'], ['bb', 'Bodybuilding'], ['alarm', 'Alarm Reminder']].map(function (m) {
        return { key: 'disc-' + m[0], label: m[1] };
      })],
      ['Retro — cards', [
        { key: 'retro-cal', label: 'Workout day' },
        { key: 'retro-rv', label: 'Rep-Vol Trend' },
        { key: 'retro-wt', label: 'Weight training day / week' },
        { key: 'retro-iw', label: 'Incline walk day / week' }
      ]]
    ];

    var s = DB.getSettings();
    var file = UI.el('<input type="file" accept="image/*" class="hidden">');
    var pendingKey = null;
    file.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f || !pendingKey) return;
      UI.fileToDataUrl(f).then(function (d) {
        var bg = Object.assign({}, DB.getSettings().cardBg);
        bg[pendingKey] = d;
        DB.saveSettings({ cardBg: bg }).then(function () { UI.toast('Background set'); App.route(); });
      });
      e.target.value = '';
    });
    function defaultAsset(key) {
      return key.indexOf('cat-') === 0
        ? 'assets/catbg/' + key.slice(4) + '.jpg'
        : 'assets/cardbg/' + key + '.jpg';
    }
    /* download the current background (Downloads folder; gallery apps pick
       it up — true camera-roll saving arrives with the native APK, M5) */
    function saveImage(src, name) {
      var a = document.createElement('a');
      if (src.indexOf('data:') === 0) {
        var parts = src.split(',');
        var mime = (parts[0].match(/data:(.*?);/) || [null, 'image/jpeg'])[1];
        var bin = atob(parts[1]);
        var arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        a.href = URL.createObjectURL(new Blob([arr], { type: mime }));
      } else {
        a.href = src;
      }
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.href.indexOf('blob:') === 0) URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    /* viewer: full-size image + Change / Save / Reset */
    function bgViewer(t, cur, isCustom) {
      var body = UI.el('<div>' +
        '<img src="' + cur + '" alt="" style="width:100%;border-radius:12px;cursor:zoom-in">' +
        '<div class="sub" style="margin-top:6px">' + (isCustom ? 'Custom image' : 'Bundled default') + ' — tap the image for full screen</div></div>');
      body.querySelector('img').addEventListener('click', function () {
        UI.lightbox({ type: 'image', src: cur });
      });
      var btns = [
        { label: 'Close' },
        { label: 'Save image', onClick: function () { saveImage(cur, 'aleffit-' + t.key + '.jpg'); UI.toast('Saved to Downloads'); } },
        { label: 'Change', primary: true, onClick: function (close) { close(); pendingKey = t.key; file.click(); } }
      ];
      if (isCustom) {
        btns.splice(1, 0, {
          label: 'Reset', danger: true, onClick: function (close) {
            var bg = Object.assign({}, DB.getSettings().cardBg);
            delete bg[t.key];
            DB.saveSettings({ cardBg: bg }).then(function () { close(); App.route(); });
          }
        });
      }
      UI.modal(t.label, body, btns);
    }
    function bgRow(t) {
      var isCustom = !!(s.cardBg && s.cardBg[t.key]);
      var cur = isCustom ? s.cardBg[t.key] : defaultAsset(t.key);
      var it = UI.el('<div class="list-item">' +
        '<span class="li-main"><span class="li-title">' + UI.esc(t.label) + '</span>' +
        '<span class="li-sub">' + (isCustom ? 'custom image' : 'bundled default') + '</span></span>' +
        '<img class="li-thumb bg-thumb" src="' + cur + '" alt="">' +
        '<span class="chev">' + UI.icon('chev') + '</span></div>');
      it.addEventListener('click', function () { bgViewer(t, cur, isCustom); });
      return it;
    }
    groups.forEach(function (grp) {
      pad.appendChild(UI.el('<div class="section-title">' + grp[0] + '</div>'));
      var list = UI.el('<div class="list"></div>');
      grp[1].forEach(function (t) { list.appendChild(bgRow(t)); });
      pad.appendChild(list);
    });
    pad.appendChild(file);
  }

  return { render: render };
})();

/* ==== v0.53: RestoreFlow — REAL full import for a new S26 ====
   One dialog, TWO clearly-labeled file panels (Full backup + Vault
   backup), each showing the chosen file's name and date/time. Cancel or
   the ✕ backs out at any point; Import runs both restores in order.
   Used from Setting → Backup and from the first-run Setup wizard. */
'use strict';

window.RestoreFlow = (function () {

  function panel(no, title, hint) {
    return UI.el('<div class="rw-panel">' +
      '<div class="rw-head">' + no + ' · ' + title + '</div>' +
      '<div class="rw-file sub">' + hint + '</div>' +
      '<div class="rw-list"></div>' +
      '<input type="file" accept=".json,.AFdd,.zip,application/json,application/zip,application/octet-stream" class="hidden">' +
      '</div>');
  }

  function fmtWhen(json, ms) {
    var iso = (json && (json.exportedAt || json.at)) || null;
    var d = iso ? new Date(iso) : (ms ? new Date(ms) : null);
    return d ? d.toLocaleString('en-GB') : '(no date)';
  }
  /* v0.61 (#86): which files belong in which panel — the NAME only builds
     the list; the CONTENT is still verified on every selection */
  function nameMatches(wantFull, name) {
    if (/\.part$/i.test(name)) return false;
    return wantFull
      ? (/^AFbak-.*\.json$/i.test(name) || /full-backup.*\.json$/i.test(name))
      : (/\.AFdd$/i.test(name) || /^A-FiT/i.test(name));
  }

  function open(onDone) {
    var picked = { full: null, vault: null };
    var body = UI.el('<div><p class="sub">Restore in ONE go — the newest backup is ' +
      'pre-selected (tap another row to change), then Import. ' +
      'The files live in <b>Documents › S26-Alef-Fit</b> (or Downloads / your USB copy).</p></div>');
    var pFull = panel('1', 'Full backup', 'Tap to choose… (AFbak-DDMMYY.json — older alef-fit-4-full-backup files work too)');
    var pVault = panel('2', 'Vault backup (optional)', 'Tap to choose… (AFvault-….AFdd — older A-FiT-DD files work too)');
    body.appendChild(pFull);
    body.appendChild(pVault);
    var footNote = UI.el('<p class="sub" style="margin-top:6px">The Vault file is OPTIONAL — pick one only to bring ' +
      'Vault entries onto a phone that has none (imported entries are added as dated copies, never merged).</p>');
    body.appendChild(footNote);
    var nativeList = null; /* set when the app can read the folder itself */
    /* v0.62 (#89, Alef's ruling): most restores are an UPDATED app on the
       same S26 — the Vault is already there. The vault panel auto-selects
       ONLY when this device has NO vault entries (true new phone); with
       entries present it stays untouched unless Alef picks a file. */
    var vaultCount = 0, vaultKnown = false;

    function accept(p, key, wantFull, srcName, whenMs, raw) {
      var lbl = p.querySelector('.rw-file');
      return VaultKeep.parseBackup(raw).catch(function () { return null; }).then(function (json) {
        var isVault = !!(json && json.kind === 'vault-backup');
        var isFull = !!(json && json.app === 'alef.fit' && json.stores);
        if (!json || (wantFull && !isFull) || (!wantFull && !isVault)) {
          picked[key] = null;
          p.classList.remove('rw-ok');
          p.classList.add('rw-bad');
          lbl.innerHTML = '⚠ "' + UI.esc(srcName) + '" is not a ' + (wantFull ? 'Full backup' : 'Vault backup') + ' file — choose again';
          return false;
        }
        picked[key] = { json: json, name: srcName };
        p.classList.remove('rw-bad');
        p.classList.add('rw-ok');
        lbl.innerHTML = '✓ <b>' + UI.esc(srcName) + '</b><br>' + UI.esc(fmtWhen(json, whenMs)) +
          (wantFull ? '' : ' · ' + ((json.vault || []).length) + ' entries');
        p.querySelectorAll('.rw-row').forEach(function (rw) {
          rw.classList.toggle('on', rw.dataset.name === srcName);
        });
        return true;
      });
    }

    function wire(p, key, wantFull) {
      var inp = p.querySelector('input');
      p.addEventListener('click', function (e) {
        if (nativeList) return; /* the file rows do the picking */
        if (e.target !== inp) inp.click();
      });
      inp.addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () { accept(p, key, wantFull, f.name, f.lastModified, fr.result); };
        fr.readAsArrayBuffer(f);
        e.target.value = '';
      });
    }
    wire(pFull, 'full', true);
    wire(pVault, 'vault', false);

    /* v0.61 (#86): on the APK each panel lists the folder's matching
       files NEWEST FIRST and pre-selects the newest one that validates;
       the system picker stays one tap away for files living elsewhere. */
    function buildList(p, key, wantFull, autoPick) {
      var cands = nativeList.filter(function (f) { return nameMatches(wantFull, f.name); });
      var box = p.querySelector('.rw-list');
      box.innerHTML = '';
      function pickRow(f) {
        return Native.readBackupFile(f.name).then(function (raw) {
          if (!raw) return false;
          return accept(p, key, wantFull, f.name, f.mtime, raw);
        });
      }
      cands.slice(0, 6).forEach(function (f) {
        var d = f.mtime ? new Date(f.mtime).toLocaleString('en-GB') : '';
        var row = UI.el('<button type="button" class="rw-row" data-name="' + UI.esc(f.name) + '">' +
          '<span class="rw-nm">' + UI.esc(f.name) + '</span><span class="rw-dt sub">' + d + '</span></button>');
        row.addEventListener('click', function (ev) { ev.stopPropagation(); pickRow(f); });
        box.appendChild(row);
      });
      var more = UI.el('<button type="button" class="rw-row rw-more">📂 Choose another file…</button>');
      more.addEventListener('click', function (ev) { ev.stopPropagation(); p.querySelector('input').click(); });
      box.appendChild(more);
      if (!autoPick) return;
      var i = 0; /* auto-select: newest candidate that VALIDATES (tries 3) */
      function tryNext() {
        if (i >= Math.min(3, cands.length)) return null;
        var f = cands[i++];
        return pickRow(f).then(function (okd) { return okd ? null : tryNext(); });
      }
      if (cands.length) {
        p.querySelector('.rw-file').textContent = 'Checking newest file…';
        tryNext();
      }
    }
    DB.all('todos').then(function (rows) {
      vaultCount = rows.filter(function (r) { return r.cat === 'vault'; }).length;
      vaultKnown = true;
      if (vaultCount > 0) {
        pVault.querySelector('.rw-file').innerHTML = 'Vault already on this phone (<b>' + vaultCount +
          ' entr' + (vaultCount === 1 ? 'y' : 'ies') + '</b>) — leave this empty to KEEP it, or pick a file to add its entries as dated copies.';
      }
      if (window.Native && Native.listBackups) {
        Native.listBackups().then(function (list) {
          if (!list || !list.length) return;
          nativeList = list;
          buildList(pFull, 'full', true, true);
          buildList(pVault, 'vault', false, vaultCount === 0);
        });
      }
    });

    UI.modal('Import to new phone', body, [
      { label: 'Cancel' },
      {
        label: 'Import', primary: true, onClick: function (close) {
          /* v0.62 (#89): Full is required; the Vault file is OPTIONAL —
             on an updated app the Vault is already on the phone. */
          if (!picked.full) {
            UI.toast('Select a Full backup first (or Cancel)');
            return;
          }
          if (!picked.vault && vaultKnown && vaultCount === 0) {
            UI.toast('No Vault on this phone and no Vault file picked — Vault entries will NOT be restored');
            /* one nudge, then a second tap proceeds */
            vaultKnown = false;
            return;
          }
          close();
          UI.toast('Restoring full backup…');
          DB.importAll(picked.full.json, { mode: 'merge' }).then(function (c) {
            UI.toast('Data restored: +' + c.added + ' new, ' + c.updated + ' updated');
            return picked.vault ? DB.importVault(picked.vault.json) : null;
          }).then(function (v) {
            App.applySettings();
            UI.toast(v ? 'Vault restored: +' + v.added + ' entries ✓ — restore complete'
              : 'Restore complete ✓ — the phone Vault was left as it is');
            if (onDone) onDone();
          }).catch(function (err) {
            UI.toast(String((err && err.message) || err));
          });
        }
      }
    ]);
  }

  return { open: open };
})();
