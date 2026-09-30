// Tests the order of the cooldown tiles (cooldowns.lua M.Order) without the game: newest at the bottom, a finished
// spell's tile goes and the ones below move up, a spell cast again goes to the bottom.
// Needs fengari: npm install --no-save fengari. Run: node tools/test-cooldowns.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'cooldowns.lua'), 'utf8');
const test = `
local M = load(SRCTEXT)()
local function Set(...) local s = {} for _, k in ipairs({ ... }) do s[k] = true end return s end
local function Same(a, b, what) assert(table.concat(a, ",") == table.concat(b, ","), what .. ": " .. table.concat(a, ",")) end
-- slice order is 0..11; the wheel lists them in slice order, not cast order
local o = M.Order({}, Set("s3"), { "s3" })
Same(o, { "s3" }, "first cast")
o = M.Order(o, Set("s1", "s3"), { "s1", "s3" })
Same(o, { "s3", "s1" }, "second cast goes to the bottom")
o = M.Order(o, Set("s1", "s3", "s5"), { "s1", "s3", "s5" })
Same(o, { "s3", "s1", "s5" }, "third cast")
o = M.Order(o, Set("s1", "s5"), { "s1", "s5" })
Same(o, { "s1", "s5" }, "first one ready: the rest move up")
o = M.Order(o, Set("s1", "s3", "s5"), { "s1", "s3", "s5" })
Same(o, { "s1", "s5", "s3" }, "cast again: at the bottom")
o = M.Order(o, {}, {})
Same(o, {}, "all ready")
assert(M.BOX_W == 60 and M.BOX_H == 400, "box " .. M.BOX_W .. "x" .. M.BOX_H .. ": main.lua's Size says 60 x 400")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }
