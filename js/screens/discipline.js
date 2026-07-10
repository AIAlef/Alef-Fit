/* Alef.Fit — Discipline tab: Fitness To-do list, Fitness Note, Bodybuilding,
   Alarm Reminder, Incline Walk recorder. */
'use strict';

window.Screens = window.Screens || {};

Screens.discipline = (function () {

  var MODULES = [
    { id: 'todo',  name: 'Alef.do',            icon: 'todo',   sub: 'Now / Today / Later — sort, tag, do' },
    { id: 'note',  name: 'Fitness Note',       icon: 'note',   sub: 'Plans, strategy, motivation' },
    { id: 'bb',    name: 'Bodybuilding',       icon: 'muscle', sub: 'Knowledge, technique, image collection' },
    { id: 'alarm', name: 'Alarm Reminder',     icon: 'bell',   sub: 'Repeating training alarms' },
    { id: 'walk',  name: 'Incline Walk',       icon: 'walk',   sub: '12-3-30 style treadmill sessions' }
  ];

  function render(el, parts) {
    if (!parts.length) return renderHome(el);
    if (parts[0] === 'todo') return parts[1] === 'moment' ? renderMoment(el) : renderTodo(el);
    if (parts[0] === 'alarm') return renderAlarm(el);
    if (parts[0] === 'walk') return renderWalk(el);
    if (parts[0] === 'note') return renderNotes(el, 'note', 'Fitness Note', parts.slice(1));
    if (parts[0] === 'bb') return renderNotes(el, 'bb', 'Bodybuilding', parts.slice(1));
    renderHome(el);
  }

  function renderHome(el) {
    el.appendChild(UI.header({ title: 'Discipline' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var bg = (DB.getSettings().cardBg) || {};
    MODULES.forEach(function (m) {
      var card = UI.el('<a class="card" href="#/discipline/' + m.id + '">' +
        '<h2>' + UI.icon(m.icon) + ' ' + UI.esc(m.name) + '</h2>' +
        '<div class="sub">' + UI.esc(m.sub) + '</div>' +
        '<span class="count-badge">' + UI.icon('chev') + '</span></a>');
      card.classList.add('has-bg');
      card.style.backgroundImage = 'url(' + (bg['disc-' + m.id] || 'assets/cardbg/disc-' + m.id + '.jpg') + ')';
      pad.appendChild(card);
    });
  }

  /* ================= Alef.do (task manager) ================= */

  var TIMED_ALERTS = [
    { v: null, t: 'None' }, { v: 0, t: 'At time of event' },
    { v: 5, t: '5 mins before' }, { v: 10, t: '10 mins before' }, { v: 15, t: '15 mins before' },
    { v: 30, t: '30 mins before' }, { v: 45, t: '45 mins before' },
    { v: 60, t: '1 hr before' }, { v: 120, t: '2 hrs before' }, { v: 180, t: '3 hrs before' },
    { v: 360, t: '6 hrs before' }, { v: 720, t: '12 hrs before' },
    { v: 1440, t: '1 day before' }, { v: 2880, t: '2 days before' }, { v: 4320, t: '3 days before' }
  ];
  var ALLDAY_ALERTS = [
    { v: 'none', t: 'None' }, { v: 'P0D', t: 'On day of event' },
    { v: 'P1D', t: '1 day before' }, { v: 'P2D', t: '2 days before' }, { v: 'P7D', t: '7 days before' }
  ];
  function alertOpts(list, current, useDefault) {
    return list.map(function (o) {
      var sel = (current === undefined ? useDefault === o.v : current === o.v);
      return '<option value="' + o.v + '"' + (sel ? ' selected' : '') + '>' + o.t + '</option>';
    }).join('');
  }

  /* priority levels — badge colors; default Grey (uncategorized) */
  var TD_PRIOS = [
    ['highest', 'Highest', 'diamond'],
    ['vhigh', 'Very high', 'gold'],
    ['high', 'High', 'red'],
    ['medium', 'Medium', 'blue'],
    ['low', 'Low', 'yellow'],
    ['none', 'Uncategorized', 'grey'],
    ['monkey', 'Monkey Business', 'purple']
  ];
  function prioName(id) {
    var p = TD_PRIOS.filter(function (x) { return x[0] === id; })[0];
    return p ? p[1] : 'Uncategorized';
  }

  var _tdFilter = []; /* active tag filter (session only) */

  function renderTodo(el) {
    el.appendChild(UI.header({
      title: 'Alef.do', back: '#/discipline',
      action: { icon: 'dots', label: 'menu', onClick: function () { toggleMenu(); } }
    }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);

    var cats = [], tagName = {};

    function toggleMenu() {
      var old = document.querySelector('.td-menu');
      if (old) { old.remove(); return; }
      var s = DB.getSettings();
      var m = UI.el('<div class="td-menu">' +
        '<button data-a="moment">' + UI.icon('bolt') + '<span>Moment</span></button>' +
        '<button data-a="filter">' + UI.icon('funnel') + '<span>Filter</span></button>' +
        '<button data-a="option">' + UI.icon('sliders') + '<span>Option</span></button>' +
        '<button data-a="tags">' + UI.icon('tag') + '<span>Tag ' + (s.todoTagsOn ? 'ON' : 'OFF') + '</span></button></div>');
      m.querySelector('[data-a=moment]').addEventListener('click', function () { m.remove(); location.hash = '#/discipline/todo/moment'; });
      m.querySelector('[data-a=filter]').addEventListener('click', function () { m.remove(); filterModal(draw); });
      m.querySelector('[data-a=option]').addEventListener('click', function () { m.remove(); optionModal(draw); });
      m.querySelector('[data-a=tags]').addEventListener('click', function () {
        m.remove();
        DB.saveSettings({ todoTagsOn: !DB.getSettings().todoTagsOn }).then(draw);
      });
      el.appendChild(m);
      setTimeout(function () {
        document.addEventListener('click', function h(e) {
          if (!m.contains(e.target)) { m.remove(); document.removeEventListener('click', h); }
        });
      }, 0);
    }

    function draw() {
      wrap.innerHTML = '';
      Promise.all([DB.getTodoCats(), DB.all('todos'), DB.byIndex('tags', 'module', 'todo')]).then(function (res) {
        cats = res[0];
        var rows = res[1], tags = res[2];
        tagName = {};
        tags.forEach(function (t) { tagName[t.id] = t.name; });
        var showTags = DB.getSettings().todoTagsOn || _tdFilter.length > 0;
        if (_tdFilter.length) {
          rows = rows.filter(function (t) {
            return (t.tags || []).some(function (id) { return _tdFilter.indexOf(id) >= 0; });
          });
          var names = _tdFilter.map(function (id) { return tagName[id]; }).filter(Boolean).join(', ');
          var fbar = UI.el('<div class="td-filterbar">' + UI.icon('funnel') + ' ' + UI.esc(names) +
            '<button class="btn-icon sm" aria-label="clear filter">✕</button></div>');
          fbar.querySelector('button').addEventListener('click', function () { _tdFilter = []; draw(); });
          wrap.appendChild(fbar);
        }
        cats.forEach(function (c) {
          var inCat = rows.filter(function (t) { return (t.cat || 'now') === c.id; });
          inCat.sort(function (a, b) {
            if (a.done !== b.done) return a.done - b.done;             /* done sink to the bottom */
            if (a.done) return (a.doneAt || 0) - (b.doneAt || 0);      /* newest finished lowest */
            return (a.order || a.createdAt || 0) - (b.order || b.createdAt || 0);
          });
          var st = UI.el('<div class="section-title td-cat-title" data-cat="' + c.id + '">' + UI.esc(c.name) + '</div>');
          if (c.color) st.style.color = c.color;
          wrap.appendChild(st);
          var zone = UI.el('<div class="list td-zone" data-cat="' + c.id + '"></div>');
          if (!inCat.length) zone.appendChild(UI.el('<div class="cat-empty sub">empty</div>'));
          inCat.forEach(function (t) { zone.appendChild(taskRow(t, showTags)); });
          wrap.appendChild(zone);
        });
      });
    }

    /* drop: change list and/or position; reindexes the target list */
    function dropTask(t, cat, beforeId) {
      DB.all('todos').then(function (allT) {
        var list = allT.filter(function (x) { return (x.cat || 'now') === cat && !x.done && x.id !== t.id; });
        list.sort(function (a, b) { return (a.order || a.createdAt || 0) - (b.order || b.createdAt || 0); });
        var idx = list.length;
        if (beforeId) {
          for (var i = 0; i < list.length; i++) {
            if (list[i].id === beforeId) { idx = i; break; }
          }
        }
        t.cat = cat;
        list.splice(idx, 0, t);
        Promise.all(list.map(function (x, i2) {
          x.order = (i2 + 1) * 10;
          return DB.put('todos', x);
        })).then(draw);
      });
    }

    function taskRow(t, showTags) {
      var subs = t.subs || [];
      var doneSubs = subs.filter(function (x) { return x.done; }).length;
      var stamps = '';
      if (showTags && (t.tags || []).length) {
        stamps = (t.tags || []).map(function (id) {
          return tagName[id] ? '<span class="td-stamp">' + UI.esc(tagName[id]) + '</span>' : '';
        }).join('');
      }
      var when = t.dueDate ? (t.allDay ? UI.fmtDate(t.dueDate) : UI.fmtDateTime(t.dueDate, t.time)) : '';
      var item = UI.el('<div class="list-item todo-item' + (t.done ? ' li-done' : '') + '" data-id="' + t.id + '">' +
        '<input type="checkbox" ' + (t.done ? 'checked' : '') + ' aria-label="done">' +
        '<span class="li-main"><span class="li-title">' + UI.esc(t.title) + stamps + '</span>' +
        (when ? '<span class="li-sub">' + UI.esc(when) + '</span>' : '') + '</span>' +
        (subs.length ? '<span class="td-subbadge">' + UI.icon('stack') + '<span>' + doneSubs + '/' + subs.length + '</span></span>' : '') +
        (t.done ? '<button class="td-del" aria-label="delete">✕</button>' : '') +
        '</div>');
      item.querySelector('input').addEventListener('change', function (e) {
        var checked = e.target.checked;
        function apply() {
          t.done = checked;
          if (checked) t.doneAt = Date.now();
          DB.put('todos', t).then(draw);
        }
        if (checked && (t.subs || []).some(function (x) { return !x.done; })) {
          e.target.checked = false; /* revert until confirmed */
          UI.modal('Finish task?', UI.el('<p>This task has active subtasks. Are you sure you want to mark it as done?</p>'), [
            { label: 'No' },
            { label: 'Yes', primary: true, onClick: function (close) { close(); apply(); } }
          ]);
          return;
        }
        apply();
      });
      var delBtn = item.querySelector('.td-del');
      if (delBtn) delBtn.addEventListener('click', function () {
        UI.confirm('Delete this task?', 'Delete').then(function (ok) {
          if (ok) DB.del('todos', t.id).then(draw);
        });
      });
      /* press & hold, then DRAG to another list (mouse + touch) */
      var holdTimer = null, sx = 0, sy = 0, dragging = false, ghost = null;
      function zoneAt(x, y) {
        if (!document.elementFromPoint) return null;
        var n = document.elementFromPoint(x, y);
        return n && n.closest ? n.closest('.td-zone, .td-cat-title') : null;
      }
      function clearHints() {
        document.querySelectorAll('.drop-hint').forEach(function (h) { h.classList.remove('drop-hint'); });
      }
      item.addEventListener('touchmove', function (e) {
        if (dragging) e.preventDefault(); /* stop page scroll while dragging */
      }, { passive: false });
      item.addEventListener('contextmenu', function (e) {
        if (dragging || holdTimer) e.preventDefault();
      });
      item.addEventListener('pointerdown', function (e) {
        if (e.target.tagName === 'INPUT' || (e.target.closest && e.target.closest('.btn-icon, .td-del'))) return;
        sx = e.clientX; sy = e.clientY; dragging = false;
        holdTimer = setTimeout(function () {
          holdTimer = null;
          dragging = true;
          item.dataset.held = '1';
          ghost = item.cloneNode(true);
          ghost.className = 'drag-ghost';
          ghost.style.width = item.offsetWidth + 'px';
          ghost.style.left = (sx - 24) + 'px';
          ghost.style.top = (sy - 26) + 'px';
          document.body.appendChild(ghost);
          item.classList.add('drag-src');
        }, 350);
        function onMove(ev) {
          if (!dragging) {
            if (holdTimer && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 10) {
              clearTimeout(holdTimer); holdTimer = null;
              cleanup();
            }
            return;
          }
          ghost.style.left = (ev.clientX - 24) + 'px';
          ghost.style.top = (ev.clientY - 26) + 'px';
          clearHints();
          var overEl = document.elementFromPoint ? document.elementFromPoint(ev.clientX, ev.clientY) : null;
          var overRow = overEl && overEl.closest ? overEl.closest('.todo-item') : null;
          if (overRow === item) overRow = null;
          if (overRow) overRow.classList.add('drop-hint');
          else {
            var z = zoneAt(ev.clientX, ev.clientY);
            if (z) z.classList.add('drop-hint');
          }
        }
        function onUp(ev) {
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
          cleanup();
          if (!dragging) return;
          dragging = false;
          if (ghost) { ghost.remove(); ghost = null; }
          item.classList.remove('drag-src');
          var overEl2 = document.elementFromPoint ? document.elementFromPoint(ev.clientX, ev.clientY) : null;
          var dropRow = overEl2 && overEl2.closest ? overEl2.closest('.todo-item') : null;
          if (dropRow === item) dropRow = null;
          var z = dropRow ? (dropRow.closest ? dropRow.closest('.td-zone') : null) : zoneAt(ev.clientX, ev.clientY);
          clearHints();
          setTimeout(function () { delete item.dataset.held; }, 80);
          var cat = z && z.dataset.cat;
          if (!cat) return;
          if (dropRow || cat !== (t.cat || 'now')) {
            dropTask(t, cat, dropRow ? dropRow.dataset.id : null);
          }
        }
        function cleanup() {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onUp);
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      });
      item.querySelector('.li-main').addEventListener('click', function () {
        if (item.dataset.held) { delete item.dataset.held; return; }
        taskSheet(t, cats, draw);
      });
      return item;
    }

    /* quick add: category chips + "I want to..." input, keyboard-ready */
    function quickAdd() {
      var exist = document.querySelector('.qa-panel');
      if (exist) { exist.querySelector('.qa-input').focus(); return; }
      var selCat = (cats[0] && cats[0].id) || 'now';
      var p = UI.el('<div class="qa-panel"><div class="qa-cats"></div>' +
        '<div class="qa-row"><input type="text" class="qa-input" placeholder="I want to..." enterkeyhint="done">' +
        '<button class="btn btn-primary qa-add" type="button">Add</button>' +
        '<button class="btn-icon qa-x" aria-label="close">✕</button></div></div>');
      var catsRow = p.querySelector('.qa-cats');
      cats.forEach(function (c) {
        var chip = UI.el('<button type="button" class="qa-chip' + (c.id === selCat ? ' on' : '') + '" data-c="' + c.id + '">' + UI.esc(c.name) + '</button>');
        if (c.color) chip.style.color = c.color;
        chip.addEventListener('click', function () {
          selCat = c.id;
          catsRow.querySelectorAll('.qa-chip').forEach(function (x) { x.classList.remove('on'); });
          chip.classList.add('on');
          p.querySelector('.qa-input').focus();
        });
        catsRow.appendChild(chip);
      });
      function save() {
        var v = p.querySelector('.qa-input').value.trim();
        if (!v) return;
        DB.put('todos', {
          id: DB.uid(), title: v, cat: selCat, prio: 'none', tags: [], subs: [], note: '',
          done: false, dueDate: null, time: null, allDay: false, createdAt: Date.now()
        }).then(function () {
          p.querySelector('.qa-input').value = '';
          draw();
          p.querySelector('.qa-input').focus();
        });
      }
      p.querySelector('.qa-add').addEventListener('click', save);
      p.querySelector('.qa-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') save(); });
      p.querySelector('.qa-x').addEventListener('click', function () { p.remove(); });
      el.appendChild(p);
      p.querySelector('.qa-input').focus();
    }

    el.appendChild(UI.fab('Add task', quickAdd));
    draw();
  }

  /* ---- task detail sheet (slides up) ---- */
  function taskSheet(orig, cats, onDone) {
    var t = JSON.parse(JSON.stringify(orig));
    t.subs = t.subs || []; t.tags = t.tags || [];
    var s = DB.getSettings();
    var tagName = {};

    var body = UI.el('<div class="td-sheet"></div>');
    var titleIn = UI.el('<input type="text" class="td-title-in" value="' + UI.esc(t.title) + '" placeholder="Task name">');
    body.appendChild(titleIn);

    /* priority: label + level text, badge row below */
    body.appendChild(UI.el('<div class="td-prio-head">Priority&nbsp; <b id="td-prio-name">' + prioName(t.prio || 'none') + '</b></div>'));
    var badges = UI.el('<div class="td-badges">' + TD_PRIOS.map(function (p) {
      return '<button type="button" class="td-badge td-b-' + p[2] + ((t.prio || 'none') === p[0] ? ' on' : '') + '" data-p="' + p[0] + '" title="' + p[1] + '"></button>';
    }).join('') + '</div>');
    badges.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.td-badge') : null;
      if (!b) return;
      t.prio = b.dataset.p;
      badges.querySelectorAll('.td-badge').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      body.querySelector('#td-prio-name').textContent = prioName(t.prio);
    });
    body.appendChild(badges);

    /* tags */
    var tagWrap = UI.el('<div class="field"><span class="field-label">Tags</span><div class="td-tagrow"></div></div>');
    function refreshTags() {
      return DB.byIndex('tags', 'module', 'todo').then(function (rows) {
        tagName = {};
        rows.forEach(function (x) { tagName[x.id] = x.name; });
        var row = tagWrap.querySelector('.td-tagrow');
        row.innerHTML = '';
        t.tags.forEach(function (id) {
          if (tagName[id]) row.appendChild(UI.el('<span class="td-stamp">' + UI.esc(tagName[id]) + '</span>'));
        });
        var add = UI.el('<button type="button" class="chip td-addtag">+ Add tags</button>');
        add.addEventListener('click', function () {
          tagPicker(t.tags, function (sel) {
            if (sel) { t.tags = sel; }
            refreshTags();
          });
        });
        row.appendChild(add);
      });
    }
    refreshTags();
    body.appendChild(tagWrap);

    /* SUBTASKS — count = undone / done */
    var subsWrap = UI.el('<div class="td-subs"><div class="td-subs-head">SUBTASKS<span class="td-sub-count"></span></div><div class="td-sub-list"></div></div>');
    function drawSubs() {
      var doneN = t.subs.filter(function (x) { return x.done; }).length;
      subsWrap.querySelector('.td-sub-count').textContent = doneN + ' / ' + t.subs.length;
      var listEl = subsWrap.querySelector('.td-sub-list');
      listEl.innerHTML = '';
      t.subs.forEach(function (sub, i) {
        var row = UI.el('<div class="td-sub-row"><input type="checkbox"' + (sub.done ? ' checked' : '') + '>' +
          '<span class="td-sub-title' + (sub.done ? ' done' : '') + '">' + UI.esc(sub.title) + '</span>' +
          (sub.done ? '<button class="td-del td-del-sm" aria-label="remove subtask">✕</button>' : '') + '</div>');
        row.querySelector('input').addEventListener('change', function (e) {
          sub.done = e.target.checked;
          drawSubs();
        });
        var subDel = row.querySelector('.td-del');
        if (subDel) subDel.addEventListener('click', function () {
          t.subs.splice(i, 1);
          drawSubs();
        });
        listEl.appendChild(row);
      });
      var addRow = UI.el('<div class="td-sub-row"><input type="checkbox" disabled>' +
        '<input type="text" class="td-sub-add" placeholder="Add a new subtask"></div>');
      var ai = addRow.querySelector('.td-sub-add');
      function commit() {
        var v = ai.value.trim();
        if (!v) return;
        t.subs.push({ id: DB.uid(), title: v, done: false });
        drawSubs();
        var next = subsWrap.querySelector('.td-sub-add');
        if (next) next.focus();
      }
      ai.addEventListener('keydown', function (e) { if (e.key === 'Enter') commit(); });
      ai.addEventListener('blur', function () { commit(); });
      listEl.appendChild(addRow);
    }
    drawSubs();
    body.appendChild(subsWrap);

    /* note */
    body.appendChild(UI.el('<div class="td-subs-head">NOTE</div>'));
    var noteIn = UI.el('<textarea class="td-note" placeholder="Add your notes....">' + UI.esc(t.note || '') + '</textarea>');
    body.appendChild(noteIn);

    UI.modal('Task', body, [
      { label: 'Cancel' },
      {
        label: 'Delete', danger: true, onClick: function (close) {
          UI.confirm('Delete this task?', 'Delete').then(function (ok) {
            if (!ok) return;
            close();
            DB.del('todos', orig.id).then(onDone);
          });
        }
      },
      {
        label: 'Save', primary: true, onClick: function (close) {
          var name = titleIn.value.trim();
          if (!name) { UI.toast('Task name is required'); return; }
          t.title = name;
          t.note = noteIn.value;
          Object.assign(orig, t);
          DB.put('todos', orig).then(function () { close(); onDone(); });
        }
      }
    ]);
  }

  /* ---- tag picker: select + add + rename + reorder ---- */
  function tagPicker(selected, onDone) {
    var sel = selected.slice();
    var rows = [];
    var body = UI.el('<div><div class="td-tagpick"></div>' +
      '<div class="row2" style="align-items:flex-end">' +
      UI.field('New tag', '<input type="text" id="tp-new">') +
      '<button class="btn" id="tp-add" type="button">Add</button></div></div>');
    var listEl = body.querySelector('.td-tagpick');
    function load() {
      return DB.byIndex('tags', 'module', 'todo').then(function (r) {
        rows = r.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        drawList();
      });
    }
    function swap(i, j) {
      if (j < 0 || j >= rows.length) return;
      var a = rows[i], b = rows[j];
      var tmp = a.order || 0;
      a.order = b.order || 0;
      b.order = tmp;
      if (a.order === b.order) { a.order = j; b.order = i; }
      Promise.all([DB.put('tags', a), DB.put('tags', b)]).then(load);
    }
    function drawList() {
      listEl.innerHTML = '';
      if (!rows.length) listEl.appendChild(UI.el('<div class="sub">No tags yet — add one below</div>'));
      rows.forEach(function (tg, i) {
        var row = UI.el('<div class="td-sub-row"><input type="checkbox"' + (sel.indexOf(tg.id) >= 0 ? ' checked' : '') + '>' +
          '<span class="td-sub-title">' + UI.esc(tg.name) + '</span>' +
          '<button class="btn-icon sm" data-a="up" aria-label="move up">↑</button>' +
          '<button class="btn-icon sm" data-a="down" aria-label="move down">↓</button>' +
          '<button class="btn-icon sm" data-a="edit" aria-label="rename">' + UI.icon('edit') + '</button></div>');
        row.querySelector('input').addEventListener('change', function (e) {
          if (e.target.checked) { if (sel.indexOf(tg.id) < 0) sel.push(tg.id); }
          else sel = sel.filter(function (x) { return x !== tg.id; });
        });
        row.querySelector('[data-a=up]').addEventListener('click', function () { swap(i, i - 1); });
        row.querySelector('[data-a=down]').addEventListener('click', function () { swap(i, i + 1); });
        row.querySelector('[data-a=edit]').addEventListener('click', function () {
          var eb = UI.el('<div>' + UI.field('Tag name', '<input type="text" id="tg-nm" value="' + UI.esc(tg.name) + '">') + '</div>');
          UI.modal('Rename tag', eb, [
            { label: 'Cancel' },
            {
              label: 'Save', primary: true, onClick: function (close) {
                var v = eb.querySelector('#tg-nm').value.trim();
                if (!v) return;
                tg.name = v;
                DB.put('tags', tg).then(function () { close(); load(); });
              }
            }
          ]);
        });
        listEl.appendChild(row);
      });
    }
    body.querySelector('#tp-add').addEventListener('click', function () {
      var v = body.querySelector('#tp-new').value.trim();
      if (!v) return;
      DB.put('tags', { id: DB.uid(), module: 'todo', name: v, order: Date.now() }).then(function () {
        body.querySelector('#tp-new').value = '';
        load();
      });
    });
    load();
    UI.modal('Tags', body, [
      { label: 'Cancel', onClick: function (close) { close(); onDone(null); } },
      { label: 'Save', primary: true, onClick: function (close) { close(); onDone(sel); } }
    ]);
  }

  /* ---- filter by tag ---- */
  function filterModal(onApply) {
    DB.byIndex('tags', 'module', 'todo').then(function (tags) {
      tags.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      var body = UI.el('<div></div>');
      if (!tags.length) body.appendChild(UI.el('<p class="sub">No tags yet — open a task → Add tags to create some.</p>'));
      tags.forEach(function (tg) {
        body.appendChild(UI.el('<label class="td-sub-row"><input type="checkbox" value="' + tg.id + '"' +
          (_tdFilter.indexOf(tg.id) >= 0 ? ' checked' : '') + '><span class="td-sub-title">' + UI.esc(tg.name) + '</span></label>'));
      });
      UI.modal('Filter by tag', body, [
        { label: 'Clear', onClick: function (close) { _tdFilter = []; close(); onApply(); } },
        {
          label: 'Apply', primary: true, onClick: function (close) {
            _tdFilter = Array.prototype.map.call(body.querySelectorAll('input:checked'), function (i) { return i.value; });
            close();
            onApply();
          }
        }
      ]);
    });
  }

  /* ---- option: list order, custom lists, name colors ---- */
  function optionModal(onDone) {
    DB.getTodoCats().then(function (cats) {
      var list = JSON.parse(JSON.stringify(cats));
      var COLORS = ['', '#e05d5d', '#e0884a', '#d9a441', '#4fb06d', '#4a90d9', '#8e6fd8', '#b05d8e',
        '#3aa8a0', '#38bdf8', '#f472b6', '#9acd32', '#a0765b'];
      function pickColor(cur, done) {
        var body = UI.el('<div class="td-colorgrid"></div>');
        var m;
        COLORS.forEach(function (col) {
          var b = UI.el('<button type="button" class="td-color' + ((cur || '') === col ? ' on' : '') + '"' +
            (col ? ' style="background:' + col + '"' : '') + ' aria-label="' + (col || 'no color') + '">' + (col ? '' : '✕') + '</button>');
          b.addEventListener('click', function () {
            m.close();
            done(col);
          });
          body.appendChild(b);
        });
        m = UI.modal('List color', body, [{ label: 'Cancel' }]);
      }
      var body = UI.el('<div><div class="td-optlist"></div>' +
        '<div class="row2" style="align-items:flex-end">' +
        UI.field('New list', '<input type="text" id="oc-new">') +
        '<button class="btn" id="oc-add" type="button">Add</button></div>' +
        '<p class="sub">↑↓ change the order · tap the dot to pick a name color</p></div>');
      function drawL() {
        var w = body.querySelector('.td-optlist');
        w.innerHTML = '';
        list.forEach(function (c, i) {
          var row = UI.el('<div class="td-sub-row"><span class="td-sub-title"' + (c.color ? ' style="color:' + c.color + '"' : '') + '>' + UI.esc(c.name) + '</span>' +
            '<button class="btn-icon sm" data-a="up" aria-label="up">↑</button>' +
            '<button class="btn-icon sm" data-a="down" aria-label="down">↓</button>' +
            '<button class="btn-icon sm" data-a="color" aria-label="color"><span class="cat-dot" style="background:' + (c.color || 'var(--line2)') + '"></span></button></div>');
          row.querySelector('[data-a=up]').addEventListener('click', function () {
            if (i === 0) return;
            list.splice(i - 1, 0, list.splice(i, 1)[0]);
            drawL();
          });
          row.querySelector('[data-a=down]').addEventListener('click', function () {
            if (i === list.length - 1) return;
            list.splice(i + 1, 0, list.splice(i, 1)[0]);
            drawL();
          });
          row.querySelector('[data-a=color]').addEventListener('click', function () {
            pickColor(c.color, function (col) {
              c.color = col;
              drawL();
            });
          });
          w.appendChild(row);
        });
      }
      body.querySelector('#oc-add').addEventListener('click', function () {
        var v = body.querySelector('#oc-new').value.trim();
        if (!v) return;
        list.push({ id: DB.uid(), name: v, color: '' });
        body.querySelector('#oc-new').value = '';
        drawL();
      });
      drawL();
      UI.modal('Lists & order', body, [
        { label: 'Cancel' },
        {
          label: 'Save', primary: true, onClick: function (close) {
            DB.saveTodoCats(list).then(function () { close(); onDone(); });
          }
        }
      ]);
    });
  }

  /* ---- Moment: sort every open task one by one ---- */
  function renderMoment(el) {
    el.appendChild(UI.header({ title: 'Moment', back: '#/discipline/todo' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    Promise.all([DB.all('todos'), DB.getTodoCats()]).then(function (res) {
      var rows = res[0], cats = res[1];
      var queue = rows.filter(function (t) { return !t.done; })
        .sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      var total = queue.length, i = 0;
      var wrap = UI.el('<div></div>');
      pad.appendChild(wrap);
      /* Now/Today/Later/Never take the same color as their list name */
      var DEST = ['now', 'today', 'later', 'never'].map(function (id) {
        var found = null;
        cats.forEach(function (x) { if (x.id === id) found = x; });
        return found || { id: id, name: id.toUpperCase(), color: '' };
      });
      function show() {
        wrap.innerHTML = '';
        if (i >= queue.length) {
          wrap.appendChild(UI.emptyState('All sorted!', total + ' task' + (total === 1 ? '' : 's') + ' reviewed'));
          var back = UI.el('<button class="btn btn-primary btn-block">Back to Alef.do</button>');
          back.addEventListener('click', function () { location.hash = '#/discipline/todo'; });
          wrap.appendChild(back);
          return;
        }
        var t = queue[i];
        wrap.appendChild(UI.el('<div class="sub td-moment-prog">' + (i + 1) + ' / ' + total + '</div>'));
        wrap.appendChild(UI.el('<div class="card td-moment"><h2>' + UI.esc(t.title) + '</h2>' +
          (t.note ? '<div class="sub">' + UI.esc(t.note) + '</div>' : '') +
          (t.dueDate ? '<div class="sub">' + UI.esc(UI.fmtDate(t.dueDate)) + '</div>' : '') +
          '<div class="sub">currently: ' + UI.esc((t.cat || 'now').toUpperCase()) + '</div></div>'));
        var btns = UI.el('<div class="td-moment-btns"></div>');
        DEST.forEach(function (c) {
          var b = UI.el('<button class="btn" data-c="' + c.id + '">' + UI.esc(c.name) + '</button>');
          if (c.color) { b.style.background = c.color; b.style.borderColor = c.color; b.style.color = '#fff'; }
          btns.appendChild(b);
        });
        btns.appendChild(UI.el('<button class="btn td-done-btn" data-c="__done">✓ Done</button>'));
        btns.appendChild(UI.el('<button class="btn btn-danger" data-c="__del">Delete</button>'));
        btns.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('button') : null;
          if (!b) return;
          var c = b.dataset.c;
          if (c === '__done') {
            t.done = true;
            DB.put('todos', t).then(function () { i++; show(); });
            return;
          }
          if (c === '__del') {
            UI.confirm('Delete "' + t.title + '"?', 'Delete').then(function (ok) {
              if (!ok) return;
              DB.del('todos', t.id).then(function () { i++; show(); });
            });
            return;
          }
          t.cat = c;
          DB.put('todos', t).then(function () { i++; show(); });
        });
        wrap.appendChild(btns);
      }
      show();
    });
  }

  /* ================= Notes (Fitness Note + Bodybuilding) =================
     Same engine, separate module id → separate folders & tags. */

  var NOTE_BGS = [
    ['', 'Plain'], ['lines', 'Lines'], ['graph', 'Graph'],
    ['poly', 'Poly'], ['tri', 'Mosaic'], ['cube', 'Cubes'],
    ['hex', 'Hex'], ['steps', 'Steps'], ['wave', 'Waves']
  ];

  function renderNotes(el, module, title, parts) {
    if (parts[0] === 'n') return noteDetail(el, module, title, parts[1]);
    if (parts[0] === 'f') return noteList(el, module, title, parts[1]);
    return folderHome(el, module, title);
  }

  /* Note body as blocks: [{t:'txt', v}, {t:'img', ref, url?, size, wrap, align}].
     Legacy notes (plain body + images[]) convert on the fly; stored data is
     untouched until the user saves. The txt directly after a wrap (Square)
     image is its SIDE text; the txt after that is the text BELOW the image —
     so they are never merged together. */
  function nbEnsureSlots(arr) {
    if (arr[0] && arr[0].t === 'img') arr.unshift({ t: 'txt', v: '' });
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].t !== 'img') continue;
      if (!arr[i + 1] || arr[i + 1].t !== 'txt') arr.splice(i + 1, 0, { t: 'txt', v: '' });      // side / after
      if (arr[i].wrap && (!arr[i + 2] || arr[i + 2].t !== 'txt')) arr.splice(i + 2, 0, { t: 'txt', v: '' });  // below
    }
    if (!arr.length) arr.push({ t: 'txt', v: '' });
    return arr;
  }
  function noteBlocks(n) {
    var src = (n.blocks && n.blocks.length)
      ? n.blocks.map(function (b) { return Object.assign({}, b); })
      : [{ t: 'txt', v: n.body || '' }].concat((n.images || []).map(function (u) {
          return { t: 'img', ref: u, url: u, size: 100, wrap: false };
        }));
    var out = [];
    src.forEach(function (b) {
      if (b.t === 'img') { out.push(b); return; }
      var prev = out[out.length - 1], prev2 = out[out.length - 2];
      var prevIsSide = prev && prev.t === 'txt' && prev2 && prev2.t === 'img' && prev2.wrap;
      if (prev && prev.t === 'txt' && !prevIsSide) {
        prev.v = prev.v + (prev.v && b.v ? '\n' : '') + (b.v || '');
      } else out.push(b);
    });
    return nbEnsureSlots(out);
  }

  function nbImgWidth(b) { return (b.wrap ? Math.min(b.size || 100, 60) : (b.size || 100)) + '%'; }

  function folderHome(el, module, title) {
    el.appendChild(UI.header({ title: title, back: '#/discipline' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    Promise.all([DB.byIndex('folders', 'module', module), DB.byIndex('notes', 'module', module)]).then(function (res) {
      var folders = res[0].sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      var notes = res[1];
      var counts = {};
      notes.forEach(function (n) { counts[n.folderId || ''] = (counts[n.folderId || ''] || 0) + 1; });

      var list = UI.el('<div class="list note-list"></div>');
      var allItem = UI.el('<button class="list-item"><span class="li-thumb">' + UI.icon('note') + '</span>' +
        '<span class="li-main"><span class="li-title">All notes</span><span class="li-sub">' + notes.length + ' notes</span></span>' +
        '<span class="chev">' + UI.icon('chev') + '</span></button>');
      allItem.addEventListener('click', function () { location.hash = '#/discipline/' + module + '/f/all'; });
      list.appendChild(allItem);
      folders.forEach(function (f) {
        var it = UI.el('<button class="list-item"><span class="li-thumb">' + UI.icon('folder') + '</span>' +
          '<span class="li-main"><span class="li-title">' + UI.esc(f.name) + '</span>' +
          '<span class="li-sub">' + (counts[f.id] || 0) + ' notes</span></span>' +
          '<span class="chev">' + UI.icon('chev') + '</span></button>');
        it.addEventListener('click', function () { location.hash = '#/discipline/' + module + '/f/' + f.id; });
        list.appendChild(it);
      });
      pad.appendChild(list);
      pad.appendChild(UI.el('<p class="sub" style="text-align:center">Manage folders & tags in Setting</p>'));
    });
    el.appendChild(UI.fab('New note', function () {
      noteForm(module, null, null, function (n) { location.hash = '#/discipline/' + module + '/n/' + n.id; });
    }));
  }

  function noteList(el, module, title, folderId) {
    var isAll = folderId === 'all';
    var back = '#/discipline/' + module;
    Promise.all([
      isAll ? Promise.resolve(null) : DB.get('folders', folderId),
      DB.byIndex('notes', 'module', module),
      DB.byIndex('tags', 'module', module)
    ]).then(function (res) {
      var folder = res[0], notes = res[1], tags = res[2];
      var tagName = {};
      tags.forEach(function (t) { tagName[t.id] = t.name; });
      if (!isAll) notes = notes.filter(function (n) { return n.folderId === folderId; });
      el.appendChild(UI.header({ title: isAll ? 'All notes' : (folder ? folder.name : 'Folder'), back: back }));
      var pad = UI.el('<div class="pagepad"></div>');
      el.appendChild(pad);
      if (!notes.length) { pad.appendChild(UI.emptyState('No notes here yet', 'Tap + to write one')); }
      else {
        notes.sort(function (a, b) { return (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt); });
        var list = UI.el('<div class="list note-list"></div>');
        notes.forEach(function (n) {
          var img0 = (n.images || [])[0];
          var tagStr = (n.tags || []).map(function (id) { return tagName[id]; }).filter(Boolean).join(', ');
          var it = UI.el('<button class="list-item">' +
            '<span class="li-thumb">' + UI.icon('note') + '</span>' +
            '<span class="li-main"><span class="li-title">' + (n.pinned ? '📌 ' : '') + UI.esc(n.title || '(untitled)') + '</span>' +
            '<span class="li-sub">' + UI.esc(tagStr || UI.fmtDate(new Date(n.updatedAt).toISOString().slice(0, 10))) + '</span></span>' +
            '<span class="chev">' + UI.icon('chev') + '</span></button>');
          it.addEventListener('click', function () { location.hash = '#/discipline/' + module + '/n/' + n.id; });
          if (img0) {
            (img0.slice(0, 5) === 'data:' ? Promise.resolve(img0) : DB.mediaUrl(img0)).then(function (u) {
              if (u) it.replaceChild(UI.el('<img class="li-thumb" src="' + u + '" alt="">'), it.querySelector('.li-thumb'));
            });
          }
          list.appendChild(it);
        });
        pad.appendChild(list);
      }
      el.appendChild(UI.fab('New note', function () {
        noteForm(module, null, isAll ? null : folderId, function (n) { location.hash = '#/discipline/' + module + '/n/' + n.id; });
      }));
    });
  }

  function noteDetail(el, module, title, id) {
    Promise.all([DB.get('notes', id).then(function (nn) { return nn ? DB.hydrateNote(nn) : nn; }), DB.byIndex('tags', 'module', module)]).then(function (res) {
      var n = res[0], tags = res[1];
      if (!n) { el.appendChild(UI.emptyState('Note not found')); return; }
      var tagName = {};
      tags.forEach(function (t) { tagName[t.id] = t.name; });
      el.appendChild(UI.header({
        title: n.title || '(untitled)', back: '#/discipline/' + module + '/f/' + (n.folderId || 'all'),
        action: { icon: 'edit', label: 'Edit', onClick: function () { noteForm(module, n, n.folderId, function () { App.route(); }); } }
      }));
      var pad = UI.el('<div class="pagepad"></div>');
      el.appendChild(pad);
      if ((n.tags || []).length) {
        var chips = UI.el('<div></div>');
        n.tags.forEach(function (tid) { if (tagName[tid]) chips.appendChild(UI.el('<span class="chip">' + UI.icon('tag') + UI.esc(tagName[tid]) + '</span>')); });
        pad.appendChild(chips);
      }
      var card = UI.el('<div class="card' + (n.bg ? ' note-bg-' + n.bg : '') + '"></div>');
      var bw = UI.el('<div class="note-blocks"></div>');
      var nbs = noteBlocks(n);
      function nbImg(b) {
        var src = b.url || b.ref;
        if (!src) return null;
        var im = UI.el('<img class="nb-i' + (b.wrap ? ' nb-wrap' : '') + (b.wrap && b.align === 'right' ? ' nb-right' : '') + '" src="' + src + '" alt="">');
        im.style.width = nbImgWidth(b);
        im.addEventListener('click', function () { UI.lightbox({ type: 'image', src: src }); });
        return im;
      }
      for (var bi = 0; bi < nbs.length; bi++) {
        var b = nbs[bi];
        if (b.t === 'txt') {
          if (b.v) bw.appendChild(UI.el('<div class="nb-p">' + UI.esc(b.v) + '</div>'));
          continue;
        }
        var im = nbImg(b);
        if (!im) continue;
        if (b.wrap && nbs[bi + 1] && nbs[bi + 1].t === 'txt') {
          // square image + its text form one self-contained group so the
          // text sits at the image's side and the next group starts below
          var g = UI.el('<div class="nb-group"></div>');
          g.appendChild(im);
          if (nbs[bi + 1].v) g.appendChild(UI.el('<div class="nb-p">' + UI.esc(nbs[bi + 1].v) + '</div>'));
          bw.appendChild(g);
          bi++;
        } else {
          bw.appendChild(im);
        }
      }
      card.appendChild(bw);
      pad.appendChild(card);

      /* videos, tap → fullscreen */
      var mediaWrap = UI.el('<div class="note-media"></div>');
      (n.videos || []).forEach(function (src) {
        var v = document.createElement('video');
        v.src = src; v.controls = true; v.playsInline = true; v.preload = 'metadata';
        mediaWrap.appendChild(v);
      });
      if (mediaWrap.children.length) pad.appendChild(mediaWrap);

      /* PDF attachments: tap → open, ⬇ → save to device */
      if ((n.files || []).length) {
        var fl = UI.el('<div class="list nf-files"></div>');
        n.files.forEach(function (f) {
          var row = UI.el('<div class="list-item">' +
            '<span class="li-thumb">' + UI.icon('file') + '</span>' +
            '<span class="li-main"><span class="li-title">' + UI.esc(f.name || 'file.pdf') + '</span>' +
            '<span class="li-sub">PDF — tap to open</span></span>' +
            '<button class="btn-icon sm" aria-label="save file">' + UI.icon('download') + '</button></div>');
          function withUrl(cb) {
            (f.ref && f.ref.slice(0, 5) === 'data:' ? Promise.resolve(f.ref) : DB.mediaUrl(f.ref)).then(function (u) {
              if (u) cb(u); else UI.toast('File missing');
            });
          }
          row.addEventListener('click', function () { withUrl(function (u) { UI.openDataUrl(u, f.name || 'file.pdf'); }); });
          row.querySelector('button').addEventListener('click', function (e) {
            e.stopPropagation();
            withUrl(function (u) { UI.saveDataUrl(u, f.name || 'file.pdf'); });
          });
          fl.appendChild(row);
        });
        pad.appendChild(fl);
      }

      var del = UI.el('<button class="btn btn-danger btn-block">' + UI.icon('trash') + ' Delete note</button>');
      del.addEventListener('click', function () {
        UI.confirm('Delete this note?', 'Delete').then(function (ok) {
          if (ok) DB.del('notes', id).then(function () { location.hash = '#/discipline/' + module; });
        });
      });
      pad.appendChild(del);
    });
  }

  function noteForm(module, existing, folderId, onSaved) {
    var n = existing || { id: DB.uid(), module: module, folderId: folderId || null, title: '', body: '', images: [], videos: [], tags: [], pinned: false, bg: '', createdAt: Date.now() };
    Promise.all([DB.byIndex('folders', 'module', module), DB.byIndex('tags', 'module', module)]).then(function (res) {
      var folders = res[0], tags = res[1];
      var folderOpts = '<option value="">(no folder)</option>' + folders.map(function (f) {
        return '<option value="' + f.id + '"' + (f.id === n.folderId ? ' selected' : '') + '>' + UI.esc(f.name) + '</option>';
      }).join('');
      var body = UI.el('<div>' +
        UI.field('Title', '<input type="text" id="nf-title" value="' + UI.esc(n.title) + '">') +
        UI.field('Folder', '<select id="nf-folder">' + folderOpts + '</select>') +
        '<div class="field"><span class="field-label">Background template</span><div id="nf-bgs"></div></div>' +
        '<div class="field"><span class="field-label">Note</span>' +
        '<div id="nf-blocks" class="nf-blocks' + (n.bg ? ' note-bg-' + n.bg : '') + '"></div>' +
        '<button class="btn" type="button" id="nf-add-img" style="margin-top:8px">' + UI.icon('camera') + ' Add image / video</button>' +
        '<input type="file" id="nf-file" accept="image/*,video/mp4" class="hidden" multiple></div>' +
        '<div class="field" id="nf-vid-field"><span class="field-label">Videos (mp4) — tap to remove</span>' +
        '<div class="media-strip" id="nf-vids"></div></div>' +
        '<div class="field"><span class="field-label">Files (PDF)</span>' +
        '<div class="list nf-files" id="nf-files"></div>' +
        '<button class="btn" type="button" id="nf-add-pdf">' + UI.icon('file') + ' Attach PDF</button>' +
        '<input type="file" id="nf-pdf" accept="application/pdf,.pdf" class="hidden" multiple></div>' +
        '<div class="field"><span class="field-label">Tags</span><div id="nf-tags"></div></div>' +
        '<label class="switch"><span>Pin to top</span><input type="checkbox" id="nf-pin"' + (n.pinned ? ' checked' : '') + '></label></div>');

      /* background template picker — labeled swatch grid */
      var bgSel = n.bg || '';
      var bgWrap = body.querySelector('#nf-bgs');
      bgWrap.className = 'bgpick';
      NOTE_BGS.forEach(function (b) {
        var it = UI.el('<button type="button" class="bgpick-item' + (bgSel === b[0] ? ' on' : '') + '">' +
          '<span class="bgpick-sw' + (b[0] ? ' note-bg-' + b[0] : ' bgpick-plain') + '"></span>' +
          '<span class="bgpick-name">' + b[1] + '</span></button>');
        it.addEventListener('click', function () {
          bgSel = b[0];
          bgWrap.querySelectorAll('.bgpick-item').forEach(function (x) { x.classList.remove('on'); });
          it.classList.add('on');
          body.querySelector('#nf-blocks').className = 'nf-blocks' + (bgSel ? ' note-bg-' + bgSel : '');
        });
        bgWrap.appendChild(it);
      });

      var selTags = (n.tags || []).slice();
      var tagWrap = body.querySelector('#nf-tags');
      if (!tags.length) tagWrap.appendChild(UI.el('<span class="sub">No tags yet — create them in Setting → Manage Tags</span>'));
      tags.forEach(function (t) {
        var chip = UI.el('<button type="button" class="chip' + (selTags.indexOf(t.id) >= 0 ? ' on' : '') + '" style="border:0;cursor:pointer;font:inherit">' + UI.esc(t.name) + '</button>');
        chip.addEventListener('click', function () {
          var i = selTags.indexOf(t.id);
          if (i >= 0) selTags.splice(i, 1); else selTags.push(t.id);
          chip.classList.toggle('on');
        });
        tagWrap.appendChild(chip);
      });

      /* ---- note body: text + inline image blocks (iPhone-Notes style) ---- */
      var blocks = noteBlocks(n);
      var lastTxt = null, lastSel = null;   // where "Add image" inserts

      function grow(ta) {
        ta.style.height = 'auto';
        ta.style.height = Math.max(44, ta.scrollHeight) + 'px';
      }

      function mkTa(b, i) {
        var ta = document.createElement('textarea');
        ta.className = 'nb-txt';
        ta.value = b.v || '';
        if (i === 0) ta.placeholder = 'Write…';
        ta.addEventListener('input', function () { b.v = ta.value; grow(ta); });
        ['input', 'focus', 'blur', 'click', 'keyup', 'select'].forEach(function (ev) {
          ta.addEventListener(ev, function () { lastTxt = b; lastSel = ta.selectionStart; });
        });
        return ta;
      }

      function imgCard(b) {
        var right = b.wrap && b.align === 'right';
        if (b.wrap && (b.size || 100) > 60) b.size = 60;   // square is capped at 60%
        var card = UI.el('<div class="nb-imgcard">' +
          '<div class="nb-row' + (right ? ' right' : '') + '"><img class="nb-i' + (b.wrap ? ' nb-wrap' : '') + '" src="' + (b.url || b.ref) + '" alt=""></div>' +
          '<div class="nb-tools">' +
          '<span class="nb-mode"><button type="button" data-m="full"' + (b.wrap ? '' : ' class="on"') + '>Full</button>' +
          '<button type="button" data-m="wrap"' + (b.wrap ? ' class="on"' : '') + '>Square</button></span>' +
          (b.wrap ? '<span class="nb-mode nb-align"><button type="button" data-g="left"' + (right ? '' : ' class="on"') + '>◧ Lt</button>' +
          '<button type="button" data-g="right"' + (right ? ' class="on"' : '') + '>Rt ◨</button></span>' : '') +
          '<input type="range" min="25" max="' + (b.wrap ? 60 : 100) + '" step="5" value="' + (b.size || 100) + '" aria-label="image size">' +
          '<span class="nb-size">' + (b.size || 100) + '%</span>' +
          '<button type="button" class="btn-icon sm" data-a="save" aria-label="save image">' + UI.icon('download') + '</button>' +
          '<button type="button" class="btn-icon sm" data-a="del" aria-label="remove image">' + UI.icon('trash') + '</button>' +
          '</div></div>');
        var im = card.querySelector('img');
        im.style.width = nbImgWidth(b);
        function syncRow() {   // side text field is at least as tall as the image
          var ta = card.querySelector('.nb-row .nb-txt');
          if (ta && im.offsetHeight) ta.style.minHeight = im.offsetHeight + 'px';
        }
        im.addEventListener('load', syncRow);
        card.querySelectorAll('.nb-mode:not(.nb-align) button').forEach(function (x) {
          x.addEventListener('click', function () {
            b.wrap = x.dataset.m === 'wrap';
            drawBlocks();      // layout changes between stacked and side-by-side
          });
        });
        card.querySelectorAll('.nb-align button').forEach(function (x) {
          x.addEventListener('click', function () {
            b.align = x.dataset.g;
            card.querySelector('.nb-row').classList.toggle('right', b.align === 'right');
            card.querySelectorAll('.nb-align button').forEach(function (y) {
              y.classList.toggle('on', y.dataset.g === b.align);
            });
          });
        });
        var range = card.querySelector('input[type=range]');
        range.addEventListener('input', function () {
          b.size = parseInt(range.value, 10);
          card.querySelector('.nb-size').textContent = b.size + '%';
          im.style.width = nbImgWidth(b);
          syncRow();
        });
        card.querySelector('[data-a=save]').addEventListener('click', function () { UI.saveImage(b.url || b.ref); });
        card.querySelector('[data-a=del]').addEventListener('click', function () {
          var i = blocks.indexOf(b);
          if (i < 0) return;
          blocks.splice(i, 1);
          var prev = blocks[i - 1], next = blocks[i];
          if (prev && next && prev.t === 'txt' && next.t === 'txt') {
            prev.v = prev.v + (prev.v && next.v ? '\n' : '') + (next.v || '');
            blocks.splice(i, 1);
            if (lastTxt === next) lastTxt = prev;
          }
          drawBlocks();
        });
        card.syncRow = syncRow;
        return card;
      }

      function drawBlocks() {
        nbEnsureSlots(blocks);   // side + below slots survive toggles/deletes
        var wrap = body.querySelector('#nf-blocks');
        wrap.innerHTML = '';
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i];
          if (b.t === 'txt') {
            var ta = mkTa(b, i);
            wrap.appendChild(ta);
            grow(ta);
            continue;
          }
          var card = imgCard(b);
          wrap.appendChild(card);
          if (b.wrap && blocks[i + 1] && blocks[i + 1].t === 'txt') {
            // Square mode: type right beside the image — the next text block
            // moves into the image row
            var side = mkTa(blocks[i + 1], i + 1);
            card.querySelector('.nb-row').appendChild(side);
            grow(side);
            card.syncRow();
            i++;
          }
        }
      }
      drawBlocks();
      setTimeout(function () {
        body.querySelectorAll('.nb-txt').forEach(grow);   // re-measure once in the DOM
      }, 0);

      function insertImage(d) {
        var nb = { t: 'img', ref: d, url: d, size: 100, wrap: false };
        var i = blocks.indexOf(lastTxt);
        if (i < 0) {                    // no cursor known → append at the end
          blocks.push(nb, { t: 'txt', v: '' });
        } else {                        // split the focused text at the cursor
          var v = lastTxt.v || '';
          var pos = (lastSel == null) ? v.length : Math.min(lastSel, v.length);
          var tail = { t: 'txt', v: v.slice(pos) };
          lastTxt.v = v.slice(0, pos);
          blocks.splice(i + 1, 0, nb, tail);
          lastTxt = tail; lastSel = 0;
        }
        drawBlocks();
      }

      /* ---- videos keep the tap-to-remove strip ---- */
      var videos = (n.videos || []).slice();
      function drawMedia() {
        var strip = body.querySelector('#nf-vids');
        strip.innerHTML = '';
        body.querySelector('#nf-vid-field').style.display = videos.length ? '' : 'none';
        videos.forEach(function (src, i) {
          var v = document.createElement('video');
          v.src = src; v.title = 'Tap to remove'; v.muted = true;
          v.addEventListener('click', function () { videos.splice(i, 1); drawMedia(); });
          strip.appendChild(v);
        });
      }
      drawMedia();

      /* ---- PDF attachments ---- */
      var files = (n.files || []).map(function (f) { return Object.assign({}, f); });
      function fmtSize(bytes) {
        if (!bytes) return '';
        return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
      }
      function drawFiles() {
        var wrap = body.querySelector('#nf-files');
        wrap.innerHTML = '';
        files.forEach(function (f, i) {
          var row = UI.el('<div class="list-item">' +
            '<span class="li-thumb">' + UI.icon('file') + '</span>' +
            '<span class="li-main"><span class="li-title">' + UI.esc(f.name || 'file.pdf') + '</span>' +
            '<span class="li-sub">PDF' + (f.size ? ' · ' + fmtSize(f.size) : '') + '</span></span>' +
            '<button type="button" class="btn-icon sm" aria-label="remove file">' + UI.icon('trash') + '</button></div>');
          row.querySelector('button').addEventListener('click', function () { files.splice(i, 1); drawFiles(); });
          wrap.appendChild(row);
        });
      }
      drawFiles();
      body.querySelector('#nf-add-pdf').addEventListener('click', function () { body.querySelector('#nf-pdf').click(); });
      body.querySelector('#nf-pdf').addEventListener('change', function (e) {
        Array.prototype.forEach.call(e.target.files, function (f) {
          if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) { UI.toast(f.name + ' is not a PDF'); return; }
          UI.fileToDataUrl(f).then(function (d) {
            files.push({ ref: d, name: f.name, size: f.size });
            drawFiles();
          }).catch(function () { UI.toast('Could not read ' + f.name); });
        });
        e.target.value = '';
      });

      body.querySelector('#nf-add-img').addEventListener('click', function () { body.querySelector('#nf-file').click(); });
      body.querySelector('#nf-file').addEventListener('change', function (e) {
        var chain = Promise.resolve();
        Array.prototype.forEach.call(e.target.files, function (f) {
          chain = chain.then(function () {
            return UI.fileToDataUrl(f).then(function (d) {
              if (/^video\//.test(f.type)) { videos.push(d); drawMedia(); }
              else insertImage(d);
            }).catch(function () { UI.toast('Could not read ' + f.name); });
          });
        });
        e.target.value = '';
      });

      UI.modal(existing ? 'Edit note' : 'New note', body, [
        { label: 'Cancel' },
        {
          label: 'Save', primary: true, onClick: function (close) {
            n.title = body.querySelector('#nf-title').value.trim();
            n.folderId = body.querySelector('#nf-folder').value || null;
            n.tags = selTags;
            n.pinned = body.querySelector('#nf-pin').checked;
            n.bg = bgSel;
            var kept = blocks.filter(function (b, bi) {
              if (b.t === 'img' || (b.v || '').trim() !== '') return true;
              var prev = blocks[bi - 1];   // keep an empty SIDE slot so the
              return !!(prev && prev.t === 'img' && prev.wrap);   // below text stays below
            });
            Promise.all([
              Promise.all(kept.map(function (b) {
                if (b.t !== 'img') return Promise.resolve({ t: 'txt', v: b.v });
                var stored = { t: 'img', ref: b.ref, size: b.size || 100, wrap: !!b.wrap, align: b.align === 'right' ? 'right' : 'left' };
                if (b.ref && b.ref.slice(0, 5) === 'data:') {
                  return DB.internMedia(b.ref, 'image').then(function (id) { stored.ref = id; return stored; });
                }
                return Promise.resolve(stored);
              })),
              DB.internUrlList(videos, 'video'),
              Promise.all(files.map(function (f) {
                if (f.ref && f.ref.slice(0, 5) === 'data:') {
                  return DB.internMedia(f.ref, 'pdf').then(function (id) { return { ref: id, name: f.name, size: f.size }; });
                }
                return Promise.resolve({ ref: f.ref, name: f.name, size: f.size });
              }))
            ]).then(function (r2) {
              n.blocks = r2[0];
              n.videos = r2[1];
              n.files = r2[2];
              n.images = r2[0].filter(function (b) { return b.t === 'img'; }).map(function (b) { return b.ref; });
              n.body = r2[0].filter(function (b) { return b.t === 'txt' && b.v; }).map(function (b) { return b.v; }).join('\n');
              return DB.put('notes', n);
            }).then(function () { UI.toast('Saved'); close(); onSaved && onSaved(n); });
          }
        }
      ]);
    });
  }

  /* ================= Alarm Reminder ================= */

  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function resyncNativeAlarms() { if (window.Native) Native.syncAlarms(); }

  function renderAlarm(el) {
    el.appendChild(UI.header({ title: 'Alarm Reminder', back: '#/discipline' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);

    function draw() {
      wrap.innerHTML = '';
      DB.all('alarms').then(function (rows) {
        if (!rows.length) { wrap.appendChild(UI.emptyState('No alarms', 'Tap + to add one')); return; }
        rows.sort(function (a, b) { return a.time.localeCompare(b.time); });
        var list = UI.el('<div class="list alarm-list"></div>');
        rows.forEach(function (a) {
          var daysStr = (a.days && a.days.length) ? a.days.map(function (d) { return DAYS[d]; }).join(' ') : 'Every day';
          var it = UI.el('<div class="list-item">' +
            '<span class="li-main"><span class="li-title" style="font-size:1.3rem">' + a.time + '</span>' +
            '<span class="li-sub">' + UI.esc(a.label || '') + (a.label ? ' · ' : '') + daysStr + '</span></span>' +
            '<label class="switch"><input type="checkbox"' + (a.enabled ? ' checked' : '') + '></label>' +
            '<button class="btn-icon" aria-label="delete">' + UI.icon('trash') + '</button></div>');
          it.querySelector('input').addEventListener('change', function (e) {
            a.enabled = e.target.checked;
            DB.put('alarms', a).then(resyncNativeAlarms);
          });
          it.querySelector('.btn-icon').addEventListener('click', function () {
            UI.confirm('Delete this alarm?', 'Delete').then(function (ok) {
              if (ok) DB.del('alarms', a.id).then(function () { resyncNativeAlarms(); draw(); });
            });
          });
          it.querySelector('.li-main').addEventListener('click', function () { alarmForm(a, draw); });
          list.appendChild(it);
        });
        wrap.appendChild(list);
      });
    }

    el.appendChild(UI.fab('Add alarm', function () { alarmForm(null, draw); }));
    draw();
  }

  function alarmForm(existing, onSaved) {
    var a = existing || { id: DB.uid(), label: '', time: '18:00', days: [], enabled: true };
    var body = UI.el('<div>' +
      UI.field('Time', '<input type="time" id="af-time" value="' + a.time + '">') +
      UI.field('Label', '<input type="text" id="af-label" value="' + UI.esc(a.label) + '" placeholder="e.g. Gym time">') +
      '<div class="field"><span class="field-label">Repeat days (none = every day)</span><div id="af-days"></div></div></div>');
    var sel = (a.days || []).slice();
    DAYS.forEach(function (d, i) {
      var chip = UI.el('<button type="button" class="chip' + (sel.indexOf(i) >= 0 ? ' on' : '') + '" style="border:0;cursor:pointer;font:inherit">' + d + '</button>');
      chip.addEventListener('click', function () {
        var ix = sel.indexOf(i);
        if (ix >= 0) sel.splice(ix, 1); else sel.push(i);
        chip.classList.toggle('on');
      });
      body.querySelector('#af-days').appendChild(chip);
    });
    UI.modal(existing ? 'Edit alarm' : 'New alarm', body, [
      { label: 'Cancel' },
      {
        label: 'Save', primary: true, onClick: function (close) {
          a.time = body.querySelector('#af-time').value || '18:00';
          a.label = body.querySelector('#af-label').value.trim();
          a.days = sel.sort();
          DB.put('alarms', a).then(function () {
            askNotifPermission();
            resyncNativeAlarms();
            UI.toast('Saved'); close(); onSaved && onSaved();
          });
        }
      }
    ]);
  }

  /* ================= Incline Walk recorder =================
     12-3-30 style: incline 12–15 %, speed 3–5.5, time 30–50 min.
     New entries prefill with the last session's numbers. */

  function renderWalk(el) {
    el.appendChild(UI.header({ title: 'Incline Walk', back: '#/discipline' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);

    function draw() {
      wrap.innerHTML = '';
      DB.all('walks').then(function (rows) {
        if (!rows.length) {
          wrap.appendChild(UI.emptyState('No incline walks yet', 'Tap + to record a 12-3-30 style session'));
          return;
        }
        rows.sort(function (a, b) { return b.date.localeCompare(a.date); });
        var recent = rows.slice(0, 60);
        var list = UI.el('<div class="list"></div>');
        recent.forEach(function (w) {
          var it = UI.el('<div class="list-item">' +
            '<span class="li-thumb">' + UI.icon('walk') + '</span>' +
            '<span class="li-main"><span class="li-title">' + w.incline + '% · ' + w.speed + ' · ' + w.minutes + ' min</span>' +
            '<span class="li-sub">' + UI.fmtDate(w.date) + '</span></span>' +
            '<button class="btn-icon" aria-label="delete">' + UI.icon('trash') + '</button></div>');
          it.querySelector('.btn-icon').addEventListener('click', function (e) {
            e.stopPropagation();
            UI.confirm('Delete this walk?', 'Delete').then(function (ok) { if (ok) DB.del('walks', w.id).then(draw); });
          });
          it.querySelector('.li-main').addEventListener('click', function () { walkForm(w, draw); });
          list.appendChild(it);
        });
        wrap.appendChild(list);
      });
    }

    el.appendChild(UI.fab('Record walk', function () { walkForm(null, draw); }));
    draw();
  }

  function walkForm(existing, onSaved) {
    DB.all('walks').then(function (rows) {
      rows.sort(function (a, b) { return a.date.localeCompare(b.date); });
      var last = rows[rows.length - 1];
      var w = existing || {
        id: DB.uid(),
        date: DB.todayISO(),
        incline: last ? last.incline : 12,
        speed: last ? last.speed : 3,
        minutes: last ? last.minutes : 30
      };
      var today = DB.todayISO();
      var body = UI.el('<div>' +
        UI.field('Date (past or today only)', '<input type="date" id="wf-date" value="' + w.date + '" max="' + today + '">') +
        '<div class="row2">' +
        UI.field('Incline %', '<input type="number" id="wf-inc" step="0.5" min="0" max="30" inputmode="decimal" value="' + w.incline + '">') +
        UI.field('Speed', '<input type="number" id="wf-spd" step="0.1" min="1" max="10" inputmode="decimal" value="' + w.speed + '">') +
        '</div>' +
        UI.field('Time (minutes)', '<input type="number" id="wf-min" step="5" min="5" max="180" inputmode="numeric" value="' + w.minutes + '">') +
        '</div>');
      body.querySelectorAll('input[type=number]').forEach(function (inp) {
        inp.addEventListener('focus', function () { this.select(); });
      });
      UI.modal(existing ? 'Edit walk' : 'Record incline walk', body, [
        { label: 'Cancel' },
        {
          label: 'Save', primary: true, onClick: function (close) {
            var date = body.querySelector('#wf-date').value;
            if (!date) { UI.toast('Pick a date'); return; }
            if (date > today) { UI.toast('Future dates are not allowed'); return; }
            w.date = date;
            w.incline = parseFloat(body.querySelector('#wf-inc').value) || 0;
            w.speed = parseFloat(body.querySelector('#wf-spd').value) || 0;
            w.minutes = parseInt(body.querySelector('#wf-min').value, 10) || 0;
            if (!w.incline || !w.speed || !w.minutes) { UI.toast('Fill incline, speed and time'); return; }
            DB.put('walks', w).then(function () { UI.toast('Saved'); close(); onSaved && onSaved(); });
          }
        }
      ]);
    });
  }

  return { render: render, TIMED_ALERTS: TIMED_ALERTS, ALLDAY_ALERTS: ALLDAY_ALERTS };
})();
