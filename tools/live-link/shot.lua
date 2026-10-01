-- For the live link: a game screenshot with the HUD (lands in %LOCALAPPDATA%/RSDragonwilds/Saved/Screenshots/Windows).
-- Add a changed first line to run it again: the link runs live.lua only when its text changes.
local L = Live.Log
for _, P in pairs(FindAllOf("PlayerController") or {}) do
    local ok, mine = pcall(function() return P:IsValid() and P:IsLocalController() end)
    if ok and mine then
        StaticFindObject("/Script/Engine.Default__KismetSystemLibrary"):ExecuteConsoleCommand(P, "shot showui", P)
        L("shot taken " .. os.time())
        break
    end
end
