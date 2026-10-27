'use strict';
// Node 22's `node --test tests/unit/` treats a directory argument as a module
// path (it does not expand it), so it loads this index. Load every *.test.js
// here so `npm test` runs the whole unit suite. `node --test tests/unit/*.test.js`
// also works and runs each file in its own process.
const fs = require('node:fs');
const path = require('node:path');

for (const name of fs.readdirSync(__dirname).filter((n) => n.endsWith('.test.js')).sort()) {
  require(path.join(__dirname, name));
}
