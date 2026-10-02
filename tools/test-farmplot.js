// Tests the farm plot panels (farmplot.lua) against fake panels named as the game's (probes 58 to 60, 02-10-2026):
// the need icons at half size; the band, the frame and the gloss unseen; a brown fill; a smaller title with the
// shadow; a panel is styled once; a panel with a renamed part is left as the game made it and logged once; a new
// world starts over.
// Needs npm install once. Run: node tools/test-farmplot.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'farmplot.lua'), 'utf8');
const test = `
local api = {}
api.__index = api
function api:IsValid() return true end
function api:SetRenderScale(s) self.scale = s.X self.sets = (self.sets or 0) + 1 end
function api:SetRenderOpacity(o) self.op = o end
function api:SetBrushColor(c) self.color = c end
function api:SetShadowOffset(o) self.offset = o.X end
function api:SetShadowColorAndOpacity(c) self.shade = c.A end
local function W(t) return setmetatable(t or {}, api) end
local objects = {}
local NAMES = { "NeedsAssembly", "TillingBarProgress", "TillingTitle", "TillingPanelBackground",
    "TillingBarBackgroundSurrounding", "TillingBarOutline", "TillingBarGradient", "TillingBarBackground" }
local function Panel(n)
    local p = { parts = {} }
    local tree = "/Engine/Transient.Plot" .. n .. ".WidgetTree_" .. n
    for _, name in ipairs(NAMES) do p.parts[name] = W({ op = 1 }) objects[tree .. "." .. name] = p.parts[name] end
    p.W = W({ WidgetTree = { GetFullName = function() return "WidgetTree " .. tree end } })
    p.tree = tree
    return p
end
function StaticFindObject(path) return objects[path] end
local panels = { Panel(1), Panel(2) }
local clock, logs = 0, {}
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, Find = function()
    local l, k = {}, {}
    for i, p in ipairs(panels) do l[i], k[i] = p.W, "Plot" .. i end
    return l, k
end }
local function Step() clock = clock + 0.6 M.Tick(ctx) end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end

Step()
local p = panels[1].parts
check("the need icons at half size", p.NeedsAssembly.scale == 0.5)
check("the band, the frame and the gloss unseen, the track stays", p.TillingPanelBackground.op == 0 and p.TillingBarOutline.op == 0
    and p.TillingBarBackgroundSurrounding.op == 0 and p.TillingBarGradient.op == 0 and p.TillingBarBackground.op == 1)
check("a brown fill", p.TillingBarProgress.color.R == 0.332 and p.TillingBarProgress.color.B == 0.045)
check("a smaller title with the shadow", p.TillingTitle.scale == 0.7 and p.TillingTitle.offset == 1.5 and p.TillingTitle.shade == 0.85)
check("the second panel too", panels[2].parts.NeedsAssembly.scale == 0.5)
Step()
check("a panel is styled once", p.NeedsAssembly.sets == 1)
panels[3] = Panel(3)
objects[panels[3].tree .. ".TillingBarOutline"] = nil   -- a game patch renamed a part
Step()
check("a renamed part: the panel stays the game's, one log line", panels[3].parts.NeedsAssembly.scale == nil and #logs == 1)
M.Forget()
Step()
check("a new world: every panel is styled again", p.NeedsAssembly.sets == 2 and #logs == 2)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
