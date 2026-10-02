// Tests the buffs under the bars (buffs.lua) against a fake entry shaped like the game's (probes 13 to 17,
// 02-10-2026): the title goes unseen, the game's bar sits under the icon, one shadow lies under the icon and takes
// its picture; a second scan and a new round add no second shadow; an entry the game reuses for another buff gets
// the new picture; a picture that is not loaded yet, or a set that fails, is tried again; an entry whose parts are
// gone is placed again; a buff whose bar is shown and empty is over and goes unseen, and comes back with its bar.
// Needs npm install once. Run: node tools/test-buffs.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'buffs.lua'), 'utf8');
const test = `
local failSet = 0   -- the next SetBrushFromTexture calls that throw
local api = {}
api.__index = api
function api:IsValid() return self.valid end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetFullName() return self.cls .. " " .. self.name end
function api:GetChildrenCount() return #self.kids end
function api:GetChildAt(i) return self.kids[i + 1] end
function api:GetContent() return self.kids[1] end
function api:GetVisibility() return self.vis or 4 end
function api:SetWidthOverride(w) self.w = w end
function api:SetHeightOverride(h) self.h = h end
function api:SetClipping() end
function api:SetRenderOpacity(o) self.op = o end
function api:GetRenderOpacity() return self.op or 1 end
function api:SetColorAndOpacity(c) self.colour = c end
function api:SetDesiredSizeOverride(s) self.size = s end
function api:SetRenderTranslation(t) self.moved = t end
function api:SetBrushFromTexture(tex)
    if failSet > 0 then failSet = failSet - 1 error("set failed") end
    self.tex = tex.name
end
local function NewSlot(w)
    local slot = {}
    function slot:SetHorizontalAlignment(a) w.h_align = a end
    function slot:SetVerticalAlignment(a) w.v_align = a end
    function slot:SetPadding(p) w.pad = p.Left end
    w.Slot = slot
end
function api:RemoveFromParent()
    for i, k in ipairs(self.parent.kids) do if k == self then table.remove(self.parent.kids, i) break end end
end
function api:AddChildToOverlay(w)
    self.kids[#self.kids + 1] = w
    w.parent = self
    NewSlot(w)
    return w.Slot
end
local function W(name, cls, kids)
    local w = setmetatable({ name = name, cls = cls, kids = kids or {}, valid = true, op = 1, Brush = {} }, api)
    for _, k in ipairs(w.kids) do k.parent = w NewSlot(k) end
    return w
end
local function Tex(name) return W(name, "Texture2D") end

-- the game's entry: SizeBox > Overlay > [icon, Overlay > [ProgressBarImage, TitleText]]
local icon = W("Icon", "CommonLazyImage")
icon.Brush.ResourceObject = Tex("T_Icon_Sml_Coziness")
local bar, title = W("ProgressBarImage", "Image"), W("TitleText", "DomTextBlock")
local ov = W("Overlay_0", "Overlay", { icon, W("Overlay_1", "Overlay", { bar, title }) })
local entry = W("Entry_1", "WBP_HUD_StatusEffectListEntry_C")
entry.WidgetTree = W("WidgetTree", "WidgetTree")
entry.WidgetTree.RootWidget = W("SizeBox_0", "SizeBox", { ov })

FName = function(s) return s end
StaticFindObject = function(p) return p end
StaticConstructObject = function(_, _, name) return W(name, "Image") end
local made, logs = 0, {}
local M = load(SRCTEXT)()
M.Init({
    Log = function(m) logs[#logs + 1] = m print(m) end,
    G = function(n) made = made + 1 return n .. "_" .. made end,
    ById = function() return { Instances = {}, Keys = {} } end,
    ClassName = function(w) return w.cls end,
    FindClass = function(c) if c == "WBP_HUD_StatusEffectListEntry_C" then return { entry }, { "k" } end return {}, {} end,
    ClearOurs = function(panel, prefix)   -- as in main.lua
        for i = panel:GetChildrenCount() - 1, 0, -1 do
            local c = panel:GetChildAt(i)
            if string.find(c:GetFName():ToString(), prefix, 1, true) == 1 then c:RemoveFromParent() end
        end
    end })
local function Tick() M.NextRings = 0 M.Tick() end
local function Shades()
    local out = {}
    for _, k in ipairs(ov.kids) do if string.find(k.name, "^RU_BuffShade") then out[#out + 1] = k end end
    return out
end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function said(what) local n = 0 for _, m in ipairs(logs) do if string.find(m, what, 1, true) then n = n + 1 end end return n end

M.Scan()
check("the title is unseen, the game's bar stays seen", title.op == 0 and bar.op == 1 and bar.parent.op == 1)
check("the bar is small, at the bottom of the entry", bar.size.X == 26 and bar.size.Y == 4 and bar.v_align == 3 and bar.parent.v_align == 3)
check("the icon is in the middle, a little up", icon.size.X == 42 and icon.v_align == 2 and icon.pad == 0 and icon.moved.Y == -4)
check("one shadow, under the icon", #Shades() == 1 and ov.kids[#ov.kids] == icon and ov.kids[#ov.kids - 1] == Shades()[1])
check("the shadow has the icon's picture, a little right and down", Shades()[1].tex == "T_Icon_Sml_Coziness" and Shades()[1].op == 1
    and Shades()[1].colour.A == 0.85 and Shades()[1].moved.X == 1.5 and Shades()[1].moved.Y == -2.5)

M.Scan() Tick()
check("a second scan adds no second shadow", #Shades() == 1 and made == 1)
M.Forget(true)
M.Scan()
check("a new round: still one shadow, the icon on top", #Shades() == 1 and made == 2 and ov.kids[#ov.kids] == icon)

icon.Brush.ResourceObject = Tex("T_Icon_Sml_Shelter")   -- the game uses the entry for another buff
Tick()
check("a reused entry: the shadow takes the new picture", Shades()[1].tex == "T_Icon_Sml_Shelter")

icon.Brush.ResourceObject = nil   -- the picture is not loaded yet
Tick()
check("no picture: the shadow is unseen", Shades()[1].op == 0)
icon.Brush.ResourceObject = Tex("T_Icon_Sml_Poison")
failSet = 1
Tick()
Tick()
check("a set that failed is tried again", Shades()[1].tex == "T_Icon_Sml_Poison" and Shades()[1].op == 1)

Shades()[1].valid = false   -- the game built the entry's inside again
Tick()
M.Scan()
check("an entry whose parts are gone is placed again, with one shadow", #Shades() == 1 and Shades()[1].valid and Shades()[1].tex == "T_Icon_Sml_Poison")
-- the bar's material, as the game fills it
local fill = 0.5
bar.Brush.ResourceObject = setmetatable({ valid = true, ScalarParameterValues = { ForEach = function(_, fn)
    fn(1, { get = function() return { ParameterInfo = { Name = { ToString = function() return "Fill" end } }, ParameterValue = fill } end })
end } }, api)
local box = entry.WidgetTree.RootWidget
Tick()
check("a buff with time left is seen", entry.op == 1 and box.w == 46)
fill = 0
Tick()
check("an empty bar: the buff is over, unseen, the row closes", entry.op == 0 and box.w == 1)
entry.op = 1   -- the game shows the entry again, the buff still over
Tick()
check("the game shows it again: unseen again", entry.op == 0 and box.w == 1)
fill = 0.8
Tick()
check("the bar fills again: the buff is back", entry.op == 1 and box.w == 46)
fill = 0
Tick()
bar.vis = 1   -- the game uses the entry for a buff without a timer
Tick()
check("a reused entry without a timer is seen", entry.op == 1 and box.w == 46)
bar.vis, fill = 4, 0
Tick()
M.Forget(true)
M.Scan()
check("a new round: the buff that is over stays unseen", entry.op == 0 and box.w == 1)
fill = 0.5
Tick()
check("and it is back when its bar fills", entry.op == 1 and box.w == 46)
check("the log: each picture named once, no failure", said("buff icon: T_Icon_Sml_Poison") == 1 and said("failed") == 0)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
