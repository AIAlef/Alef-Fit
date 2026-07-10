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

    /* ---- backup & sync ---- */
    pad.appendChild(UI.el('<div class="section-title">Backup & sync</div>'));
    var bk = UI.el('<div class="card"></div>');
    bk.appendChild(UI.el('<div class="sub" style="margin-bottom:10px">Sync file = all data + only media added since the last export (small, for regular PC ↔ phone moves). Full backup = everything incl. all media. Import <b>merges</b>: newest change wins per record, deletions carry over, nothing is lost.</div>'));
    var expSyncBtn = UI.el('<button class="btn btn-primary btn-block" style="margin-bottom:8px">' + UI.icon('download') + ' Export sync file</button>');
    expSyncBtn.addEventListener('click', function () {
      DB.exportAll({ media: 'since' }).then(function (data) {
        UI.download('alef-fit-sync-' + DB.todayISO() + '.json', JSON.stringify(data));
        UI.toast('Sync file exported (' + data.stores.media.length + ' new media)');
      });
    });
    bk.appendChild(expSyncBtn);
    var expBtn = UI.el('<button class="btn btn-block" style="margin-bottom:8px">' + UI.icon('download') + ' Export full backup</button>');
    expBtn.addEventListener('click', function () {
      DB.exportAll({ media: 'all' }).then(function (data) {
        UI.download('alef-fit-backup-' + DB.todayISO() + '.json', JSON.stringify(data));
        UI.toast('Full backup exported to Downloads');
      });
    });
    bk.appendChild(expBtn);
    var impBtn = UI.el('<button class="btn btn-block">' + UI.icon('upload') + ' Import / merge file</button>');
    var impFile = UI.el('<input type="file" accept=".json,application/json" class="hidden">');
    impBtn.addEventListener('click', function () { impFile.click(); });
    impFile.addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        var json;
        try { json = JSON.parse(fr.result); } catch (err) { UI.toast('Not a valid backup file'); return; }
        var when = (json.exportedAt || '?').slice(0, 10);
        var body = UI.el('<div><p>File from <b>' + UI.esc(when) + '</b>. How should it be applied?</p>' +
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
      };
      fr.readAsText(f);
      e.target.value = '';
    });
    bk.appendChild(impBtn);
    bk.appendChild(impFile);
    var usage = UI.el('<div class="sub" style="margin-top:10px">Storage: …</div>');
    DB.storageEstimate().then(function (est) {
      if (est) usage.textContent = 'Storage used: ' + (est.usage / 1048576).toFixed(1) + ' MB of ' + (est.quota / 1048576 / 1024).toFixed(1) + ' GB available';
      else usage.remove();
    });
    bk.appendChild(usage);
    pad.appendChild(bk);

    /* ---- Google Drive sync ---- */
    pad.appendChild(UI.el('<div class="section-title">Google Drive sync</div>'));
    var sy = UI.el('<div class="card"></div>');
    sy.appendChild(UI.el('<div class="sub" style="margin-bottom:10px">Two-way sync through your Google Drive (hidden app folder): pulls the other device\'s changes, merges, pushes yours — media transfers only what\'s missing. One-time setup: a Google OAuth client ID (see docs/SYNC-SETUP.md in the project).</div>'));
    var cidRow = UI.el('<label class="field"><span class="field-label">Google OAuth client ID</span>' +
      '<input type="text" id="sy-cid" placeholder="…apps.googleusercontent.com" value="' + UI.esc(s.gdriveClientId || '') + '"></label>');
    cidRow.querySelector('#sy-cid').addEventListener('change', function (e) {
      DB.saveSettings({ gdriveClientId: e.target.value.trim() });
    });
    sy.appendChild(cidRow);
    var secRow = UI.el('<label class="field"><span class="field-label">Google client secret</span>' +
      '<input type="password" id="sy-sec" placeholder="GOCSPX-…" value="' + UI.esc(s.gdriveClientSecret || '') + '"></label>');
    secRow.querySelector('#sy-sec').addEventListener('change', function (e) {
      DB.saveSettings({ gdriveClientSecret: e.target.value.trim() });
    });
    sy.appendChild(secRow);
    var syBtn = UI.el('<button class="btn btn-primary btn-block">' + UI.icon('upload') + ' Sync now</button>');
    var syStatus = UI.el('<div class="sub" style="margin-top:8px"></div>');
    DB.get('meta', 'lastDriveSyncAt').then(function (r) {
      if (r) syStatus.textContent = 'Last synced: ' + new Date(r.value).toLocaleString();
    });
    syBtn.addEventListener('click', function () {
      if (!Sync.hasClientId()) { UI.toast('Set the Google client ID and secret first'); return; }
      syBtn.disabled = true;
      Sync.syncNow(function (msg) { syStatus.textContent = msg; })
        .then(function (res) {
          syBtn.disabled = false;
          var p = res.pulled || { added: 0, updated: 0, deleted: 0, conflicts: 0, mediaAdded: 0 };
          syStatus.textContent = 'Last synced: ' + new Date().toLocaleString();
          UI.toast('Synced: +' + p.added + ' / ~' + p.updated + ' / \u2212' + p.deleted +
            ' \u00b7 media \u2191' + res.mediaUp + ' \u2193' + res.mediaDown);
          App.applySettings();
        })
        .catch(function (err) {
          syBtn.disabled = false;
          syStatus.textContent = String(err.message || err);
          UI.toast(String(err.message || err));
        });
    });
    sy.appendChild(syBtn);
    sy.appendChild(syStatus);
    pad.appendChild(sy);

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
    infoEntry('How to Sync', 'Backup & sync — files, merge, daily routine',
      '<div class="sub" style="margin-bottom:6px"><b>Daily:</b> tap <b>Sync now</b> after training — the other device syncs when you open it.</div>' +
      '<table class="info-table"><tr><th>File</th><th>Contains</th><th>Use for</th></tr>' +
      '<tr><td>Sync file</td><td>all data + only NEW media</td><td>moving changes (PC file window, offline)</td></tr>' +
      '<tr><td>Full backup</td><td>all data + ALL media</td><td>safety copy / restore</td></tr></table>' +
      '<div class="sub" style="margin:6px 0"><b>Import → Merge:</b> combines both sides, newest change wins, deletions carry over (never loses data).<br>' +
      '<b>Import → Replace all:</b> wipes this device first — recovery only.</div>' +
      '<div class="sub"><b>Routine:</b> 1) after training → Sync now · 2) every few weeks → Export full backup (keep in Drive) · 3) PC file window → Export sync file → Import/Merge here · 4) new or broken device → full backup → Replace all.</div>');
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
      ['Discipline — modules', [['todo', 'Fitness To-do list'], ['note', 'Fitness Note'], ['bb', 'Bodybuilding'], ['alarm', 'Alarm Reminder'], ['walk', 'Incline Walk']].map(function (m) {
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
