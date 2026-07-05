/* Alef.Fit — Retro tab, card pattern:
   1. Workout day  — calendar, days colored by main muscle; day view with
      edit + add past records.
   2. Progressive Rep-Vol Trend — weekly avg volume of working sets 3–4,
      with the exercise's past records listed under the graph.
   3./4. Weight training & Incline walk day/week — trend timeline
      (8wk avg → 4wk avg → this week, rolling), right-aligned. */
'use strict';

window.Screens = window.Screens || {};

Screens.retro = (function () {

  function render(el, parts) {
    if (parts[0] === 'cal') return renderCalendar(el);
    if (parts[0] === 'rv') return renderRepVolume(el, parts[1]);
    if (parts[0] === 'day') return renderDayDetail(el, parts[1]);
    renderHome(el);
  }

  function volume(log) {
    return log.sets.reduce(function (t, s) { return t + (s.weight || 0) * (s.reps || 0); }, 0);
  }

  function shortDMY(iso) {
    var p = iso.split('-');
    return parseInt(p[2], 10) + '/' + parseInt(p[1], 10) + '/' + p[0].slice(2);
  }

  /* ---- home: 4 cards ---- */
  function renderHome(el) {
    el.appendChild(UI.header({ title: 'Retro' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    Promise.all([DB.all('logs'), DB.all('walks')]).then(function (res) {
      var logs = res[0], walks = res[1];
      /* lowest - current week (7d, blue) - highest across the
         7-day count, 4-week average and 8-week average */
      function trio(rows) {
        var dates = {};
        rows.forEach(function (r) { dates[r.date] = 1; });
        var keys = Object.keys(dates);
        function isoDaysAgo(n) {
          var d = new Date();
          d.setDate(d.getDate() - n);
          return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
        function within(days) {
          var since = isoDaysAgo(days);
          return keys.filter(function (d) { return d >= since; }).length;
        }
        var cur = within(7), w4 = within(28) / 4, w8 = within(56) / 8;
        var arrow = cur > w4 + 0.05 ? '<span class="arr up">\u2191</span>'
                  : cur < w4 - 0.05 ? '<span class="arr down">\u2193</span>'
                  : '<span class="arr flat">\u2192</span>';
        return '<span class="t2"><b>' + w8.toFixed(1) + '</b><i>8wk</i></span>' +
               '<span class="t2"><b>' + w4.toFixed(1) + '</b><i>4wk</i></span>' +
               '<span class="t2 cur"><b>' + cur + arrow + '</b><i>this wk</i></span>';
      }

      var bg = (DB.getSettings().cardBg) || {};
      function card(href, title, sub, strip, bgKey) {
        var c;
        if (strip) {
          /* stat card: numbers right-aligned as a trend timeline */
          c = UI.el('<div class="card stat-flex"><div class="stat-left">' +
            '<h2>' + UI.esc(title) + '</h2><div class="sub">' + UI.esc(sub) + '</div></div>' +
            '<div class="trio2">' + strip + '</div></div>');
        } else {
          c = UI.el('<a href="' + href + '" class="card">' +
            '<h2>' + UI.esc(title) + '</h2><div class="sub">' + UI.esc(sub) + '</div>' +
            '<span class="count-badge">' + UI.icon('chev') + '</span></a>');
        }
        if (bgKey) {
          c.classList.add('has-bg');
          c.style.backgroundImage = 'url(' + (bg[bgKey] || 'assets/cardbg/' + bgKey + '.jpg') + ')';
        }
        pad.appendChild(c);
      }
      card('#/retro/cal', 'Workout day', 'Calendar — days colored by main muscle trained', null, 'retro-cal');
      card('#/retro/rv', 'Progressive Rep-Vol Trend', 'Weekly working-set volume per exercise', null, 'retro-rv');
      card(null, 'Weight training', '(day / week)', trio(logs), 'retro-wt');
      card(null, 'Incline walk', '(day / week)', trio(walks), 'retro-iw');
    });
  }

  /* ---- Workout day calendar ----
     Current month on top; slide down for past months. Day circles take the
     color of the highest-priority (largest) muscle trained that day. */
  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function renderCalendar(el) {
    el.appendChild(UI.header({ title: 'Workout day', back: '#/retro' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    Promise.all([DB.all('logs'), DB.all('exercises')]).then(function (res) {
      var logs = res[0], allX = res[1];
      var xById = {};
      allX.forEach(function (x) { xById[x.id] = x; });
      var rank = {};
      DB.CATEGORIES.forEach(function (c, i) { rank[c.id] = i; });
      /* date → highest-priority category trained that day */
      var dayCat = {};
      logs.forEach(function (l) {
        var x = xById[l.exerciseId];
        if (!x) return;
        var cur = dayCat[l.date];
        if (cur == null || rank[x.categoryId] < rank[cur]) dayCat[l.date] = x.categoryId;
      });

      var today = DB.todayISO();
      var cursor = new Date();
      cursor.setDate(1);
      for (var m = 0; m < 12; m++) {
        pad.appendChild(monthCard(cursor.getFullYear(), cursor.getMonth(), dayCat, today));
        cursor.setMonth(cursor.getMonth() - 1);
      }
      pad.appendChild(UI.el('<p class="sub" style="text-align:center">Tap a day to view, correct or add records</p>'));
    });
  }

  function monthCard(year, month, dayCat, today) {
    var card = UI.el('<div class="card"></div>');
    card.appendChild(UI.el('<h2 style="font-size:1.02rem">' + MONTHS_FULL[month] + ' ' + year + '</h2>'));
    card.appendChild(UI.el('<div class="cal-head">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>'));
    var grid = UI.el('<div class="cal-grid"></div>');
    var firstDow = new Date(year, month, 1).getDay();
    var dim = new Date(year, month + 1, 0).getDate();
    for (var i = 0; i < firstDow; i++) grid.appendChild(UI.el('<button class="cal-day off" tabindex="-1">·</button>'));
    for (var d = 1; d <= dim; d++) {
      var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var cat = dayCat[iso];
      var cls = 'cal-day' + (cat ? ' has' : '') + (iso === today ? ' today' : '');
      var btn = UI.el('<button class="' + cls + '" data-date="' + iso + '">' + d + '</button>');
      if (cat) btn.style.background = (DB.catById(cat) || {}).color || 'var(--accent)';
      btn.addEventListener('click', function (e) {
        location.hash = '#/retro/day/' + e.currentTarget.dataset.date;
      });
      grid.appendChild(btn);
    }
    card.appendChild(grid);
    return card;
  }

  /* ---- day detail: records of one date, edit / add / delete ---- */
  function renderDayDetail(el, date) {
    el.appendChild(UI.header({ title: UI.fmtDate(date), back: '#/retro/cal' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var wrap = UI.el('<div></div>');
    pad.appendChild(wrap);

    var xById = {};
    function draw() {
      wrap.innerHTML = '';
      Promise.all([DB.byIndex('logs', 'date', date), DB.all('exercises')]).then(function (res) {
        var logs = res[0], allX = res[1];
        allX.forEach(function (x) { xById[x.id] = x; });
        if (!logs.length) {
          wrap.appendChild(UI.emptyState('No records this day', 'Tap + to add one'));
          return;
        }
        logs.forEach(function (l) {
          var x = xById[l.exerciseId];
          var card = UI.el('<div class="card"></div>');
          card.appendChild(UI.el('<h2 style="font-size:1.02rem;padding-right:72px">' + UI.esc(x ? x.name : '(deleted exercise)') + '</h2>'));
          var sc = UI.el('<div class="rec-scroll"></div>');
          sc.appendChild(UI.el('<table class="rec-table rec-past"><tbody>' +
            '<tr><th>Wt</th>' + l.sets.slice(0, 15).map(function (s) { return '<td>' + Math.round(s.weight) + '</td>'; }).join('') + '</tr>' +
            '<tr><th>Rep</th>' + l.sets.slice(0, 15).map(function (s) { return '<td>' + Math.round(s.reps) + '</td>'; }).join('') + '</tr>' +
            '</tbody></table>'));
          card.appendChild(sc);
          card.appendChild(UI.el('<div class="sub" style="margin-top:6px">Volume: ' + Math.round(volume(l)).toLocaleString('en') + ' kg·reps</div>'));

          var btns = UI.el('<div style="position:absolute;top:10px;right:8px;display:flex"></div>');
          var ed = UI.el('<button class="btn-icon" aria-label="edit">' + UI.icon('edit') + '</button>');
          ed.addEventListener('click', function () { editLog(l, draw); });
          var del = UI.el('<button class="btn-icon" aria-label="delete">' + UI.icon('trash') + '</button>');
          del.addEventListener('click', function () {
            UI.confirm('Delete this record?', 'Delete').then(function (ok) {
              if (ok) DB.del('logs', l.id).then(draw);
            });
          });
          btns.appendChild(ed);
          btns.appendChild(del);
          card.appendChild(btns);
          wrap.appendChild(card);
        });
      });
    }

    el.appendChild(UI.fab('Add record', function () {
      DB.all('exercises').then(function (allX) {
        UI.pickExercise(allX, function (x) { addLogForm(x, date, draw); });
      });
    }));
    draw();
  }

  function editLog(l, onDone) {
    var today = DB.todayISO();
    var t = UI.recTable(l.sets);
    var body = UI.el('<div>' + UI.field('Date (past or today only)', '<input type="date" id="el-date" value="' + l.date + '" max="' + today + '">') + '</div>');
    body.appendChild(t.root);
    UI.modal('Correct record', body, [
      { label: 'Cancel' },
      {
        label: 'Save', primary: true, onClick: function (close) {
          var date = body.querySelector('#el-date').value;
          if (!date) { UI.toast('Pick a date'); return; }
          if (date > today) { UI.toast('Future dates are not allowed'); return; }
          var sets = t.getSets();
          if (!sets.length) { UI.toast('Enter at least one set'); return; }
          l.date = date;
          l.sets = sets;
          DB.put('logs', l).then(function () { UI.toast('Corrected'); close(); onDone && onDone(); });
        }
      }
    ]);
  }

  function addLogForm(x, date, onDone) {
    var today = DB.todayISO();
    /* prefill from the last record of this exercise */
    DB.byIndex('logs', 'exerciseId', x.id).then(function (history) {
      history.sort(function (a, b) { return a.date.localeCompare(b.date); });
      var last = history[history.length - 1];
      var t = UI.recTable(last ? last.sets : [], { minCols: 4 });
      var body = UI.el('<div>' + UI.field('Date (past or today only)', '<input type="date" id="al-date" value="' + (date <= today ? date : today) + '" max="' + today + '">') + '</div>');
      body.appendChild(t.root);
      UI.modal(x.name, body, [
        { label: 'Cancel' },
        {
          label: 'Save', primary: true, onClick: function (close) {
            var d = body.querySelector('#al-date').value;
            if (!d) { UI.toast('Pick a date'); return; }
            if (d > today) { UI.toast('Future dates are not allowed'); return; }
            var sets = t.getSets();
            if (!sets.length) { UI.toast('Enter at least one set'); return; }
            DB.put('logs', { id: DB.uid(), exerciseId: x.id, programId: null, dayNo: null, date: d, sets: sets, note: '' })
              .then(function () { UI.toast('Record added'); close(); onDone && onDone(); });
          }
        }
      ]);
    });
  }

  /* ---- Progressive Rep-Volume trend ----
     Weekly average of working-set volume: per record, mean of set 3 and
     set 4 volume (weight × reps); if only 3 sets, set 3 alone. Records with
     fewer than 3 sets are skipped. X axis: weeks (week start date). */
  function renderRepVolume(el, xid) {
    el.appendChild(UI.header({ title: 'Progressive Rep-Vol Trend', back: '#/retro' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    Promise.all([DB.all('logs'), DB.all('exercises')]).then(function (res) {
      var logs = res[0], allX = res[1];
      var withLogs = {};
      logs.forEach(function (l) { withLogs[l.exerciseId] = 1; });
      var options = allX.filter(function (x) { return withLogs[x.id]; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
      if (!options.length) {
        pad.appendChild(UI.emptyState('No workout records yet', 'Log sets from Program first'));
        return;
      }
      var sel = UI.el('<select style="margin-bottom:12px">' + options.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === xid ? ' selected' : '') + '>' + UI.esc(x.name) + '</option>';
      }).join('') + '</select>');
      pad.appendChild(sel);
      var chartWrap = UI.el('<div></div>');
      pad.appendChild(chartWrap);
      var rowsWrap = UI.el('<div></div>');
      pad.appendChild(rowsWrap);
      sel.addEventListener('change', function () { drawChart(sel.value); drawRows(sel.value); });

      /* past records of the selected exercise — same pattern as Program */
      function drawRows(id) {
        rowsWrap.innerHTML = '';
        var rows = logs.filter(function (l) { return l.exerciseId === id; });
        rows.sort(function (a, b) { return b.date.localeCompare(a.date); });
        rows.slice(0, 12).forEach(function (l) {
          rowsWrap.appendChild(UI.recPastRow(l, function () {
            logs = logs.filter(function (q) { return q.id !== l.id; });
            drawChart(id);
            drawRows(id);
          }));
        });
      }

      function weekStart(iso) {
        var d = new Date(iso + 'T00:00:00');
        d.setDate(d.getDate() - d.getDay());
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }

      function drawChart(id) {
        chartWrap.innerHTML = '';
        var weeks = {};
        logs.filter(function (l) { return l.exerciseId === id; }).forEach(function (l) {
          var s = l.sets;
          var metric = null;
          if (s.length >= 4) metric = (s[2].weight * s[2].reps + s[3].weight * s[3].reps) / 2;
          else if (s.length === 3) metric = s[2].weight * s[2].reps;
          if (metric == null || !isFinite(metric)) return;
          var wk = weekStart(l.date);
          (weeks[wk] = weeks[wk] || []).push(metric);
        });
        var keys = Object.keys(weeks).sort();
        if (!keys.length) {
          chartWrap.appendChild(UI.emptyState('Not enough data', 'This chart needs records with at least 3 sets'));
          return;
        }
        var points = keys.slice(-16).map(function (k) {
          var arr = weeks[k];
          var avg = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
          return { x: shortDMY(k).replace(/\/\d+$/, ''), y: Math.round(avg) };
        });
        chartWrap.appendChild(UI.lineChart(points, {}));
        chartWrap.appendChild(UI.el('<p class="sub" style="text-align:center">Avg volume of working sets 3–4 (kg × reps), per week</p>'));
      }
      var initId = xid || options[0].id;
      drawChart(initId);
      drawRows(initId);
    });
  }

  return { render: render };
})();
