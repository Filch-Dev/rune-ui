// Runs every tools/test-*.js, one after the other, and fails when one of them fails. A new test file runs
// without a change here. Run: node tools/run-tests.js (npm run test:lua)
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const tests = fs.readdirSync(__dirname).filter(f => /^test-.*\.js$/.test(f)).sort();
const failed = [];
for (const f of tests) {
  console.log('-- ' + f);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(f);
}
console.log(tests.length + ' tests, ' + (failed.length ? failed.length + ' failed: ' + failed.join(', ') : 'all passed'));
process.exit(failed.length ? 1 : 0);
