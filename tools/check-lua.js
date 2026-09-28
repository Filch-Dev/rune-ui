// Checks the mod's Lua files without the game: the syntax, and every global name the code reads must be a
// Lua or UE4SS global. A call to a function that no longer exists shows as an unknown global.
// Needs luaparse: npm install --no-save luaparse. Run: node tools/check-lua.js (all of RuneUI/Scripts), or name files.
const lp = require('luaparse'), fs = require('fs'), path = require('path');
const known = new Set(('print io os string table math pairs ipairs pcall require dofile tostring tonumber type next error select setmetatable getmetatable rawget rawset unpack _G ' +
  'FName FText FindAllOf FindFirstOf StaticFindObject StaticConstructObject LoadAsset RegisterHook RegisterKeyBind ExecuteWithDelay ExecuteInGameThread NotifyOnNewObject LoopAsync UEHelpers').split(' '));
let files = process.argv.slice(2);
if (!files.length) {
  const dir = path.join(__dirname, '..', 'RuneUI', 'Scripts');
  files = fs.readdirSync(dir).filter(f => f.endsWith('.lua')).map(f => path.join(dir, f));
}
let bad = 0;
for (const f of files) {
  let ast;
  try { ast = lp.parse(fs.readFileSync(f, 'utf8'), { scope: true, locations: true, luaVersion: '5.3' }); }
  catch (e) { console.log(f, 'SYNTAX', e.message); bad++; continue; }
  const free = new Set();
  (function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.type === 'Identifier' && n.isLocal === false && !known.has(n.name)) free.add(n.name + ':' + n.loc.start.line);
    for (const k in n) if (k !== 'loc' && k !== 'range') walk(n[k]);
  })(ast);
  console.log(path.basename(f), 'syntax ok; unknown globals:', [...free].join(' ') || 'none');
  if (free.size) bad++;
}
process.exit(bad ? 1 : 0);
