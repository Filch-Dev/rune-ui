// Tests layout.lua without the game: the position math on a 16:9 screen, a 21:9 screen and with the game's HUD
// scale. Run: node tools/test-layout.js (after npm install).
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'layout.lua'), 'utf8');
const test = `
local M = (function() ${src} end)()
local fails = 0
local function near(a, b) return math.abs(a - b) < 0.01 end
local function check(name, cond) if not cond then fails = fails + 1 print("FAIL " .. name) else print("ok   " .. name) end end

-- a small HUD: the bars (Full, bottom middle), the food rings inside them (left bottom), the drink ring that
-- follows the rings, RuneMap on the viewport (top right), and a switch
local function Fresh()
    local E = {
        { Id="vitals",   Full=true, A={0.5,1}, Center={X=952, Y=967}, Size={X=330, Y=75} },
        { Id="survival", Inside="vitals", A={0,1}, Center={X=158, Y=968}, Size={X=215, Y=95} },
        { Id="drink",    Follows="survival", A={0,1}, Center={X=328, Y=958}, Size={X=50, Y=50} },
        { Id="runemap",  Custom="map", A={1,0}, Center={X=1792, Y=128}, Size={X=224, Y=224} },
        { Id="aim",      Custom="aim", A={0,0}, Center={X=960, Y=540}, Size={X=40, Y=40} },
    }
    for _, e in ipairs(E) do e.X, e.Y, e.Scale = 0, 0, 1 e.A = e.A or {0, 0} M.TargetFromSpot(e) end
    M.Init(E)
    M.Hud.W, M.Hud.H, M.Hud.S, M.Hud.VW, M.Hud.VH = 1920, 1080, 1, 1920, 1080
    return E
end

-- thirds
check("third: left", M.Third(100, 1920) == 0)
check("third: middle", M.Third(960, 1920) == 0.5)
check("third: right", M.Third(1800, 1920) == 1)
check("third: the edge of a third counts as the middle", M.Third(640, 1920) == 0.5 and M.Third(1280, 1920) == 0.5)

-- 16:9, nothing moved: every element sits at its centre
local E = Fresh()
local V, S, D, R, A = M.ById("vitals"), M.ById("survival"), M.ById("drink"), M.ById("runemap"), M.ById("aim")
check("kinds: switch and viewport", M.IsSwitch(A) and not M.IsSwitch(R) and M.OnViewport(R) and not M.OnViewport(V))
check("targets from the spot", V.TX == 0.5 and V.TY == 1 and S.TX == 0 and S.TY == 1 and R.TX == 1 and R.TY == 0)
local x, y = M.FinalCenter(V)
check("16:9: home is the centre", near(x, 952) and near(y, 967))
local tx, ty, ts = M.LocalTransform(V)
check("16:9: no move, no size", near(tx, 0) and near(ty, 0) and near(ts, 1))
local px, py = M.Pivot(V)
check("16:9: pivot on the bars", near(px, 952 / 1920) and near(py, 967 / 1080))
check("16:9: area", M.Area(V) == "Bottom" and M.Area(R) == "Top right" and M.Area(S) == "Bottom left")

-- the bars moved to the top left and made smaller: the rings inside them must stay where they were
V.X, V.Y, V.Scale = -699, -907, 0.9
local sx, sy = M.FinalCenter(S)
check("inside: the child stays put when the parent moves", near(sx, 158) and near(sy, 968))
-- what goes into the child's widget undoes the parent's transform: parent maps p to pivot + sP*(p - pivot) + tP
tx, ty, ts = M.LocalTransform(S)
local vx, vy = M.Home(V)
local mapped = vx + 0.9 * (158 + tx - vx) + (-699)
check("inside: the written move lands on the spot", near(mapped, 158) and near(ts, 1 / 0.9))
-- a Follows element is carried by its parent
S.X, S.Y, S.Scale = 802, 3, 0.72
local dx, dy = M.FinalCenter(D)
local ex = 158 + 802 + 0.72 * (328 - 158)
check("follows: carried by the rings", near(dx, ex) and near(dy, 968 + 3 + 0.72 * (958 - 968)))
local bx, by, bw, bh = M.ScreenBox(D)
check("follows: box takes the parent's size", near(bw, 50 * 0.72) and near(bx + bw / 2, dx))
local spx = select(1, M.Spot(D))
check("follows: the F9 spot is the final centre", near(spx, dx))

-- 21:9: 2560 units wide. The bars follow the middle, the map the right edge, the rings the left edge.
E = Fresh()
V, S, R = M.ById("vitals"), M.ById("survival"), M.ById("runemap")
M.Hud.W, M.Hud.VW = 2560, 2560
x = M.FinalCenter(V)
check("21:9: the bars stay in the middle", near(x, 952 + 320))
x = M.FinalCenter(R)
check("21:9: the map stays top right", near(x, 1792 + 640))
x = M.FinalCenter(S)
check("21:9: the rings stay left", near(x, 158))
tx = M.LocalTransform(R)
check("21:9: an element at its own edge needs no move", near(tx, 0))
-- the rings moved to the middle on a 16:9 screen (TX 0.5) follow the middle on the wide screen
S.X = 802 M.TargetFromSpot(S)
check("21:9: moved rings take the middle", S.TX == 0.5)
x = M.FinalCenter(S)
check("21:9: moved rings sit in the middle", near(x, 158 + 802 + 320))

-- Retarget: after a move, the spot on this screen stays put while the edge changes
E = Fresh()
R = M.ById("runemap")
M.Hud.W, M.Hud.VW = 2560, 2560
R.X = -1800   -- from the right edge far to the left, on the wide screen (632 of 2560: the left third)
local before = M.FinalCenter(R)
M.Retarget(R)
local after = M.FinalCenter(R)
check("retarget: same spot on this screen", near(before, after))
check("retarget: now follows the left third", R.TX == 0)
check("retarget: X is now in 16:9 units", near(R.X, -1800 + 640))

-- the HUD scale: at 1.25 the HUD is smaller in units, so the viewport is wider in HUD units
E = Fresh()
V, R = M.ById("vitals"), M.ById("runemap")
M.Hud.S, M.Hud.W, M.Hud.H = 1.25, 1920 / 1.25, 1080 / 1.25
local gw, gh = M.Grow(V)
check("scale: the HUD shrinks", near(gw, 1920 / 1.25 - 1920) and near(gh, 1080 / 1.25 - 1080))
gw = M.Grow(R)
check("scale: the viewport does not", near(gw, 0))
x, y = M.FinalCenter(V)
check("scale: final centre is in viewport units", near(x, (952 + 0.5 * (1920 / 1.25 - 1920)) * 1.25))
check("scale: the bars still sit in the middle of the screen", near(x, 960 - 8 * 1.25))

if fails > 0 then print(fails .. " FAILED") os.exit(1) end
print("ALL PASS")
`;
lua.lua_pushstring(L, to_luastring(test));
if (lauxlib.luaL_dostring(L, to_luastring(test)) !== 0) {
  console.log('error:', lua.lua_tojsstring(L, -1));
  process.exit(1);
}
