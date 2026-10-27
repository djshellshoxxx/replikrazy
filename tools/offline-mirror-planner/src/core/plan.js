/*
 * Deployment plan builder for the offline mirror planner.
 * Turns an inventory plus user-declared destinations into a JSON plan,
 * a SHA256SUMS manifest and per-destination operator instructions.
 * All output is inert text: nothing is deployed, contacted or created.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./sha256.js'), require('./inventory.js'), require('./destinations.js'));
  } else {
    root.OMP = root.OMP || {};
    root.OMP.plan = factory(root.OMP.sha256, root.OMP.inventory, root.OMP.destinations);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (sha256, inventory, destinations) {
  'use strict';

  var TOOL = { name: 'offline-mirror-planner', version: '0.1.0' };
  var SCHEMA = 'offline-mirror-planner/deployment-plan@1';
  var MAX_HEADERS = 20;

  var DEFAULT_HEADERS = [
    { name: 'X-Content-Type-Options', value: 'nosniff' },
    { name: 'Referrer-Policy', value: 'no-referrer' }
  ];

  var FORBIDDEN_HEADERS = ['set-cookie', 'cookie', 'authorization', 'proxy-authorization', 'www-authenticate',
    'proxy-authenticate', 'content-length', 'transfer-encoding', 'connection', 'host', 'content-type', 'upgrade', 'te', 'trailer'];

  var NOTICE = 'PLANNING DOCUMENT ONLY. Generated offline. Nothing was uploaded, published, registered, contacted or verified. ' +
    'Destination addresses and capabilities are user-declared and unverified.';

  var DISCLAIMERS = [
    'This is a plan, not a deployment. The planner made no network requests and did not upload, publish, sign up for or log in to anything.',
    'Destination addresses and capabilities are user-declared and unverified. "ready-for-manual-review" means the declared values meet this plan\'s requirements; it does not mean the destination exists or works.',
    'No Tor or I2P identities, keys or addresses were created. Tor/I2P sections are inert templates for an operator to review and apply on their own machine.',
    'Site files are listed with SHA-256 hashes and must be copied byte-for-byte. The planner never rewrites, minifies or re-encodes them.',
    'Credentials, private keys, databases, backups, server-side code and hidden files are excluded from the manifest and never exported.',
    'Each mirror is a separate web origin. Browser storage (cookies, localStorage, sessionStorage, IndexedDB) is not shared between mirrors.',
    'Mirroring a website does not make payments or blockchain transactions anonymous.'
  ];

  function PlanError(code, message) {
    return inventory.PlannerError(code, message);
  }

  /*
   * Validate required response headers.
   * Returns { errors: [{index, message}], headers: [{name, value}] }.
   */
  function validateHeaders(list) {
    var errors = [];
    var headers = [];
    if (!Array.isArray(list)) return { errors: [{ index: -1, message: 'Headers must be a list.' }], headers: headers };
    if (list.length > MAX_HEADERS) errors.push({ index: -1, message: 'At most ' + MAX_HEADERS + ' headers.' });
    var seen = {};
    list.slice(0, MAX_HEADERS).forEach(function (h, i) {
      var name = h && typeof h.name === 'string' ? h.name.trim() : '';
      var value = h && typeof h.value === 'string' ? h.value.trim() : '';
      var bad = false;
      if (!/^[A-Za-z0-9-]{1,64}$/.test(name)) {
        errors.push({ index: i, message: 'Header ' + (i + 1) + ': name must be 1-64 letters, digits or "-".' });
        bad = true;
      } else if (FORBIDDEN_HEADERS.indexOf(name.toLowerCase()) !== -1) {
        errors.push({ index: i, message: 'Header ' + (i + 1) + ': "' + name + '" cannot be set here (credential-bearing, per-file or hop-by-hop).' });
        bad = true;
      } else if (seen[name.toLowerCase()]) {
        errors.push({ index: i, message: 'Header ' + (i + 1) + ': "' + name + '" is listed twice.' });
        bad = true;
      }
      if (!/^[\x20-\x7e]{1,512}$/.test(value) || /["\\$`{}]/.test(value)) {
        errors.push({ index: i, message: 'Header ' + (i + 1) + ': value must be 1-512 printable ASCII characters without " \\ $ ` { }.' });
        bad = true;
      } else if (destinations.findSecretLike(name + ': ' + value) || destinations.findSecretLike(value)) {
        errors.push({ index: i, message: 'Header ' + (i + 1) + ': value looks like a credential. Headers in a plan must not carry secrets.' });
        bad = true;
      }
      if (!bad) {
        seen[name.toLowerCase()] = true;
        headers.push({ name: name, value: value });
      }
    });
    return { errors: errors, headers: headers };
  }

  function renderSha256Sums(files) {
    return files.map(function (f) { return f.sha256 + '  ' + f.path; }).join('\n') + (files.length ? '\n' : '');
  }

  function countBy(list, key) {
    var out = {};
    list.forEach(function (x) { out[x[key]] = (out[x[key]] || 0) + 1; });
    return out;
  }

  function safeFileId(d, i, used) {
    var id = /^[a-z0-9][a-z0-9-]{0,47}$/.test(d.id) && !used[d.id] ? d.id : 'destination-' + (i + 1);
    used[id] = true;
    return id;
  }

  /*
   * Build the deployment plan object.
   * args: { inventory, destinations, settings: { planName, requiredHeaders }, generatedAt }
   */
  function buildPlan(args) {
    var inv = args && args.inventory;
    if (!inv || !Array.isArray(inv.files)) throw PlanError('no-site', 'Load a site folder (or the demo) before building a plan.');
    if (inv.files.length === 0) throw PlanError('no-files', 'The site has no publishable files, so there is nothing to plan.');
    var dests = Array.isArray(args.destinations) ? args.destinations : [];
    if (dests.length === 0) throw PlanError('no-destinations', 'Add at least one destination before exporting a plan.');
    if (dests.length > destinations.MAX_DESTINATIONS) throw PlanError('too-many-destinations', 'At most ' + destinations.MAX_DESTINATIONS + ' destinations.');
    var settings = args.settings || {};
    var hv = validateHeaders(settings.requiredHeaders === undefined ? DEFAULT_HEADERS : settings.requiredHeaders);
    if (hv.errors.length) throw PlanError('bad-headers', hv.errors.map(function (e) { return e.message; }).join(' '));
    var planName = typeof settings.planName === 'string' ? settings.planName.trim().slice(0, 80) : '';
    if (!planName || /[\u0000-\u001f\u007f]/.test(planName) || destinations.findSecretLike(planName)) planName = inv.label + ' mirror plan';
    var generatedAt = args.generatedAt || new Date().toISOString();

    var sums = renderSha256Sums(inv.files);
    var included = {};
    inv.files.forEach(function (f) { included[f.path] = true; });

    var siteWarnings = inv.warnings.map(function (w) {
      var o = { code: w.code, level: w.level, message: w.message };
      if (w.hosts) o.hosts = w.hosts.slice();
      if (typeof w.count === 'number') o.count = w.count;
      var ps = (w.paths || []).filter(function (p) { return included[p]; });
      if (ps.length) o.paths = ps;
      return o;
    });

    var ctx = { facts: inv.facts, stats: inv.stats, requiredHeaders: hv.headers };
    var used = {};
    var destPlans = dests.map(function (raw, i) {
      var ev = destinations.evaluate(raw, ctx);
      var d = ev.normalized;
      var fileId = safeFileId(d, i, used);
      var config = destinations.redactForExport(raw);
      var caps = {};
      destinations.CAP_KEYS.forEach(function (k) {
        caps[k] = { declared: config.capabilities[k], source: 'user-declared', verified: false };
      });
      delete config.capabilities;
      return {
        id: config.id,
        fileId: fileId,
        name: config.name,
        type: d.type,
        typeLabel: destinations.TYPES[d.type].label,
        status: ev.status,
        statusLabel: ev.statusLabel,
        verified: false,
        addressState: d.address ? 'user-entered-unverified' : (d.type === 'tor-onion' || d.type === 'i2p' ? 'pending-operator-generated' : 'not-set'),
        basePath: d.basePath,
        config: config,
        capabilities: caps,
        requirements: ev.requirements.map(function (r) {
          return { key: r.key, level: r.level, declared: r.declared, satisfied: r.satisfied, detail: r.detail };
        }),
        missingConfiguration: ev.errors.map(function (e) { return { field: e.field, code: e.code, message: e.message }; }),
        blockers: ev.blockers.map(function (r) { return r.key; }),
        unconfirmed: ev.unknowns.map(function (r) { return r.key; }),
        warnings: ev.warnings.map(function (w) { return { field: w.field, code: w.code, message: w.message }; }),
        requiredHeaders: hv.headers.slice(),
        instructionsFile: 'instructions/' + fileId + '.md'
      };
    });

    var byStatus = {};
    [destinations.STATUS.INCOMPLETE, destinations.STATUS.BLOCKED, destinations.STATUS.UNVERIFIED, destinations.STATUS.READY].forEach(function (s) { byStatus[s] = 0; });
    destPlans.forEach(function (d) { byStatus[d.status] += 1; });

    return {
      schema: SCHEMA,
      tool: { name: TOOL.name, version: TOOL.version },
      generatedAt: generatedAt,
      planName: planName,
      mode: 'offline-plan-only',
      notice: NOTICE,
      verification: {
        performedByTool: false,
        networkRequests: 0,
        note: 'The planner cannot see destinations. Every status is computed from user-declared values only.'
      },
      disclaimers: DISCLAIMERS.slice(),
      site: {
        label: inv.label,
        source: inv.source,
        fileCount: inv.stats.fileCount,
        totalBytes: inv.stats.totalBytes,
        largestFileBytes: inv.stats.largestFileBytes,
        bytesPreserved: true,
        transformations: 'none',
        hashAlgorithm: 'sha256',
        manifestFile: 'SHA256SUMS',
        manifestSha256: sha256.sha256HexSync(sums),
        files: inv.files.map(function (f) {
          return { path: f.path, bytes: f.size, sha256: f.sha256, contentType: f.contentType };
        }),
        excludedSummary: { count: inv.excluded.length, byCategory: countBy(inv.excluded, 'category'), note: 'Excluded paths and contents are not exported.' },
        rejectedSummary: { count: inv.rejected.length, byCode: countBy(inv.rejected, 'code') },
        facts: {
          hasRootIndex: inv.facts.hasRootIndex,
          has404: inv.facts.has404,
          rootRelativeRefCount: inv.facts.rootRelativeRefCount,
          externalHosts: inv.facts.externalHosts.slice(),
          usesBrowserStorage: inv.facts.usesBrowserStorage
        },
        warnings: siteWarnings
      },
      settings: {
        requiredHeaders: hv.headers.slice()
      },
      summary: {
        destinationCount: destPlans.length,
        byStatus: byStatus
      },
      destinations: destPlans
    };
  }

  function mdEscape(text) {
    return String(text).replace(/[\\`*_{}\[\]<>|#]/g, '\\$&').replace(/\r?\n/g, ' ');
  }

  function shellQuote(text) {
    return "'" + String(text).replace(/'/g, "'\\''") + "'";
  }

  // Config value for templates: empty when the field failed validation, so
  // invalid or redacted input is never interpolated into instructions.
  function val(d, key) {
    var bad = d.missingConfiguration.some(function (m) { return m.field === key; });
    return bad ? '' : (d.config[key] || '');
  }

  function targetDir(d) {
    var root = val(d, 'documentRoot') || '<DOCUMENT_ROOT>';
    var bp = d.basePath === '/' ? '' : d.basePath.replace(/\/+$/, '');
    return root + bp;
  }

  function listenParts(d) {
    var raw = val(d, 'listen');
    var l = destinations.parseListen(raw);
    if (!l) return { host: '127.0.0.1', port: '<PORT>', raw: '127.0.0.1:<PORT>', placeholder: true };
    return { host: l.host, port: String(l.port), raw: raw, placeholder: false };
  }

  function nginxTemplate(plan, d) {
    var l = listenParts(d);
    var bp = d.basePath;
    var anon = d.type === 'tor-onion' || d.type === 'i2p';
    var lines = [
      '# Inert template generated by offline-mirror-planner. Review and adapt before use.',
      '# Nothing was installed, written or started by the planner.',
      'server {',
      '    listen ' + l.raw + ';',
      '    server_name _;  # set your host name' + (anon ? ' (or the address once the operator\'s ' + (d.type === 'i2p' ? 'router' : 'Tor') + ' creates it)' : ''),
      '    root ' + (val(d, 'documentRoot') || '<DOCUMENT_ROOT>') + ';',
      '    index index.html;',
      '    autoindex off;',
      '    server_tokens off;'
    ];
    if (anon) lines.push('    access_log off;  # minimal logging for Tor/I2P visitors');
    plan.settings.requiredHeaders.forEach(function (h) {
      lines.push('    add_header ' + h.name + ' "' + h.value + '" always;');
    });
    lines.push('');
    lines.push('    # Never serve hidden files (only /.well-known/ is part of the site).');
    lines.push('    location ~ /\\.(?!well-known/) { deny all; }');
    lines.push('');
    lines.push('    location ' + bp + ' {');
    lines.push('        try_files $uri $uri/ =404;');
    lines.push('    }');
    if (plan.site.facts.has404) lines.push('    error_page 404 ' + bp + '404.html;');
    lines.push('}');
    return lines.join('\n');
  }

  function caddyTemplate(plan, d) {
    var l = listenParts(d);
    var bp = d.basePath;
    var lines = [
      '# Inert template generated by offline-mirror-planner. Review and adapt before use.',
      '# Nothing was installed, written or started by the planner.',
      'http://' + l.raw + ' {',
      '    bind ' + l.host.replace(/^\[|\]$/g, ''),
      '    root * ' + (val(d, 'documentRoot') || '<DOCUMENT_ROOT>'),
      '    header {'
    ];
    plan.settings.requiredHeaders.forEach(function (h) {
      lines.push('        ' + h.name + ' "' + h.value + '"');
    });
    lines.push('        -Server');
    lines.push('    }');
    lines.push('    # Never serve hidden files (only /.well-known/ is part of the site).');
    lines.push('    @hidden {');
    lines.push('        path_regexp /\\.');
    lines.push('        not path /.well-known/*');
    lines.push('    }');
    lines.push('    respond @hidden 404');
    lines.push('    file_server');
    if (plan.site.facts.has404) {
      lines.push('    handle_errors {');
      lines.push('        @notfound expression {err.status_code} == 404');
      lines.push('        rewrite @notfound ' + bp + '404.html');
      lines.push('        file_server');
      lines.push('    }');
    }
    lines.push('    # Caddy writes no access log unless you add a "log" directive.');
    lines.push('}');
    return lines.join('\n');
  }

  function torrcTemplate(d) {
    var l = listenParts(d);
    return [
      '# Inert torrc snippet generated by offline-mirror-planner. Review before use.',
      '# The planner did not create keys, an onion address or start Tor.',
      '# Tor creates the keys and "hostname" file inside HiddenServiceDir the first',
      '# time it starts with this config, on the operator\'s own machine.',
      '# Keep that directory private (owned by the Tor user, mode 700). Never put it',
      '# inside the document root, this plan, a shared backup or version control.',
      'HiddenServiceDir /var/lib/tor/' + d.fileId + '/',
      'HiddenServicePort 80 ' + l.raw
    ].join('\n');
  }

  function i2pdTemplate(d) {
    var l = listenParts(d);
    return [
      '# Inert i2pd tunnels.conf snippet generated by offline-mirror-planner.',
      '# The planner did not create keys, a .i2p address or start i2pd.',
      '# i2pd creates the keys file on first start if it does not exist, on the',
      '# operator\'s own machine. Keep it private and out of the document root.',
      '[' + d.fileId + ']',
      'type = http',
      'host = ' + l.host.replace(/^\[|\]$/g, ''),
      'port = ' + l.port,
      'keys = ' + d.fileId + '.dat'
    ].join('\n');
  }

  function contentTypeTable(plan) {
    var map = {};
    plan.site.files.forEach(function (f) {
      var m = /\.([^.\/]+)$/.exec(f.path);
      var ext = m ? '.' + m[1].toLowerCase() : '(no extension)';
      map[ext] = f.contentType;
    });
    var rows = Object.keys(map).sort().slice(0, 60).map(function (ext) {
      return '| `' + ext + '` | `' + map[ext] + '` |';
    });
    return ['| Extension | Content-Type |', '|---|---|'].concat(rows).join('\n');
  }

  function bulletList(items, empty) {
    if (!items.length) return '- ' + empty;
    return items.map(function (s) { return '- ' + s; }).join('\n');
  }

  /*
   * Render operator instructions (Markdown) for one destination of a plan.
   */
  function renderInstructions(plan, destId) {
    var d = null;
    plan.destinations.forEach(function (x) { if (x.fileId === destId || x.id === destId) d = d || x; });
    if (!d) throw PlanError('unknown-destination', 'No destination "' + destId + '" in this plan.');
    var anon = d.type === 'tor-onion' || d.type === 'i2p';
    var serverBased = d.type !== 'static-host';
    var out = [];
    var addr;
    if (d.addressState === 'user-entered-unverified') addr = val(d, 'address') ? '`' + val(d, 'address') + '` (user-entered, not checked)' : '_invalid — see section 0_';
    else if (d.addressState === 'pending-operator-generated') addr = '_pending — created later by the operator\'s own ' + (d.type === 'i2p' ? 'I2P router' : 'Tor') + '; never generated by this planner_';
    else addr = '_not set_';

    out.push('# Operator instructions: ' + mdEscape(d.name || d.fileId));
    out.push('');
    out.push('> **' + plan.notice + '**');
    out.push('> Generated by ' + plan.tool.name + ' ' + plan.tool.version + ' at ' + plan.generatedAt + ' for plan "' + mdEscape(plan.planName) + '".');
    out.push('');
    out.push('| Item | Value |');
    out.push('|---|---|');
    out.push('| Destination id | `' + d.fileId + '` |');
    out.push('| Type | ' + d.typeLabel + ' |');
    out.push('| Status | **' + d.status + '** — ' + d.statusLabel + ' |');
    out.push('| Verified by this tool | no — the planner makes no network requests |');
    out.push('| Address | ' + addr + ' |');
    out.push('| Base path | `' + d.basePath + '` |');
    if (serverBased) {
      out.push('| Web server | ' + (val(d, 'serverSoftware') || '_not set_') + ' |');
      out.push('| Listen | ' + (val(d, 'listen') ? '`' + val(d, 'listen') + '`' : '_not set_') + ' |');
      out.push('| Document root | ' + (val(d, 'documentRoot') ? '`' + val(d, 'documentRoot') + '`' : '_not set_') + ' |');
    } else {
      out.push('| Provider (user-entered) | ' + (val(d, 'providerLabel') ? mdEscape(val(d, 'providerLabel')) : '_not set_') + ' |');
    }
    if (d.type === 'i2p') out.push('| I2P router | ' + (val(d, 'router') || '_not set_') + ' |');
    out.push('| Site | ' + plan.site.fileCount + ' files, ' + plan.site.totalBytes + ' bytes |');
    out.push('| Manifest | `SHA256SUMS` (sha256 `' + plan.site.manifestSha256 + '`) |');
    out.push('');

    out.push('## 0. Resolve before you start');
    out.push('');
    out.push('**Missing or invalid configuration**');
    out.push('');
    out.push(bulletList(d.missingConfiguration.map(function (m) { return '`' + m.field + '`: ' + m.message; }), 'None.'));
    out.push('');
    out.push('**Blockers (declared capability does not meet a requirement)**');
    out.push('');
    out.push(bulletList(d.blockers.map(function (k) { return '`' + k + '`'; }), 'None.'));
    out.push('');
    out.push('**Not yet confirmed (declared "unknown")**');
    out.push('');
    out.push(bulletList(d.unconfirmed.map(function (k) { return '`' + k + '`'; }), 'None.'));
    out.push('');
    out.push('**Warnings**');
    out.push('');
    out.push(bulletList(d.warnings.map(function (w) { return w.message; }), 'None.'));
    out.push('');

    out.push('## 1. Copy the site files unchanged');
    out.push('');
    out.push('Copy **only** the files listed in `SHA256SUMS`, byte-for-byte. Do not minify, rewrite, re-encode or "optimise" them. Do not copy anything that is not in the manifest (no `.env`, `.git`, backups, databases or keys).');
    out.push('');
    if (serverBased) {
      out.push('Run on the operator\'s machine, from the original site folder (adjust `PLAN_DIR`):');
      out.push('');
      out.push('```sh');
      out.push('PLAN_DIR=/path/to/exported-plan');
      out.push('TARGET=' + shellQuote(targetDir(d)));
      out.push('cut -c67- "$PLAN_DIR/SHA256SUMS" > /tmp/mirror-files.txt');
      out.push('mkdir -p "$TARGET"');
      out.push('rsync -a --files-from=/tmp/mirror-files.txt ./ "$TARGET/"');
      out.push('```');
    } else {
      out.push('Use the provider\'s own upload method to place the files so they are served under `' + d.basePath + '`. Turn off any provider build, minify or asset-rewrite step for these files.');
    }
    out.push('');

    out.push('## 2. Verify the bytes');
    out.push('');
    if (serverBased) {
      out.push('```sh');
      out.push('cd "$TARGET"');
      out.push('sha256sum -c "$PLAN_DIR/SHA256SUMS"          # Linux');
      out.push('# shasum -a 256 -c "$PLAN_DIR/SHA256SUMS"   # macOS');
      out.push('```');
      out.push('');
      out.push('Every line must end in `OK`.');
    } else {
      out.push('If the provider lets you download what it stores, download it and run `sha256sum -c SHA256SUMS` on that copy. Otherwise spot-check files against the hashes in `deployment-plan.json`.');
    }
    out.push('');

    out.push('## 3. Configure serving');
    out.push('');
    if (serverBased && val(d, 'serverSoftware') === 'nginx') {
      out.push('Inert nginx template (review every line before use):');
      out.push('');
      out.push('```nginx');
      out.push(nginxTemplate(plan, d));
      out.push('```');
    } else if (serverBased && val(d, 'serverSoftware') === 'caddy') {
      out.push('Inert Caddyfile template (review every line before use):');
      out.push('');
      out.push('```caddyfile');
      out.push(caddyTemplate(plan, d));
      out.push('```');
    } else if (serverBased) {
      out.push('Configure your web server to:');
      out.push('');
      out.push('- listen on `' + listenParts(d).raw + '`' + (anon ? ' (loopback only)' : '') + ';');
      out.push('- serve `' + (val(d, 'documentRoot') || '<DOCUMENT_ROOT>') + '` as static files, with `index.html` as the directory index;');
      out.push('- refuse hidden files (paths with a segment starting with `.`, except `/.well-known/`);');
      out.push('- send the headers in section 5' + (plan.site.facts.has404 ? ' and serve `' + d.basePath + '404.html` for missing pages' : '') + '.');
    } else {
      out.push('In the provider\'s own settings (if it offers them — nothing here confirms that it does):');
      out.push('');
      out.push('- serve `index.html` for directory URLs (declared: `' + d.capabilities.directoryIndex.declared + '`);');
      out.push('- set the response headers in section 5 (declared: `' + d.capabilities.customHeaders.declared + '`);');
      if (plan.site.facts.has404) out.push('- use `' + d.basePath + '404.html` as the not-found page (declared: `' + d.capabilities.customErrorPages.declared + '`);');
      out.push('- serve over HTTPS (declared: `' + d.capabilities.https.declared + '`).');
    }
    out.push('');
    out.push('Content types to serve (from file extensions):');
    out.push('');
    out.push(contentTypeTable(plan));
    out.push('');

    if (d.type === 'tor-onion') {
      out.push('## 4. Tor onion service (inert template)');
      out.push('');
      out.push('The planner did **not** create an onion identity, keys or address, and did not start Tor. On the operator\'s own machine, after reviewing it, add:');
      out.push('');
      out.push('```');
      out.push(torrcTemplate(d));
      out.push('```');
      out.push('');
      out.push('- The web server above must listen on loopback only, so it cannot be reached except through Tor.');
      out.push('- The onion address appears in `HiddenServiceDir/hostname` after Tor first starts. You may then enter it in the planner and re-export. Never paste key files into the planner.');
      out.push('- Back up the HiddenServiceDir privately and separately; losing it loses the address.');
      out.push('');
    } else if (d.type === 'i2p') {
      out.push('## 4. I2P site (inert template)');
      out.push('');
      out.push('The planner did **not** create an I2P destination, keys or address, and did not start a router.');
      out.push('');
      if (val(d, 'router') === 'java-i2p') {
        out.push('Java I2P router (operator\'s own machine): open the router console → Hidden Services Manager → create a new **HTTP server** tunnel → target host `' + listenParts(d).host + '`, port `' + listenParts(d).port + '` → save and start it yourself. The router generates the keys; keep them private and backed up separately.');
      } else {
        out.push('i2pd (operator\'s own machine), add to `tunnels.conf` after review:');
        out.push('');
        out.push('```ini');
        out.push(i2pdTemplate(d));
        out.push('```');
      }
      out.push('');
      out.push('- The web server above must listen on loopback only.');
      out.push('- Once the router shows the new .b32.i2p address you may enter it in the planner and re-export. Never paste key files into the planner.');
      out.push('');
    } else {
      out.push('## 4. Address');
      out.push('');
      out.push('Address: ' + addr + '. The planner does not register domains, sign up for hosting or check that this address resolves.');
      out.push('');
    }

    out.push('## 5. Required response headers');
    out.push('');
    if (plan.settings.requiredHeaders.length) {
      out.push('| Header | Value |');
      out.push('|---|---|');
      plan.settings.requiredHeaders.forEach(function (h) { out.push('| `' + h.name + '` | `' + h.value + '` |'); });
    } else {
      out.push('No required headers in this plan.');
    }
    out.push('');
    out.push('Plus the per-file `Content-Type` listed in `deployment-plan.json` (`site.files[].contentType`).');
    out.push('');

    out.push('## 6. Manual review checklist');
    out.push('');
    var checks = [
      'Every `SHA256SUMS` line verifies `OK` on the destination copy.',
      'No file outside the manifest is reachable (try `/.env`, `/.git/config`, a backup name).',
      'Directory URLs serve `index.html`' + (d.basePath !== '/' ? ' under `' + d.basePath + '`' : '') + '.',
      'Responses carry the headers in section 5 and the expected `Content-Type` (checked by the operator with their own tools).'
    ];
    if (plan.site.facts.has404) checks.push('A missing page returns the site\'s 404 page with status 404.');
    if (d.basePath !== '/' && plan.site.facts.rootRelativeRefCount) checks.push('Root-relative links (' + plan.site.facts.rootRelativeRefCount + ') reviewed: they point outside `' + d.basePath + '`.');
    if (plan.site.facts.externalHosts.length) checks.push('External references reviewed (' + plan.site.facts.externalHosts.map(function (h) { return '`' + h + '`'; }).join(', ') + ').');
    if (anon) {
      checks.push('Web server listens on loopback only; it is not reachable without ' + (d.type === 'i2p' ? 'I2P' : 'Tor') + '.');
      checks.push('Key directory is outside the document root and not in any shared backup.');
      checks.push('Request logging is off or minimal.');
    }
    destinations.CAP_KEYS.forEach(function (k) {
      checks.push('Operator confirmed `' + k + '` (declared `' + d.capabilities[k].declared + '`).');
    });
    out.push(checks.map(function (c) { return '- [ ] ' + c; }).join('\n'));
    out.push('');

    out.push('## What this plan does not do');
    out.push('');
    out.push(plan.disclaimers.map(function (s) { return '- ' + s; }).join('\n'));
    out.push('');
    return out.join('\n');
  }

  function renderBundleReadme(plan) {
    var lines = [
      plan.tool.name + ' ' + plan.tool.version + ' export',
      'Plan: ' + plan.planName,
      'Generated: ' + plan.generatedAt,
      '',
      plan.notice,
      '',
      'Contents:',
      '  deployment-plan.json        Full plan (schema ' + plan.schema + ').',
      '  SHA256SUMS                  Manifest of site files; verify copies with sha256sum -c.',
      '  instructions/<id>.md        Operator instructions per destination.',
      '',
      'The site files themselves are NOT in this bundle. Copy them from the original',
      'folder, unchanged, using the manifest.',
      '',
      'Destinations:'
    ];
    plan.destinations.forEach(function (d) {
      lines.push('  ' + d.fileId + '  [' + d.status + ']  ' + d.typeLabel);
    });
    lines.push('');
    lines.push('Disclaimers:');
    plan.disclaimers.forEach(function (s) { lines.push('  - ' + s); });
    lines.push('');
    return lines.join('\n');
  }

  /*
   * All export files for a plan: [{ name, text }].
   */
  function buildExportFiles(plan) {
    var files = [
      { name: 'README.txt', text: renderBundleReadme(plan) },
      { name: 'deployment-plan.json', text: JSON.stringify(plan, null, 2) + '\n' },
      { name: 'SHA256SUMS', text: renderSha256Sums(plan.site.files.map(function (f) { return { sha256: f.sha256, path: f.path }; })) }
    ];
    plan.destinations.forEach(function (d) {
      files.push({ name: 'instructions/' + d.fileId + '.md', text: renderInstructions(plan, d.fileId) });
    });
    return files;
  }

  return {
    TOOL: TOOL,
    SCHEMA: SCHEMA,
    DEFAULT_HEADERS: DEFAULT_HEADERS,
    DISCLAIMERS: DISCLAIMERS,
    NOTICE: NOTICE,
    validateHeaders: validateHeaders,
    renderSha256Sums: renderSha256Sums,
    buildPlan: buildPlan,
    renderInstructions: renderInstructions,
    buildExportFiles: buildExportFiles,
    templates: { nginx: nginxTemplate, caddy: caddyTemplate, torrc: torrcTemplate, i2pd: i2pdTemplate }
  };
});
