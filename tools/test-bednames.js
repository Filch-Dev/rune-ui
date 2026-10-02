// Tests the bed names (bednames.lua) without the game: the space goes after the owner's part only; the hook is set
// once for each function, when the game has loaded it, and again when a new world has the function at a new
// address; the hook gives back the name with the space, and nothing when the name is right; the call from inside
// the hook goes through; an error of the hook call shows, and the other function still gets its hook.
// Needs npm install once. Run: node tools/test-bednames.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'bednames.lua'), 'utf8');
const test = `
local clock, logs = 0, {}
os.clock = function() return clock end
local M = load(SRCTEXT)()
local fails = 0
local function check(name, cond) if cond then print("ok   " .. name) else fails = fails + 1 print("FAIL " .. name) end end

check("the space after the owner", M.Fix("Ann'sBed Roll") == "Ann's Bed Roll" and M.Fix("Ann'sBed") == "Ann's Bed")
check("no owner: no change", M.Fix("Bed Roll") == "Bed Roll")
check("a name with the space: no change", M.Fix("Ann's Bed Roll") == "Ann's Bed Roll")
check("an owner with 's inside the name", M.Fix("It'sMe'sBed Roll") == "It'sMe's Bed Roll" and M.Fix("It'sMe's Bed Roll") == "It'sMe's Bed Roll")
check("an owner that ends in s", M.Fix("Boss'sBed Roll") == "Boss's Bed Roll")

-- the game: a function is loaded or not; a hook runs after the game's function, as UE4SS runs it
local loaded, hooks, finds, broken = {}, {}, 0, nil   -- loaded: path -> address; broken: a path whose hook call fails
local ctx = { Log = function(m) logs[#logs + 1] = m end, Find = function(path) finds = finds + 1 return loaded[path] end,
    Hook = function(path, fn) if path == broken then error("no hook") end hooks[#hooks + 1] = { Path = path, Fn = fn } end,
    Text = function(s) return { Text = s } end }
local function Step() clock = clock + 6 M.Tick(ctx) end
local ROLL = "/Game/Gameplay/BaseBuilding/Actors/Props/Cosiness/BP_BaseBuilding_BedRoll.BP_BaseBuilding_BedRoll_C:GetDisplayName"
local BED = "/Game/Gameplay/BaseBuilding/Actors/Props/Cosiness/BP_BaseBuilding_Bed.BP_BaseBuilding_Bed_C:GetDisplayName"
-- a bed roll of the game: GetDisplayName gives the game's name, or what the hook gives back
local function Roll(name)
    local R, param = {}, {}   -- param: what UE4SS gives the hook, the bed roll is behind get()
    function param.get() return R end
    function R:GetDisplayName()
        local out = { Text = name }
        for _, h in ipairs(hooks) do out = h.Fn(param) or out end
        return { ToString = function() return out.Text end }
    end
    return R
end

Step()
check("the main menu: no function, no hook", #hooks == 0 and #logs == 0)
loaded[ROLL] = 100
Step()
check("the bed roll's function is there: one hook", #hooks == 1 and hooks[1].Path == ROLL and #logs == 1)
Step()
check("no second hook on it", #hooks == 1)
check("the prompt gets the name with the space", Roll("Ann'sBed Roll"):GetDisplayName():ToString() == "Ann's Bed Roll")
check("a bed roll without an owner keeps its name", Roll("Bed Roll"):GetDisplayName():ToString() == "Bed Roll")
loaded[BED], broken = 200, BED
local okStep, errStep = pcall(Step)
check("a hook call that fails shows as an error", not okStep and string.find(tostring(errStep), "no hook", 1, true) ~= nil and #hooks == 1)
loaded[ROLL], broken = 150, ROLL   -- the bed roll's function at a new address, and its hook call fails
M.Forget(false)
pcall(Step)
check("a new hook that fails leaves the older hook at work", Roll("Ann'sBed Roll"):GetDisplayName():ToString() == "Ann's Bed Roll")
loaded[ROLL] = 100
broken = nil
Step()
check("the next look sets the bed's hook", #hooks == 2 and hooks[2].Path == BED)
local before = finds
Step()
check("both hooks set: no more looks", finds == before)
M.Forget(true)
Step()
check("a player restart: no look", finds == before)
M.Forget(false)
Step()
check("a new world, the same functions: a look, no new hook", finds == before + 2 and #hooks == 2)
loaded[ROLL] = 300
M.Forget(false)
Step()
check("a new world, the function at a new address: a new hook", #hooks == 3 and hooks[3].Path == ROLL)
local asked = 0
local old = hooks[1].Fn({ get = function() asked = asked + 1 return Roll("Ann'sBed Roll") end })
check("the older hook of that function does nothing", old == nil and asked == 0)
local newest = hooks[3].Fn({ get = function() return Roll("Ann'sBed Roll") end })
check("the newest hook does the work", newest ~= nil and newest.Text == "Ann's Bed Roll")
check("two hooks on one function do no harm", Roll("Ann'sBed"):GetDisplayName():ToString() == "Ann's Bed")

print(fails == 0 and "ALL PASS" or (fails .. " FAILED"))
return fails
`;
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) { console.log('LUA ERROR', lua.lua_tojsstring(L, -1)); process.exit(1); }
process.exit(lua.lua_tointeger(L, -1) ? 1 : 0);
