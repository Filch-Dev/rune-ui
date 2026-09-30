// Tests aim.lua without the game: fake aim widgets and a fake lock-on orb. On: gold with the game's alpha kept, gold
// again after the game paints white, the diamond on the orb. Off: every colour and the orb picture back.
// Needs fengari: npm install --no-save fengari. Run: node tools/test-aim.js
const { lua, lauxlib, lualib, to_luastring } = require('fengari');
const fs = require('fs');
const L = lauxlib.luaL_newstate(); lualib.luaL_openlibs(L);
const src = fs.readFileSync(require('path').join(__dirname, '..', 'RuneUI', 'Scripts', 'aim.lua'), 'utf8');
const harness = `
local clock = 0
os.clock = function() clock = clock + 1 return clock end
local nextAddr = 1
local function Obj(name, extra)
  local o = extra or {}
  o._name = name; o._addr = nextAddr; nextAddr = nextAddr + 1
  function o:IsValid() return true end
  function o:GetFName() local n = self._name return { ToString = function() return n end } end
  function o:GetFullName() return "X /Engine/Transient." .. self._name end
  function o:GetAddress() return self._addr end
  return o
end
local function Img(name, c) local o = Obj(name, { ColorAndOpacity = c, Brush = { ImageSize = { X = 64, Y = 64 } } })
  function o:SetColorAndOpacity(v) self.ColorAndOpacity = v end
  return o end
local function Panel(name, kids) local o = Obj(name)
  function o:GetChildrenCount() return #kids end
  function o:GetChildAt(i) return kids[i + 1] end
  return o end
local white = { R = 1, G = 1, B = 1, A = 0.75 }
local cross = Img("Crosshair", { R = 1, G = 1, B = 1, A = 0.75 })
local bar = Obj("StaminaProgressBar", { FillColorAndOpacity = { R = 1, G = 1, B = 1, A = 1 } })
function bar:SetFillColorAndOpacity(v) self.FillColorAndOpacity = v end
local mat = Obj("MI_Ring", { VectorParameterValues = { ForEach = function(_, f)
  f(1, { get = function() return { ParameterInfo = { Name = { ToString = function() return "Glow Color and Opacity" end } }, ParameterValue = { R = 1, G = 1, B = 1, A = 0.7 } } end }) end } })
local ring = Img("SightRing", white); ring.Brush.ResourceObject = mat
local mid = Obj("MID", {}); function mid:SetVectorParameterValue(n, v) self.Last = v end
function ring:GetDynamicMaterial() return mid end
local staff = Img("MagicIcon", { R = 1, G = 1, B = 1, A = 1 })
staff.Brush.TintColor = { SpecifiedColor = { R = 1, G = 1, B = 1, A = 0.9 } }
function staff:SetBrushTintColor(t) self.Brush.TintColor = t end
local ads = Obj("ReticleRangedADS", { WidgetTree = { RootWidget = Panel("CanvasPanel_0", { ring, cross, bar, staff }) } })
local icon = Img("WBP_TargetIcon_C_1", { R = 1, G = 1, B = 1, A = 1 })   -- the staff's ring round a target
local reticle = Obj("WBP_HUD_ReticleWidget_C", { WidgetTree = { RootWidget = Panel("Canvas", { ads }) } })
local origTex = Obj("T_Reticule_Asset")
function origTex:GetFullName() return "Texture2D /Game/UI/T_Reticule_Asset.T_Reticule_Asset" end   -- a game picture
local orbImg = Img("Orb", { R = 1, G = 1, B = 1, A = 1 }); orbImg.Brush.ResourceObject = origTex
function orbImg:SetBrushFromTexture(t) self.Brush = { ResourceObject = t, ImageSize = { X = 1, Y = 1 } } end
function orbImg:SetBrush(b) self.Brush = b end
function orbImg:SetRenderScale(s) self.Scale = s.X end
local sizeBox = Obj("SizeBox_1"); function sizeBox:GetContent() return orbImg end
local orb = Obj("WBP_LockOnTargetOrb_C", { WidgetTree = { RootWidget = sizeBox } })
local diamondTex = Obj("diamond")
StaticFindObject = function(p)
  if p == "/Game/UI/T_Reticule_Asset.T_Reticule_Asset" then return origTex end
  return { ImportFileAsTexture2D = function() return diamondTex end }
end
FName = function(s) return s end
local on = true
local logs = {}
local ctx = { Log = function(m) logs[#logs + 1] = m print(m) end, On = function() return on end,
  Reticle = function() return reticle end, Orb = function() return orb end,
  TargetIcons = function() return { icon } end }
local Aim = load(SRC)()
Aim.Tick(ctx)
assert(math.abs(cross.ColorAndOpacity.R - 0.7678) < 0.01, "crosshair not gold " .. cross.ColorAndOpacity.R)
assert(cross.ColorAndOpacity.A == 0.75, "alpha not kept")
assert(bar.FillColorAndOpacity.R < 1, "bar not gold")
assert(mid.Last and mid.Last.A == 0.7, "ring material not gold")
assert(ring.ColorAndOpacity.R < 1, "ring tint not gold")
assert(staff.Brush.TintColor.SpecifiedColor.R < 1 and staff.Brush.TintColor.SpecifiedColor.A == 0.9, "staff ring not gold")
assert(staff.ColorAndOpacity.R == 1, "staff ring gold twice")
assert(icon.ColorAndOpacity.R < 1, "target ring not gold")
assert(orbImg.Brush.ResourceObject == diamondTex and orbImg.Scale == 0.45 and orbImg.Brush.ImageSize.X == 64, "no diamond")
cross.ColorAndOpacity = { R = 1, G = 1, B = 1, A = 0.5 }   -- the game paints it white again
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R < 1 and cross.ColorAndOpacity.A == 0.5, "not gold again")
on = false
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R == 1 and cross.ColorAndOpacity.A == 0.75, "crosshair not restored")
assert(bar.FillColorAndOpacity.R == 1, "bar not restored")
assert(mid.Last.R == 1 and mid.Last.A == 0.7, "ring not restored")
assert(ring.ColorAndOpacity.R == 1, "ring tint not restored")
assert(staff.Brush.TintColor.SpecifiedColor.R == 1 and staff.Brush.TintColor.SpecifiedColor.A == 0.9, "staff ring not restored")
assert(icon.ColorAndOpacity.R == 1, "target ring not restored")
assert(orbImg.Brush.ResourceObject == origTex and orbImg.Scale == 1 and orbImg.Brush.ImageSize.X == 64, "orb not restored")
on = true
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R < 1 and orbImg.Brush.ResourceObject == diamondTex, "not gold after on again")
-- a player restart: the handles go, the widgets stay gold; off must still bring the white back
Aim.Forget()
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R < 1 and orbImg.Brush.ResourceObject == diamondTex, "not gold after a restart")
Aim.Forget()
on = false
Aim.Tick(ctx)
assert(cross.ColorAndOpacity.R == 1 and bar.FillColorAndOpacity.R == 1 and mid.Last.R == 1, "white not back after a restart")
assert(orbImg.Brush.ResourceObject == origTex and orbImg.Scale == 1, "orb not back after a restart")
print("ALL OK")
`;
const full = harness.replace('load(SRC)', 'load(SRCTEXT)');
lua.lua_pushstring(L, to_luastring(src)); lua.lua_setglobal(L, to_luastring('SRCTEXT'));
if (lauxlib.luaL_dostring(L, to_luastring(full)) !== 0) { console.log('FAIL', lua.lua_tojsstring(L, -1)); process.exit(1); }

