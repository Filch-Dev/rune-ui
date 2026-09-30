// Checks without the game that the mod writes the pictures back from Scripts/art.lua byte for byte, and that a
// second start writes only a changed picture. Runs the unpacking code of main.lua in a Lua made in JavaScript.
// Needs fengari: npm install --no-save fengari. Run: node tools/check-art.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const MOD = path.join(__dirname, '..', 'RuneUI');
const main = fs.readFileSync(path.join(MOD, 'Scripts', 'main.lua'), 'utf8');
const END = 'if not ok then Log("pictures not written: " .. tostring(err)) end';
const code = main.slice(main.indexOf('local B64 = {}'), main.indexOf(END) + END.length) + '\nend';
const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
lua.lua_newtable(L);
for (const f of fs.readdirSync(path.join(MOD, 'Art')).filter(f => f.endsWith('.png'))) {
  lua.lua_pushstring(L, new Uint8Array(fs.readFileSync(path.join(MOD, 'Art', f))));
  lua.lua_setfield(L, -2, to_luastring(f));
}
lua.lua_setglobal(L, to_luastring('PNG'));
// io.open writes into the table FS instead of the disk.
const test = `
local ART = ${JSON.stringify(fs.readFileSync(path.join(MOD, 'Scripts', 'art.lua'), 'utf8'))}
FS, LOG = {}, {}
function Log(m) LOG[#LOG + 1] = m end
function LoadPart() return load(ART)() end
io = { open = function(file, mode)
  if mode == "rb" then
    local d = FS[file]
    return d and { read = function() return d end, close = function() end }
  end
  local buf = {}
  return { write = function(_, s) buf[#buf + 1] = s end, close = function() FS[file] = table.concat(buf) end }
end }
local function start() ${code} end
local fails, n = 0, 0
start()
for name, bytes in pairs(PNG) do
  n = n + 1
  if FS["ue4ss/Mods/RuneUI/Art/" .. name] ~= bytes then fails = fails + 1 print("different: " .. name) end
end
if LOG[#LOG] ~= "pictures written: " .. n then fails = fails + 1 print("first start: " .. LOG[#LOG]) end
FS["ue4ss/Mods/RuneUI/Art/runemap_north.png"] = "old"
start()
if LOG[#LOG] ~= "pictures written: 1" then fails = fails + 1 print("second start: " .. LOG[#LOG]) end
print(n .. " pictures checked, " .. fails .. " failures")
return fails
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
