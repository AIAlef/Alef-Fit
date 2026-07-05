/* Alef.Fit — shared UI helpers. */
'use strict';

var UI = (function () {

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* Dates — always CE (Gregorian). */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function fmtDateTime(iso, time) { return fmtDate(iso) + (time ? ' · ' + time : ''); }

  /* ---- icons (inline SVG, stroke = currentColor) ---- */
  var I = {
    dumbbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a2 2 0 0 1 6 0M9 11l2 2 4-4"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 15h3M13 15h3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3 1 2-3.5-2-1.5c.06-.4.1-.8.1-1.2z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11l3 3v13H5z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0"/></svg>',
    scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M7 21h10a2 2 0 0 0 2-2l-1.5-12h-11L5 19a2 2 0 0 0 2 2zM9 10a3 3 0 0 0 6 0"/></svg>',
    walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="4.5" r="2"/><path d="M13 8l-2.2 5.5 2.7 3 .9 4.5M10.8 13.5l-2.6 1.7M13.3 9.2l2.9 1.6 2.5-.6M12.6 16l-3 4.5"/></svg>',
    todo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
    muscle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h4l2 5-3 2c1.5 3 5 5 8 5l1 3c-5 2-11 0-14-5S4 6 7 4z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5M4 20h16"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3M20 16V6"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
    funnel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5z"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h8M16 6h4M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="14" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    stack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/></svg>'
  };
  function icon(name, cls) { return '<span class="icon ' + (cls || '') + '">' + (I[name] || '') + '</span>'; }

  /* ---- layout pieces ---- */
  function header(opts) {
    // opts: {title, back(href), action:{icon,label,onClick}}
    var h = el('<header class="topbar">' +
      (opts.back ? '<a class="topbar-back" href="' + opts.back + '">' + icon('back') + '</a>' : '<span class="topbar-spacer"></span>') +
      '<h1>' + esc(opts.title) + '</h1>' +
      '<span class="topbar-action"></span></header>');
    if (opts.action) {
      var b = el('<button class="btn-icon" aria-label="' + esc(opts.action.label || '') + '">' + icon(opts.action.icon) + '</button>');
      b.addEventListener('click', opts.action.onClick);
      h.querySelector('.topbar-action').appendChild(b);
    }
    return h;
  }

  function emptyState(msg, hint) {
    return el('<div class="empty"><span class="empty-icon">' + icon('dumbbell') + '</span>' +
      '<p>' + esc(msg) + '</p>' + (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') + '</div>');
  }

  function fab(label, onClick) {
    var b = el('<button class="fab" aria-label="' + esc(label) + '">' + icon('plus') + '</button>');
    b.addEventListener('click', onClick);
    return b;
  }

  function toast(msg) {
    var t = el('<div class="toast">' + esc(msg) + '</div>');
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 2200);
  }

  function modal(title, bodyEl, buttons) {
    // buttons: [{label, primary, danger, onClick(close)}]
    var wrap = el('<div class="modal-wrap"><div class="modal"><div class="modal-title">' + esc(title) + '</div><div class="modal-body"></div><div class="modal-btns"></div></div></div>');
    wrap.querySelector('.modal-body').appendChild(bodyEl);
    function close() { wrap.remove(); }
    (buttons || [{ label: 'OK', primary: true }]).forEach(function (b) {
      var btn = el('<button class="btn ' + (b.primary ? 'btn-primary' : '') + (b.danger ? ' btn-danger' : '') + '">' + esc(b.label) + '</button>');
      btn.addEventListener('click', function () { b.onClick ? b.onClick(close) : close(); });
      wrap.querySelector('.modal-btns').appendChild(btn);
    });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
    return { close: close, root: wrap };
  }

  function confirmDlg(msg, okLabel) {
    return new Promise(function (resolve) {
      modal('Confirm', el('<p>' + esc(msg) + '</p>'), [
        { label: 'Cancel', onClick: function (close) { close(); resolve(false); } },
        { label: okLabel || 'OK', danger: true, onClick: function (close) { close(); resolve(true); } }
      ]);
    });
  }

  /* ---- forms ---- */
  function field(label, inputHtml) {
    return '<label class="field"><span class="field-label">' + esc(label) + '</span>' + inputHtml + '</label>';
  }

  /* Wrap an <img>/<video> so only the selected area of the frame shows.
     crop = {x, y, w, h, ar} — fractions (0..1) of the source frame plus the
     aspect ratio of the cropped region. No crop → element returned as-is. */
  function cropWrap(node, crop) {
    if (!crop || !crop.w || !crop.h) return node;
    var box = el('<div class="crop-box"></div>');
    var ar = crop.ar || 1.78;
    box.style.aspectRatio = String(ar);
    box.style.setProperty('--ar', String(ar));
    node.style.width = (100 / crop.w) + '%';
    node.style.height = (100 / crop.h) + '%';
    node.style.left = (-(crop.x / crop.w) * 100) + '%';
    node.style.top = (-(crop.y / crop.h) * 100) + '%';
    box.appendChild(node);
    return box;
  }

  /* Image file → dataURL, downscaled per settings.imageQuality. */
  function fileToDataUrl(file) {
    var q = (DB.getSettings() || {}).imageQuality || 'normal';
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        if (q === 'original' || !/^image\//.test(file.type)) return resolve(fr.result);
        var img = new Image();
        img.onload = function () {
          var max = q === 'low' ? 900 : 1600;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          if (scale >= 1) return resolve(fr.result);
          var cv = document.createElement('canvas');
          cv.width = Math.round(img.width * scale);
          cv.height = Math.round(img.height * scale);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', q === 'low' ? 0.6 : 0.8));
        };
        img.onerror = reject;
        img.src = fr.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* Simple SVG line chart for weight/volume trends. */
  function lineChart(points, opts) {
    // points: [{x: label, y: number}], opts: {height, unit}
    opts = opts || {};
    var W = 640, H = opts.height || 220, P = 34;
    if (!points.length) return emptyState('No data yet');
    var ys = points.map(function (p) { return p.y; });
    var min = Math.min.apply(null, ys), max = Math.max.apply(null, ys);
    if (min === max) { min -= 1; max += 1; }
    var pad = (max - min) * 0.1; min -= pad; max += pad;
    function px(i) { return P + (W - 2 * P) * (points.length === 1 ? 0.5 : i / (points.length - 1)); }
    function py(v) { return H - P - (H - 2 * P) * ((v - min) / (max - min)); }
    var path = points.map(function (p, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(p.y).toFixed(1); }).join(' ');
    var area = path + ' L' + px(points.length - 1).toFixed(1) + ' ' + (H - P) + ' L' + px(0).toFixed(1) + ' ' + (H - P) + ' Z';
    var dots = points.map(function (p, i) { return '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(p.y).toFixed(1) + '" r="3.5" class="chart-dot"/>'; }).join('');
    var labels = '';
    var step = Math.max(1, Math.ceil(points.length / 6));
    points.forEach(function (p, i) {
      if (i % step === 0 || i === points.length - 1)
        labels += '<text x="' + px(i).toFixed(1) + '" y="' + (H - 8) + '" class="chart-label" text-anchor="middle">' + esc(p.x) + '</text>';
    });
    var yTop = '<text x="4" y="' + (py(max - pad) + 4).toFixed(1) + '" class="chart-label">' + (max - pad).toFixed(1) + '</text>';
    var yBot = '<text x="4" y="' + (py(min + pad) + 4).toFixed(1) + '" class="chart-label">' + (min + pad).toFixed(1) + '</text>';
    return el('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      '<path d="' + area + '" class="chart-area"/>' +
      '<path d="' + path + '" class="chart-line"/>' + dots + labels + yTop + yBot + '</svg>');
  }

  /* Compact set-record table (prototype pattern). Sets are columns with a
     Wt row and a Rep row. Prefilled values (opts.ghost) render grey; typing
     takes over the slot, clicking away keeps the inherited value, deleting
     must be done by hand. Weight formats to 1 decimal, reps to integer.
     opts.onChange fires on typing and on blur (for autosave). */
  function recTable(initialSets, opts) {
    opts = opts || {};
    var root = el('<div class="rec-scroll"><table class="rec-table"><tbody>' +
      '<tr class="rec-w"><th>Wt</th></tr>' +
      '<tr class="rec-r"><th>Rep</th></tr></tbody></table></div>');
    var wRow = root.querySelector('.rec-w'), rRow = root.querySelector('.rec-r');
    /* integers only, max 3 digits, for both Wt and Rep */
    function fmtInt(v) {
      var n = Math.round(parseFloat(v));
      return isFinite(n) && n !== 0 ? String(n).slice(0, 3) : (n === 0 ? '0' : '');
    }
    function fire() { if (opts.onChange) opts.onChange(); }
    var MAX_COLS = opts.maxCols || 15; /* S26 plan: up to 15 sets, slides sideways */
    function addCol(w, r, ghost) {
      if (wRow.querySelectorAll('td').length >= MAX_COLS) return;
      var wtd = el('<td><input type="text" inputmode="numeric" maxlength="3" aria-label="weight kg"></td>');
      var rtd = el('<td><input type="text" inputmode="numeric" maxlength="3" aria-label="reps"></td>');
      var wi = wtd.firstChild, ri = rtd.firstChild;
      if (w != null && w !== '') { wi.value = fmtInt(w); if (ghost) wi.classList.add('ghost'); }
      if (r != null && r !== '') { ri.value = fmtInt(r); if (ghost) ri.classList.add('ghost'); }
      function grow() {
        if (wtd !== wRow.lastElementChild) return;
        if (wi.value !== '' || ri.value !== '') addCol();
      }
      [wi, ri].forEach(function (inp) {
        inp.addEventListener('focus', function () { this.select(); });
        inp.addEventListener('input', function () {
          var v = this.value.replace(/[^0-9]/g, '').slice(0, 3);
          if (v !== this.value) this.value = v;
          this.classList.remove('ghost');
          grow();
          fire();
        });
        inp.addEventListener('blur', function () { fire(); });
      });
      wRow.appendChild(wtd);
      rRow.appendChild(rtd);
    }
    var sets = initialSets || [];
    var cols = Math.min(Math.max(sets.length, opts.minCols || sets.length || 1), MAX_COLS);
    for (var i = 0; i < cols; i++) addCol(sets[i] ? sets[i].weight : '', sets[i] ? sets[i].reps : '', opts.ghost);
    if (sets.length >= cols && cols < MAX_COLS) addCol(); // all filled -> trailing blank slot
    return {
      root: root,
      getSets: function () {
        var ws = wRow.querySelectorAll('input'), rs = rRow.querySelectorAll('input'), out = [];
        for (var k = 0; k < ws.length; k++) {
          var w = parseInt(ws[k].value, 10) || 0;
          var r = parseInt(rs[k].value, 10) || 0;
          if (w > 0 || r > 0) out.push({ weight: w, reps: r });
        }
        return out;
      }
    };
  }

  /* Exercise picker modal: categories → searchable list. */
  function pickExercise(allX, onPick) {
    var body = el('<div><input type="text" class="searchbar" placeholder="Search exercises…"><div id="pk-list"></div></div>');
    var listWrap = body.querySelector('#pk-list');
    var search = body.querySelector('input');
    var m;
    function draw() {
      listWrap.innerHTML = '';
      var q = search.value.trim().toLowerCase();
      DB.CATEGORIES.forEach(function (c) {
        var inCat = allX.filter(function (x) {
          return x.categoryId === c.id && (!q || x.name.toLowerCase().indexOf(q) >= 0);
        });
        if (!inCat.length) return;
        listWrap.appendChild(el('<div class="section-title">' + c.name + '</div>'));
        var list = el('<div class="list"></div>');
        inCat.sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (x) {
          var it = el('<button class="list-item"><span class="li-main"><span class="li-title">' + esc(x.name) + '</span></span>' +
            '<span class="chev">' + icon('chev') + '</span></button>');
          it.addEventListener('click', function () { m.close(); onPick(x); });
          list.appendChild(it);
        });
        listWrap.appendChild(list);
      });
      if (!listWrap.children.length) listWrap.appendChild(emptyState('No match'));
    }
    search.addEventListener('input', draw);
    draw();
    m = modal('Pick exercise', body, [{ label: 'Cancel' }]);
  }

  /* Past-record row: date chip (dd-mm-yyyy) + − delete (confirm) + read-only
     Wt/Rep table. Used by Program logging and Retro Rep-Vol screens. */
  function recPastRow(log, onDeleted) {
    var q = log.date.split('-');
    var dmy = q[2] + '-' + q[1] + '-' + q[0];
    var row = el('<div class="rec-hist"></div>');
    var side = el('<div class="rec-side">' +
      '<div class="rec-date">' + dmy + '</div>' +
      '<button class="rec-del" aria-label="delete record of ' + dmy + '">−</button></div>');
    side.querySelector('.rec-del').addEventListener('click', function () {
      confirmDlg('Delete the record of ' + dmy + '?', 'Delete').then(function (ok) {
        if (!ok) return;
        DB.del('logs', log.id).then(function () {
          toast('Record deleted');
          onDeleted && onDeleted(log);
        });
      });
    });
    row.appendChild(side);
    var sc = el('<div class="rec-scroll"></div>');
    sc.appendChild(el('<table class="rec-table rec-past"><tbody>' +
      '<tr><th>Wt</th>' + log.sets.slice(0, 15).map(function (s) { return '<td>' + Math.round(s.weight) + '</td>'; }).join('') + '</tr>' +
      '<tr><th>Rep</th>' + log.sets.slice(0, 15).map(function (s) { return '<td>' + Math.round(s.reps) + '</td>'; }).join('') + '</tr>' +
      '</tbody></table>'));
    row.appendChild(sc);
    return row;
  }

  /* Fullscreen media viewer. m: {type:'image'|'video', src} */
  function lightbox(m) {
    var w = el('<div class="lightbox"></div>');
    if (m.type === 'video') {
      var v = document.createElement('video');
      v.src = m.src; v.controls = true; v.autoplay = true; v.playsInline = true; v.loop = true;
      w.appendChild(v);
      var pr = v.play && v.play();
      if (pr && pr.catch) pr.catch(function () { /* autoplay blocked */ });
    } else {
      w.appendChild(el('<img src="' + m.src + '" alt="">'));
    }
    var x = el('<button class="lightbox-x" aria-label="close">✕</button>');
    w.appendChild(x);
    function close() { w.remove(); }
    x.addEventListener('click', close);
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    document.body.appendChild(w);
  }

  return {
    esc: esc, el: el, icon: icon, icons: I,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime,
    header: header, emptyState: emptyState, fab: fab, toast: toast,
    modal: modal, confirm: confirmDlg, field: field, cropWrap: cropWrap,
    fileToDataUrl: fileToDataUrl, download: download, lineChart: lineChart,
    recTable: recTable, pickExercise: pickExercise, lightbox: lightbox, recPastRow: recPastRow
  };
})();
