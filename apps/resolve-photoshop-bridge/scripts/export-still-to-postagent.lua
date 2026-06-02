--[[
  export-still-to-postagent.lua — DaVinci Resolve script

  Eksporterer aktiv timeline-still til ~/PostAgent/inbox/ med metadata
  så Post Agent kan plukke den opp og åpne i Photoshop.

  Hvordan kjøre:
    1. Last ned filen til ~/Library/Application Support/Blackmagic Design/
       DaVinci Resolve/Fusion/Scripts/Comp/  (eller Edit/)
    2. I Resolve: Workspace → Scripts → Comp/Edit → export-still-to-postagent
    3. Sjekk Post Agent: stillen vises i Inbox-listen

  Avhengigheter: ingen — bruker innebygd Resolve scripting API.

  Filnavn-konvensjon: <unix-time>_<clip-name>_<frame>.png
  Metadata-sidefil: <samme prefix>.json med { source, clip, frame, fps, project }
]]--

local function getInboxPath()
  local home = os.getenv("HOME")
  if not home then
    error("HOME-env mangler — kjør Resolve som vanlig bruker")
  end
  local dir = home .. "/PostAgent/inbox"
  -- mkdir -p
  os.execute(string.format("mkdir -p \"%s\"", dir))
  return dir
end

local function nowEpoch()
  return tostring(os.time())
end

local function escapeShell(s)
  return string.gsub(s, "[^%w%-_./]", "_")
end

local function exportStill()
  local resolve = Resolve()
  if not resolve then error("Resolve-API ikke tilgjengelig") end

  local pm = resolve:GetProjectManager()
  local project = pm:GetCurrentProject()
  if not project then error("Ingen aktivt prosjekt") end
  local projectName = project:GetName() or "Unknown"

  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end

  -- Bruk Resolve sin GallerySill-API: lagre still ved playhead → eksporter
  -- til disk → fjern fra galleri.
  local mediaPool = project:GetMediaPool()
  local gallery = project:GetGallery()
  local stillAlbum = gallery:GetCurrentStillAlbum()

  -- Gjør still ved playhead
  local stills = timeline:GrabStill()
  if not stills then error("Klarte ikke gjøre still ved playhead") end

  local inbox = getInboxPath()
  local epoch = nowEpoch()
  local clipName = escapeShell(projectName .. "_still")
  local fps = timeline:GetSetting("timelineFrameRate") or "24"
  local frame = timeline:GetCurrentTimecode() or "00:00:00:00"
  local pngPath = string.format("%s/%s_%s_%s.png", inbox, epoch, clipName, escapeShell(frame))
  local jsonPath = string.format("%s/%s_%s_%s.json", inbox, epoch, clipName, escapeShell(frame))

  -- ExportStills til PNG
  local exported = stillAlbum:ExportStills({ stills }, inbox, epoch .. "_" .. clipName, "png")
  if not exported then
    print("[Post Agent] Eksport feilet — sjekk DR-versjon")
    return
  end

  -- Skriv metadata-sidefil
  local f = io.open(jsonPath, "w")
  if f then
    f:write(string.format(
      '{"source":"davinci-resolve","clip":"%s","frame":"%s","fps":"%s","project":"%s","epoch":%s}',
      clipName, frame, fps, projectName, epoch
    ))
    f:close()
  end

  -- Rydd opp galleri-still
  stillAlbum:DeleteStills({ stills })

  print(string.format("[Post Agent] Eksportert still: %s", pngPath))
  print("[Post Agent] Åpne Post Agent → 'Resolve Inbox' for å fortsette i Photoshop")
end

local ok, err = pcall(exportStill)
if not ok then
  print("[Post Agent] FEIL: " .. tostring(err))
end
