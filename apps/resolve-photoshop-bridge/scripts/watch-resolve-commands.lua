--[[
  watch-resolve-commands.lua — Resolve scripting-API command-router

  Poller ~/PostAgent/resolve-commands/ for kommando-filer (JSON) skrevet
  av Post Agent's Photoshop-plugin. Dispatcher til riktig handler,
  skriver respons til ~/PostAgent/resolve-results/<id>.json.

  Dette er en GENERISK filsystem-bro: alt Resolve scripting-API kan
  utføres uten at Photoshop-plugin direkte kobler til Resolve. Hver
  kommando-fil har:
    { "id": "<uuid>", "name": "<command>", "args": { ... } }

  Respons:
    { "id": "<samme uuid>", "ok": true, "result": {...} }
    eller { "id": "<samme uuid>", "ok": false, "error": "<message>" }

  HVORDAN KJØRE:
    Workspace → Scripts → Edit → watch-resolve-commands
    Kjører til Resolve stoppes eller scriptet avbrytes manuelt.

  Initial handlers (V1):
    - quickExport.list      → list Quick Export render-presets
    - quickExport.run       → kjør Quick Export på current timeline
    - project.info          → returnerer project + timeline + folder-info
    - mediaPool.listItems   → list MediaPoolItems i current folder

  Fremtidige handlers (lett å legge til):
    - powerGrade.save/list
    - intellisearch.analyze (synkron variant)
    - timeline.* operasjoner
]]--

local POLL_INTERVAL_SEC = 1
local COMMANDS_DIR = (os.getenv("HOME") or "") .. "/PostAgent/resolve-commands"
local RESULTS_DIR = (os.getenv("HOME") or "") .. "/PostAgent/resolve-results"

local function listFiles(dir)
  local files = {}
  local p = io.popen('ls -1 "' .. dir .. '" 2>/dev/null')
  if not p then return files end
  for line in p:lines() do
    if line:match("%.json$") then
      table.insert(files, line)
    end
  end
  p:close()
  return files
end

local function readFile(path)
  local f = io.open(path, "r")
  if not f then return nil end
  local content = f:read("*a")
  f:close()
  return content
end

local function writeFile(path, content)
  local f = io.open(path, "w")
  if not f then return false end
  f:write(content)
  f:close()
  return true
end

local function jsonEscape(s)
  return string.format("%q", tostring(s or ""))
end

-- Minimal JSON-parser (kun for våre fixed-skjema kommandoer)
local function extractString(json, key)
  return json:match('"' .. key .. '"%s*:%s*"([^"]*)"')
end

local function extractObjectBlock(json, key)
  return json:match('"' .. key .. '"%s*:%s*({[^}]*})')
end

-- ---------------------------------------------------------------------------
-- Handlers
-- ---------------------------------------------------------------------------

local function getResolveContext()
  local resolve = Resolve()
  if not resolve then error("Resolve-API ikke tilgjengelig") end
  local pm = resolve:GetProjectManager()
  local project = pm:GetCurrentProject()
  if not project then error("Ingen aktivt prosjekt") end
  return resolve, project
end

local function handleQuickExportList(args)
  local _, project = getResolveContext()
  local presets = project:GetQuickExportRenderPresets() or {}
  local items = {}
  for _, name in ipairs(presets) do
    table.insert(items, jsonEscape(name))
  end
  return string.format('{"presets":[%s],"count":%d}', table.concat(items, ","), #items)
end

local function handleQuickExportRun(args)
  local _, project = getResolveContext()
  local presetName = extractString(args, "preset_name")
  if not presetName then error("preset_name mangler") end

  local paramsBlock = extractObjectBlock(args, "params")
  local params = {}
  if paramsBlock then
    local td = extractString(paramsBlock, "TargetDir")
    local cn = extractString(paramsBlock, "CustomName")
    local vq = extractString(paramsBlock, "VideoQuality")
    if td then params.TargetDir = td end
    if cn then params.CustomName = cn end
    if vq then params.VideoQuality = vq end
  end

  local result = project:RenderWithQuickExport(presetName, params)
  if not result then
    error("RenderWithQuickExport returnerte nil — sjekk preset-navn")
  end
  -- result er typisk en dict — vi serialiserer kjent felt
  local status = result.status or "started"
  local jobId = result.jobId or result.id or ""
  return string.format('{"preset":%s,"status":%s,"job_id":%s}',
    jsonEscape(presetName), jsonEscape(status), jsonEscape(jobId))
end

local function handleProjectInfo(args)
  local _, project = getResolveContext()
  local name = project:GetName() or ""
  local timeline = project:GetCurrentTimeline()
  local timelineName = timeline and (timeline:GetName() or "") or ""
  local timelineFps = timeline and (timeline:GetSetting("timelineFrameRate") or "") or ""
  local timelineTc = timeline and (timeline:GetCurrentTimecode() or "") or ""
  local mediaPool = project:GetMediaPool()
  local folder = mediaPool:GetCurrentFolder()
  local folderName = folder and (folder:GetName() or "") or ""
  return string.format(
    '{"project_name":%s,"timeline_name":%s,"timeline_fps":%s,"timeline_timecode":%s,"current_folder":%s}',
    jsonEscape(name), jsonEscape(timelineName), jsonEscape(timelineFps),
    jsonEscape(timelineTc), jsonEscape(folderName)
  )
end

local function handleMediaPoolListItems(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local folder = mediaPool:GetCurrentFolder()
  if not folder then error("Ingen aktiv folder") end
  local clips = folder:GetClipList() or {}
  local items = {}
  for _, clip in ipairs(clips) do
    local row = string.format(
      '{"id":%s,"clip_name":%s,"file_path":%s,"frames":%s,"fps":%s}',
      jsonEscape(clip:GetUniqueId() or ""),
      jsonEscape(clip:GetClipProperty("Clip Name") or ""),
      jsonEscape(clip:GetClipProperty("File Path") or ""),
      tostring(tonumber(clip:GetClipProperty("Frames")) or 0),
      tostring(tonumber(clip:GetClipProperty("FPS")) or 0)
    )
    table.insert(items, row)
  end
  return string.format('{"folder":%s,"items":[%s],"count":%d}',
    jsonEscape(folder:GetName() or ""), table.concat(items, ","), #items)
end

-- PowerGrade-handlere
local function getGallery(project)
  local g = project:GetGallery()
  if not g then error("Gallery ikke tilgjengelig — sjekk at Color-page er aktiv") end
  return g
end

local function handlePowerGradeList(args)
  local _, project = getResolveContext()
  local gallery = getGallery(project)
  local albums = gallery:GetGalleryPowerGradeAlbums() or {}
  local items = {}
  for _, album in ipairs(albums) do
    local name = gallery:GetAlbumName(album) or "(uten navn)"
    local stills = album:GetStills() or {}
    table.insert(items, string.format(
      '{"name":%s,"still_count":%d}',
      jsonEscape(name), #stills
    ))
  end
  return string.format('{"albums":[%s],"count":%d}', table.concat(items, ","), #items)
end

local function handlePowerGradeCreate(args)
  local _, project = getResolveContext()
  local gallery = getGallery(project)
  local name = extractString(args, "name")
  local album = gallery:CreateGalleryPowerGradeAlbum()
  if not album then error("CreateGalleryPowerGradeAlbum returnerte nil") end
  if name then
    gallery:SetAlbumName(album, name)
  end
  local finalName = gallery:GetAlbumName(album) or ""
  return string.format('{"created":true,"name":%s}', jsonEscape(finalName))
end

local function handlePowerGradeExport(args)
  local _, project = getResolveContext()
  local gallery = getGallery(project)
  local albumName = extractString(args, "album_name")
  local folderPath = extractString(args, "folder_path")
  local prefix = extractString(args, "prefix") or "postagent_grade"
  local format = extractString(args, "format") or "drx"
  if not albumName then error("album_name mangler") end
  if not folderPath then error("folder_path mangler") end

  local albums = gallery:GetGalleryPowerGradeAlbums() or {}
  local target = nil
  for _, album in ipairs(albums) do
    if gallery:GetAlbumName(album) == albumName then
      target = album
      break
    end
  end
  if not target then error("Fant ikke PowerGrade-album: " .. albumName) end

  local stills = target:GetStills() or {}
  if #stills == 0 then error("Album '" .. albumName .. "' har ingen stills") end

  os.execute(string.format("mkdir -p \"%s\"", folderPath))
  local ok = target:ExportStills(stills, folderPath, prefix, format)
  return string.format(
    '{"exported":%s,"album":%s,"folder":%s,"prefix":%s,"format":%s,"count":%d}',
    tostring(ok), jsonEscape(albumName), jsonEscape(folderPath),
    jsonEscape(prefix), jsonEscape(format), #stills
  )
end

-- ---------------------------------------------------------------------------
-- AI-handlere (Resolve 21 Scripting API)
-- ---------------------------------------------------------------------------

-- Finn MediaPoolItem ved unique-id (samme søk som intellisearch-script)
local function findMediaPoolItemById(mediaPool, targetId)
  local rootFolder = mediaPool:GetRootFolder()
  if not rootFolder then return nil end
  local function searchFolder(folder)
    local clips = folder:GetClipList()
    if clips then
      for _, clip in ipairs(clips) do
        if clip:GetUniqueId() == targetId then return clip end
      end
    end
    local subFolders = folder:GetSubFolderList()
    if subFolders then
      for _, sub in ipairs(subFolders) do
        local found = searchFolder(sub)
        if found then return found end
      end
    end
    return nil
  end
  return searchFolder(rootFolder)
end

-- audio.transcribe — transkriber audio på folder eller spesifikk item
local function handleAudioTranscribe(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local clipId = extractString(args, "clip_id")
  local useSpeakerDetection = args:match('"use_speaker_detection"%s*:%s*true') ~= nil

  local target, scope
  if clipId then
    target = findMediaPoolItemById(mediaPool, clipId)
    if not target then error("Fant ikke MediaPoolItem: " .. clipId) end
    scope = "item"
  else
    target = mediaPool:GetCurrentFolder()
    if not target then error("Ingen aktiv folder") end
    scope = "folder"
  end

  local ok = target:TranscribeAudio(useSpeakerDetection)
  return string.format(
    '{"scope":%s,"success":%s,"use_speaker_detection":%s}',
    jsonEscape(scope), tostring(ok), tostring(useSpeakerDetection)
  )
end

-- audio.classify — klassifiser audio på folder eller item
local function handleAudioClassify(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local clipId = extractString(args, "clip_id")

  local target, scope
  if clipId then
    target = findMediaPoolItemById(mediaPool, clipId)
    if not target then error("Fant ikke MediaPoolItem: " .. clipId) end
    scope = "item"
  else
    target = mediaPool:GetCurrentFolder()
    if not target then error("Ingen aktiv folder") end
    scope = "folder"
  end

  local ok = target:PerformAudioClassification()
  return string.format('{"scope":%s,"success":%s}', jsonEscape(scope), tostring(ok))
end

-- speech.generate — TTS som genererer MediaPoolItem
local function handleSpeechGenerate(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local text = extractString(args, "text")
  if not text then error("text mangler") end
  local timecode = extractString(args, "timecode") or "00:00:00:00"
  local voice = extractString(args, "voice")
  local addToTimeline = args:match('"add_to_timeline"%s*:%s*true') ~= nil
  local model = extractString(args, "model")

  local settings = { Text = text, AddToTimeline = addToTimeline }
  if voice then settings.Voice = voice end
  if model then settings.Model = model end

  local item = mediaPool:GenerateSpeech(settings, timecode)
  if not item then error("GenerateSpeech returnerte nil — sjekk at AI Speech Generator-modell er nedlastet") end
  return string.format(
    '{"clip_name":%s,"clip_id":%s,"timecode":%s,"added_to_timeline":%s}',
    jsonEscape(item:GetClipProperty("Clip Name") or ""),
    jsonEscape(item:GetUniqueId() or ""),
    jsonEscape(timecode),
    tostring(addToTimeline)
  )
end

-- slate.analyze — finn slates i clips, opprett markers
local function handleSlateAnalyze(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local clipId = extractString(args, "clip_id")
  local markerColor = extractString(args, "marker_color") or "Yellow"

  local target, scope
  if clipId then
    target = findMediaPoolItemById(mediaPool, clipId)
    if not target then error("Fant ikke MediaPoolItem: " .. clipId) end
    scope = "item"
  else
    target = mediaPool:GetCurrentFolder()
    if not target then error("Ingen aktiv folder") end
    scope = "folder"
  end

  local ok = target:AnalyzeForSlate(markerColor)
  return string.format(
    '{"scope":%s,"success":%s,"marker_color":%s}',
    jsonEscape(scope), tostring(ok), jsonEscape(markerColor)
  )
end

-- timeline.smartReframe — AI auto-reframe på aktiv timeline
local function handleTimelineSmartReframe(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local ok = timeline:SmartReframe()
  return string.format(
    '{"timeline":%s,"success":%s}',
    jsonEscape(timeline:GetName() or ""), tostring(ok)
  )
end

local HANDLERS = {
  ["quickExport.list"] = handleQuickExportList,
  ["quickExport.run"] = handleQuickExportRun,
  ["project.info"] = handleProjectInfo,
  ["mediaPool.listItems"] = handleMediaPoolListItems,
  ["powerGrade.list"] = handlePowerGradeList,
  ["powerGrade.create"] = handlePowerGradeCreate,
  ["powerGrade.export"] = handlePowerGradeExport,
  ["audio.transcribe"] = handleAudioTranscribe,
  ["audio.classify"] = handleAudioClassify,
  ["speech.generate"] = handleSpeechGenerate,
  ["slate.analyze"] = handleSlateAnalyze,
  ["timeline.smartReframe"] = handleTimelineSmartReframe,
}

-- ---------------------------------------------------------------------------
-- Main loop
-- ---------------------------------------------------------------------------

local function processCommand(fileName, archiveDir)
  local fullPath = COMMANDS_DIR .. "/" .. fileName
  local content = readFile(fullPath)
  if not content then return end

  local id = extractString(content, "id") or "unknown"
  local name = extractString(content, "name") or ""
  local argsBlock = extractObjectBlock(content, "args") or "{}"

  local handler = HANDLERS[name]
  local responseJson
  if not handler then
    responseJson = string.format(
      '{"id":%s,"ok":false,"error":%s}',
      jsonEscape(id), jsonEscape("Ukjent kommando: " .. name)
    )
  else
    local ok, result = pcall(handler, argsBlock)
    if ok then
      responseJson = string.format(
        '{"id":%s,"ok":true,"name":%s,"result":%s}',
        jsonEscape(id), jsonEscape(name), result or "null"
      )
    else
      responseJson = string.format(
        '{"id":%s,"ok":false,"error":%s}',
        jsonEscape(id), jsonEscape(tostring(result))
      )
    end
  end

  os.execute(string.format("mkdir -p \"%s\"", RESULTS_DIR))
  writeFile(RESULTS_DIR .. "/" .. id .. ".json", responseJson)
  os.execute(string.format("mv \"%s\" \"%s/\"", fullPath, archiveDir))
  print(string.format("[Resolve cmd-router] %s → %s", name, id))
end

local function watchLoop()
  os.execute(string.format("mkdir -p \"%s\" \"%s\"", COMMANDS_DIR, RESULTS_DIR))
  local archiveDir = COMMANDS_DIR .. "/.archive"
  os.execute(string.format("mkdir -p \"%s\"", archiveDir))

  print("[Resolve cmd-router] Aktiv. Lytter på " .. COMMANDS_DIR)
  print("[Resolve cmd-router] Handlers: quickExport.list, quickExport.run, project.info, mediaPool.listItems")
  print("[Resolve cmd-router] Stopp ved å lukke Resolve eller avbryt manuelt.")

  while true do
    local files = listFiles(COMMANDS_DIR)
    for _, f in ipairs(files) do
      processCommand(f, archiveDir)
    end
    os.execute("sleep " .. POLL_INTERVAL_SEC)
  end
end

local ok, err = pcall(watchLoop)
if not ok then
  print("[Resolve cmd-router] STOPPET: " .. tostring(err))
end
