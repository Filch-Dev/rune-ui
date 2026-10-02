// Tests the tool bar tiles (toolbar.lua) against fake widgets shaped like the game's bar (probes 12 and 13,
// 02-10-2026): every slot gets the see-through square, one gold edge, the HUD font on its number and count, and a
// dark track behind the durability bar, whose colours stay the game's; the slot in use has the bright edge and loses
// the orange frame; a slot the game builds new is painted again.
// Needs npm install once. Run: node tools/test-toolbar.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'toolbar.lua'), 'utf8');
const test = `
local addr = 100
local api = {}
api.__index = api
function api:IsValid() return self.valid end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetClass() return { GetFName = function() return { ToString = function() return self.cls end } end } end
function api:GetAddress() return self.addr end
function api:GetChildrenCount() return #self.kids end
function api:GetChildAt(i) return self.kids[i + 1] end
function api:GetVisibility() return self.vis end
function api:GetParent() return self.parent end
function api:SetVisibility(v) self.vis = v end
function api:SetRenderOpacity(o) self.op = o end
function api:SetFont(f) self.font = f end
function api:SetColorAndOpacity(c) self.colour = c.SpecifiedColor end
function api:SetShadowOffset(o) self.shadow = o.X end
function api:SetShadowColorAndOpacity() end
function api:SetBrush(b) self.set = { Width = b.OutlineSettings.Width, Colour = b.OutlineSettings.Color.SpecifiedColor } end
function api:SetScalarParameterValue(n, v) self.values[n] = v end
function api:RemoveFromParent()
    for i, k in ipairs(self.parent.kids) do if k == self then table.remove(self.parent.kids, i) break end end
end
function api:AddChildToOverlay(w)
    self.kids[#self.kids + 1] = w
    w.parent = self
    local slot = {}
    function slot:SetHorizontalAlignment() end
    function slot:SetVerticalAlignment() end
    function slot:SetPadding(p) w.pad = p.Left end
    return slot
end
local function W(name, cls, kids)
    addr = addr + 1
    local w = setmetatable({ name = name, cls = cls, kids = kids or {}, valid = true, addr = addr, vis = 4,
        Font = { Size = 12 }, Brush = { OutlineSettings = {} } }, api)
    for _, k in ipairs(w.kids) do k.parent = w end
    return w
end
-- a widget of the game with a tree of its own
local function User(name, cls, root)
    local w = W(name, cls)
    w.WidgetTree = W("WidgetTree", "WidgetTree")
    w.WidgetTree.RootWidget = root
    return w
end
local function Inner(item)
    local mat = W("MID", "MaterialInstanceDynamic")
    mat.values = {}
    local image = W("ItemImage", "Image")
    image.Brush.ResourceObject = mat
    local eq = W("EquippedImage", "Image")
    eq.vis = 1
    local pb = W("ProgressBar", "ProgressBar")
    pb.FillColorAndOpacity = { R = 0.46, G = 0.40, B = 0.29, A = 1 }   -- the game's own colour, read in the game
    pb.WidgetStyle = { BackgroundImage = {} }
    local bar = User("DurabilityBar", "WBP_Inventory_DurabilityBar_C", W("SizeBox", "SizeBox", { W("Border_0", "Border", { pb }) }))
    local count = W("StackSizeText", "WBP_DomTextBlock_C")
    local ov = W("Overlay_31", "Overlay", { image, eq, W("CompatibilityImage", "Image"), bar, count })
    local inv = User("InventorySlot", "WBP_Inventory_ItemSlot_C", W("InternalRootButtonBase", "CommonButtonInternalBase", { W("SizeBox_0", "SizeBox", { ov }) }))
    inv.t = { mat = mat, eq = eq, pb = pb, count = count, ov = ov, item = item }
    return inv
end
local function Slot(n, item)
    local inv, header = Inner(item), W("HeaderText", "WBP_DomTextBlock_C")
    local ov = W("Overlay_31", "Overlay", { inv, header })
    local s = User("Slot" .. n, "WBP_Inventory_QuickAccess_ItemSlot_C", W("SizeBox_0", "SizeBox", { ov }))
    s.ov, s.header = ov, header
    return s
end
local slots = { Slot(1, "staff"), Slot(2, "axe"), Slot(3, "food") }
local bar = User("QuickAccessBar", "WBP_Inventory_QuickAccesBar_C", W("SlotGridContainer", "UniformGridPanel", slots))
local function T(i) return slots[i].ov.kids[1].t end   -- the inner slot's parts, as the game has them now
local function Edges(i)
    local out = {}
    for _, k in ipairs(T(i).ov.kids) do if string.find(k.name, "^RU_TbEdge") then out[#out + 1] = k end end
    return out
end

FName = function(s) return s end
StaticFindObject = function(p) return p end
StaticConstructObject = function(_, _, name) return W(name, "Image") end
local clock, made, logs = 0, 0, {}
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, G = function(n) made = made + 1 return n .. "_" .. made end,
    Font = function() return "Poppins" end, ById = function() return { Instances = { bar } } end }
local function Step(dt) clock = clock + (dt or 0.2) M.Tick(ctx) end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end
local function near(a, b) return math.abs(a - b) < 0.01 end
local function said(what) local n = 0 for _, m in ipairs(logs) do if string.find(m, what, 1, true) then n = n + 1 end end return n end

T(2).eq.vis = 4   -- the axe is in the hand
Step()
check("the square is see-through on every slot", T(1).mat.values["Background Opacity"] == 0.32 and T(3).mat.values["Background Texture Opacity"] == 0)
check("one gold edge per slot, set in by the square's margin", #Edges(1) == 1 and #Edges(3) == 1 and Edges(1)[1].pad == 3.25)
check("the edge takes no clicks", Edges(1)[1].vis == 3)
check("the number in the HUD font, cream, with a shadow", slots[1].header.font.FontObject == "Poppins" and slots[1].header.font.Size == 11
    and near(slots[1].header.colour.R, 0.88) and slots[1].header.shadow == 1)
check("the stack count too", T(3).count.font.FontObject == "Poppins" and T(3).count.colour ~= nil)
check("the durability keeps the game's colour, on a dark track", T(1).pb.FillColorAndOpacity.G == 0.40 and T(1).pb.WidgetStyle.BackgroundImage.TintColor.SpecifiedColor.A == 0.5)
check("the orange frame is unseen on every slot", T(1).eq.op == 0 and T(2).eq.op == 0)
check("the slot in use: a bright edge, 2 wide", Edges(2)[1].set.Width == 2 and Edges(2)[1].set.Colour.A == 1)
check("the other slots: the thin edge", Edges(1)[1].set.Width == 1 and near(Edges(1)[1].set.Colour.A, 0.45))
check("the log: ready once, no failure", said("tool bar: tiles") == 1 and said("not ") == 0)

Step()
check("a second look adds no second edge", #Edges(1) == 1 and #Edges(2) == 1 and made == 3)
T(2).eq.vis, T(1).eq.vis = 1, 4   -- the staff in the hand now
Step()
check("the bright edge follows the item in the hand", Edges(1)[1].set.Width == 2 and Edges(2)[1].set.Width == 1 and near(Edges(2)[1].set.Colour.A, 0.45))

T(1).pb.FillColorAndOpacity = { R = 0.9, G = 0.1, B = 0.05, A = 1 }   -- the game: this item breaks soon
Step()
check("a colour the game writes on the durability stays", T(1).pb.FillColorAndOpacity.G == 0.1 and T(3).pb.FillColorAndOpacity.G == 0.40)

T(3).mat.values["Background Opacity"] = 1   -- the game wrote the square again
Step(1.1)
check("a square the game wrote again is see-through again", T(3).mat.values["Background Opacity"] == 0.32)

-- a new item in slot 3: the game builds the inner slot new
local old = slots[3].ov.kids[1]
local new = Inner("potion")
slots[3].ov.kids[1] = new
new.parent = slots[3].ov
Step()
check("a slot built new is painted again", #Edges(3) == 1 and T(3).item == "potion" and T(3).mat.values["Background Opacity"] == 0.32 and T(3).eq.op == 0)
check("and its count is styled", T(3).count.font.FontObject == "Poppins")

-- parts the game takes away while the slot itself stays
local n0 = made
T(1).eq.valid = false
Step()
check("a slot whose frame is gone is painted again, not called", made == n0 + 1 and #Edges(1) == 1)
T(1).eq.valid = true
local lost = Edges(2)[1]
lost:RemoveFromParent() lost.parent = nil   -- the game built the slot's parts new: our edge is out of it
Step()
check("a slot that lost its edge gets one again", #Edges(2) == 1 and Edges(2)[1] ~= lost)
local n1 = made
slots[1].ov.kids[1], slots[1].ov.kids[2] = slots[1].ov.kids[2], slots[1].ov.kids[1]   -- the number first, the item slot second
local function T1() return slots[1].ov.kids[2].t end
Step()
check("the inner slot is found by its name, not its place", made == n1 and T1().mat.values["Background Opacity"] == 0.32)
slots[1].ov.kids[1], slots[1].ov.kids[2] = slots[1].ov.kids[2], slots[1].ov.kids[1]
local outer = Slot(1, "bow")
slots[1] = outer
bar.WidgetTree.RootWidget.kids[1] = outer
Step()
check("a whole slot built new is painted", #Edges(1) == 1 and T(1).item == "bow" and slots[1].header.font.FontObject == "Poppins")

local before = made
clock = clock + 0.05 M.Tick(ctx)
check("no look before its time", made == before)
slots[2].valid = false
Step()
check("a slot that is gone stops nothing", #Edges(1) == 1 and said("not ") == 0)
M.Forget()
Step()
check("after a new world every slot is painted again, with one edge", #Edges(1) == 1 and made > before)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
