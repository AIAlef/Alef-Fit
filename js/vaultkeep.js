/* Alef.Fit — VaultKeep (v0.52, docs/VAULT-SAFEKEEP-PLAN.md Phase 1).
   Vault safekeeping: .AFdd files are REAL zip archives (single entry
   data.bin = the vault JSON) renamed so outsiders don't recognize them —
   rename to .zip and any tool opens them (disaster recovery).
   Layer 1: rolling mirror A-FiT-DD-current.AFdd rewritten ~10 s after every
   Vault change (APK only — public Documents survives app uninstall).
   Layer 2: dated backups A-FiT-DD-DDMMYYYY-NNNN.AFdd, global serial from
   0001, never reused. No encryption by Alef's decision — obfuscation only. */
'use strict';

window.VaultKeep = (function () {

  var CURRENT_NAME = 'A-FiT-DD-current.AFdd';

  /* ---- CRC32 (zip standard) ---- */
  var _crcT = null;
  function crcTable() {
    if (_crcT) return _crcT;
    _crcT = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcT[n] = c >>> 0;
    }
    return _crcT;
  }
  function crc32(bytes) {
    var t = crcTable();
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* ---- deflate/inflate via the browser (no libraries); null = can't ---- */
  function deflate(bytes) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return new Response(stream).arrayBuffer()
        .then(function (buf) { return new Uint8Array(buf); })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function inflate(bytes) {
    if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
    try {
      var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).arrayBuffer()
        .then(function (buf) { return new Uint8Array(buf); })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  /* ---- tiny zip writer: ONE entry; deflates when the browser can,
     stores uncompressed otherwise (still a valid zip) ---- */
  function le16(v) { return [v & 255, (v >> 8) & 255]; }
  function le32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
  function zipCreate(entryName, dataBytes) {
    return deflate(dataBytes).then(function (comp) {
      var method = (comp && comp.length < dataBytes.length) ? 8 : 0;
      var payload = method === 8 ? comp : dataBytes;
      var crc = crc32(dataBytes);
      var name = Array.prototype.slice.call(new TextEncoder().encode(entryName));
      var now = new Date();
      var dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
      var dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
      var head = [].concat(
        [0x50, 0x4B, 0x03, 0x04], le16(20), le16(0), le16(method),
        le16(dosTime), le16(dosDate), le32(crc), le32(payload.length), le32(dataBytes.length),
        le16(name.length), le16(0), name);
      var cdOfs = head.length + payload.length;
      var cd = [].concat(
        [0x50, 0x4B, 0x01, 0x02], le16(20), le16(20), le16(0), le16(method),
        le16(dosTime), le16(dosDate), le32(crc), le32(payload.length), le32(dataBytes.length),
        le16(name.length), le16(0), le16(0), le16(0), le16(0), le32(0), le32(0), name);
      var eocd = [].concat(
        [0x50, 0x4B, 0x05, 0x06], le16(0), le16(0), le16(1), le16(1),
        le32(cd.length), le32(cdOfs), le16(0));
      var out = new Uint8Array(cdOfs + cd.length + eocd.length);
      out.set(head, 0);
      out.set(payload, head.length);
      out.set(cd, cdOfs);
      out.set(eocd, cdOfs + cd.length);
      return out;
    });
  }

  /* ---- zip reader via the central directory (robust for simple zips) ---- */
  function rd16(b, o) { return b[o] | (b[o + 1] << 8); }
  function rd32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function zipExtract(buf) {
    var b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    var i = b.length - 22;
    var min = Math.max(0, b.length - 65558);
    while (i >= min && !(b[i] === 0x50 && b[i + 1] === 0x4B && b[i + 2] === 0x05 && b[i + 3] === 0x06)) i--;
    if (i < min) return Promise.reject(new Error('Not a zip archive'));
    var o = rd32(b, i + 16); /* central directory offset — first entry */
    if (!(b[o] === 0x50 && b[o + 1] === 0x4B && b[o + 2] === 0x01 && b[o + 3] === 0x02)) {
      return Promise.reject(new Error('Zip directory missing'));
    }
    var method = rd16(b, o + 10);
    var csize = rd32(b, o + 20);
    var usize = rd32(b, o + 24);
    var lofs = rd32(b, o + 42);
    var start = lofs + 30 + rd16(b, lofs + 26) + rd16(b, lofs + 28);
    var comp = b.slice(start, start + csize);
    if (method === 0) return Promise.resolve(comp);
    if (method === 8) {
      return inflate(comp).then(function (out) {
        if (!out) throw new Error('This device cannot decompress the file — import it on the S26');
        if (out.length !== usize) throw new Error('Backup file is damaged (size mismatch)');
        return out;
      });
    }
    return Promise.reject(new Error('Unsupported zip compression'));
  }

  /* ---- naming (Alef's final pattern) ---- */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtSerial(n) { return String(n).padStart(4, '0'); }
  function datedName(serial, d) {
    d = d || new Date();
    return 'A-FiT-DD-' + pad2(d.getDate()) + pad2(d.getMonth() + 1) + d.getFullYear() +
      '-' + fmtSerial(serial) + '.AFdd';
  }

  /* ---- meta ---- */
  function meta(key) {
    return DB.get('meta', key).then(function (r) { return r ? r.value : null; });
  }
  function info() {
    return Promise.all([
      DB.all('todos'), meta('vaultChangeAt'), meta('vaultBackupAt'),
      meta('vaultSerial'), meta('vaultBackupLog'), meta('vaultMirrorAt')
    ]).then(function (r) {
      return {
        entries: r[0].filter(function (t) { return t.cat === 'vault'; }).length,
        changeAt: r[1] || 0,
        backupAt: r[2] || 0,
        serial: r[3] || 0,
        log: r[4] || [],
        mirrorAt: r[5] || 0,
        dueAt: r[2] ? r[2] + 30 * 86400000 : 0,
        canMirror: !!(window.Native && Native.isNative && Native.isNative() &&
          Native.canSaveFiles && Native.canSaveFiles())
      };
    });
  }

  function payload(serial) {
    return Promise.all([DB.exportVault(), meta('vaultChangeAt')]).then(function (r) {
      var j = r[0];
      j.serial = serial || 0;
      j.changeAt = r[1] || 0;
      return j;
    });
  }

  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  /* save bytes: APK → Documents/S26-Alef-Fit (survives uninstall);
     web → normal download. Resolves the path, 'download', or null. */
  function save(filename, bytes) {
    if (window.Native && Native.isNative && Native.isNative() &&
        Native.canSaveFiles && Native.canSaveFiles()) {
      return Native.saveBase64(filename, bytesToB64(bytes));
    }
    try {
      UI.download(filename, bytes, 'application/zip');
      return Promise.resolve('download');
    } catch (e) { return Promise.resolve(null); }
  }

  /* ---- one-stop dated backup: build → zip → save → record.
     Resolves { filename, serial, where, bytes }. Any backup (popup button
     OR the tier-4 Full backup hook) resets the 30-day timer. ---- */
  function backupNow() {
    return meta('vaultSerial').then(function (cur) {
      var serial = (cur || 0) + 1;
      return payload(serial).then(function (j) {
        return zipCreate('data.bin', new TextEncoder().encode(JSON.stringify(j)));
      }).then(function (bytes) {
        var fn = datedName(serial, new Date());
        return save(fn, bytes).then(function (where) {
          var now = Date.now();
          return meta('vaultBackupLog').then(function (log) {
            log = log || [];
            log.unshift({ serial: serial, file: fn, at: now, usb: false });
            return Promise.all([
              DB.putRaw('meta', { key: 'vaultSerial', value: serial }),
              DB.putRaw('meta', { key: 'vaultBackupAt', value: now }),
              DB.putRaw('meta', { key: 'vaultBackupLog', value: log.slice(0, 24) })
            ]);
          }).then(function () {
            return { filename: fn, serial: serial, where: where, bytes: bytes };
          });
        });
      });
    });
  }

  function markUsb(serial) {
    return meta('vaultBackupLog').then(function (log) {
      log = log || [];
      log.forEach(function (e) { if (e.serial === serial) e.usb = true; });
      return DB.putRaw('meta', { key: 'vaultBackupLog', value: log });
    });
  }

  /* ---- Layer 1: silent rolling mirror (APK only) ---- */
  var _mirrorTimer = null;
  function writeMirror() {
    if (!(window.Native && Native.isNative && Native.isNative() &&
          Native.canSaveFiles && Native.canSaveFiles())) {
      return Promise.resolve(null);
    }
    return meta('vaultSerial').then(payload).then(function (j) {
      return zipCreate('data.bin', new TextEncoder().encode(JSON.stringify(j)));
    }).then(function (bytes) {
      return Native.saveBase64(CURRENT_NAME, bytesToB64(bytes));
    }).then(function (p) {
      if (!p) return null;
      return DB.putRaw('meta', { key: 'vaultMirrorAt', value: Date.now() })
        .then(function () { return p; });
    }).catch(function () { return null; });
  }
  function touch() {
    if (_mirrorTimer) clearTimeout(_mirrorTimer);
    _mirrorTimer = setTimeout(function () {
      _mirrorTimer = null;
      writeMirror();
    }, 10000);
  }
  /* boot catch-up: if the app died before the debounce fired, the mirror
     lags the data — rewrite it once shortly after launch */
  function catchUp() {
    return Promise.all([meta('vaultChangeAt'), meta('vaultMirrorAt')]).then(function (r) {
      if ((r[0] || 0) > (r[1] || 0)) return writeMirror();
      return null;
    });
  }

  /* ---- import: ArrayBuffer or string → vault JSON (throws on junk) ---- */
  function parseBackup(bufOrText) {
    if (typeof bufOrText === 'string') {
      try { return Promise.resolve(JSON.parse(bufOrText)); }
      catch (e) { return Promise.reject(new Error('Not a valid backup file')); }
    }
    var b = new Uint8Array(bufOrText);
    if (b.length > 3 && b[0] === 0x50 && b[1] === 0x4B) {
      return zipExtract(b).then(function (data) {
        try { return JSON.parse(new TextDecoder().decode(data)); }
        catch (e) { throw new Error('Backup file is damaged (bad JSON inside)'); }
      });
    }
    try { return Promise.resolve(JSON.parse(new TextDecoder().decode(b))); }
    catch (e) { return Promise.reject(new Error('Not a valid backup file')); }
  }

  return {
    backupNow: backupNow, markUsb: markUsb,
    writeMirror: writeMirror, touch: touch, catchUp: catchUp,
    info: info, parseBackup: parseBackup,
    zipCreate: zipCreate, zipExtract: zipExtract,
    datedName: datedName, fmtSerial: fmtSerial, CURRENT_NAME: CURRENT_NAME
  };
})();
