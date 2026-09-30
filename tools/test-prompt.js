// Tests the pick-up prompt's gold letters (prompt.lua) against fake widgets shaped like the game's prompt (probe of
// 30-09-2026): the name, the note and the action words turn gold, the game's alpha stays, they turn gold again when
// the game refills the prompt, and nothing is written while the prompt says the same.
// Needs fengari: npm install --no-save fengari. Run: node tools/test-prompt.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'prompt.lua'), 'utf8');
const test = `
local function W(name, cls, kids)
    local w = { name = name, cls = cls or "Widget", kids = kids or {}, text = "", sets = 0 }
    w.ColorAndOpacity = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 0.8 } }
    return setmetatable(w, { __index = {
        IsValid = function() return true end,
        GetFName = function(self) return { ToString = function() return self.name end } end,
        GetClass = function(self) return { GetFName = function() return { ToString = function() return self.cls end } end } end,
        GetText = function(self) return { ToString = function() return self.text end } end,
        SetColorAndOpacity = function(self, c) self.ColorAndOpacity = c self.sets = self.sets + 1 end,
        SetDefaultColorAndOpacity = function(self, c) self.ColorAndOpacity = c self.sets = self.sets + 1 end,
    } })
end
local name, note = W("ItemNameTextBlock", "TextBlock"), W("ItemAdditionalDescriptionTextBlock", "DomTextBlock")
local label = W("LabelRichText", "DomRichTextBlock")
local state = W("InventoryStateTextBlock", "TextBlock")
local root = W("WBP_HUD_InteractionPrompt_C_1", "WBP_HUD_InteractionPrompt_C", {
    W("VerticalBox_0", "VerticalBox", { state, W("HorizontalBox_0", "HorizontalBox", { name, note }),
        W("PromptInput", "WBP_InputLegend_RichText_InputEntry_C", { label }) }) })
local function Find(w, n)
    if w.name == n then return w end
    for _, k in ipairs(w.kids) do local r = Find(k, n) if r then return r end end
end
local clock = 0
os.clock = function() return clock end
local M = load(SRCTEXT)()
local ctx = { Log = function() end, Find = Find, Prompts = function() return { root }, { "Transient.Prompt_1" } end }
local function Step() clock = clock + 0.2 M.Tick(ctx) end
local function Gold(w) local c = w.ColorAndOpacity.SpecifiedColor return math.abs(c.R - 0.7682) < 0.01 and math.abs(c.G - 0.4793) < 0.01 end

name.text, label.text = "Cabbage", "Collect"
Step()
assert(Gold(name) and name.ColorAndOpacity.SpecifiedColor.A == 0.8, "name gold, the game's alpha kept")
assert(Gold(note) and Gold(label), "note and action word gold")
assert(not Gold(state) and state.sets == 0, "the red inventory line stays the game's")
local sets = name.sets + label.sets
Step() Step()
assert(name.sets + label.sets == sets, "no writes while the prompt says the same")

name.text = "Stone Logging Axe"
name.ColorAndOpacity = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 1 } }
Step()
assert(Gold(name), "a new thing: gold again")

-- the next one of the same kind: the same words, written white again
name.ColorAndOpacity = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 1 } }
Step()
assert(Gold(name), "the same name again: gold again")
print("ALL OK")
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }
