/* Alef.Fit — Program tab: editable categories → programs (drag to move/sort)
   → program screen with inline days + exercises → autosaving log screen. */
'use strict';

window.Screens = window.Screens || {};

Screens.program = (function () {

  function render(el, parts) {
    if (!parts.length) return renderHome(el);
    if (parts[0] === 'p') {
      if (parts.length === 2) return renderProgram(el, parts[1]);
      if (parts[2] === 'd') return renderProgram(el, parts[1]); /* legacy day links */
      if (parts[2] === 'log' && parts.length === 5) return renderLog(el, parts[1], parseInt(parts[3], 10), parts[4]);
    }
    renderHome(el);
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

  var PROG_BGS = ['', 'pg1', 'pg2', 'pg3', 'pg4', 'pg5', 'pg6', 'pg7', 'pg8'];
  var PROG_STATUSES = [
    ['active', 'Active — gold frame'], ['incoming', 'Incoming — silver frame'],
    ['reserve', 'Reserve — normal'], ['old', 'Old — dimmed + stamp']
  ];

  /* edit a program: name, status (Active/Incoming/Reserve/Old), card style */
  function editProgramForm(p, onSaved) {
    var body = UI.el('<div>' +
      UI.field('Program name', '<input type="text" id="ep-name" value="' + UI.esc(p.name) + '">') +
      UI.field('Status', '<select id="ep-status">' + PROG_STATUSES.map(function (o) {
        return '<option value="' + o[0] + '"' + ((p.status || 'reserve') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>') +
      '<div class="field"><span class="field-label">Card background</span><div id="ep-bgs"></div></div>' +
      '</div>');
    var sel = p.bg || '';
    var wrap = body.querySelector('#ep-bgs');
    PROG_BGS.forEach(function (k) {
      var sw = UI.el('<button type="button" class="pbg-swatch' + (sel === k ? ' on' : '') + '" aria-label="' + (k || 'plain') + '"></button>');
      if (k) sw.style.backgroundImage = 'url(assets/progbg/' + k + '.jpg)';
      sw.addEventListener('click', function () {
        sel = k;
        wrap.querySelectorAll('.pbg-swatch').forEach(function (x) { x.classList.remove('on'); });
        sw.classList.add('on');
      });
      wrap.appendChild(sw);
    });
    UI.modal('Edit program', body, [
      { label: 'Cancel' },
      {
        label: 'Save', primary: true, onClick: function (close) {
          var name = body.querySelector('#ep-name').value.trim();
          if (!name) { UI.toast('Name is required'); return; }
          p.name = name;
          p.status = body.querySelector('#ep-status').value;
          p.bg = sel;
          DB.put('programs', p).then(function () { UI.toast('Saved'); close(); onSaved && onSaved(); });
        }
      }
    ]);
  }

  /* ---------- home: every category with its programs, all on one page ---------- */
  function renderHome(el) {
    el.appendChild(UI.header({
      title: 'Program',
      action: {
        icon: 'edit', label: 'Edit categories', onClick: function () {
          DB.getProgramCats().then(catManager);
        }
      }
    }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    /* getProgramCats first — its one-time migration may rewrite programs */
    DB.getProgramCats().then(function (cats) {
      return DB.all('programs').then(function (progs) { return [cats, progs]; });
    }).then(function (res) {
      var cats = res[0], progs = res[1];
      progs.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      cats.forEach(function (cat) {
        var head = UI.el('<div class="cat-head" data-cat="' + UI.esc(cat) + '">' +
          '<span class="cat-name">' + UI.esc(cat) + '</span>' +
          '<button class="btn-mini plus" aria-label="add program to ' + UI.esc(cat) + '">' + UI.icon('plus') + '</button></div>');
        head.querySelector('button').addEventListener('click', function () { newProgramForm(cat); });
        pad.appendChild(head);
        var zone = UI.el('<div class="cat-zone" data-cat="' + UI.esc(cat) + '"></div>');
        var inCat = progs.filter(function (p) { return p.category === cat; });
        if (!inCat.length) zone.appendChild(UI.el('<div class="cat-empty sub">no programs</div>'));
        inCat.forEach(function (p) { zone.appendChild(progRow(p)); });
        pad.appendChild(zone);
      });
    });
  }

  function progRow(p) {
    var days = (p.days || []).length;
    var st = p.status || 'reserve';
    var row = UI.el('<div class="list prog-row prog-status-' + st + '" data-id="' + p.id + '">' +
      '<div class="list-item">' +
      '<span class="drag-handle" aria-label="drag to move">≡</span>' +
      '<span class="li-main"><span class="li-title">' + UI.esc(p.name) + '</span></span>' +
      '<span class="prog-days">' + days + 'd</span>' +
      '<span class="chev">' + UI.icon('chev') + '</span>' +
      (st === 'old' ? '<span class="prog-stamp">OLD</span>' : '') +
      '</div></div>');
    if (p.bg) {
      row.classList.add('has-bg');
      row.style.backgroundImage = 'url(assets/progbg/' + p.bg + '.jpg)';
    }
    row.querySelector('.list-item').addEventListener('click', function () {
      if (row.dataset.dragged) { delete row.dataset.dragged; return; }
      location.hash = '#/program/p/' + p.id;
    });
    enableDrag(row, p);
    return row;
  }

  /* Pointer-based drag & drop (works with touch on the S26): grab the ≡
     handle, drop on another program (insert before it) or on a category
     header/zone (append to that category). */
  function enableDrag(row, p) {
    var handle = row.querySelector('.drag-handle');
    handle.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var startX = e.clientX, startY = e.clientY, dragging = false, ghost = null;
      function targetAt(x, y) {
        if (!document.elementFromPoint) return null;
        var elx = document.elementFromPoint(x, y);
        if (!elx) return null;
        var r = elx.closest ? elx.closest('.prog-row') : null;
        if (r && r !== row) return { row: r };
        var z = elx.closest ? elx.closest('.cat-zone, .cat-head') : null;
        if (z) return { zone: z.classList.contains('cat-head') ? z.nextElementSibling : z };
        return null;
      }
      function clearHints() {
        document.querySelectorAll('.drop-hint').forEach(function (n) { n.classList.remove('drop-hint'); });
      }
      function onMove(ev) {
        if (!dragging && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 8) return;
        if (!dragging) {
          dragging = true;
          ghost = row.cloneNode(true);
          ghost.className = 'drag-ghost';
          ghost.style.width = row.offsetWidth + 'px';
          document.body.appendChild(ghost);
          row.classList.add('drag-src');
        }
        ghost.style.left = (ev.clientX - 24) + 'px';
        ghost.style.top = (ev.clientY - 28) + 'px';
        clearHints();
        var t = targetAt(ev.clientX, ev.clientY);
        if (t) (t.row || t.zone).classList.add('drop-hint');
      }
      function onUp(ev) {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        clearHints();
        if (ghost) ghost.remove();
        row.classList.remove('drag-src');
        if (!dragging) return;
        row.dataset.dragged = '1';
        var t = targetAt(ev.clientX, ev.clientY);
        if (!t) return;
        var zone = t.zone || t.row.closest('.cat-zone');
        if (!zone || !zone.dataset.cat) return;
        var cat = zone.dataset.cat;
        DB.all('programs').then(function (all) {
          var byId = {};
          all.forEach(function (q) { byId[q.id] = q; });
          var ids = Array.prototype.map.call(zone.querySelectorAll('.prog-row'), function (n) { return n.dataset.id; })
            .filter(function (id) { return id !== p.id; });
          var insertAt = ids.length;
          if (t.row) {
            insertAt = ids.indexOf(t.row.dataset.id);
            if (insertAt < 0) insertAt = ids.length;
          }
          ids.splice(insertAt, 0, p.id);
          var puts = ids.map(function (id, i) {
            var q = byId[id];
            if (!q) return Promise.resolve();
            q.order = (i + 1) * 10;
            if (id === p.id) q.category = cat;
            return DB.put('programs', q);
          });
          Promise.all(puts).then(function () { App.route(); });
        });
      }
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  }

  /* ---------- category manager: add / rename / remove ---------- */
  function catManager(cats) {
    var list = cats.slice();
    var body = UI.el('<div><div id="cm-list"></div>' +
      '<div class="row2" style="margin-top:8px"><input type="text" id="cm-new" placeholder="New category name">' +
      '<button class="btn" id="cm-add" style="flex:0 0 auto" aria-label="add category">' + UI.icon('plus') + '</button></div></div>');
    function draw() {
      var wrap = body.querySelector('#cm-list');
      wrap.innerHTML = '';
      list.forEach(function (name, i) {
        var rowEl = UI.el('<div class="list-item" style="padding:8px 4px"><span class="li-main">' + UI.esc(name) + '</span>' +
          '<button class="btn-icon" data-a="ren" aria-label="rename">' + UI.icon('edit') + '</button>' +
          '<button class="btn-icon" data-a="del" aria-label="delete">' + UI.icon('trash') + '</button></div>');
        rowEl.querySelector('[data-a=ren]').addEventListener('click', function () {
          nameForm('Rename category', name, function (newName) {
            if (newName === name) return;
            if (list.indexOf(newName) >= 0) { UI.toast('Name already exists'); return; }
            DB.byIndex('programs', 'category', name).then(function (ps) {
              return Promise.all(ps.map(function (q) { q.category = newName; return DB.put('programs', q); }));
            }).then(function () {
              list[i] = newName;
              return DB.saveProgramCats(list);
            }).then(draw);
          });
        });
        rowEl.querySelector('[data-a=del]').addEventListener('click', function () {
          DB.byIndex('programs', 'category', name).then(function (ps) {
            if (ps.length) { UI.toast('Move or delete its ' + ps.length + ' program(s) first'); return; }
            UI.confirm('Delete category "' + name + '"?', 'Delete').then(function (ok) {
              if (!ok) return;
              list.splice(i, 1);
              DB.saveProgramCats(list).then(draw);
            });
          });
        });
        wrap.appendChild(rowEl);
      });
    }
    body.querySelector('#cm-add').addEventListener('click', function () {
      var v = body.querySelector('#cm-new').value.trim();
      if (!v) return;
      if (list.indexOf(v) >= 0) { UI.toast('Already exists'); return; }
      list.push(v);
      body.querySelector('#cm-new').value = '';
      DB.saveProgramCats(list).then(draw);
    });
    draw();
    UI.modal('Edit categories', body, [
      { label: 'Done', primary: true, onClick: function (close) { close(); App.route(); } }
    ]);
  }

  function newProgramForm(cat) {
    var body = UI.el('<div>' + UI.field('Program name', '<input type="text" id="pf-name" placeholder="e.g. Body Project">') + '</div>');
    UI.modal('New program — ' + cat, body, [
      { label: 'Cancel' },
      {
        label: 'Create', primary: true, onClick: function (close) {
          var name = body.querySelector('#pf-name').value.trim();
          if (!name) { UI.toast('Name is required'); return; }
          var p = {
            id: DB.uid(), name: name, category: cat, order: Date.now(),
            days: [{ dayNo: 1, name: '', items: [] }, { dayNo: 2, name: '', items: [] }, { dayNo: 3, name: '', items: [] }],
            createdAt: Date.now()
          };
          DB.put('programs', p).then(function () { close(); location.hash = '#/program/p/' + p.id; });
        }
      }
    ]);
  }

  /* ---------- program screen: days inline with their exercises ---------- */
  function renderProgram(el, pid) {
    Promise.all([DB.get('programs', pid), DB.all('exercises').then(DB.hydrateExMedia)]).then(function (res) {
      var p = res[0], allX = res[1];
      if (!p) { el.appendChild(UI.emptyState('Program not found')); return; }
      var xById = {};
      allX.forEach(function (x) { xById[x.id] = x; });

      el.appendChild(UI.header({
        title: p.name, back: '#/program',
        action: {
          icon: 'edit', label: 'Edit program', onClick: function () {
            editProgramForm(p, function () { App.route(); });
          }
        }
      }));
      var pad = UI.el('<div class="pagepad"></div>');
      el.appendChild(pad);

      (p.days || []).sort(function (a, b) { return a.dayNo - b.dayNo; }).forEach(function (day) {
        var head = UI.el('<div class="day-head">' +
          '<span class="day-title">Day ' + day.dayNo + (day.name ? ' — ' + UI.esc(day.name) : '') + '</span>' +
          '<button class="btn-icon sm" data-a="edit" aria-label="edit day">' + UI.icon('edit') + '</button>' +
          '<span style="flex:1"></span>' +
          '<button class="btn-mini plus" data-a="add" aria-label="add exercise to day ' + day.dayNo + '">' + UI.icon('plus') + '</button></div>');
        head.querySelector('[data-a=edit]').addEventListener('click', function () { dayForm(p, day); });
        head.querySelector('[data-a=add]').addEventListener('click', function () {
          UI.pickExercise(allX, function (x) {
            itemForm(p, day, { exerciseId: x.id, targetSets: 4, targetReps: '12/10/8/6', note: '' }, true, x.name);
          });
        });
        pad.appendChild(head);

        if ((day.items || []).length) {
          var list = UI.el('<div class="list day-list"></div>');
          day.items.forEach(function (item, idx) {
            var x = xById[item.exerciseId];
            var thumb = x ? Screens.exercise.firstImage(x) : null;
            var it = UI.el('<div class="list-item">' +
              (thumb ? '<img class="li-thumb" src="' + thumb + '" alt="">' : '<span class="li-thumb">' + UI.icon('muscle') + '</span>') +
              '<span class="li-main"><span class="li-title">' + UI.esc(x ? x.name : '(deleted exercise)') + '</span>' +
              '<span class="li-sub">' + item.targetSets + ' × ' + UI.esc(item.targetReps) + (item.note ? ' · 📝' : '') + '</span></span>' +
              '<button class="btn-icon sm" data-a="edit" aria-label="edit target & note">' + UI.icon('edit') + '</button>' +
              '<button class="btn-icon sm" data-a="del" aria-label="remove">' + UI.icon('trash') + '</button></div>');
            it.querySelector('[data-a=edit]').addEventListener('click', function (e) {
              e.stopPropagation();
              itemForm(p, day, item, false, x ? x.name : 'Exercise');
            });
            it.querySelector('[data-a=del]').addEventListener('click', function (e) {
              e.stopPropagation();
              UI.confirm('Remove from Day ' + day.dayNo + '?', 'Remove').then(function (ok) {
                if (!ok) return;
                day.items.splice(idx, 1);
                DB.put('programs', p).then(function () { App.route(); });
              });
            });
            it.addEventListener('click', function () {
              if (x) location.hash = '#/program/p/' + pid + '/log/' + day.dayNo + '/' + x.id;
            });
            list.appendChild(it);
          });
          pad.appendChild(list);
        } else {
          pad.appendChild(UI.el('<div class="cat-empty sub">no exercises — tap +</div>'));
        }
      });

      if ((p.days || []).length < 7) {
        var addDay = UI.el('<button class="btn btn-block day-add">' + UI.icon('plus') + ' Day ' + (p.days.length + 1) + '</button>');
        addDay.addEventListener('click', function () {
          p.days.push({ dayNo: p.days.length + 1, name: '', items: [] });
          DB.put('programs', p).then(function () { App.route(); });
        });
        pad.appendChild(addDay);
      }

      var del = UI.el('<button class="btn btn-danger btn-block" style="margin-top:14px">' + UI.icon('trash') + ' Delete program</button>');
      del.addEventListener('click', function () {
        UI.confirm('Delete "' + p.name + '"? Logged history stays.', 'Delete').then(function (ok) {
          if (ok) DB.del('programs', pid).then(function () { location.hash = '#/program'; });
        });
      });
      pad.appendChild(del);
    });
  }

  /* day label edit; days 4+ can be deleted (exercises removed, later days renumbered) */
  function dayForm(p, day) {
    var body = UI.el('<div>' +
      UI.field('Day label', '<input type="text" id="df-name" value="' + UI.esc(day.name || '') + '" placeholder="e.g. Chest & Triceps">') +
      '</div>');
    if (day.dayNo >= 4) {
      var del = UI.el('<button class="btn btn-danger btn-block">' + UI.icon('trash') + ' Delete Day ' + day.dayNo + '</button>');
      del.addEventListener('click', function () {
        var n = (day.items || []).length;
        UI.confirm('Delete Day ' + day.dayNo + (n ? ' and its ' + n + ' exercise(s)?' : '?'), 'Delete').then(function (ok) {
          if (!ok) return;
          p.days = p.days.filter(function (d) { return d !== day; });
          p.days.forEach(function (d) { if (d.dayNo > day.dayNo) d.dayNo--; });
          DB.put('programs', p).then(function () {
            UI.toast('Day deleted');
            document.querySelectorAll('.modal-wrap').forEach(function (m) { m.remove(); });
            App.route();
          });
        });
      });
      body.appendChild(del);
    }
    UI.modal('Day ' + day.dayNo, body, [
      { label: 'Cancel' },
      {
        label: 'Save', primary: true, onClick: function (close) {
          day.name = body.querySelector('#df-name').value.trim();
          DB.put('programs', p).then(function () { close(); App.route(); });
        }
      }
    ]);
  }

  /* target sets/reps + note (note shows in the logging screen) */
  function itemForm(p, day, item, isNew, xname) {
    var body = UI.el('<div>' +
      '<div class="row2">' +
      UI.field('Target sets', '<input type="number" id="if-sets" min="1" max="15" value="' + (item.targetSets || 4) + '">') +
      UI.field('Target reps', '<input type="text" id="if-reps" value="' + UI.esc(item.targetReps || '10') + '" placeholder="e.g. 12/10/8/6">') +
      '</div>' +
      UI.field('Note (shows under previous records when logging)', '<textarea id="if-note" style="min-height:70px">' + UI.esc(item.note || '') + '</textarea>') +
      '</div>');
    UI.modal(xname, body, [
      { label: 'Cancel' },
      {
        label: isNew ? 'Add' : 'Save', primary: true, onClick: function (close) {
          item.targetSets = parseInt(body.querySelector('#if-sets').value, 10) || 4;
          item.targetReps = body.querySelector('#if-reps').value.trim() || '10';
          item.note = body.querySelector('#if-note').value.trim();
          if (isNew) day.items.push(item);
          DB.put('programs', p).then(function () { close(); App.route(); });
        }
      }
    ]);
  }

  /* ---------- logging screen ---------- */
  function renderLog(el, pid, dayNo, xid) {
    Promise.all([DB.get('programs', pid), DB.get('exercises', xid).then(function (x) { return x ? DB.hydrateExMedia(x) : x; }), DB.byIndex('logs', 'exerciseId', xid)]).then(function (res) {
      var p = res[0], x = res[1], history = res[2];
      if (!x) { el.appendChild(UI.emptyState('Exercise not found')); return; }
      el.appendChild(UI.header({ title: x.name, back: '#/program/p/' + pid }));
      var pad = UI.el('<div class="pagepad"></div>');
      el.appendChild(pad);

      /* media carousel: videos autoplay muted in a loop; tap right/left half
         of the stage for next/previous when there is more than one item. */
      var media = x.media || [];
      if (media.length) {
        var stage = UI.el('<div class="media-stage"></div>');
        var dots = UI.el('<div class="media-dots"></div>');
        var idx = 0;
        function show(i) {
          idx = (i + media.length) % media.length;
          stage.innerHTML = '';
          var m = media[idx];
          if (m.type === 'video') {
            var v = document.createElement('video');
            v.src = m.dataUrl; v.muted = true; v.loop = true; v.autoplay = true;
            v.playsInline = true; v.setAttribute('playsinline', '');
            stage.appendChild(UI.cropWrap(v, m.crop));
            var pr = v.play && v.play();
            if (pr && pr.catch) pr.catch(function () { /* will play on tap */ });
          } else {
            stage.appendChild(UI.cropWrap(UI.el('<img src="' + m.dataUrl + '" alt="">'), m.crop));
          }
          if (media.length > 1) {
            dots.innerHTML = media.map(function (_, d) {
              return '<span' + (d === idx ? ' class="on"' : '') + '></span>';
            }).join('');
          }
        }
        if (media.length > 1) {
          stage.addEventListener('click', function (e) {
            var r = stage.getBoundingClientRect();
            var frac = (e.clientX - r.left) / r.width;
            if (frac >= 0.75) show(idx + 1);        /* right quarter → next */
            else if (frac <= 0.25) show(idx - 1);   /* left quarter → previous */
            /* center 50%: no navigation */
          });
        }
        show(0);
        pad.appendChild(stage);
        pad.appendChild(dots);
      }

      var item = null;
      if (p) {
        var day = (p.days || []).find(function (d) { return d.dayNo === dayNo; });
        if (day) item = (day.items || []).find(function (i) { return i.exerciseId === xid; });
      }

      /* title line: Record sets · Target · save status (compact for S26) */
      pad.appendChild(UI.el('<div class="section-title rec-title">Record sets' +
        (item ? '<span class="target-inline">Target ' + item.targetSets + ' × ' + UI.esc(item.targetReps) + '</span>' : '') +
        '<span id="lg-status" class="sub" style="text-transform:none"></span></div>'));

      /* record entry — autosaves; bare row aligned with past records below */
      var card = UI.el('<div class="rec-entry"></div>');
      pad.appendChild(card);
      var today = DB.todayISO();
      var targetSets = item ? item.targetSets : 4;
      var dateVal = today;
      var currentLog = null;
      var t = null;
      var saveTimer = null;

      function dmy(iso) { var q = iso.split('-'); return q[2] + '-' + q[1] + '-' + q[0]; }
      function findLog(d) {
        return history.find(function (h) { return h.date === d; }) || null;
      }
      function lastSets() {
        var hs = history.filter(function (h) { return !currentLog || h.id !== currentLog.id; });
        hs.sort(function (a, b) { return a.date.localeCompare(b.date); });
        return hs.length ? hs[hs.length - 1].sets : [];
      }
      function flash(msg) {
        var st = document.getElementById('lg-status');
        if (!st) return;
        st.textContent = msg;
        setTimeout(function () { if (st.textContent === msg) st.textContent = ''; }, 1600);
      }
      function doSave() {
        saveTimer = null;
        var sets = t.getSets();
        if (!sets.length) {
          if (currentLog) {
            var dead = currentLog;
            currentLog = null;
            history = history.filter(function (h) { return h.id !== dead.id; });
            DB.del('logs', dead.id).then(function () { flash('record removed'); drawPast(); });
          }
          return;
        }
        if (currentLog) {
          currentLog.sets = sets;
          currentLog.date = dateVal;
          DB.put('logs', currentLog).then(function () { flash('✓ saved'); });
        } else {
          currentLog = { id: DB.uid(), exerciseId: xid, programId: pid, dayNo: dayNo, date: dateVal, sets: sets, note: '' };
          history.push(currentLog);
          DB.put('logs', currentLog).then(function () { flash('✓ saved'); drawPast(); });
        }
      }
      function onTableChange() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(doSave, 500);
      }
      function flushPending() {
        if (saveTimer) { clearTimeout(saveTimer); doSave(); }
      }
      function buildEntry() {
        card.innerHTML = '';
        var row = UI.el('<div class="rec-hist" style="margin-bottom:0"></div>');
        var side = UI.el('<div class="rec-side">' +
          '<div class="rec-date rec-date-input"><span id="lg-dchip">' + dmy(dateVal) + '</span>' +
          '<input type="date" id="lg-date" value="' + dateVal + '" max="' + today + '"></div>' +
          '<button class="rec-del" id="lg-del" aria-label="delete record of this date">−</button></div>');
        row.appendChild(side);
        currentLog = findLog(dateVal);
        if (currentLog) t = UI.recTable(currentLog.sets, { minCols: targetSets, onChange: onTableChange });
        else t = UI.recTable(lastSets(), { minCols: targetSets, ghost: true, onChange: onTableChange });
        row.appendChild(t.root);
        card.appendChild(row);
        side.querySelector('#lg-date').addEventListener('change', function (e) {
          var v = e.target.value;
          if (!v) return;
          if (v > today) { UI.toast('Future dates are not allowed'); e.target.value = dateVal; return; }
          flushPending();
          dateVal = v;
          buildEntry();
          drawPast();
        });
        side.querySelector('#lg-del').addEventListener('click', function () {
          if (!currentLog) { UI.toast('No saved record on ' + dmy(dateVal)); return; }
          UI.confirm('Delete the record of ' + dmy(dateVal) + '?', 'Delete').then(function (ok) {
            if (!ok) return;
            var dead = currentLog;
            currentLog = null;
            history = history.filter(function (h) { return h.id !== dead.id; });
            DB.del('logs', dead.id).then(function () {
              UI.toast('Record deleted');
              buildEntry();
              drawPast();
            });
          });
        });
      }

      /* past records — same row pattern, aligned with the entry above */
      var pastWrap = UI.el('<div></div>');
      pad.appendChild(pastWrap);
      function drawPast() {
        pastWrap.innerHTML = '';
        var rows = history.filter(function (h) { return !currentLog || h.id !== currentLog.id; });
        rows.sort(function (a, b) { return b.date.localeCompare(a.date); });
        rows.slice(0, 6).forEach(function (h) {
          pastWrap.appendChild(UI.recPastRow(h, function () {
            history = history.filter(function (q) { return q.id !== h.id; });
            drawPast();
          }));
        });
      }

      buildEntry();
      drawPast();

      /* exercise note from the program item — below the previous records */
      if (item && item.note) {
        pad.appendChild(UI.el('<div class="lg-note sub">📝 ' + UI.esc(item.note) + '</div>'));
      }
    });
  }

  return { render: render };
})();
