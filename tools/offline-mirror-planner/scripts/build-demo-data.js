#!/usr/bin/env node
'use strict';

// Builds src/demo-data.js from demo/site/** and demo/sample-destinations.json.
//
//   node scripts/build-demo-data.js           write src/demo-data.js
//   node scripts/build-demo-data.js --check   exit 1 if src/demo-data.js is stale
//
// Output is deterministic: files are sorted by path (JS string compare) and
// every file's bytes are embedded as base64. Zero dependencies.

const fs = require('fs');
const path = require('path');

const TOOL_ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(TOOL_ROOT, 'demo', 'site');
const DESTINATIONS_FILE = path.join(TOOL_ROOT, 'demo', 'sample-destinations.json');
const OUTPUT_FILE = path.join(TOOL_ROOT, 'src', 'demo-data.js');

const SITE_LABEL = 'lantern-field-notes';
const DESCRIPTION =
  'Lantern Field Notes: a small synthetic static site (invented content, ' +
  'example.* domains only) with decoy files the planner must exclude, plus ' +
  'sample user-declared destinations.';

// Recursively list regular files under dir, including dotfiles.
// Returns '/'-separated paths relative to base.
function listFiles(dir, base) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).split(path.sep).join('/');
    if (entry.isSymbolicLink()) {
      throw new Error('Symlinks are not allowed in demo/site: ' + rel);
    }
    if (entry.isDirectory()) {
      out.push(...listFiles(abs, base));
    } else if (entry.isFile()) {
      out.push(rel);
    } else {
      throw new Error('Unsupported file type in demo/site: ' + rel);
    }
  }
  return out;
}

function compareStrings(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Single-quoted JS string literal; escapes anything outside printable ASCII.
function quote(str) {
  let out = "'";
  for (const ch of String(str)) {
    const code = ch.codePointAt(0);
    if (ch === '\\') out += '\\\\';
    else if (ch === "'") out += "\\'";
    else if (code >= 0x20 && code <= 0x7e) out += ch;
    else if (code <= 0xffff) out += '\\u' + code.toString(16).padStart(4, '0');
    else out += '\\u{' + code.toString(16) + '}';
  }
  return out + "'";
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length ? pad + line : line))
    .join('\n');
}

function generate() {
  const paths = listFiles(SITE_DIR, SITE_DIR).sort(compareStrings);
  const fileLines = paths.map((rel) => {
    const base64 = fs.readFileSync(path.join(SITE_DIR, rel)).toString('base64');
    return '      { path: ' + quote(rel) + ', base64: ' + quote(base64) + ' }';
  });

  const destinations = JSON.parse(fs.readFileSync(DESTINATIONS_FILE, 'utf8'));
  if (!Array.isArray(destinations)) {
    throw new Error('demo/sample-destinations.json must be a JSON array');
  }
  // JSON is valid JS; non-ASCII is escaped so the file is pure ASCII.
  const destinationsJs = JSON.stringify(destinations, null, 2).replace(
    /[\u007f-￿]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );

  return [
    '/* GENERATED - do not edit; run npm run build:demo',
    ' * Source: demo/site/** and demo/sample-destinations.json',
    ' * Builder: scripts/build-demo-data.js (--check verifies this file is current)',
    ' * Content is synthetic. Decoy files are included on purpose so the planner',
    ' * can show that it excludes them. */',
    '(function (root, factory) {',
    "  'use strict';",
    '  var api = factory();',
    "  if (typeof module === 'object' && module.exports) {",
    '    module.exports = api;',
    '  } else {',
    '    root.OMP = root.OMP || {};',
    '    root.OMP.demoData = api;',
    '  }',
    "})(typeof globalThis !== 'undefined' ? globalThis : this, function () {",
    "  'use strict';",
    '  return {',
    '    siteLabel: ' + quote(SITE_LABEL) + ',',
    '    description: ' + quote(DESCRIPTION) + ',',
    '    files: [',
    fileLines.join(',\n'),
    '    ],',
    '    destinations: ' + indent(destinationsJs, 4).trimStart(),
    '  };',
    '});',
    '',
  ].join('\n');
}

function main(argv) {
  const check = argv.includes('--check');
  const unknown = argv.filter((a) => a !== '--check');
  if (unknown.length) {
    process.stderr.write('Unknown argument(s): ' + unknown.join(' ') + '\n');
    return 2;
  }

  const content = generate();
  const rel = path.relative(TOOL_ROOT, OUTPUT_FILE).split(path.sep).join('/');

  if (check) {
    let current = null;
    try {
      current = fs.readFileSync(OUTPUT_FILE, 'utf8');
    } catch (e) {
      current = null;
    }
    if (current !== content) {
      process.stderr.write(rel + ' is out of date. Run: npm run build:demo\n');
      return 1;
    }
    process.stdout.write(rel + ' is up to date.\n');
    return 0;
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, content);
  process.stdout.write('Wrote ' + rel + ' (' + Buffer.byteLength(content) + ' bytes).\n');
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { generate, listFiles, OUTPUT_FILE, SITE_DIR, DESTINATIONS_FILE };
