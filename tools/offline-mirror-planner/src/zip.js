/*
 * Offline Mirror Planner — minimal ZIP writer (STORE method, no compression).
 * Stored entries keep every byte exactly as given. Paths are validated so the
 * archive cannot contain traversal ("zip-slip") or absolute entries.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.OMP = root.OMP || {};
    root.OMP.zip = factory(root.OMP.core);
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(iso) {
    var d = iso ? new Date(iso) : new Date(Date.UTC(1980, 0, 1));
    if (isNaN(d.getTime()) || d.getUTCFullYear() < 1980) d = new Date(Date.UTC(1980, 0, 1));
    var time = (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2);
    var date = ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate();
    return { time: time & 0xffff, date: date & 0xffff };
  }

  var MAX_ZIP_BYTES = 0xfffffffe; // no ZIP64 support

  /**
   * entries: [{ path: string, bytes: Uint8Array }]; options: { modified: ISO }
   * Returns a Uint8Array containing the archive.
   */
  function createZip(entries, options) {
    options = options || {};
    if (entries.length > 65534) throw core.PlannerError('ZIP_TOO_MANY', 'Too many files for a ZIP archive.');
    var dt = dosDateTime(options.modified);
    var enc = new TextEncoder();
    var seen = Object.create(null), directories = Object.create(null);
    var locals = [], centrals = [];
    var offset = 0, centralSize = 0;
    entries.forEach(function (e) {
      // Headroom for the "offline-mirror-plan/site/" prefix on top of the inventory limits.
      var v = core.validateRelativePath(e.path, { extraLength: 64, extraDepth: 4 });
      if (!v.ok) throw core.PlannerError('ZIP_BAD_PATH', 'Refusing to write unsafe archive path "' + core.safeDisplay(e.path) + '": ' + v.reason);
      var key = e.path.toLowerCase(), parts = key.split('/'), prefix = '';
      if (seen[key]) throw core.PlannerError('ZIP_DUP', 'Duplicate or case-colliding archive path.');
      if (directories[key]) throw core.PlannerError('ZIP_BAD_PATH', 'Archive file/directory prefix collision.');
      for (var j = 0; j < parts.length - 1; j++) {
        prefix = prefix ? prefix + '/' + parts[j] : parts[j];
        if (seen[prefix]) throw core.PlannerError('ZIP_BAD_PATH', 'Archive file/directory prefix collision.');
      }
      prefix = '';
      for (var k = 0; k < parts.length - 1; k++) { prefix = prefix ? prefix + '/' + parts[k] : parts[k]; directories[prefix] = true; }
      seen[key] = true;
      var name = enc.encode(e.path);
      var data;
      if (e.bytes instanceof Uint8Array) data = e.bytes;
      else if (e.bytes instanceof ArrayBuffer) data = new Uint8Array(e.bytes);
      else throw core.PlannerError('ZIP_BAD_DATA', 'Archive entry "' + core.safeDisplay(e.path) + '" has no binary data (expected Uint8Array or ArrayBuffer).');
      var crc = crc32(data);
      var lh = new Uint8Array(30 + name.length);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 10, true);        // version needed
      lv.setUint16(6, 0x0800, true);    // UTF-8 names
      lv.setUint16(8, 0, true);         // STORE
      lv.setUint16(10, dt.time, true);
      lv.setUint16(12, dt.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, data.length, true);
      lv.setUint32(22, data.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      lh.set(name, 30);

      var ch = new Uint8Array(46 + name.length);
      var cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 0x031e, true);     // made by: UNIX, spec 3.0
      cv.setUint16(6, 10, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dt.time, true);
      cv.setUint16(14, dt.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, (0o100644 << 16) >>> 0, true); // regular file, rw-r--r--
      cv.setUint32(42, offset, true);
      ch.set(name, 46);

      locals.push(lh, data);
      centrals.push(ch);
      offset += lh.length + data.length;
      centralSize += ch.length;
      if (offset + centralSize + 22 > MAX_ZIP_BYTES) throw core.PlannerError('ZIP_TOO_LARGE', 'Bundle would exceed 4 GiB; export without site files instead.');
    });
    var end = new Uint8Array(22);
    var ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    var out = new Uint8Array(offset + centralSize + 22);
    var pos = 0;
    locals.concat(centrals, [end]).forEach(function (part) { out.set(part, pos); pos += part.length; });
    return out;
  }

  /** Minimal reader for STORE archives written by createZip (used by tests and self-checks). */
  function readStoredZip(bytes) {
    var v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    var eocd = bytes.length - 22;
    if (eocd < 0 || v.getUint32(eocd, true) !== 0x06054b50) throw core.PlannerError('ZIP_BAD', 'Not a ZIP written by this tool.');
    var count = v.getUint16(eocd + 10, true);
    var cdOff = v.getUint32(eocd + 16, true);
    var dec = new TextDecoder();
    var out = [];
    var p = cdOff;
    function need(end) { if (end > bytes.length) throw core.PlannerError('ZIP_BAD', 'Archive is truncated or corrupt.'); }
    for (var i = 0; i < count; i++) {
      need(p + 46);
      if (v.getUint32(p, true) !== 0x02014b50) throw core.PlannerError('ZIP_BAD', 'Corrupt central directory.');
      var size = v.getUint32(p + 24, true);
      var crc = v.getUint32(p + 16, true);
      var nlen = v.getUint16(p + 28, true);
      var elen = v.getUint16(p + 30, true);
      var clen = v.getUint16(p + 32, true);
      var lo = v.getUint32(p + 42, true);
      need(p + 46 + nlen); need(lo + 30);
      var name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
      var lnlen = v.getUint16(lo + 26, true), lelen = v.getUint16(lo + 28, true);
      need(lo + 30 + lnlen + lelen + size);
      var data = bytes.subarray(lo + 30 + lnlen + lelen, lo + 30 + lnlen + lelen + size);
      if (crc32(data) !== crc) throw core.PlannerError('ZIP_CRC', 'CRC mismatch for ' + name);
      out.push({ path: name, bytes: data });
      p += 46 + nlen + elen + clen;
    }
    return out;
  }

  return { createZip: createZip, readStoredZip: readStoredZip, crc32: crc32 };
});
