// Tests the quests panel (quests.lua) against a fake panel named as the game's (playtest, 02-10-2026): the row's
// master copy gets the HUD font and the shadow; every text under the panel gets them once (the walk of letters.lua),
// rich text with its own setters and the size of its style in use, the key letters not; nothing before the font is
// found; a new text the game adds later is styled on the next walk; a new world styles again.
// Needs npm install once. Run: node tools/test-quests.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'quests.lua'), 'utf8');
const letters = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'letters.lua'), 'utf8');
const test = `
local sets = 0
local api = {}
api.__index = api
function api:IsValid() return true end
function api:GetFName() return { ToString = function() return self.name end } end
function api:GetClass() return { GetFName = function() return { ToString = function() return self.cls end } end } end
function api:GetFullName() return self.cls .. " /Engine/Transient." .. self.name end
function api:GetChildrenCount() if not self.kids then error("not a panel") end return #self.kids end
function api:GetChildAt(i) return self.kids[i + 1] end
function api:GetContent() return self.content end
function api:SetFont(f) self.font = f.FontObject sets = sets + 1 end
function api:SetShadowOffset(o) self.offset = o.X end
function api:SetShadowColorAndOpacity(c) self.shade = c.A end
function api:SetDefaultFont(f) self.font = f.FontObject self.size = f.Size sets = sets + 1 end
function api:SetDefaultShadowOffset(o) self.offset = o.X end
function api:SetDefaultShadowColorAndOpacity(c) self.shade = c.A end
local function W(name, cls, kids)
    return setmetatable({ name = name, cls = cls, kids = kids, Font = { Size = 12 }, DefaultTextStyleOverride = { Font = { Size = 10 } } }, api)
end
local title = W("TitleText", "WBP_DomTextBlock_C")
local perk = W("PerkDescriptionText", "DomRichTextBlock")
perk.bOverrideDefaultStyle, perk.DefaultTextStyle = false, { Font = { Size = 9 } }   -- the style in use, not the override
local label = W("LabelText", "TextBlock")
local key = W("KeyText", "TextBlock")
local slotText = W("SlotText", "WBP_DomTextBlock_C")
local prompt = W("PromptInput", "WBP_InputLegend_InputEntry_C")
prompt.WidgetTree = { RootWidget = W("HorizontalBox_0", "HorizontalBox", { label, W("Key", "WBP_DomInputIconWidget_C") }) }
prompt.WidgetTree.RootWidget.kids[2].WidgetTree = { RootWidget = W("Overlay_42", "Overlay", { key }) }
local row = W("Row_1", "WBP_QuestAndUnlocks_Item_Slot_C")
row.WidgetTree = { RootWidget = W("SizeBox_0", "SizeBox") }
row.WidgetTree.RootWidget.content = W("Overlay_1", "Overlay", { slotText })
local rows = W("UnlockedItemBox", "VerticalBox", { row })
local entry = W("Entry_1", "WBP_QuestAndUnlocks_Item_C")
entry.WidgetTree = { RootWidget = W("RootBox", "SizeBox") }
entry.WidgetTree.RootWidget.content = W("UnlockedBox", "VerticalBox", { title, rows, perk, prompt })
local queue = W("Queue_1", "WBP_QuestAndUnlocks_C")
queue.WidgetTree = { RootWidget = W("NotificationQueueWidget", "WBP_Notifications_VerticalPanelContainer_C") }
queue.WidgetTree.RootWidget.WidgetTree = { RootWidget = W("NotificationQueueWidget", "VerticalBox", { entry }) }
local master = W("SlotText", "WBP_DomTextBlock_C")
function StaticFindObject(p) if p:find("WBP_QuestAndUnlocks_Item_Slot_C:WidgetTree.SlotText", 1, true) then return master end end
local clock, logs, font = 0, {}, nil
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, Font = function() return font end,
    Find = function() return { queue }, { "Transient.Queue_1" } end, Collect = load(LETTERS)().Collect }
local function Step() clock = clock + 0.6 M.Tick(ctx) end
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end

Step()
check("no font found yet: nothing styled", sets == 0)
font = "Poppins"
Step()
check("the row's master copy: the HUD font and the shadow", master.font == "Poppins" and master.offset == 1.5 and master.shade == 0.85)
check("the title, the row and the key row's words", title.font == "Poppins" and slotText.font == "Poppins" and label.font == "Poppins"
    and title.offset == 1.5 and label.shade == 0.85)
check("the description with the rich text setters, at the size of its style", perk.font == "Poppins" and perk.offset == 1.5 and perk.size == 9)
check("the key letters stay the game's", key.font == nil)
check("the size stays the game's", title.Font.Size == 12)
local before = sets
Step()
check("each text once", sets == before)
local second = W("SlotText_2", "WBP_DomTextBlock_C")
row.WidgetTree.RootWidget.content.kids[2] = second   -- the game adds a text
Step()
check("not before the next walk", second.font == nil)
clock = clock + 5
Step()
check("a text added later is styled on the next walk", second.font == "Poppins" and sets == before + 1)
M.Forget()
before = sets
Step()
check("a new world styles everything again: the master copy and five texts", sets == before + 6)
check("the log: no failure", #logs == 0)

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
lua.lua_pushstring(L, to_luastring(letters)); lua.lua_setglobal(L, to_luastring('LETTERS'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
