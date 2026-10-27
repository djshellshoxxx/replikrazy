/*
 * Minimal deterministic ZIP writer (store only, no compression) used to
 * bundle exported plan files for download. Runs fully in memory.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./paths.js'));
  } else {
    root.OMP = root.OMP || {};
    root.OMP.zip = factory(root.OMP.paths);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (paths) {
  'use strict';

  var MAX_ENTRIES = 1000;
  var MAX_BYTES = 64 * 1024 * 1024;

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

  function dosDateTime(date) {
    var d = date instanceof Date && !isNaN(date) ? date : new Date(Date.UTC(2026, 0, 1));
    var year = Math.min(Math.max(d.getUTCFullYear(), 1980), 2107);
    return {
      time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
      date: ((year - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate()
    };
  }

  function u16(arr, off, v) { arr[off] = v & 0xff; arr[off + 1] = (v >>> 8) & 0xff; }
  function u32(arr, off, v) { u16(arr, off, v & 0xffff); u16(arr, off + 2, (v >>> 16) & 0xffff); }

  /*
   * files: [{ name, data: Uint8Array | string }]; options: { date: Date }.
   * Returns Uint8Array of a valid ZIP archive. Names must be safe relative paths.
   */
  function createZip(files, options) {
    if (!Array.isArray(files) || files.length === 0) throw new Error('Nothing to zip.');
    if (files.length > MAX_ENTRIES) throw new Error('Too many files for one archive.');
    var dt = dosDateTime(options && options.date);
    var enc = new TextEncoder();
    var seen = {};
    var entries = files.map(function (f) {
      var v = paths.validateRelativePath(f.name);
      if (!v.ok) throw new Error('Unsafe file name in archive: ' + v.errors[0].message);
      if (seen[f.name]) throw new Error('Duplicate file name in archive: ' + f.name);
      seen[f.name] = true;
      var data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      if (!(data instanceof Uint8Array)) throw new Error('Archive data must be text or bytes.');
      return { name: enc.encode(f.name), data: data, crc: crc32(data) };
    });
    var total = 22;
    entries.forEach(function (e) { total += 30 + e.name.length + e.data.length + 46 + e.name.length; });
    if (total > MAX_BYTES) throw new Error('Archive would be larger than ' + MAX_BYTES + ' bytes.');

    var out = new Uint8Array(total);
    var off = 0;
    entries.forEach(function (e) {
      e.offset = off;
      u32(out, off, 0x04034b50);
      u16(out, off + 4, 20);
      u16(out, off + 6, 0x0800);
      u16(out, off + 8, 0);
      u16(out, off + 10, dt.time);
      u16(out, off + 12, dt.date);
      u32(out, off + 14, e.crc);
      u32(out, off + 18, e.data.length);
      u32(out, off + 22, e.data.length);
      u16(out, off + 26, e.name.length);
      u16(out, off + 28, 0);
      out.set(e.name, off + 30);
      out.set(e.data, off + 30 + e.name.length);
      off += 30 + e.name.length + e.data.length;
    });
    var cdStart = off;
    entries.forEach(function (e) {
      u32(out, off, 0x02014b50);
      u16(out, off + 4, 20);
      u16(out, off + 6, 20);
      u16(out, off + 8, 0x0800);
      u16(out, off + 10, 0);
      u16(out, off + 12, dt.time);
      u16(out, off + 14, dt.date);
      u32(out, off + 16, e.crc);
      u32(out, off + 20, e.data.length);
      u32(out, off + 24, e.data.length);
      u16(out, off + 28, e.name.length);
      u16(out, off + 30, 0);
      u16(out, off + 32, 0);
      u16(out, off + 34, 0);
      u16(out, off + 36, 0);
      u32(out, off + 38, 0);
      u32(out, off + 42, e.offset);
      out.set(e.name, off + 46);
      off += 46 + e.name.length;
    });
    var cdSize = off - cdStart;
    u32(out, off, 0x06054b50);
    u16(out, off + 4, 0);
    u16(out, off + 6, 0);
    u16(out, off + 8, entries.length);
    u16(out, off + 10, entries.length);
    u32(out, off + 12, cdSize);
    u32(out, off + 16, cdStart);
    u16(out, off + 20, 0);
    return out;
  }

  return { createZip: createZip, crc32: crc32 };
});
