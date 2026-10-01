// Tests main.lua's widget search without the game: SearchWidgets sorts fake widgets by class, FindClass keeps only
// live ones with a matching path and gives their full names, and asks a widget for its name once per search (the
// parts call FindClass up to 5 times a second, 30-09-2026). Runs that part of main.lua in a Lua made in JavaScript.
// Needs npm install once. Run: node tools/test-find.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs'), path = require('path');
const main = fs.readFileSync(path.join(__dirname, '..', 'RuneUI', 'Scripts', 'main.lua'), 'utf8');
const START = 'local function ClassName(obj)', END = "-- The screen's size in units";
const code = main.slice(main.indexOf(START), main.indexOf(END));
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const test = `
local names = 0   -- how often any widget was asked for its full name
local nextAddr = 100
local function Widget(cls, full, parent)
  local W = { valid = true, addr = nextAddr, parent = parent }
  nextAddr = nextAddr + 1
  function W:IsValid() return self.valid end
  function W:GetFullName() names = names + 1 return full end
  function W:GetParent() return self.parent end
  function W:GetClass() return { GetAddress = function() return cls end, GetFName = function() return { ToString = function() return cls end } end } end
  return W
end
local wheel = Widget("Slice", "Slice /Engine/Transient.Root.WBP_Spellcasting_MainPanel_C_1.WidgetTree_2.SpellRadialWidget.WidgetTree_3.RadialSlice_4")
local book = Widget("Slice", "Slice /Engine/Transient.Root.WBP_SpellBook_C_1.WidgetTree_2.RadialSlice_4")
local template = Widget("Slice", "Slice /Game/UI/WBP_Slice.WBP_Slice_C.RadialSlice_4")
local chat = Widget("Chat", "Chat /Engine/Transient.Root.WBP_ClosedChat_C_7")
local box = Widget("Panel", "Panel /Engine/Transient.Root.Box_1")
local wheelIcon = Widget("Icon", "Icon /Engine/Transient.Root.Box_1.RadialKBM", box)
local all = { wheel, book, template, chat, wheelIcon, box }
FindAllOf = function() return all end
${code}
local PATH = { "WBP_Spellcasting_MainPanel_C_%d+%.WidgetTree_%d+%.SpellRadialWidget%.WidgetTree_%d+%.RadialSlice_%d+$" }
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end

SearchWidgets()
check("sorted by class", #Found.Slice == 3 and #Found.Chat == 1 and Found.Nothing == nil)
local list, keys = FindClass("Slice", PATH)
check("the wheel's slice only, with its name", #list == 1 and list[1] == wheel and keys[1] == "Slice /Engine/Transient.Root.WBP_Spellcasting_MainPanel_C_1.WidgetTree_2.SpellRadialWidget.WidgetTree_3.RadialSlice_4")
check("one name read per candidate", names == 3)
list, keys = FindClass("Slice", PATH)
check("asked again: the same answer, no name read", #list == 1 and #keys == 1 and names == 3)
wheel.valid = false
list = FindClass("Slice", PATH)
check("a widget gone since drops out of the cached answer", #list == 0)
wheel.valid = true
list = FindClass("Chat")
check("every live one without a path", #list == 1 and list[1] == chat)
names = 0
list, keys = FindClass("Icon", { "Box_1%.RadialKBM$" }, 1)
check("climbs to the parent, named after it", list[1] == box and keys[1] == "Panel /Engine/Transient.Root.Box_1" and names == 2)
SearchWidgets()
names = 0
list = FindClass("Slice", PATH)
check("a new search reads the names again", #list == 1 and names == 3)
local E = { Instances = {}, Keys = {} }
names = 0
AddInstance(E, chat, "given")
check("an instance with its name given: no read", E.Keys[1] == "given" and names == 0)
AddInstance(E, chat)
check("an instance without: one read", E.Keys[2] == "Chat /Engine/Transient.Root.WBP_ClosedChat_C_7" and names == 1)
print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
