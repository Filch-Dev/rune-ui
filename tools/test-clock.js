// Tests the time of day icon's phases (clock.lua) against the design sketch: dawn until 0.08 of the day, dusk from
// 0.08 before the night, night from the game dial's night start. Needs fengari. Run: node tools/test-clock.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'clock.lua'), 'utf8');
const test = `
StaticFindObject = function() return nil end
local M = load(SRCTEXT)()
local ns = 0.795
for _, c in ipairs({ { 0, "dawn" }, { 0.079, "dawn" }, { 0.08, "day" }, { 0.5, "day" }, { 0.714, "day" }, { 0.716, "dusk" },
    { 0.794, "dusk" }, { 0.795, "night" }, { 0.999, "night" } }) do
    local got = M.Phase(c[1], ns)
    assert(got == c[2], c[1] .. " gave " .. got .. ", not " .. c[2])
end
assert(M.Phase(0.65, 0.7) == "dusk", "dusk not tied to the dial's night start")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }
