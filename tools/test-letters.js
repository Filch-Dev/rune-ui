// Tests the readable letters (letters.lua) against fake widgets shaped like the game's panels (probes of 30-09 and
// 01-10-2026): every text gets the shadow but the key letters, the panel's own words turn white with the game's alpha
// kept, the red "inventory full" keeps its colour, the build title loses its tapered shadow, a row the game adds later
// gets the shadow on the next walk, and a new widget is read again.
// Needs npm install once. Run: node tools/test-letters.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'letters.lua'), 'utf8');
const test = `
local function W(name, cls, kids, color)
    local w = { name = name, cls = cls, kids = kids or {}, ColorAndOpacity = { SpecifiedColor = color or { R = 1, G = 1, B = 1, A = 0.8 } } }
    if string.find(cls, "^WBP_") and kids then w.WidgetTree = { RootWidget = { name = "Root", cls = "CanvasPanel", kids = kids } } w.kids = {} end
    local api = {
        IsValid = function() return true end,
        GetFName = function(self) return { ToString = function() return self.name end } end,
        GetClass = function(self) return { GetFName = function() return { ToString = function() return self.cls end } end } end,
        GetChildrenCount = function(self) return #self.kids end,
        GetChildAt = function(self, i) return self.kids[i + 1] end,
        SetShadowOffset = function(self, o) self.offset = o.X end,
        SetShadowColorAndOpacity = function(self, c) self.shade = c.A end,
        SetDefaultShadowOffset = function(self, o) self.offset = o.X end,
        SetDefaultShadowColorAndOpacity = function(self, c) self.shade = c.A end,
        SetColorAndOpacity = function(self, c) self.ColorAndOpacity = c end,
        SetBrushColor = function(self, c) self.brushA = c.A end,
    }
    setmetatable(w, { __index = api })
    if w.WidgetTree then setmetatable(w.WidgetTree.RootWidget, { __index = api }) end
    return w
end
-- the pick-up prompt
local name, label = W("ItemNameTextBlock", "TextBlock"), W("LabelRichText", "DomRichTextBlock")
local full = W("InventoryStateTextBlock", "TextBlock", nil, { R = 0.8, G = 0.1, B = 0.1, A = 1 })
local keyText = W("KeyText", "TextBlock")
local key = W("InputActionWidget", "WBP_DomInputIconWidget_C", { W("IconBorder", "CommonBorder", { keyText }) })
local prompt = W("Prompt", "WBP_HUD_InteractionPrompt_C", {
    W("VerticalBox_0", "VerticalBox", { full, name, W("PromptInput", "WBP_InputLegend_RichText_InputEntry_C", { label, key }) }) })
-- the build panel: a gold title with the tapered shadow, one action row, a red cost
local title = W("TooltipTitle", "WBP_DomTextBlock_C", nil, { R = 0.9, G = 0.7, B = 0.3, A = 0.9 })
local nameBorder = W("NameBorder", "Border", { title })
local desc = W("InputDescription", "DomTextBlock", nil, { R = 0.5, G = 0.9, B = 0.5, A = 1 })
local cost = W("CostText", "TextBlock", nil, { R = 0.9, G = 0.2, B = 0.2, A = 1 })
local rows = W("PromptsContainer", "VerticalBox", { W("Row1", "WBP_Building_WorldTooltip_Input_C", { desc }) })
local build = W("Build", "WBP_Building_WorldTooltip_C", { nameBorder, cost, rows })
local clock = 0
os.clock = function() return clock end
local M = load(SRCTEXT)()
local hosts = { WBP_HUD_InteractionPrompt_C = { { prompt }, { "Transient.Prompt_1" } }, WBP_Building_WorldTooltip_C = { { build }, { "Transient.Build_1" } } }
local ctx = { Log = function(m) print(m) end, Find = function(c) local h = hosts[c] if h then return h[1], h[2] end return {}, {} end }
local function Step(dt) clock = clock + (dt or 0.6) M.Tick(ctx) end

Step()
for _, t in ipairs({ name, label, full, title, desc, cost }) do assert(t.offset == 1.5 and t.shade == 0.85, "no shadow on " .. t.name) end
assert(keyText.offset == nil, "shadow on the key letters")
assert(nameBorder.brushA == 0, "tapered shadow still there")
local function IsWhite(t) local c = t.ColorAndOpacity.SpecifiedColor return c.R == 1 and c.G == 1 and c.B == 1 end
assert(IsWhite(title) and title.ColorAndOpacity.SpecifiedColor.A == 0.9, "title not white or alpha lost")
assert(IsWhite(desc), "action words not white")
assert(full.ColorAndOpacity.SpecifiedColor.R == 0.8 and cost.ColorAndOpacity.SpecifiedColor.G == 0.2, "a meaningful colour painted white")
-- the game paints the title gold again: white on the next step, no new walk needed
title.ColorAndOpacity = { SpecifiedColor = { R = 0.9, G = 0.7, B = 0.3, A = 0.5 } }
Step()
assert(IsWhite(title) and title.ColorAndOpacity.SpecifiedColor.A == 0.5, "not white again")
-- the game adds a row: its words get the shadow within the walk time
local desc2 = W("InputDescription", "DomTextBlock")
table.insert(rows.kids, W("Row2", "WBP_Building_WorldTooltip_Input_C", { desc2 }))
Step(0.6)
assert(desc2.offset == nil, "walked on every step")
Step(7)
assert(desc2.offset == 1.5, "a new row without the shadow")
-- a new world, a new prompt widget: read again at once
local name2 = W("ItemNameTextBlock", "TextBlock")
local prompt2 = W("Prompt", "WBP_HUD_InteractionPrompt_C", { name2 })
hosts.WBP_HUD_InteractionPrompt_C = { { prompt2 }, { "Transient.Prompt_2" } }
Step()
assert(name2.offset == 1.5, "new prompt not read")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }
