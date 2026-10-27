/*
 * Offline Mirror Planner — deployment plan JSON, per-destination operator
 * instructions, inert configuration templates, and plan/destination import.
 *
 * Output is text only. Nothing here starts a service, creates an identity,
 * contacts a host or writes outside the returned strings.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'), require('./destinations.js'));
  } else {
    root.OMP = root.OMP || {};
    root.OMP.plan = factory(root.OMP.core, root.OMP.destinations);
  }
})(typeof self !== 'undefined' ? self : this, function (core, dest) {
  'use strict';

  var SCHEMA = 'replikrazy.offline-mirror-plan';
  var SCHEMA_VERSION = 1;
  var DEST_SCHEMA = 'replikrazy.offline-mirror-destinations';

  var NOTICE = 'PLANNING ARTIFACT ONLY. Generated offline by the Replikrazy Offline Mirror Planner. ' +
    'Nothing was uploaded, published, registered, deployed or verified. No network request was made. ' +
    'Every address and capability in this plan was entered by a person and is unverified.';

  var LIMITATIONS = [
    'The planner performs no network requests and verifies nothing. Every address and capability is as entered by a person; "ready-for-manual-review" means every required item was declared, not that it was checked.',
    'Mirrors are separate web origins. Browser storage (cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, service workers) is NOT shared between mirrors; data saved on one mirror is invisible on another.',
    'Serving a site over Tor or I2P protects the connection between visitor and mirror only. It does not make blockchain or cryptocurrency transactions anonymous: on-chain data remains public and linkable.',
    'Onion and I2P addresses can only be created by the operator\'s own Tor or I2P software. The planner never generates keys, identities or addresses, and never starts or configures any service.',
    'Exported plans exclude credentials, private keys, databases and backups. Excluded files are listed by path and reason only; their bytes are never read into the plan or bundle.',
    'Site bytes are never modified. Base paths are a server setting; links inside the site are not rewritten.'
  ];

  function defaultHeaders() {
    return [
      { name: 'X-Content-Type-Options', value: 'nosniff' },
      { name: 'Referrer-Policy', value: 'no-referrer' },
      { name: 'Content-Security-Policy', value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" },
      { name: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { name: 'Cross-Origin-Opener-Policy', value: 'same-origin' }
    ];
  }

  function defaultSettings() {
    return { siteLabel: 'Untitled static site', headers: defaultHeaders(), advertiseOnionLocation: false };
  }

  /** Sanitize settings (also used on import). Returns { settings, errors }. */
  function sanitizeSettings(raw) {
    var s = defaultSettings();
    var errors = [];
    if (raw && typeof raw === 'object') {
      if (typeof raw.siteLabel === 'string') s.siteLabel = raw.siteLabel.trim().slice(0, core.LIMITS.maxLabelLength + 1);
      if (Array.isArray(raw.headers)) {
        s.headers = raw.headers.slice(0, core.LIMITS.maxHeaders + 1).map(function (h) {
          return { name: h && typeof h.name === 'string' ? h.name.trim().slice(0, 200) : '', value: h && typeof h.value === 'string' ? h.value.trim().slice(0, core.LIMITS.maxHeaderValueLength + 1) : '' };
        });
      }
      s.advertiseOnionLocation = raw.advertiseOnionLocation === true;
    }
    if (!s.siteLabel) errors.push({ field: 'siteLabel', message: 'Site label is required.' });
    else if (s.siteLabel.length > core.LIMITS.maxLabelLength) errors.push({ field: 'siteLabel', message: 'Site label is longer than ' + core.LIMITS.maxLabelLength + ' characters.' });
    else if (core.scanFieldForSecrets(s.siteLabel).length) errors.push({ field: 'siteLabel', message: 'Site label looks like it contains a credential.' });
    if (s.headers.length > core.LIMITS.maxHeaders) errors.push({ field: 'headers', message: 'At most ' + core.LIMITS.maxHeaders + ' headers.' });
    var seen = {};
    s.headers.forEach(function (h, i) {
      core.validateHeader(h).forEach(function (m) { errors.push({ field: 'headers.' + i, message: m }); });
      var k = h.name.toLowerCase();
      if (k && seen[k]) errors.push({ field: 'headers.' + i, message: 'Header "' + h.name + '" is listed twice.' });
      if (k === 'strict-transport-security' || k === 'onion-location') errors.push({ field: 'headers.' + i, message: 'Header "' + h.name + '" is added per destination automatically; do not list it globally.' });
      seen[k] = true;
    });
    return { settings: s, errors: errors };
  }

  // ---------------------------------------------------------------- plan

  function headersFor(d, settings, destinations) {
    var out = settings.headers.map(function (h) { return { name: h.name, value: h.value, source: 'plan' }; });
    var url = dest.effectiveBaseUrl(d);
    if (url && /^https:/.test(url)) out.push({ name: 'Strict-Transport-Security', value: 'max-age=31536000', source: 'https-destination' });
    if (settings.advertiseOnionLocation && url && /^https:/.test(url)) {
      var onion = destinations.filter(function (x) { return x.type === 'tor-onion' && dest.effectiveBaseUrl(x); })[0];
      if (onion) out.push({ name: 'Onion-Location', value: dest.effectiveBaseUrl(onion), source: 'advertise-onion-location', note: 'Append the request path when configuring (e.g. nginx $request_uri). This publicly links the clearnet and onion mirrors.' });
    }
    return out;
  }

  function redact(text) {
    if (core.scanFieldForSecrets(text).length) return '[redacted by planner: possible credential]';
    return text;
  }

  function destinationForExport(d) {
    var cfg = {};
    Object.keys(d.config).forEach(function (k) {
      var v = d.config[k];
      if (k === 'address' && (d.type === 'tor-onion' || d.type === 'i2p') && d.config.addressMode !== 'entered') v = '';
      cfg[k] = typeof v === 'string' ? redact(v) : v;
    });
    return {
      id: d.id, type: d.type, label: redact(d.label), basePath: d.basePath,
      notes: redact(d.notes || ''), config: cfg, capabilities: JSON.parse(JSON.stringify(d.capabilities))
    };
  }

  /**
   * Build the deployment plan.
   *   input: { inventory, destinations: [...], settings, generatedAt: ISO string }
   * Deterministic for identical input. Does not throw for incomplete input:
   * problems are reported inside the plan and planState stays "draft".
   */
  function buildPlan(input) {
    var inv = input.inventory || null;
    var ss = sanitizeSettings(input.settings);
    var settings = ss.settings;
    var dests = (input.destinations || []).slice(0, core.LIMITS.maxDestinations).map(dest.sanitizeDestination).filter(Boolean);
    var ctx = { inventory: inv, headers: settings.headers };

    var reasons = [];
    if (!inv) reasons.push('No site has been inventoried.');
    else {
      if (inv.files.length === 0) reasons.push('The inventory contains no publishable files.');
      var unsafe = inv.rejected.length;
      if (unsafe) reasons.push(unsafe + ' file(s) were rejected (unsafe path, size limit or read error). Fix or remove them in the source folder and re-inventory.');
    }
    if (ss.errors.length) reasons.push(ss.errors.length + ' plan setting error(s).');
    if (!dests.length) reasons.push('No destinations have been added.');
    if ((input.destinations || []).length > core.LIMITS.maxDestinations) reasons.push('Only the first ' + core.LIMITS.maxDestinations + ' destinations are included.');

    var crossWarnings = [];
    if (inv && inv.externalReferenceFiles && inv.externalReferenceFiles.length) {
      var csp = settings.headers.filter(function (h) { return h.name.toLowerCase() === 'content-security-policy'; })[0];
      if (csp && /default-src\s+'self'/.test(csp.value)) crossWarnings.push(inv.externalReferenceFiles.length + ' file(s) reference external hosts, which the planned Content-Security-Policy (default-src \'self\') will block.');
    }
    var localListeners = dests.filter(function (d) { return d.type === 'local-server'; }).map(function (d) { return d.config.listenAddress; });

    var outDests = dests.map(function (d) {
      var a = dest.assessDestination(d, ctx);
      var bp = core.normaliseBasePath(d.basePath);
      var extraWarnings = [];
      if ((d.type === 'tor-onion' || d.type === 'i2p') && d.config.localTarget && !/^unix:/.test(d.config.localTarget) && localListeners.indexOf(d.config.localTarget) === -1) {
        extraWarnings.push({ field: 'localTarget', message: 'No "local web server" destination in this plan listens on ' + d.config.localTarget + '. Add one, or make sure the operator\'s server is configured there.' });
      }
      if (a.state !== dest.STATES.READY) reasons.push('Destination "' + redact(d.label) + '" is ' + a.state + '.');
      var addrStatus;
      if (d.type === 'tor-onion' || d.type === 'i2p') addrStatus = d.config.addressMode === 'entered' && d.config.address ? 'user-entered-format-checked-unverified' : 'pending-operator-generation';
      else addrStatus = (d.type === 'generic-static' ? d.config.address : (d.config.publicUrl || d.config.listenAddress)) ? 'user-entered-unverified' : 'not-provided';
      return {
        id: d.id,
        type: d.type,
        typeLabel: dest.TYPES[d.type].label,
        label: redact(d.label),
        state: a.state,
        stateLabel: a.stateLabel,
        verified: false,
        addressStatus: addrStatus,
        basePath: bp.ok ? bp.basePath : null,
        effectiveBaseUrl: dest.effectiveBaseUrl(d),
        instructionsFile: 'destinations/' + fileSlug(d) + '/INSTRUCTIONS.md',
        templates: templateFiles(d, settings, dests, inv).map(function (t) { return 'destinations/' + fileSlug(d) + '/' + t.name; }),
        requiredHeaders: headersFor(d, settings, dests),
        capabilities: a.capabilities,
        missingConfiguration: a.missing,
        pendingOperatorActions: a.pending,
        errors: a.errors,
        warnings: a.warnings.concat(extraWarnings),
        record: destinationForExport(d)
      };
    });

    var ready = reasons.length === 0;
    var plan = {
      schema: SCHEMA,
      schemaVersion: SCHEMA_VERSION,
      tool: { name: core.TOOL.name, version: core.TOOL.version },
      generatedAt: input.generatedAt || new Date().toISOString(),
      notice: NOTICE,
      planState: ready ? 'ready-for-manual-review' : 'draft',
      planStateReasons: ready ? ['Every required item is user-declared. A person must still review and verify everything manually before any deployment.'] : reasons,
      verification: { performed: false, networkRequests: 0, statement: 'No address, provider or capability was checked. All values are user-declared.' },
      settings: { siteLabel: redact(settings.siteLabel), advertiseOnionLocation: settings.advertiseOnionLocation, headers: settings.headers, errors: ss.errors },
      site: inv ? {
        rootFolder: inv.rootFolder,
        totals: inv.totals,
        manifestSha256: inv.manifestSha256,
        manifestFormat: 'sha256sum -c compatible, file "SHA256SUMS"; manifestSha256 is the SHA-256 of that file',
        bytePreservation: 'Files are listed and bundled verbatim. The planner never rewrites, minifies or re-encodes site bytes.',
        files: inv.files,
        excluded: inv.excluded,
        rejected: inv.rejected,
        warnings: inv.warnings,
        rootAbsoluteLinkFiles: inv.rootAbsoluteLinkFiles,
        externalReferenceFiles: inv.externalReferenceFiles
      } : null,
      contentTypes: inv ? contentTypeMap(inv) : {},
      cacheRecommendations: [
        { match: '*.html', header: 'Cache-Control', value: 'no-cache', level: 'recommended' },
        { match: 'all other files', header: 'Cache-Control', value: 'public, max-age=3600', level: 'recommended' }
      ],
      crossChecks: crossWarnings,
      destinations: outDests,
      excludedFromPlan: 'Credentials, private keys, onion/I2P key material, wallets, databases, backups, VCS metadata and OS metadata are never included. Destination records hold no credential fields; free-text fields that look like credentials are redacted.',
      limitations: LIMITATIONS.slice()
    };
    return plan;
  }

  function contentTypeMap(inv) {
    var m = {};
    inv.files.forEach(function (f) { var e = core.extensionOf(f.path) || '(none)'; m[e] = f.mediaType; });
    var out = {};
    Object.keys(m).sort().forEach(function (k) { out[k] = m[k]; });
    return out;
  }

  function fileSlug(d) { return dest.slugify(d.label) + '-' + d.id; }

  // ------------------------------------------------------------ templates

  var TEMPLATE_BANNER = [
    'TEMPLATE generated by the Replikrazy Offline Mirror Planner. NOT APPLIED.',
    'Nothing here has been installed, started or tested. Review every line',
    'against your own software\'s documentation before using any of it.'
  ];

  function hashBanner(extra) {
    return TEMPLATE_BANNER.concat(extra || []).map(function (l) { return '# ' + l; }).join('\n') + '\n';
  }

  function basePathOf(d) { var bp = core.normaliseBasePath(d.basePath); return bp.ok ? bp.basePath : '/'; }

  function nginxTemplate(d, headers, inv) {
    var bp = basePathOf(d);
    var root = d.config.documentRoot || '/path/to/document-root';
    var has404 = inv && inv.files.some(function (f) { return f.path === '404.html'; });
    var lines = [hashBanner(['Copy the site files into ' + root + bp.replace(/\/$/, '') + '/ (document root + base path).'])];
    lines.push('server {');
    lines.push('    listen ' + (d.config.listenAddress || d.config.localTarget || '127.0.0.1:8080') + ';');
    lines.push('    server_name _;');
    lines.push('    server_tokens off;');
    lines.push('    root ' + root + ';');
    lines.push('    charset utf-8;');
    lines.push('    # Review access-log retention for privacy-sensitive mirrors, e.g.: access_log off;');
    lines.push('');
    lines.push('    location ' + bp + ' {');
    lines.push('        index index.html;');
    lines.push('        try_files $uri $uri/ =404;');
    headers.forEach(function (h) {
      if (h.name === 'Onion-Location') lines.push('        add_header Onion-Location "' + h.value.replace(/\/$/, '') + '$request_uri" always;');
      else lines.push('        add_header ' + h.name + ' "' + h.value + '" always;');
    });
    lines.push('    }');
    if (has404) lines.push('    error_page 404 ' + bp + '404.html;');
    lines.push('}');
    return lines.join('\n') + '\n';
  }

  function caddyTemplate(d, headers, inv) {
    var bp = basePathOf(d);
    var root = d.config.documentRoot || '/path/to/document-root';
    var has404 = inv && inv.files.some(function (f) { return f.path === '404.html'; });
    var site = d.config.publicUrl ? new URL(d.config.publicUrl).origin : 'http://' + (d.config.listenAddress || '127.0.0.1:8080');
    var lines = [hashBanner(['Copy the site files into ' + root + bp.replace(/\/$/, '') + '/ (document root + base path).'])];
    lines.push(site + ' {');
    lines.push('\troot * ' + root);
    lines.push('\theader ' + (bp === '/' ? '' : bp + '* ') + '{');
    headers.forEach(function (h) {
      if (h.name === 'Onion-Location') lines.push('\t\tOnion-Location "' + h.value.replace(/\/$/, '') + '{uri}"');
      else lines.push('\t\t' + h.name + ' "' + h.value + '"');
    });
    lines.push('\t\t-Server');
    lines.push('\t}');
    lines.push('\tfile_server');
    if (has404) {
      lines.push('\thandle_errors {');
      lines.push('\t\t@notfound expression {err.status_code} == 404');
      lines.push('\t\trewrite @notfound ' + bp + '404.html');
      lines.push('\t\tfile_server');
      lines.push('\t}');
    }
    lines.push('}');
    return lines.join('\n') + '\n';
  }

  function apacheTemplate(d, headers, inv) {
    var bp = basePathOf(d);
    var root = d.config.documentRoot || '/path/to/document-root';
    var has404 = inv && inv.files.some(function (f) { return f.path === '404.html'; });
    var listen = d.config.listenAddress || '127.0.0.1:8080';
    var lines = [hashBanner(['Requires mod_headers. Copy the site files into ' + root + bp.replace(/\/$/, '') + '/.'])];
    lines.push('Listen ' + listen);
    lines.push('<VirtualHost ' + listen + '>');
    lines.push('    DocumentRoot "' + root + '"');
    lines.push('    ServerSignature Off');
    lines.push('    <Directory "' + root + '">');
    lines.push('        Options -Indexes -ExecCGI -Includes');
    lines.push('        AllowOverride None');
    lines.push('        Require all granted');
    lines.push('        DirectoryIndex index.html');
    lines.push('    </Directory>');
    lines.push('    <Location "' + bp + '">');
    headers.forEach(function (h) {
      if (h.name === 'Onion-Location') lines.push('        Header always set Onion-Location "' + h.value.replace(/\/$/, '') + '%{REQUEST_URI}e"');
      else lines.push('        Header always set ' + h.name + ' "' + h.value + '"');
    });
    lines.push('    </Location>');
    if (has404) lines.push('    ErrorDocument 404 ' + bp + '404.html');
    lines.push('</VirtualHost>');
    return lines.join('\n') + '\n';
  }

  function headerList(headers) {
    return headers.map(function (h) { return h.name + ': ' + h.value + (h.note ? '    (' + h.note + ')' : ''); }).join('\n') + '\n';
  }

  function torrcTemplate(d) {
    var dir = d.config.hiddenServiceDir || '/var/lib/tor/replikrazy-mirror/';
    var port = d.config.virtualPort || '80';
    var target = d.config.localTarget || '127.0.0.1:8080';
    return hashBanner([
      'INERT: every directive below is commented out on purpose.',
      'After review, the OPERATOR may uncomment them in their own torrc and',
      'restart Tor themselves. Tor (not this planner) then creates the onion',
      'keys and the "hostname" file inside HiddenServiceDir on that machine.',
      'Never copy HiddenServiceDir into the site folder, a plan, a bundle or a repository.'
    ]) + '\n' +
      '# HiddenServiceDir ' + dir + '\n' +
      '# HiddenServicePort ' + port + ' ' + target + '\n';
  }

  function i2pdTemplate(d) {
    var c = d.config;
    var hp = dest.parseHostPort(c.localTarget || '127.0.0.1:8080') || { host: '127.0.0.1', port: 8080 };
    return hashBanner([
      'INERT: every line below is commented out on purpose.',
      'After review, the OPERATOR may add the uncommented section to their own',
      'i2pd tunnels.conf (or tunnels.d/) and restart i2pd themselves. i2pd (not',
      'this planner) creates the keys file and the .b32.i2p address on that machine.',
      'Never copy the keys file into the site folder, a plan, a bundle or a repository.'
    ]) + '\n' +
      '# [' + (c.tunnelName || 'replikrazy-mirror') + ']\n' +
      '# type = http\n' +
      '# host = ' + hp.host + '\n' +
      '# port = ' + hp.port + '\n' +
      '# keys = ' + (c.keysFile || 'replikrazy-mirror.dat') + '\n';
  }

  function javaI2pValues(d) {
    var c = d.config;
    var hp = dest.parseHostPort(c.localTarget || '127.0.0.1:8080') || { host: '127.0.0.1', port: 8080 };
    return hashBanner([
      'Values to enter by hand in the Java I2P router console\'s Hidden Services',
      'Manager when creating an HTTP server tunnel. This is a checklist, not a',
      'config file. The router (not this planner) creates the destination keys.'
    ]) + '\n' +
      'Tunnel type:        HTTP server\n' +
      'Name:               ' + (c.tunnelName || 'replikrazy-mirror') + '\n' +
      'Target host:        ' + hp.host + '\n' +
      'Target port:        ' + hp.port + '\n' +
      'Auto start:         decide after manual review\n';
  }

  /** List of { name, content } template files for a destination. */
  function templateFiles(d, settings, allDests, inv) {
    var headers = headersFor(d, settings, allDests || [d]);
    var out = [{ name: 'headers.txt', content: hashBanner(['Response headers this destination must send for every site file.']) + '\n' + headerList(headers) }];
    if (d.type === 'local-server') {
      var sw = d.config.serverSoftware;
      if (sw === 'nginx') out.push({ name: 'nginx-server.conf.template', content: nginxTemplate(d, headers, inv) });
      else if (sw === 'caddy') out.push({ name: 'Caddyfile.template', content: caddyTemplate(d, headers, inv) });
      else if (sw === 'apache') out.push({ name: 'apache-vhost.conf.template', content: apacheTemplate(d, headers, inv) });
    } else if (d.type === 'tor-onion') {
      out.push({ name: 'torrc.snippet.template', content: torrcTemplate(d) });
    } else if (d.type === 'i2p') {
      if (d.config.router === 'java-i2p') out.push({ name: 'java-i2p-tunnel-values.txt', content: javaI2pValues(d) });
      else out.push({ name: 'i2pd-tunnels.conf.template', content: i2pdTemplate(d) });
    }
    return out;
  }

  // --------------------------------------------------------- instructions

  function mdEscape(s) { return String(s).replace(/([\\`*_{}\[\]<>|#])/g, '\\$1'); }

  function capTable(rows) {
    var lines = ['| Capability | Requirement | Declared by user | Status |', '|---|---|---|---|'];
    rows.forEach(function (r) {
      lines.push('| ' + mdEscape(r.label) + ' | ' + r.level + ' | ' + r.declared + ' | ' + r.status + (r.detail ? ' — ' + mdEscape(r.detail) : '') + ' |');
    });
    return lines.join('\n');
  }

  /** Markdown operator instructions for one destination of a built plan. */
  function buildInstructions(plan, destId) {
    var pd = plan.destinations.filter(function (x) { return x.id === destId; })[0];
    if (!pd) throw core.PlannerError('NO_DEST', 'Destination not found in plan.');
    var d = pd.record;
    var c = d.config;
    var bp = pd.basePath || '/';
    var out = [];
    var p = function (s) { out.push(s === undefined ? '' : s); };

    p('# Operator instructions — ' + mdEscape(pd.label));
    p();
    p('> **' + NOTICE + '**');
    p();
    p('- Destination type: ' + pd.typeLabel);
    p('- State: **' + pd.state + '** — ' + pd.stateLabel);
    p('- Verified by planner: **no** (the planner never verifies anything)');
    p('- Address status: ' + pd.addressStatus);
    p('- Effective base URL: ' + (pd.effectiveBaseUrl ? '`' + pd.effectiveBaseUrl + '` (user-entered, unverified)' : 'not known yet'));
    p('- Base path: `' + bp + '`');
    p('- Site: ' + mdEscape(plan.settings.siteLabel) + (plan.site ? ' — ' + plan.site.totals.fileCount + ' files, ' + core.formatBytes(plan.site.totals.totalBytes) : ' — not inventoried'));
    if (plan.site) p('- Manifest SHA-256 (of SHA256SUMS): `' + plan.site.manifestSha256 + '`');
    p('- Plan generated: ' + plan.generatedAt);
    p();

    p('## 1. Open items before anything else');
    p();
    if (!pd.missingConfiguration.length && !pd.errors.length && !pd.pendingOperatorActions.length && !pd.warnings.length) p('No open configuration items were detected. Manual review is still required.');
    pd.missingConfiguration.forEach(function (m) { p('- [ ] Missing: ' + mdEscape(m.label)); });
    pd.errors.forEach(function (e) { p('- [ ] Fix: ' + mdEscape(e.message)); });
    pd.pendingOperatorActions.forEach(function (e) { p('- [ ] Operator action: ' + mdEscape(e.message)); });
    pd.warnings.forEach(function (w) { p('- [ ] Review: ' + mdEscape(w.message)); });
    p();

    p('## 2. Declared capabilities (user-declared, unverified)');
    p();
    p(capTable(pd.capabilities));
    p();
    p('Check each "unknown" item against the destination\'s own documentation or configuration. Do not assume support.');
    p();

    p('## 3. Prepare the files (byte-for-byte)');
    p();
    p('1. Use the exported bundle\'s `site/` folder, or the original source folder. Do not edit, minify, re-encode or "optimise" any file.');
    p('2. Verify every file against the manifest before copying: `cd site && sha256sum -c ../SHA256SUMS` (on macOS: `shasum -a 256 -c ../SHA256SUMS`). Every line must say OK.');
    if (plan.site && plan.site.excluded.length) p('3. ' + plan.site.excluded.length + ' file(s) were excluded as sensitive (see plan.json → site.excluded). Make sure none of them exist on the destination.');
    else p('3. No files were excluded as sensitive.');
    p('4. Copy the files so that `index.html` is served at `' + bp + '`.');
    p();

    p('## 4. Configure this destination');
    p();
    typeSteps(pd, d, c, bp).forEach(function (l) { p(l); });
    p();

    p('## 5. Required response headers');
    p();
    p('| Header | Value | Source |');
    p('|---|---|---|');
    pd.requiredHeaders.forEach(function (h) { p('| ' + mdEscape(h.name) + ' | `' + h.value + '` | ' + h.source + (h.note ? ' — ' + mdEscape(h.note) : '') + ' |'); });
    p();
    p('Expected Content-Type per extension:');
    p();
    Object.keys(plan.contentTypes).forEach(function (k) { p('- `.' + k + '` → `' + plan.contentTypes[k] + '`'); });
    p();

    p('## 6. Templates in this folder');
    p();
    pd.templates.forEach(function (t) { p('- `' + t.split('/').pop() + '` — inert text for review; nothing was applied.'); });
    p();

    p('## 7. Manual verification after the operator deploys');
    p();
    p('- [ ] The home page loads at the base path, and a sub-page loads via its directory URL.');
    p('- [ ] Download a few files and compare their SHA-256 with SHA256SUMS.');
    p('- [ ] Every header in section 5 is present (e.g. inspect the response headers in the browser developer tools).');
    p('- [ ] A missing page returns 404' + (plan.site && plan.site.files.some(function (f) { return f.path === '404.html'; }) ? ' with the site\'s 404.html.' : '.'));
    p('- [ ] No excluded file (credentials, keys, databases, backups) is reachable.');
    p('- [ ] Only after all of the above, record the destination as reviewed in your own records. This planner cannot mark anything verified.');
    p();

    p('## 8. Limitations');
    p();
    plan.limitations.forEach(function (l) { p('- ' + l); });
    p();
    return out.join('\n');
  }

  function typeSteps(pd, d, c, bp) {
    var s = [];
    if (d.type === 'generic-static') {
      s.push('- Provider (free text, user-entered): ' + (c.providerName ? mdEscape(c.providerName) : 'not specified'));
      s.push('- Intended copy method (user-entered): ' + (c.deployMethod ? mdEscape(c.deployMethod) : 'not specified'));
      s.push('- Configure headers, base path and error page using **the provider\'s own documented mechanism**. The planner does not know whether this provider supports them; every "unknown" capability above must be confirmed from the provider\'s documentation first.');
      s.push('- Account access, credentials and upload tools are handled by the operator outside this planner and must never be added to the plan.');
      s.push('- If the provider cannot send the required headers or serve files byte-for-byte, choose a different destination.');
    } else if (d.type === 'local-server') {
      s.push('- Server software: ' + c.serverSoftware + '; listen address: `' + (c.listenAddress || '?') + '`; document root: `' + (c.documentRoot || '?') + '`.');
      s.push('- Place the files at `' + (c.documentRoot || '<document root>') + bp.replace(/\/$/, '') + '/`.');
      s.push('- Review the template in this folder, adapt it, test the configuration with the server\'s own check command, then reload the server yourself.');
      s.push('- Keep the document root free of anything but site files. Do not place keys, databases or backups beneath it.');
      if (c.publicUrl) s.push('- Public URL (user-entered, unverified): `' + c.publicUrl + '`. TLS certificates are managed by the operator.');
      else s.push('- No public URL entered: the server is intended for local use or as the target of an onion/I2P tunnel.');
    } else if (d.type === 'tor-onion') {
      s.push('1. Set up the local web server first (see the matching "local web server" destination). It must listen only on `' + (c.localTarget || '127.0.0.1:port') + '`.');
      s.push('2. Install Tor from your operating system or the Tor Project\'s official packages, following their documentation.');
      s.push('3. Review `torrc.snippet.template`. Choose a HiddenServiceDir outside every web-served folder (planned: `' + (c.hiddenServiceDir || '?') + '`), owned by the Tor user with mode 0700.');
      s.push('4. Only after review, uncomment the two directives in your own torrc and restart Tor yourself. Tor creates the keys and the `hostname` file on your machine.');
      s.push('5. Back up `hs_ed25519_secret_key` offline and encrypted. Never put it in the site folder, the plan, a bundle, a chat or a repository.');
      s.push('6. Read the address from the `hostname` file and enter it in the planner (address mode "entered") to regenerate these instructions.');
      s.push('- Do not add Strict-Transport-Security on the onion service. Avoid external resources: they would be fetched outside the onion service or fail.');
      s.push('- Linking a clearnet mirror to this onion (e.g. Onion-Location) is public and permanent; decide deliberately.');
      if (pd.addressStatus === 'user-entered-format-checked-unverified') s.push('- Entered address `' + c.address + '` passed a format check only. Its checksum and reachability were not verified.');
    } else if (d.type === 'i2p') {
      s.push('1. Set up the local web server first. It must listen only on `' + (c.localTarget || '127.0.0.1:port') + '`.');
      s.push('2. Install the I2P router (' + (c.router === 'java-i2p' ? 'Java I2P' : 'i2pd') + ') from its official distribution, following its documentation.');
      if (c.router === 'java-i2p') s.push('3. In the router console\'s Hidden Services Manager, create an HTTP server tunnel using the values in `java-i2p-tunnel-values.txt`.');
      else s.push('3. Review `i2pd-tunnels.conf.template`; after review, add the section (uncommented) to your i2pd tunnels configuration and restart i2pd yourself.');
      s.push('4. The router creates the destination keys' + (c.router === 'i2pd' ? ' (`' + (c.keysFile || 'keys.dat') + '`)' : '') + ' on your machine. Back them up offline and encrypted; never put them in the site folder, plan, bundle or repository.');
      s.push('5. Read the .b32.i2p address from the router and enter it in the planner (address mode "entered") to regenerate these instructions.');
      s.push('- Avoid external resources; they would leave I2P or fail.');
      if (pd.addressStatus === 'user-entered-format-checked-unverified') s.push('- Entered address `' + c.address + '` passed a format check only; reachability was not verified.');
    }
    return s;
  }

  // ------------------------------------------------------------- exports

  /**
   * All plan artifacts as a flat list of { path, content } text files,
   * rooted at "offline-mirror-plan/". Site files are NOT included here;
   * the app adds them verbatim under "offline-mirror-plan/site/" for bundles.
   */
  function exportArtifacts(plan, input) {
    var base = 'offline-mirror-plan/';
    var files = [];
    files.push({ path: base + 'README-FIRST.txt', content: readmeFirst(plan) });
    files.push({ path: base + 'plan.json', content: JSON.stringify(plan, null, 2) + '\n' });
    if (input.inventory) files.push({ path: base + 'SHA256SUMS', content: core.buildSha256Sums(input.inventory.files) });
    var ss = sanitizeSettings(input.settings).settings;
    var dests = (input.destinations || []).slice(0, core.LIMITS.maxDestinations).map(dest.sanitizeDestination).filter(Boolean);
    files.push({ path: base + 'destinations.json', content: JSON.stringify(destinationsExport(dests, ss, plan.generatedAt), null, 2) + '\n' });
    dests.forEach(function (d) {
      var dir = base + 'destinations/' + fileSlug(d) + '/';
      files.push({ path: dir + 'INSTRUCTIONS.md', content: buildInstructions(plan, d.id) });
      templateFiles(d, ss, dests, input.inventory).forEach(function (t) { files.push({ path: dir + t.name, content: t.content }); });
    });
    return files;
  }

  function readmeFirst(plan) {
    return [
      NOTICE,
      '',
      'Plan state: ' + plan.planState,
      'Site: ' + plan.settings.siteLabel,
      'Generated: ' + plan.generatedAt,
      '',
      'Contents:',
      '  plan.json            full deployment plan (machine-readable)',
      '  SHA256SUMS           sha256sum -c manifest for the site files',
      '  destinations.json    destination records, re-importable into the planner',
      '  destinations/*/      per-destination INSTRUCTIONS.md and inert templates',
      '  site/                (bundle only) site files, byte-for-byte as selected',
      '',
      'Limitations:'
    ].concat(plan.limitations.map(function (l) { return '  - ' + l; })).join('\n') + '\n';
  }

  function destinationsExport(dests, settings, generatedAt) {
    return {
      schema: DEST_SCHEMA,
      schemaVersion: 1,
      generatedAt: generatedAt,
      notice: 'User-entered destination records. Addresses and capabilities are unverified. Contains no credentials.',
      settings: { siteLabel: redact(settings.siteLabel), headers: settings.headers, advertiseOnionLocation: settings.advertiseOnionLocation },
      destinations: dests.map(destinationForExport)
    };
  }

  /**
   * Import destinations (and settings) from text: a destinations.json export,
   * a plan.json export, or a bare array of destination records.
   * Returns { destinations, settings|null, warnings }. Throws PlannerError.
   */
  function importDestinations(text) {
    if (typeof text !== 'string') throw core.PlannerError('BAD_IMPORT', 'Import must be text.');
    if (text.length > core.LIMITS.maxImportBytes) throw core.PlannerError('IMPORT_TOO_LARGE', 'Import file is larger than ' + core.formatBytes(core.LIMITS.maxImportBytes) + '.');
    var data;
    try { data = JSON.parse(text); } catch (e) { throw core.PlannerError('BAD_JSON', 'Import file is not valid JSON: ' + e.message); }
    var list, settings = null;
    if (Array.isArray(data)) list = data;
    else if (data && data.schema === DEST_SCHEMA) { list = data.destinations; settings = data.settings || null; }
    else if (data && data.schema === SCHEMA) {
      list = (data.destinations || []).map(function (pd) { return pd && pd.record; });
      settings = data.settings || null;
    } else throw core.PlannerError('BAD_SCHEMA', 'Unrecognised file. Expected a destinations.json or plan.json exported by this planner, or an array of destination records.');
    if (!Array.isArray(list)) throw core.PlannerError('BAD_SCHEMA', 'The file has no destination list.');
    var warnings = [];
    if (list.length > core.LIMITS.maxDestinations) { warnings.push('Only the first ' + core.LIMITS.maxDestinations + ' destinations were imported.'); list = list.slice(0, core.LIMITS.maxDestinations); }
    var out = [], ids = {};
    list.forEach(function (raw, i) {
      var d = dest.sanitizeDestination(raw);
      if (!d) { warnings.push('Entry ' + (i + 1) + ' was skipped: not a recognised destination record.'); return; }
      if (ids[d.id]) d.id = dest.newId();
      ids[d.id] = true;
      if (raw && typeof raw === 'object') {
        var dropped = Object.keys(raw.config || {}).filter(function (k) { return !Object.prototype.hasOwnProperty.call(d.config, k); });
        if (dropped.length) warnings.push('Entry ' + (i + 1) + ': ignored unknown field(s) ' + dropped.slice(0, 5).map(core.safeDisplay).join(', ') + '.');
      }
      out.push(d);
    });
    var s = settings ? sanitizeSettings(settings) : null;
    if (s && s.errors.length) warnings.push('Imported settings have ' + s.errors.length + ' problem(s); review the Headers & settings section.');
    return { destinations: out, settings: s ? s.settings : null, warnings: warnings };
  }

  return {
    SCHEMA: SCHEMA,
    SCHEMA_VERSION: SCHEMA_VERSION,
    DEST_SCHEMA: DEST_SCHEMA,
    NOTICE: NOTICE,
    LIMITATIONS: LIMITATIONS,
    defaultHeaders: defaultHeaders,
    defaultSettings: defaultSettings,
    sanitizeSettings: sanitizeSettings,
    buildPlan: buildPlan,
    buildInstructions: buildInstructions,
    templateFiles: templateFiles,
    exportArtifacts: exportArtifacts,
    importDestinations: importDestinations,
    fileSlug: fileSlug
  };
});
