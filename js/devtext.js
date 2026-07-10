/* Alef.Fit — Dev text-edit mode (Setting → Developer).
   Tap any structural app text to override it. Overrides live in meta
   'textOverrides' (synced like data, applied per tab as display overlays;
   user data in the DB is never modified). Export the change file and hand
   it to Claude in Cowork to make the wording permanent in code. */
'use strict';

window.DevText = (function () {
  var map = {};
  var obs = null;
  var loaded = false;
  var applying = false;

  function tab() { return (location.hash || '#/exercise').replace(/^#\//, '').split('/')[0]; }
  function editOn() { return !!((DB.getSettings() || {}).devTextEdit); }

  function init() {
    return DB.get('meta', 'textOverrides').then(function (r) {
      map = (r && r.value) || {};
      loaded = true;
    });
  }
  function save() {
    return DB.put('meta', { key: 'textOverrides', value: map, updatedAt: Date.now() });
  }
  function count() { return Object.keys(map).length; }
  function list() {
    return Object.keys(map).map(function (k) {
      var v = map[k];
      return { key: k, screen: k.split('|')[0], original: v.o, text: v.n, placeholder: !!v.ph };
    });
  }
  function remove(key) {
    delete map[key];
    return save().then(function () { App.route(); });
  }
  function clearAll() {
    map = {};
    return save().then(function () { App.route(); });
  }

  function ownText(el2) {
    var t = '';
    for (var i = 0; i < el2.childNodes.length; i++) {
      var c = el2.childNodes[i];
      if (c.nodeType === 3) t += c.nodeValue;
    }
    return t.trim();
  }

  function applyNode(root) {
    if (!root) return;
    var t = tab();
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach(function (tn) {
      var raw = tn.nodeValue;
      var trimmed = raw.trim();
      if (!trimmed) return;
      var v = map[t + '|' + trimmed];
      if (v && !v.ph) {
        tn.nodeValue = raw.replace(trimmed, v.n);
        if (tn.parentElement) tn.parentElement.dataset.tdKey = t + '|' + trimmed;
      }
    });
    if (root.querySelectorAll) {
      Array.prototype.forEach.call(root.querySelectorAll('input[placeholder], textarea[placeholder]'), function (inp) {
        var orig = inp.dataset.tdOrigPh || inp.placeholder;
        var v = map[t + '|ph:' + orig];
        if (v && v.ph) {
          if (!inp.dataset.tdOrigPh) inp.dataset.tdOrigPh = inp.placeholder;
          inp.placeholder = v.n;
          inp.dataset.tdKey = t + '|ph:' + orig;
        }
      });
    }
  }

  function applyAll() {
    if (!count()) return;
    applying = true;
    applyNode(document.body);
    applying = false;
  }

  function ensureObserver() {
    if (obs || typeof MutationObserver === 'undefined') return;
    obs = new MutationObserver(function (muts) {
      if (applying || !count()) return;
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) { applyAll(); return; }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function badge() {
    var b = document.querySelector('.dev-badge');
    if (editOn()) {
      if (!b) {
        b = UI.el('<div class="dev-badge">TEXT EDIT — tap any text · tap here to stop</div>');
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          DB.saveSettings({ devTextEdit: false }).then(function () {
            badge();
            UI.toast('Text edit mode off');
          });
        });
        document.body.appendChild(b);
      }
    } else if (b) {
      b.remove();
    }
  }

  function sync() {
    if (!loaded) return;
    applyAll();
    ensureObserver();
    badge();
  }

  function openEditor(original, isPh, existingKey, isUserData) {
    var t = tab();
    var k = existingKey || (t + '|' + (isPh ? 'ph:' : '') + original);
    var cur = map[k] ? map[k].n : original;
    var body = UI.el('<div>' +
      '<p class="sub" style="margin:0">Original' + (isPh ? ' (placeholder)' : '') + ' — screen: ' + UI.esc(t) + '</p>' +
      '<p style="margin:4px 0 10px"><b>' + UI.esc(original) + '</b></p>' +
      UI.field('New text', '<input type="text" id="dt-new" value="' + UI.esc(cur) + '">') +
      (isUserData ? '<p class="sub">⚠ This looks like your own data, not app text — the change is a display overlay only.</p>' : '') +
      '</div>');
    var btns = [{ label: 'Cancel' }];
    if (map[k]) {
      btns.push({
        label: 'Reset', onClick: function (close) {
          close();
          delete map[k];
          save().then(function () { App.route(); UI.toast('Override removed'); });
        }
      });
    }
    btns.push({
      label: 'Save', primary: true, onClick: function (close) {
        var v = body.querySelector('#dt-new').value;
        close();
        if (!v.trim() || v === original) return;
        map[k] = { o: original, n: v, ph: isPh || undefined };
        save().then(function () { App.route(); UI.toast('Text override saved'); });
      }
    });
    UI.modal('Edit app text', body, btns);
    var inp = body.querySelector('#dt-new');
    inp.focus();
    inp.select();
  }

  document.addEventListener('click', function (e) {
    if (!loaded || !editOn()) return;
    if (e.target.closest && e.target.closest('.dev-badge, .modal-wrap, .toast')) return;
    var elx = e.target;
    if ((elx.tagName === 'INPUT' || elx.tagName === 'TEXTAREA') && elx.placeholder) {
      e.preventDefault();
      e.stopPropagation();
      openEditor(elx.dataset.tdOrigPh || elx.placeholder, true, elx.dataset.tdKey, false);
      return;
    }
    var target = null;
    for (var n = elx; n && n !== document.body; n = n.parentElement) {
      if (ownText(n)) { target = n; break; }
    }
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    var key = target.dataset.tdKey;
    var original = key && map[key] ? map[key].o : ownText(target);
    var userData = !!(target.closest && target.closest('.list-item, .prog-row, .rec-table, .note-media') && tab() !== 'setting');
    openEditor(original, false, key, userData);
  }, true);

  function exportFile() {
    return {
      app: 'alef.fit-texts',
      appVersion: window.APP_VERSION || '0',
      exportedAt: new Date().toISOString(),
      note: 'Structural text change requests. Implement in code via Cowork, then Clear all overrides.',
      changes: list()
    };
  }

  return {
    init: init, sync: sync, count: count, list: list,
    remove: remove, clearAll: clearAll, exportFile: exportFile, refreshBadge: badge
  };
})();
