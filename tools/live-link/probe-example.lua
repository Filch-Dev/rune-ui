-- An example check for the live link: copy it over the game's Mods/RuneUIProbe/live.lua while the game runs.
-- It lists every live drink buff entry, its opacities and our ring box (probe 10 of 01-10-2026). The safe way:
-- one FindAllOf("UserWidget"), the class read in a pcall, only /Engine/Transient names, IsValid before every
-- call, no GetParent past a tree's root. FindAllOf on a blueprint class and a call on an invalid object both
-- crashed the game (UE4SS.dll, null read).
local L = Live.Log
local function Nm(o) return o:GetFName():ToString() end
local function Cls(o) return o:GetClass():GetFName():ToString() end
local function Op(w)
    local s = Cls(w) .. " " .. Nm(w)
    pcall(function() s = s .. " vis " .. tostring(w:GetVisibility()) end)
    pcall(function() s = s .. string.format(" op %.2f", w:GetRenderOpacity()) end)
    pcall(function() s = s .. string.format(" colour %.2f", w.ColorAndOpacity.A) end)
    pcall(function() local t = w.RenderTransform.Translation s = s .. string.format(" move %.1f,%.1f", t.X, t.Y) end)
    return s
end
local n = 0
for _, W in pairs(FindAllOf("UserWidget") or {}) do
    local ok, c = pcall(function() return W:IsValid() and Cls(W) end)
    if ok and c == "WBP_HUD_DrinkBuffListEntry_C" then
        pcall(function()
            if not W:IsValid() then return end
            local f = W:GetFullName()
            if not string.find(f, "/Engine/Transient%.") then return end
            n = n + 1
            L(n .. " entry " .. Op(W) .. " " .. string.sub(f, -40))
            local root = W.WidgetTree.RootWidget
            if root and root:IsValid() then
                L(n .. "   root " .. Op(root))
                local ov = root:GetChildAt(0)
                if ov and ov:IsValid() then
                    for i = 0, ov:GetChildrenCount() - 1 do local ch = ov:GetChildAt(i) if ch and ch:IsValid() then L(n .. "     " .. Op(ch)) end end
                end
                local under = root:GetChildAt(1)
                if under and under:IsValid() then L(n .. "   under " .. Op(under)) end
            end
        end)
    end
end
L("== probe 10 done, entries " .. n)
