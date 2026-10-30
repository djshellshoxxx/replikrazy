#!/usr/bin/env node
/*
 * Writes the built-in synthetic demo site to disk so the real folder-selection
 * flow can be tried:  node scripts/write-demo-site.cjs /tmp/omp-demo
 * Creates <dir>/lantern-community-library/. Includes harmless bait files
 * (.env, fake key placeholder, …) so exclusion can be seen. Unsafe-path demo
 * entries (e.g. "../…") are skipped because a file system cannot hold them.
 * Refuses to write into an existing non-empty directory.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const core = require('../src/core.js');
const demo = require('../src/demo.js');

const target = process.argv[2];
if (!target) { console.error('Usage: node scripts/write-demo-site.cjs <new-or-empty-directory>'); process.exit(2); }
const base = path.resolve(target);
if (fs.existsSync(base) && fs.readdirSync(base).length) { console.error('Refusing to write: ' + base + ' exists and is not empty.'); process.exit(2); }
const root = path.join(base, demo.ROOT);

let written = 0, skipped = 0;
for (const f of demo.siteFiles().concat(demo.baitFiles(), demo.unsafeEntries())) {
  if (!core.validateRelativePath(f.path).ok) { skipped++; continue; }
  const out = path.join(root, ...f.path.split('/'));
  if (!out.startsWith(root + path.sep)) { skipped++; continue; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, f.bytes);
  written++;
}
console.log('Wrote ' + written + ' files to ' + root + (skipped ? ' (skipped ' + skipped + ' unsafe demo entries)' : '') + '.');
console.log('Open index.html in a browser and choose that folder in "Select site folder".');
