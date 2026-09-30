// Checks the mod's Lua files without the game: the syntax, and every global name the code reads must be a
// Lua or UE4SS global. A call to a function that no longer exists shows as an unknown global.
// Needs luaparse: npm install --no-save luaparse. Run: node tools/check-lua.js (all of RuneUI/Scripts), or name files.
const lp = require('luaparse'), fs = require('fs'), path = require('path');
const known = new Set(('print io os string table math collectgarbage pairs ipairs pcall require dofile tostring tonumber type next error select setmetatable getmetatable rawget rawset unpack package _G ' +
  'FName FText FindAllOf FindFirstOf StaticFindObject StaticConstructObject LoadAsset RegisterHook RegisterKeyBind ExecuteWithDelay ExecuteInGameThread NotifyOnNewObject LoopAsync UEHelpers LoopInGameThreadWithDelay ExecuteInGameThreadWithDelay IsInGameThread').split(' '));
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
  // A top-level local declared twice hides the first one from all code below it: a timer function named Step
  // broke the editor's move step (28-09-2026).
  // Lua allows 200 locals in one function, and the top level of a file is one function. At 201 the file does not
  // load (main.lua had 179 on 29-09-2026).
  const seen = new Map(), twice = [];
  let locals = 0;
  for (const s of ast.body) {
    const names = s.type === 'LocalStatement' ? s.variables : s.type === 'FunctionDeclaration' && s.isLocal ? [s.identifier] : [];
    for (const v of names) {
      if (seen.has(v.name)) twice.push(v.name + ':' + seen.get(v.name) + '+' + v.loc.start.line);
      seen.set(v.name, v.loc.start.line);
      locals++;
    }
  }
  console.log(path.basename(f), 'syntax ok; unknown globals:', [...free].join(' ') || 'none', '; declared twice:', twice.join(' ') || 'none',
    '; top-level locals:', locals + '/200');
  if (free.size || twice.length || locals > 200) bad++;
}
process.exit(bad ? 1 : 0);
