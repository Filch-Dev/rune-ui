// Tests Rune UI's side of the mod "Mod Menu" (modmenu.lua) without the game: the first values seen are not taken,
// only a row that changed with rev is, config.txt follows the mod's real values, the button, and the key names.
// Also: RuneUI/modmenu.txt is JSON that Mod Menu can read, and its key defaults are keys the mod knows.
// Needs npm install once. Run: node tools/test-modmenu.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const dir = path.join(__dirname, '..', 'RuneUI');
const src = fs.readFileSync(path.join(dir, 'Scripts', 'modmenu.lua'), 'utf8');

const page = JSON.parse(fs.readFileSync(path.join(dir, 'modmenu.txt'), 'utf8'));
const fail = m => { console.log('FAIL', m); process.exit(1); };
if (page.id !== 'RuneUI' || page.schema !== 1) fail('modmenu.txt: id must be RuneUI (the shared variables carry it) and schema 1');
const TYPES = ['header', 'toggle', 'slider', 'choice', 'key', 'button'], seen = new Set(), keyDefaults = [];
for (const s of page.settings) {
  if (!TYPES.includes(s.type)) fail('modmenu.txt: type ' + s.type);
  if (s.type === 'header') continue;
  if (s.type === 'button') { if (s.action !== 'open_editor') fail('modmenu.txt: the mod knows no action ' + s.action); continue; }
  if (!/^[\w.-]+$/.test(s.key || '') || seen.has(s.key)) fail('modmenu.txt: key ' + s.key);
  seen.add(s.key);
  if (s.type === 'key') { keyDefaults.push(s.default); if (!s.restart) fail('modmenu.txt: ' + s.key + ' needs restart, the keys are bound at the start'); }
  if (s.type === 'choice' && !s.options.includes(s.default)) fail('modmenu.txt: default of ' + s.key);
}

const test = `
local M = load(SRCTEXT)()

-- the mod's real values, Mod Menu's shared variables, and its file
local real = { key_editor = "F9", immersive = false, immersive_wait = 8, map_Ore = false }
local sets, rows = {}, {}
for _, k in ipairs({ "key_editor", "immersive", "immersive_wait", "map_Ore" }) do
    rows[#rows + 1] = { Key = k, Get = function() return real[k] end,
        Set = function(v) if v == "bad" then error("no") end real[k] = v sets[#sets + 1] = k end }
end
local shared, file, writes, opened = {}, nil, 0, 0
local ctx = { Rows = rows, Log = function() end, Read = function(n) return shared[n] end,
    ReadFile = function() return file end, WriteFile = function(_, t) file = t writes = writes + 1 return true end,
    OpenEditor = function() opened = opened + 1 end }
local now = 0
local function Step() now = now + 1 M.Tick(ctx, now) end
local function Has(line) return string.find(file, "\\n" .. line .. "\\n", 1, true) ~= nil end

Step()
assert(writes == 0 and M.Rev == nil, "without Mod Menu nothing is read or written")

-- Mod Menu with the page's defaults (no config.txt yet): the player's values stay, the file gets them
shared = { rev = 0, key_editor = "F9", immersive = false, immersive_wait = 8.0, map_Ore = true, action = "open_editor#3" }
Step()
assert(#sets == 0 and real.map_Ore == false, "the first values seen are not taken")
assert(writes == 1 and file == M.Text(rows) and Has("map_Ore = false") and Has("immersive_wait = 8") and Has("key_editor = F9"), file)
assert(string.sub(file, 1, 1) == "#", "a comment line first")
assert(opened == 0, "a click of before the start is not a click")
Step()
assert(writes == 1, "the same values: no second write")
M.Tick(ctx, now + 0.5)
shared.rev = 5
M.Tick(ctx, now + 0.5)
assert(M.Rev == 0, "once a second")
shared.rev = 0

-- the menu opens: it gives the file's values again, without a new rev
shared.map_Ore = false
Step()
assert(#sets == 0)

-- the player turns the immersive mode on in the menu
shared.immersive, shared.rev = true, 1
Step()
assert(#sets == 1 and sets[1] == "immersive" and real.immersive == true, "only the row that changed")
assert(Has("immersive = true"))
-- Mod Menu's own save of the same values, with Windows line ends: the same text
file = string.gsub(file, "\\n", "\\r\\n")
local w = writes
Step()
assert(writes == w, "Windows line ends are not a difference")
file = string.gsub(file, "\\r", "")

-- a change in F8: the file follows, nothing is taken from the menu
real.map_Ore = true
Step()
assert(writes == w + 1 and Has("map_Ore = true") and #sets == 1)
-- the menu was open all the time and still holds the old Ore; the player changes the wait there
shared.immersive_wait, shared.rev = 12.0, 2
Step()
assert(real.immersive_wait == 12 and real.map_Ore == true, "a value the menu did not change is not taken")
-- then Mod Menu saves what it holds, the old Ore too: the file is made right again
file = string.gsub(file, "map_Ore = true", "map_Ore = false")
w = writes
Step()
assert(writes == w + 1 and Has("map_Ore = true") and Has("immersive_wait = 12"))

-- a row that cannot take the value: the others still do, and the file keeps the real value
shared.key_editor, shared.immersive, shared.rev = "bad", false, 3
Step()
assert(real.key_editor == "F9" and real.immersive == false and Has("key_editor = F9") and Has("immersive = false"))

-- the button
shared.action = "open_editor#4"
Step()
Step()
assert(opened == 1, "one click opens the editor once")

-- a file that cannot be written: said once, the step goes on
ctx.WriteFile = function() return false end
real.map_Ore = false
Step()
Step()
assert(M.WriteFailed == true)

-- key names: runeui.txt's (main.lua's VK) and Mod Menu's
assert(M.KeyFromMenu("PAGE_UP") == "PgUp" and M.KeyFromMenu("RIGHT_BRACKET") == "]" and M.KeyFromMenu("F9") == "F9")
assert(M.KeyFromMenu("NINE") == "9" and M.KeyFromMenu("q") == "Q" and M.KeyFromMenu("home") == "Home")
assert(M.KeyFromMenu("THUMB_MOUSE_BUTTON") == nil and M.KeyFromMenu("none") == nil and M.KeyFromMenu("F13") == nil)
assert(M.KeyToMenu("f9") == "F9" and M.KeyToMenu("pgdn") == nil and M.KeyToMenu(nil) == nil)
for _, n in ipairs({ "Backspace", "PgUp", "PgDn", "End", "Home", "Left", "Up", "Right", "Down", "Insert", "Delete", "Plus", "Minus",
    "Equals", "Dash", "Comma", "Period", "[", "]", "F1", "F12", "0", "9", "A", "Z" }) do
    assert(M.KeyFromMenu(M.KeyToMenu(n)) == n, "key " .. n)
end
for name in string.gmatch(KEYDEFAULTS, "%S+") do assert(M.KeyFromMenu(name), "modmenu.txt: default key " .. name) end
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(keyDefaults.join(' '))); lua.lua_setglobal(L, to_luastring('KEYDEFAULTS'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }
