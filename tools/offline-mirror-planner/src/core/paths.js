/*
 * Path rules for the offline mirror planner: relative-path validation,
 * base-path validation, sensitive-file classification and content types.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.OMP = root.OMP || {};
    root.OMP.paths = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PATH_LIMITS = {
    maxPathLength: 512,
    maxSegmentLength: 255,
    maxDepth: 32,
    maxBasePathLength: 200
  };

  // Control chars (C0, DEL, C1) and Unicode line/paragraph separators.
  var CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
  var WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

  function issue(code, message) {
    return { code: code, message: message };
  }

  /*
   * Validate a site-relative path such as "assets/app.js".
   * Returns { ok, path, errors: [{code,message}], warnings: [...] }.
   */
  function validateRelativePath(input) {
    var errors = [];
    var warnings = [];
    if (typeof input !== 'string') {
      return { ok: false, path: '', errors: [issue('path-not-string', 'Path must be text.')], warnings: warnings };
    }
    var p = input;
    if (p.length === 0) errors.push(issue('path-empty', 'Path is empty.'));
    if (p.length > PATH_LIMITS.maxPathLength) {
      errors.push(issue('path-too-long', 'Path is longer than ' + PATH_LIMITS.maxPathLength + ' characters.'));
    }
    if (CONTROL_RE.test(p)) errors.push(issue('path-control-char', 'Path contains control or line-break characters.'));
    if (p.indexOf('\\') !== -1) errors.push(issue('path-backslash', 'Path contains a backslash; only "/" separators are allowed.'));
    if (p.charAt(0) === '/') errors.push(issue('path-absolute', 'Path must be relative (it starts with "/").'));
    if (/^[A-Za-z]:/.test(p)) errors.push(issue('path-drive', 'Path looks like a Windows drive path.'));
    if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(p)) errors.push(issue('path-url', 'Path looks like a URL, not a file path.'));

    var segments = p.split('/');
    if (segments.length > PATH_LIMITS.maxDepth) {
      errors.push(issue('path-too-deep', 'Path is nested deeper than ' + PATH_LIMITS.maxDepth + ' folders.'));
    }
    var seen = {};
    segments.forEach(function (seg, i) {
      if (seg === '') {
        if (!(i === 0 && p.charAt(0) === '/')) {
          var key = 'empty';
          if (!seen[key]) errors.push(issue('path-empty-segment', 'Path has an empty segment ("//" or trailing "/").'));
          seen[key] = true;
        }
        return;
      }
      if (seg === '.' || seg === '..') {
        if (!seen.dots) errors.push(issue('path-traversal', 'Path contains "." or ".." segments.'));
        seen.dots = true;
      }
      if (seg.length > PATH_LIMITS.maxSegmentLength) {
        errors.push(issue('path-segment-too-long', 'A path segment is longer than ' + PATH_LIMITS.maxSegmentLength + ' characters.'));
      }
      if (/[<>:"|?*]/.test(seg) && !seen.winchars) {
        warnings.push(issue('path-windows-chars', 'Path has characters some systems cannot store: < > : " | ? *'));
        seen.winchars = true;
      }
      if (WINDOWS_RESERVED_RE.test(seg) && !seen.winreserved) {
        warnings.push(issue('path-windows-reserved', 'Path uses a name reserved on Windows (e.g. CON, NUL).'));
        seen.winreserved = true;
      }
      if (/[ .]$/.test(seg) && seg !== '.' && seg !== '..' && !seen.trailing) {
        warnings.push(issue('path-trailing-dot-space', 'A path segment ends with a space or dot.'));
        seen.trailing = true;
      }
      if (/\s/.test(seg) && !seen.space) {
        warnings.push(issue('path-whitespace', 'Path contains spaces; URLs will need percent-encoding.'));
        seen.space = true;
      }
    });
    if (typeof p.normalize === 'function' && p.normalize('NFC') !== p) {
      warnings.push(issue('path-not-nfc', 'Path is not Unicode NFC-normalised; some servers may not match it.'));
    }
    return { ok: errors.length === 0, path: p, errors: errors, warnings: warnings };
  }

  /*
   * Base path where the site is served on a destination: "/" or "/a/b/".
   * Returns { ok, value, errors }.
   */
  function validateBasePath(input) {
    var errors = [];
    var v = typeof input === 'string' ? input.trim() : '';
    if (v === '') v = '/';
    if (v.length > PATH_LIMITS.maxBasePathLength) {
      errors.push(issue('basepath-too-long', 'Base path is longer than ' + PATH_LIMITS.maxBasePathLength + ' characters.'));
    }
    if (v.charAt(0) !== '/') errors.push(issue('basepath-leading-slash', 'Base path must start with "/".'));
    if (v.charAt(v.length - 1) !== '/') errors.push(issue('basepath-trailing-slash', 'Base path must end with "/".'));
    if (v !== '/') {
      var inner = v.replace(/^\/+|\/+$/g, '');
      var segs = inner.split('/');
      var bad = segs.some(function (s) { return s === '' || s === '.' || s === '..' || !/^[A-Za-z0-9._~-]+$/.test(s); });
      if (bad) {
        errors.push(issue('basepath-chars', 'Base path segments may only use letters, digits and . _ ~ - (no "..", no empty segments).'));
      }
    }
    return { ok: errors.length === 0, value: v, errors: errors };
  }

  // Strip the selected folder name from "root/sub/file" (webkitRelativePath).
  function stripRootFolder(relPath) {
    var i = relPath.indexOf('/');
    if (i === -1) return { root: '', path: relPath };
    return { root: relPath.slice(0, i), path: relPath.slice(i + 1) };
  }

  function basename(p) {
    var i = p.lastIndexOf('/');
    return i === -1 ? p : p.slice(i + 1);
  }

  function extension(p) {
    var b = basename(p).toLowerCase();
    var i = b.lastIndexOf('.');
    return i <= 0 ? '' : b.slice(i + 1);
  }

  var SENSITIVE_RULES = [
    { category: 'vcs-metadata', segment: /^\.(git|svn|hg|bzr)$/i, reason: 'Version-control metadata' },
    { category: 'credential', segment: /^\.(ssh|aws|gnupg|docker|kube)$/i, reason: 'Credential directory' },
    { category: 'credential', name: /^\.env(\..*)?$/i, reason: 'Environment file (often holds secrets)' },
    { category: 'credential', name: /^(\.htpasswd|\.netrc|\.npmrc|\.pypirc|\.git-credentials|\.pgpass)$/i, reason: 'Credential file' },
    { category: 'credential', name: /^(credentials|secrets?)(\.[a-z0-9]+)?$/i, reason: 'Credential or secrets file' },
    { category: 'credential', name: /\.(kdbx|kdb|keychain|keychain-db)$/i, reason: 'Password database' },
    { category: 'credential', name: /^wallet\.dat$/i, reason: 'Wallet file' },
    { category: 'private-key', name: /^id_(rsa|dsa|ecdsa|ed25519)(\..*)?$/i, reason: 'SSH key' },
    { category: 'private-key', name: /\.(pem|key|p12|pfx|jks|keystore|ppk|p8)$/i, reason: 'Key or certificate bundle' },
    { category: 'private-key', name: /^(hs_ed25519_secret_key|hs_ed25519_public_key|private_key|hostname)$/i, reason: 'Tor onion-service key material' },
    { category: 'private-key', name: /^(eeppriv\.dat|privatekeys\.dat|router\.keys(\.dat)?|.*[.-]keys\.dat)$/i, reason: 'I2P key material' },
    { category: 'private-key', name: /^(secring|pubring)\.(gpg|kbx|skr)$/i, reason: 'GnuPG keyring' },
    { category: 'os-metadata', name: /^(thumbs\.db|desktop\.ini|\.ds_store|ehthumbs\.db)$/i, reason: 'Operating-system metadata' },
    { category: 'database', name: /\.(sqlite|sqlite3|db|db3|sql|mdb|accdb|dump|rdb|frm|ibd|mdf|ldf)$/i, reason: 'Database or database dump' },
    { category: 'backup', segment: /^\.?(backup|backups|bak)$/i, reason: 'Backup folder' },
    { category: 'backup', name: /(\.(bak|backup|old|orig|swp|swo|tmp)$|~$)/i, reason: 'Backup or temporary file' },
    { category: 'backup', name: /^(?=.*backup)(?:.*\.(zip|tar|tgz|gz|bz2|xz|7z|rar)|[^.]*)$/i, reason: 'Backup archive' },
    { category: 'server-side-code', name: /\.(php[0-9]?|phtml|asp|aspx|jsp|cgi|pl)$/i, reason: 'Server-side code (may hold credentials; not static)' }
  ];

  /*
   * Classify a path that must never enter a plan.
   * Returns null (safe to include) or { category, reason }.
   */
  function classifySensitive(p) {
    var segs = p.split('/');
    var name = segs[segs.length - 1];
    for (var r = 0; r < SENSITIVE_RULES.length; r++) {
      var rule = SENSITIVE_RULES[r];
      if (rule.segment) {
        for (var s = 0; s < segs.length; s++) {
          if (rule.segment.test(segs[s])) return { category: rule.category, reason: rule.reason };
        }
      }
      if (rule.name && rule.name.test(name)) return { category: rule.category, reason: rule.reason };
    }
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].charAt(0) === '.' && !(i === 0 && segs[i] === '.well-known')) {
        return { category: 'hidden-file', reason: 'Hidden file or folder (only .well-known/ is published)' };
      }
    }
    return null;
  }

  var CONTENT_TYPES = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    json: 'application/json', map: 'application/json', webmanifest: 'application/manifest+json',
    xml: 'application/xml', rss: 'application/rss+xml', atom: 'application/atom+xml',
    txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8', csv: 'text/csv; charset=utf-8',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
    pdf: 'application/pdf', zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar',
    wasm: 'application/wasm', epub: 'application/epub+zip'
  };

  var TEXT_EXT = { html: 1, htm: 1, css: 1, js: 1, mjs: 1, json: 1, xml: 1, svg: 1, txt: 1, md: 1, csv: 1, rss: 1, atom: 1, webmanifest: 1, map: 1 };

  function contentTypeFor(p) {
    var ext = extension(p);
    if (CONTENT_TYPES[ext]) return CONTENT_TYPES[ext];
    var b = basename(p).toLowerCase();
    if (b === 'security.txt' || b === 'robots.txt' || b === 'humans.txt') return 'text/plain; charset=utf-8';
    return 'application/octet-stream';
  }

  function kindFor(p) {
    var ext = extension(p);
    if (ext === 'html' || ext === 'htm') return 'html';
    if (ext === 'css') return 'css';
    if (ext === 'js' || ext === 'mjs') return 'script';
    if (/^(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$/.test(ext)) return 'image';
    if (/^(woff2?|ttf|otf)$/.test(ext)) return 'font';
    if (/^(mp3|ogg|wav|mp4|webm)$/.test(ext)) return 'media';
    if (TEXT_EXT[ext] || contentTypeFor(p).indexOf('text/') === 0) return 'text';
    return 'other';
  }

  function isTextLike(p) {
    return !!TEXT_EXT[extension(p)] || contentTypeFor(p).indexOf('text/') === 0;
  }

  function isArchive(p) {
    return /\.(zip|tar|tgz|gz|bz2|xz|7z|rar)$/i.test(p);
  }

  // Lowercase slug for ids: ^[a-z0-9][a-z0-9-]{0,47}$
  function slugify(text, fallback) {
    var s = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
    return s || fallback || 'destination';
  }

  return {
    PATH_LIMITS: PATH_LIMITS,
    validateRelativePath: validateRelativePath,
    validateBasePath: validateBasePath,
    stripRootFolder: stripRootFolder,
    classifySensitive: classifySensitive,
    contentTypeFor: contentTypeFor,
    kindFor: kindFor,
    isTextLike: isTextLike,
    isArchive: isArchive,
    basename: basename,
    extension: extension,
    slugify: slugify
  };
});
