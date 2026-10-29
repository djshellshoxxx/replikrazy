'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('../../src/core.js');
const source = fs.readFileSync(require.resolve('../../src/app.js'), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
// Execute the actual private lifecycle functions with DOM rendering and final
// inventory commit replaced by sinks. No browser/network or duplicate walker.
function harness(limits = {}) {
  const state = { busy: false, inventory: { previous: true }, sources: {}, siteSource: 'old' };
  const commits = [], errors = [], timers = new Map();
  let timerId = 0;
  const node = { classList: { remove() {} } };
  const init = source.slice(source.indexOf('  var selectionGeneration'), source.indexOf('  // ----------------------------------------------------------- helpers'));
  const walker = source.slice(source.indexOf('  var DROP_TIMEOUT_MS'), source.indexOf('  function tableWrap('));
  const noop = () => {};
  const api = new Function('state','L','core','$','loadEntries','showMessage','errorText','renderInventory','refreshAllDestinations','changed','announce','setTimeout','clearTimeout',
    init + walker + '; return {onDrop,clearSite};')(
    state, { ...core.LIMITS, ...limits }, core, () => node,
    entries => { commits.push(entries.map(e => e.path)); state.inventory = entries; },
    (_, kind, text) => { if (text) errors.push(text); }, String, noop, noop, noop, noop,
    fn => { timers.set(++timerId, fn); return timerId; }, id => timers.delete(id));
  return { ...api, state, commits, errors, timers, drop: root => api.onDrop({preventDefault:noop,dataTransfer:{items:[{kind:'file',webkitGetAsEntry:()=>root}]}}) };
}
function file(path = '/site/index.html') {
  return { isFile:true, fullPath:path, file(done) { done({size:2,arrayBuffer:async()=>new ArrayBuffer(2)}); } };
}
function deferredDirectory() {
  let callback, first = true;
  return { isDirectory:true, createReader:()=>({readEntries(done) { if(first) {first=false;callback=done;} else done([]); }}), release: entries => callback(entries) };
}
function directory(children) {
  return {isDirectory:true,createReader(){let first=true;return {readEntries(done){const batch=first?children:[];first=false;done(batch);}};}};
}
test('clear invalidates a pending drop and ignores its eventual completion', async () => {
  const h=harness(), dir=deferredDirectory(); h.drop(dir); h.clearSite(); dir.release([file()]); await tick();
  assert.equal(h.state.inventory,null); assert.deepEqual(h.commits,[]); assert.deepEqual(h.errors,[]); assert.equal(h.timers.size,0);
});
test('a newer drop wins over an earlier deferred traversal', async () => {
  const h=harness(), dir=deferredDirectory(); h.drop(dir); h.drop(file('/new/index.html')); await tick(); dir.release([file('/old/index.html')]); await tick();
  assert.deepEqual(h.commits,[['new/index.html']]); assert.deepEqual(h.errors,[]);
});
test('counts directories as work and refuses a large enumeration batch', async () => {
  const h=harness({maxFiles:3}); h.drop(directory([directory([]),directory([]),directory([])])); await tick();
  assert.equal(h.commits.length,0); assert.match(h.errors[0],/entries including directories/); assert.equal(h.timers.size,0);
});
test('refuses deep empty directory trees before visiting beyond depth limit', async () => {
  const h=harness({maxPathDepth:2}); h.drop(directory([directory([directory([directory([])])])])); await tick();
  assert.equal(h.commits.length,0); assert.match(h.errors[0],/directory depth/);
});
test('stalled directory callbacks time out and later callbacks cannot commit', async () => {
  const h=harness(), dir=deferredDirectory(); h.drop(dir); [...h.timers.values()][0](); await tick(); dir.release([file()]); await tick();
  assert.equal(h.commits.length,0); assert.match(h.errors[0],/60 seconds/); assert.equal(h.timers.size,0);
});
test('valid traversal commits unchanged relative paths', async () => {
  const h=harness(); h.drop(directory([file()])); await tick();
  assert.deepEqual(h.commits,[['site/index.html']]); assert.deepEqual(h.errors,[]); assert.equal(h.timers.size,0);
});
test('stalled file callbacks time out and late file metadata cannot commit', async () => {
  const h=harness(); let release;
  h.drop({isFile:true,fullPath:'/late.html',file(done){release=done;}});
  [...h.timers.values()][0](); await tick(); release({size:0}); await tick();
  assert.equal(h.commits.length,0); assert.match(h.errors[0],/60 seconds/); assert.equal(h.timers.size,0);
});
