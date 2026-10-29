'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {core,zip,entries,toBytes} = require('./_helpers');
test('rejects lone-surrogate names before UTF-8 replacement can alias them', async () => {
  assert.equal(core.validateRelativePath('\ud800.txt').ok,false);
  const inv = await core.buildInventory(entries([['\ud800.txt','a'],['\ufffd.txt','b']]));
  assert.ok(inv.rejected.length > 0);
  assert.throws(()=>zip.createZip([{path:'\ud800.txt',bytes:toBytes('a')}]),/unsafe/);
});
test('rejects file/directory prefix collisions in either input order', async () => {
  for (const paths of [['A','a/index.html'],['a/index.html','A']]) {
    const inv = await core.buildInventory(entries(paths.map(p=>[p,'public'])));
    assert.ok(inv.rejected.length>0);
    assert.throws(()=>zip.createZip(paths.map(path=>({path,bytes:toBytes('public')}))),/file.*directory|collision/i);
  }
});
test('ZIP duplicate bookkeeping does not reject ordinary prototype-like names', () => {
  assert.doesNotThrow(()=>zip.createZip(['constructor','toString','__proto__'].map(path=>({path,bytes:toBytes('public')}))));
});
