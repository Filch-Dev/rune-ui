-- Live link for building Rune UI (made for 1.3, 01-10-2026). Every second, read live.lua next to Scripts; when its text
-- changes, run it once. live.lua can set Live.Step to run every second. Nothing else runs here: the old widget
-- search every second caused lag. Lines in UE4SS.log start with [Probe]. Kept in the repo
-- (tools/live-link) for the next version; copy RuneUIProbe into the game's Mods folder to use it.
local function Log(m) print("[Probe] " .. m .. "\n") end
Live = { Step = nil, Log = Log }
local LIVE = "ue4ss/Mods/RuneUIProbe/live.lua"
local liveText = nil
local function LiveStep()
    local f = io.open(LIVE, "r")
    if f then
        local t = f:read("*a") f:close()
        if t ~= liveText then
            liveText = t
            local fn, err = load(t, "live.lua")
            if not fn then Log("live: syntax error: " .. tostring(err))
            else
                local ok, e = pcall(fn)
                Log("live: ran, " .. (ok and "ok" or ("error: " .. tostring(e))))
            end
        end
    end
    if Live.Step then
        local ok, e = pcall(Live.Step)
        if not ok then Log("live step error, stopped: " .. tostring(e)) Live.Step = nil end
    end
end
ExecuteInGameThreadWithDelay(5000, function()
    Log("live link running")
    LoopInGameThreadWithDelay(1000, function() pcall(LiveStep) end)
end)
