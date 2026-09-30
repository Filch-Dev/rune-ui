// Tests immersive.lua without the game: a fake HUD and a fake clock (a fight, a heal, a new buff, low food, F9).
// Needs fengari: npm install --no-save fengari. Run: node tools/test-immersive.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'immersive.lua'), 'utf8');
const test = `
local T = 0
os.clock = function() return T end
local M = (function() ${src} end)()

local addr = 0
local function Widget(name) addr = addr + 1 return { name = name, op = 1, addr = addr, IsValid = function() return true end,
  SetRenderOpacity = function(self, o) self.op = o end, GetAddress = function(self) return self.addr end } end
local function Text(s) return { s = s, IsVisible = function(self) return self.s ~= "" end,
  GetText = function(self) return { ToString = function() return self.s end } end } end
-- the column holds the rows; the special bar's parent is the column itself (see FadeRow), so it must never fade
local rowH, rowS, column = Widget("rowH"), Widget("rowS"), Widget("column")
rowS.GetParent = function() return column end
local hpText = Text("200/200")
-- the stamina fill's material numbers (in game: full is 1 minus the blocked part)
local st = { fill = 0.8, blocked = 0.2 }
local function Param(n, v) return { get = function() return { ParameterInfo = { Name = { ToString = function() return n end } }, ParameterValue = v } end } end
local stMat = { ScalarParameterValues = { ForEach = function(self, fn) fn(1, Param("Fill from Avaliable", st.fill)) fn(2, Param("Blocked from avaliable", st.blocked)) end } }
local function Bar(row, txt) local b = Widget("bar") b.GetParent = function() return row end b.txt = txt return b end
local bars = { Bar(rowS, nil), Bar(rowH, hpText), Bar(column, nil) }
bars[1].ProgressBarImage = { Brush = { ResourceObject = stMat } }
local trim = Widget("trim")
local ring = { Value = 0.9, Box = Widget("box"), Dia = Widget("dia") }
local on, editing, buffs, chat = true, false, 0, 0
local ctx = { Log = function() end, On = function() return on end, Editing = function() return editing end,
  Bars = function() return bars end, Trim = function() return trim end, BuffCount = function() return buffs end,
  Rings = function() return { ring } end, TextsUnder = function(W) return { W.txt } end,
  Wait = function() return 5 end,
  ChatCount = function() return chat end }

local function run(sec) local stop = T + sec while T < stop - 1e-9 do T = T + 0.05 M.Tick(ctx) end end
local function F(id) return M.Factor({ Id = id }) end
local fails = 0
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end

M.Forget()
run(1)
check("start: everything shown", F("toolbar") == 1 and rowH.op == 1 and ring.Box.op == 1)
run(11.5)   -- the start hold (8 s) plus FADE_OUT, with room
check("idle: tool bar stays", F("toolbar") == 1)
check("idle: map gone", F("runemap") == 0)
check("idle: bars rows and trim gone", rowH.op == 0 and rowS.op == 0 and trim.op == 0)
check("idle: the column that holds the rows stays", column.op == 1)
check("idle: menu buttons gone", F("menubtn") == 0)
check("idle: buffs, avatar, compass gone", F("buffs") == 0 and F("avatar") == 0 and F("compass") == 0)
check("idle: food ring gone", ring.Box.op == 0 and ring.Dia.op == 0)
check("never fades: prompts, tool bar, region, survival element", F("prompts") == 1 and F("toolbar") == 1 and F("region") == 1 and F("survival") == 1 and F("vitals") == 1)

hpText.s = "150/200" run(0.5)
check("hit: bars back, exactly 1", rowH.op == 1 and F("avatar") == 1)
check("hit: buffs come with the bars", F("buffs") == 1)
run(20)
check("health not full: bars stay", rowH.op == 1)
hpText.s = "200/200" run(4)
check("full: bars stay a few seconds", rowH.op == 1)
run(4.5)
check("full: then fade", rowH.op == 0 and F("buffs") == 0)

st.fill = 0.6 run(0.5)
check("stamina used: bars back", rowH.op == 1)
st.fill = 0.8 run(8.5)
check("stamina full: bars fade", rowH.op == 0)


buffs = 1 run(0.5)
check("new buff: buffs back, bars not", F("buffs") == 1 and rowH.op == 0)
run(8.5)
check("new buff: buffs fade", F("buffs") == 0)

chat = 1 run(0.5)
check("chat message: menu buttons back", F("menubtn") == 1)
run(8.5)
check("chat message: then fade", F("menubtn") == 0)

ring.Value = 0.3 run(0.5)
check("low food: ring back", ring.Box.op == 1 and ring.Dia.op == 1)
ring.Value = 0.8 run(0.5)
check("eating: ring stays", ring.Box.op == 1)
run(8.5)
check("fed: ring fades", ring.Box.op == 0)

editing = true run(0.3)
check("F9 open: everything back", F("toolbar") == 1 and F("compass") == 1 and rowH.op == 1 and ring.Box.op == 1)
editing = false run(3)
on = false run(0.3)
check("switched off: everything back", F("toolbar") == 1 and F("compass") == 1 and F("menuico") == 1 and F("runemap") == 1 and rowH.op == 1 and ring.Box.op == 1)
local calls = 0
rowH.SetRenderOpacity = function(self, o) calls = calls + 1 self.op = o end
run(2)
check("switched off: no more writes", calls == 0)
print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== lua.LUA_OK) console.log('LUA ERROR', lua.lua_tojsstring(L, -1));
