/*
 * Destination records for the offline mirror planner.
 * Everything here is user-declared. Nothing is checked over the network,
 * and no status ever means "verified" or "live".
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./paths.js'));
  } else {
    root.OMP = root.OMP || {};
    root.OMP.destinations = factory(root.OMP.paths);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (paths) {
  'use strict';

  var MiB = 1024 * 1024;
  var MAX_DESTINATIONS = 50;
  var MAX_IMPORT_BYTES = 256 * 1024;
  var CAP_VALUES = ['yes', 'no', 'unknown'];

  var TYPES = {
    'static-host': {
      label: 'Generic static hosting',
      summary: 'A static file host you already use. Provider name, URL and features are what you declare.',
      required: ['name', 'providerLabel', 'address']
    },
    'local-server': {
      label: 'Operator-managed local web server',
      summary: 'A web server (nginx, Caddy or other) that an operator runs and configures by hand.',
      required: ['name', 'serverSoftware', 'listen', 'documentRoot']
    },
    'tor-onion': {
      label: 'Tor onion service',
      summary: 'A local web server published by the operator\'s own Tor. The onion address does not exist until their Tor creates keys.',
      required: ['name', 'serverSoftware', 'listen', 'documentRoot']
    },
    'i2p': {
      label: 'I2P site (eepsite)',
      summary: 'A local web server published by the operator\'s own I2P router. The .i2p address does not exist until their router creates keys.',
      required: ['name', 'router', 'serverSoftware', 'listen', 'documentRoot']
    }
  };
  var TYPE_KEYS = Object.keys(TYPES);

  var STATUS = {
    INCOMPLETE: 'incomplete',
    BLOCKED: 'blocked',
    UNVERIFIED: 'unverified',
    READY: 'ready-for-manual-review'
  };
  var STATUS_LABELS = {
    'incomplete': 'Incomplete — missing or invalid configuration',
    'blocked': 'Blocked — a declared capability rules this destination out',
    'unverified': 'Unverified — required capabilities not declared',
    'ready-for-manual-review': 'Ready for manual review (not verified by this tool)'
  };

  var CAPABILITIES = [
    { key: 'directoryIndex', label: 'Directory index', help: 'Serves index.html for URLs ending in "/".' },
    { key: 'customHeaders', label: 'Custom headers', help: 'Lets you set HTTP response headers.' },
    { key: 'correctMimeTypes', label: 'Correct MIME types', help: 'Sends the right Content-Type for each file extension.' },
    { key: 'subpathHosting', label: 'Sub-path hosting', help: 'Can serve the site under a base path such as /mirror/.' },
    { key: 'customErrorPages', label: 'Custom 404 page', help: 'Can serve the site\'s own 404.html for missing pages.' },
    { key: 'https', label: 'HTTPS', help: 'Serves over HTTPS. Not applicable to Tor or I2P (the network encrypts transport).' },
    { key: 'minimalLogging', label: 'Minimal request logging', help: 'Request logs are off or minimised (matters most for Tor/I2P).' }
  ];
  var CAP_KEYS = CAPABILITIES.map(function (c) { return c.key; });

  // Form field definitions; the UI renders from these.
  var FIELDS = [
    { key: 'name', label: 'Name', kind: 'text', maxLength: 80, types: TYPE_KEYS, help: 'Your label for this destination.' },
    { key: 'providerLabel', label: 'Provider (as you know it)', kind: 'text', maxLength: 80, types: ['static-host'], help: 'Free text. The planner does not look providers up or vouch for them.' },
    { key: 'address', label: 'Address', kind: 'text', maxLength: 300, types: TYPE_KEYS, help: 'User-entered and unchecked. Static host: https URL. Tor: v3 .onion (leave empty until the operator\'s Tor creates it). I2P: .b32.i2p or name.i2p (leave empty until created).' },
    { key: 'basePath', label: 'Base path', kind: 'text', maxLength: 200, types: TYPE_KEYS, help: '"/" or a sub-path like "/mirror/". Files are served under it unchanged.' },
    { key: 'serverSoftware', label: 'Web server software', kind: 'select', options: ['', 'nginx', 'caddy', 'other'], types: ['local-server', 'tor-onion', 'i2p'], help: 'Used only to pick an inert config template.' },
    { key: 'router', label: 'I2P router', kind: 'select', options: ['', 'i2pd', 'java-i2p'], types: ['i2p'], help: 'Used only to pick inert instructions.' },
    { key: 'listen', label: 'Local listen address', kind: 'text', maxLength: 60, types: ['local-server', 'tor-onion', 'i2p'], help: 'host:port of the local web server, e.g. 127.0.0.1:8080. Tor/I2P must use loopback.' },
    { key: 'documentRoot', label: 'Document root', kind: 'text', maxLength: 300, types: ['local-server', 'tor-onion', 'i2p'], help: 'Absolute folder on the operator\'s server, e.g. /srv/mirror/site.' },
    { key: 'maxFileMB', label: 'Declared max file size (MiB)', kind: 'number', types: TYPE_KEYS, help: 'Largest single file the destination accepts, as you understand it. Empty = unknown.' },
    { key: 'notes', label: 'Notes', kind: 'textarea', maxLength: 1000, types: TYPE_KEYS, help: 'Free text. Never paste passwords, tokens or keys.' }
  ];
  var STRING_FIELDS = ['id', 'name', 'type', 'basePath', 'address', 'providerLabel', 'serverSoftware', 'listen', 'documentRoot', 'router', 'notes'];
  var ALL_FIELDS = STRING_FIELDS.concat(['maxFileMB', 'capabilities']);
  var FIELD_LIMITS = { id: 48, name: 80, type: 20, basePath: 200, address: 300, providerLabel: 80, serverSoftware: 20, listen: 60, documentRoot: 300, router: 20, notes: 1000 };

  var SECRET_PATTERNS = [
    [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY/, 'a private key block'],
    [/== ed25519v1-secret/, 'Tor secret key material'],
    [/[a-z][a-z0-9+.-]*:\/\/[^\/\s:@]+:[^\/\s@]+@/i, 'a username:password inside a URL'],
    [/\b(pass(word|wd|phrase)?|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|auth(orization)?|private[_-]?key|session[_-]?id|cookie)\b\s*[:=]\s*\S+/i, 'a credential (name=value)'],
    [/\bbearer\s+[A-Za-z0-9._~+\/-]{16,}/i, 'a bearer token'],
    [/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/, 'a GitHub token'],
    [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'a GitHub token'],
    [/\bsk-[A-Za-z0-9_-]{20,}/, 'an API secret key'],
    [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'a chat-service token'],
    [/\bAKIA[0-9A-Z]{16}\b/, 'a cloud access key']
  ];
  var BLOB_RE = /[A-Za-z0-9+\/_=-]{32,}/g;

  // Long random-looking run: mixed case and digits, not plain hex.
  function looksLikeKeyMaterial(run) {
    return run.split('/').some(function (piece) {
      return piece.length >= 32 && /[A-Z]/.test(piece) && /[a-z]/.test(piece) && /[0-9]/.test(piece) && !/^[0-9a-f]+$/i.test(piece);
    });
  }

  /*
   * Return a short reason if text looks like it holds a credential or key,
   * otherwise null. Errs on the side of caution.
   */
  function findSecretLike(text) {
    if (typeof text !== 'string' || text === '') return null;
    for (var i = 0; i < SECRET_PATTERNS.length; i++) {
      if (SECRET_PATTERNS[i][0].test(text)) return SECRET_PATTERNS[i][1];
    }
    var m;
    BLOB_RE.lastIndex = 0;
    while ((m = BLOB_RE.exec(text))) {
      if (looksLikeKeyMaterial(m[0])) return 'a long encoded value (possible key material)';
    }
    return null;
  }

  function emptyCapabilities() {
    var c = {};
    CAP_KEYS.forEach(function (k) { c[k] = 'unknown'; });
    return c;
  }

  function uniqueId(base, existingIds) {
    var taken = {};
    (existingIds || []).forEach(function (id) { taken[id] = true; });
    var stem = paths.slugify(base, 'destination').slice(0, 40).replace(/-+$/, '') || 'destination';
    if (!taken[stem]) return stem;
    for (var n = 2; n < 10000; n++) {
      var cand = stem + '-' + n;
      if (!taken[cand]) return cand;
    }
    return stem + '-' + Date.now().toString(36);
  }

  function createDestination(type, overrides) {
    var t = TYPES[type] ? type : 'static-host';
    var d = {
      id: '',
      name: '',
      type: t,
      basePath: '/',
      address: '',
      providerLabel: '',
      serverSoftware: '',
      listen: '',
      documentRoot: '',
      router: '',
      maxFileMB: null,
      capabilities: emptyCapabilities(),
      notes: ''
    };
    if (t === 'tor-onion' || t === 'i2p') d.capabilities.https = 'unknown';
    if (overrides) {
      Object.keys(overrides).forEach(function (k) {
        if (k === 'capabilities' && overrides.capabilities) {
          CAP_KEYS.forEach(function (c) {
            if (Object.prototype.hasOwnProperty.call(overrides.capabilities, c)) d.capabilities[c] = overrides.capabilities[c];
          });
        } else if (ALL_FIELDS.indexOf(k) !== -1) {
          d[k] = overrides[k];
        }
      });
    }
    return d;
  }

  function err(list, field, code, message) {
    list.push({ field: field, code: code, message: message });
  }

  function isLoopbackHost(h) {
    return h === 'localhost' || h === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
  }

  function validIPv4(h) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
    return !!m && m.slice(1).every(function (o) { return Number(o) <= 255; });
  }

  function parseListen(v) {
    var m = /^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+):(\d{1,5})$/.exec(v);
    if (!m) return null;
    var host = m[1].toLowerCase();
    var port = Number(m[2]);
    if (port < 1 || port > 65535) return null;
    if (/^[\d.]+$/.test(host) && !validIPv4(host)) return null;
    return { host: host, port: port };
  }

  function checkUrl(value, field, errors, warnings, type) {
    var u;
    try {
      u = new URL(value);
    } catch (e) {
      err(errors, field, 'address-invalid', 'Address is not a valid URL. Use a full URL such as https://mirror.example.org/.');
      return value;
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      err(errors, field, 'address-scheme', 'Address must start with https:// (or http://).');
      return value;
    }
    if (u.username || u.password) {
      err(errors, field, 'address-credentials', 'Remove the username/password from the address. The planner never stores credentials.');
    }
    if (u.search || u.hash) {
      err(errors, field, 'address-query', 'Remove the query string or #fragment from the address (they can carry tokens).');
    }
    if (/\.onion$/i.test(u.hostname)) {
      err(errors, field, 'address-wrong-type', 'This is an .onion address; use the "Tor onion service" type.');
    } else if (/\.i2p$/i.test(u.hostname)) {
      err(errors, field, 'address-wrong-type', 'This is an .i2p address; use the "I2P site" type.');
    }
    if (u.protocol === 'http:' && type !== 'local-server') {
      err(warnings, field, 'address-http', 'Address uses plain http://. Prefer https:// for clearnet mirrors.');
    }
    return u.href;
  }

  function checkOnion(value, errors) {
    var v = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (/^([a-z0-9-]+\.)*[a-z2-7]{56}\.onion$/.test(v)) return v;
    if (/^([a-z0-9-]+\.)*[a-z2-7]{16}\.onion$/.test(v)) {
      err(errors, 'address', 'onion-v2', 'This looks like a retired v2 onion address (16 characters). Only v3 (56 characters) works.');
    } else {
      err(errors, 'address', 'onion-invalid', 'Not a v3 onion address (56 letters a-z / digits 2-7, then .onion). Leave it empty until the operator\'s Tor creates it.');
    }
    return value;
  }

  function checkI2p(value, errors) {
    var v = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (/\.b32\.i2p$/.test(v)) {
      if (/^[a-z2-7]{52}\.b32\.i2p$/.test(v)) return v;
      err(errors, 'address', 'i2p-b32-invalid', 'A .b32.i2p address has 52 characters (a-z, 2-7) before .b32.i2p.');
      return value;
    }
    if (v.length <= 67 && /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+i2p$/.test(v)) return v;
    err(errors, 'address', 'i2p-invalid', 'Not an I2P address (.b32.i2p or name.i2p). Leave it empty until the operator\'s router creates it.');
    return value;
  }

  /*
   * Validate and normalise one destination record.
   * Returns { errors, warnings, normalized } where normalized keeps only
   * known fields. Secret-like values are reported as errors.
   */
  function validate(input) {
    var errors = [];
    var warnings = [];
    var src = input && typeof input === 'object' ? input : {};
    var d = createDestination(TYPES[src.type] ? src.type : 'static-host');
    Object.keys(src).forEach(function (k) {
      if (ALL_FIELDS.indexOf(k) === -1) {
        err(warnings, k, 'unknown-field', 'Ignored unknown field "' + String(k).slice(0, 40) + '"; it will not be exported.');
      }
    });
    if (!TYPES[src.type]) err(errors, 'type', 'type-invalid', 'Choose a destination type: ' + TYPE_KEYS.join(', ') + '.');

    STRING_FIELDS.forEach(function (k) {
      if (k === 'type') return;
      var v = src[k];
      if (v === undefined || v === null) v = '';
      if (typeof v !== 'string') {
        err(errors, k, 'not-text', 'Field "' + k + '" must be text.');
        v = '';
      }
      v = k === 'notes' ? v.replace(/\r\n?/g, '\n') : v.trim();
      if (v.length > FIELD_LIMITS[k]) {
        err(errors, k, 'too-long', 'Field "' + k + '" is longer than ' + FIELD_LIMITS[k] + ' characters.');
        v = v.slice(0, FIELD_LIMITS[k]);
      }
      var ctl = k === 'notes' ? /[\u0000-\u0008\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f\u2028\u2029]/;
      if (ctl.test(v)) err(errors, k, 'control-char', 'Field "' + k + '" contains control characters.');
      d[k] = v;
      var secret = findSecretLike(v);
      if (secret) {
        err(errors, k, 'secret-like', 'Field "' + k + '" looks like it contains ' + secret + '. Remove it — the planner never stores or exports credentials or keys. If it is not secret, rephrase it.');
      }
    });

    var t = d.type;
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(d.id)) {
      err(errors, 'id', 'id-invalid', 'Id must be 1-48 lowercase letters, digits or "-", starting with a letter or digit.');
    }
    TYPES[t].required.forEach(function (k) {
      if (!d[k]) err(errors, k, 'required', requiredMessage(t, k));
    });

    var bp = paths.validateBasePath(d.basePath);
    if (bp.ok) d.basePath = bp.value;
    else bp.errors.forEach(function (e) { err(errors, 'basePath', e.code, e.message); });

    if (d.address) {
      if (t === 'static-host' || t === 'local-server') d.address = checkUrl(d.address, 'address', errors, warnings, t);
      else if (t === 'tor-onion') d.address = checkOnion(d.address, errors);
      else if (t === 'i2p') d.address = checkI2p(d.address, errors);
    } else if (t === 'tor-onion' || t === 'i2p') {
      err(warnings, 'address', 'address-pending', 'Address pending: it is created by the operator\'s own ' + (t === 'i2p' ? 'I2P router' : 'Tor') + ' when they set the service up. This planner never creates one.');
    }

    if (t !== 'static-host') {
      if (d.serverSoftware && ['nginx', 'caddy', 'other'].indexOf(d.serverSoftware) === -1) {
        err(errors, 'serverSoftware', 'enum', 'Web server software must be nginx, caddy or other.');
      }
      if (d.listen) {
        var l = parseListen(d.listen);
        if (!l) {
          err(errors, 'listen', 'listen-invalid', 'Listen address must look like 127.0.0.1:8080 or [::1]:8080 (port 1-65535).');
        } else if ((t === 'tor-onion' || t === 'i2p') && !isLoopbackHost(l.host)) {
          err(errors, 'listen', 'listen-not-loopback', 'For Tor/I2P the local web server must listen on loopback only (127.0.0.1, [::1] or localhost) so it is not reachable directly.');
        } else if (l.host === '0.0.0.0' || l.host === '[::]') {
          err(warnings, 'listen', 'listen-all-interfaces', 'Listening on all interfaces exposes the server to every network the machine is on. Make sure that is intended.');
        }
      }
      if (d.documentRoot) {
        var dr = d.documentRoot.replace(/\/+$/, '') || '/';
        if (!/^\/[A-Za-z0-9._\/-]*$/.test(dr) || /(^|\/)\.\.?(\/|$)/.test(dr) || dr.indexOf('//') !== -1) {
          err(errors, 'documentRoot', 'docroot-invalid', 'Document root must be an absolute path using letters, digits and . _ - / only, without "." or ".." segments.');
        } else if (dr === '/' || /^\/(etc|root|home|var\/lib\/tor|var\/lib\/i2pd?|boot|proc|sys|dev|bin|sbin|usr)\/?$/.test(dr)) {
          err(errors, 'documentRoot', 'docroot-unsafe', 'Choose a dedicated folder for the site (e.g. /srv/mirror/site), not a system or key directory.');
        }
        d.documentRoot = dr;
      }
    }
    if (t === 'i2p' && d.router && ['i2pd', 'java-i2p'].indexOf(d.router) === -1) {
      err(errors, 'router', 'enum', 'I2P router must be i2pd or java-i2p.');
    }

    var mf = src.maxFileMB;
    if (mf === '' || mf === undefined || mf === null) {
      d.maxFileMB = null;
    } else {
      var num = typeof mf === 'number' ? mf : Number(mf);
      if (!isFinite(num) || num <= 0 || num > 1000000) {
        err(errors, 'maxFileMB', 'maxfile-invalid', 'Declared max file size must be a positive number of MiB (or empty for unknown).');
        d.maxFileMB = null;
      } else {
        d.maxFileMB = num;
      }
    }

    var caps = src.capabilities && typeof src.capabilities === 'object' ? src.capabilities : {};
    CAP_KEYS.forEach(function (k) {
      var v = caps[k] === undefined ? 'unknown' : caps[k];
      if (CAP_VALUES.indexOf(v) === -1) {
        err(errors, 'capabilities.' + k, 'cap-invalid', 'Capability "' + k + '" must be yes, no or unknown.');
        v = 'unknown';
      }
      d.capabilities[k] = v;
    });
    Object.keys(caps).forEach(function (k) {
      if (CAP_KEYS.indexOf(k) === -1) err(warnings, 'capabilities.' + k, 'unknown-capability', 'Ignored unknown capability "' + String(k).slice(0, 40) + '".');
    });

    return { errors: errors, warnings: warnings, normalized: d };
  }

  function requiredMessage(type, k) {
    var m = {
      name: 'Give this destination a name.',
      providerLabel: 'Enter the hosting provider name as you know it (free text; not looked up).',
      address: 'Enter the site URL you expect on this host (e.g. https://mirror.example.org/). It is not checked.',
      serverSoftware: 'Choose the web server software (nginx, caddy or other).',
      listen: 'Enter the local listen address, e.g. 127.0.0.1:8080.',
      documentRoot: 'Enter the absolute folder the operator will copy the site into.',
      router: 'Choose the I2P router (i2pd or java-i2p).'
    };
    return m[k] || ('Field "' + k + '" is required for ' + TYPES[type].label + '.');
  }

  // Check ids across a list; returns [{index, field, code, message}].
  function validateList(list) {
    var problems = [];
    if (list.length > MAX_DESTINATIONS) {
      problems.push({ index: -1, field: '', code: 'too-many', message: 'At most ' + MAX_DESTINATIONS + ' destinations.' });
    }
    var seen = {};
    list.forEach(function (d, i) {
      if (seen[d.id] !== undefined) problems.push({ index: i, field: 'id', code: 'id-duplicate', message: 'Id "' + d.id + '" is used twice.' });
      seen[d.id] = i;
    });
    return problems;
  }

  function capRequirement(key, level, declared, detail) {
    return { key: key, level: level, declared: declared, satisfied: declared, detail: detail };
  }

  /*
   * Compare one destination against the site and plan settings.
   * ctx: { facts, stats, requiredHeaders } (facts/stats null if no site yet).
   * Returns { status, statusLabel, verified:false, errors, warnings, requirements, missing, blockers, unknowns, normalized }.
   */
  function evaluate(dest, ctx) {
    ctx = ctx || {};
    var v = validate(dest);
    var d = v.normalized;
    var c = d.capabilities;
    var facts = ctx.facts || null;
    var stats = ctx.stats || null;
    var headerCount = (ctx.requiredHeaders || []).length;
    var anon = d.type === 'tor-onion' || d.type === 'i2p';
    var reqs = [];
    var na = function (key, why) { return { key: key, level: 'n/a', declared: c[key], satisfied: 'n/a', detail: why }; };

    reqs.push(!facts || facts.hasAnyIndex
      ? capRequirement('directoryIndex', 'required', c.directoryIndex, 'Site uses index.html pages.')
      : na('directoryIndex', 'Site has no index.html pages.'));
    reqs.push(headerCount
      ? capRequirement('customHeaders', 'required', c.customHeaders, headerCount + ' required response header(s) in plan settings.')
      : na('customHeaders', 'No required headers configured.'));
    reqs.push(capRequirement('correctMimeTypes', 'required', c.correctMimeTypes, 'Files must be served with the Content-Type listed in the plan.'));
    reqs.push(d.basePath !== '/'
      ? capRequirement('subpathHosting', 'required', c.subpathHosting, 'Base path is ' + d.basePath + '.')
      : na('subpathHosting', 'Base path is "/".'));

    var sizeReq = { key: 'maxFileMB', level: 'required', declared: d.maxFileMB, satisfied: 'unknown', detail: '' };
    if (!stats) {
      sizeReq.detail = 'Load a site to compare against the largest file.';
      sizeReq.satisfied = d.maxFileMB === null ? 'unknown' : 'yes';
    } else {
      var needMiB = Math.max(1, Math.ceil(stats.largestFileBytes / MiB));
      sizeReq.detail = 'Largest file is ' + stats.largestFileBytes + ' bytes (needs ≥ ' + needMiB + ' MiB).';
      if (d.maxFileMB === null) sizeReq.satisfied = 'unknown';
      else sizeReq.satisfied = d.maxFileMB * MiB >= stats.largestFileBytes ? 'yes' : 'no';
    }
    reqs.push(sizeReq);

    reqs.push(!facts || facts.has404
      ? capRequirement('customErrorPages', 'recommended', c.customErrorPages, 'Site has a 404.html page.')
      : na('customErrorPages', 'Site has no root 404.html.'));
    reqs.push(anon
      ? na('https', 'Tor/I2P encrypt transport; HTTPS is not needed for this type.')
      : capRequirement('https', 'recommended', c.https, 'Clearnet visitors should get HTTPS.'));
    reqs.push(anon
      ? capRequirement('minimalLogging', 'recommended', c.minimalLogging, 'Keep request logs off or minimal for Tor/I2P visitors.')
      : capRequirement('minimalLogging', 'optional', c.minimalLogging, 'Optional for clearnet mirrors.'));

    var blockers = [];
    var unknowns = [];
    reqs.forEach(function (r) {
      if (r.level !== 'required') return;
      if (r.satisfied === 'no') blockers.push(r);
      else if (r.satisfied === 'unknown') unknowns.push(r);
    });

    var warnings = v.warnings.slice();
    reqs.forEach(function (r) {
      if (r.level === 'recommended' && r.satisfied !== 'yes') {
        err(warnings, r.key, 'recommended-' + r.satisfied, 'Recommended: ' + r.key + ' (declared ' + r.declared + '). ' + r.detail);
      }
    });
    if (facts && d.basePath !== '/' && facts.rootRelativeRefCount > 0) {
      err(warnings, 'basePath', 'root-relative-under-subpath', 'Site has ' + facts.rootRelativeRefCount + ' root-relative reference(s); they will point outside ' + d.basePath + '. The planner does not rewrite files — fix the site build or use base path "/".');
    }
    if (facts && anon && facts.externalHosts && facts.externalHosts.length) {
      err(warnings, 'site', 'external-refs-anon', 'Site references ' + facts.externalHosts.length + ' external host(s). Over ' + (d.type === 'i2p' ? 'I2P' : 'Tor') + ' these may not load, or may expose visitors to those hosts. Review before publishing.');
    }

    var status;
    if (v.errors.length) status = STATUS.INCOMPLETE;
    else if (blockers.length) status = STATUS.BLOCKED;
    else if (unknowns.length) status = STATUS.UNVERIFIED;
    else status = STATUS.READY;

    return {
      status: status,
      statusLabel: STATUS_LABELS[status],
      verified: false,
      errors: v.errors,
      warnings: warnings,
      requirements: reqs,
      missing: v.errors,
      blockers: blockers,
      unknowns: unknowns,
      normalized: d
    };
  }

  // Copy of a normalized destination with secret-like fields redacted.
  function redactForExport(dest) {
    var d = validate(dest).normalized;
    var out = {};
    ALL_FIELDS.forEach(function (k) {
      if (k === 'capabilities') {
        out.capabilities = {};
        CAP_KEYS.forEach(function (c) { out.capabilities[c] = d.capabilities[c]; });
      } else if (typeof d[k] === 'string' && findSecretLike(d[k])) {
        out[k] = '[REDACTED: looked like a credential]';
      } else {
        out[k] = d[k];
      }
    });
    return out;
  }

  /*
   * Parse an imported destinations JSON file (array, or {destinations:[...]}).
   * Returns { destinations, errors, warnings }. Never throws.
   */
  function parseImport(text, existingIds) {
    var errors = [];
    var warnings = [];
    if (typeof text !== 'string') return { destinations: [], errors: ['Import must be text.'], warnings: warnings };
    var size = typeof TextEncoder === 'function' ? new TextEncoder().encode(text).length : text.length;
    if (size > MAX_IMPORT_BYTES) {
      return { destinations: [], errors: ['Import file is ' + size + ' bytes; the limit is ' + MAX_IMPORT_BYTES + '.'], warnings: warnings };
    }
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { destinations: [], errors: ['Import is not valid JSON: ' + e.message], warnings: warnings };
    }
    var list = Array.isArray(data) ? data : data && Array.isArray(data.destinations) ? data.destinations : null;
    if (!list) return { destinations: [], errors: ['Expected a JSON array of destinations, or an object with a "destinations" array.'], warnings: warnings };
    var room = MAX_DESTINATIONS - (existingIds || []).length;
    if (list.length > room) {
      warnings.push('Only the first ' + Math.max(room, 0) + ' destination(s) were imported (limit ' + MAX_DESTINATIONS + ').');
      list = list.slice(0, Math.max(room, 0));
    }
    var ids = (existingIds || []).slice();
    var out = [];
    list.forEach(function (raw, i) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        errors.push('Item ' + (i + 1) + ' is not an object; skipped.');
        return;
      }
      var v = validate(raw);
      var d = v.normalized;
      if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(d.id) || ids.indexOf(d.id) !== -1) {
        var old = d.id;
        d.id = uniqueId(d.name || d.type, ids);
        if (old) warnings.push('Item ' + (i + 1) + ': id "' + String(old).slice(0, 48) + '" was invalid or taken; using "' + d.id + '".');
      }
      v.warnings.forEach(function (w) {
        if (w.code === 'unknown-field' || w.code === 'unknown-capability') warnings.push('Item ' + (i + 1) + ': ' + w.message);
      });
      // Never import a secret-like value, even into the working copy.
      STRING_FIELDS.forEach(function (k) {
        if (typeof d[k] === 'string' && findSecretLike(d[k])) {
          warnings.push('Item ' + (i + 1) + ': field "' + k + '" looked like a credential and was cleared.');
          d[k] = '';
        }
      });
      ids.push(d.id);
      out.push(d);
    });
    return { destinations: out, errors: errors, warnings: warnings };
  }

  return {
    TYPES: TYPES,
    TYPE_KEYS: TYPE_KEYS,
    STATUS: STATUS,
    STATUS_LABELS: STATUS_LABELS,
    CAPABILITIES: CAPABILITIES,
    CAP_KEYS: CAP_KEYS,
    CAP_VALUES: CAP_VALUES,
    FIELDS: FIELDS,
    MAX_DESTINATIONS: MAX_DESTINATIONS,
    MAX_IMPORT_BYTES: MAX_IMPORT_BYTES,
    findSecretLike: findSecretLike,
    createDestination: createDestination,
    uniqueId: uniqueId,
    validate: validate,
    validateList: validateList,
    evaluate: evaluate,
    redactForExport: redactForExport,
    parseImport: parseImport,
    parseListen: parseListen,
    isLoopbackHost: isLoopbackHost
  };
});
