/*
 * Site inventory for the offline mirror planner.
 * Validates paths, applies size limits before reading, excludes sensitive
 * files, hashes accepted files (bytes are read, never changed) and collects
 * site facts used by destination requirement checks.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./sha256.js'), require('./paths.js'));
  } else {
    root.OMP = root.OMP || {};
    root.OMP.inventory = factory(root.OMP.sha256, root.OMP.paths);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (sha256, paths) {
  'use strict';

  var MiB = 1024 * 1024;
  var LIMITS = Object.freeze({
    maxEntriesScanned: 20000,
    maxFiles: 5000,
    maxFileBytes: 50 * MiB,
    maxTotalBytes: 250 * MiB,
    maxPathLength: paths.PATH_LIMITS.maxPathLength,
    maxSegmentLength: paths.PATH_LIMITS.maxSegmentLength,
    maxDepth: paths.PATH_LIMITS.maxDepth,
    maxDestinations: 50,
    maxImportBytes: 256 * 1024,
    maxTextScanBytes: 2 * MiB,
    maxHeaders: 20,
    maxListedPerWarning: 25
  });

  function PlannerError(code, message, details) {
    var e = new Error(message);
    e.name = 'PlannerError';
    e.code = code;
    e.details = details || null;
    return e;
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < MiB) return (n / 1024).toFixed(1) + ' KiB';
    return (n / MiB).toFixed(1) + ' MiB';
  }

  var PRIVATE_KEY_RE = /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/;
  var TOR_SECRET_RE = /== ed25519v1-secret: type\d+ ==/;
  var ABS_URL_RE = /\bhttps?:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+|\[[0-9a-f:]+\])(?::\d+)?/gi;
  var PROTO_REL_RE = /(?:=\s*["']?|url\(\s*["']?)\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/gi;
  var HTML_ROOT_REL_RE = /\b(?:src|href|action|poster|srcset|data)\s*=\s*["']?\/(?![\/])/gi;
  var CSS_ROOT_REL_RE = /(?:url\(\s*["']?|@import\s+["'])\/(?![\/])/gi;
  var STORAGE_RE = /\b(localStorage|sessionStorage|indexedDB|document\.cookie|caches\.open|serviceWorker)\b/g;
  var BASE_TAG_RE = /<base\s[^>]*href\s*=/i;
  // Namespace / DTD hosts that are identifiers, not fetches.
  var IGNORED_HOSTS = { 'www.w3.org': 1, 'w3.org': 1, 'purl.org': 1, 'xmlns.com': 1 };

  function decodeText(bytes) {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch (e) {
      return '';
    }
  }

  function headAscii(bytes, n) {
    var s = '';
    var end = Math.min(bytes.length, n);
    for (var i = 0; i < end; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  /*
   * Scan one file's text for secrets and mirror-relevant references.
   * Pure function; used by build() and unit tests.
   */
  function analyzeText(p, text) {
    var out = { secret: false, externalHosts: [], rootRelativeRefs: 0, storageApis: [], hasBaseTag: false };
    if (PRIVATE_KEY_RE.test(text) || TOR_SECRET_RE.test(text)) out.secret = true;
    var kind = paths.kindFor(p);
    var ext = paths.extension(p);
    var markup = kind === 'html' || ext === 'svg';
    if (!(markup || kind === 'css' || kind === 'script')) return out;

    var hosts = {};
    var m;
    ABS_URL_RE.lastIndex = 0;
    while ((m = ABS_URL_RE.exec(text))) {
      var h = m[1].toLowerCase();
      if (!IGNORED_HOSTS[h]) hosts[h] = 1;
    }
    if (markup || kind === 'css') {
      PROTO_REL_RE.lastIndex = 0;
      while ((m = PROTO_REL_RE.exec(text))) {
        var h2 = m[1].toLowerCase();
        if (!IGNORED_HOSTS[h2]) hosts[h2] = 1;
      }
    }
    out.externalHosts = Object.keys(hosts).sort();

    if (markup) out.rootRelativeRefs += (text.match(HTML_ROOT_REL_RE) || []).length;
    if (markup || kind === 'css') out.rootRelativeRefs += (text.match(CSS_ROOT_REL_RE) || []).length;
    if (kind === 'html') out.hasBaseTag = BASE_TAG_RE.test(text);
    if (kind === 'html' || kind === 'script') {
      var apis = {};
      STORAGE_RE.lastIndex = 0;
      while ((m = STORAGE_RE.exec(text))) apis[m[1]] = 1;
      out.storageApis = Object.keys(apis).sort();
    }
    return out;
  }

  /*
   * Synchronous pre-check: no bytes are read here.
   * entries: [{ path, size, getBytes }]. Throws PlannerError on fatal limits.
   */
  function prepareEntries(entries, limits) {
    limits = limits || LIMITS;
    if (!Array.isArray(entries)) throw PlannerError('no-entries', 'No files were provided.');
    if (entries.length === 0) throw PlannerError('no-entries', 'The selected folder contains no files.');
    if (entries.length > limits.maxEntriesScanned) {
      throw PlannerError('too-many-entries',
        'The folder has ' + entries.length + ' files; the limit is ' + limits.maxEntriesScanned +
        '. Select only the built static-site output folder.');
    }
    var accepted = [];
    var excluded = [];
    var rejected = [];
    var pathWarnings = {};
    var seen = {};
    var lowerSeen = {};
    var caseCollisions = [];
    var totalBytes = 0;

    entries.forEach(function (entry) {
      var rawPath = entry && typeof entry.path === 'string' ? entry.path : '';
      var v = paths.validateRelativePath(rawPath);
      if (!v.ok) {
        rejected.push({ path: rawPath, code: v.errors[0].code, message: v.errors.map(function (e) { return e.message; }).join(' ') });
        return;
      }
      if (seen[rawPath]) {
        rejected.push({ path: rawPath, code: 'duplicate-path', message: 'The same path appears more than once.' });
        return;
      }
      seen[rawPath] = true;
      var sens = paths.classifySensitive(rawPath);
      if (sens) {
        excluded.push({ path: rawPath, category: sens.category, reason: sens.reason });
        return;
      }
      var size = entry.size;
      if (typeof size !== 'number' || !isFinite(size) || size < 0 || Math.floor(size) !== size) {
        rejected.push({ path: rawPath, code: 'size-unknown', message: 'File size is unknown or invalid.' });
        return;
      }
      if (size > limits.maxFileBytes) {
        rejected.push({ path: rawPath, code: 'file-too-large',
          message: 'File is ' + formatBytes(size) + '; the per-file limit is ' + formatBytes(limits.maxFileBytes) + '.' });
        return;
      }
      if (typeof entry.getBytes !== 'function') {
        rejected.push({ path: rawPath, code: 'unreadable', message: 'File cannot be read.' });
        return;
      }
      v.warnings.forEach(function (w) {
        (pathWarnings[w.code] = pathWarnings[w.code] || { message: w.message, paths: [] }).paths.push(rawPath);
      });
      var lower = rawPath.toLowerCase();
      if (lowerSeen[lower]) caseCollisions.push([lowerSeen[lower], rawPath]);
      else lowerSeen[lower] = rawPath;
      totalBytes += size;
      accepted.push(entry);
    });

    if (accepted.length > limits.maxFiles) {
      throw PlannerError('too-many-files',
        accepted.length + ' publishable files found; the limit is ' + limits.maxFiles + '.');
    }
    if (totalBytes > limits.maxTotalBytes) {
      throw PlannerError('too-large',
        'Publishable files total ' + formatBytes(totalBytes) + '; the limit is ' + formatBytes(limits.maxTotalBytes) + '.');
    }
    return {
      accepted: accepted,
      excluded: excluded,
      rejected: rejected,
      totalBytes: totalBytes,
      pathWarnings: pathWarnings,
      caseCollisions: caseCollisions
    };
  }

  function toUint8(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (data && data.buffer instanceof ArrayBuffer) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    throw PlannerError('bad-bytes', 'File reader returned an unexpected value.');
  }

  function byPath(a, b) {
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  }

  function limitList(list, n) {
    return list.length > n ? list.slice(0, n) : list;
  }

  /*
   * Build a full inventory. Reads and hashes accepted files one by one.
   * options: { label, source, limits, onProgress({done,total,bytesDone,bytesTotal,path}) }
   */
  async function build(entries, options) {
    options = options || {};
    var limits = options.limits || LIMITS;
    var prep = prepareEntries(entries, limits);
    var files = [];
    var excluded = prep.excluded.slice();
    var rejected = prep.rejected.slice();
    var hosts = {};
    var hostPaths = {};
    var rootRel = { count: 0, paths: [] };
    var storage = { apis: {}, paths: [] };
    var baseTagPaths = [];
    var bytesDone = 0;
    var total = prep.accepted.length;

    for (var i = 0; i < prep.accepted.length; i++) {
      var entry = prep.accepted[i];
      var bytes;
      try {
        bytes = toUint8(await entry.getBytes());
      } catch (err) {
        rejected.push({ path: entry.path, code: 'read-failed', message: 'Could not read file: ' + (err && err.message ? err.message : 'unknown error') });
        continue;
      }
      if (bytes.length !== entry.size) {
        rejected.push({ path: entry.path, code: 'size-mismatch', message: 'File size changed while reading (expected ' + entry.size + ' bytes, read ' + bytes.length + ').' });
        continue;
      }
      if (bytes.length > limits.maxFileBytes) {
        rejected.push({ path: entry.path, code: 'file-too-large', message: 'File exceeds the per-file limit.' });
        continue;
      }
      var head = headAscii(bytes, 4096);
      var secret = PRIVATE_KEY_RE.test(head) || TOR_SECRET_RE.test(head);
      var analysis = null;
      if (!secret && paths.isTextLike(entry.path) && bytes.length <= limits.maxTextScanBytes) {
        analysis = analyzeText(entry.path, decodeText(bytes));
        secret = analysis.secret;
      }
      if (secret) {
        excluded.push({ path: entry.path, category: 'secret-content', reason: 'Content looks like a private key' });
        bytes = null;
        continue;
      }
      var digest = await sha256.sha256Hex(bytes);
      files.push({
        path: entry.path,
        size: bytes.length,
        sha256: digest,
        contentType: paths.contentTypeFor(entry.path),
        kind: paths.kindFor(entry.path)
      });
      if (analysis) {
        analysis.externalHosts.forEach(function (h) {
          hosts[h] = 1;
          (hostPaths[h] = hostPaths[h] || []).push(entry.path);
        });
        if (analysis.rootRelativeRefs > 0) {
          rootRel.count += analysis.rootRelativeRefs;
          rootRel.paths.push(entry.path);
        }
        if (analysis.storageApis.length) {
          analysis.storageApis.forEach(function (a) { storage.apis[a] = 1; });
          storage.paths.push(entry.path);
        }
        if (analysis.hasBaseTag) baseTagPaths.push(entry.path);
      }
      bytesDone += bytes.length;
      bytes = null;
      if (typeof options.onProgress === 'function') {
        options.onProgress({ done: i + 1, total: total, bytesDone: bytesDone, bytesTotal: prep.totalBytes, path: entry.path });
      }
    }

    files.sort(byPath);
    excluded.sort(byPath);
    rejected.sort(byPath);

    var n = limits.maxListedPerWarning;
    var warnings = [];
    var has = {};
    files.forEach(function (f) { has[f.path] = true; });
    var hasRootIndex = !!(has['index.html'] || has['index.htm']);
    var hasAnyIndex = files.some(function (f) { return /(^|\/)index\.html?$/.test(f.path); });
    var has404 = !!has['404.html'];

    if (files.length === 0) {
      warnings.push({ code: 'no-publishable-files', level: 'error', message: 'No publishable files remain after exclusions and checks.', paths: [] });
    }
    if (files.length && !hasRootIndex) {
      warnings.push({ code: 'no-root-index', level: 'warning', message: 'No index.html at the site root; the mirror home page may be empty.', paths: [] });
    }
    var hostList = Object.keys(hosts).sort();
    if (hostList.length) {
      var hostFiles = {};
      hostList.forEach(function (h) { hostPaths[h].forEach(function (p) { hostFiles[p] = 1; }); });
      warnings.push({
        code: 'external-reference', level: 'warning',
        message: 'Files reference ' + hostList.length + ' other host(s). Mirrors do not copy those; on Tor/I2P they may fail to load or reveal visits to those hosts. Review before publishing.',
        hosts: limitList(hostList, 50), paths: limitList(Object.keys(hostFiles).sort(), n)
      });
    }
    if (rootRel.count) {
      warnings.push({
        code: 'root-relative-reference', level: 'warning',
        message: rootRel.count + ' root-relative reference(s) (starting with "/") found. They break when a destination serves the site under a non-root base path; the planner does not rewrite files.',
        count: rootRel.count, paths: limitList(rootRel.paths.sort(), n)
      });
    }
    if (baseTagPaths.length) {
      warnings.push({ code: 'base-tag', level: 'info', message: 'Pages use a <base href> tag; check it matches each destination base path.', paths: limitList(baseTagPaths.sort(), n) });
    }
    if (storage.paths.length) {
      warnings.push({
        code: 'browser-storage-usage', level: 'info',
        message: 'Site scripts use browser storage (' + Object.keys(storage.apis).sort().join(', ') + '). Each mirror is a separate origin: localStorage, cookies and IndexedDB are NOT shared between mirrors.',
        paths: limitList(storage.paths.sort(), n)
      });
    }
    if (prep.caseCollisions.length) {
      warnings.push({
        code: 'case-collision', level: 'warning',
        message: 'Some paths differ only by letter case; they collide on case-insensitive file systems.',
        paths: limitList([].concat.apply([], prep.caseCollisions), n)
      });
    }
    var archives = files.filter(function (f) { return paths.isArchive(f.path); }).map(function (f) { return f.path; });
    if (archives.length) {
      warnings.push({ code: 'archive-review', level: 'warning', message: 'Archive files are included; confirm they are meant to be public and contain no backups or private data.', paths: limitList(archives, n) });
    }
    Object.keys(prep.pathWarnings).sort().forEach(function (code) {
      var pw = prep.pathWarnings[code];
      warnings.push({ code: code, level: 'info', message: pw.message, paths: limitList(pw.paths.sort(), n) });
    });
    if (excluded.length) {
      warnings.push({ code: 'excluded-files', level: 'info', message: excluded.length + ' file(s) excluded as sensitive or non-publishable. They are never hashed into the plan or exported.', paths: [] });
    }
    if (rejected.length) {
      warnings.push({ code: 'rejected-files', level: 'warning', message: rejected.length + ' file(s) rejected (invalid path, too large or unreadable). The plan does not cover them.', paths: [] });
    }

    var byKind = {};
    var largest = { size: 0, path: '' };
    var totalBytes = 0;
    files.forEach(function (f) {
      byKind[f.kind] = (byKind[f.kind] || 0) + 1;
      totalBytes += f.size;
      if (f.size > largest.size) largest = { size: f.size, path: f.path };
    });

    return {
      label: String(options.label || 'site').slice(0, 120),
      source: options.source || 'folder',
      files: files,
      excluded: excluded,
      rejected: rejected,
      warnings: warnings,
      stats: {
        scannedEntries: entries.length,
        fileCount: files.length,
        totalBytes: totalBytes,
        largestFileBytes: largest.size,
        largestFilePath: largest.path,
        byKind: byKind,
        excludedCount: excluded.length,
        rejectedCount: rejected.length
      },
      facts: {
        hasRootIndex: hasRootIndex,
        hasAnyIndex: hasAnyIndex,
        has404: has404,
        rootRelativeRefCount: rootRel.count,
        externalHosts: hostList,
        usesBrowserStorage: storage.paths.length > 0
      }
    };
  }

  function base64ToBytes(b64) {
    if (typeof atob === 'function') {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }

  // Entries from the built-in demo bundle ({ files: [{path, base64}] }).
  function entriesFromDemo(demoData) {
    return demoData.files.map(function (f) {
      var bytes = base64ToBytes(f.base64);
      return { path: f.path, size: bytes.length, getBytes: function () { return Promise.resolve(bytes); } };
    });
  }

  // Entries from <input webkitdirectory> File objects; strips the root folder name.
  function entriesFromFileList(fileList) {
    var list = Array.prototype.slice.call(fileList || []);
    var rootName = '';
    var entries = list.map(function (file) {
      var rel = file.webkitRelativePath || file.name;
      var split = paths.stripRootFolder(rel);
      if (!rootName && split.root) rootName = split.root;
      return {
        path: split.path,
        size: file.size,
        getBytes: function () { return file.arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
      };
    });
    return { rootName: rootName, entries: entries };
  }

  return {
    LIMITS: LIMITS,
    PlannerError: PlannerError,
    formatBytes: formatBytes,
    analyzeText: analyzeText,
    prepareEntries: prepareEntries,
    build: build,
    entriesFromDemo: entriesFromDemo,
    entriesFromFileList: entriesFromFileList,
    base64ToBytes: base64ToBytes
  };
});
