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
    { id: 'motiv', name: 'Fitness Motivation', icon: 'play',   sub: 'Video clips from Drive — rate & sort' },
    { id: 'aesth', name: 'Aesthetic Collection', icon: 'camera', sub: 'Physique images from Drive — rate & sort' }
  ]; /* v0.51: Incline Walk moved to Program → Fitness */

  function render(el, parts) {
    if (!parts.length) return renderHome(el);
    if (parts[0] === 'todo') {
      if (parts[1] === 'moment') return renderMoment(el);
      if (parts[1] === 'send') return renderSend(el);
      if (parts[1] === 'review') return renderReview(el);
      if (parts[1] === 'completed') return renderCompleted(el, parts[2]);
      return renderTodo(el);
    }
    if (parts[0] === 'alarm') return renderAlarm(el);
    if (parts[0] === 'motiv') return renderMotiv(el);
    if (parts[0] === 'aesth') return renderAesth(el);
    if (parts[0] === 'walk') { location.hash = '#/program/walk'; return; } /* moved v0.51 */
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
    /* v0.53: METAL ramp (Alef's choice) — Bronze → Silver → Gold →
       Platinum(💎), so the colors READ as rising priority. Habit 🌱 is
       "very very high": platinum-class background + the sprout glyph. */
    ['highest', 'Highest', 'diamond'],
    ['vhigh', 'Very high', 'gold'],
    ['high', 'High', 'silver'],
    ['medium', 'Medium', 'bronze'],
    ['low', 'Habit', 'habit'], /* v0.50: Low became Habit 🌱 (same slot) */
    ['none', 'N/A', 'grey'],
    ['monkey', 'Never', 'purple']
  ];
  /* v0.40: rank for the Today sort — Now tasks order by rating.
     v0.53: Habit ranks as very-very-high — above Gold, below 💎. */
  var TD_PRIO_RANK = { highest: 0, low: 1, vhigh: 2, high: 3, medium: 4, none: 5, monkey: 6 };
  function prioName(id) {
    var p = TD_PRIOS.filter(function (x) { return x[0] === id; })[0];
    return p ? p[1] : 'N/A';
  }

  var _tdFilter = []; /* active tag filter (session only) */
  var _nowColor = '#d9a441'; /* NOW list color — borders the flagged tasks */

  /* v0.50: recognize a DDMMYY token in a task title as its start date —
     a future date within 366 days, DD 01-31, MM 01-12, YY ≥ 26 (AD only).
     Returns { date: 'YYYY-MM-DD', title: <token stripped> } or null. */
  function parseStartToken(title) {
    var m = /(^|\s)(\d{2})(\d{2})(\d{2})(?=\s|$)/.exec(title || '');
    if (!m) return null;
    var dd = +m[2], mm = +m[3], yy = +m[4];
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12 || yy < 26) return null;
    var iso = '20' + m[4] + '-' + m[3] + '-' + m[2];
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime()) || d.getDate() !== dd || (d.getMonth() + 1) !== mm) return null;
    var diff = (d - new Date(DB.todayISO() + 'T00:00:00')) / 86400000;
    if (diff < 0 || diff > 366) return null;
    var at = m.index + m[1].length;
    var cleaned = (title.slice(0, at) + title.slice(at + 6)).replace(/\s{2,}/g, ' ').trim();
    return { date: iso, title: cleaned || title.trim() };
  }

  /* ---- v0.54: TOMORROW — a virtual list between TODAY and LATER ----
     Membership is COMPUTED (startDate === tomorrow), never stored: the
     list is not a todoCats entry and never rides sync/backups/the share.
     From 00:01 every task dated for tomorrow surfaces here by itself
     (tomorrowISO rolls at midnight; draw computes membership live), and
     the next midnight promoteNowDue carries it on into TODAY. */
  /* v0.58 C13: local-time date for a timestamp (toISOString sliced showed
     YESTERDAY before ~07:00 in UTC+7) */
  function localISO(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function tomorrowISO() {
    var d = new Date(DB.todayISO() + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  /* The move rules as a pure plan — dropTask applies it, the suite tests
     it. IN: assign tomorrow 08:00 (a task already scheduled for ANOTHER
     day asks first; a Today/undated task moves silently). OUT: leaving
     TOMORROW for any real list clears the assigned date + time. */
  function tdMovePlan(t, cat, tomISO) {
    if (cat === 'tomorrow') {
      if (t.startDate === tomISO) return { ask: null, patch: {} }; /* reorder within the list */
      return {
        ask: t.startDate
          ? 'This task is scheduled for ' + t.startDate + ' ' + (t.startTime || '08:00') +
            '. Move it to TOMORROW (' + tomISO + ' 08:00) instead?'
          : null,
        patch: { cat: 'later', now: false, nowAt: null, startDate: tomISO, startTime: '08:00' }
      };
    }
    if (t.startDate === tomISO) return { ask: null, patch: { startDate: null, startTime: null } };
    return { ask: null, patch: {} };
  }

  /* ---- v0.48: export tasks as readable text (clipboard / .txt) ---- */

  /* one task → markdown-ish block: checkbox line + markers, then subtasks
     and the note indented underneath */
  function fmtTaskText(t, tagName) {
    var extra = [];
    if (t.prio && t.prio !== 'none') extra.push('[' + prioName(t.prio) + ']');
    if (t.now || t.cat === 'now') extra.push('[Now]');
    else if (t.startDate) extra.push('[@' + t.startDate + ' ' + (t.startTime || '08:00') + ']');
    else if (t.nowAt) extra.push('[@' + t.nowAt + ']');
    if (t.locked) extra.push('[Protected]');
    var tags = (t.tags || []).map(function (id) { return (tagName || {})[id]; }).filter(Boolean);
    if (tags.length) extra.push(tags.map(function (n) { return '#' + n; }).join(' '));
    var lines = ['- [' + (t.done ? 'x' : ' ') + '] ' + (t.title || '') +
      (extra.length ? '  ' + extra.join(' ') : '')];
    (t.subs || []).forEach(function (s) {
      lines.push('    - [' + (s.done ? 'x' : ' ') + '] ' + (s.title || ''));
    });
    if (t.note && String(t.note).trim()) {
      String(t.note).trim().split('\n').forEach(function (ln, i) {
        lines.push('    ' + (i === 0 ? 'note: ' : '      ') + ln);
      });
    }
    return lines.join('\n');
  }

  /* selected categories → one text document; grouping mirrors draw():
     Now-flagged tasks live under TODAY, done tasks sink to the bottom */
  function buildTodoExport(cats, rows, tagName, selIds) {
    var out = ['Alef.do — ' + DB.todayISO(), ''];
    cats.forEach(function (c) {
      if (c.id === 'now' || c.id === 'vault' || selIds.indexOf(c.id) < 0) return;
      var inCat = rows.filter(function (t) {
        if (t.archived) return false;
        var home = t.cat || 'today';
        if (home === 'vault') return false;
        var flagged = t.now || home === 'now';
        if (c.id === 'today') return flagged || home === 'today';
        return !flagged && home === c.id;
      });
      if (!inCat.length) return;
      inCat.sort(function (a, b) {
        if (a.done !== b.done) return a.done - b.done;
        var an = (a.now || a.cat === 'now') ? 1 : 0, bn = (b.now || b.cat === 'now') ? 1 : 0;
        if (an !== bn) return bn - an;
        var at2 = a.nowAt || '99:99', bt2 = b.nowAt || '99:99';
        if (at2 !== bt2) return at2 < bt2 ? -1 : 1;
        return (a.order || a.createdAt || 0) - (b.order || b.createdAt || 0);
      });
      out.push('## ' + c.name);
      inCat.forEach(function (t) { out.push(fmtTaskText(t, tagName)); });
      out.push('');
    });
    return out.join('\n').replace(/\n+$/, '') + '\n';
  }

  function slugName(s) {
    return String(s || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '').slice(0, 40) || 'task';
  }

  function tagNameMap() {
    return DB.byIndex('tags', 'module', 'todo').then(function (rows) {
      var m = {};
      rows.forEach(function (x) { m[x.id] = x.name; });
      return m;
    });
  }

  /* shared picker: check/uncheck items (+ Select all) → Copy / Save .txt */
  function exportPicker(opts) {
    var body = UI.el('<div><label class="td-sub-row exp-all"><input type="checkbox" checked>' +
      '<span class="td-sub-title"><b>Select all</b></span></label>' +
      '<div class="exp-list"></div></div>');
    var listEl = body.querySelector('.exp-list');
    opts.items.forEach(function (it) {
      listEl.appendChild(UI.el('<label class="td-sub-row"><input type="checkbox" value="' + UI.esc(it.id) + '"' +
        (it.checked === false ? '' : ' checked') + '><span class="td-sub-title">' + UI.esc(it.label) + '</span></label>'));
    });
    var master = body.querySelector('.exp-all input');
    function itemBoxes() { return listEl.querySelectorAll('input'); }
    master.addEventListener('change', function () {
      Array.prototype.forEach.call(itemBoxes(), function (b) { b.checked = master.checked; });
    });
    listEl.addEventListener('change', function () {
      master.checked = Array.prototype.every.call(itemBoxes(), function (b) { return b.checked; });
    });
    function picked() {
      return Array.prototype.filter.call(itemBoxes(), function (b) { return b.checked; })
        .map(function (b) { return b.value; });
    }
    function compose() {
      var ids = picked();
      if (!ids.length) { UI.toast('Nothing selected'); return null; }
      return opts.compose(ids);
    }
    UI.modal(opts.title, body, [
      { label: 'Cancel' },
      {
        label: 'Copy', onClick: function (close) {
          var text = compose();
          if (text == null) return;
          UI.copyText(text).then(function (ok) {
            UI.toast(ok ? 'Copied to clipboard ✓' : 'Copy failed — use Save .txt');
            if (ok) close();
          });
        }
      },
      {
        label: 'Save .txt', primary: true, onClick: function (close) {
          var text = compose();
          if (text == null) return;
          UI.download(opts.filename, text, 'text/plain');
          if (!(window.Native && Native.isNative && Native.isNative())) UI.toast('Exported ' + opts.filename);
          close();
        }
      }
    ]);
  }

  /* header button: pick lists (everything except the Vault) → text */
  function exportMain() {
    Promise.all([DB.getTodoCats(), DB.all('todos'), tagNameMap()]).then(function (r) {
      var cats = r[0], rows = r[1], tagName = r[2];
      exportPicker({
        title: 'Export as text',
        items: cats.filter(function (c) { return c.id !== 'now' && c.id !== 'vault'; })
          .map(function (c) { return { id: c.id, label: c.name }; }),
        filename: 'alef-do-' + DB.todayISO() + '.txt',
        compose: function (ids) { return buildTodoExport(cats, rows, tagName, ids); }
      });
    });
  }

  /* task-sheet button: this one task (current, unsaved edits included) */
  function exportOneTask(t, cats) {
    tagNameMap().then(function (tagName) {
      var cat = null;
      (cats || []).forEach(function (c) { if (c.id === (t.cat || 'today')) cat = c; });
      var text = 'Alef.do task — ' + DB.todayISO() + '\n' +
        (cat ? 'List: ' + cat.name + '\n' : '') + '\n' +
        fmtTaskText(t, tagName) + '\n';
      var body = UI.el('<div><textarea class="exp-prev" readonly></textarea></div>');
      body.querySelector('.exp-prev').value = text;
      UI.modal('Export task', body, [
        { label: 'Close' },
        {
          label: 'Copy', onClick: function (close) {
            UI.copyText(text).then(function (ok) {
              UI.toast(ok ? 'Copied to clipboard ✓' : 'Copy failed — use Save .txt');
              if (ok) close();
            });
          }
        },
        {
          label: 'Save .txt', primary: true, onClick: function (close) {
            var fn = 'alef-do-task-' + slugName(t.title) + '-' + DB.todayISO() + '.txt';
            UI.download(fn, text, 'text/plain');
            if (!(window.Native && Native.isNative && Native.isNative())) UI.toast('Exported ' + fn);
            close();
          }
        }
      ]);
    });
  }

  /* Vault popup entry: pick individual Vault entries → text (stays local,
     same rule as the Vault JSON backup — user-initiated file/clipboard only) */
  function exportVaultText() {
    Promise.all([DB.all('todos'), tagNameMap()]).then(function (r) {
      var vt = r[0].filter(function (t) { return t.cat === 'vault' && !t.archived; });
      var tagName = r[1];
      if (!vt.length) { UI.toast('Vault is empty'); return; }
      vt.sort(function (a, b) {
        if (a.done !== b.done) return a.done - b.done;
        return (a.order || a.createdAt || 0) - (b.order || b.createdAt || 0);
      });
      exportPicker({
        title: 'Export Vault as text',
        items: vt.map(function (t) { return { id: t.id, label: t.title }; }),
        filename: 'vault-text-' + DB.todayISO() + '.txt',
        compose: function (ids) {
          var out = ['The Vault — ' + DB.todayISO(), ''];
          vt.forEach(function (t) {
            if (ids.indexOf(t.id) >= 0) out.push(fmtTaskText(t, tagName));
          });
          return out.join('\n') + '\n';
        }
      });
    });
  }

  /* v0.55: the v0.53 "Schedules" section (work-calendar events under
     PROJECT) was REMOVED — Alef manages the work calendar entirely in
     AwesomeCalendar. The stale device-local meta 'schedList' cache is
     purged when Alef.do opens (no-op once gone; the key never returns —
     it was device-local, nothing syncs it back). */

  function renderTodo(el) {
    DB.del('meta', 'schedList').catch(function () { /* nothing to purge */ });
    var hdr = UI.header({
      title: 'Alef.do', back: '#/discipline',
      action: { icon: 'dots', label: 'menu', onClick: function () { toggleMenu(); } }
    });
    /* v0.31 D1: icon-only Claude sync button — pull Claude's batch, apply,
       push a fresh share. Shown only while Share with Claude is on. */
    if ((DB.getSettings() || {}).claudeShareOn && window.Sync && Sync.claudeRoundTrip) {
      var syncBtn = UI.el('<button class="btn-icon" aria-label="Sync with Claude">' + UI.icon('sync') + '</button>');
      syncBtn.addEventListener('click', function () {
        if (syncBtn.classList.contains('spin')) return;
        syncBtn.classList.add('spin');
        Sync.claudeRoundTrip({ interactive: true })
          .then(function (r) {
            syncBtn.classList.remove('spin');
            if (!r) { UI.toast('Sync could not run'); return; }
            if (r.off) { UI.toast('Turn on Setting → Share with Claude'); return; }
            if (r.offline) { UI.toast('Offline — will sync when back online'); return; }
            if (r.busy) { UI.toast('Sync already running…'); return; }
            UI.toast('Synced ✓');
            if ((r.applied || 0) + (r.imported || 0) > 0) draw();
          })
          .catch(function (e) {
            syncBtn.classList.remove('spin');
            UI.toast('Sync failed: ' + String(e && e.message || e).slice(0, 80));
          });
      });
      var actSpan = hdr.querySelector('.topbar-action');
      actSpan.insertBefore(syncBtn, actSpan.firstChild);
    }
    /* v0.48: icon-only text export — every list except the Vault */
    var expBtn = UI.el('<button class="btn-icon" aria-label="Export tasks as text">' + UI.icon('export') + '</button>');
    expBtn.addEventListener('click', exportMain);
    var actSpan2 = hdr.querySelector('.topbar-action');
    actSpan2.insertBefore(expBtn, actSpan2.firstChild);
    el.appendChild(hdr);
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
        '<button data-a="tags">' + UI.icon('tag') + '<span>Tag ' + (s.todoTagsOn ? 'ON' : 'OFF') + '</span></button>' +
        '<button data-a="completed">' + UI.icon('todo') + '<span>Completed</span></button></div>');
      m.querySelector('[data-a=completed]').addEventListener('click', function () {
        m.remove();
        location.hash = '#/discipline/todo/completed';
      });
      m.querySelector('[data-a=moment]').addEventListener('click', function () {
        m.remove();
        if (DB.proposalMode()) { UI.toast('Moment runs on the S26 (this PC proposes changes)'); return; }
        location.hash = '#/discipline/todo/moment';
      });
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
      /* v0.40: hour-tagged tasks whose time has passed flip to Now on every
         list draw, not only at app boot (promoteNowDue no-ops on the PC) */
      DB.promoteNowDue().then(function () {
        return Promise.all([DB.getTodoCats(), DB.all('todos'), DB.byIndex('tags', 'module', 'todo'), DB.all('proposals')]);
      }).then(function (res) {
        /* Vault: fixed private list injected after PROJECT (not part of the
           editable/synced list order). S26 only — hidden on the PC so the
           private data has exactly one home. */
        cats = res[0].slice();
        /* v0.54: TOMORROW — virtual list right after TODAY (computed
           membership: tasks whose startDate is tomorrow live here) */
        var tomISO = tomorrowISO();
        var tAt = -1;
        cats.forEach(function (c, ci) { if (c.id === 'today' && tAt < 0) tAt = ci + 1; });
        cats.splice(tAt < 0 ? 1 : tAt, 0, { id: 'tomorrow', name: 'TOMORROW', color: '#3fb8a8' });
        if ((DB.getSettings() || {}).deviceId !== 'PC') {
          var vAt = cats.length;
          cats.forEach(function (c, ci) { if (c.id === 'project') vAt = ci + 1; });
          cats.splice(vAt, 0, { id: 'vault', name: '', color: '#b9a44c' });
        }
        var rows = res[1], tags = res[2], props = res[3];
        /* v0.41: archived (Completed Tasks) entries live on their own page */
        rows = rows.filter(function (t) { return !t.archived; });
        _nowColor = '#d9a441';
        res[0].forEach(function (c) { if (c.id === 'now' && c.color) _nowColor = c.color; });
        /* proposal badges: PC → drafts to send; S26 → sent to review */
        if (DB.proposalMode()) {
          if (props.length) {
            var pbar = UI.el('<button class="td-propbar">⏳ ' + props.length + ' change' + (props.length === 1 ? '' : 's') + ' — Send to S26 ›</button>');
            pbar.addEventListener('click', function () { location.hash = '#/discipline/todo/send'; });
            wrap.appendChild(pbar);
          }
        } else {
          var inbox = props.filter(function (x) { return x.status === 'sent'; });
          if (inbox.length) {
            var rbar = UI.el('<button class="td-propbar td-propbar-rx">📥 Review PC changes (' + inbox.length + ') ›</button>');
            rbar.addEventListener('click', function () { location.hash = '#/discipline/todo/review'; });
            wrap.appendChild(rbar);
          }
        }
        var ghosts = DB.proposalMode() ? props.filter(function (x) { return x.store === 'todos' && x.action === 'add'; }) : [];
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
          if (c.id === 'now') return; /* Now lives INSIDE Today (top, colored border) */
          var inCat = rows.filter(function (t) {
            var home = t.cat || 'today';
            if (home === 'vault') return c.id === 'vault';
            var flagged = t.now || home === 'now';
            /* v0.54: a task dated for tomorrow shows under TOMORROW, not
               in its home list (membership rolls over at midnight) */
            var tom = !flagged && t.startDate === tomISO;
            if (c.id === 'tomorrow') return tom;
            if (tom) return false;
            if (c.id === 'today') return flagged || home === 'today';
            return !flagged && home === c.id;
          });
          inCat.sort(function (a, b) {
            if (a.done !== b.done) return a.done - b.done;             /* done sink to the bottom */
            if (a.done) return (a.doneAt || 0) - (b.doneAt || 0);      /* newest finished lowest */
            var an = (a.now || a.cat === 'now') ? 1 : 0, bn = (b.now || b.cat === 'now') ? 1 : 0;
            if (an !== bn) return bn - an;                             /* Now on top of Today */
            if (c.id === 'today') {
              /* v0.40: day arrangement — Now tasks rank by priority rating;
                 below them, hour-tagged tasks ascend by time, rest keep order */
              if (an) {
                var pr = (TD_PRIO_RANK[a.prio] !== undefined ? TD_PRIO_RANK[a.prio] : 5) -
                         (TD_PRIO_RANK[b.prio] !== undefined ? TD_PRIO_RANK[b.prio] : 5);
                if (pr) return pr;
              } else {
                var at2 = a.nowAt || '99:99', bt2 = b.nowAt || '99:99';
                if (at2 !== bt2) return at2 < bt2 ? -1 : 1;
              }
            }
            if (c.id === 'tomorrow') {
              /* v0.54: earliest start time first (most are 08:00) */
              var at3 = a.startTime || '08:00', bt3 = b.startTime || '08:00';
              if (at3 !== bt3) return at3 < bt3 ? -1 : 1;
            }
            return (a.order || a.createdAt || 0) - (b.order || b.createdAt || 0);
          });
          var st;
          if (c.id === 'vault') {
            /* keylock icon only — tap it for the Vault menu (backup/info) */
            st = UI.el('<button class="section-title td-cat-title td-vault-title" data-cat="vault" aria-label="Vault — private list, stays on this phone">' + UI.icon('lock') + '<span class="td-vault-label">The Vault</span></button>');
            st.addEventListener('click', vaultMenu);
          } else {
            st = UI.el('<div class="section-title td-cat-title" data-cat="' + c.id + '">' + UI.esc(c.name) + '</div>');
          }
          if (c.color) st.style.color = c.color;
          wrap.appendChild(st);
          var zone = UI.el('<div class="list td-zone" data-cat="' + c.id + '"></div>');
          var gInCat = ghosts.filter(function (g) {
            var d = g.data || {};
            var home = d.cat || 'today';
            var gtom = !d.now && d.startDate === tomISO; /* v0.54 */
            if (c.id === 'tomorrow') return gtom;
            if (gtom) return false;
            if (c.id === 'today') return d.now || home === 'today';
            return !d.now && home === c.id;
          });
          if (!inCat.length && !gInCat.length) {
            /* v0.32: tappable empty row — one touch opens quick-add with
               THIS list preselected (v0.34: looks like the plain old
               "empty" label again, per Alef) */
            var emptyBtn = UI.el('<button type="button" class="cat-empty sub" aria-label="Add a task to ' +
              UI.esc(c.name || 'Vault') + '">empty</button>');
            emptyBtn.addEventListener('click', function () { quickAdd(c.id); });
            zone.appendChild(emptyBtn);
          }
          inCat.forEach(function (t) { zone.appendChild(taskRow(t, showTags)); });
          gInCat.forEach(function (g) {
            var gr = UI.el('<div class="list-item todo-item td-ghost"><input type="checkbox" disabled>' +
              '<span class="li-main"><span class="li-title">' + UI.esc((g.data && g.data.title) || '(draft)') + ' <span class="td-ghostmark">⏳ ' + (g.status === 'sent' ? 'sent' : 'draft') + '</span></span></span></div>');
            gr.addEventListener('click', function () { location.hash = '#/discipline/todo/send'; });
            zone.appendChild(gr);
          });
          wrap.appendChild(zone);
        });
      });
    }

    /* Vault safekeeping cockpit (v0.52, docs/VAULT-SAFEKEEP-PLAN.md):
       info block, ONE-TAP dated .AFdd backup with guided USB step,
       .AFdd/.zip/.json import (full filename shown), backup history. */
    function vkDate(ms, withTime) {
      if (!ms) return '—';
      var d = new Date(ms);
      var out = String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
      if (withTime !== false) out += ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      return out;
    }
    function vaultMenu() {
      /* v0.65 (Alef's ruling): ONE backup file — the Vault rides the
         Full backup (AFbak). The dated .AFdd + serial ceremony is gone;
         the silent rolling copy stays as the automatic safety net. */
      Promise.all([VaultKeep.info(), DB.get('meta', 'fullBackupInfo')]).then(function (rr) {
        var vi = rr[0];
        var fb = rr[1] && rr[1].value;
        var fbTxt = (fb && fb.ok)
          ? '✓ ' + vkDate(fb.at, false) + (fb.at < (vi.changeAt || 0) ? ' · ⚠ older than the last change' : '')
          : '⚠ none yet — Setting → Backup';
        var body = UI.el('<div>' +
          '<div class="card vk-info">' +
          '<div><span>Entries</span><b>' + vi.entries + '</b></div>' +
          '<div><span>Last change</span><b>' + vkDate(vi.changeAt) + '</b></div>' +
          '<div><span>Rolling copy</span><b>' + (vi.canMirror
            ? (vi.mirrorAt ? '✓ ' + vkDate(vi.mirrorAt) : '⚠ not written yet')
            : '— (runs on the APK)') + '</b></div>' +
          '<div><span>In Full backup</span><b>' + fbTxt + '</b></div>' +
          '</div>' +
          '<div class="sub" style="margin-bottom:8px">🔒 The Vault lives on this S26 only — never in the cloud. ' +
          'It backs up INSIDE the Full backup (Setting → Backup → <b>AFbak-DDMMYY.json</b>), and the rolling copy ' +
          '<b>' + VaultKeep.CURRENT_NAME + '</b> in Documents › S26-Alef-Fit rewrites itself ~10 s after every change ' +
          'and survives app updates — nothing extra to manage.</div></div>');
        /* import: .AFdd / .zip / legacy .json — full filename shown first */
        var impBtn = UI.el('<button class="btn btn-block">' + UI.icon('upload') + ' Import backup (.AFdd / .zip / .json)</button>');
        var impFile = UI.el('<input type="file" accept=".AFdd,.zip,.json,application/json,application/zip,application/octet-stream" class="hidden">');
        impBtn.addEventListener('click', function () { impFile.click(); });
        impFile.addEventListener('change', function (e) {
          var f = e.target.files[0];
          e.target.value = '';
          if (!f) return;
          var fr = new FileReader();
          fr.onload = function () {
            VaultKeep.parseBackup(fr.result).then(function (json) {
              if (!json || json.kind !== 'vault-backup') { UI.toast('Not a Vault backup file'); return; }
              var b2 = UI.el('<div><p>Import this Vault backup?</p>' +
                '<p class="vk-file">' + UI.esc(f.name) + '</p>' +
                '<p class="sub">' + (json.vault || []).length + ' entries · exported ' + UI.esc((json.exportedAt || '?').slice(0, 10)) +
                (json.serial ? ' · #' + VaultKeep.fmtSerial(json.serial) : '') +
                '<br>Each entry is added as a NEW date-stamped copy — nothing merges or overwrites.</p></div>');
              UI.modal('Import Vault backup', b2, [
                { label: 'Cancel' },
                {
                  label: 'Import', primary: true, onClick: function (close) {
                    close();
                    DB.importVault(json).then(function (c) {
                      UI.toast('Vault: +' + c.added + ' entr' + (c.added === 1 ? 'y' : 'ies') + ' stamped (' + c.stamp + ') — review and tidy by hand');
                      draw();
                    }).catch(function (err) { UI.toast(String(err.message || err)); });
                  }
                }
              ]);
            }).catch(function (err) { UI.toast(String(err.message || err)); });
          };
          fr.readAsArrayBuffer(f);
        });
        body.appendChild(impBtn);
        body.appendChild(impFile);
        /* v0.48: text export — pick entries, copy or save .txt (local only) */
        var expTxt = UI.el('<button class="btn btn-block" style="margin-top:8px">' + UI.icon('export') + ' Export Vault as text</button>');
        expTxt.addEventListener('click', exportVaultText);
        body.appendChild(expTxt);
        UI.modal('Vault 🔒', body, [{ label: 'Close', primary: true }]);
      });
    }

    /* drop: change list and/or position; reindexes the target list */
    function dropTask(t, cat, beforeId) {
      if (cat === 'vault' && (DB.getSettings() || {}).deviceId === 'PC') { UI.toast('Vault lives on the S26 only'); return; }
      var wasVault = t.cat === 'vault';
      /* v0.54: TOMORROW rules — in: assign tomorrow 08:00 (an already-dated
         task confirms first, a Today task moves silently); out: the
         assigned date + time clear. */
      var tomISO = tomorrowISO();
      var plan = tdMovePlan(t, cat, tomISO);
      (plan.ask ? UI.confirm(plan.ask, 'Move to TOMORROW') : Promise.resolve(true)).then(function (okMv) {
        if (!okMv) { draw(); return; }
        Object.assign(t, plan.patch);
        DB.all('todos').then(function (allT) {
          var list;
          if (cat === 'tomorrow') {
            list = allT.filter(function (x) {
              return x.startDate === tomISO && !(x.now || x.cat === 'now') &&
                (x.cat || 'today') !== 'vault' && !x.done && x.id !== t.id;
            });
          } else if (cat === 'now') {
            t.now = true;
            if (t.cat === 'now') t.cat = 'today';
            list = allT.filter(function (x) { return (x.now || x.cat === 'now') && !x.done && x.id !== t.id; });
          } else {
            t.now = false;
            t.cat = cat;
            list = allT.filter(function (x) { return (x.cat || 'today') === cat && !(x.now || x.cat === 'now') && !x.done && x.id !== t.id && x.startDate !== tomISO; });
          }
          list.sort(function (a, b) { return (a.order || a.createdAt || 0) - (b.order || b.createdAt || 0); });
          var idx = list.length;
          if (beforeId) {
            for (var i = 0; i < list.length; i++) {
              if (list[i].id === beforeId) { idx = i; break; }
            }
          }
          list.splice(idx, 0, t);
          Promise.all(list.map(function (x, i2) {
            x.order = (i2 + 1) * 10;
            return DB.put('todos', x);
          })).then(function () {
            if (cat === 'vault' && !wasVault) UI.toast('Moved to Vault 🔒 — stays on this phone only');
            if (cat === 'tomorrow' && plan.patch.startDate) UI.toast('Moved to TOMORROW — starts ' + tomISO + ' 08:00');
            draw();
          });
        });
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
      /* v0.40: hour badge (arranged time) + priority color dot after the text */
      var marks = '';
      if (!t.done && t.startDate) {
        /* v0.50: scheduled start — dd/mm chip until the date arrives */
        marks += ' <span class="td-hrmark" title="Starts ' + UI.esc(t.startDate + ' ' + (t.startTime || '08:00')) + '">' +
          UI.esc(t.startDate.slice(8, 10) + '/' + t.startDate.slice(5, 7)) + '</span>';
      } else if (!t.done && t.nowAt && !t.now) {
        var hLbl = /^\d\d:00$/.test(t.nowAt) ? t.nowAt.slice(0, 2) : t.nowAt;
        marks += ' <span class="td-hrmark" title="Do at ' + UI.esc(t.nowAt) + '">' + UI.esc(hLbl) + '</span>';
      }
      if (!t.done && t.prio && t.prio !== 'none') {
        var pd = TD_PRIOS.filter(function (x) { return x[0] === t.prio; })[0];
        if (pd) marks += t.prio === 'low'
          ? ' <span class="td-pmark" title="Habit' + (t.habitCount ? ' ×' + t.habitCount : '') + '">🌱</span>'
          : ' <span class="td-pdot td-b-' + pd[2] + '" title="' + pd[1] + '"></span>';
      }
      var item = UI.el('<div class="list-item todo-item' + (t.done ? ' li-done' : '') + '" data-id="' + t.id + '">' +
        '<input type="checkbox" ' + (t.done ? 'checked ' : '') + (t.locked ? 'disabled ' : '') + 'aria-label="done">' +
        '<span class="li-main"><span class="li-title">' + UI.esc(t.title) + (t.locked ? ' <span class="td-lockmark">🔒</span>' : '') + marks + stamps + '</span>' +
        (when ? '<span class="li-sub">' + UI.esc(when) + '</span>' : '') + '</span>' +
        (subs.length ? '<span class="td-subbadge">' + UI.icon('stack') + '<span>' + doneSubs + '/' + subs.length + '</span></span>' : '') +
        (t.done && !t.locked ? '<button class="td-del" aria-label="delete">✕</button>' : '') +
        '</div>');
      if ((t.now || t.cat === 'now') && t.cat !== 'vault') {
        item.classList.add('td-nowrow');
        item.style.borderColor = _nowColor;
      }
      item.querySelector('input').addEventListener('change', function (e) {
        var checked = e.target.checked;
        function apply() {
          t.done = checked;
          if (checked) t.doneAt = Date.now();
          DB.put('todos', t).then(function () {
            /* v0.50: a finished Habit (🌱) plants tomorrow's copy */
            if (checked && t.prio === 'low') {
              return DB.regenHabit(t).then(function (c) {
                if (c) UI.toast('🌱 Habit ×' + c.habitCount + ' — planted for tomorrow 08:00');
              });
            }
          }).then(draw);
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
        /* v0.41: ✕ on a finished task ARCHIVES it into Completed Tasks
           (recoverable there) instead of deleting it outright */
        t.archived = true;
        t.archivedAt = Date.now();
        DB.put('todos', t).then(function () {
          UI.toast('Moved to Completed Tasks');
          draw();
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
        document.querySelectorAll('.drop-hint, .ins-above, .ins-below').forEach(function (h) {
          h.classList.remove('drop-hint'); h.classList.remove('ins-above'); h.classList.remove('ins-below');
        });
      }
      /* v0.50: the landing spot is a LINE above/below a row (was a border
         around the whole row — unclear where the task would land) */
      function rowHalf(row, y) {
        var r = row.getBoundingClientRect();
        return y < r.top + r.height / 2 ? 'above' : 'below';
      }
      function nextTaskRow(row) {
        var n = row.nextElementSibling;
        while (n && !(n.classList && n.classList.contains('todo-item') && n.dataset.id)) n = n.nextElementSibling;
        return n;
      }
      item.addEventListener('touchmove', function (e) {
        if (dragging) e.preventDefault(); /* stop page scroll while dragging */
      }, { passive: false });
      item.addEventListener('contextmenu', function (e) {
        if (dragging || holdTimer) e.preventDefault();
      });
      item.addEventListener('pointerdown', function (e) {
        if (t.locked) return; /* protected tasks don't drag */
        if (DB.proposalMode()) return; /* PC proposes; arranging happens on S26 */
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
          if (overRow) overRow.classList.add(rowHalf(overRow, ev.clientY) === 'above' ? 'ins-above' : 'ins-below');
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
          /* v0.50: land ABOVE or BELOW the hovered row, matching the line */
          var beforeId = null;
          if (dropRow) {
            if (rowHalf(dropRow, ev.clientY) === 'above') beforeId = dropRow.dataset.id;
            else {
              var nx = nextTaskRow(dropRow);
              beforeId = nx ? nx.dataset.id : null;
            }
          }
          dropTask(t, cat, beforeId);
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

    /* quick add: category chips + "I want to..." input, keyboard-ready.
       v0.32: optional presetCat preselects a list (tap on an empty list). */
    function quickAdd(presetCat) {
      if (typeof presetCat !== 'string') presetCat = null; /* FAB passes the click event */
      var exist = document.querySelector('.qa-panel');
      if (exist) {
        if (presetCat) {
          var pchip = exist.querySelector('.qa-chip[data-c="' + presetCat + '"]');
          if (pchip) pchip.click();
        }
        exist.querySelector('.qa-input').focus();
        return;
      }
      var selCat = (presetCat && presetCat !== 'now') ? presetCat : 'today';
      var nowOn = false;
      var p = UI.el('<div class="qa-panel"><div class="qa-cats"></div>' +
        '<div class="qa-row"><input type="text" class="qa-input" placeholder="I want to..." enterkeyhint="done">' +
        '<button class="btn btn-primary qa-add" type="button">Add</button>' +
        '<button class="btn-icon qa-x" aria-label="close">✕</button></div></div>');
      var catsRow = p.querySelector('.qa-cats');
      var nowCat = null;
      cats.forEach(function (c) { if (c.id === 'now') nowCat = c; });
      var nowChip = UI.el('<button type="button" class="qa-chip qa-now" data-c="__now">' + UI.esc(nowCat ? nowCat.name : 'NOW') + '</button>');
      nowChip.addEventListener('click', function () {
        nowOn = !nowOn;
        nowChip.classList.toggle('on', nowOn);
        p.querySelector('.qa-input').focus();
      });
      catsRow.appendChild(nowChip);
      cats.forEach(function (c) {
        if (c.id === 'now') return;
        var label = c.id === 'vault' ? '🔒' : UI.esc(c.name); /* Vault chip: keylock only */
        var chip = UI.el('<button type="button" class="qa-chip' + (c.id === selCat ? ' on' : '') + '" data-c="' + c.id + '" title="' + (c.id === 'vault' ? 'Vault — stays on this phone' : '') + '">' + label + '</button>');
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
        /* v0.50: a DDMMYY token in the title schedules the start date.
           v0.54: adding straight into TOMORROW schedules tomorrow 08:00. */
        var tok = parseStartToken(v);
        if (tok) UI.toast('Starts ' + tok.date + ' 08:00');
        var tomQ = selCat === 'tomorrow' ? tomorrowISO() : null;
        var sd = tok ? tok.date : tomQ;
        DB.put('todos', {
          id: DB.uid(), title: tok ? tok.title : v, cat: tomQ ? 'later' : selCat, now: (tok || tomQ) ? false : nowOn,
          prio: 'none', tags: [], subs: [], note: '',
          startDate: sd, startTime: sd ? '08:00' : null,
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
    /* v0.31 D2: pull-on-open — quietly pick up anything Claude queued
       while the app was closed. Silent + throttled (2 min) inside Sync. */
    if (window.Sync && Sync.claudeAutoRefresh) {
      Sync.claudeAutoRefresh().then(function (r) {
        if (r && ((r.applied || 0) + (r.imported || 0) > 0) &&
            location.hash === '#/discipline/todo') draw();
      });
    }
  }

  /* ---- Fitness Motivation (v0.44) ----
     Video clips living in the user's own Google Drive folder. The rating IS
     the filename prefix ("9.5 - Name.mp4"), so it survives outside the app.
     ↻ pulls the folder; edits (rename / re-rate / X) stage locally and the
     Apply bar writes them to the REAL Drive files (X → Drive trash). */
  var MV_RATES = ['10', '9.5', '9', '8.5', '8', '7.5', '7'];
  var _mvBlobs = {}; /* session cache: fileId → blob URL */
  var _mvDl = {};    /* v0.46: download-all progress — survives leaving the page
                        (v0.49: one job per collection, keyed by cfg.metaKey) */
  function mvParse(drvName) {
    var ext = (drvName.match(/\.[A-Za-z0-9]{2,5}$/) || [''])[0];
    var base = ext ? drvName.slice(0, -ext.length) : drvName;
    var m = base.match(/^(10|9\.5|9|8\.5|8|7\.5|7)\s*-\s*(.+)$/);
    return { rating: m ? m[1] : 'na', name: (m ? m[2] : base).trim(), ext: ext };
  }
  function mvDriveName(it) {
    return (MV_RATES.indexOf(it.rating) >= 0 ? it.rating + ' - ' : '') + it.name + it.ext;
  }
  function mvDirty(it) { return it.isNew === true || it.rating !== it.origRating || it.name !== it.origName; }
  function mvSave(items, key) {
    return DB.put('meta', { key: key || 'motivList', value: { items: items, syncedAt: Date.now() }, updatedAt: Date.now() });
  }

  /* v0.49: small grid thumbnail from a gallery-picked image's bytes */
  function thumbFromBuf(buf, mime) {
    return new Promise(function (resolve) {
      var url = null;
      try { url = URL.createObjectURL(new Blob([buf], { type: mime || 'image/jpeg' })); } catch (e) { return resolve(null); }
      var img = new Image();
      img.onload = function () {
        try {
          var scale = Math.min(1, 480 / Math.max(img.width || 1, img.height || 1));
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round((img.width || 1) * scale));
          cv.height = Math.max(1, Math.round((img.height || 1) * scale));
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.75));
        } catch (e) { resolve(null); }
        try { URL.revokeObjectURL(url); } catch (e2) { /* ok */ }
      };
      img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e2) { /* ok */ } resolve(null); };
      img.src = url;
    });
  }

  /* v0.56: default video cover — decode the LOCAL copy and grab an early
     frame (~10% in, max 1 s, so the cover is not a black lead-in). Never
     rejects: any decode problem resolves null and the ▶ placeholder stays. */
  function thumbFromVideoBuf(buf, mime) {
    return new Promise(function (resolve) {
      var url = null;
      try { url = URL.createObjectURL(new Blob([buf], { type: mime || 'video/mp4' })); } catch (e) { return resolve(null); }
      var v = document.createElement('video');
      var done = false;
      var to = setTimeout(function () { finish(null); }, 6000);
      function finish(d) {
        if (done) return;
        done = true;
        clearTimeout(to);
        try { URL.revokeObjectURL(url); } catch (e2) { /* ok */ }
        resolve(d);
      }
      function grab() {
        if (done) return;
        try {
          var w = v.videoWidth, h = v.videoHeight;
          if (!w || !h) { finish(null); return; }
          var scale = Math.min(1, 480 / w);
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(w * scale));
          cv.height = Math.max(1, Math.round(h * scale));
          cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
          finish(cv.toDataURL('image/jpeg', 0.75));
        } catch (e) { finish(null); }
      }
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.addEventListener('loadeddata', function () {
        try { v.currentTime = Math.min(1, (v.duration || 1) * 0.1); } catch (e) { /* frame 0 then */ }
        setTimeout(grab, 400); /* some WebViews never fire seeked */
      });
      v.addEventListener('seeked', grab);
      v.addEventListener('error', function () { finish(null); });
      try { v.src = url; } catch (e) { finish(null); }
    });
  }
  /* cover makers, module-level so the regression suite can stub them */
  var MK_THUMB = { img: thumbFromBuf, vid: thumbFromVideoBuf };

  /* v0.49: image-viewer zoom — mouse wheel, two-finger pinch, tap toggles
     1×/2×. Zoomed image pans with native overlay scrolling. */
  function ivZoom(ov, v, opts) {
    var z = 1, baseW = 0, pinch = null, lastPinchAt = 0;
    function apply(nz, cx, cy) {
      if (!baseW) baseW = v.clientWidth || v.naturalWidth || 1;
      nz = Math.max(1, Math.min(6, nz));
      if (nz === z) return;
      var ox = ov.scrollLeft, oy = ov.scrollTop;
      var fac = nz / z;
      z = nz;
      if (z === 1) {
        ov.classList.remove('zoomed');
        v.style.width = ''; v.style.height = '';
        v.style.maxWidth = ''; v.style.maxHeight = '';
      } else {
        ov.classList.add('zoomed');
        v.style.maxWidth = 'none'; v.style.maxHeight = 'none'; v.style.height = 'auto';
        v.style.width = Math.round(baseW * z) + 'px';
        var cx2 = cx == null ? ov.clientWidth / 2 : cx;
        var cy2 = cy == null ? ov.clientHeight / 2 : cy;
        ov.scrollLeft = (ox + cx2) * fac - cx2;
        ov.scrollTop = (oy + cy2) * fac - cy2;
      }
    }
    ov.addEventListener('wheel', function (e) {
      e.preventDefault();
      apply(z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
    }, { passive: false });
    function dist(t) {
      var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
      return Math.sqrt(dx * dx + dy * dy) || 1;
    }
    ov.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) pinch = { d: dist(e.touches), z: z };
    }, { passive: true });
    ov.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        lastPinchAt = Date.now();
        apply(pinch.z * dist(e.touches) / pinch.d,
          (e.touches[0].clientX + e.touches[1].clientX) / 2,
          (e.touches[0].clientY + e.touches[1].clientY) / 2);
      }
    }, { passive: false });
    ov.addEventListener('touchend', function () { pinch = null; });
    /* v0.59: videos zoom too, but tap-to-zoom would fight play/pause —
       they get pinch + wheel only (opts.noTap) */
    if (!(opts && opts.noTap)) {
      v.addEventListener('click', function () {
        if (Date.now() - lastPinchAt < 350) return; /* pinch settling, not a tap */
        apply(z > 1 ? 1 : 2);
      });
    }
  }
  function renderMotiv(el) {
    renderCollection(el, {
      title: 'Fitness Motivation', metaKey: 'motivList', noun: 'video',
      mime: 'video/', mirrorSub: 'motiv', folderId: function () { return Sync.motivFolderId(); }
    });
  }
  /* v0.47: Aesthetic Collection — same machinery, images instead of videos.
     v0.58: 3 cards per row (Alef's ask; Motivation stays 2). */
  function renderAesth(el) {
    renderCollection(el, {
      title: 'Aesthetic Collection', metaKey: 'aesthList', noun: 'image',
      mime: 'image/', cols: 3, mirrorSub: 'aesth', folderId: function () { return Sync.aesthFolderId(); }
    });
  }

  /* v0.58: hold-drag sort/re-rate — the pure move, so the suite can test
     it. targetId null = dropped on a group HEADLINE → the item goes to the
     end of its (possibly new) rating group. Returns true when applied. */
  function mvReorder(items, itId, targetId, after, newRating) {
    var it = items.filter(function (x) { return x.id === itId; })[0];
    if (!it) return false;
    items.splice(items.indexOf(it), 1);
    if (newRating != null && newRating !== it.rating) it.rating = newRating;
    var idx;
    if (targetId) {
      var tg = items.filter(function (x) { return x.id === targetId; })[0];
      idx = tg ? items.indexOf(tg) + (after ? 1 : 0) : items.length;
    } else {
      idx = -1;
      items.forEach(function (x, i2) { if (x.rating === it.rating) idx = i2; });
      idx += 1;
      if (idx === 0) idx = items.length; /* group empty → end of list */
    }
    items.splice(idx, 0, it);
    return true;
  }
  function renderCollection(el, cfg) {
    var items = [];
    var stored = {}; /* fileId → 1 when the file is saved on this phone */
    /* v0.59: the S26 is PRIMARY for the collections; the PC is a read-only
       viewer — no ingest, no edits, no jobs, no list writes from there. */
    var isPC = (DB.getSettings() || {}).deviceId === 'PC';
    function save() { return isPC ? Promise.resolve() : mvSave(items, cfg.metaKey); }
    /* ==== v0.61 (#84): the byte STORE behind the collection ====
       On the S26 APK the bytes are REAL files in
       Documents/S26-Alef-Fit/AFmedia/<sub>/<fileId><ext> — public storage
       that SURVIVES an app uninstall/reinstall, so a new install rescans
       the folder and needs no re-download. Web/PC keeps IndexedDB.
       During the migration window bytes may still sit in IndexedDB —
       reads check there first; page open moves rows out (verify-then-
       delete). All access goes through these store* helpers. */
    var useFiles = !isPC && !!(window.Native && Native.canMediaFiles && Native.canMediaFiles());
    var sub = cfg.mirrorSub;
    function fExt(it) { return it.ext || (cfg.mime === 'image/' ? '.jpg' : '.mp4'); }
    function fName(it) { return it.id + fExt(it); }
    function storeKeys() { /* → map id → truthy ({idb:true} and/or {size}) */
      return DB.allKeys('motivVideos').then(function (ks) {
        var map = {};
        ks.forEach(function (k) { map[k] = { idb: true }; });
        if (!useFiles) return map;
        return Native.mediaList(sub).then(function (list) {
          (list || []).forEach(function (f) {
            var id = f.name.replace(/\.[A-Za-z0-9]{1,5}$/, '');
            if (!map[id]) map[id] = {};
            map[id].size = f.size;
          });
          return map;
        });
      });
    }
    function storePut(it, buf, type) {
      var row = { id: it.id, buf: buf, type: type, name: it.name, size: buf.byteLength, savedAt: Date.now() };
      if (!useFiles) return DB.put('motivVideos', row);
      return Native.mediaPut(sub, fName(it), buf).then(function (okF) {
        if (!okF) return DB.put('motivVideos', row); /* file write failed → bytes stay safe in IndexedDB */
        return DB.del('motivVideos', it.id).catch(function () { /* no old row */ });
      });
    }
    function storeGet(it) { /* → {buf, type} | null */
      return DB.get('motivVideos', it.id).then(function (row) {
        if (row && row.buf) return { buf: row.buf, type: row.type || it.mime };
        if (!useFiles) return null;
        return Native.mediaRead(sub, fName(it)).then(function (ab) {
          return ab ? { buf: ab, type: it.mime } : null;
        });
      });
    }
    function storeUrl(it) { /* playable URL | null */
      return DB.get('motivVideos', it.id).then(function (row) {
        if (row && row.buf) {
          try { return URL.createObjectURL(new Blob([row.buf], { type: row.type || it.mime || '' })); }
          catch (e) { return null; } /* jsdom */
        }
        if (!useFiles) return null;
        return Native.mediaUrl(sub, fName(it));
      });
    }
    function storeDel(it) {
      var pF = useFiles ? Native.mediaDel(sub, fName(it)) : Promise.resolve();
      return pF.then(function () { return DB.del('motivVideos', it.id); })
        .catch(function () { /* nothing stored */ });
    }
    function storeRename(it, newId) { /* staged upload got its Drive id */
      var oldName = fName(it);
      return DB.get('motivVideos', it.id).then(function (row) {
        var pr = Promise.resolve();
        if (row && row.buf) {
          pr = DB.put('motivVideos', {
            id: newId, buf: row.buf, type: row.type,
            name: it.name, size: row.size, savedAt: row.savedAt || Date.now()
          }).then(function () { return DB.del('motivVideos', it.id); });
        }
        return pr.then(function () {
          if (!useFiles) return null;
          return Native.mediaRename(sub, oldName, newId + fExt(it));
        });
      });
    }
    /* one-time move of IndexedDB bytes → files. Resumable: a row is only
       deleted AFTER its file verified at the exact byte count; anything
       that fails just stays in IndexedDB and retries next page open. */
    var _migRun = false;
    function migrateToFiles() {
      if (!useFiles || _migRun) return;
      _migRun = true;
      DB.allKeys('motivVideos').then(function (ks) {
        var mine = {};
        items.forEach(function (it) { mine[it.id] = it; });
        var todo = ks.filter(function (k) { return mine[k]; });
        if (!todo.length) return;
        var moved = 0;
        var chain = Promise.resolve();
        todo.forEach(function (k) {
          chain = chain.then(function () {
            return DB.get('motivVideos', k).then(function (row) {
              if (!row || !row.buf) return null;
              return Native.mediaPut(sub, fName(mine[k]), row.buf).then(function (okF) {
                if (!okF) return null;
                moved++;
                return DB.del('motivVideos', k);
              });
            }).catch(function () { /* next one */ });
          });
        });
        chain.then(function () {
          if (!moved) return;
          UI.toast(moved + ' ' + cfg.noun + (moved === 1 ? '' : 's') + ' moved to phone storage — they now survive app updates and reinstalls');
          if (wrap.isConnected) draw();
        });
      });
    }
    var hdr = UI.header(isPC
      ? { title: cfg.title, back: '#/discipline' }
      : {
        title: cfg.title, back: '#/discipline',
        action: { icon: 'sync', label: 'Sync ' + cfg.noun + 's', onClick: doSync }
      });
    el.appendChild(hdr);
    /* v0.46: ⬇ download-all (icon only) sits LEFT of the ↻ refresh.
       v0.49: while a job runs it turns into an animated arrow + % text,
       and the job keeps running when you leave the page. */
    var dlBtn = UI.el('<button class="btn-icon dl-btn" aria-label="Download all ' + cfg.noun + 's to this phone">' + UI.icon('download') + '</button>');
    dlBtn.addEventListener('click', function () { doDownload(); });
    var actSpan = hdr.querySelector('.topbar-action');
    if (!isPC && actSpan) actSpan.insertBefore(dlBtn, actSpan.firstChild);
    function paintDl() {
      if (!dlBtn.isConnected) return;
      var job = _mvDl[cfg.metaKey];
      if (job && job.active) {
        dlBtn.classList.add('dl-run');
        dlBtn.innerHTML = UI.icon('download') +
          '<span class="dl-pct">' + Math.round((job.done / Math.max(1, job.total)) * 100) + '%</span>';
      } else {
        dlBtn.classList.remove('dl-run');
        dlBtn.innerHTML = UI.icon('download');
      }
    }
    if (_mvDl[cfg.metaKey]) _mvDl[cfg.metaKey].onTick = paintDl;
    paintDl();
    /* v0.49: ＋ add from the phone gallery — stages NEW items (●) that the
       ☁ Apply bar uploads into the collection's Drive folder */
    var addBtn = UI.el('<button class="btn-icon" aria-label="Add ' + cfg.noun + 's from the phone gallery">' + UI.icon('plus') + '</button>');
    var addFile = UI.el('<input type="file" accept="' + (cfg.mime === 'image/' ? 'image/*' : 'video/*') + '" multiple class="hidden">');
    addBtn.addEventListener('click', function () { addFile.click(); });
    addFile.addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      var chain = Promise.resolve();
      files.forEach(function (f) { chain = chain.then(function () { return stageLocal(f); }); });
      chain.then(function () { return save(); }).then(function () {
        draw();
        UI.toast(files.length + ' ' + cfg.noun + (files.length === 1 ? '' : 's') + ' added — ☁ Apply uploads them to Drive');
      }).catch(function () { UI.toast('Could not read some files'); });
    });
    if (!isPC && actSpan) actSpan.insertBefore(addBtn, actSpan.firstChild);
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    pad.appendChild(addFile);
    if (isPC) pad.appendChild(UI.el('<div class="sub" style="margin-bottom:6px">View only on the PC — this collection is managed on the S26.</div>'));
    /* v0.59: how much of the collection lives on this phone */
    var sizeLine = UI.el('<div class="sub mv-size" style="margin-bottom:2px"></div>');
    pad.appendChild(sizeLine);
    /* v0.60: per-file Drive mirror — the retention copy of the phone's
       primary files (S26 only; red past mirrorIntervalDays) */
    var mirRow = null;
    if (!isPC) {
      mirRow = UI.el('<div class="sub mv-mirror" style="margin-bottom:8px"><span class="mv-mir-stat"></span>' +
        '<button type="button" class="chip mv-mir-btn">Mirror now</button></div>');
      mirRow.querySelector('.mv-mir-btn').addEventListener('click', function () { runMirror(); });
      pad.appendChild(mirRow);
    }
    function paintMirror() {
      if (!mirRow || !mirRow.isConnected) return;
      var statEl = mirRow.querySelector('.mv-mir-stat');
      var eligible = items.filter(function (x) { return x.state === 'stored' && stored[x.id] && x.rating !== 'X'; });
      var done = eligible.filter(function (x) { return x.mirrorId; }).length;
      DB.get('meta', cfg.metaKey + 'MirrorAt').then(function (r) {
        var at = r && r.value;
        var iv = (DB.getSettings() || {}).mirrorIntervalDays || 30;
        var behind = done < eligible.length;
        var overdue = behind && (!at || (Date.now() - at) > iv * 86400000);
        statEl.textContent = 'Drive mirror: ' + done + '/' + eligible.length +
          (at ? ' · last ' + new Date(at).toLocaleDateString('en-GB') : ' · never');
        statEl.classList.toggle('bk-warn', overdue);
      });
    }
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);

    function stageLocal(f) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = reject;
        fr.readAsArrayBuffer(f);
      }).then(function (buf) {
        var id = 'new-' + DB.uid();
        var extM = (f.name || '').match(/\.[A-Za-z0-9]{2,5}$/);
        var p = mvParse(f.name || ('New ' + cfg.noun));
        var it = {
          id: id, drvName: f.name || '',
          ext: extM ? extM[0] : (cfg.mime === 'image/' ? '.jpg' : '.mp4'),
          mime: f.type || (cfg.mime === 'image/' ? 'image/jpeg' : 'video/mp4'),
          thumbLink: null, thumb: null,
          origName: p.name, origRating: p.rating,
          name: p.name, rating: p.rating, isNew: true,
          state: 'stored', bytes: buf.byteLength /* v0.59: lives on the phone */
        };
        return storePut(it, buf, it.mime)
          .then(function () {
            if (cfg.mime !== 'image/') return null;
            return thumbFromBuf(buf, it.mime).then(function (d) { it.thumb = d; });
          })
          .then(function () { items.push(it); });
      });
    }

    /* v0.46: download into IndexedDB one file at a time; every finished
       file is committed immediately, so an interrupted run RESUMES.
       v0.59: the shared engine also powers the silent AUTO-INGEST (the
       Drive folder is an INBOX now) — after a file's bytes are committed
       and verified it is MOVED to the folder's "Downloaded" subfolder,
       so the inbox empties itself and Alef deletes from Downloaded at
       leisure. Files already stored but never moved (pre-v0.59) get their
       move retried here too. */
    function blobBuf(b) { /* arrayBuffer() is missing in older WebViews */
      if (b.arrayBuffer) return b.arrayBuffer();
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = reject;
        fr.readAsArrayBuffer(b);
      });
    }
    function moveToDownloaded(it) {
      if (!window.Sync || !Sync.motivMove) return Promise.resolve();
      return Sync.motivMove(it.id, cfg.folderId()).then(function () {
        it.moved = true;
      }).catch(function (eM) {
        /* 404 = the inbox file is already gone — nothing left to move */
        if (/404/.test(String((eM && eM.message) || eM))) it.moved = true;
      });
    }
    function runIngest(todo, silent) {
      var job = { active: true, done: 0, total: todo.length, onTick: paintDl };
      _mvDl[cfg.metaKey] = job;
      paintDl();
      var fails = 0;
      var chain = Promise.resolve();
      todo.forEach(function (it) {
        chain = chain.then(function () {
          return Sync.motivBlob(it.id).catch(function (eB) {
            /* v0.60: the original is gone (new phone / emptied Drive) —
               fall back to the MIRROR copy */
            if (it.mirrorId) return Sync.motivBlob(it.mirrorId);
            throw eB;
          }).then(function (b) {
            return blobBuf(b).then(function (buf) {
              return storePut(it, buf, b.type || (cfg.mime === 'image/' ? 'image/jpeg' : 'video/mp4'))
                .then(function () {
                  it.state = 'stored';       /* bytes committed FIRST… */
                  it.bytes = buf.byteLength;
                  return moveToDownloaded(it); /* …then the inbox move (retry-safe) */
                });
            });
          }).then(function () {
            job.done++;
            stored[it.id] = 1;
          }).catch(function () { fails++; }).then(function () {
            if (job.onTick) { try { job.onTick(); } catch (e) { /* page gone */ } }
          });
        });
      });
      return chain.then(function () {
        /* pre-v0.59 stored files still sitting in the inbox → move them too */
        var toMove = items.filter(function (x) { return x.state === 'stored' && !x.isNew && !x.moved; });
        var mChain = Promise.resolve();
        toMove.forEach(function (x) { mChain = mChain.then(function () { return moveToDownloaded(x); }); });
        return mChain;
      }).then(function () {
        job.active = false;
        if (job.onTick) { try { job.onTick(); } catch (e) { /* page gone */ } }
        return save();
      }).then(function () {
        if (!silent || job.done || fails) {
          UI.toast(fails
            ? 'Stored ' + job.done + '/' + job.total + ' — the rest retries next time'
            : (job.total ? job.total + ' ' + cfg.noun + (job.total === 1 ? '' : 's') + ' stored on this phone ✓' : 'Inbox tidied ✓'));
        }
        if (wrap.isConnected) draw();
      });
    }
    /* silent auto-ingest: new inbox files download by themselves (S26
       only, and only with silent auth — an auto job never pops sign-in) */
    function autoIngest() {
      if (isPC) return;
      var run = _mvDl[cfg.metaKey];
      if (run && run.active) return;
      DB.get('meta', 'gdriveRefreshToken').then(function (tok) {
        if (!(tok && tok.value)) return;
        return storeKeys().then(function (have) {
          var todo = items.filter(function (it) { return it.state === 'inbox' && it.rating !== 'X' && !it.isNew && !have[it.id]; });
          var pendingMoves = items.some(function (x) { return x.state === 'stored' && !x.isNew && !x.moved; });
          if (!todo.length && !pendingMoves) return;
          runIngest(todo, true);
        });
      });
    }
    /* v0.60: verified per-file mirror run — uploads every stored,
       not-yet-mirrored file into Collections-Mirror/<sub>; an item is
       `mirrored` ONLY when Drive confirms the exact byte count. */
    var _mrBusy = false;
    function runMirror() {
      if (_mrBusy || isPC) return;
      var statEl = mirRow && mirRow.querySelector('.mv-mir-stat');
      var todo = items.filter(function (x) { return x.state === 'stored' && stored[x.id] && x.rating !== 'X' && !x.mirrorId; });
      if (!todo.length) {
        DB.put('meta', { key: cfg.metaKey + 'MirrorAt', value: Date.now() }).then(function () {
          UI.toast('Mirror is complete ✓');
          paintMirror();
        });
        return;
      }
      _mrBusy = true;
      var upped = 0, fails = 0;
      Sync.mirrorColFolder(cfg.mirrorSub).then(function (fid) {
        var chain = Promise.resolve();
        todo.forEach(function (it, i2) {
          chain = chain.then(function () {
            if (statEl) statEl.textContent = 'Mirroring ' + (i2 + 1) + '/' + todo.length + '…';
            return storeGet(it).then(function (o) {
              if (!o || !o.buf) return null;
              return Sync.motivUpload(mvDriveName(it), it.mime || o.type, o.buf, fid).then(function (res) {
                var want = o.buf.byteLength || 0;
                if (res && res.id && parseInt(res.size, 10) === want) {
                  it.mirrorId = res.id; /* verified — byte count confirmed by Drive */
                  upped++;
                } else {
                  fails++; /* size mismatch / no id — stays unmirrored, retried next run */
                }
              });
            }).catch(function () { fails++; });
          });
        });
        return chain.then(function () {
          return DB.put('meta', { key: cfg.metaKey + 'MirrorAt', value: Date.now() });
        }).then(save).then(function () {
          _mrBusy = false;
          UI.toast(fails
            ? 'Mirrored ' + upped + ' — ' + fails + ' failed, tap Mirror now again to retry'
            : 'Mirror complete ✓ — ' + upped + ' file' + (upped === 1 ? '' : 's') + ' uploaded');
          if (wrap.isConnected) draw();
        });
      }).catch(function (e) {
        _mrBusy = false;
        UI.toast(hintFor(e));
        paintMirror();
      });
    }
    /* ⬇ button: manual full download (also re-fetches lost local copies) */
    function doDownload() {
      var run = _mvDl[cfg.metaKey];
      if (run && run.active) {
        UI.toast('Downloading in the background… ' + run.done + '/' + run.total);
        return;
      }
      storeKeys().then(function (have) {
        var todo = items.filter(function (it) { return it.rating !== 'X' && !it.isNew && !have[it.id] && it.state !== 'missed'; });
        if (!todo.length) { UI.toast('All ' + cfg.noun + 's are already on this phone ✓'); return; }
        UI.confirm('Download ' + todo.length + ' ' + cfg.noun + (todo.length === 1 ? '' : 's') +
          ' from Google Drive to this phone? The job runs in the background (the ⬇ button shows %); every finished file is kept and MOVED to the Downloaded folder in Drive; tapping ⬇ again RESUMES with the rest.',
          'Download').then(function (ok) {
          if (!ok) return;
          runIngest(todo, false);
        });
      });
    }

    function hintFor(e) {
      var s = String(e && e.message || e);
      if (/403|insufficient|scope|PERMISSION/i.test(s)) return 'Google needs a new permission — Setting → Share with Claude → Connect (one popup), then ↻ again';
      if (/404/.test(s)) return 'Folder not found — check the Fitness Motivation folder in your Drive';
      return s.slice(0, 120);
    }
    function doSync() {
      var btn = hdr.querySelector('.topbar-action button');
      if (btn) btn.classList.add('spin');
      Sync.motivList(cfg.folderId(), cfg.mime).then(function (files) {
        /* v0.58 C9: MERGE, never rebuild — a ↻ used to silently drop
           gallery-staged (＋) items that were not yet ☁ Applied, forget
           every card's fit setting, and reset the manual order. Existing
           items keep their object (fit/thumb/order intact), staged edits
           still win, new Drive files append at the end. (A file DELETED
           in Drive still leaves the list here — the v0.59 inbox flow
           changes that; don't empty the Drive folders yet.) */
        var byId = {};
        files.forEach(function (f) { byId[f.id] = f; });
        var next = [];
        items.forEach(function (it) {
          if (it.isNew) { it.state = 'stored'; next.push(it); return; }   /* staged upload — not in Drive yet */
          var f = byId[it.id];
          if (!f) {
            /* v0.59: not in the inbox anymore. STORED items live on —
               that is the whole point of local-primary (the file was
               moved to Downloaded or deleted by Alef). An item that was
               never ingested is marked MISSED (red row — re-add it). */
            if (it.state === 'stored' || stored[it.id]) {
              it.state = 'stored';
              it.moved = true; /* gone from the inbox = nothing to move */
              next.push(it);
              return;
            }
            it.state = 'missed';
            next.push(it);
            return;
          }
          delete byId[it.id];
          var p = mvParse(f.name);
          if (!mvDirty(it)) { it.name = p.name; it.rating = p.rating; } /* no staged edit → follow Drive */
          it.drvName = f.name;
          it.ext = p.ext;
          it.mime = f.mimeType;
          it.thumbLink = f.thumbnailLink || it.thumbLink;
          it.origName = p.name;
          it.origRating = p.rating;
          if (it.state !== 'stored') it.state = stored[it.id] ? 'stored' : 'inbox';
          next.push(it);
        });
        /* v0.59 dedupe: a re-uploaded file with a name the collection
           already has (stored) is ignored — never two copies of the bytes */
        var haveNames = {};
        next.forEach(function (x) { if (x.drvName) haveNames[x.drvName] = 1; });
        var dups = 0;
        files.forEach(function (f) {
          if (!byId[f.id]) return;
          if (haveNames[f.name]) { dups++; return; }
          var p = mvParse(f.name);
          next.push({
            id: f.id, drvName: f.name, ext: p.ext, mime: f.mimeType,
            thumbLink: f.thumbnailLink || null, thumb: null,
            origName: p.name, origRating: p.rating,
            name: p.name, rating: p.rating,
            state: 'inbox', bytes: parseInt(f.size, 10) || 0
          });
        });
        items = next;
        if (dups) UI.toast(dups + ' duplicate inbox file' + (dups === 1 ? '' : 's') + ' ignored — already in the collection');
        return save().then(function () {
          draw();
          /* thumbnails after the list is on screen.
             v0.62 (#90 locality): items whose BYTES live on this phone
             skip the Drive thumbnail — fillLocalThumbs makes a better
             cover from the local file, with no network call. */
          return Promise.all(items.map(function (it) {
            if (it.thumb || !it.thumbLink) return null;
            if (it.state === 'stored' || stored[it.id]) return null;
            return Sync.motivThumb(it.thumbLink).then(function (d) { it.thumb = d; });
          }));
        });
      }).then(function () {
        return save();
      }).then(function () {
        if (btn) btn.classList.remove('spin');
        UI.toast((cfg.noun === 'video' ? 'Videos: ' : 'Images: ') + items.length);
        draw();
        autoIngest(); /* v0.59: new inbox files start downloading right away */
      }).catch(function (e) {
        if (btn) btn.classList.remove('spin');
        UI.toast(hintFor(e));
      });
    }
    function play(it) {
      function show(url) {
        var ov = UI.el('<div class="imgview" role="dialog" aria-label="Media"></div>');
        var v;
        if (cfg.mime === 'image/') {
          /* v0.49: full zoom — mouse wheel / pinch gesture / tap 1×↔2× */
          v = UI.el('<img src="' + url + '" alt="">');
          ivZoom(ov, v);
        } else {
          v = document.createElement('video');
          v.src = url; v.controls = true; v.autoplay = true; v.playsInline = true;
          ivZoom(ov, v, { noTap: true }); /* v0.59: pinch/wheel zoom on videos */
        }
        ov.appendChild(v);
        var x = UI.el('<button class="iv-x" aria-label="Close">✕</button>');
        x.addEventListener('click', function () { try { v.pause && v.pause(); } catch (e) { /* ok */ } ov.remove(); });
        ov.addEventListener('click', function (e) { if (e.target === ov) { try { v.pause && v.pause(); } catch (e2) { /* ok */ } ov.remove(); } });
        ov.appendChild(x);
        if (cfg.mime !== 'image/') {
          /* v0.45: grab the CURRENT frame as this video's cover thumbnail.
             Pause/seek to the moment you like, then tap the camera. The
             custom cover is kept across ↻ syncs (sync only fetches a Drive
             thumbnail when none exists yet). */
          var cam = UI.el('<button class="iv-cam" aria-label="Use this frame as the cover" title="Use this frame as the cover">' + UI.icon('camera') + '</button>');
          cam.addEventListener('click', function () {
            try {
              var w = v.videoWidth || 640, h = v.videoHeight || 360;
              var scale = Math.min(1, 480 / w);
              var cv = document.createElement('canvas');
              cv.width = Math.max(1, Math.round(w * scale));
              cv.height = Math.max(1, Math.round(h * scale));
              cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
              it.thumb = cv.toDataURL('image/jpeg', 0.75);
              save().then(function () {
                UI.toast('Cover updated ✓');
                draw();
              });
            } catch (e) {
              UI.toast('Could not capture this frame');
            }
          });
          ov.appendChild(cam);
        }
        document.body.appendChild(ov);
      }
      if (_mvBlobs[it.id]) return show(_mvBlobs[it.id]);
      /* v0.46: stored copy on the phone plays first — instant + offline.
         v0.61: on the APK the REAL file streams straight from disk (no
         RAM copy) via its local URL. */
      storeUrl(it).then(function (lurl) {
        if (lurl && (stored[it.id] || lurl.slice(0, 5) === 'blob:')) {
          _mvBlobs[it.id] = lurl;
          show(lurl);
          return;
        }
        UI.toast('Loading ' + cfg.noun + '…');
        Sync.motivBlob(it.id).then(function (b) {
          var url = null;
          try { url = URL.createObjectURL(b); } catch (e) { /* jsdom */ }
          if (!url) { UI.toast('Could not open this ' + cfg.noun); return; }
          _mvBlobs[it.id] = url;
          show(url);
        }).catch(function (e) { UI.toast(hintFor(e)); });
      });
    }
    function editSheet(it) {
      var body = UI.el('<div>' +
        UI.field('Name', '<input type="text" id="mv-name" value="' + UI.esc(it.name) + '">') +
        '<div class="field"><span class="field-label">Rating (X = delete on Apply)</span><div class="mv-rates"></div></div>' +
        '<div class="field"><span class="field-label">Thumbnail fill</span><div class="mv-fits"></div></div></div>');
      var row = body.querySelector('.mv-rates');
      var cur = it.rating;
      MV_RATES.concat(['na', 'X']).forEach(function (r) {
        var lb = r === 'na' ? 'N/A' : r;
        var ch = UI.el('<button type="button" class="chip mv-rate' + (r === 'X' ? ' mv-x' : '') + (cur === r ? ' on' : '') + '" data-r="' + r + '">' + lb + '</button>');
        ch.addEventListener('click', function () {
          cur = r;
          row.querySelectorAll('.mv-rate').forEach(function (x) { x.classList.toggle('on', x.dataset.r === r); });
        });
        row.appendChild(ch);
      });
      /* v0.46: thumbnail fill — fit HEIGHT (default) or fit WIDTH */
      var frow = body.querySelector('.mv-fits');
      var curFit = it.fit === 'w' ? 'w' : 'h';
      [['h', 'Fit height'], ['w', 'Fit width']].forEach(function (f) {
        var fc = UI.el('<button type="button" class="chip mv-fit' + (curFit === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>');
        fc.addEventListener('click', function () {
          curFit = f[0];
          frow.querySelectorAll('.mv-fit').forEach(function (x) { x.classList.toggle('on', x.dataset.f === curFit); });
        });
        frow.appendChild(fc);
      });
      UI.modal('Edit ' + cfg.noun, body, [
        { label: 'Cancel' },
        {
          label: 'Save', primary: true, onClick: function (close) {
            var v = body.querySelector('#mv-name').value.trim();
            if (v) it.name = v;
            it.rating = cur;
            it.fit = curFit;
            save().then(function () { close(); draw(); });
          }
        }
      ]);
    }
    function applyAll() {
      var changed = items.filter(mvDirty);
      /* v0.49: gallery-added items upload to the Drive folder on Apply;
         a new item already re-rated X is simply discarded (never uploaded) */
      var toUpload = changed.filter(function (it) { return it.isNew && it.rating !== 'X'; });
      var toDrop = changed.filter(function (it) { return it.isNew && it.rating === 'X'; });
      var toTrash = changed.filter(function (it) { return !it.isNew && it.rating === 'X'; });
      var toRename = changed.filter(function (it) { return !it.isNew && it.rating !== 'X'; });
      UI.confirm('Apply to Google Drive: ' +
        (toUpload.length ? 'upload ' + toUpload.length + ' new, ' : '') +
        'rename ' + toRename.length + ' file' + (toRename.length === 1 ? '' : 's') +
        ', move ' + toTrash.length + ' to Drive trash' +
        (toDrop.length ? ', discard ' + toDrop.length + ' never-uploaded' : '') + '?', 'Apply').then(function (ok) {
        if (!ok) return;
        var chain = Promise.resolve();
        var fails = 0;
        toUpload.forEach(function (it) {
          chain = chain.then(function () {
            return storeGet(it).then(function (o) {
              if (!o || !o.buf) throw new Error('local copy missing');
              return Sync.motivUpload(mvDriveName(it), it.mime || o.type, o.buf, cfg.folderId())
                .then(function (res) {
                  /* v0.61: the stored bytes follow the id (file rename /
                     IndexedDB re-key) — BEFORE it.id changes */
                  return storeRename(it, res.id).then(function () {
                    it.id = res.id;
                    it.isNew = false;
                    it.origName = it.name;
                    it.origRating = it.rating;
                    it.drvName = mvDriveName(it);
                    it.state = 'stored'; /* v0.59: bytes are local; the next ingest pass moves the upload to Downloaded */
                    it.moved = false;
                    if (res.thumbnailLink) it.thumbLink = res.thumbnailLink;
                  });
                });
            }).catch(function () { fails++; });
          });
        });
        toDrop.forEach(function (it) {
          chain = chain.then(function () {
            items = items.filter(function (x) { return x.id !== it.id; });
            return storeDel(it);
          });
        });
        toRename.forEach(function (it) {
          chain = chain.then(function () {
            /* v0.59: the Drive original may be GONE (deleted from
               Downloaded) — local-primary means the rename/rating then
               lives in the app alone; a 404 is not a failure */
            return Sync.motivPatch(it.id, { name: mvDriveName(it) }).catch(function (eR) {
              if (!/404/.test(String((eR && eR.message) || eR))) throw eR;
            }).then(function () {
              it.origName = it.name;
              it.origRating = it.rating;
              it.drvName = mvDriveName(it);
            }).catch(function () { fails++; });
          });
        });
        toTrash.forEach(function (it) {
          chain = chain.then(function () {
            /* v0.59: X removes the phone copy; the Drive file (inbox OR
               Downloaded) is trashed when it still exists (404 is fine) */
            return Sync.motivPatch(it.id, { trashed: true }).catch(function (eT) {
              if (!/404/.test(String((eT && eT.message) || eT))) throw eT;
            }).then(function () {
              /* v0.60: the MIRROR copy goes to Drive trash too */
              return it.mirrorId
                ? Sync.motivPatch(it.mirrorId, { trashed: true }).catch(function () { /* 404 ok */ })
                : null;
            }).then(function () {
              items = items.filter(function (x) { return x.id !== it.id; });
              return storeDel(it); /* v0.46: free its phone copy too (v0.61: the real file) */
            }).catch(function () { fails++; });
          });
        });
        chain.then(function () {
          return save();
        }).then(function () {
          UI.toast(fails ? fails + ' change(s) failed — ↻ and retry' : 'Drive updated ✓');
          draw();
        });
      });
    }
    function draw() {
      /* refresh the stored-on-phone ✓ badges (ids only — cheap) */
      storeKeys().then(function (map) {
        stored = map;
        /* v0.59: the on-phone line */
        if (sizeLine.isConnected) {
          var onPhone = items.filter(function (x) { return stored[x.id]; }).length;
          var mb = items.reduce(function (a, x) { return a + (stored[x.id] && x.bytes ? x.bytes : 0); }, 0) / 1048576;
          sizeLine.textContent = items.length
            ? onPhone + ' of ' + items.length + ' on this phone' + (mb >= 0.1 ? ' · ' + mb.toFixed(1) + ' MB' : '')
            : '';
        }
        drawBody();
        fillLocalThumbs();
        paintMirror(); /* v0.60 */
      }).catch(drawBody);
    }
    /* v0.56: default covers from the LOCAL copies — a stored video with no
       cover gets an early-frame thumbnail, a stored image shows itself.
       Runs quietly after each draw; made covers persist via mvSave, and
       the 📷 camera capture (v0.45) still replaces a video cover any time. */
    var _thumbJob = false, _thumbTried = {};
    function fillLocalThumbs() {
      if (isPC) return; /* v0.59: covers regenerate on the S26 only */
      if (_thumbJob) return;
      var todo = items.filter(function (it) {
        return !it.thumb && stored[it.id] && it.rating !== 'X' && !_thumbTried[it.id];
      });
      if (!todo.length) return;
      _thumbJob = true;
      var made = 0;
      var chain = Promise.resolve();
      todo.forEach(function (it) {
        chain = chain.then(function () {
          if (it.thumb) return null;
          _thumbTried[it.id] = 1;
          return storeGet(it).then(function (o) {
            if (!o || !o.buf) return null;
            var mk = cfg.mime === 'image/' ? MK_THUMB.img(o.buf, o.type) : MK_THUMB.vid(o.buf, o.type);
            return mk.then(function (d) {
              if (d) { it.thumb = d; made++; }
            });
          }).catch(function () { /* keep the ▶ placeholder */ });
        });
      });
      chain.then(function () {
        _thumbJob = false;
        if (!made) return;
        return save().then(function () { if (wrap.isConnected) draw(); });
      });
    }
    function drawBody() {
      wrap.innerHTML = '';
      var pending = items.filter(mvDirty).length;
      if (pending) {
        var bar = UI.el('<button class="td-propbar">☁ Apply ' + pending + ' change' + (pending === 1 ? '' : 's') + ' to Drive ›</button>');
        bar.addEventListener('click', applyAll);
        wrap.appendChild(bar);
      }
      if (!items.length) {
        wrap.appendChild(UI.emptyState('No ' + cfg.noun + 's yet', 'Put ' + cfg.noun + 's in the "' + cfg.title + '" folder of your Google Drive and tap ↻ above — or tap ＋ to add from this phone.'));
        return;
      }
      MV_RATES.concat(['na', 'X']).forEach(function (r) {
        var inR = items.filter(function (it) { return it.rating === r; });
        if (!inR.length) return;
        var lb = r === 'na' ? 'N/A — no rating' : (r === 'X' ? 'X — marked for delete' : r);
        wrap.appendChild(UI.el('<div class="section-title mv-cat' + (r === 'X' ? ' mv-cat-x' : '') + '" data-r="' + r + '">' + lb + ' <span class="tdc-n">(' + inR.length + ')</span></div>'));
        var grid = UI.el('<div class="mv-grid' + (cfg.cols === 3 ? ' mv-3' : '') + '"></div>');
        inR.forEach(function (it) {
          var missed = it.state === 'missed';
          var card = UI.el('<div class="mv-card' + (it.rating === 'X' ? ' mv-dim' : '') + (missed ? ' mv-missed' : '') + '" data-id="' + it.id + '">' +
            '<button class="mv-thumb fit-' + (it.fit === 'w' ? 'w' : 'h') + '" aria-label="play">' +
            (it.thumb ? '<img src="' + it.thumb + '" alt="">' : '<span class="mv-ph">' + (missed ? '⚠' : '▶') + '</span>') +
            (stored[it.id] ? '<span class="mv-loc" title="Stored on this phone">✓</span>'
              : (it.state === 'inbox' ? '<span class="mv-loc mv-inbox" title="Waiting in the Drive inbox">⏳</span>' : '')) +
            '</button>' +
            '<div class="mv-row"><span class="mv-name">' + (missed ? '⚠ ' : '') + UI.esc(it.name) + (mvDirty(it) ? ' <span class="mv-dot">●</span>' : '') + '</span>' +
            (isPC ? '' : '<button class="btn-icon sm mv-edit" aria-label="edit">' + UI.icon('edit') + '</button>') + '</div></div>');
          if (missed) card.title = 'Deleted in Drive before it was downloaded — add the file to the inbox again (X removes this row)';
          card.querySelector('.mv-thumb').addEventListener('click', function () {
            if (card.dataset.held) { delete card.dataset.held; return; } /* drag, not a tap */
            if (missed) { UI.toast('This file was deleted in Drive before download — add it again, or rate it X to remove the row'); return; }
            play(it);
          });
          var edB = card.querySelector('.mv-edit');
          if (edB) edB.addEventListener('click', function () { editSheet(it); });
          if (!isPC) enableCardDrag(card, it);
          grid.appendChild(card);
        });
        wrap.appendChild(grid);
      });
    }
    /* v0.58 (Alef's ask): press-hold a card, then DRAG — onto another card
       = re-sort (left half → before, right half → after; another group's
       card also re-rates); onto a rating HEADLINE = staged re-rate to that
       group (X headline = staged delete). ☁ Apply pushes rating changes
       to Drive exactly like the ✎ edit; the order lives in the app list. */
    function enableCardDrag(card, it) {
      var holdTimer = null, sx = 0, sy = 0, dragging = false, ghost = null;
      function clearHints() {
        document.querySelectorAll('.ins-before, .ins-after, .drop-hint').forEach(function (h) {
          h.classList.remove('ins-before'); h.classList.remove('ins-after'); h.classList.remove('drop-hint');
        });
      }
      function targetAt(x, y) {
        if (!document.elementFromPoint) return null;
        var n = document.elementFromPoint(x, y);
        if (!n || !n.closest) return null;
        var c2 = n.closest('.mv-card');
        if (c2 && c2 !== card) return { card: c2 };
        var h = n.closest('.mv-cat');
        if (h) return { head: h };
        return null;
      }
      card.addEventListener('touchmove', function (e) { if (dragging) e.preventDefault(); }, { passive: false });
      card.addEventListener('contextmenu', function (e) { if (dragging || holdTimer) e.preventDefault(); });
      card.addEventListener('pointerdown', function (e) {
        if (e.target.closest && e.target.closest('.mv-edit')) return;
        sx = e.clientX; sy = e.clientY; dragging = false;
        holdTimer = setTimeout(function () {
          holdTimer = null;
          dragging = true;
          card.dataset.held = '1';
          ghost = card.cloneNode(true);
          ghost.className = 'drag-ghost';
          ghost.style.width = Math.min(140, card.offsetWidth || 140) + 'px';
          ghost.style.left = (sx - 30) + 'px';
          ghost.style.top = (sy - 30) + 'px';
          document.body.appendChild(ghost);
          card.classList.add('drag-src');
        }, 350);
        function onMove(ev) {
          if (!dragging) {
            if (holdTimer && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 10) {
              clearTimeout(holdTimer); holdTimer = null; cleanup();
            }
            return;
          }
          ghost.style.left = (ev.clientX - 30) + 'px';
          ghost.style.top = (ev.clientY - 30) + 'px';
          clearHints();
          var tg = targetAt(ev.clientX, ev.clientY);
          if (tg && tg.card) {
            var rc = tg.card.getBoundingClientRect();
            tg.card.classList.add(ev.clientX < rc.left + rc.width / 2 ? 'ins-before' : 'ins-after');
          } else if (tg && tg.head) {
            tg.head.classList.add('drop-hint');
          }
        }
        function onUp(ev) {
          if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
          cleanup();
          if (!dragging) return;
          dragging = false;
          if (ghost) { ghost.remove(); ghost = null; }
          card.classList.remove('drag-src');
          var tg = targetAt(ev.clientX, ev.clientY);
          clearHints();
          setTimeout(function () { delete card.dataset.held; }, 80);
          if (!tg) return;
          var changed = false;
          var wasRating = it.rating;
          if (tg.card) {
            var rc2 = tg.card.getBoundingClientRect();
            var after = ev.clientX >= rc2.left + rc2.width / 2;
            var tgIt = items.filter(function (x) { return x.id === tg.card.dataset.id; })[0];
            changed = mvReorder(items, it.id, tg.card.dataset.id, after, tgIt ? tgIt.rating : null);
          } else if (tg.head) {
            changed = mvReorder(items, it.id, null, false, tg.head.dataset.r);
          }
          if (!changed) return;
          if (it.rating !== wasRating) {
            UI.toast(it.rating === 'X' ? 'Marked for delete — ☁ Apply moves it to Drive trash'
              : 'Rated ' + (it.rating === 'na' ? 'N/A' : it.rating) + ' — ☁ Apply renames it in Drive');
          }
          save().then(draw);
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
    }
    DB.get('meta', cfg.metaKey).then(function (r) {
      items = (r && r.value && r.value.items) || [];
      /* v0.59 upgrade migration: tag legacy items with their lifecycle
         state — bytes on the phone → 'stored', else still 'inbox'. The
         first ↻ reconciles anything that already left Drive. Nothing is
         ever dropped here. */
      return storeKeys().then(function (have) {
        var migrated = false;
        items.forEach(function (it) {
          /* v0.61 REINSTALL RESCAN: bytes found on the phone (real files
             in AFmedia/) mark their item stored — no re-download — and
             refresh the size line */
          var f = have[it.id];
          if (f && f.size && it.bytes !== f.size) { it.bytes = f.size; migrated = true; }
          if (f && !it.isNew && it.state && it.state !== 'stored') { it.state = 'stored'; migrated = true; }
          if (it.state) return;
          it.state = (it.isNew || f) ? 'stored' : 'inbox';
          migrated = true;
        });
        return migrated ? save() : null;
      }).catch(function () { /* draw regardless */ });
    }).then(function () {
      draw();
      if (isPC) return; /* the PC only views */
      migrateToFiles(); /* v0.61: move any IndexedDB bytes out to real files */
      /* v0.50: auto actions ONLY when silent auth exists — opening a
         page must never pop the Google sign-in */
      DB.get('meta', 'gdriveRefreshToken').then(function (tok) {
        if (!(tok && tok.value)) return;
        if (!items.length) { doSync(); return; }
        autoIngest(); /* v0.59: waiting inbox files download quietly */
      });
    });
  }

  /* ---- Completed Tasks archive (v0.41, reworked v0.43) ----
     Finished tasks land here when their ✕ is tapped in Alef.do. Months fold
     (minimized by default); each month header carries a 💡 review button
     that opens the fullscreen month-review page (lesson note + editable
     task list). ↩ recovers; ✕ here deletes forever (confirm). */
  var TDC_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  var _tdcOpen = {}; /* month fold state — session only, default folded */
  function tdcMonthGroups(rows) {
    rows.sort(function (a, b) { return (b.doneAt || b.archivedAt || 0) - (a.doneAt || a.archivedAt || 0); });
    var groups = [], byKey = {};
    rows.forEach(function (t) {
      var d = new Date(t.doneAt || t.archivedAt || Date.now());
      var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!byKey[key]) {
        byKey[key] = { key: key, label: TDC_MONTHS[d.getMonth()] + ' ' + d.getFullYear(), items: [] };
        groups.push(byKey[key]);
      }
      byKey[key].items.push(t);
    });
    return groups;
  }
  function tdcArchived(res) {
    var hideVault = (DB.getSettings() || {}).deviceId === 'PC';
    return res.filter(function (t) { return t.archived && !(hideVault && t.cat === 'vault'); });
  }
  function renderCompleted(el, ym) {
    if (ym) return renderReflect(el, ym);
    el.appendChild(UI.header({ title: 'Completed Tasks', back: '#/discipline/todo' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);
    function draw() {
      wrap.innerHTML = '';
      Promise.all([DB.getTodoCats(), DB.all('todos')]).then(function (res) {
        var catName = {};
        res[0].forEach(function (c) { catName[c.id] = c.name; });
        catName.vault = '🔒 Vault';
        var rows = tdcArchived(res[1]);
        if (!rows.length) {
          wrap.appendChild(UI.emptyState('No completed tasks yet',
            'When you tap ✕ on a finished task in Alef.do it moves here instead of being deleted.'));
          return;
        }
        tdcMonthGroups(rows).forEach(function (g) {
          var open = !!_tdcOpen[g.key];
          var hd = UI.el('<div class="tdc-hd">' +
            '<button class="tdc-fold tdc-month" aria-expanded="' + open + '">' +
            '<span class="tdc-arrow">' + (open ? '▾' : '▸') + '</span> ' + g.label +
            ' <span class="tdc-n">(' + g.items.length + ')</span></button>' +
            '<button class="tdc-idea" aria-label="Review this month" title="Review — turn these tasks into lessons">💡</button></div>');
          hd.querySelector('.tdc-fold').addEventListener('click', function () {
            _tdcOpen[g.key] = !open;
            draw();
          });
          hd.querySelector('.tdc-idea').addEventListener('click', function () {
            location.hash = '#/discipline/todo/completed/' + g.key;
          });
          wrap.appendChild(hd);
          if (!open) return;
          g.items.forEach(function (t) {
            var d = new Date(t.doneAt || t.archivedAt || Date.now());
            var dd = String(d.getDate()).padStart(2, '0') + '-' +
                     String(d.getMonth() + 1).padStart(2, '0') + '-' +
                     String(d.getFullYear()).slice(2);
            var item = UI.el('<div class="list-item todo-item li-done tdc-row">' +
              '<input type="checkbox" checked disabled aria-label="completed">' +
              '<span class="li-main"><span class="li-title">' + UI.esc(t.title) + '</span>' +
              '<span class="li-sub">' + UI.esc(catName[t.cat] || t.cat || 'TODAY') + ' · ' + dd + '</span></span>' +
              '<button class="td-recover" aria-label="recover task" title="Recover back to Alef.do">↩</button>' +
              '<button class="td-del tdc-del" aria-label="delete forever" title="Delete forever">✕</button></div>');
            item.querySelector('.td-recover').addEventListener('click', function () {
              t.archived = false;
              t.archivedAt = null;
              DB.put('todos', t).then(function () {
                UI.toast('Recovered to ' + (catName[t.cat] || 'Alef.do'));
                draw();
              });
            });
            item.querySelector('.tdc-del').addEventListener('click', function () {
              UI.confirm('Delete "' + t.title + '" forever? It cannot be recovered.', 'Delete').then(function (ok) {
                if (ok) DB.del('todos', t.id).then(draw);
              });
            });
            wrap.appendChild(item);
          });
        });
      });
    }
    draw();
  }

  /* ---- month review page (v0.43, fullscreen) ----
     Upper third: plain lesson note (autosaved per month, meta todoReflect —
     synced + in full backups). Lower two thirds: that month's completed
     tasks WITHOUT the cross-out, subtasks listed; tap any text to edit it,
     ✕ deletes the task (confirm) or a subtask. */
  function renderReflect(el, ym) {
    var y = +ym.split('-')[0], mo = +ym.split('-')[1] - 1;
    var label = (TDC_MONTHS[mo] || '?') + ' ' + y;
    el.appendChild(UI.header({ title: label + ' — Review', back: '#/discipline/todo/completed' }));
    var page = UI.el('<div class="rf-page"></div>');
    el.appendChild(page);

    var note = UI.el('<textarea class="rf-note" placeholder="What did these tasks teach you? Note the lessons, ideas, plans or anything useful you gained this month — it saves by itself."></textarea>');
    page.appendChild(note);
    /* v0.58 P10: two races fixed — a save before the map loaded used to
       REPLACE every other month's lesson with {}, and a slow load used to
       overwrite what was just typed. Saves wait for the load; the load
       never clobbers typed text; each save re-reads the stored map. */
    var noteLoaded = false;
    DB.get('meta', 'todoReflect').then(function (r) {
      var v = (r && r.value) || {};
      if (v[ym] && !note.value) note.value = v[ym];
      noteLoaded = true;
    });
    var saveT = null;
    note.addEventListener('input', function () {
      clearTimeout(saveT);
      saveT = setTimeout(function saveReflect() {
        if (!noteLoaded) { saveT = setTimeout(saveReflect, 300); return; }
        DB.get('meta', 'todoReflect').then(function (r) {
          var v = (r && r.value) || {};
          v[ym] = note.value;
          DB.put('meta', { key: 'todoReflect', value: v, updatedAt: Date.now() });
        });
      }, 500);
    });

    var listWrap = UI.el('<div class="rf-list"></div>');
    page.appendChild(listWrap);
    function editText(span, initial, onCommit) {
      var inp = UI.el('<input type="text" class="rf-edit" value="' + UI.esc(initial) + '">');
      span.replaceWith(inp);
      inp.focus();
      if (inp.select) inp.select();
      var done = false;
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { done = true; onCommit(inp.value.trim() || initial); } });
      inp.addEventListener('blur', function () { if (!done) { done = true; onCommit(inp.value.trim() || initial); } });
    }
    function draw() {
      listWrap.innerHTML = '';
      DB.all('todos').then(function (res) {
        var rows = tdcArchived(res).filter(function (t) {
          var d = new Date(t.doneAt || t.archivedAt || Date.now());
          return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') === ym;
        });
        rows.sort(function (a, b) { return (b.doneAt || b.archivedAt || 0) - (a.doneAt || a.archivedAt || 0); });
        if (!rows.length) {
          listWrap.appendChild(UI.emptyState('Nothing here any more', 'The tasks of this month were deleted or recovered.'));
          return;
        }
        rows.forEach(function (t) {
          var card = UI.el('<div class="rf-task"></div>');
          var trow = UI.el('<div class="rf-trow"><input type="checkbox" checked disabled aria-label="completed">' +
            '<span class="rf-title">' + UI.esc(t.title) + '</span>' +
            '<button class="td-del" aria-label="delete task">✕</button></div>');
          trow.querySelector('.rf-title').addEventListener('click', function (e) {
            editText(e.target, t.title, function (v) {
              t.title = v;
              DB.put('todos', t).then(draw);
            });
          });
          trow.querySelector('.td-del').addEventListener('click', function () {
            UI.confirm('Delete "' + t.title + '" forever?', 'Delete').then(function (ok) {
              if (ok) DB.del('todos', t.id).then(draw);
            });
          });
          card.appendChild(trow);
          (t.subs || []).forEach(function (sub, i) {
            var srow = UI.el('<div class="rf-sub"><span class="rf-bullet">•</span>' +
              '<span class="rf-stext">' + UI.esc(sub.title) + '</span>' +
              '<button class="td-del td-del-sm" aria-label="delete subtask">✕</button></div>');
            srow.querySelector('.rf-stext').addEventListener('click', function (e) {
              editText(e.target, sub.title, function (v) {
                sub.title = v;
                DB.put('todos', t).then(draw);
              });
            });
            srow.querySelector('.td-del').addEventListener('click', function () {
              t.subs.splice(i, 1);
              DB.put('todos', t).then(draw);
            });
            card.appendChild(srow);
          });
          listWrap.appendChild(card);
        });
      });
    }
    draw();
  }

  /* ---- task detail sheet (slides up) ---- */
  function taskSheet(orig, cats, onDone, unlocked) {
    var roMode = !!orig.locked && !unlocked;
    var t = JSON.parse(JSON.stringify(orig));
    t.subs = t.subs || []; t.tags = t.tags || [];
    var s = DB.getSettings();
    var tagName = {};

    var body = UI.el('<div class="td-sheet"></div>');
    /* v0.50: dirty tracking — the Save buttons stay inactive until a change */
    var dirty = false, saveBtns = [];
    function dirt() {
      if (dirty) return;
      dirty = true;
      saveBtns.forEach(function (b) { b.disabled = false; });
    }
    /* v0.50: auto-growing textarea — word wrap, grows per row, capped at a
       share of the screen; past the cap it scrolls by gesture (no buttons) */
    function autosize(ta, capVh) {
      var cap = Math.round((window.innerHeight || 800) * (capVh || 0.4));
      ta.style.height = 'auto';
      var h = Math.min((ta.scrollHeight || 0) + 2, cap);
      if (h > 8) ta.style.height = h + 'px';
    }
    var titleIn = UI.el('<textarea class="td-title-in" rows="1" placeholder="Task name"></textarea>');
    titleIn.value = t.title || '';
    titleIn.addEventListener('input', function () { dirt(); autosize(titleIn, 0.3); });
    titleIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); titleIn.blur(); } });
    setTimeout(function () { autosize(titleIn, 0.3); }, 0);
    body.appendChild(titleIn);

    /* priority: label + level text, badge row below */
    var prioRow = UI.el('<div class="td-prio-row"><span class="td-prio-lbl">Priority</span></div>');
    var badges = UI.el('<div class="td-badges">' + TD_PRIOS.map(function (p) {
      return '<button type="button" class="td-badge td-b-' + p[2] + ((t.prio || 'none') === p[0] ? ' on' : '') + '" data-p="' + p[0] + '" title="' + p[1] + '">' +
        (p[0] === 'low' ? '🌱' : '') + '</button>'; /* v0.50: Habit sprout */
    }).join('') + '</div>');
    var prioVal = UI.el('<b id="td-prio-name"></b>');
    function setPrioLabel() {
      var cur = TD_PRIOS.filter(function (x) { return x[0] === (t.prio || 'none'); })[0] || TD_PRIOS[5];
      /* v0.50: Habit shows its repetition count (🌱 grows toward 25 / 100) */
      prioVal.textContent = cur[1] + (cur[0] === 'low' && t.habitCount ? ' ×' + t.habitCount : '');
      prioVal.className = 'td-prio-val td-pv-' + cur[2];
    }
    setPrioLabel();
    badges.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.td-badge') : null;
      if (!b) return;
      dirt();
      t.prio = b.dataset.p;
      badges.querySelectorAll('.td-badge').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      setPrioLabel();
      /* v0.40: rating "Never" files the task into the NEVER list (Vault
         entries stay put — nothing may move OUT of the Vault by side effect) */
      if (t.prio === 'monkey' && t.cat !== 'vault' && t.cat !== 'never') {
        _schedTouched = true;
        t.cat = 'never';
        t.now = false;
        t.nowAt = null;
        t.startDate = null; /* v0.54: Never = out of plans — the schedule clears */
        t.startTime = null;
        refreshTags();
        UI.toast('Rated Never — moves to the NEVER list on save');
      }
    });
    prioRow.appendChild(badges);
    prioRow.appendChild(prioVal);
    /* v0.56: the Vault detail is an INFO page (Alef stores developed
       information there) — Priority and Tags fold shut by default, a
       small header taps them open. Other lists keep the rows visible. */
    var isVault = t.cat === 'vault';
    function foldable(label, rowEl) {
      var box = UI.el('<div class="td-fold"></div>');
      var head = UI.el('<button type="button" class="td-fold-h sub">' + label + ' <span class="td-fold-a">▸</span></button>');
      rowEl.hidden = true;
      head.addEventListener('click', function () {
        rowEl.hidden = !rowEl.hidden;
        head.querySelector('.td-fold-a').textContent = rowEl.hidden ? '▸' : '▾';
      });
      box.appendChild(head);
      box.appendChild(rowEl);
      return box;
    }
    body.appendChild(isVault ? foldable('Priority', prioRow) : prioRow);

    /* tags */
    var tagWrap = UI.el('<div class="td-tags-row"><span class="td-prio-lbl">Tags</span><div class="td-tagrow"></div></div>');
    function refreshTags() {
      return DB.byIndex('tags', 'module', 'todo').then(function (rows) {
        tagName = {};
        rows.forEach(function (x) { tagName[x.id] = x.name; });
        var row = tagWrap.querySelector('.td-tagrow');
        row.innerHTML = '';
        var nowTg = UI.el('<button type="button" class="chip td-now-chip' + (t.now ? ' on' : '') + '">Now' + (t.now ? ' ✓' : '') + '</button>');
        nowTg.addEventListener('click', function () {
          _schedTouched = true;
          t.now = !t.now;
          if (t.now) { t.nowAt = null; t.startDate = null; t.startTime = null; } /* Now beats any schedule */
          dirt();
          refreshTags();
        });
        row.appendChild(nowTg);
        /* v0.40: one-tap hour chips — arrange the task at 10:00/12:00/...;
           it flips to Now once the clock passes that hour. Tap again to clear. */
        ['10', '12', '14', '16', '18', '20'].forEach(function (h) {
          var hv = h + ':00';
          var hc = UI.el('<button type="button" class="chip td-hr-chip' + (!t.startDate && t.nowAt === hv ? ' on' : '') + '" title="Do at ' + hv + '">' + h + '</button>');
          hc.addEventListener('click', function () {
            _schedTouched = true;
            if (t.nowAt === hv && !t.startDate) { t.nowAt = null; }
            else { t.nowAt = hv; t.now = false; t.startDate = null; t.startTime = null; }
            dirt();
            refreshTags();
          });
          row.appendChild(hc);
        });
        /* v0.50: schedule = DATE + time (default 08:00). Date reached → the
           task moves to TODAY; date+time reached → it becomes NOW. With no
           date set, the time box is the old same-day "becomes Now at". */
        var dateIn = UI.el('<input type="date" class="td-startd" title="Start date" value="' + UI.esc(t.startDate || '') + '">');
        var nowAtIn = UI.el('<input type="time" class="td-nowat" title="' + (t.startDate ? 'Start time' : 'Becomes Now at this time') + '" value="' + UI.esc(t.startDate ? (t.startTime || '08:00') : (t.nowAt || '')) + '">');
        dateIn.addEventListener('change', function () {
          _schedTouched = true;
          if (dateIn.value) {
            t.startDate = dateIn.value;
            t.startTime = nowAtIn.value || '08:00';
            t.now = false;
            t.nowAt = null;
          } else {
            t.startDate = null;
            t.startTime = null;
          }
          dirt();
          refreshTags();
        });
        nowAtIn.addEventListener('change', function () {
          _schedTouched = true;
          if (t.startDate) {
            t.startTime = nowAtIn.value || '08:00';
          } else {
            t.nowAt = nowAtIn.value || null;
            if (t.nowAt) t.now = false;
          }
          dirt();
          refreshTags();
        });
        /* v0.56: the two inputs hide behind a small calendar icon pushed
           to the far right of the Now row — tap to open; the icon lights
           while a date is set. (🔒/🤖 moved to the sheet's top bar.) */
        var calBtn = UI.el('<button type="button" class="btn-icon sm td-cal-btn' + (t.startDate ? ' on' : '') + '" aria-label="Schedule date and time">' + UI.icon('calendar') + '</button>');
        calBtn.addEventListener('click', function () {
          _schedOpen = !_schedOpen;
          schedRow.hidden = !_schedOpen;
        });
        row.appendChild(calBtn);
        var schedRow = UI.el('<div class="td-sched-row"></div>');
        schedRow.hidden = !_schedOpen;
        schedRow.appendChild(dateIn);
        schedRow.appendChild(nowAtIn);
        row.appendChild(schedRow);
        var add = UI.el('<button type="button" class="chip td-addtag">+ Add tags</button>');
        add.addEventListener('click', function () {
          tagPicker(t.tags, function (sel) {
            if (sel) { t.tags = sel; dirt(); }
            refreshTags();
          });
        });
        row.appendChild(add);
        t.tags.forEach(function (id) {
          if (tagName[id]) row.appendChild(UI.el('<span class="td-stamp">' + UI.esc(tagName[id]) + '</span>'));
        });
      });
    }
    var _schedOpen = false; /* v0.56: calendar icon toggles the date+time row */
    var _schedTouched = false; /* v0.58 P9: user touched schedule/cat here — sheet wins over a mid-edit promotion */
    refreshTags();
    body.appendChild(isVault ? foldable('Tags', tagWrap) : tagWrap);

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
          dirt();
          drawSubs();
        });
        row.querySelector('.td-sub-title').addEventListener('click', function () {
          if (roMode) return;
          if (row.dataset.held) { delete row.dataset.held; return; } /* drag, not a tap */
          var inp = UI.el('<input type="text" class="td-sub-add" value="' + UI.esc(sub.title) + '">');
          row.replaceChild(inp, row.querySelector('.td-sub-title'));
          inp.focus();
          if (inp.select) inp.select();
          var committed = false;
          function commitEdit() {
            if (committed) return;
            committed = true;
            var v = inp.value.trim();
            if (v && v !== sub.title) { sub.title = v; dirt(); }
            drawSubs();
          }
          inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') commitEdit(); });
          inp.addEventListener('blur', commitEdit);
        });
        var subDel = row.querySelector('.td-del');
        if (subDel) subDel.addEventListener('click', function () {
          t.subs.splice(i, 1);
          dirt();
          drawSubs();
        });
        /* v0.50: press-hold then drag to sort — an insertion line shows
           where the subtask will land */
        (function enableSubDrag() {
          var hold = null, drag = false, sy0 = 0;
          function clearSubHints() {
            listEl.querySelectorAll('.ins-above, .ins-below').forEach(function (r2) {
              r2.classList.remove('ins-above'); r2.classList.remove('ins-below');
            });
          }
          row.addEventListener('touchmove', function (e) { if (drag) e.preventDefault(); }, { passive: false });
          row.addEventListener('pointerdown', function (e) {
            if (roMode) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            sy0 = e.clientY;
            drag = false;
            hold = setTimeout(function () { hold = null; drag = true; row.classList.add('drag-src'); }, 300);
            function overRowAt(ev) {
              var n = document.elementFromPoint ? document.elementFromPoint(ev.clientX, ev.clientY) : null;
              var o = n && n.closest ? n.closest('.td-sub-row') : null;
              if (!o || o === row || o.classList.contains('td-sub-addrow') || o.parentNode !== listEl) return null;
              return o;
            }
            function mv(ev) {
              if (!drag) {
                if (hold && Math.abs(ev.clientY - sy0) > 8) { clearTimeout(hold); hold = null; end(); }
                return;
              }
              if (ev.preventDefault) ev.preventDefault();
              clearSubHints();
              var o = overRowAt(ev);
              if (o) {
                var r = o.getBoundingClientRect();
                o.classList.add(ev.clientY < r.top + r.height / 2 ? 'ins-above' : 'ins-below');
              }
            }
            function up(ev) {
              if (hold) { clearTimeout(hold); hold = null; }
              end();
              if (!drag) return;
              drag = false;
              row.classList.remove('drag-src');
              row.dataset.held = '1';
              setTimeout(function () { delete row.dataset.held; }, 80);
              var o = overRowAt(ev);
              clearSubHints();
              if (!o) return;
              var kids = Array.prototype.slice.call(listEl.querySelectorAll('.td-sub-row')).filter(function (k) {
                return !k.classList.contains('td-sub-addrow');
              });
              var to = kids.indexOf(o);
              var r = o.getBoundingClientRect();
              var insertAt = to + (ev.clientY >= r.top + r.height / 2 ? 1 : 0);
              if (i < insertAt) insertAt--;
              var moved = t.subs.splice(i, 1)[0];
              t.subs.splice(insertAt, 0, moved);
              dirt();
              drawSubs();
            }
            function end() {
              window.removeEventListener('pointermove', mv);
              window.removeEventListener('pointerup', up);
              window.removeEventListener('pointercancel', up);
            }
            window.addEventListener('pointermove', mv);
            window.addEventListener('pointerup', up);
            window.addEventListener('pointercancel', up);
          });
        })();
        listEl.appendChild(row);
      });
    }
    /* v0.63 (Alef's ask): the add-row is PERSISTENT — it lives after the
       rebuilt list instead of inside it, so Enter never destroys the
       focused input. The keyboard stays open, the view stays anchored on
       the SUBTASKS area, and the newest entry scrolls just into view
       (block:'nearest' — no jump to the bottom of the sheet). */
    var addRow = UI.el('<div class="td-sub-row td-sub-addrow"><input type="checkbox" disabled>' +
      '<input type="text" class="td-sub-add" placeholder="Add a new subtask"></div>');
    var ai = addRow.querySelector('.td-sub-add');
    function commitAdd() {
      var v = ai.value.trim();
      if (!v) return;
      ai.value = ''; /* a trailing blur must not add it twice */
      t.subs.push({ id: DB.uid(), title: v, done: false });
      dirt();
      drawSubs();
      try {
        if (addRow.scrollIntoView) addRow.scrollIntoView({ block: 'nearest' });
      } catch (e) { /* older WebViews */ }
      ai.focus();
    }
    ai.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commitAdd(); } });
    ai.addEventListener('blur', function () { commitAdd(); });
    drawSubs();
    subsWrap.appendChild(addRow);
    body.appendChild(subsWrap);

    /* note — v0.50 word wrap + auto-grow. v0.56: the preview panel is
       ~10 rows tall, and the headline carries a fullscreen-edit icon at
       the far right (a very long note still opens minimized to those 10
       rows and grows on tap). */
    var noteHead = UI.el('<div class="td-subs-head td-note-head">NOTE<button type="button" class="btn-icon sm td-note-max" aria-label="Edit note full screen">' + UI.icon('expand') + '</button></div>');
    body.appendChild(noteHead);
    var noteIn = UI.el('<textarea class="td-note" rows="10" placeholder="Add your notes...."></textarea>');
    noteIn.value = t.note || '';
    noteIn.addEventListener('input', function () {
      dirt();
      if (!noteIn.classList.contains('td-note-min')) autosize(noteIn, 0.45);
    });
    if ((t.note || '').split('\n').length > 10 || (t.note || '').length > 800) {
      noteIn.classList.add('td-note-min');
      var expandNote = function () {
        if (!noteIn.classList.contains('td-note-min')) return;
        noteIn.classList.remove('td-note-min');
        autosize(noteIn, 0.45);
      };
      noteIn.addEventListener('focus', expandNote);
      noteIn.addEventListener('click', expandNote);
    }
    body.appendChild(noteIn);
    noteHead.querySelector('.td-note-max').addEventListener('click', function () {
      /* full-screen note editor — edits sync live into the sheet, so
         closing the overlay any way keeps the text */
      var big = UI.el('<textarea class="td-note td-note-full" placeholder="Add your notes...."></textarea>');
      big.value = noteIn.value;
      big.addEventListener('input', function () {
        noteIn.value = big.value;
        dirt();
      });
      if (roMode) big.disabled = true;
      var refN = UI.modal('Note', big, [{ label: 'Done', primary: true }]);
      refN.root.querySelector('.modal').classList.add('modal-full');
      setTimeout(function () { if (!roMode) big.focus(); }, 60);
    });

    /* v0.48: export icon in the sheet's top-right — exports THIS task,
       including edits typed but not yet saved */
    function addExportBtn(ref) {
      var mt = ref.root.querySelector('.modal-title');
      var xb = UI.el('<button type="button" class="btn-icon mtitle-btn" aria-label="Export this task">' + UI.icon('export') + '</button>');
      xb.addEventListener('click', function () {
        var t2 = JSON.parse(JSON.stringify(t));
        t2.title = titleIn.value.trim() || t.title;
        t2.note = noteIn.value;
        exportOneTask(t2, cats);
      });
      mt.appendChild(xb);
    }

    /* v0.50: one save routine for the bottom button AND the header icon;
       a DDMMYY token typed in the title schedules the start date */
    function doSave(close) {
      var name = (titleIn.value || '').trim();
      if (!name) { UI.toast('Task name is required'); return; }
      var tok = parseStartToken(name);
      if (tok) {
        name = tok.title;
        _schedTouched = true;
        t.startDate = tok.date;
        t.startTime = t.startTime || '08:00';
        t.now = false;
        t.nowAt = null;
        UI.toast('Starts ' + tok.date + ' ' + t.startTime);
      }
      t.title = name;
      t.note = noteIn.value;
      /* v0.58 P9: a promotion (scheduled date/time reached) can fire while
         the sheet is open — unless the schedule was touched IN this sheet,
         the live record's schedule/list/now fields win over the stale copy */
      DB.get('todos', orig.id).then(function (live) {
        if (live && !_schedTouched) {
          t.cat = live.cat;
          t.now = live.now;
          t.nowAt = live.nowAt;
          t.startDate = live.startDate;
          t.startTime = live.startTime;
        }
        Object.assign(orig, t);
        return DB.put('todos', orig);
      }).then(function () { close(); onDone(); });
    }

    if (roMode) {
      body.classList.add('td-ro');
      titleIn.disabled = true;
      noteIn.disabled = true;
      Array.prototype.forEach.call(body.querySelectorAll('button, input'), function (el2) { el2.disabled = true; });
      /* v0.56: the Vault fold headers stay tappable in read-only mode */
      Array.prototype.forEach.call(body.querySelectorAll('.td-fold-h'), function (el2) { el2.disabled = false; });
      var refRo = UI.modal('Task 🔒', body, [
        { label: 'Close' },
        {
          label: 'Unlock', primary: true, onClick: function (close) {
            UI.confirm('Unlock this protected task for editing?', 'Unlock').then(function (okU) {
              if (!okU) return;
              close();
              taskSheet(orig, cats, onDone, true);
            });
          }
        }
      ]);
      refRo.root.querySelector('.modal').classList.add('modal-full');
      addExportBtn(refRo);
      return;
    }
    var ref = UI.modal('Task', body, [
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
      { label: 'Save', primary: true, onClick: doSave }
    ]);
    /* v0.50: the sheet fills the screen */
    ref.root.querySelector('.modal').classList.add('modal-full');
    /* footer → icons: ✕ ¼ · 🗑 ¼ · 💾 ½ right; Save starts inactive.
       (The real label stays inside, visually hidden — a11y + tests.) */
    var fb = ref.root.querySelectorAll('.modal-btns .btn');
    fb[0].innerHTML = UI.icon('x') + '<span class="vh">Cancel</span>';
    fb[0].classList.add('tds-sm');
    fb[0].setAttribute('aria-label', 'Cancel');
    fb[1].innerHTML = UI.icon('trash') + '<span class="vh">Delete</span>';
    fb[1].classList.add('tds-sm');
    fb[1].setAttribute('aria-label', 'Delete');
    fb[2].innerHTML = UI.icon('save') + '<span class="vh">Save</span>';
    fb[2].classList.add('tds-save');
    fb[2].setAttribute('aria-label', 'Save');
    fb[2].disabled = true;
    saveBtns.push(fb[2]);
    /* header save icon (top-right, left of export) — same save routine */
    var hs = UI.el('<button type="button" class="btn-icon mtitle-btn mtitle-btn2" aria-label="Save task" disabled>' + UI.icon('save') + '</button>');
    hs.addEventListener('click', function () { doSave(ref.close); });
    ref.root.querySelector('.modal-title').appendChild(hs);
    saveBtns.push(hs);
    /* v0.56: 🔒 Protect + 🤖 Share moved OUT of the Tags row into the
       sheet's top bar, right after the "Task" title (small gap) */
    var hchips = UI.el('<span class="tds-hchips"></span>');
    var lockTg = UI.el('<button type="button" class="chip td-lock-chip' + (t.locked ? ' on' : '') + '" title="Protect this task">' + (t.locked ? '🔒' : '🔓') + '</button>');
    lockTg.addEventListener('click', function () {
      t.locked = !t.locked;
      dirt();
      lockTg.classList.toggle('on', t.locked);
      lockTg.textContent = t.locked ? '🔒' : '🔓';
    });
    hchips.appendChild(lockTg);
    if ((DB.getSettings() || {}).claudeShareOn && t.cat !== 'vault') {
      /* per-task Claude share: shared by default, tap to hide (noShare) */
      var aiTg = UI.el('<button type="button" class="chip td-lock-chip' + (t.noShare ? '' : ' on') + '" title="' + (t.noShare ? 'Hidden from Claude' : 'Shared with Claude') + '">🤖</button>');
      aiTg.addEventListener('click', function () {
        t.noShare = !t.noShare;
        dirt();
        aiTg.classList.toggle('on', !t.noShare);
        aiTg.title = t.noShare ? 'Hidden from Claude' : 'Shared with Claude';
      });
      hchips.appendChild(aiTg);
    }
    ref.root.querySelector('.modal-title').appendChild(hchips);
    addExportBtn(ref);
    /* tapping outside with unsaved changes → save / discard, never silent loss */
    ref.root.addEventListener('click', function (e) {
      if (e.target !== ref.root || !dirty) return;
      e.stopPropagation();
      UI.modal('Unsaved changes', UI.el('<p>Save your changes to this task?</p>'), [
        { label: 'Discard', onClick: function (close2) { close2(); ref.close(); } },
        { label: 'Save', primary: true, onClick: function (close2) { close2(); doSave(ref.close); } }
      ]);
    }, true);
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
        '#3aa8a0', '#38bdf8', '#f472b6', '#9acd32', '#a0765b',
        '#8b1e1e', '#1e3a8a', '#5eead4', '#c084fc', '#facc15'];
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
            '<button class="btn-icon sm" data-a="edit" aria-label="rename">' + UI.icon('edit') + '</button>' +
            '<button class="btn-icon sm" data-a="up" aria-label="up">↑</button>' +
            '<button class="btn-icon sm" data-a="down" aria-label="down">↓</button>' +
            '<button class="btn-icon sm" data-a="color" aria-label="color"><span class="cat-dot" style="background:' + (c.color || 'var(--line2)') + '"></span></button></div>');
          row.querySelector('[data-a=edit]').addEventListener('click', function () {
            var eb = UI.el('<div>' + UI.field('List name', '<input type="text" id="oc-nm" value="' + UI.esc(c.name) + '">') + '</div>');
            UI.modal('Rename list', eb, [
              { label: 'Cancel' },
              {
                label: 'Save', primary: true, onClick: function (close) {
                  var v = eb.querySelector('#oc-nm').value.trim();
                  if (!v) return;
                  c.name = v;
                  close();
                  drawL();
                }
              }
            ]);
          });
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

  /* ---- Send to S26: the PC picks which drafts to send ---- */
  function renderSend(el) {
    el.appendChild(UI.header({ title: 'Send to S26', back: '#/discipline/todo' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);
    function draw() {
      wrap.innerHTML = '';
      DB.listProposals().then(function (props) {
        var drafts = props.filter(function (x) { return x.status === 'draft'; });
        var sent = props.filter(function (x) { return x.status === 'sent'; });
        if (!props.length) {
          wrap.appendChild(UI.emptyState('No pending changes', 'Edits you make on this PC will appear here'));
          return;
        }
        if (drafts.length) {
          wrap.appendChild(UI.el('<div class="section-title">Drafts — choose what to send</div>'));
          var list = UI.el('<div class="list"></div>');
          drafts.forEach(function (pr) {
            var row = UI.el('<div class="list-item"><input type="checkbox" class="sd-pick" data-id="' + pr.id + '" checked>' +
              '<span class="li-main"><span class="li-title">' + UI.esc(DB.propSummary(pr)) + '</span>' +
              '<span class="li-sub">' + UI.esc(pr.store) + ' · ' + UI.fmtDate(localISO(pr.proposedAt)) + '</span></span>' +
              '<button class="td-del" aria-label="delete draft">✕</button></div>');
            row.querySelector('.td-del').addEventListener('click', function () {
              UI.confirm('Delete this draft?', 'Delete').then(function (ok2) {
                if (ok2) DB.del('proposals', pr.id).then(draw);
              });
            });
            list.appendChild(row);
          });
          wrap.appendChild(list);
          var sendBtn = UI.el('<button class="btn btn-primary btn-block">Send selected to S26</button>');
          sendBtn.addEventListener('click', function () {
            var ids = Array.prototype.map.call(wrap.querySelectorAll('.sd-pick:checked'), function (i) { return i.dataset.id; });
            if (!ids.length) { UI.toast('Nothing selected'); return; }
            DB.sendProposals(ids).then(function () {
              UI.toast('Sent ' + ids.length + ' change' + (ids.length === 1 ? '' : 's') + ' — syncs to the S26');
              draw();
            });
          });
          wrap.appendChild(sendBtn);
        }
        if (sent.length) {
          wrap.appendChild(UI.el('<div class="section-title">Waiting for S26 review</div>'));
          var list2 = UI.el('<div class="list"></div>');
          sent.forEach(function (pr) {
            var row = UI.el('<div class="list-item"><span class="li-main">' +
              '<span class="li-title">⏳ ' + UI.esc(DB.propSummary(pr)) + '</span>' +
              '<span class="li-sub">sent · waiting for approval on the S26</span></span>' +
              '<button class="btn-icon sm" aria-label="withdraw">↩</button></div>');
            row.querySelector('.btn-icon').addEventListener('click', function () {
              UI.confirm('Withdraw this change?', 'Withdraw').then(function (ok2) {
                if (ok2) DB.del('proposals', pr.id).then(draw);
              });
            });
            list2.appendChild(row);
          });
          wrap.appendChild(list2);
        }
      });
    }
    draw();
  }

  /* ---- Review inbox: the S26 approves or rejects PC changes ---- */
  function renderReview(el) {
    el.appendChild(UI.header({ title: 'Review PC changes', back: '#/discipline/todo' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);
    function draw() {
      wrap.innerHTML = '';
      Promise.all([DB.listProposals(), DB.getTodoCats()]).then(function (resR) {
        var props = resR[0], rCats = resR[1];
        var inbox = props.filter(function (x) { return x.status === 'sent'; });
        if (!inbox.length) {
          wrap.appendChild(UI.emptyState('Inbox empty', 'Changes sent from the PC will appear here'));
          return;
        }
        var allBtn = UI.el('<button class="btn btn-primary btn-block" style="margin-bottom:10px">Accept all (' + inbox.length + ')</button>');
        allBtn.addEventListener('click', function () {
          /* v0.58 P8: Accept-all now counts the ⚠ stale items into the
             confirm and SKIPS anything whose target moved into the Vault */
          Promise.all(inbox.map(function (pr) {
            return (pr.store === 'meta' ? DB.get('meta', pr.recId) : DB.get(pr.store, pr.recId))
              .then(function (live) { return live && (live.updatedAt || 0) > (pr.base || 0) ? 1 : 0; })
              .catch(function () { return 0; });
          })).then(function (fl) {
            var staleN = fl.reduce(function (a, b) { return a + b; }, 0);
            return UI.confirm('Accept all ' + inbox.length + ' changes from the PC?' +
              (staleN ? ' ⚠ ' + staleN + ' of them changed on THIS phone since the draft — accepting overwrites the newer local copy.' : ''),
              'Accept all');
          }).then(function (ok2) {
            if (!ok2) return;
            var skipped = 0;
            var chain = Promise.resolve();
            inbox.forEach(function (pr) {
              chain = chain.then(function () {
                return DB.applyProposal(pr).then(function () { return DB.del('proposals', pr.id); })
                  .catch(function (eP) {
                    if (eP && eP.vaultSkip) { skipped++; return null; } /* proposal stays for review */
                    throw eP;
                  });
              });
            });
            chain.then(function () {
              UI.toast(skipped ? 'Applied — ' + skipped + ' skipped (target is in the Vault)' : 'All changes applied');
              draw();
            });
          });
        });
        wrap.appendChild(allBtn);
        var list = UI.el('<div class="list"></div>');
        var chain0 = Promise.resolve();
        inbox.forEach(function (pr) {
          chain0 = chain0.then(function () {
            var liveP = pr.store === 'meta' ? DB.get('meta', pr.recId) : DB.get(pr.store, pr.recId);
            return liveP.then(function (live) {
              var stale = live && (live.updatedAt || 0) > (pr.base || 0);
              var who = pr.by === 'Claude' ? 'Claude 🤖' : 'PC';
              var subLine = 'from ' + who + ' · ' + UI.esc(pr.store) +
                (pr.why ? ' — ' + UI.esc(pr.why) : '') +
                (stale ? ' · ⚠ changed here since — check first' : '');
              var row = UI.el('<div class="list-item rv-row"><span class="li-main">' +
                '<span class="li-title">' + (stale ? '⚠ ' : '') + (pr.by === 'Claude' ? '🤖 ' : '') + UI.esc(DB.propSummary(pr)) + '</span>' +
                '<span class="li-sub" style="white-space:normal">' + subLine + '</span></span>' +
                '<button class="btn rv-no">Reject</button>' +
                '<button class="btn btn-primary rv-yes">Accept</button></div>');
              /* destination override: send the task to any list, incl. Project or Vault */
              var destSel = null;
              if (pr.store === 'todos' && pr.action !== 'delete' && pr.data && pr.data.cat !== undefined) {
                destSel = UI.el('<select class="rv-dest" aria-label="destination list">' +
                  rCats.map(function (c2) {
                    return '<option value="' + c2.id + '"' + (c2.id === pr.data.cat ? ' selected' : '') + '>' + UI.esc(c2.name) + '</option>';
                  }).join('') +
                  '<option value="vault"' + (pr.data.cat === 'vault' ? ' selected' : '') + '>🔒 Vault</option></select>');
                row.insertBefore(destSel, row.querySelector('.rv-no'));
              }
              row.querySelector('.rv-yes').addEventListener('click', function () {
                if (destSel && destSel.value !== pr.data.cat) {
                  pr.data.cat = destSel.value;
                  if (destSel.value === 'vault') pr.data.now = false;
                }
                DB.applyProposal(pr).then(function () { return DB.del('proposals', pr.id); }).then(function () {
                  UI.toast('Applied');
                  draw();
                }).catch(function (eP) {
                  UI.toast('⚠ ' + String(eP && eP.message || eP));
                });
              });
              row.querySelector('.rv-no').addEventListener('click', function () {
                UI.confirm('Reject this change? The PC keeps nothing — it is discarded.', 'Reject').then(function (ok2) {
                  if (ok2) DB.del('proposals', pr.id).then(draw);
                });
              });
              list.appendChild(row);
            });
          });
        });
        chain0.then(function () { wrap.appendChild(list); });
      });
    }
    draw();
  }

  /* ---- Moment: review TODAY + LATER one by one, 3 sections ---- */
  function renderMoment(el) {
    el.appendChild(UI.header({ title: 'Moment', back: '#/discipline/todo' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    Promise.all([DB.all('todos'), DB.getTodoCats()]).then(function (res) {
      var rows = res[0], cats = res[1];
      var queue = rows.filter(function (t) {
        var home = t.cat || 'today';
        return !t.done && !t.locked && (home === 'today' || home === 'later');
      }).sort(function (a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
      var total = queue.length, i = 0;
      var wrap = UI.el('<div></div>');
      pad.appendChild(wrap);
      var lists = cats.filter(function (c) { return c.id !== 'now'; });
      var nowCat = null;
      cats.forEach(function (c) { if (c.id === 'now') nowCat = c; });
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
          (t.note ? '<div class="sub">' + UI.esc(t.note) + '</div>' : '') + '</div>'));

        /* section 1: Now toggle + Next */
        var s1 = UI.el('<div class="td-moment-btns"></div>');
        var nowName = nowCat ? nowCat.name : 'NOW';
        var nowBtn = UI.el('<button class="btn td-now-btn' + (t.now ? ' on' : '') + '">' + UI.esc(nowName) + (t.now ? ' ✓' : '') + '</button>');
        nowBtn.addEventListener('click', function () {
          t.now = !t.now;
          DB.put('todos', t).then(function () {
            nowBtn.classList.toggle('on', t.now);
            nowBtn.textContent = nowName + (t.now ? ' ✓' : '');
          });
        });
        s1.appendChild(nowBtn);
        var nextBtn = UI.el('<button class="btn" data-c="__next">Next →</button>');
        nextBtn.addEventListener('click', function () { i++; show(); });
        s1.appendChild(nextBtn);
        wrap.appendChild(s1);
        wrap.appendChild(UI.el('<div class="td-moment-sep"></div>'));

        /* section 2: home list — current shown, tap another to move */
        var curList = null;
        lists.forEach(function (c) { if (c.id === (t.cat || 'today')) curList = c; });
        wrap.appendChild(UI.el('<div class="sub td-moment-cur">List: <b>' + UI.esc(curList ? curList.name : (t.cat || 'today').toUpperCase()) + '</b></div>'));
        var s2 = UI.el('<div class="td-moment-btns"></div>');
        lists.forEach(function (c) {
          var cur = c.id === (t.cat || 'today');
          var b = UI.el('<button class="btn" data-c="' + c.id + '"' + (cur ? ' disabled' : '') + '>' + UI.esc(c.name) + (cur ? ' ✓' : '') + '</button>');
          if (c.color && !cur) { b.style.background = c.color; b.style.borderColor = c.color; b.style.color = '#fff'; }
          if (!cur) {
            b.addEventListener('click', function () {
              /* v0.58 C10: route through the TOMORROW move rules — leaving
                 the virtual list must clear the assigned date + time
                 (before this, a TOMORROW task "moved" but stayed put) */
              var planM = tdMovePlan(t, c.id, tomorrowISO());
              Object.assign(t, planM.patch);
              t.cat = c.id;
              DB.put('todos', t).then(function () { i++; show(); });
            });
          }
          s2.appendChild(b);
        });
        wrap.appendChild(s2);
        wrap.appendChild(UI.el('<div class="td-moment-sep"></div>'));

        /* section 3: Done / Delete */
        var s3 = UI.el('<div class="td-moment-btns"></div>');
        var doneB = UI.el('<button class="btn td-done-btn" data-c="__done">✓ Done</button>');
        doneB.addEventListener('click', function () {
          t.done = true;
          t.doneAt = Date.now();
          DB.put('todos', t).then(function () {
            /* v0.50: a finished Habit (🌱) plants tomorrow's copy */
            if (t.prio === 'low') {
              return DB.regenHabit(t).then(function (c) {
                if (c) UI.toast('🌱 Habit ×' + c.habitCount + ' — planted for tomorrow 08:00');
              });
            }
          }).then(function () { i++; show(); });
        });
        s3.appendChild(doneB);
        var delB = UI.el('<button class="btn btn-danger" data-c="__del">Delete</button>');
        delB.addEventListener('click', function () {
          UI.confirm('Delete "' + t.title + '"?', 'Delete').then(function (ok2) {
            if (!ok2) return;
            DB.del('todos', t.id).then(function () { i++; show(); });
          });
        });
        s3.appendChild(delB);
        wrap.appendChild(s3);
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
            '<span class="li-sub">' + UI.esc(tagStr || UI.fmtDate(localISO(n.updatedAt))) + '</span></span>' +
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
            /* v0.57 C7: this called an undefined helper — the ReferenceError
               froze the modal and the OS alarms were never (re)scheduled */
            if ('Notification' in window && Notification.permission === 'default') {
              try { Notification.requestPermission(); } catch (e) { /* ok */ }
            }
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

  return { render: render, TIMED_ALERTS: TIMED_ALERTS, ALLDAY_ALERTS: ALLDAY_ALERTS,
    _fmtTaskText: fmtTaskText, _buildTodoExport: buildTodoExport,
    _tomorrowISO: tomorrowISO, _tdMovePlan: tdMovePlan,
    _thumbFromVideoBuf: thumbFromVideoBuf, _mkThumb: MK_THUMB,
    _mvReorder: mvReorder };
})();
