/*
 * Offline Mirror Planner — browser UI.
 *
 * Classic script (no modules) so the page works from file://. All DOM is
 * built with createElement/textContent; user- and file-derived strings are
 * never parsed as HTML. State lives in memory only: nothing is written to
 * localStorage, IndexedDB, cookies or any other storage, and nothing is sent
 * over the network.
 */
(function () {
  'use strict';

  var OMP = window.OMP || {};
  var core = OMP.core, D = OMP.destinations, P = OMP.plan, Z = OMP.zip, demo = OMP.demo;

  if (!core || !D || !P || !Z || !demo) return; // boot-error banner stays visible

  var L = core.LIMITS;
  var $ = function (id) { return document.getElementById(id); };

  // ------------------------------------------------------------- state

  var state = {
    inventory: null,
    sources: null,        // Map: inventory path -> { kind: 'file', file } | { kind: 'bytes', bytes }
    siteSource: '',       // human description of where the site came from
    destinations: [],     // raw destination records as edited
    settings: P.defaultSettings(),
    busy: false,
    version: 0
  };

  var exportCache = null;

  // ----------------------------------------------------------- helpers

  var uid = 0;
  function nextId(prefix) { uid += 1; return (prefix || 'el') + '-' + uid; }

  var BOOL_PROPS = { hidden: 1, checked: 1, disabled: 1, selected: 1, multiple: 1, value: 1 };

  /** createElement with safe properties. Strings in `kids` become text nodes. */
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'text') n.textContent = String(v);
        else if (k === 'class') n.className = v;
        else if (k === 'on') Object.keys(v).forEach(function (ev) { n.addEventListener(ev, v[ev]); });
        else if (BOOL_PROPS[k]) n[k] = v;
        else {
          if (/^on/i.test(k) || k === 'style') throw new Error('Refusing to set attribute ' + k);
          n.setAttribute(k, v === true ? '' : String(v));
        }
      });
    }
    append(n, kids);
    return n;
  }

  function append(n, kids) {
    if (kids === undefined || kids === null || kids === false) return n;
    if (!Array.isArray(kids)) kids = [kids];
    kids.forEach(function (k) {
      if (k === undefined || k === null || k === false) return;
      n.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    });
    return n;
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  function announce(text) {
    var live = $('live');
    live.textContent = '';
    setTimeout(function () { live.textContent = text; }, 30);
  }

  function showMessage(node, kind, content) {
    clear(node);
    if (content === null || content === undefined || content === '') { node.hidden = true; return; }
    node.className = 'message' + (kind ? ' ' + kind : '');
    append(node, content);
    node.hidden = false;
  }

  function errorText(err) {
    if (!err) return 'Unknown error.';
    return err.message ? String(err.message) : String(err);
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  // scope 'destination': only one destination changed, and its card was
  // already refreshed; other cards do not depend on it.
  var allCardsStale = false;
  function changed(scope) {
    state.version += 1;
    exportCache = null;
    if (scope !== 'destination') allCardsStale = true;
    scheduleDerived();
  }

  var derivedTimer = null;
  function scheduleDerived() {
    if (derivedTimer) clearTimeout(derivedTimer);
    derivedTimer = setTimeout(function () { derivedTimer = null; renderDerived(); }, 150);
  }

  function renderDerived() {
    if (derivedTimer) { clearTimeout(derivedTimer); derivedTimer = null; }
    if (allCardsStale) { allCardsStale = false; refreshAllDestinations(); }
    renderCompare();
    renderSettingsStatus();
    renderExport();
  }

  function sanitizedSettings() { return P.sanitizeSettings(state.settings); }

  function assessCtx() {
    return { inventory: state.inventory, headers: sanitizedSettings().settings.headers };
  }

  function assess(d) {
    var s = D.sanitizeDestination(d);
    return { record: s, a: D.assessDestination(s, assessCtx()) };
  }

  // ---------------------------------------------------------- downloads

  function download(name, data, mime) {
    var blob = new Blob([data], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = el('a', { href: url, download: name, class: 'visually-hidden' }, name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke once the browser has had time to start the download.
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    announce('Saved ' + name + ' through your browser.');
  }

  // ------------------------------------------------------------ notices

  function renderStatic() {
    var lim = $('limitations-list');
    P.LIMITATIONS.forEach(function (t) { lim.appendChild(el('li', { text: t })); });

    var limits = $('limits-list');
    [
      'At most ' + L.maxFiles + ' files per site.',
      'At most ' + core.formatBytes(L.maxFileBytes) + ' per file and ' + core.formatBytes(L.maxTotalBytes) + ' in total.',
      'Paths up to ' + L.maxPathLength + ' characters, ' + L.maxPathDepth + ' folder levels deep, ' + L.maxSegmentLength + ' characters per name.',
      'Names must be portable: no backslashes, control characters, < > : " | ? *, trailing dots or spaces, or reserved Windows device names. Unsafe names are rejected, never renamed.',
      'Only the first ' + core.formatBytes(L.maxTextScanBytes) + ' of each text file are scanned for secrets and links.',
      'At most ' + L.maxDestinations + ' destinations and ' + L.maxHeaders + ' headers. Imports up to ' + core.formatBytes(L.maxImportBytes) + '.'
    ].forEach(function (t) { limits.appendChild(el('li', { text: t })); });

    $('import-hint').textContent = 'Up to ' + core.formatBytes(L.maxImportBytes) + '. Only known destination fields are kept; anything else is dropped. Importing replaces the current destinations (and settings, if the file has them).';
  }

  // --------------------------------------------------------------- site

  function setBusy(b) {
    state.busy = b;
    ['folder-input', 'demo-site', 'demo-site-clean', 'clear-site', 'dl-bundle', 'dl-zip', 'import-input'].forEach(function (id) { $(id).disabled = b; });
    $('drop-zone').classList.toggle('disabled', b);
    if (!b) renderExportButtons();
  }

  /**
   * entries: [{ path, size, read }] in folder-picker form.
   * sourceOf(i): the in-memory source for entry i (used for bundles only).
   */
  function loadEntries(entries, sourceOf, description) {
    if (state.busy) return;
    showMessage($('site-error'), 'error', null);
    setBusy(true);
    var prog = $('inv-progress'), bar = $('inv-progress-bar'), ptext = $('inv-progress-text');
    prog.hidden = false;
    bar.max = Math.max(entries.length, 1);
    bar.value = 0;
    ptext.textContent = 'Starting…';

    // Mirror the engine's root stripping so sources line up with inventory paths.
    var raw = entries.map(function (e) { return e && typeof e.path === 'string' ? e.path : ''; });
    var stripped = core.stripCommonRoot(raw);
    var sources = new Map();
    stripped.paths.forEach(function (p, i) { if (!sources.has(p)) sources.set(p, sourceOf(i)); });

    core.buildInventory(entries, {
      onProgress: function (p) {
        bar.value = p.done;
        ptext.textContent = p.path ? 'File ' + p.done + ' of ' + p.total + ': ' + p.path : 'Computing manifest…';
      }
    }).then(function (inv) {
      state.inventory = inv;
      state.sources = sources;
      state.siteSource = description;
      if (state.settings.siteLabel === P.defaultSettings().siteLabel) {
        if (description === 'demo') state.settings.siteLabel = demo.settings().siteLabel;
        else if (inv.rootFolder) state.settings.siteLabel = inv.rootFolder.slice(0, L.maxLabelLength);
        $('site-label').value = state.settings.siteLabel;
      }
      renderInventory();
      refreshAllDestinations();
      changed();
      announce('Inventory complete: ' + plural(inv.totals.fileCount, 'file') + ' included, ' + inv.totals.excludedCount + ' excluded, ' + inv.totals.rejectedCount + ' rejected.');
    }, function (err) {
      var msg = [el('strong', { text: 'The site could not be inventoried. ' }), errorText(err)];
      if (state.inventory) msg.push(' The previously loaded site is still in use.');
      showMessage($('site-error'), 'error', msg);
      announce('Inventory failed: ' + errorText(err));
    }).then(function () {
      prog.hidden = true;
      setBusy(false);
    });
  }

  function loadFiles(files, description) {
    var list = Array.prototype.slice.call(files);
    var entries = list.map(function (f) {
      return { path: f.webkitRelativePath || f.name, size: f.size, read: function () { return f.arrayBuffer(); } };
    });
    loadEntries(entries, function (i) { return { kind: 'file', file: list[i] }; }, description);
  }

  function loadDemo(clean) {
    var entries = clean ? demo.entries({ includeBait: false, includeUnsafe: false }) : demo.entries();
    loadEntries(entries, function (i) { return { kind: 'bytes', bytes: entries[i].bytes }; }, 'demo');
  }

  function onFolderInput(e) {
    var input = e.target;
    if (!input.files || !input.files.length) return;
    var files = Array.prototype.slice.call(input.files);
    input.value = '';
    loadFiles(files, 'folder');
  }

  // Drag-and-drop of a folder (Chromium, Firefox, Safari via webkitGetAsEntry).
  function readAllEntries(dirEntry) {
    return new Promise(function (resolve, reject) {
      var reader = dirEntry.createReader();
      var all = [];
      (function more() {
        reader.readEntries(function (batch) {
          if (!batch.length) resolve(all);
          else { all = all.concat(Array.prototype.slice.call(batch)); more(); }
        }, reject);
      })();
    });
  }

  function walkEntries(roots) {
    var out = [];
    var tooMany = false;
    function visit(entry) {
      if (tooMany) return Promise.resolve();
      if (entry.isFile) {
        return new Promise(function (resolve, reject) { entry.file(resolve, reject); }).then(function (file) {
          out.push({ file: file, path: entry.fullPath.replace(/^\/+/, '') });
          if (out.length > L.maxFiles) tooMany = true;
        });
      }
      if (entry.isDirectory) {
        return readAllEntries(entry).then(function (children) {
          return children.reduce(function (p, c) { return p.then(function () { return visit(c); }); }, Promise.resolve());
        });
      }
      return Promise.resolve();
    }
    return roots.reduce(function (p, r) { return p.then(function () { return visit(r); }); }, Promise.resolve()).then(function () { return out; });
  }

  function onDrop(e) {
    e.preventDefault();
    $('drop-zone').classList.remove('over');
    if (state.busy) return;
    var dt = e.dataTransfer;
    var roots = [];
    if (dt && dt.items) {
      for (var i = 0; i < dt.items.length; i++) {
        var it = dt.items[i];
        var entry = it.kind === 'file' && it.webkitGetAsEntry ? it.webkitGetAsEntry() : null;
        if (entry) roots.push(entry);
      }
    }
    if (!roots.length) {
      showMessage($('site-error'), 'error', 'Nothing usable was dropped. Drop a folder, or use "Choose a site folder".');
      return;
    }
    walkEntries(roots).then(function (found) {
      var entries = found.map(function (f) {
        return { path: f.path, size: f.file.size, read: function () { return f.file.arrayBuffer(); } };
      });
      loadEntries(entries, function (i) { return { kind: 'file', file: found[i].file }; }, 'folder');
    }, function (err) {
      showMessage($('site-error'), 'error', 'The dropped folder could not be read: ' + errorText(err));
    });
  }

  function clearSite() {
    if (state.busy) return;
    state.inventory = null;
    state.sources = null;
    state.siteSource = '';
    showMessage($('site-error'), 'error', null);
    renderInventory();
    refreshAllDestinations();
    changed();
    announce('Site cleared.');
  }

  function tableWrap(label, table) {
    return el('div', { class: 'table-wrap', role: 'region', 'aria-label': label, tabindex: '0' }, table);
  }

  function renderInventory() {
    var root = clear($('inventory'));
    var inv = state.inventory;
    $('clear-site').disabled = state.busy || !inv;
    if (!inv) {
      root.appendChild(el('p', { class: 'empty', text: 'No site loaded yet.' }));
      return;
    }
    var t = inv.totals;
    root.appendChild(el('h3', { text: 'Inventory' }));
    var dl = el('dl', { class: 'summary', id: 'inv-summary' });
    function row(k, v, id) { dl.appendChild(el('dt', { text: k })); dl.appendChild(el('dd', { id: id }, v)); }
    row('Source', state.siteSource === 'demo' ? 'Built-in demo (generated in memory)' : 'Local folder' + (inv.rootFolder ? ' "' + inv.rootFolder + '"' : ''), 'inv-source');
    row('Files included', String(t.fileCount), 'inv-file-count');
    row('Total size', core.formatBytes(t.totalBytes), 'inv-total-bytes');
    row('Largest file', core.formatBytes(t.largestFileBytes));
    row('Excluded (sensitive)', String(t.excludedCount), 'inv-excluded-count');
    row('Rejected', String(t.rejectedCount), 'inv-rejected-count');
    row('Entries examined', String(t.inputCount));
    row('Manifest SHA-256', [el('code', { class: 'hash', id: 'inv-manifest', text: inv.manifestSha256 }), el('span', { class: 'hint block', text: 'SHA-256 of the SHA256SUMS file listing every included file.' })]);
    root.appendChild(dl);

    if (t.rejectedCount) {
      root.appendChild(el('p', { class: 'message warning', text: plural(t.rejectedCount, 'entry was', 'entries were') + ' rejected. The plan stays a draft until they are fixed or removed in the source folder and the folder is selected again.' }));
    }

    if (inv.warnings.length) {
      root.appendChild(el('h4', { text: 'Warnings (' + inv.warnings.length + ')' }));
      var wl = el('ul', { class: 'warnings', id: 'inv-warnings' });
      inv.warnings.forEach(function (w) { wl.appendChild(el('li', null, w.path ? [el('code', { text: w.path }), ': ' + w.message] : w.message)); });
      root.appendChild(wl);
    }
    if (inv.rootAbsoluteLinkFiles.length) {
      root.appendChild(el('p', { class: 'hint', text: plural(inv.rootAbsoluteLinkFiles.length, 'file uses', 'files use') + ' root-absolute links ("/…"); these break if a destination serves the site under a base path other than "/". Site bytes are never rewritten.' }));
    }
    if (inv.externalReferenceFiles.length) {
      root.appendChild(el('p', { class: 'hint', text: plural(inv.externalReferenceFiles.length, 'file references', 'files reference') + ' external hosts. On onion and I2P mirrors such requests leave the overlay network or fail.' }));
    }

    // Included files.
    var ft = el('table', { class: 'data', id: 'files-table' });
    ft.appendChild(el('caption', { text: 'Included files (' + inv.files.length + ')' }));
    ft.appendChild(el('thead', null, el('tr', null, ['Path', 'Size', 'Type', 'SHA-256', 'Flags and notes'].map(function (h) { return el('th', { scope: 'col', text: h }); }))));
    var tb = el('tbody');
    inv.files.forEach(function (f) {
      var notes = f.flags.slice().concat(f.notes || []);
      tb.appendChild(el('tr', null, [
        el('td', { class: 'path' }, el('code', { text: f.path })),
        el('td', { class: 'num', text: core.formatBytes(f.size) }),
        el('td', { text: f.mediaType }),
        el('td', null, el('code', { class: 'hash', text: f.sha256 })),
        el('td', null, notes.length ? el('ul', { class: 'plain' }, notes.map(function (n) { return el('li', { text: n }); })) : '—')
      ]));
    });
    ft.appendChild(tb);
    root.appendChild(tableWrap('Included files', ft));

    // Excluded.
    var et = el('table', { class: 'data', id: 'excluded-table' });
    et.appendChild(el('caption', { text: 'Excluded as sensitive (' + inv.excluded.length + ') — never hashed into the plan, never bundled' }));
    et.appendChild(el('thead', null, el('tr', null, ['Path', 'Size', 'Category', 'Reason'].map(function (h) { return el('th', { scope: 'col', text: h }); }))));
    var eb = el('tbody');
    if (!inv.excluded.length) eb.appendChild(el('tr', null, el('td', { colspan: '4', class: 'empty', text: 'No files were excluded.' })));
    inv.excluded.forEach(function (x) {
      eb.appendChild(el('tr', null, [
        el('td', { class: 'path' }, el('code', { text: x.path })),
        el('td', { class: 'num', text: core.formatBytes(x.size) }),
        el('td', { text: x.category }),
        el('td', { text: x.reason })
      ]));
    });
    et.appendChild(eb);
    root.appendChild(tableWrap('Excluded files', et));

    // Rejected.
    var rt = el('table', { class: 'data', id: 'rejected-table' });
    rt.appendChild(el('caption', { text: 'Rejected (' + inv.rejected.length + ') — never bundled' }));
    rt.appendChild(el('thead', null, el('tr', null, ['Path', 'Category', 'Reason'].map(function (h) { return el('th', { scope: 'col', text: h }); }))));
    var rb = el('tbody');
    if (!inv.rejected.length) rb.appendChild(el('tr', null, el('td', { colspan: '3', class: 'empty', text: 'No entries were rejected.' })));
    inv.rejected.forEach(function (x) {
      rb.appendChild(el('tr', null, [
        el('td', { class: 'path' }, el('code', { text: x.path })),
        el('td', { text: x.category }),
        el('td', { text: x.reason })
      ]));
    });
    rt.appendChild(rb);
    root.appendChild(tableWrap('Rejected entries', rt));
  }

  // -------------------------------------------------------- destinations

  var STATE_CLASS = {
    'needs-configuration': 'state-needs',
    'blocked-by-declared-capability': 'state-blocked',
    'unverified': 'state-unverified',
    'ready-for-manual-review': 'state-ready'
  };

  function stateBadge(a) {
    return el('span', { class: 'badge ' + (STATE_CLASS[a.state] || ''), 'data-state': a.state, text: D.STATE_LABELS[a.state] || a.state });
  }

  function findDest(id) {
    for (var i = 0; i < state.destinations.length; i++) if (state.destinations[i].id === id) return i;
    return -1;
  }

  function renderDestControls() {
    var n = state.destinations.length;
    var full = n >= L.maxDestinations;
    $('dest-add').disabled = full;
    $('dest-count').textContent = n + ' of ' + L.maxDestinations + ' destinations' + (full ? ' — the maximum is reached; remove one to add another.' : '.');
    var t = D.TYPES[$('dest-type').value];
    $('dest-type-summary').textContent = t ? t.summary : '';
  }

  function addDestination() {
    if (state.destinations.length >= L.maxDestinations) { renderDestControls(); return; }
    var d = D.createDestination($('dest-type').value);
    state.destinations.push(d);
    insertCard(d, null);
    changed('destination');
    var card = $('dest-' + d.id);
    if (card) { card.scrollIntoView({ block: 'start' }); var f = card.querySelector('input, select, textarea'); if (f) f.focus(); }
    announce('Added destination "' + d.label + '".');
  }

  function duplicateDestination(id) {
    var i = findDest(id);
    if (i < 0) return;
    if (state.destinations.length >= L.maxDestinations) {
      showMessage($('dest-message'), 'warning', 'At most ' + L.maxDestinations + ' destinations can be planned.');
      return;
    }
    var copy = JSON.parse(JSON.stringify(state.destinations[i]));
    copy.id = D.newId();
    copy.label = (String(copy.label || '') + ' (copy)').slice(0, L.maxLabelLength);
    state.destinations.splice(i + 1, 0, copy);
    insertCard(copy, $('dest-' + state.destinations[i].id).nextSibling);
    changed('destination');
    var card = $('dest-' + copy.id);
    if (card) { card.scrollIntoView({ block: 'start' }); var f = card.querySelector('input'); if (f) f.focus(); }
    announce('Duplicated destination as "' + copy.label + '".');
  }

  function removeDestination(id) {
    var i = findDest(id);
    if (i < 0) return;
    var label = state.destinations[i].label || D.TYPES[state.destinations[i].type].label;
    if (!window.confirm('Remove the destination "' + label + '"? This cannot be undone (state is only kept in memory).')) return;
    state.destinations.splice(i, 1);
    var gone = $('dest-' + id);
    if (gone) gone.remove();
    if (!state.destinations.length) renderDestinations();
    else renderDestControls();
    changed('destination');
    var next = state.destinations[i] || state.destinations[i - 1];
    var focusTarget = next ? $('dest-' + next.id) && $('dest-' + next.id).querySelector('h3') : $('dest-add');
    if (focusTarget) focusTarget.focus();
    announce('Removed destination "' + label + '".');
  }

  function loadDemoDestinations() {
    if (state.destinations.length && !window.confirm('Replace the ' + plural(state.destinations.length, 'current destination') + ' with the demo destinations?')) return;
    state.destinations = demo.destinations();
    if (state.settings.siteLabel === P.defaultSettings().siteLabel) {
      state.settings.siteLabel = demo.settings().siteLabel;
      $('site-label').value = state.settings.siteLabel;
    }
    showMessage($('dest-message'), '', null);
    renderDestinations();
    changed();
    announce('Loaded ' + plural(state.destinations.length, 'demo destination') + '.');
  }

  function fieldHint(f) {
    if (f.required) return 'Required.';
    if (f.requiredFor) return 'Required when ' + Object.keys(f.requiredFor).map(function (k) { return k + ' is ' + f.requiredFor[k]; }).join(' and ') + '.';
    return 'Optional.';
  }

  function renderDestinations() {
    var list = clear($('dest-list'));
    renderDestControls();
    if (!state.destinations.length) {
      list.appendChild(el('p', { class: 'empty', text: 'No destinations yet. Choose a type and press "Add destination", or load the demo destinations.' }));
      return;
    }
    state.destinations.forEach(function (d) { list.appendChild(buildDestCard(d)); });
    refreshAllDestinations();
  }

  /** Add one card without rebuilding the others (keeps focus and is fast). */
  function insertCard(d, before) {
    var list = $('dest-list');
    if (state.destinations.length === 1) clear(list); // drop the "no destinations" note
    list.insertBefore(buildDestCard(d), before || null);
    refreshDestination(d.id);
    renderDestControls();
  }

  function buildDestCard(d) {
    var t = D.TYPES[d.type];
    var headingId = nextId('dh');
    var card = el('article', { class: 'dest-card', id: 'dest-' + d.id, 'data-dest-id': d.id, 'data-type': d.type, 'aria-labelledby': headingId });
    var fieldMsgs = {}; // field key -> { input, msg }

    function update(key, value, isConfig) {
      var i = findDest(d.id);
      if (i < 0) return;
      if (isConfig) state.destinations[i].config[key] = value;
      else state.destinations[i][key] = value;
      refreshDestination(d.id);
      changed('destination');
    }

    function textField(key, label, value, opts) {
      opts = opts || {};
      var id = nextId('f');
      var msgId = id + '-msg';
      var hintId = id + '-hint';
      var input = opts.multiline
        ? el('textarea', { id: id, rows: '3', 'aria-describedby': (opts.hint ? hintId + ' ' : '') + msgId, 'data-field': key })
        : el('input', { type: 'text', id: id, autocomplete: 'off', spellcheck: 'false', inputmode: opts.inputmode, 'aria-describedby': (opts.hint ? hintId + ' ' : '') + msgId, 'data-field': key });
      input.value = value === undefined || value === null ? '' : String(value);
      input.addEventListener('input', function () { update(key, input.value, opts.isConfig); });
      var msg = el('p', { class: 'field-msg', id: msgId });
      fieldMsgs[key] = { input: input, msg: msg };
      return el('div', { class: 'field' }, [el('label', { for: id, text: label }), input, opts.hint ? el('p', { class: 'hint', id: hintId, text: opts.hint }) : null, msg]);
    }

    function selectField(key, label, options, value, onChange, hint, dataAttr) {
      var id = nextId('f');
      var msgId = id + '-msg';
      var hintId = id + '-hint';
      var sel = el('select', { id: id, 'aria-describedby': (hint ? hintId + ' ' : '') + msgId, 'data-field': dataAttr || key });
      options.forEach(function (o) { sel.appendChild(el('option', { value: o.value, text: o.label, selected: o.value === value })); });
      sel.value = value;
      sel.addEventListener('change', function () { onChange(sel.value); });
      var msg = el('p', { class: 'field-msg', id: msgId });
      fieldMsgs[dataAttr || key] = { input: sel, msg: msg };
      return el('div', { class: 'field' }, [el('label', { for: id, text: label }), sel, hint ? el('p', { class: 'hint', id: hintId, text: hint }) : null, msg]);
    }

    var head = el('div', { class: 'dest-head' }, [
      el('h3', { id: headingId, tabindex: '-1', class: 'dest-title' }, [el('span', { class: 'dest-label', text: d.label || '(no label)' })]),
      el('p', { class: 'dest-type', text: t.label }),
      el('p', { class: 'dest-badge' }),
      el('div', { class: 'button-row' }, [
        el('button', { type: 'button', class: 'secondary', 'data-action': 'duplicate', on: { click: function () { duplicateDestination(d.id); } } }, ['Duplicate', el('span', { class: 'visually-hidden', text: ' this destination' })]),
        el('button', { type: 'button', class: 'danger', 'data-action': 'remove', on: { click: function () { removeDestination(d.id); } } }, ['Remove', el('span', { class: 'visually-hidden', text: ' this destination' })])
      ])
    ]);
    card.appendChild(head);
    card.appendChild(el('p', { class: 'hint', text: t.summary }));

    var general = el('fieldset', { class: 'grid' }, el('legend', { text: 'General' }));
    general.appendChild(textField('label', 'Label', d.label, { hint: 'Up to ' + L.maxLabelLength + ' characters. Shown in the plan; never put credentials here.' }));
    general.appendChild(textField('basePath', 'Base path', d.basePath, { hint: 'Where the site lives on this destination, e.g. "/" or "/library/". Site links are not rewritten.' }));
    general.appendChild(textField('notes', 'Notes (optional)', d.notes, { multiline: true, hint: 'Free text for operators. Text that looks like a credential is refused and redacted on export.' }));
    card.appendChild(general);

    var cfg = el('fieldset', { class: 'grid' }, el('legend', { text: t.label + ' settings' }));
    t.fields.forEach(function (f) {
      var v = d.config[f.key];
      if (f.kind === 'enum') {
        cfg.appendChild(selectField(f.key, f.label, f.options.map(function (o) { return { value: o, label: o }; }), v, function (val) { update(f.key, val, true); }, fieldHint(f)));
      } else {
        cfg.appendChild(textField(f.key, f.label, v, { isConfig: true, hint: fieldHint(f) + (f.kind === 'int' || f.kind === 'port' ? ' Whole number.' : ''), inputmode: f.kind === 'int' || f.kind === 'port' ? 'numeric' : undefined }));
      }
    });
    card.appendChild(cfg);

    var caps = el('fieldset', { class: 'grid caps' }, el('legend', { text: 'Declared capabilities (your declaration, not verified)' }));
    D.capabilityKeysFor(d.type).forEach(function (k) {
      var c = D.CAP_INDEX[k];
      caps.appendChild(selectField(k, c.label, [
        { value: 'unknown', label: 'Unknown (not yet checked)' },
        { value: 'yes', label: 'Yes — I have confirmed it' },
        { value: 'no', label: 'No — not supported' }
      ], d.capabilities[k] || 'unknown', function (val) {
        var i = findDest(d.id);
        if (i < 0) return;
        state.destinations[i].capabilities[k] = val;
        refreshDestination(d.id);
        changed('destination');
      }, c.help, 'cap:' + k));
    });
    if (d.type === 'generic-static') caps.appendChild(el('p', { class: 'hint wide', text: 'File-size and file-count limits are derived from the declared maximums entered above.' }));
    card.appendChild(caps);

    card.appendChild(el('div', { class: 'dest-status' }));
    card._fieldMsgs = fieldMsgs;
    return card;
  }

  function refreshAllDestinations() {
    state.destinations.forEach(function (d) { refreshDestination(d.id); });
  }

  function refreshDestination(id) {
    var i = findDest(id);
    var card = $('dest-' + id);
    if (i < 0 || !card) return;
    var d = state.destinations[i];
    var r = assess(d);
    var a = r.a;

    card.querySelector('.dest-label').textContent = d.label || '(no label)';
    clear(card.querySelector('.dest-badge')).appendChild(stateBadge(a));

    // Field-level messages.
    var byField = {};
    function add(field, kind, text) { (byField[field] = byField[field] || []).push({ kind: kind, text: text }); }
    a.errors.forEach(function (e) { add(e.field, 'error', e.message); });
    a.missing.forEach(function (m) { add(m.field, 'missing', 'Required — not entered yet.'); });
    a.warnings.forEach(function (w) { if (w.field) add(w.field, 'warning', w.message); });
    a.pending.forEach(function (p) { add(p.field, 'pending', p.message); });
    var fm = card._fieldMsgs || {};
    Object.keys(fm).forEach(function (k) {
      var items = byField[k] || [];
      var m = clear(fm[k].msg);
      items.forEach(function (it) { m.appendChild(el('span', { class: 'fm fm-' + it.kind, text: it.text })); });
      var invalid = items.some(function (it) { return it.kind === 'error' || it.kind === 'missing'; });
      if (invalid) fm[k].input.setAttribute('aria-invalid', 'true');
      else fm[k].input.removeAttribute('aria-invalid');
    });

    // Summary block.
    var st = clear(card.querySelector('.dest-status'));
    st.appendChild(el('h4', { text: 'Status' }));
    st.appendChild(el('p', null, [stateBadge(a), ' ', el('span', { class: 'hint', text: 'Nothing is verified by the planner.' })]));
    function listBlock(cls, title, items, fmt) {
      if (!items.length) return;
      st.appendChild(el('p', { class: 'status-title', text: title }));
      st.appendChild(el('ul', { class: cls }, items.map(function (x) { return el('li', { text: fmt(x) }); })));
    }
    listBlock('missing-list', 'Missing configuration', a.missing, function (m) { return m.label; });
    listBlock('error-list', 'Errors', a.errors, function (e) { return e.message; });
    listBlock('pending-list', 'Pending operator actions', a.pending, function (p) { return p.message; });
    listBlock('warning-list', 'Warnings', a.warnings, function (w) { return w.message; });
    var unknown = a.capabilities.filter(function (c) { return c.status === 'unknown-blocking'; });
    listBlock('unknown-list', 'Required capabilities still unknown', unknown, function (c) { return c.label; });
    var blocking = a.capabilities.filter(function (c) { return c.status === 'declared-unsupported-blocking'; });
    listBlock('blocking-list', 'Required capabilities declared unsupported', blocking, function (c) { return c.label + (c.detail ? ' — ' + c.detail : ''); });
  }

  // ------------------------------------------------------------ compare

  var CAP_STATUS = {
    'declared-supported': { sym: '✓', text: 'Supported (declared)', cls: 'cap-yes' },
    'declared-unsupported-blocking': { sym: '✗', text: 'Unsupported (declared) — blocks', cls: 'cap-block' },
    'declared-unsupported': { sym: '✗', text: 'Unsupported (declared)', cls: 'cap-no' },
    'unknown-blocking': { sym: '?', text: 'Unknown — must be declared', cls: 'cap-unknown-block' },
    'unknown': { sym: '?', text: 'Unknown', cls: 'cap-unknown' },
    'n/a': { sym: '–', text: 'Not applicable', cls: 'cap-na' }
  };
  var LEVEL_TEXT = { required: 'Required', recommended: 'Recommended', 'not-applicable': 'Not applicable' };

  function renderCompare() {
    var root = clear($('compare-body'));
    if (!state.destinations.length) {
      root.appendChild(el('p', { class: 'empty', text: 'Add at least one destination to compare.' }));
      return;
    }
    if (!state.inventory) root.appendChild(el('p', { class: 'hint', text: 'No site is loaded, so requirements that depend on the site (file sizes, index pages, 404 page) are estimated.' }));
    var assessed = state.destinations.map(function (d) { return { d: D.sanitizeDestination(d), a: assess(d).a }; });

    // Readiness summary.
    var st = el('table', { class: 'data', id: 'readiness-table' });
    st.appendChild(el('caption', { text: 'Readiness (user-declared; never verified)' }));
    st.appendChild(el('thead', null, el('tr', null, ['Destination', 'Type', 'State', 'Missing configuration', 'Pending operator actions', 'Errors / warnings'].map(function (h) { return el('th', { scope: 'col', text: h }); }))));
    var sb = el('tbody');
    assessed.forEach(function (x) {
      sb.appendChild(el('tr', { 'data-dest-id': x.d.id }, [
        el('th', { scope: 'row', text: x.d.label }),
        el('td', { text: D.TYPES[x.d.type].label }),
        el('td', null, stateBadge(x.a)),
        el('td', null, x.a.missing.length ? el('ul', { class: 'plain' }, x.a.missing.map(function (m) { return el('li', { text: m.label }); })) : 'None'),
        el('td', null, x.a.pending.length ? el('ul', { class: 'plain' }, x.a.pending.map(function (p) { return el('li', { text: p.message }); })) : 'None'),
        el('td', { text: x.a.errors.length + ' / ' + x.a.warnings.length })
      ]));
    });
    st.appendChild(sb);
    root.appendChild(tableWrap('Readiness summary', st));

    // Capability matrix: rows = capabilities, columns = destinations.
    var mt = el('table', { class: 'data matrix', id: 'matrix-table' });
    mt.appendChild(el('caption', { text: 'Capability matrix: requirement, your declaration, and status' }));
    var hr = el('tr', null, el('th', { scope: 'col', text: 'Capability' }));
    assessed.forEach(function (x) { hr.appendChild(el('th', { scope: 'col', 'data-dest-id': x.d.id }, [el('span', { class: 'block', text: x.d.label }), stateBadge(x.a)])); });
    mt.appendChild(el('thead', null, hr));
    var mb = el('tbody');
    D.CAPABILITIES.forEach(function (cap, ci) {
      var tr = el('tr', { 'data-cap': cap.key }, el('th', { scope: 'row' }, [el('span', { class: 'block', text: cap.label }), el('span', { class: 'hint block', text: cap.help })]));
      assessed.forEach(function (x) {
        var r = x.a.capabilities[ci];
        var s = CAP_STATUS[r.status] || { sym: '', text: r.status, cls: '' };
        tr.appendChild(el('td', { class: 'cap ' + s.cls, 'data-status': r.status }, [
          el('span', { class: 'cap-status block' }, [el('span', { 'aria-hidden': 'true', text: s.sym + ' ' }), s.text]),
          el('span', { class: 'cap-meta block', text: 'Requirement: ' + (LEVEL_TEXT[r.level] || r.level) }),
          r.level !== 'not-applicable' ? el('span', { class: 'cap-meta block', text: 'Declared: ' + r.declared }) : null,
          r.detail ? el('span', { class: 'cap-meta block', text: r.detail }) : null
        ]));
      });
      mb.appendChild(tr);
    });
    mt.appendChild(mb);
    root.appendChild(tableWrap('Capability matrix', mt));

    var legend = el('dl', { class: 'legend' });
    ['declared-supported', 'declared-unsupported-blocking', 'declared-unsupported', 'unknown-blocking', 'unknown', 'n/a'].forEach(function (k) {
      legend.appendChild(el('dt', { class: 'cap ' + CAP_STATUS[k].cls }, CAP_STATUS[k].sym + ' ' + CAP_STATUS[k].text));
    });
    root.appendChild(el('details', { class: 'legend-wrap' }, [el('summary', { text: 'What the states mean' }),
      el('ul', null, Object.keys(D.STATE_LABELS).map(function (k) { return el('li', { text: D.STATE_LABELS[k] }); })),
      legend]));
  }

  // ----------------------------------------------------------- settings

  function renderSettings() {
    $('site-label').value = state.settings.siteLabel;
    $('onion-location').checked = !!state.settings.advertiseOnionLocation;
    var list = clear($('header-list'));
    var tbl = el('table', { class: 'data headers', id: 'headers-table' });
    tbl.appendChild(el('caption', { class: 'visually-hidden', text: 'Response headers' }));
    tbl.appendChild(el('thead', null, el('tr', null, [el('th', { scope: 'col', text: 'Name' }), el('th', { scope: 'col', text: 'Value' }), el('th', { scope: 'col', text: 'Remove' })])));
    var tb = el('tbody');
    state.settings.headers.forEach(function (h, i) {
      var nid = nextId('hn'), vid = nextId('hv'), mid = nextId('hm');
      var name = el('input', { type: 'text', id: nid, 'aria-label': 'Header ' + (i + 1) + ' name', 'aria-describedby': mid, autocomplete: 'off', spellcheck: 'false', 'data-header-name': String(i) });
      var value = el('input', { type: 'text', id: vid, 'aria-label': 'Header ' + (i + 1) + ' value', 'aria-describedby': mid, autocomplete: 'off', spellcheck: 'false', 'data-header-value': String(i) });
      name.value = h.name;
      value.value = h.value;
      name.addEventListener('input', function () { state.settings.headers[i].name = name.value; renderSettingsErrors(); changed(); });
      value.addEventListener('input', function () { state.settings.headers[i].value = value.value; renderSettingsErrors(); changed(); });
      var rm = el('button', { type: 'button', class: 'secondary', 'data-remove-header': String(i), on: { click: function () {
        state.settings.headers.splice(i, 1);
        renderSettings();
        changed();
        var next = document.querySelector('[data-header-name="' + Math.min(i, state.settings.headers.length - 1) + '"]') || $('header-add');
        next.focus();
        announce('Header removed.');
      } } }, ['Remove', el('span', { class: 'visually-hidden', text: ' header ' + (h.name || i + 1) })]);
      tb.appendChild(el('tr', { 'data-header-row': String(i) }, [
        el('td', null, name),
        el('td', null, [value, el('p', { class: 'field-msg', id: mid })]),
        el('td', null, rm)
      ]));
    });
    if (!state.settings.headers.length) tb.appendChild(el('tr', null, el('td', { colspan: '3', class: 'empty', text: 'No headers. Destinations will not be asked to send any custom headers.' })));
    tbl.appendChild(tb);
    list.appendChild(tbl);
    $('header-add').disabled = state.settings.headers.length >= L.maxHeaders;
    renderSettingsErrors();
  }

  function renderSettingsErrors() {
    var res = sanitizedSettings();
    var labelMsg = clear($('site-label-msg'));
    var byRow = {};
    var general = [];
    res.errors.forEach(function (e) {
      var m = /^headers\.(\d+)$/.exec(e.field);
      if (m) (byRow[m[1]] = byRow[m[1]] || []).push(e.message);
      else if (e.field === 'siteLabel') labelMsg.appendChild(el('span', { class: 'fm fm-error', text: e.message }));
      else general.push(e.message);
    });
    if (res.errors.some(function (e) { return e.field === 'siteLabel'; })) $('site-label').setAttribute('aria-invalid', 'true');
    else $('site-label').removeAttribute('aria-invalid');
    document.querySelectorAll('#headers-table tr[data-header-row]').forEach(function (tr) {
      var i = tr.getAttribute('data-header-row');
      var msg = clear(tr.querySelector('.field-msg'));
      (byRow[i] || []).forEach(function (t) { msg.appendChild(el('span', { class: 'fm fm-error', text: t })); });
      tr.querySelectorAll('input').forEach(function (inp) {
        if (byRow[i]) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
      });
    });
    var box = $('settings-errors');
    if (res.errors.length) {
      showMessage(box, 'error', [el('strong', { text: plural(res.errors.length, 'setting problem') + '. ' }), 'The plan stays a draft until they are fixed.'].concat(general.length ? [el('ul', null, general.map(function (g) { return el('li', { text: g }); }))] : []));
    } else showMessage(box, 'error', null);
  }

  function renderSettingsStatus() {
    var s = $('onion-location-status');
    if (!state.settings.advertiseOnionLocation) { s.textContent = 'Off. No Onion-Location header will be planned.'; return; }
    var dests = state.destinations.map(D.sanitizeDestination).filter(Boolean);
    var onion = dests.filter(function (d) { return d.type === 'tor-onion' && D.effectiveBaseUrl(d); })[0];
    var https = dests.filter(function (d) { var u = D.effectiveBaseUrl(d); return u && /^https:/.test(u); });
    if (!onion) s.textContent = 'On, but no onion destination has an entered address yet, so no header is planned.';
    else if (!https.length) s.textContent = 'On, but no destination has an HTTPS address, so no header is planned.';
    else s.textContent = 'On. ' + plural(https.length, 'HTTPS destination') + ' will be told to send Onion-Location pointing at ' + D.effectiveBaseUrl(onion) + '.';
  }

  // ------------------------------------------------------------- export

  function currentExport() {
    if (exportCache && exportCache.version === state.version) return exportCache;
    var generatedAt = new Date().toISOString();
    var input = { inventory: state.inventory, destinations: state.destinations, settings: state.settings };
    var plan = P.buildPlan({ inventory: input.inventory, destinations: input.destinations, settings: input.settings, generatedAt: generatedAt });
    var artifacts = P.exportArtifacts(plan, input);
    exportCache = { version: state.version, generatedAt: generatedAt, plan: plan, artifacts: artifacts };
    return exportCache;
  }

  function artifact(ex, rel) {
    var p = 'offline-mirror-plan/' + rel;
    for (var i = 0; i < ex.artifacts.length; i++) if (ex.artifacts[i].path === p) return ex.artifacts[i];
    return null;
  }

  function mimeFor(path) {
    if (/\.json$/.test(path)) return 'application/json';
    if (/\.md$/.test(path)) return 'text/markdown;charset=utf-8';
    // Plain octet-stream keeps names such as SHA256SUMS or *.template unchanged.
    return 'application/octet-stream';
  }

  function downloadArtifact(rel, saveAs) {
    var ex;
    try { ex = currentExport(); } catch (e) { showExportError(e); return; }
    var a = artifact(ex, rel);
    if (!a) { showExportError(new Error('Nothing to export for ' + rel + '.')); return; }
    showExportError(null);
    download(saveAs || rel.split('/').pop(), a.content, mimeFor(rel));
  }

  function showExportError(err) {
    showMessage($('export-error'), 'error', err ? errorText(err) : null);
  }

  function renderExportButtons() {
    var hasInv = !!state.inventory;
    $('dl-sums').disabled = !hasInv;
    $('dl-bundle').disabled = state.busy || !hasInv || !state.sources;
    $('dl-zip').disabled = state.busy;
    $('dl-sums').title = hasInv ? '' : 'Load a site first.';
    $('dl-bundle').title = hasInv ? '' : 'Load a site first.';
  }

  function renderExport() {
    var ex;
    try { ex = currentExport(); } catch (e) { showExportError(e); return; }
    renderExportButtons();

    var ps = clear($('plan-state'));
    var ready = ex.plan.planState === 'ready-for-manual-review';
    ps.appendChild(el('p', null, ['Plan state: ', el('span', { id: 'plan-state-value', class: 'badge ' + (ready ? 'state-ready' : 'state-needs'), 'data-state': ex.plan.planState, text: ready ? 'Ready for manual review (nothing verified)' : 'Draft' })]));
    ps.appendChild(el('ul', { class: 'plain reasons' }, ex.plan.planStateReasons.map(function (r) { return el('li', { text: r }); })));
    ps.appendChild(el('p', { class: 'hint', text: ex.plan.notice }));

    // Per-destination files.
    var box = clear($('export-dest-files'));
    if (!ex.plan.destinations.length) box.appendChild(el('p', { class: 'empty', text: 'No destinations yet.' }));
    ex.plan.destinations.forEach(function (pd) {
      var dir = pd.instructionsFile.replace(/\/INSTRUCTIONS\.md$/, '');
      var slug = dir.split('/').pop();
      var files = [pd.instructionsFile].concat(pd.templates);
      box.appendChild(el('div', { class: 'dest-files', 'data-dest-id': pd.id }, [
        el('p', { class: 'dest-files-title' }, [el('strong', { text: pd.label }), ' — ', el('span', { text: pd.typeLabel })]),
        el('div', { class: 'button-row' }, files.map(function (f) {
          var name = f.split('/').pop();
          return el('button', { type: 'button', class: 'secondary', 'data-artifact': f, on: { click: function () { downloadArtifact(f, slug + '-' + name); } } }, ['Download ' + name, el('span', { class: 'visually-hidden', text: ' for ' + pd.label })]);
        }))
      ]));
    });

    // Preview selector.
    var sel = $('preview-select');
    var prev = sel.value || 'offline-mirror-plan/plan.json';
    clear(sel);
    ex.artifacts.forEach(function (a) { sel.appendChild(el('option', { value: a.path, text: a.path.replace(/^offline-mirror-plan\//, '') })); });
    sel.value = ex.artifacts.some(function (a) { return a.path === prev; }) ? prev : 'offline-mirror-plan/plan.json';
    renderPreview();
  }

  function renderPreview() {
    var ex = exportCache;
    if (!ex) return;
    var p = $('preview-select').value;
    var a = ex.artifacts.filter(function (x) { return x.path === p; })[0];
    $('preview').textContent = a ? a.content : '';
  }

  function zipName(withSite) {
    return 'offline-mirror-plan' + (withSite ? '-with-site' : '') + '.zip';
  }

  function downloadZip() {
    var ex;
    try {
      ex = currentExport();
      var entries = ex.artifacts.map(function (a) { return { path: a.path, bytes: core.utf8Encode(a.content) }; });
      var bytes = Z.createZip(entries, { modified: ex.generatedAt });
      showExportError(null);
      download(zipName(false), bytes, 'application/zip');
    } catch (e) { showExportError(e); }
  }

  /**
   * Bundle = plan artifacts + every included site file, re-read from its
   * source and re-hashed. Refuses if any file differs from the inventory.
   */
  async function downloadBundle() {
    if (state.busy) return;
    var inv = state.inventory, sources = state.sources;
    if (!inv || !sources) { showExportError(new Error('Load a site first.')); return; }
    var ex;
    try { ex = currentExport(); } catch (e) { showExportError(e); return; }
    showExportError(null);
    setBusy(true);
    var progress = $('export-progress');
    try {
      var entries = ex.artifacts.map(function (a) { return { path: a.path, bytes: core.utf8Encode(a.content) }; });
      for (var i = 0; i < inv.files.length; i++) {
        var f = inv.files[i];
        progress.textContent = 'Re-reading and re-hashing ' + (i + 1) + ' of ' + inv.files.length + ': ' + f.path;
        var src = sources.get(f.path);
        if (!src) throw new Error('Bundle refused: no source is held for "' + f.path + '". Select the folder again.');
        var bytes;
        try {
          bytes = src.kind === 'file' ? new Uint8Array(await src.file.arrayBuffer()) : src.bytes;
        } catch (e) {
          throw new Error('Bundle refused: "' + f.path + '" could not be read again (' + errorText(e) + '). It may have been changed, moved or deleted since it was inventoried. Select the folder again.');
        }
        if (bytes.byteLength !== f.size) throw new Error('Bundle refused: "' + f.path + '" is now ' + bytes.byteLength + ' bytes but was ' + f.size + ' bytes when inventoried. Select the folder again.');
        var hash = await core.sha256Hex(bytes);
        if (hash !== f.sha256) throw new Error('Bundle refused: "' + f.path + '" no longer matches its inventoried SHA-256 (it changed after it was selected). Select the folder again.');
        entries.push({ path: 'offline-mirror-plan/site/' + f.path, bytes: bytes });
      }
      progress.textContent = 'Writing ZIP…';
      var zip = Z.createZip(entries, { modified: ex.generatedAt });
      download(zipName(true), zip, 'application/zip');
      progress.textContent = 'Bundle saved: ' + plural(inv.files.length, 'site file') + ' verified against the inventory and added byte-for-byte.';
    } catch (e) {
      progress.textContent = '';
      showExportError(e);
      announce(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------- import

  function onImport(e) {
    var input = e.target;
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    var box = $('import-message');
    if (file.size > L.maxImportBytes) {
      showMessage(box, 'error', 'Import refused: "' + file.name + '" is ' + core.formatBytes(file.size) + '; the limit is ' + core.formatBytes(L.maxImportBytes) + '.');
      return;
    }
    file.text().then(function (text) {
      var res;
      try { res = P.importDestinations(text); } catch (err) {
        showMessage(box, 'error', 'Import refused: ' + errorText(err));
        return;
      }
      if (state.destinations.length && !window.confirm('Replace the ' + plural(state.destinations.length, 'current destination') + ' with ' + plural(res.destinations.length, 'imported destination') + (res.settings ? ' and the imported settings' : '') + '?')) {
        showMessage(box, '', 'Import cancelled; nothing changed.');
        return;
      }
      state.destinations = res.destinations;
      if (res.settings) state.settings = res.settings;
      renderDestinations();
      renderSettings();
      changed();
      var content = [el('strong', { text: 'Imported ' + plural(res.destinations.length, 'destination') + (res.settings ? ' and settings' : '') + '.' }), ' Imported values are still user-declared and unverified.'];
      if (res.warnings.length) content.push(el('ul', { class: 'import-warnings' }, res.warnings.map(function (w) { return el('li', { text: w }); })));
      showMessage(box, res.warnings.length ? 'warning' : 'success', content);
      announce('Imported ' + plural(res.destinations.length, 'destination') + '.');
    }, function (err) {
      showMessage(box, 'error', 'Import failed: the file could not be read (' + errorText(err) + ').');
    });
  }

  // --------------------------------------------------------------- init

  function init() {
    $('boot-error').hidden = true;
    renderStatic();

    var typeSel = $('dest-type');
    D.TYPE_KEYS.forEach(function (k) { typeSel.appendChild(el('option', { value: k, text: D.TYPES[k].label })); });
    typeSel.addEventListener('change', renderDestControls);

    $('folder-input').addEventListener('change', onFolderInput);
    var dz = $('drop-zone');
    dz.addEventListener('dragover', function (e) { e.preventDefault(); if (!state.busy) dz.classList.add('over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('over'); });
    dz.addEventListener('drop', onDrop);
    // A folder dropped elsewhere must not make the browser navigate away from the planner.
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    $('demo-site').addEventListener('click', function () { loadDemo(false); });
    $('demo-site-clean').addEventListener('click', function () { loadDemo(true); });
    $('clear-site').addEventListener('click', clearSite);

    $('dest-add').addEventListener('click', addDestination);
    $('dest-demo').addEventListener('click', loadDemoDestinations);

    $('site-label').addEventListener('input', function () { state.settings.siteLabel = $('site-label').value; renderSettingsErrors(); changed(); });
    $('header-add').addEventListener('click', function () {
      if (state.settings.headers.length >= L.maxHeaders) return;
      state.settings.headers.push({ name: '', value: '' });
      renderSettings();
      changed();
      var n = document.querySelector('[data-header-name="' + (state.settings.headers.length - 1) + '"]');
      if (n) n.focus();
    });
    $('header-defaults').addEventListener('click', function () {
      if (!window.confirm('Replace the current header list with the default security headers?')) return;
      state.settings.headers = P.defaultHeaders();
      renderSettings();
      changed();
      announce('Default headers restored.');
    });
    $('onion-location').addEventListener('change', function () { state.settings.advertiseOnionLocation = $('onion-location').checked; changed(); });

    $('dl-plan').addEventListener('click', function () { downloadArtifact('plan.json'); });
    $('dl-sums').addEventListener('click', function () { downloadArtifact('SHA256SUMS'); });
    $('dl-dests').addEventListener('click', function () { downloadArtifact('destinations.json'); });
    $('dl-readme').addEventListener('click', function () { downloadArtifact('README-FIRST.txt'); });
    $('dl-zip').addEventListener('click', downloadZip);
    $('dl-bundle').addEventListener('click', downloadBundle);
    $('preview-select').addEventListener('change', renderPreview);
    $('import-input').addEventListener('change', onImport);

    renderInventory();
    renderDestinations();
    renderSettings();
    renderDerived();
    document.documentElement.setAttribute('data-omp-ready', 'true');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
