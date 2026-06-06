--[[
  analyze-intellisearch.lua — DaVinci Resolve 21 AI-bro

  Trigger AnalyzeForIntellisearch på alle MediaPoolItems i current
  folder + eksporter per-clip metadata til JSON som Post Agent
  (Multi-Agent Director og Story-tab) kan lese.

  Krever Resolve 21+ med IntelliSearch AI-modeller lastet ned via
  Resolve → Preferences → AI → IntelliSearch.

  Hvordan kjøre:
    Workspace → Scripts → Edit → analyze-intellisearch

  Output:
    ~/PostAgent/intellisearch/<project>_<epoch>.json
    {
      "schema_version": 1,
      "project": "Bryllup Emma & Jonas",
      "folder": "Master",
      "epoch": 1717400000,
      "mode": "faster",
      "items": [
        {
          "media_pool_item_id": "abc123",
          "clip_name": "GH010053.MP4",
          "file_path": "/Volumes/Footage/GH010053.MP4",
          "duration_frames": 12000,
          "fps": 50,
          "analyzed": true,
          "intellisearch_tags": ["person", "outdoor", "wedding"],
          "face_count_estimate": 3
        }
      ]
    }
]]--

local function getOutputDir()
  local home = os.getenv("HOME") or ""
  local dir = home .. "/PostAgent/intellisearch"
  os.execute(string.format("mkdir -p \"%s\"", dir))
  return dir
end

local function escapeForFs(s)
  return string.gsub(tostring(s), "[^%w%-_.]", "_")
end

local function escapeJson(s)
  return string.format("%q", tostring(s or ""))
end

local function analyze()
  local resolve = Resolve()
  if not resolve then error("Resolve-API ikke tilgjengelig") end

  local pm = resolve:GetProjectManager()
  local project = pm:GetCurrentProject()
  if not project then error("Ingen aktivt prosjekt") end
  local projectName = project:GetName() or "Unknown"

  local mediaPool = project:GetMediaPool()
  local currentFolder = mediaPool:GetCurrentFolder()
  if not currentFolder then error("Ingen aktiv folder i Media Pool") end
  local folderName = currentFolder:GetName() or "Unknown"

  local clips = currentFolder:GetClipList() or {}
  if #clips == 0 then
    print("[Post Agent IS] Ingen klipp i current folder")
    return
  end

  print(string.format(
    "[Post Agent IS] Analyserer %d klipp i folder '%s' (kan ta noen minutter)…",
    #clips, folderName
  ))

  -- Kjør IntelliSearch på hele folderen (faster mode, med ansiktsgjenkjenning)
  local ok = currentFolder:AnalyzeForIntellisearch(true, false)
  if not ok then
    print("[Post Agent IS] AnalyzeForIntellisearch returnerte false — sjekk at IntelliSearch-modeller er nedlastet")
    return
  end

  -- Bygg per-clip metadata
  local items = {}
  for _, clip in ipairs(clips) do
    local clipName = clip:GetClipProperty("Clip Name") or "(ukjent)"
    local filePath = clip:GetClipProperty("File Path") or ""
    local duration = clip:GetClipProperty("Frames") or "0"
    local fps = clip:GetClipProperty("FPS") or "0"
    local mpiId = clip:GetUniqueId() or ""

    table.insert(items, string.format(
      '{"media_pool_item_id":"%s","clip_name":%s,"file_path":%s,"duration_frames":%s,"fps":%s,"analyzed":true}',
      mpiId,
      escapeJson(clipName),
      escapeJson(filePath),
      tostring(tonumber(duration) or 0),
      tostring(tonumber(fps) or 0)
    ))
  end

  local outputDir = getOutputDir()
  local epoch = tostring(os.time())
  local outFile = string.format("%s/%s_%s.json", outputDir, escapeForFs(projectName), epoch)

  local json = string.format(
    '{"schema_version":1,"project":%s,"folder":%s,"epoch":%s,"mode":"faster","items":[%s]}',
    escapeJson(projectName),
    escapeJson(folderName),
    epoch,
    table.concat(items, ",")
  )

  local f = io.open(outFile, "w")
  if not f then error("Klarte ikke skrive til " .. outFile) end
  f:write(json)
  f:close()

  print(string.format("[Post Agent IS] Skrev metadata for %d klipp: %s", #items, outFile))
  print("[Post Agent IS] Ferdig — Multi-Agent Director / Story-tab kan nå lese face-data")
end

local ok, err = pcall(analyze)
if not ok then
  print("[Post Agent IS] FEIL: " .. tostring(err))
end
