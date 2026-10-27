/*
 * Offline Mirror Planner — destination types, user-declared capabilities,
 * validation, capability comparison and readiness states.
 *
 * Every address and capability here is USER-DECLARED. Nothing is looked up,
 * contacted or verified. Unknown is the default for every capability.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'));
  } else {
    root.OMP = root.OMP || {};
    root.OMP.destinations = factory(root.OMP.core);
  }
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';

  var L = core.LIMITS;

  var DECLARED = ['unknown', 'yes', 'no'];

  var STATES = Object.freeze({
    NEEDS_CONFIGURATION: 'needs-configuration',
    BLOCKED: 'blocked-by-declared-capability',
    UNVERIFIED: 'unverified',
    READY: 'ready-for-manual-review'
  });

  var STATE_LABELS = {
    'needs-configuration': 'Needs configuration',
    'blocked-by-declared-capability': 'Blocked (a required capability is declared unsupported)',
    'unverified': 'Unverified (required capabilities still unknown)',
    'ready-for-manual-review': 'Ready for manual review (user-declared, not verified)'
  };

  // ------------------------------------------------------- capabilities

  var CAPABILITIES = [
    { key: 'byte-exact-delivery', label: 'Serves files byte-for-byte (no minify, injection or rewriting)', help: 'Transfer compression is fine; altering file contents is not, or the SHA-256 manifest will not match.' },
    { key: 'custom-headers', label: 'Can send the plan\'s custom response headers', help: 'Needed for the security headers listed in the plan.' },
    { key: 'content-type-control', label: 'Sends correct Content-Type for every file extension in the site', help: 'Either by default or through configurable MIME mappings.' },
    { key: 'directory-index', label: 'Serves index.html for directory URLs', help: 'e.g. /about/ returns /about/index.html.' },
    { key: 'subdirectory-base-path', label: 'Can serve the site under the chosen base path', help: 'Only required when the base path is not "/".' },
    { key: 'custom-404', label: 'Can use the site\'s own 404.html', help: 'Recommended when the site has a 404.html.' },
    { key: 'tls-https', label: 'Serves over HTTPS with a valid certificate', help: 'Not applicable to onion and I2P destinations, which have their own transport encryption.' },
    { key: 'log-retention-control', label: 'Operator controls access-log retention', help: 'Recommended for privacy-sensitive mirrors.' },
    { key: 'file-size-limit', label: 'Per-file size limit accommodates the largest site file', help: 'Derived from the declared maximum file size, when entered.' },
    { key: 'file-count-limit', label: 'File-count limit accommodates the site', help: 'Derived from the declared maximum file count, when entered.' }
  ];
  var CAP_INDEX = {};
  CAPABILITIES.forEach(function (c) { CAP_INDEX[c.key] = c; });
  // Capabilities derived from numeric fields rather than a tri-state select.
  var DERIVED_CAPS = { 'file-size-limit': 1, 'file-count-limit': 1 };

  // ---------------------------------------------------------- types

  var TYPES = {
    'generic-static': {
      label: 'Generic static hosting',
      summary: 'Any static file host the operator chooses. Provider features are unknown until the operator declares them from the provider\'s own documentation.',
      fields: [
        { key: 'providerName', label: 'Provider name (free text, optional)', kind: 'text', max: L.maxLabelLength },
        { key: 'address', label: 'Public base URL (https://…)', kind: 'url', max: L.maxAddressLength, required: true },
        { key: 'deployMethod', label: 'How the operator will copy files (free text, optional)', kind: 'text', max: L.maxShortFieldLength },
        { key: 'declaredMaxFileBytes', label: 'Declared max file size in bytes (optional)', kind: 'int' },
        { key: 'declaredMaxFiles', label: 'Declared max file count (optional)', kind: 'int' }
      ]
    },
    'local-server': {
      label: 'Operator-managed local web server',
      summary: 'A web server the operator runs on their own machine (nginx, Caddy, Apache or other). Templates are inert text for review.',
      fields: [
        { key: 'serverSoftware', label: 'Server software', kind: 'enum', options: ['nginx', 'caddy', 'apache', 'other'], required: true },
        { key: 'listenAddress', label: 'Listen address (host:port, e.g. 127.0.0.1:8080)', kind: 'hostport', max: 64, required: true },
        { key: 'documentRoot', label: 'Document root on the server (absolute path)', kind: 'abspath', max: L.maxShortFieldLength, required: true },
        { key: 'publicUrl', label: 'Public URL if exposed beyond this machine (optional)', kind: 'url', max: L.maxAddressLength }
      ]
    },
    'tor-onion': {
      label: 'Tor onion service',
      summary: 'Inert torrc template only. The operator\'s own Tor creates the onion identity; this planner never creates keys or starts services.',
      fields: [
        { key: 'addressMode', label: 'Onion address', kind: 'enum', options: ['pending-operator', 'entered'], required: true },
        { key: 'address', label: 'Onion address (v3, 56 characters + .onion) — only if already created by the operator', kind: 'onion', max: 70 },
        { key: 'localTarget', label: 'Local web server target (127.0.0.1:port or unix:/path)', kind: 'target', max: L.maxShortFieldLength, required: true },
        { key: 'virtualPort', label: 'Onion virtual port', kind: 'port', required: true },
        { key: 'hiddenServiceDir', label: 'HiddenServiceDir chosen by the operator (absolute path)', kind: 'abspath', max: L.maxShortFieldLength, required: true }
      ]
    },
    'i2p': {
      label: 'I2P site (server tunnel)',
      summary: 'Inert tunnel template only. The operator\'s own I2P router creates the destination keys; this planner never creates identities or starts services.',
      fields: [
        { key: 'router', label: 'I2P router software', kind: 'enum', options: ['i2pd', 'java-i2p'], required: true },
        { key: 'addressMode', label: 'I2P address', kind: 'enum', options: ['pending-operator', 'entered'], required: true },
        { key: 'address', label: 'I2P address (.b32.i2p or registered .i2p name) — only if already created by the operator', kind: 'i2p', max: 80 },
        { key: 'localTarget', label: 'Local web server target (127.0.0.1:port)', kind: 'target', max: L.maxShortFieldLength, required: true },
        { key: 'tunnelName', label: 'Tunnel name (letters, digits, . _ -)', kind: 'token', max: 64, required: true },
        { key: 'keysFile', label: 'i2pd keys file name (created by i2pd, never by this planner)', kind: 'keysfile', max: 64, requiredFor: { router: 'i2pd' } }
      ]
    }
  };
  var TYPE_KEYS = Object.keys(TYPES);

  // Which capabilities apply to which type ('n/a' otherwise).
  var TYPE_CAPS = {
    'generic-static': ['byte-exact-delivery', 'custom-headers', 'content-type-control', 'directory-index', 'subdirectory-base-path', 'custom-404', 'tls-https', 'log-retention-control', 'file-size-limit', 'file-count-limit'],
    'local-server': ['byte-exact-delivery', 'custom-headers', 'content-type-control', 'directory-index', 'subdirectory-base-path', 'custom-404', 'tls-https', 'log-retention-control'],
    'tor-onion': ['byte-exact-delivery', 'custom-headers', 'content-type-control', 'directory-index', 'subdirectory-base-path', 'custom-404', 'log-retention-control'],
    'i2p': ['byte-exact-delivery', 'custom-headers', 'content-type-control', 'directory-index', 'subdirectory-base-path', 'custom-404', 'log-retention-control']
  };

  // ---------------------------------------------------------- helpers

  function newId() {
    var bytes = new Uint8Array(6);
    var c = (typeof globalThis !== 'undefined' && globalThis.crypto) || (typeof self !== 'undefined' && self.crypto);
    if (c && c.getRandomValues) c.getRandomValues(bytes);
    else for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    var s = 'd-';
    for (var j = 0; j < bytes.length; j++) s += ('0' + bytes[j].toString(16)).slice(-2);
    return s;
  }

  function isValidId(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id); }

  function slugify(s) {
    var out = String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return out || 'destination';
  }

  var CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;

  function str(v, max) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'number' || typeof v === 'boolean') v = String(v);
    if (typeof v !== 'string') return '';
    v = v.trim();
    // Keep one extra character so validation can report "too long" instead of silently truncating.
    return v.length > max + 1 ? v.slice(0, max + 1) : v;
  }

  function defaultsFor(type) {
    switch (type) {
      case 'generic-static': return { providerName: '', address: '', deployMethod: '', declaredMaxFileBytes: '', declaredMaxFiles: '' };
      case 'local-server': return { serverSoftware: 'nginx', listenAddress: '127.0.0.1:8080', documentRoot: '', publicUrl: '' };
      case 'tor-onion': return { addressMode: 'pending-operator', address: '', localTarget: '127.0.0.1:8080', virtualPort: '80', hiddenServiceDir: '' };
      case 'i2p': return { router: 'i2pd', addressMode: 'pending-operator', address: '', localTarget: '127.0.0.1:8080', tunnelName: 'replikrazy-mirror', keysFile: 'replikrazy-mirror.dat' };
      default: return {};
    }
  }

  /** A fresh destination of the given type with every capability "unknown". */
  function createDestination(type, overrides) {
    if (!TYPES[type]) throw core.PlannerError('BAD_TYPE', 'Unknown destination type "' + core.safeDisplay(type) + '".');
    var caps = {};
    TYPE_CAPS[type].forEach(function (k) { if (!DERIVED_CAPS[k]) caps[k] = 'unknown'; });
    var d = { id: newId(), type: type, label: TYPES[type].label, basePath: '/', notes: '', config: defaultsFor(type), capabilities: caps };
    return overrides ? sanitizeDestination(merge(d, overrides)) : d;
  }

  function merge(base, over) {
    var out = JSON.parse(JSON.stringify(base));
    Object.keys(over || {}).forEach(function (k) {
      if ((k === 'config' || k === 'capabilities') && over[k] && typeof over[k] === 'object') {
        Object.keys(over[k]).forEach(function (kk) { out[k][kk] = over[k][kk]; });
      } else out[k] = over[k];
    });
    return out;
  }

  /**
   * Reduce arbitrary (possibly imported, possibly hostile) input to a
   * destination record containing only known fields of bounded size.
   * Unknown keys — including anything that looks like a password, token or
   * key field — are dropped. Returns null for unusable input.
   */
  function sanitizeDestination(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    var type = typeof raw.type === 'string' ? raw.type : '';
    if (!TYPES[type]) return null;
    var srcCfg = raw.config && typeof raw.config === 'object' ? raw.config : {};
    var cfg = defaultsFor(type);
    TYPES[type].fields.forEach(function (f) {
      if (!Object.prototype.hasOwnProperty.call(srcCfg, f.key)) return;
      cfg[f.key] = str(srcCfg[f.key], f.max || 32);
    });
    var caps = {};
    var srcCaps = raw.capabilities && typeof raw.capabilities === 'object' ? raw.capabilities : {};
    TYPE_CAPS[type].forEach(function (k) {
      if (DERIVED_CAPS[k]) return;
      var v = srcCaps[k];
      if (v && typeof v === 'object' && typeof v.declared === 'string') v = v.declared; // accept plan-export shape
      caps[k] = DECLARED.indexOf(v) !== -1 ? v : 'unknown';
    });
    return {
      id: isValidId(raw.id) ? raw.id : newId(),
      type: type,
      label: str(raw.label, L.maxLabelLength) || TYPES[type].label,
      basePath: str(raw.basePath, L.maxBasePathLength) || '/',
      notes: str(raw.notes, L.maxNotesLength),
      config: cfg,
      capabilities: caps
    };
  }

  // ------------------------------------------------------ field checks

  function parseHostPort(s) {
    var m = /^\[([0-9A-Fa-f:.]+)\]:(\d{1,5})$/.exec(s) || /^([A-Za-z0-9.-]+):(\d{1,5})$/.exec(s);
    if (!m) return null;
    var port = Number(m[2]);
    if (port < 1 || port > 65535) return null;
    var host = m[1].toLowerCase();
    if (!/^\[/.test(s)) {
      // IPv4 octets or hostname labels
      if (/^\d+(\.\d+){3}$/.test(host)) {
        if (host.split('.').some(function (o) { return Number(o) > 255 || (o.length > 1 && o[0] === '0'); })) return null;
      } else if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(host)) return null;
    }
    return { host: host, port: port };
  }

  function isLoopback(host) {
    return host === 'localhost' || /^127\.\d+\.\d+\.\d+$/.test(host) || host === '::1' || host === '0:0:0:0:0:0:0:1';
  }

  function isAbsPath(s) {
    if (/^\/[^\u0000]*$/.test(s)) return !/(^|\/)\.\.(\/|$)/.test(s);
    if (/^[A-Za-z]:\\/.test(s)) return !/(^|\\)\.\.(\\|$)/.test(s);
    return false;
  }

  function checkUrl(s, allowHttp) {
    var u;
    try { u = new URL(s); } catch (e) { return { error: 'Not a valid URL. Include the scheme, e.g. https://example.org/' }; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'Only http:// and https:// URLs are accepted.' };
    if (u.username || u.password) return { error: 'URL must not contain a username or password. Plans never carry credentials.' };
    if (u.search || u.hash || /[?#]/.test(s)) return { error: 'URL must not contain a query string or fragment.' };
    var host = u.hostname.toLowerCase();
    if (/\.onion$/.test(host)) return { error: 'Onion addresses belong in a "Tor onion service" destination.' };
    if (/\.i2p$/.test(host)) return { error: 'I2P addresses belong in an "I2P site" destination.' };
    var warn = [];
    if (u.protocol === 'http:' && !allowHttp) warn.push('Address uses plain http://; visitors\' traffic would be unencrypted.');
    return { url: u, warnings: warn };
  }

  // v3 onion: 56 base32 chars; the encoded version byte (0x03) makes the
  // last character "d". The SHA3 checksum is NOT verified here.
  var ONION_V3 = /^[a-z2-7]{55}d\.onion$/;
  var I2P_B32 = /^[a-z2-7]{52}\.b32\.i2p$/;
  var I2P_NAME = /^(?!-)([a-z0-9-]{1,63}\.)+i2p$/;

  /**
   * Validate a sanitized destination. Returns
   *   { errors: [{field, message}], warnings: [{field, message}],
   *     missing: [{field, label}], pending: [{field, message}] }
   * "missing" = required configuration not yet entered (blocks readiness).
   * "pending" = deliberately deferred to the operator (does not block).
   */
  function validateDestination(d) {
    var errors = [], warnings = [], missing = [], pending = [];
    function err(field, message) { errors.push({ field: field, message: message }); }
    function warn(field, message) { warnings.push({ field: field, message: message }); }

    if (!d || !TYPES[d.type]) return { errors: [{ field: 'type', message: 'Unknown destination type.' }], warnings: [], missing: [], pending: [] };
    var t = TYPES[d.type];
    var c = d.config || {};

    if (!d.label) missing.push({ field: 'label', label: 'Label' });
    else if (d.label.length > L.maxLabelLength) err('label', 'Label is longer than ' + L.maxLabelLength + ' characters.');
    else if (CONTROL.test(d.label)) err('label', 'Label contains control characters.');
    if (d.label && core.scanFieldForSecrets(d.label).length) err('label', 'Label looks like it contains a credential. Remove it.');

    if (d.notes && d.notes.length > L.maxNotesLength) err('notes', 'Notes are longer than ' + L.maxNotesLength + ' characters.');
    var noteHits = core.scanFieldForSecrets(d.notes);
    if (noteHits.length) err('notes', 'Notes look like they contain a credential (' + noteHits[0] + '). Remove it — plans never carry credentials. It will be redacted on export.');

    var bp = core.normaliseBasePath(d.basePath);
    if (!bp.ok) err('basePath', bp.reason);

    t.fields.forEach(function (f) {
      var v = c[f.key];
      var required = f.required || (f.requiredFor && Object.keys(f.requiredFor).every(function (k) { return c[k] === f.requiredFor[k]; }));
      if (v === undefined || v === null || v === '') {
        if (required) missing.push({ field: f.key, label: f.label });
        return;
      }
      if (typeof v === 'string' && f.max && v.length > f.max) { err(f.key, f.label + ': longer than ' + f.max + ' characters.'); return; }
      if (typeof v === 'string' && CONTROL.test(v)) { err(f.key, f.label + ': contains control characters.'); return; }
      if (typeof v === 'string' && f.kind === 'text' && core.scanFieldForSecrets(v).length) { err(f.key, f.label + ': looks like it contains a credential. Remove it.'); return; }
      switch (f.kind) {
        case 'enum':
          if (f.options.indexOf(v) === -1) err(f.key, f.label + ': must be one of ' + f.options.join(', ') + '.');
          break;
        case 'int':
          if (!/^\d{1,13}$/.test(String(v))) err(f.key, f.label + ': must be a whole number.');
          break;
        case 'port':
          if (!/^\d{1,5}$/.test(String(v)) || Number(v) < 1 || Number(v) > 65535) err(f.key, f.label + ': must be a port number from 1 to 65535.');
          break;
        case 'url': {
          var r = checkUrl(v, d.type === 'local-server');
          if (r.error) err(f.key, r.error);
          else {
            r.warnings.forEach(function (w) { warn(f.key, w); });
            var p = r.url.pathname;
            if (bp.ok && p !== '/' && p !== bp.basePath) warn(f.key, 'URL path "' + p + '" differs from the base path "' + bp.basePath + '". The plan uses the URL origin plus the base path.');
          }
          break;
        }
        case 'hostport': {
          var hp = parseHostPort(v);
          if (!hp) err(f.key, f.label + ': expected host:port, e.g. 127.0.0.1:8080 or [::1]:8080.');
          else if (hp.host === '0.0.0.0' || hp.host === '::') warn(f.key, 'Listening on all interfaces exposes the server to your network. Prefer 127.0.0.1 unless that is intended.');
          break;
        }
        case 'target': {
          if (/^unix:\//.test(v)) {
            if (d.type === 'i2p') err(f.key, 'Use a 127.0.0.1:port target for I2P tunnels.');
            else if (!isAbsPath(v.slice(5))) err(f.key, 'unix: target must be an absolute socket path.');
            break;
          }
          var tp = parseHostPort(v);
          if (!tp) err(f.key, f.label + ': expected 127.0.0.1:port' + (d.type === 'tor-onion' ? ' or unix:/path' : '') + '.');
          else if (!isLoopback(tp.host)) err(f.key, 'Target must be a loopback address (127.0.0.1, ::1 or localhost) so the web server is not exposed outside this machine.');
          break;
        }
        case 'abspath':
          if (!isAbsPath(v)) err(f.key, f.label + ': must be an absolute path without ".." segments.');
          break;
        case 'onion':
          if (/^[a-z2-7]{16}\.onion$/.test(v)) err(f.key, 'This is a retired v2 onion address. Only v3 (56 characters) is supported by current Tor.');
          else if (!ONION_V3.test(v)) err(f.key, 'Not a v3 onion address (56 lowercase base32 characters ending in "d", then ".onion").');
          break;
        case 'i2p':
          if (!I2P_B32.test(v) && !(I2P_NAME.test(v) && !/\.b32\.i2p$/.test(v) && v.length <= 67)) err(f.key, 'Not an I2P address (52 base32 characters + ".b32.i2p", or a registered name ending in ".i2p").');
          break;
        case 'token':
          if (!/^[A-Za-z0-9._-]{1,64}$/.test(v)) err(f.key, f.label + ': only letters, digits and . _ - are allowed.');
          break;
        case 'keysfile':
          if (!/^[A-Za-z0-9._-]{1,60}\.dat$/.test(v)) err(f.key, f.label + ': must be a plain file name ending in .dat (no directories).');
          break;
      }
    });

    // Address mode for onion / I2P.
    if (d.type === 'tor-onion' || d.type === 'i2p') {
      if (c.addressMode === 'entered' && !c.address) missing.push({ field: 'address', label: 'Address (marked as entered but empty)' });
      if (c.addressMode === 'pending-operator') {
        pending.push({ field: 'address', message: 'Address will be created by the operator\'s own ' + (d.type === 'i2p' ? 'I2P router' : 'Tor') + ' and entered later. The planner never creates it.' });
        if (c.address) warn('address', 'An address is filled in but the mode is "pending-operator"; it will be ignored. Switch the mode to "entered" to use it.');
      }
      if (c.hiddenServiceDir && /(^|\/)(www|html|public|htdocs|public_html|site|dist)(\/|$)/i.test(c.hiddenServiceDir)) {
        err('hiddenServiceDir', 'HiddenServiceDir looks like it is inside a web-served folder. Keys must never be reachable from the web server.');
      }
    }
    if (d.type === 'local-server' && c.documentRoot && /^\/(etc|root|home\/[^/]+\/?$|var\/lib\/tor)/.test(c.documentRoot)) {
      warn('documentRoot', 'Document root is a system or home directory; use a dedicated folder for the mirror.');
    }
    return { errors: errors, warnings: warnings, missing: missing, pending: pending };
  }

  // ------------------------------------------------- requirement levels

  /**
   * Requirement level for each capability given the site and destination.
   * ctx: { inventory (may be null), headers: [...] }
   */
  function requirementLevel(capKey, d, ctx) {
    if (TYPE_CAPS[d.type].indexOf(capKey) === -1) return 'not-applicable';
    var inv = ctx && ctx.inventory;
    var paths = inv ? inv.files.map(function (f) { return f.path; }) : [];
    var bp = core.normaliseBasePath(d.basePath);
    switch (capKey) {
      case 'byte-exact-delivery': return 'required';
      case 'content-type-control': return 'required';
      case 'custom-headers': return ctx && ctx.headers && ctx.headers.length ? 'required' : 'recommended';
      case 'directory-index': return !inv || paths.some(function (p) { return /(^|\/)index\.html?$/.test(p); }) ? 'required' : 'recommended';
      case 'subdirectory-base-path': return bp.ok && bp.basePath !== '/' ? 'required' : 'not-applicable';
      case 'custom-404': return paths.indexOf('404.html') !== -1 ? 'recommended' : 'not-applicable';
      case 'tls-https':
        if (d.type === 'generic-static') return 'required';
        if (d.type === 'local-server') return /^https:/i.test(d.config.publicUrl || '') ? 'required' : 'not-applicable';
        return 'not-applicable';
      case 'log-retention-control': return 'recommended';
      case 'file-size-limit': return inv ? 'required' : 'not-applicable';
      case 'file-count-limit': return inv ? 'required' : 'not-applicable';
    }
    return 'not-applicable';
  }

  function declaredFor(capKey, d, ctx) {
    if (capKey === 'file-size-limit' || capKey === 'file-count-limit') {
      var field = capKey === 'file-size-limit' ? 'declaredMaxFileBytes' : 'declaredMaxFiles';
      var raw = d.config[field];
      if (raw === '' || raw === undefined || !/^\d{1,13}$/.test(String(raw))) return { declared: 'unknown', detail: 'No declared limit entered.' };
      var inv = ctx && ctx.inventory;
      if (!inv) return { declared: 'unknown', detail: 'No site inventory yet.' };
      var need = capKey === 'file-size-limit' ? inv.totals.largestFileBytes : inv.totals.fileCount;
      var have = Number(raw);
      var okay = have >= need;
      var detail = capKey === 'file-size-limit'
        ? 'Declared ' + core.formatBytes(have) + ' per file; largest site file is ' + core.formatBytes(need) + '.'
        : 'Declared ' + have + ' files; site has ' + need + '.';
      return { declared: okay ? 'yes' : 'no', detail: detail };
    }
    var v = d.capabilities[capKey];
    return { declared: DECLARED.indexOf(v) !== -1 ? v : 'unknown', detail: '' };
  }

  /**
   * Compare one destination against the site and plan settings.
   * Returns the capability rows, missing configuration and readiness state.
   * State is NEVER "verified": the best possible state is
   * "ready-for-manual-review", meaning every required item is user-declared.
   */
  function assessDestination(d, ctx) {
    var v = validateDestination(d);
    var rows = CAPABILITIES.map(function (cap) {
      var level = requirementLevel(cap.key, d, ctx);
      var dec = level === 'not-applicable' ? { declared: 'n/a', detail: '' } : declaredFor(cap.key, d, ctx);
      var status;
      if (level === 'not-applicable') status = 'n/a';
      else if (dec.declared === 'yes') status = 'declared-supported';
      else if (dec.declared === 'no') status = level === 'required' ? 'declared-unsupported-blocking' : 'declared-unsupported';
      else status = level === 'required' ? 'unknown-blocking' : 'unknown';
      return { key: cap.key, label: cap.label, level: level, declared: dec.declared, status: status, detail: dec.detail };
    });

    var warnings = v.warnings.slice();
    var inv = ctx && ctx.inventory;
    var bp = core.normaliseBasePath(d.basePath);
    if (inv && bp.ok && bp.basePath !== '/' && inv.rootAbsoluteLinkFiles && inv.rootAbsoluteLinkFiles.length) {
      warnings.push({ field: 'basePath', message: inv.rootAbsoluteLinkFiles.length + ' file(s) use root-absolute links ("/…") that will break under base path "' + bp.basePath + '". The planner does not rewrite site bytes; fix links in the source site or use base path "/".' });
    }
    if ((d.type === 'tor-onion' || d.type === 'i2p') && inv && inv.externalReferenceFiles && inv.externalReferenceFiles.length) {
      warnings.push({ field: '', message: inv.externalReferenceFiles.length + ' file(s) reference external hosts. On ' + TYPES[d.type].label + ' those requests would leave the overlay network or fail. Prefer self-contained pages.' });
    }

    var blocking = rows.filter(function (r) { return r.status === 'declared-unsupported-blocking'; });
    var unknownRequired = rows.filter(function (r) { return r.status === 'unknown-blocking'; });
    var state;
    if (v.errors.length || v.missing.length) state = STATES.NEEDS_CONFIGURATION;
    else if (blocking.length) state = STATES.BLOCKED;
    else if (unknownRequired.length) state = STATES.UNVERIFIED;
    else state = STATES.READY;

    return {
      id: d.id,
      state: state,
      stateLabel: STATE_LABELS[state],
      verified: false,
      capabilities: rows,
      errors: v.errors,
      warnings: warnings,
      missing: v.missing,
      pending: v.pending,
      blockingCapabilities: blocking.map(function (r) { return r.key; }),
      unknownRequiredCapabilities: unknownRequired.map(function (r) { return r.key; })
    };
  }

  /** Effective base URL from user-entered data, or null if not known yet. */
  function effectiveBaseUrl(d) {
    var bp = core.normaliseBasePath(d.basePath);
    if (!bp.ok) return null;
    var c = d.config || {};
    if (d.type === 'generic-static' || (d.type === 'local-server' && c.publicUrl)) {
      try {
        var u = new URL(d.type === 'generic-static' ? c.address : c.publicUrl);
        if (u.username || u.password) return null;
        return u.origin + bp.basePath;
      } catch (e) { return null; }
    }
    if (d.type === 'local-server') {
      var hp = parseHostPort(c.listenAddress || '');
      return hp ? 'http://' + (c.listenAddress) + bp.basePath : null;
    }
    if ((d.type === 'tor-onion' && c.addressMode === 'entered' && ONION_V3.test(c.address || '')) ||
        (d.type === 'i2p' && c.addressMode === 'entered' && (I2P_B32.test(c.address || '') || I2P_NAME.test(c.address || '')))) {
      return 'http://' + c.address + bp.basePath;
    }
    return null;
  }

  function capabilityKeysFor(type) { return TYPE_CAPS[type] ? TYPE_CAPS[type].filter(function (k) { return !DERIVED_CAPS[k]; }) : []; }

  return {
    TYPES: TYPES,
    TYPE_KEYS: TYPE_KEYS,
    CAPABILITIES: CAPABILITIES,
    CAP_INDEX: CAP_INDEX,
    DECLARED: DECLARED,
    STATES: STATES,
    STATE_LABELS: STATE_LABELS,
    capabilityKeysFor: capabilityKeysFor,
    createDestination: createDestination,
    sanitizeDestination: sanitizeDestination,
    validateDestination: validateDestination,
    requirementLevel: requirementLevel,
    assessDestination: assessDestination,
    effectiveBaseUrl: effectiveBaseUrl,
    parseHostPort: parseHostPort,
    isLoopback: isLoopback,
    slugify: slugify,
    newId: newId,
    isValidId: isValidId
  };
});
