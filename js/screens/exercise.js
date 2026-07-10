/* Alef.Fit — Exercise tab: category grid → list → detail; add/edit. */
'use strict';

window.Screens = window.Screens || {};

Screens.exercise = (function () {

  function render(el, parts) {
    if (!parts.length) return renderCats(el);
    if (parts[0] === 'cat') return renderList(el, parts[1]);
    if (parts[0] === 'x') return renderDetail(el, parts[1]);
    renderCats(el);
  }

  /* ---- category grid ---- */
  function renderCats(el) {
    el.appendChild(UI.header({ title: 'Exercise' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    DB.all('exercises').then(function (rows) {
      var counts = {};
      rows.forEach(function (r) { counts[r.categoryId] = (counts[r.categoryId] || 0) + 1; });
      var bg = (DB.getSettings().cardBg) || {};
      DB.CATEGORIES.forEach(function (c) {
        /* prototype-style image card: bundled artwork by default, the
           user's own photo from Setting → Card backgrounds overrides */
        var card = UI.el('<a class="card cat-card has-bg" href="#/exercise/cat/' + c.id + '">' +
          '<h2 style="color:' + c.color + '">' + UI.esc(c.name) + '</h2>' +
          '<div class="sub">' + (counts[c.id] || 0) + ' exercises</div>' +
          '<span class="count-badge">' + UI.icon('chev') + '</span></a>');
        card.style.backgroundImage = 'url(' + (bg['cat-' + c.id] || 'assets/catbg/' + c.id + '.jpg') + ')';
        pad.appendChild(card);
      });
    });
  }

  /* ---- exercise list in a category ---- */
  function renderList(el, catId) {
    var cat = DB.catById(catId) || { name: catId };
    el.appendChild(UI.header({ title: cat.name, back: '#/exercise' }));
    var pad = UI.el('<div class="pagepad"></div>');
    el.appendChild(pad);
    var search = UI.el('<input class="searchbar" type="text" placeholder="Search ' + UI.esc(cat.name) + '…">');
    pad.appendChild(search);
    var listWrap = UI.el('<div></div>');
    pad.appendChild(listWrap);

    var all = [];
    function draw() {
      listWrap.innerHTML = '';
      var q = search.value.trim().toLowerCase();
      var rows = all.filter(function (r) { return !q || r.name.toLowerCase().indexOf(q) >= 0; });
      if (!rows.length) { listWrap.appendChild(UI.emptyState('No exercises', 'Tap + to add one')); return; }
      var list = UI.el('<div class="list"></div>');
      rows.sort(function (a, b) { return a.name.localeCompare(b.name); }).forEach(function (r) {
        var thumb = firstImage(r);
        var item = UI.el('<button class="list-item">' +
          (thumb ? '<img class="li-thumb" src="' + thumb + '" alt="">' : '<span class="li-thumb">' + UI.icon('muscle') + '</span>') +
          '<span class="li-main"><span class="li-title">' + UI.esc(r.name) + '</span>' +
          '<span class="li-sub">' + UI.esc((r.muscles || []).join(', ')) + '</span></span>' +
          '<span class="chev">' + UI.icon('chev') + '</span></button>');
        item.addEventListener('click', function () { location.hash = '#/exercise/x/' + r.id; });
        list.appendChild(item);
      });
      listWrap.appendChild(list);
    }
    search.addEventListener('input', draw);
    DB.byIndex('exercises', 'categoryId', catId).then(DB.hydrateExMedia).then(function (rows) { all = rows; draw(); });

    el.appendChild(UI.fab('Add exercise', function () {
      editForm(null, catId, function (saved) { location.hash = '#/exercise/x/' + saved.id; });
    }));
  }

  function firstImage(r) {
    var media = r.media || [];
    if (r.coverIndex != null && media[r.coverIndex] && media[r.coverIndex].type === 'image') {
      return media[r.coverIndex].dataUrl;
    }
    var m = media.find(function (m) { return m.type === 'image'; });
    return m ? m.dataUrl : null;
  }

  /* ---- detail ---- */
  function renderDetail(el, id) {
    DB.get('exercises', id).then(function (r) {
      return r ? DB.hydrateExMedia(r) : r;
    }).then(function (r) {
      if (!r) { el.appendChild(UI.emptyState('Exercise not found')); return; }
      var cat = DB.catById(r.categoryId) || { name: '' };
      el.appendChild(UI.header({
        title: r.name, back: '#/exercise/cat/' + r.categoryId,
        action: { icon: 'edit', label: 'Edit', onClick: function () { editForm(r, r.categoryId, function () { App.route(); }); } }
      }));
      var pad = UI.el('<div class="pagepad"></div>');
      el.appendChild(pad);

      var mediaWrap = UI.el('<div class="media-wrap"></div>');
      var media = UI.el('<div class="media-strip"></div>');
      (r.media || []).forEach(function (m) {
        var node;
        if (m.type === 'image') node = UI.el('<img src="' + m.dataUrl + '" alt="">');
        else {
          node = document.createElement('video');
          node.src = m.dataUrl; node.controls = true; node.playsInline = true;
        }
        media.appendChild(UI.cropWrap(node, m.crop));
      });
      mediaWrap.appendChild(media);
      if ((r.media || []).length) {
        /* cycle media display size S → M → L (global setting) */
        var szBtn = UI.el('<button class="size-cycle" aria-label="media size">⤢</button>');
        szBtn.addEventListener('click', function () {
          var order = ['s', 'm', 'l'];
          var next = order[(order.indexOf(DB.getSettings().mediaSize || 'm') + 1) % 3];
          DB.saveSettings({ mediaSize: next }).then(App.applySettings);
        });
        mediaWrap.appendChild(szBtn);
      }
      pad.appendChild(mediaWrap);

      pad.appendChild(UI.el('<div class="section-title">Muscle</div>'));
      pad.appendChild(UI.el('<div class="card"><div>' + UI.esc((r.muscles || []).join(', ') || '—') + '</div>' +
        '<div class="sub">' + UI.esc(cat.name) + '</div></div>'));

      pad.appendChild(UI.el('<div class="section-title">How to do / Technique</div>'));
      var stepsCard = UI.el('<div class="card"></div>');
      if ((r.steps || []).length) {
        var ol = UI.el('<ol class="steps"></ol>');
        r.steps.forEach(function (s) { ol.appendChild(UI.el('<li>' + UI.esc(s) + '</li>')); });
        stepsCard.appendChild(ol);
      } else stepsCard.appendChild(UI.el('<p class="sub">No technique notes yet.</p>'));
      pad.appendChild(stepsCard);

      var delBtn = UI.el('<button class="btn btn-danger btn-block">' + UI.icon('trash') + ' Delete exercise</button>');
      delBtn.addEventListener('click', function () {
        UI.confirm('Delete "' + r.name + '"? Its history logs stay but lose their link.', 'Delete').then(function (ok) {
          if (!ok) return;
          DB.del('exercises', r.id).then(function () {
            UI.toast('Deleted');
            location.hash = '#/exercise/cat/' + r.categoryId;
          });
        });
      });
      pad.appendChild(delBtn);
    });
  }

  /* ---- crop editor: pick the visible area of an image / video ----
     Useful when a video's framing doesn't fit the app. Drag the box to
     move it, drag a corner to resize. onDone(crop|null) — null clears. */
  function cropEditor(m, onDone) {
    var isVid = m.type === 'video';
    var stage = UI.el('<div class="crop-stage"></div>');
    var node;
    if (isVid) {
      node = document.createElement('video');
      node.src = m.dataUrl; node.muted = true; node.loop = true;
      node.autoplay = true; node.playsInline = true; node.setAttribute('playsinline', '');
      var pr = node.play && node.play();
      if (pr && pr.catch) pr.catch(function () { /* plays on tap */ });
    } else {
      node = UI.el('<img src="' + m.dataUrl + '" alt="">');
    }
    stage.appendChild(node);

    var rect = UI.el('<div class="crop-rect">' +
      ['nw', 'ne', 'sw', 'se'].map(function (h) { return '<span class="ch ch-' + h + '" data-h="' + h + '"></span>'; }).join('') +
      '</div>');
    stage.appendChild(rect);

    var c = m.crop ? { x: m.crop.x, y: m.crop.y, w: m.crop.w, h: m.crop.h }
                   : { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
    function layout() {
      rect.style.left = (c.x * 100) + '%';
      rect.style.top = (c.y * 100) + '%';
      rect.style.width = (c.w * 100) + '%';
      rect.style.height = (c.h * 100) + '%';
    }
    layout();

    var MIN = 0.08, drag = null;
    rect.addEventListener('pointerdown', function (e) {
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      drag = {
        mode: e.target.dataset && e.target.dataset.h || 'move',
        sx: e.clientX, sy: e.clientY, rw: r.width, rh: r.height,
        c0: { x: c.x, y: c.y, w: c.w, h: c.h }
      };
      if (rect.setPointerCapture) { try { rect.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } }
      e.preventDefault();
    });
    rect.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = (e.clientX - drag.sx) / drag.rw;
      var dy = (e.clientY - drag.sy) / drag.rh;
      var o = drag.c0;
      if (drag.mode === 'move') {
        c.x = Math.min(Math.max(0, o.x + dx), 1 - o.w);
        c.y = Math.min(Math.max(0, o.y + dy), 1 - o.h);
      } else {
        var x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (drag.mode.indexOf('w') >= 0) x1 = Math.min(Math.max(0, x1 + dx), x2 - MIN);
        if (drag.mode.indexOf('e') >= 0) x2 = Math.max(Math.min(1, x2 + dx), x1 + MIN);
        if (drag.mode.indexOf('n') >= 0) y1 = Math.min(Math.max(0, y1 + dy), y2 - MIN);
        if (drag.mode.indexOf('s') >= 0) y2 = Math.max(Math.min(1, y2 + dy), y1 + MIN);
        c.x = x1; c.y = y1; c.w = x2 - x1; c.h = y2 - y1;
      }
      layout();
    });
    rect.addEventListener('pointerup', function () { drag = null; });
    rect.addEventListener('pointercancel', function () { drag = null; });

    var body = UI.el('<div></div>');
    body.appendChild(stage);
    body.appendChild(UI.el('<p class="sub" style="margin:8px 0 0">Only the area inside the box will show in the app. Drag the box to move it; drag a corner to resize.</p>'));

    function natSize() {
      var w = isVid ? node.videoWidth : node.naturalWidth;
      var h = isVid ? node.videoHeight : node.naturalHeight;
      return (w && h) ? { w: w, h: h } : { w: 16, h: 9 };
    }
    var buttons = [{ label: 'Cancel' }];
    if (m.crop) buttons.push({
      label: 'Show all', onClick: function (close) { close(); onDone(null); }
    });
    buttons.push({
      label: 'Apply', primary: true, onClick: function (close) {
        close();
        if (c.x <= 0.005 && c.y <= 0.005 && c.w >= 0.99 && c.h >= 0.99) return onDone(null);
        var nat = natSize();
        onDone({
          x: Math.round(c.x * 1000) / 1000, y: Math.round(c.y * 1000) / 1000,
          w: Math.round(c.w * 1000) / 1000, h: Math.round(c.h * 1000) / 1000,
          ar: Math.round(((c.w * nat.w) / (c.h * nat.h)) * 1000) / 1000
        });
      }
    });
    UI.modal('Crop — show only part', body, buttons);
  }

  /* ---- add / edit form ---- */
  function editForm(existing, catId, onSaved) {
    var r = existing || { id: DB.uid(), categoryId: catId || 'chest', name: '', muscles: [], steps: [], media: [], createdAt: Date.now() };
    var catOpts = DB.CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === r.categoryId ? ' selected' : '') + '>' + c.name + '</option>';
    }).join('');
    var body = UI.el('<div>' +
      UI.field('Name', '<input type="text" id="xf-name" value="' + UI.esc(r.name) + '" placeholder="e.g. Incline Bench Sit-Ups">') +
      UI.field('Body part', '<select id="xf-cat">' + catOpts + '</select>') +
      UI.field('Muscles (comma-separated)', '<input type="text" id="xf-mus" value="' + UI.esc((r.muscles || []).join(', ')) + '" placeholder="e.g. Rectus Abdominis">') +
      UI.field('Technique — one step per line', '<textarea id="xf-steps" placeholder="Step 1…&#10;Step 2…">' + UI.esc((r.steps || []).join('\n')) + '</textarea>') +
      '<div class="field"><span class="field-label">Media (photo / mp4 video)</span>' +
      '<div class="media-strip" id="xf-media"></div>' +
      '<button class="btn" id="xf-add-media" type="button">' + UI.icon('camera') + ' Add photo/video</button>' +
      '<input type="file" id="xf-file" accept="image/*,video/mp4" class="hidden" multiple></div>' +
      '</div>');

    var media = (r.media || []).slice();
    var coverIdx = r.coverIndex != null ? r.coverIndex : null;
    function drawMedia() {
      var strip = body.querySelector('#xf-media');
      strip.innerHTML = '';
      media.forEach(function (m, i) {
        var wrap = UI.el('<div class="media-thumb"></div>');
        wrap.appendChild(m.type === 'image' ? UI.el('<img src="' + m.dataUrl + '" alt="">') : UI.el('<video src="' + m.dataUrl + '"></video>'));
        var btns = UI.el('<div class="mt-btns">' +
          (m.type === 'image' ? '<button type="button" data-a="cover" class="' + (coverIdx === i ? 'on' : '') + '" aria-label="use as cover" title="Use as cover">★</button>' : '') +
          '<button type="button" data-a="crop" class="' + (m.crop ? 'on' : '') + '" aria-label="crop" title="Show only part of this media">⧉</button>' +
          '<button type="button" data-a="rm" aria-label="remove" title="Remove">✕</button></div>');
        var cv = btns.querySelector('[data-a=cover]');
        if (cv) cv.addEventListener('click', function () {
          coverIdx = coverIdx === i ? null : i;
          drawMedia();
        });
        btns.querySelector('[data-a=crop]').addEventListener('click', function () {
          cropEditor(m, function (crop) {
            if (crop) m.crop = crop; else delete m.crop;
            drawMedia();
          });
        });
        btns.querySelector('[data-a=rm]').addEventListener('click', function () {
          media.splice(i, 1);
          if (coverIdx === i) coverIdx = null;
          else if (coverIdx != null && coverIdx > i) coverIdx--;
          drawMedia();
        });
        wrap.appendChild(btns);
        strip.appendChild(wrap);
      });
    }
    drawMedia();
    body.querySelector('#xf-add-media').addEventListener('click', function () { body.querySelector('#xf-file').click(); });
    body.querySelector('#xf-file').addEventListener('change', function (e) {
      Array.prototype.forEach.call(e.target.files, function (f) {
        UI.fileToDataUrl(f).then(function (dataUrl) {
          media.push({ type: /^video\//.test(f.type) ? 'video' : 'image', dataUrl: dataUrl, name: f.name });
          drawMedia();
        }).catch(function () { UI.toast('Could not read ' + f.name); });
      });
      e.target.value = '';
    });

    UI.modal(existing ? 'Edit exercise' : 'New exercise', body, [
      { label: 'Cancel' },
      {
        label: 'Save', primary: true, onClick: function (close) {
          var name = body.querySelector('#xf-name').value.trim();
          if (!name) { UI.toast('Name is required'); return; }
          r.name = name;
          r.categoryId = body.querySelector('#xf-cat').value;
          r.muscles = body.querySelector('#xf-mus').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
          r.steps = body.querySelector('#xf-steps').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
          r.coverIndex = coverIdx;
          DB.internExMedia(media).then(function (list) {
            r.media = list;
            return DB.put('exercises', r);
          }).then(function () {
            UI.toast('Saved');
            close();
            onSaved && onSaved(r);
          });
        }
      }
    ]);
  }

  return { render: render, editForm: editForm, firstImage: firstImage };
})();
