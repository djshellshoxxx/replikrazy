/*
 * Offline Mirror Planner — core: limits, safe path validation, sensitive-file
 * exclusion, media types, SHA-256 hashing and site inventory.
 *
 * Pure logic. No network, no storage, no DOM. Works as a classic browser
 * script (window.OMP.core) and as a CommonJS module (require('./core.js')).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OMP = root.OMP || {};
    root.OMP.core = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TOOL = Object.freeze({ name: 'replikrazy-offline-mirror-planner', version: '0.1.0' });

  var LIMITS = Object.freeze({
    maxFiles: 5000,
    maxFileBytes: 50 * 1024 * 1024,
    maxTotalBytes: 500 * 1024 * 1024,
    maxPathLength: 1024,
    maxSegmentLength: 255,
    maxPathDepth: 32,
    maxTextScanBytes: 2 * 1024 * 1024,
    maxDestinations: 50,
    maxHeaders: 40,
    maxHeaderNameLength: 64,
    maxHeaderValueLength: 2048,
    maxImportBytes: 5 * 1024 * 1024,
    maxLabelLength: 80,
    maxAddressLength: 255,
    maxNotesLength: 2000,
    maxBasePathLength: 200,
    maxShortFieldLength: 255
  });

  // ---------------------------------------------------------------- errors

  function PlannerError(code, message, details) {
    var e = new Error(message);
    e.name = 'PlannerError';
    e.code = code;
    if (details !== undefined) e.details = details;
    return e;
  }

  // ---------------------------------------------------------------- paths

  var WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  // C0 controls, DEL, C1 controls, and Unicode bidi overrides / line separators.
  var CONTROL_CLASS = '[\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u061c\\u200b-\\u200f\\u2028\\u2029\\u202a-\\u202e\\u2060-\\u2069\\ufeff]';
  var CONTROL_CHARS = new RegExp(CONTROL_CLASS);
  var CONTROL_CHARS_G = new RegExp(CONTROL_CLASS, 'g');
  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  /**
   * Validate a site-relative path (forward slashes, no leading slash).
   * Returns { ok: true, path } or { ok: false, reason }.
   * The path is never rewritten except that it must already be in canonical
   * form; anything ambiguous is rejected rather than "fixed".
   */
  function validateRelativePath(p, opts) {
    var maxLen = LIMITS.maxPathLength + (opts && opts.extraLength || 0);
    var maxDepth = LIMITS.maxPathDepth + (opts && opts.extraDepth || 0);
    if (typeof p !== 'string') return { ok: false, reason: 'Path is not a string.' };
    for (var ch of p) { var point = ch.codePointAt(0); if (point >= 0xd800 && point <= 0xdfff) return { ok: false, reason: 'Path contains an unpaired surrogate.' }; }
    if (p.length === 0) return { ok: false, reason: 'Path is empty.' };
    if (p.length > maxLen) return { ok: false, reason: 'Path is longer than ' + maxLen + ' characters.' };
    if (CONTROL_CHARS.test(p)) return { ok: false, reason: 'Path contains control, invisible or bidirectional-formatting characters.' };
    if (p.indexOf('\\') !== -1) return { ok: false, reason: 'Path contains a backslash.' };
    if (p.charAt(0) === '/') return { ok: false, reason: 'Path is absolute (starts with "/").' };
    if (/^[A-Za-z]:/.test(p)) return { ok: false, reason: 'Path starts with a drive letter.' };
    if (p.normalize && p.normalize('NFC') !== p) return { ok: false, reason: 'Path is not Unicode NFC-normalised; rename the file.' };
    var segs = p.split('/');
    if (segs.length > maxDepth) return { ok: false, reason: 'Path is nested deeper than ' + maxDepth + ' levels.' };
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (s === '') return { ok: false, reason: 'Path contains an empty segment ("//" or trailing "/").' };
      if (s === '.' || s === '..') return { ok: false, reason: 'Path contains a "' + s + '" traversal segment.' };
      if (s.length > LIMITS.maxSegmentLength) return { ok: false, reason: 'A path segment is longer than ' + LIMITS.maxSegmentLength + ' characters.' };
      if (/[ .]$/.test(s)) return { ok: false, reason: 'Path segment "' + s + '" ends with a space or dot (not portable).' };
      if (WINDOWS_RESERVED.test(s)) return { ok: false, reason: 'Path segment "' + s + '" is a reserved device name on Windows.' };
      if (/[<>:"|?*]/.test(s)) return { ok: false, reason: 'Path segment "' + s + '" contains a character that is not portable (<>:"|?*).' };
    }
    return { ok: true, path: p };
  }

  /** Non-blocking advisories about a valid path (URL-hostile characters etc.). */
  function pathAdvisories(p) {
    var out = [];
    if (/%[0-9A-Fa-f]{2}/.test(p)) out.push('Path contains percent-encoded sequences; hosts may decode them differently.');
    if (/[#\s'`]/.test(p)) out.push('Path contains spaces, "#" or quotes; links must percent-encode it.');
    if (/[^\x20-\x7e]/.test(p)) out.push('Path contains non-ASCII characters; confirm every destination serves UTF-8 paths.');
    return out;
  }

  /**
   * Given raw relative paths from a folder picker (e.g. "mysite/index.html"),
   * strip the single shared top-level folder if every path has one.
   */
  function stripCommonRoot(paths) {
    if (!paths.length) return { root: '', paths: [] };
    var first = null;
    for (var i = 0; i < paths.length; i++) {
      var p = String(paths[i]);
      var idx = p.indexOf('/');
      if (idx <= 0) return { root: '', paths: paths.slice() };
      var top = p.slice(0, idx);
      if (first === null) first = top;
      else if (top !== first) return { root: '', paths: paths.slice() };
    }
    if (!validateRelativePath(first).ok) return { root: '', paths: paths.slice() };
    return { root: first, paths: paths.map(function (p) { return String(p).slice(first.length + 1); }) };
  }

  /**
   * Normalise a destination base path. Accepts "", "/", "site", "/site/",
   * "/a/b". Returns { ok, basePath } (always "/" or "/seg/.../") or { ok:false, reason }.
   */
  function normaliseBasePath(input) {
    if (input === undefined || input === null) input = '/';
    if (typeof input !== 'string') return { ok: false, reason: 'Base path must be text.' };
    var s = input.trim();
    if (s.length > LIMITS.maxBasePathLength) return { ok: false, reason: 'Base path is longer than ' + LIMITS.maxBasePathLength + ' characters.' };
    if (s === '' || s === '/') return { ok: true, basePath: '/' };
    if (s.charAt(0) !== '/') s = '/' + s;
    if (s.charAt(s.length - 1) !== '/') s = s + '/';
    var segs = s.slice(1, -1).split('/');
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (seg === '') return { ok: false, reason: 'Base path contains an empty segment ("//").' };
      if (seg === '.' || seg === '..') return { ok: false, reason: 'Base path may not contain "." or ".." segments.' };
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(seg)) return { ok: false, reason: 'Base path segment "' + safeDisplay(seg).slice(0, 60) + '" must start with a letter or digit and may only use letters, digits and . _ -' };
    }
    return { ok: true, basePath: s };
  }

  // ---------------------------------------------------- sensitive files

  // Each rule: test(lowerPath, segments) -> boolean. Matching files are
  // excluded WITHOUT reading their bytes and never appear with a hash.
  var SENSITIVE_RULES = [
    { category: 'version-control', reason: 'Version-control metadata directory', test: segAny(/^(\.git|\.svn|\.hg|\.bzr|_darcs)$/) },
    { category: 'credentials', reason: 'Environment / credential file', test: nameAny(/^(\.env(\..*)?|\.envrc|\.npmrc|\.pypirc|\.netrc|_netrc|\.htpasswd|\.git-credentials|\.dockercfg|(credentials|secrets?|service[-_]?account)(\.(json|ya?ml|toml|ini|txt|env|conf|cfg|xml|properties))?|.*\.secrets?)$/) },
    { category: 'credentials', reason: 'Credential directory', test: segDir(/^(\.aws|\.ssh|\.gnupg|\.docker|\.kube|\.config)$/) },
    { category: 'private-key', reason: 'Private key or certificate bundle', test: nameAny(/(\.pem|\.key|\.p12|\.pfx|\.jks|\.keystore|\.ppk|\.asc|\.gpg|\.pgp|\.kdbx|\.kdb)$|^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/) },
    { category: 'wallet', reason: 'Cryptocurrency wallet / seed material', test: nameAny(/^(wallet\.dat|.*\.wallet|seed(phrase)?\.txt|mnemonic\.txt)$/) },
    { category: 'onion-or-i2p-key', reason: 'Tor onion-service or I2P key material (I2P keys use .dat files)', test: nameAny(/^(hs_ed25519_secret_key|hs_ed25519_public_key|private_key|client_keys|authorized_clients|onion_v3_private_key|.*\.dat|router\.keys.*)$/) },
    { category: 'onion-or-i2p-key', reason: 'Tor onion-service directory', test: segDir(/^(hidden_service.*|onion_service.*|hs_.*|tor-keys?|i2p-keys?|i2pd-keys?)$/) },
    { category: 'database', reason: 'Database file or dump', test: nameAny(/(\.sqlite3?|\.db|\.db3|\.sql|\.sql\.gz|\.dump|\.mdb|\.accdb|\.frm|\.ibd|\.myd|\.ldb|\.rdb|-wal|-shm|-journal)$/) },
    { category: 'backup', reason: 'Backup, editor swap or temporary file', test: nameAny(/(\.bak|\.backup|\.old|\.orig|\.swp|\.swo|\.tmp|~)$|^#.*#$/) },
    { category: 'backup', reason: 'Backup archive', test: nameAny(/(backup|bkp|dump|snapshot).*\.(zip|tar|tgz|gz|bz2|xz|7z|rar)$/) },
    { category: 'backup', reason: 'Backup directory', test: segDir(/^(backups?|bak|\.backup)$/) },
    { category: 'os-metadata', reason: 'Operating-system metadata', test: nameAny(/^(\.ds_store|thumbs\.db|desktop\.ini|\._.*|\.spotlight-v100|\.trashes)$/) },
    { category: 'server-side-code', reason: 'Server-side code or server configuration (a static mirror must not serve it)', test: nameAny(/(\.php\d?|\.phtml|\.cgi|\.pl|\.asp|\.aspx|\.jsp|\.py|\.rb|\.sh|\.htaccess|\.user\.ini|web\.config)$/) },
    // Any other hidden file or folder, except the public /.well-known/ convention.
    { category: 'hidden-file', reason: 'Hidden file or folder (only .well-known/ is published)', test: function (lower, segs) { for (var i = 0; i < segs.length; i++) { if (segs[i].charAt(0) === '.' && !(i === 0 && segs[i] === '.well-known' && segs.length > 1)) return true; } return false; } }
  ];

  function nameAny(re) { return function (lower, segs) { return re.test(segs[segs.length - 1]); }; }
  function segAny(re) { return function (lower, segs) { for (var i = 0; i < segs.length; i++) if (re.test(segs[i])) return true; return false; }; }
  function segDir(re) { return function (lower, segs) { for (var i = 0; i < segs.length - 1; i++) if (re.test(segs[i])) return true; return false; }; }

  /** Returns { category, reason } if the path must be excluded, else null. */
  function classifySensitivePath(p) {
    var lower = String(p).toLowerCase();
    var segs = lower.split('/');
    for (var i = 0; i < SENSITIVE_RULES.length; i++) {
      if (SENSITIVE_RULES[i].test(lower, segs)) return { category: SENSITIVE_RULES[i].category, reason: SENSITIVE_RULES[i].reason };
    }
    return null;
  }

  // Content markers that indicate secrets inside otherwise-normal files.
  var SECRET_CONTENT_RULES = [
    { reason: 'Contains a PEM/OpenSSH private-key block', re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
    { reason: 'Contains a Tor ed25519 secret-key header', re: /== ed25519v1-secret: type0 ==/ },
    { reason: 'Contains a PGP private-key block', re: /-----BEGIN PGP PRIVATE KEY BLOCK-----/ },
    { reason: 'Contains an AWS access key id', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
    { reason: 'Contains a GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
    { reason: 'Contains a Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
    { reason: 'Contains a database connection string with a password', re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s:@\/]+:[^\s@\/]+@/i }
  ];

  /** Scan free text (file content or user-entered field) for secret markers. */
  function scanTextForSecrets(text) {
    var hits = [];
    if (typeof text !== 'string' || !text) return hits;
    for (var i = 0; i < SECRET_CONTENT_RULES.length; i++) {
      if (SECRET_CONTENT_RULES[i].re.test(text)) hits.push(SECRET_CONTENT_RULES[i].reason);
    }
    return hits;
  }

  /** Stricter scan for short user-entered fields (notes, labels): also catches key=value secrets. */
  function scanFieldForSecrets(text) {
    var hits = scanTextForSecrets(text);
    if (typeof text === 'string' && text) {
      if (/\b(pass(word|wd)?|secret|token|api[_-]?key|private[_-]?key|auth|bearer|cookie|session)\b\s*[:=]\s*\S{4,}/i.test(text)) hits.push('Looks like a "name = secret" credential assignment');
      if (/\bbearer\s+[A-Za-z0-9._~+\/-]{16,}/i.test(text)) hits.push('Looks like a bearer token');
      if (/\b[a-z][a-z0-9+.-]{1,20}:\/\/[^\s\/@:]*:[^\s\/@]*@/i.test(text)) hits.push('Contains a URL with an embedded username and password');
      if (/[?&](token|key|secret|sig|signature|password|auth|access_token|api_key)=/i.test(text)) hits.push('Contains a URL query parameter that usually carries a credential');
      var long = text.match(/[A-Za-z0-9+_-]{40,}={0,2}/g) || [];
      for (var i = 0; i < long.length; i++) {
        if (/[A-Z]/.test(long[i]) && /[a-z]/.test(long[i]) && /[0-9]/.test(long[i])) { hits.push('Contains a long mixed-case key-like string'); break; }
      }
    }
    return hits;
  }

  // ---------------------------------------------------------- media types

  var MEDIA_TYPES = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', xhtml: 'application/xhtml+xml',
    css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    json: 'application/json', map: 'application/json', webmanifest: 'application/manifest+json',
    xml: 'application/xml', rss: 'application/rss+xml', atom: 'application/atom+xml',
    txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8', csv: 'text/csv; charset=utf-8',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac',
    mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg',
    pdf: 'application/pdf', wasm: 'application/wasm', zip: 'application/zip',
    gz: 'application/gzip', tar: 'application/x-tar', epub: 'application/epub+zip'
  };
  var TEXT_EXTENSIONS = { html: 1, htm: 1, xhtml: 1, css: 1, js: 1, mjs: 1, json: 1, map: 1, webmanifest: 1, xml: 1, rss: 1, atom: 1, txt: 1, md: 1, csv: 1, svg: 1 };

  function extensionOf(p) {
    var name = String(p).split('/').pop();
    var dot = name.lastIndexOf('.');
    if (dot <= 0) return '';
    return name.slice(dot + 1).toLowerCase();
  }

  function mediaTypeFor(p) {
    var ext = extensionOf(p);
    return has(MEDIA_TYPES, ext) ? MEDIA_TYPES[ext] : 'application/octet-stream';
  }

  // --------------------------------------------------------------- hashing

  function getSubtle() {
    var c = (typeof globalThis !== 'undefined' && globalThis.crypto) || (typeof self !== 'undefined' && self.crypto);
    if (!c || !c.subtle) throw PlannerError('NO_WEBCRYPTO', 'Web Crypto (crypto.subtle) is unavailable. Open the planner from a local file or http://localhost / 127.0.0.1 in a current browser.');
    return c.subtle;
  }

  function toHex(buf) {
    var bytes = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return out;
  }

  function sha256Hex(bytes) {
    return getSubtle().digest('SHA-256', bytes).then(toHex);
  }

  function utf8Encode(str) { return new TextEncoder().encode(str); }
  function utf8DecodeLossy(bytes) { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); }

  // ----------------------------------------------------- content analysis

  // Root-absolute references ("/css/x.css") break when a mirror is served
  // under a non-root base path. Protocol-relative ("//host") are external.
  var HTML_ROOT_REF = /\b(?:href|src|action|poster|data)\s*=\s*["']?\/(?!\/)/i;
  var CSS_ROOT_REF = /url\(\s*["']?\/(?!\/)/i;
  var EXTERNAL_REF = /\b(?:href|src|action|poster)\s*=\s*["']?(?:https?:)?\/\/[^"'\s>]+|url\(\s*["']?(?:https?:)?\/\/[^"')\s]+|@import\s+["'](?:https?:)?\/\/[^"']+/ig;

  function analyseText(path, text) {
    var ext = extensionOf(path);
    var flags = [];
    var notes = [];
    if (ext === 'html' || ext === 'htm' || ext === 'xhtml' || ext === 'svg') {
      if (HTML_ROOT_REF.test(text)) flags.push('root-absolute-links');
    }
    if (ext === 'css' || ext === 'html' || ext === 'htm' || ext === 'svg') {
      if (CSS_ROOT_REF.test(text)) { if (flags.indexOf('root-absolute-links') === -1) flags.push('root-absolute-links'); }
    }
    if (ext === 'html' || ext === 'htm' || ext === 'xhtml' || ext === 'css' || ext === 'svg') {
      var m = text.match(EXTERNAL_REF);
      if (m && m.length) {
        flags.push('external-references');
        var hosts = {};
        m.forEach(function (ref) {
          var hm = /\/\/([^\/"'\s)>:]+)/.exec(ref);
          if (hm) hosts[hm[1].toLowerCase()] = 1;
        });
        notes.push('References external hosts: ' + Object.keys(hosts).slice(0, 10).join(', '));
      }
    }
    return { flags: flags, notes: notes };
  }

  // ------------------------------------------------------------- inventory

  /**
   * Build an inventory from abstract entries.
   *   entries: [{ path: string, size: number, read: () => Promise<Uint8Array|ArrayBuffer> }]
   *   options: { stripRoot?: boolean (default true), onProgress?: fn({done,total,path}),
   *              limits?: partial LIMITS override (tests only; may only tighten) }
   * Never mutates or rewrites bytes; bytes are hashed and discarded.
   * Throws PlannerError for whole-input failures (e.g. too many files).
   */
  function buildInventory(entries, options) {
    options = options || {};
    var lim = mergeLimits(options.limits);
    if (!Array.isArray(entries)) return Promise.reject(PlannerError('BAD_INPUT', 'Inventory input must be a list of files.'));
    if (entries.length === 0) return Promise.reject(PlannerError('EMPTY', 'The selected folder contains no files.'));
    if (entries.length > lim.maxFiles) {
      return Promise.reject(PlannerError('TOO_MANY_FILES', 'The selection has ' + entries.length + ' files; the limit is ' + lim.maxFiles + '. Select a smaller site folder.'));
    }

    var rawPaths = entries.map(function (e) { return e && typeof e.path === 'string' ? e.path : ''; });
    var stripped = options.stripRoot === false ? { root: '', paths: rawPaths } : stripCommonRoot(rawPaths);

    var files = [], excluded = [], rejected = [], warnings = [];
    var seen = Object.create(null), seenLower = Object.create(null), seenDirectories = Object.create(null);
    var totalBytes = 0;
    var idx = 0;
    var total = entries.length;

    function progress(path) { if (typeof options.onProgress === 'function') { try { options.onProgress({ done: idx, total: total, path: path }); } catch (e) { /* ignore UI errors */ } } }

    // Returns null after recording a rejection/exclusion, or a Promise for a file being read and hashed.
    // If the selected folder itself is sensitive (e.g. ".git", ".ssh", "backups"), exclude everything in it.
    var rootSensitive = stripped.root ? classifySensitivePath(stripped.root + '/placeholder-file') : null;
    if (rootSensitive) rootSensitive = { category: rootSensitive.category, reason: rootSensitive.reason + ' (the selected folder "' + safeDisplay(stripped.root) + '" itself)' };

    function processOne(entry, path, displayPath) {
      var v = validateRelativePath(path);
      if (!v.ok) { rejected.push({ path: safeDisplay(displayPath), reason: v.reason, category: 'unsafe-path' }); return null; }
      if (seen[path]) { rejected.push({ path: path, reason: 'Duplicate path in selection.', category: 'duplicate' }); return null; }
      seen[path] = true;

      var size = entry && typeof entry === 'object' ? entry.size : undefined;
      if (typeof size !== 'number' || !isFinite(size) || size < 0 || Math.floor(size) !== size) {
        rejected.push({ path: path, reason: 'File size is unknown or invalid.', category: 'invalid-size' }); return null;
      }

      var sens = rootSensitive || classifySensitivePath(path);
      if (sens) { excluded.push({ path: path, size: size, category: sens.category, reason: sens.reason + ' — excluded; bytes were not read.' }); return null; }

      if (size > lim.maxFileBytes) {
        rejected.push({ path: path, reason: 'File is ' + formatBytes(size) + '; the per-file limit is ' + formatBytes(lim.maxFileBytes) + '.', category: 'too-large' }); return null;
      }
      if (totalBytes + size > lim.maxTotalBytes) {
        rejected.push({ path: path, reason: 'Adding this file would exceed the total size limit of ' + formatBytes(lim.maxTotalBytes) + '.', category: 'total-limit' }); return null;
      }
      if (typeof entry.read !== 'function') {
        rejected.push({ path: path, reason: 'File cannot be read.', category: 'read-error' }); return null;
      }

      return Promise.resolve()
        .then(function () { return entry.read(); })
        .then(function (data) {
          var bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
          if (bytes.byteLength !== size) {
            rejected.push({ path: path, reason: 'Read ' + bytes.byteLength + ' bytes but the file reported ' + size + '; it may have changed while reading.', category: 'read-mismatch' });
            return;
          }
          var ext = extensionOf(path);
          var analysis = { flags: [], notes: [] };
          var isText = has(TEXT_EXTENSIONS, ext);
          // Every file (text or binary) has its first bytes scanned for secret markers.
          var scanBytes = bytes.byteLength > lim.maxTextScanBytes ? bytes.subarray(0, lim.maxTextScanBytes) : bytes;
          var text = utf8DecodeLossy(scanBytes);
          var secretHits = scanTextForSecrets(text);
          if (secretHits.length) {
            excluded.push({ path: path, size: size, category: 'secret-content', reason: secretHits.join('; ') + ' \u2014 excluded from plan and bundle.' });
            return;
          }
          if (isText) {
            analysis = analyseText(path, text);
            if (bytes.byteLength > lim.maxTextScanBytes) analysis.notes.push('Only the first ' + formatBytes(lim.maxTextScanBytes) + ' were scanned for secrets and links.');
          }
          return sha256Hex(bytes).then(function (hash) {
            var lower = path.toLowerCase();
            if (seenLower[lower]) {
              rejected.push({ path: path, reason: 'Differs only by letter case from "' + seenLower[lower] + '"; it would overwrite that file on case-insensitive file systems. Rename one of them.', category: 'case-collision' });
              return;
            }
            var parts = lower.split('/'), prefix = '', conflict = !!seenDirectories[lower];
            for (var j = 0; j < parts.length - 1; j++) {
              prefix = prefix ? prefix + '/' + parts[j] : parts[j];
              if (seenLower[prefix]) conflict = true;
            }
            if (conflict) {
              rejected.push({ path: path, reason: 'File/directory prefix collision on a case-insensitive file system.', category: 'path-conflict' });
              return;
            }
            prefix = '';
            for (var k = 0; k < parts.length - 1; k++) { prefix = prefix ? prefix + '/' + parts[k] : parts[k]; seenDirectories[prefix] = true; }
            seenLower[lower] = path;
            totalBytes += size;
            var rec = { path: path, size: size, sha256: hash, mediaType: mediaTypeFor(path), flags: analysis.flags };
            var adv = pathAdvisories(path).concat(analysis.notes);
            if (adv.length) rec.notes = adv;
            files.push(rec);
          });
        }, function (err) {
          rejected.push({ path: path, reason: 'Could not read file: ' + safeDisplay(err && err.message ? err.message : String(err)), category: 'read-error' });
        });
    }

    // Iterative loop (no recursion): files are read one at a time to bound memory.
    async function run() {
      for (idx = 0; idx < total; ) {
        var entry = entries[idx];
        var path = stripped.paths[idx];
        var displayPath = typeof path === 'string' && path ? path : '(unnamed entry #' + (idx + 1) + ')';
        idx++;
        progress(displayPath);
        var pending = processOne(entry, path, displayPath);
        if (pending) await pending;
      }
      return finish();
    }

    function finish() {
      files.sort(byPath); excluded.sort(byPath); rejected.sort(byPath);
      var paths = Object.create(null);
      files.forEach(function (f) { paths[f.path] = true; });
      if (!paths['index.html'] && !paths['index.htm']) warnings.push({ path: '', message: 'No index.html at the site root; most hosts will not show a home page.' });
      if (!paths['404.html']) warnings.push({ path: '', message: 'No 404.html at the site root; destinations will show their own default error page.' });
      var largest = files.reduce(function (m, f) { return f.size > m ? f.size : m; }, 0);
      var flagged = function (flag) { return files.filter(function (f) { return f.flags.indexOf(flag) !== -1; }).map(function (f) { return f.path; }); };
      var sums = buildSha256Sums(files);
      return sha256Hex(utf8Encode(sums)).then(function (manifestHash) {
        progress('');
        return {
          rootFolder: stripped.root,
          files: files,
          excluded: excluded,
          rejected: rejected,
          warnings: warnings,
          totals: {
            fileCount: files.length,
            totalBytes: totalBytes,
            largestFileBytes: largest,
            excludedCount: excluded.length,
            rejectedCount: rejected.length,
            inputCount: total
          },
          rootAbsoluteLinkFiles: flagged('root-absolute-links'),
          externalReferenceFiles: flagged('external-references'),
          manifestSha256: manifestHash
        };
      });
    }

    return run();
  }

  /** `sha256sum -c` compatible manifest, sorted by path, LF line endings. */
  function buildSha256Sums(files) {
    return files.slice().sort(byPath).map(function (f) { return f.sha256 + '  ' + f.path + '\n'; }).join('');
  }

  function mergeLimits(override) {
    var out = {};
    Object.keys(LIMITS).forEach(function (k) {
      var v = LIMITS[k];
      if (override && typeof override[k] === 'number' && override[k] >= 0 && override[k] < v) v = override[k];
      out[k] = v;
    });
    return out;
  }

  function byPath(a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; }

  function safeDisplay(s) {
    return String(s).replace(CONTROL_CHARS_G, function (c) { return '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4); }).slice(0, 300);
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MiB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GiB';
  }

  // --------------------------------------------------------------- headers

  // Stricter than RFC 9110 tchar on purpose: names are written unquoted into server templates.
  var HEADER_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;
  var FORBIDDEN_HEADERS = /^(set-cookie|authorization|proxy-authorization|cookie|content-length|transfer-encoding|connection|host|upgrade|te|trailer|keep-alive)$/i;

  /** Validate one response header the plan asks destinations to send. */
  function validateHeader(h) {
    var errors = [];
    if (!h || typeof h !== 'object') return ['Header entry is not an object.'];
    var name = typeof h.name === 'string' ? h.name.trim() : '';
    var value = typeof h.value === 'string' ? h.value.trim() : '';
    if (!name) errors.push('Header name is required.');
    else if (name.length > LIMITS.maxHeaderNameLength) errors.push('Header name is longer than ' + LIMITS.maxHeaderNameLength + ' characters.');
    else if (!HEADER_NAME.test(name)) errors.push('Header name must start with a letter and contain only letters, digits and hyphens.');
    else if (scanFieldForSecrets(name).length) errors.push('Header name looks like it contains a credential.');
    else if (FORBIDDEN_HEADERS.test(name)) errors.push('Header "' + name + '" is connection-level or credential-bearing and cannot be part of a plan.');
    if (!value) errors.push('Header value is required.');
    else if (value.length > LIMITS.maxHeaderValueLength) errors.push('Header value is longer than ' + LIMITS.maxHeaderValueLength + ' characters.');
    else if (/[\r\n\u0000]/.test(value) || CONTROL_CHARS.test(value.replace(/\t/g, ''))) errors.push('Header value contains line breaks or control characters.');
    else if (/["\\`${}%]/.test(value)) errors.push('Header value may not contain " \\ ` $ { } or % (keeps generated server templates safe to quote).');
    if (value && scanFieldForSecrets(value).length) errors.push('Header value looks like it contains a credential; plans never carry credentials.');
    return errors;
  }

  return {
    TOOL: TOOL,
    LIMITS: LIMITS,
    PlannerError: PlannerError,
    validateRelativePath: validateRelativePath,
    hasControlChars: function (s) { return CONTROL_CHARS.test(String(s)); },
    has: has,
    pathAdvisories: pathAdvisories,
    stripCommonRoot: stripCommonRoot,
    normaliseBasePath: normaliseBasePath,
    classifySensitivePath: classifySensitivePath,
    scanTextForSecrets: scanTextForSecrets,
    scanFieldForSecrets: scanFieldForSecrets,
    extensionOf: extensionOf,
    mediaTypeFor: mediaTypeFor,
    MEDIA_TYPES: MEDIA_TYPES,
    sha256Hex: sha256Hex,
    utf8Encode: utf8Encode,
    analyseText: analyseText,
    buildInventory: buildInventory,
    buildSha256Sums: buildSha256Sums,
    validateHeader: validateHeader,
    formatBytes: formatBytes,
    safeDisplay: safeDisplay
  };
});
