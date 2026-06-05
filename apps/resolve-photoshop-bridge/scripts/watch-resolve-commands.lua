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

-- Slate marker-farger fra README §"Analyze Slate Settings"
local SLATE_MARKER_COLORS = {
  Blue = true, Cyan = true, Green = true, Yellow = true, Red = true,
  Pink = true, Purple = true, Fuchsia = true, Rose = true, Lavender = true,
  Sky = true, Mint = true, Lemon = true, Sand = true, Cocoa = true, Cream = true,
}

-- slate.analyze — finn slates i clips, opprett markers
local function handleSlateAnalyze(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local clipId = extractString(args, "clip_id")
  local markerColor = extractString(args, "marker_color") or "Yellow"

  if not SLATE_MARKER_COLORS[markerColor] then
    error("Ugyldig marker_color: " .. markerColor ..
      " (gyldige: Blue, Cyan, Green, Yellow, Red, Pink, Purple, Fuchsia, " ..
      "Rose, Lavender, Sky, Mint, Lemon, Sand, Cocoa, Cream)")
  end

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

-- intellisearch.analyze — synkron trigger av AnalyzeForIntellisearch.
-- Bruk resolve.readIntellisearch (via analyze-intellisearch.lua-eksport)
-- for å lese resultatene.
local function handleIntellisearchAnalyze(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local clipId = extractString(args, "clip_id")
  local identifyFaces = args:match('"identify_faces"%s*:%s*true') ~= nil
  local isBetterMode = args:match('"better_mode"%s*:%s*true') ~= nil

  local target, scope, name
  if clipId then
    target = findMediaPoolItemById(mediaPool, clipId)
    if not target then error("Fant ikke MediaPoolItem: " .. clipId) end
    scope = "item"
    name = target:GetName() or ""
  else
    target = mediaPool:GetCurrentFolder()
    if not target then error("Ingen aktiv folder") end
    scope = "folder"
    name = target:GetName() or ""
  end

  local ok = target:AnalyzeForIntellisearch(identifyFaces, isBetterMode)
  return string.format(
    '{"scope":%s,"target":%s,"success":%s,"identify_faces":%s,"better_mode":%s}',
    jsonEscape(scope), jsonEscape(name), tostring(ok),
    tostring(identifyFaces), tostring(isBetterMode)
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

-- timeline.getCurrentItem — refs på currently selected video item
local function handleTimelineGetCurrentItem(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local item = timeline:GetCurrentVideoItem()
  if not item then return '{"found":false}' end
  local mpi = item:GetMediaPoolItem()
  return string.format(
    '{"found":true,"name":%s,"start_frame":%d,"end_frame":%d,"duration_frames":%d,"media_pool_item_id":%s,"clip_name":%s}',
    jsonEscape(item:GetName() or ""),
    item:GetStart() or 0,
    item:GetEnd() or 0,
    item:GetDuration() or 0,
    jsonEscape(mpi and (mpi:GetUniqueId() or "") or ""),
    jsonEscape(mpi and (mpi:GetClipProperty("Clip Name") or "") or "")
  )
end

-- magicMask.create — auto-mask av objekt på CURRENT video item.
-- mode: "F" forward, "B" backward, "BI" bidirectional. Krever
-- modeller nedlastet i Resolve → Preferences → AI.
local function handleMagicMaskCreate(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local item = timeline:GetCurrentVideoItem()
  if not item then error("Ingen valgt video-item — velg en klipp på timeline først") end
  local mode = extractString(args, "mode") or "BI"
  if mode ~= "F" and mode ~= "B" and mode ~= "BI" then
    error("mode må være F (forward), B (backward), eller BI (bidirectional)")
  end
  local ok = item:CreateMagicMask(mode)
  return string.format(
    '{"item_name":%s,"mode":%s,"success":%s}',
    jsonEscape(item:GetName() or ""), jsonEscape(mode), tostring(ok)
  )
end

-- magicMask.regenerate — re-trigger eksisterende mask på CURRENT item
local function handleMagicMaskRegenerate(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local item = timeline:GetCurrentVideoItem()
  if not item then error("Ingen valgt video-item") end
  local ok = item:RegenerateMagicMask()
  return string.format(
    '{"item_name":%s,"success":%s}',
    jsonEscape(item:GetName() or ""), tostring(ok)
  )
end

-- dolbyVision.analyze — kjør Dolby Vision-analyse på alle items eller current
local function handleDolbyVisionAnalyze(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  -- Tom liste = alle items. For V1 sender vi tom.
  local ok = timeline:AnalyzeDolbyVision({})
  return string.format(
    '{"timeline":%s,"success":%s,"scope":"all_items"}',
    jsonEscape(timeline:GetName() or ""), tostring(ok)
  )
end

-- ---------------------------------------------------------------------------
-- Render queue + markers + grade-distribusjon
-- ---------------------------------------------------------------------------

-- render.addJob — bruker CURRENT render settings (LoadRenderPreset først om
-- du vil spesifisere). Returnerer den unike job_id som kan brukes til start/delete.
local function handleRenderAddJob(args)
  local _, project = getResolveContext()
  local preset = extractString(args, "preset_name")
  if preset then
    local loaded = project:LoadRenderPreset(preset)
    if not loaded then error("LoadRenderPreset feilet for: " .. preset) end
  end
  -- Optional override av TargetDir/CustomName via SetRenderSettings
  local targetDir = extractString(args, "target_dir")
  local customName = extractString(args, "custom_name")
  if targetDir or customName then
    local settings = {}
    if targetDir then settings.TargetDir = targetDir end
    if customName then settings.CustomName = customName end
    project:SetRenderSettings(settings)
  end
  local jobId = project:AddRenderJob()
  if not jobId or jobId == "" then
    error("AddRenderJob returnerte tom job_id")
  end
  return string.format('{"job_id":%s,"preset":%s}',
    jsonEscape(jobId), jsonEscape(preset or "current"))
end

-- render.list — alle queued jobs med metadata
local function handleRenderList(args)
  local _, project = getResolveContext()
  local jobs = project:GetRenderJobList() or {}
  local items = {}
  for _, job in ipairs(jobs) do
    -- job er en dict. Bygger en JSON-friendly sub-objekt.
    local id = job.JobId or job["JobId"] or ""
    local timelineName = job.TimelineName or ""
    local renderStatus = job.RenderStatus or "pending"
    local outputFilename = job.OutputFilename or ""
    table.insert(items, string.format(
      '{"job_id":%s,"timeline_name":%s,"output_filename":%s,"status":%s}',
      jsonEscape(id), jsonEscape(timelineName),
      jsonEscape(outputFilename), jsonEscape(renderStatus)
    ))
  end
  return string.format('{"jobs":[%s],"count":%d}', table.concat(items, ","), #items)
end

-- render.start — start spesifikke jobs eller alle hvis ingen ID
local function handleRenderStart(args)
  local _, project = getResolveContext()
  local jobId = extractString(args, "job_id")
  local interactive = args:match('"interactive_mode"%s*:%s*true') ~= nil
  local ok
  if jobId then
    ok = project:StartRendering({ jobId }, interactive)
  else
    ok = project:StartRendering(interactive)
  end
  return string.format(
    '{"started":%s,"job_id":%s,"interactive_mode":%s}',
    tostring(ok), jsonEscape(jobId or "all"), tostring(interactive)
  )
end

-- render.stop — stopper alle aktive renderings
local function handleRenderStop(args)
  local _, project = getResolveContext()
  project:StopRendering()
  return '{"stopped":true}'
end

-- render.status — er render-pipelinen aktiv nå?
local function handleRenderStatus(args)
  local _, project = getResolveContext()
  local inProgress = project:IsRenderingInProgress()
  return string.format('{"in_progress":%s}', tostring(inProgress))
end

-- render.deleteJob — fjern queued job
local function handleRenderDeleteJob(args)
  local _, project = getResolveContext()
  local jobId = extractString(args, "job_id")
  if not jobId then error("job_id mangler") end
  local ok = project:DeleteRenderJob(jobId)
  return string.format('{"deleted":%s,"job_id":%s}', tostring(ok), jsonEscape(jobId))
end

-- markers.list — alle markers på current timeline
local function handleMarkersList(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local markers = timeline:GetMarkers() or {}
  local items = {}
  for frame, m in pairs(markers) do
    table.insert(items, string.format(
      '{"frame":%s,"color":%s,"name":%s,"note":%s,"duration":%s,"custom_data":%s}',
      tostring(frame),
      jsonEscape(m.color or ""),
      jsonEscape(m.name or ""),
      jsonEscape(m.note or ""),
      tostring(m.duration or 0),
      jsonEscape(m.customData or "")
    ))
  end
  return string.format('{"timeline":%s,"markers":[%s],"count":%d}',
    jsonEscape(timeline:GetName() or ""), table.concat(items, ","), #items)
end

-- markers.add — opprett ny marker på timeline
local function handleMarkersAdd(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local frame = tonumber(args:match('"frame"%s*:%s*(%d+)'))
  if not frame then error("frame mangler eller ugyldig") end
  local color = extractString(args, "color") or "Yellow"
  local name = extractString(args, "name") or ""
  local note = extractString(args, "note") or ""
  local duration = tonumber(args:match('"duration"%s*:%s*(%d+)')) or 1
  local customData = extractString(args, "custom_data") or ""
  local ok = timeline:AddMarker(frame, color, name, note, duration, customData)
  return string.format(
    '{"added":%s,"frame":%s,"color":%s,"name":%s}',
    tostring(ok), tostring(frame), jsonEscape(color), jsonEscape(name)
  )
end

-- markers.deleteByColor — slett alle markers av en farge ("All" for alle)
local function handleMarkersDeleteByColor(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local color = extractString(args, "color") or "All"
  local ok = timeline:DeleteMarkersByColor(color)
  return string.format('{"deleted":%s,"color":%s}', tostring(ok), jsonEscape(color))
end

-- grades.copyToItems — kopier current grade til alle items i timeline
local function handleGradesCopyToTimeline(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  -- Hent alle video-items
  local trackCount = timeline:GetTrackCount("video") or 0
  local targetItems = {}
  for trackIdx = 1, trackCount do
    local items = timeline:GetItemListInTrack("video", trackIdx) or {}
    for _, it in ipairs(items) do
      table.insert(targetItems, it)
    end
  end
  if #targetItems == 0 then error("Ingen video-items på timeline") end
  -- Bruk CURRENT item som kilde, CopyGrades på den
  local sourceItem = timeline:GetCurrentVideoItem()
  if not sourceItem then error("Ingen valgt source-item — velg en klipp med grade først") end
  local ok = sourceItem:CopyGrades(targetItems)
  return string.format(
    '{"copied":%s,"target_count":%d,"source_item":%s}',
    tostring(ok), #targetItems, jsonEscape(sourceItem:GetName() or "")
  )
end

-- grades.exportLUT — eksporter grade fra current item som .cube LUT-fil
local function handleGradesExportLUT(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local item = timeline:GetCurrentVideoItem()
  if not item then error("Ingen valgt video-item") end
  local path = extractString(args, "path")
  if not path then error("path mangler") end
  local exportTypeStr = extractString(args, "export_type") or "33Point"
  -- Resolve sin LUT-size enum: 17/33/65 point. Vi tar string og mapper.
  local exportTypeMap = {
    ["17Point"] = resolve.EXPORT_LUT_17PT_CUBE or 1,
    ["33Point"] = resolve.EXPORT_LUT_33PT_CUBE or 2,
    ["65Point"] = resolve.EXPORT_LUT_65PT_CUBE or 3,
  }
  local exportType = exportTypeMap[exportTypeStr] or exportTypeMap["33Point"]
  local ok = item:ExportLUT(exportType, path)
  return string.format(
    '{"exported":%s,"path":%s,"export_type":%s,"item":%s}',
    tostring(ok), jsonEscape(path), jsonEscape(exportTypeStr),
    jsonEscape(item:GetName() or "")
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
  ["intellisearch.analyze"] = handleIntellisearchAnalyze,
  ["timeline.smartReframe"] = handleTimelineSmartReframe,
  ["timeline.getCurrentItem"] = handleTimelineGetCurrentItem,
  ["magicMask.create"] = handleMagicMaskCreate,
  ["magicMask.regenerate"] = handleMagicMaskRegenerate,
  ["dolbyVision.analyze"] = handleDolbyVisionAnalyze,
  ["render.addJob"] = handleRenderAddJob,
  ["render.list"] = handleRenderList,
  ["render.start"] = handleRenderStart,
  ["render.stop"] = handleRenderStop,
  ["render.status"] = handleRenderStatus,
  ["render.deleteJob"] = handleRenderDeleteJob,
  ["markers.list"] = handleMarkersList,
  ["markers.add"] = handleMarkersAdd,
  ["markers.deleteByColor"] = handleMarkersDeleteByColor,
  ["grades.copyToTimeline"] = handleGradesCopyToTimeline,
  ["grades.exportLUT"] = handleGradesExportLUT,
}

-- ---------------------------------------------------------------------------
-- Subtitles + Track-management
-- ---------------------------------------------------------------------------

local function mapLanguageEnum(lang)
  if not lang then return resolve.AUTO_CAPTION_AUTO end
  local L = string.upper(lang)
  local map = {
    AUTO = resolve.AUTO_CAPTION_AUTO,
    DANISH = resolve.AUTO_CAPTION_DANISH,
    DUTCH = resolve.AUTO_CAPTION_DUTCH,
    ENGLISH = resolve.AUTO_CAPTION_ENGLISH,
    FRENCH = resolve.AUTO_CAPTION_FRENCH,
    GERMAN = resolve.AUTO_CAPTION_GERMAN,
    ITALIAN = resolve.AUTO_CAPTION_ITALIAN,
    JAPANESE = resolve.AUTO_CAPTION_JAPANESE,
    KOREAN = resolve.AUTO_CAPTION_KOREAN,
    MANDARIN_SIMPLIFIED = resolve.AUTO_CAPTION_MANDARIN_SIMPLIFIED,
    MANDARIN_TRADITIONAL = resolve.AUTO_CAPTION_MANDARIN_TRADITIONAL,
    NORWEGIAN = resolve.AUTO_CAPTION_NORWEGIAN,
    PORTUGUESE = resolve.AUTO_CAPTION_PORTUGUESE,
    RUSSIAN = resolve.AUTO_CAPTION_RUSSIAN,
    SPANISH = resolve.AUTO_CAPTION_SPANISH,
    SWEDISH = resolve.AUTO_CAPTION_SWEDISH,
  }
  return map[L] or resolve.AUTO_CAPTION_AUTO
end

local function mapCaptionPreset(preset)
  if not preset then return resolve.AUTO_CAPTION_SUBTITLE_DEFAULT end
  if string.upper(preset) == "NETFLIX" then return resolve.AUTO_CAPTION_NETFLIX end
  return resolve.AUTO_CAPTION_SUBTITLE_DEFAULT
end

local function mapLineBreak(lb)
  if not lb then return resolve.AUTO_CAPTION_LINE_SINGLE end
  if string.upper(lb) == "DOUBLE" then return resolve.AUTO_CAPTION_LINE_DOUBLE end
  return resolve.AUTO_CAPTION_LINE_SINGLE
end

local function handleSubtitlesCreateFromAudio(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end

  local language = extractString(args, "language")
  local preset = extractString(args, "preset")
  local charsPerLine = tonumber(args:match('"chars_per_line"%s*:%s*(%d+)'))
  local lineBreak = extractString(args, "line_break")
  local gap = tonumber(args:match('"gap"%s*:%s*(%d+)'))

  local settings = {
    [resolve.SUBTITLE_LANGUAGE] = mapLanguageEnum(language),
    [resolve.SUBTITLE_CAPTION_PRESET] = mapCaptionPreset(preset),
    [resolve.SUBTITLE_LINE_BREAK] = mapLineBreak(lineBreak),
  }
  if charsPerLine then settings[resolve.SUBTITLE_CHARS_PER_LINE] = charsPerLine end
  if gap then settings[resolve.SUBTITLE_GAP] = gap end

  local ok = timeline:CreateSubtitlesFromAudio(settings)
  return string.format(
    '{"created":%s,"timeline":%s,"language":%s,"preset":%s,"chars_per_line":%s,"line_break":%s,"gap":%s}',
    tostring(ok),
    jsonEscape(timeline:GetName() or ""),
    jsonEscape(language or "AUTO"),
    jsonEscape(preset or "DEFAULT"),
    tostring(charsPerLine or "default"),
    jsonEscape(lineBreak or "SINGLE"),
    tostring(gap or 0)
  )
end

local function handleTrackAdd(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local trackType = extractString(args, "track_type") or "video"
  if trackType ~= "video" and trackType ~= "audio" and trackType ~= "subtitle" then
    error("track_type må være 'video', 'audio' eller 'subtitle'")
  end
  local subTrackType = extractString(args, "sub_track_type")
  local ok = subTrackType
    and timeline:AddTrack(trackType, subTrackType)
    or timeline:AddTrack(trackType)
  return string.format(
    '{"added":%s,"track_type":%s,"sub_track_type":%s,"new_count":%d}',
    tostring(ok), jsonEscape(trackType),
    jsonEscape(subTrackType or "none"),
    timeline:GetTrackCount(trackType) or 0
  )
end

local function handleTrackDelete(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local trackType = extractString(args, "track_type")
  local index = tonumber(args:match('"index"%s*:%s*(%d+)'))
  if not trackType then error("track_type mangler") end
  if not index then error("index mangler") end
  local ok = timeline:DeleteTrack(trackType, index)
  return string.format(
    '{"deleted":%s,"track_type":%s,"index":%d}',
    tostring(ok), jsonEscape(trackType), index
  )
end

local function handleTrackGetName(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local trackType = extractString(args, "track_type")
  local index = tonumber(args:match('"index"%s*:%s*(%d+)'))
  if not trackType then error("track_type mangler") end
  if not index then error("index mangler") end
  local name = timeline:GetTrackName(trackType, index) or ""
  return string.format(
    '{"track_type":%s,"index":%d,"name":%s}',
    jsonEscape(trackType), index, jsonEscape(name)
  )
end

local function handleTrackSetName(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local trackType = extractString(args, "track_type")
  local index = tonumber(args:match('"index"%s*:%s*(%d+)'))
  local name = extractString(args, "name")
  if not trackType then error("track_type mangler") end
  if not index then error("index mangler") end
  if not name then error("name mangler") end
  local ok = timeline:SetTrackName(trackType, index, name)
  return string.format(
    '{"set":%s,"track_type":%s,"index":%d,"name":%s}',
    tostring(ok), jsonEscape(trackType), index, jsonEscape(name)
  )
end

HANDLERS["subtitles.createFromAudio"] = handleSubtitlesCreateFromAudio
HANDLERS["track.add"] = handleTrackAdd
HANDLERS["track.delete"] = handleTrackDelete
HANDLERS["track.getName"] = handleTrackGetName
HANDLERS["track.setName"] = handleTrackSetName

-- ---------------------------------------------------------------------------
-- Color page Graph + LUT-applikasjon
-- ---------------------------------------------------------------------------

local function getCurrentItemGraph()
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local item = timeline:GetCurrentVideoItem()
  if not item then error("Ingen valgt video-item — velg en klipp først") end
  -- TimelineItem fungerer som Graph i nyere Resolve-versjoner (GetNumNodes
  -- finnes direkte). Eldre versjoner krevde item:GetGraph() — vi prøver direkte.
  if not item.GetNumNodes then error("Color-graph-API ikke tilgjengelig på TimelineItem") end
  return item, item
end

local function handleLutRefresh(args)
  local _, project = getResolveContext()
  local ok = project:RefreshLUTList()
  return string.format('{"refreshed":%s}', tostring(ok))
end

local function handleGraphGetNodes(args)
  local item, graph = getCurrentItemGraph()
  local count = graph:GetNumNodes() or 0
  local nodes = {}
  for i = 1, count do
    local label = graph:GetNodeLabel(i) or ""
    local lut = graph:GetLUT(i) or ""
    local tools = graph:GetToolsInNode(i) or {}
    local toolItems = {}
    for _, t in ipairs(tools) do
      table.insert(toolItems, jsonEscape(t))
    end
    table.insert(nodes, string.format(
      '{"index":%d,"label":%s,"lut":%s,"tools":[%s]}',
      i, jsonEscape(label), jsonEscape(lut), table.concat(toolItems, ",")
    ))
  end
  return string.format(
    '{"item":%s,"num_nodes":%d,"nodes":[%s]}',
    jsonEscape(item:GetName() or ""), count, table.concat(nodes, ",")
  )
end

local function handleGraphApplyLUT(args)
  local item, graph = getCurrentItemGraph()
  local nodeIndex = tonumber(args:match('"node_index"%s*:%s*(%d+)'))
  local lutPath = extractString(args, "lut_path")
  if not nodeIndex then error("node_index mangler") end
  if not lutPath then error("lut_path mangler") end
  local ok = graph:SetLUT(nodeIndex, lutPath)
  return string.format(
    '{"applied":%s,"item":%s,"node_index":%d,"lut_path":%s}',
    tostring(ok), jsonEscape(item:GetName() or ""), nodeIndex, jsonEscape(lutPath)
  )
end

local function handleGraphApplyGradeFromDRX(args)
  local item, graph = getCurrentItemGraph()
  local path = extractString(args, "path")
  local gradeMode = tonumber(args:match('"grade_mode"%s*:%s*(%d+)')) or 0
  if not path then error("path mangler") end
  if gradeMode < 0 or gradeMode > 2 then
    error("grade_mode må være 0 (no keyframes), 1 (source TC aligned), 2 (start frame aligned)")
  end
  local ok = graph:ApplyGradeFromDRX(path, gradeMode)
  return string.format(
    '{"applied":%s,"item":%s,"path":%s,"grade_mode":%d}',
    tostring(ok), jsonEscape(item:GetName() or ""), jsonEscape(path), gradeMode
  )
end

local function handleGraphResetAllGrades(args)
  local item, graph = getCurrentItemGraph()
  local ok = graph:ResetAllGrades()
  return string.format(
    '{"reset":%s,"item":%s}',
    tostring(ok), jsonEscape(item:GetName() or "")
  )
end

local function handleGraphSetNodeEnabled(args)
  local item, graph = getCurrentItemGraph()
  local nodeIndex = tonumber(args:match('"node_index"%s*:%s*(%d+)'))
  local isEnabled = args:match('"enabled"%s*:%s*true') ~= nil
  if not nodeIndex then error("node_index mangler") end
  local ok = graph:SetNodeEnabled(nodeIndex, isEnabled)
  return string.format(
    '{"set":%s,"item":%s,"node_index":%d,"enabled":%s}',
    tostring(ok), jsonEscape(item:GetName() or ""), nodeIndex, tostring(isEnabled)
  )
end

HANDLERS["lut.refresh"] = handleLutRefresh
HANDLERS["graph.getNodes"] = handleGraphGetNodes
HANDLERS["graph.applyLUT"] = handleGraphApplyLUT
HANDLERS["graph.applyGradeFromDRX"] = handleGraphApplyGradeFromDRX
HANDLERS["graph.resetAllGrades"] = handleGraphResetAllGrades
HANDLERS["graph.setNodeEnabled"] = handleGraphSetNodeEnabled

-- ---------------------------------------------------------------------------
-- Voice Isolation + Gallery Import
-- ---------------------------------------------------------------------------

local function handleVoiceGetIsolation(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local trackIndex = tonumber(args:match('"track_index"%s*:%s*(%d+)'))
  local state, scope, ref
  if trackIndex then
    state = timeline:GetVoiceIsolationState(trackIndex)
    scope = "track"
    ref = tostring(trackIndex)
  else
    local item = timeline:GetCurrentVideoItem()
    if not item then error("Ingen valgt item — gi track_index eller velg item først") end
    state = item:GetVoiceIsolationState()
    scope = "item"
    ref = item:GetName() or ""
  end
  if not state then error("Klarte ikke lese isolation-state") end
  return string.format(
    '{"scope":%s,"ref":%s,"is_enabled":%s,"amount":%d}',
    jsonEscape(scope), jsonEscape(ref),
    tostring(state.isEnabled or false),
    tonumber(state.amount) or 0
  )
end

local function handleVoiceSetIsolation(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local trackIndex = tonumber(args:match('"track_index"%s*:%s*(%d+)'))
  local isEnabled = args:match('"is_enabled"%s*:%s*true') ~= nil
  local amount = tonumber(args:match('"amount"%s*:%s*(%d+)'))
  if amount == nil then error("amount mangler (0-100)") end
  if amount < 0 or amount > 100 then error("amount må være 0-100") end

  local state = { isEnabled = isEnabled, amount = amount }
  local ok, scope, ref
  if trackIndex then
    ok = timeline:SetVoiceIsolationState(trackIndex, state)
    scope = "track"
    ref = tostring(trackIndex)
  else
    local item = timeline:GetCurrentVideoItem()
    if not item then error("Ingen valgt item — gi track_index eller velg item først") end
    ok = item:SetVoiceIsolationState(state)
    scope = "item"
    ref = item:GetName() or ""
  end
  return string.format(
    '{"set":%s,"scope":%s,"ref":%s,"is_enabled":%s,"amount":%d}',
    tostring(ok), jsonEscape(scope), jsonEscape(ref),
    tostring(isEnabled), amount
  )
end

local function handleGalleryImportStills(args)
  local _, project = getResolveContext()
  local gallery = getGallery(project)
  local filePathsBlock = args:match('"file_paths"%s*:%s*(%b[])')
  if not filePathsBlock then error("file_paths mangler (array av paths)") end
  local files = {}
  for path in filePathsBlock:gmatch('"([^"]+)"') do
    table.insert(files, path)
  end
  if #files == 0 then error("file_paths er tom") end

  local albumName = extractString(args, "album_name")
  local targetAlbum
  if albumName then
    local stillAlbums = gallery:GetGalleryStillAlbums() or {}
    for _, album in ipairs(stillAlbums) do
      if gallery:GetAlbumName(album) == albumName then targetAlbum = album; break end
    end
    if not targetAlbum then
      local pgAlbums = gallery:GetGalleryPowerGradeAlbums() or {}
      for _, album in ipairs(pgAlbums) do
        if gallery:GetAlbumName(album) == albumName then targetAlbum = album; break end
      end
    end
    if not targetAlbum then error("Fant ikke album: " .. albumName) end
  else
    targetAlbum = gallery:GetCurrentStillAlbum()
    if not targetAlbum then error("Ingen current album") end
  end

  local ok = targetAlbum:ImportStills(files)
  return string.format(
    '{"imported":%s,"album":%s,"count":%d}',
    tostring(ok), jsonEscape(albumName or "current"), #files
  )
end

HANDLERS["voice.getIsolationState"] = handleVoiceGetIsolation
HANDLERS["voice.setIsolationState"] = handleVoiceSetIsolation
HANDLERS["gallery.importStills"] = handleGalleryImportStills

-- ---------------------------------------------------------------------------
-- Subtitle import (.srt / .ass / .vtt fra disk)
-- ---------------------------------------------------------------------------

local function handleSubtitleImport(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  if not mediaPool then error("Klarte ikke åpne Media Pool") end

  local filePath = extractString(args, "file_path")
  if not filePath or filePath == "" then error("file_path mangler") end
  local appendToTimeline = args:match('"append_to_timeline"%s*:%s*true') ~= nil

  local items = mediaPool:ImportMedia({ filePath })
  if not items or #items == 0 then
    error("ImportMedia returnerte ingen items (sjekk path + filtype: .srt/.ass/.vtt)")
  end
  local item = items[1]
  local name = item:GetName() or ""
  local clipId = item:GetMediaId() or ""

  local appended = false
  local timelineItemsAppended = 0
  if appendToTimeline then
    local appendedItems = mediaPool:AppendToTimeline({ item })
    if appendedItems then
      appended = true
      timelineItemsAppended = #appendedItems
    end
  end

  return string.format(
    '{"imported":true,"name":%s,"clip_id":%s,"path":%s,"appended":%s,"timeline_items":%d}',
    jsonEscape(name), jsonEscape(clipId), jsonEscape(filePath),
    tostring(appended), timelineItemsAppended
  )
end

HANDLERS["subtitle.importFromFile"] = handleSubtitleImport

-- ---------------------------------------------------------------------------
-- Project + Timeline GetSetting / SetSetting
-- ---------------------------------------------------------------------------

-- jsonValue — encode lua-value som JSON-string
local function jsonValue(v)
  local t = type(v)
  if t == "string" then return jsonEscape(v) end
  if t == "number" then return tostring(v) end
  if t == "boolean" then return tostring(v) end
  if v == nil then return "null" end
  return jsonEscape(tostring(v))
end

-- settingsTableToJson — { key = value, ... } → '{"k":"v",...}'
local function settingsTableToJson(tbl)
  if type(tbl) ~= "table" then
    return jsonValue(tbl)
  end
  local parts = {}
  for k, v in pairs(tbl) do
    table.insert(parts, jsonEscape(tostring(k)) .. ":" .. jsonValue(v))
  end
  return "{" .. table.concat(parts, ",") .. "}"
end

local function handleProjectGetSetting(args)
  local _, project = getResolveContext()
  local key = extractString(args, "key")
  if key and key ~= "" then
    local value = project:GetSetting(key)
    return string.format(
      '{"scope":"project","key":%s,"value":%s}',
      jsonEscape(key), jsonValue(value)
    )
  end
  local allSettings = project:GetSetting("")
  return string.format(
    '{"scope":"project","key":null,"value":%s}',
    settingsTableToJson(allSettings)
  )
end

local function handleProjectSetSetting(args)
  local _, project = getResolveContext()
  local key = extractString(args, "key")
  if not key or key == "" then error("key mangler") end
  local value = extractString(args, "value")
  if value == nil then error("value mangler (må være string)") end
  local ok = project:SetSetting(key, value)
  return string.format(
    '{"scope":"project","set":%s,"key":%s,"value":%s}',
    tostring(ok), jsonEscape(key), jsonEscape(value)
  )
end

local function handleTimelineGetSetting(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local key = extractString(args, "key")
  if key and key ~= "" then
    local value = timeline:GetSetting(key)
    return string.format(
      '{"scope":"timeline","timeline":%s,"key":%s,"value":%s}',
      jsonEscape(timeline:GetName() or ""), jsonEscape(key), jsonValue(value)
    )
  end
  local allSettings = timeline:GetSetting("")
  return string.format(
    '{"scope":"timeline","timeline":%s,"key":null,"value":%s}',
    jsonEscape(timeline:GetName() or ""), settingsTableToJson(allSettings)
  )
end

local function handleTimelineSetSetting(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local key = extractString(args, "key")
  if not key or key == "" then error("key mangler") end
  local value = extractString(args, "value")
  if value == nil then error("value mangler (må være string)") end
  local ok = timeline:SetSetting(key, value)
  return string.format(
    '{"scope":"timeline","set":%s,"key":%s,"value":%s}',
    tostring(ok), jsonEscape(key), jsonEscape(value)
  )
end

HANDLERS["project.getSetting"] = handleProjectGetSetting
HANDLERS["project.setSetting"] = handleProjectSetSetting
HANDLERS["timeline.getSetting"] = handleTimelineGetSetting
HANDLERS["timeline.setSetting"] = handleTimelineSetSetting

-- ---------------------------------------------------------------------------
-- Page navigation + Clip-property
-- ---------------------------------------------------------------------------

local RESOLVE_PAGES = {
  media = true, cut = true, edit = true, fusion = true,
  color = true, fairlight = true, deliver = true,
}

local function handlePageOpen(args)
  local resolve, _ = getResolveContext()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  if not RESOLVE_PAGES[name] then
    error("Ugyldig page-name: " .. name ..
      " (gyldige: media, cut, edit, fusion, color, fairlight, deliver)")
  end
  local ok = resolve:OpenPage(name)
  return string.format(
    '{"opened":%s,"page":%s}',
    tostring(ok), jsonEscape(name)
  )
end

local function handlePageCurrent(_args)
  local resolve, _ = getResolveContext()
  local current = resolve:GetCurrentPage()
  if current == nil then
    return '{"page":null}'
  end
  return string.format('{"page":%s}', jsonEscape(current))
end

local function handleClipGetProperty(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local clipId = extractString(args, "clip_id")
  if not clipId or clipId == "" then error("clip_id mangler") end
  local item = findMediaPoolItemById(mediaPool, clipId)
  if not item then error("Fant ikke MediaPoolItem: " .. clipId) end

  local key = extractString(args, "key")
  if key and key ~= "" then
    local value = item:GetClipProperty(key)
    return string.format(
      '{"clip_id":%s,"key":%s,"value":%s}',
      jsonEscape(clipId), jsonEscape(key), jsonValue(value)
    )
  end
  local all = item:GetClipProperty("")
  return string.format(
    '{"clip_id":%s,"key":null,"value":%s}',
    jsonEscape(clipId), settingsTableToJson(all)
  )
end

local function handleClipSetProperty(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local clipId = extractString(args, "clip_id")
  if not clipId or clipId == "" then error("clip_id mangler") end
  local item = findMediaPoolItemById(mediaPool, clipId)
  if not item then error("Fant ikke MediaPoolItem: " .. clipId) end

  local key = extractString(args, "key")
  if not key or key == "" then error("key mangler") end
  local value = extractString(args, "value")
  if value == nil then error("value mangler (må være string)") end

  local ok = item:SetClipProperty(key, value)
  return string.format(
    '{"set":%s,"clip_id":%s,"key":%s,"value":%s}',
    tostring(ok), jsonEscape(clipId), jsonEscape(key), jsonEscape(value)
  )
end

HANDLERS["page.open"] = handlePageOpen
HANDLERS["page.current"] = handlePageCurrent
HANDLERS["clip.getProperty"] = handleClipGetProperty
HANDLERS["clip.setProperty"] = handleClipSetProperty

-- ---------------------------------------------------------------------------
-- Timecode + Track-items + Clip-color labels
-- ---------------------------------------------------------------------------

-- Resolve clip-color palette (per MediaPoolItem.SetClipColor + TimelineItem.SetClipColor)
local RESOLVE_CLIP_COLORS = {
  Orange = true, Apricot = true, Yellow = true, Lime = true, Olive = true,
  Green = true, Teal = true, Navy = true, Blue = true, Purple = true,
  Violet = true, Pink = true, Tan = true, Beige = true, Brown = true,
  Chocolate = true,
}

local TRACK_TYPES = { video = true, audio = true, subtitle = true }

local function handleTimelineGetTimecode(_args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local tc = timeline:GetCurrentTimecode()
  if not tc then error("Timecode utilgjengelig — bytt til Cut/Edit/Color/Fairlight/Deliver-page") end
  return string.format(
    '{"timeline":%s,"timecode":%s}',
    jsonEscape(timeline:GetName() or ""), jsonEscape(tc)
  )
end

local function handleTimelineSetTimecode(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local tc = extractString(args, "timecode")
  if not tc or tc == "" then error("timecode mangler (format HH:MM:SS:FF)") end
  local ok = timeline:SetCurrentTimecode(tc)
  return string.format(
    '{"set":%s,"timeline":%s,"timecode":%s}',
    tostring(ok), jsonEscape(timeline:GetName() or ""), jsonEscape(tc)
  )
end

local function handleTimelineGetItemListInTrack(args)
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local trackType = extractString(args, "track_type") or "video"
  if not TRACK_TYPES[trackType] then
    error("Ugyldig track_type: " .. trackType .. " (video/audio/subtitle)")
  end
  local idx = tonumber(args:match('"track_index"%s*:%s*(%d+)'))
  if not idx then error("track_index mangler") end

  local items = timeline:GetItemListInTrack(trackType, idx)
  if not items then
    return string.format(
      '{"track_type":%s,"track_index":%d,"items":[]}',
      jsonEscape(trackType), idx
    )
  end
  local parts = {}
  for _, item in ipairs(items) do
    local name = item:GetName() or ""
    local startFr = item:GetStart() or 0
    local endFr = item:GetEnd() or 0
    local duration = item:GetDuration() or 0
    table.insert(parts, string.format(
      '{"name":%s,"start":%d,"end":%d,"duration":%d}',
      jsonEscape(name), startFr, endFr, duration
    ))
  end
  return string.format(
    '{"track_type":%s,"track_index":%d,"count":%d,"items":[%s]}',
    jsonEscape(trackType), idx, #items, table.concat(parts, ",")
  )
end

local function resolveClipColorTarget(args)
  local _, project = getResolveContext()
  local clipId = extractString(args, "clip_id")
  if clipId then
    local mediaPool = project:GetMediaPool()
    local item = findMediaPoolItemById(mediaPool, clipId)
    if not item then error("Fant ikke MediaPoolItem: " .. clipId) end
    return item, "media_pool_item", item:GetName() or ""
  end
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline (eller gi clip_id)") end
  local item = timeline:GetCurrentVideoItem()
  if not item then error("Ingen valgt timeline-item (eller gi clip_id)") end
  return item, "timeline_item", item:GetName() or ""
end

local function handleClipGetColor(args)
  local item, scope, name = resolveClipColorTarget(args)
  local color = item:GetClipColor() or ""
  return string.format(
    '{"scope":%s,"name":%s,"color":%s}',
    jsonEscape(scope), jsonEscape(name), jsonEscape(color)
  )
end

local function handleClipSetColor(args)
  local color = extractString(args, "color")
  if not color or color == "" then error("color mangler") end
  if not RESOLVE_CLIP_COLORS[color] then
    error("Ugyldig color: " .. color ..
      " (gyldige: Orange, Apricot, Yellow, Lime, Olive, Green, Teal, Navy, " ..
      "Blue, Purple, Violet, Pink, Tan, Beige, Brown, Chocolate)")
  end
  local item, scope, name = resolveClipColorTarget(args)
  local ok = item:SetClipColor(color)
  return string.format(
    '{"set":%s,"scope":%s,"name":%s,"color":%s}',
    tostring(ok), jsonEscape(scope), jsonEscape(name), jsonEscape(color)
  )
end

local function handleClipClearColor(args)
  local item, scope, name = resolveClipColorTarget(args)
  local ok = item:ClearClipColor()
  return string.format(
    '{"cleared":%s,"scope":%s,"name":%s}',
    tostring(ok), jsonEscape(scope), jsonEscape(name)
  )
end

HANDLERS["timeline.getCurrentTimecode"] = handleTimelineGetTimecode
HANDLERS["timeline.setCurrentTimecode"] = handleTimelineSetTimecode
HANDLERS["timeline.getItemListInTrack"] = handleTimelineGetItemListInTrack
HANDLERS["clip.getColor"] = handleClipGetColor
HANDLERS["clip.setColor"] = handleClipSetColor
HANDLERS["clip.clearColor"] = handleClipClearColor

-- ---------------------------------------------------------------------------
-- Clip markers (MediaPoolItem) + Color versions (TimelineItem)
-- ---------------------------------------------------------------------------

local MARKER_COLORS = {
  Blue = true, Cyan = true, Green = true, Yellow = true, Red = true,
  Pink = true, Purple = true, Fuchsia = true, Rose = true, Lavender = true,
  Sky = true, Mint = true, Lemon = true, Sand = true, Cocoa = true, Cream = true,
}

local function markersToJson(markers)
  if type(markers) ~= "table" then return "{}" end
  local parts = {}
  for frameId, info in pairs(markers) do
    table.insert(parts, string.format(
      '%s:{"color":%s,"name":%s,"note":%s,"duration":%d,"customData":%s}',
      jsonEscape(tostring(frameId)),
      jsonEscape(info.color or ""),
      jsonEscape(info.name or ""),
      jsonEscape(info.note or ""),
      tonumber(info.duration) or 0,
      jsonEscape(info.customData or "")
    ))
  end
  return "{" .. table.concat(parts, ",") .. "}"
end

local function resolveMediaPoolItem(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local clipId = extractString(args, "clip_id")
  if not clipId or clipId == "" then error("clip_id mangler") end
  local item = findMediaPoolItemById(mediaPool, clipId)
  if not item then error("Fant ikke MediaPoolItem: " .. clipId) end
  return item, clipId
end

local function handleClipMarkersList(args)
  local item, clipId = resolveMediaPoolItem(args)
  local markers = item:GetMarkers() or {}
  return string.format(
    '{"clip_id":%s,"markers":%s}',
    jsonEscape(clipId), markersToJson(markers)
  )
end

local function handleClipMarkersAdd(args)
  local item, clipId = resolveMediaPoolItem(args)
  local frameId = tonumber(args:match('"frame_id"%s*:%s*(%d+)'))
  if not frameId then error("frame_id mangler") end
  local color = extractString(args, "color") or "Blue"
  if not MARKER_COLORS[color] then
    error("Ugyldig color: " .. color ..
      " (Blue/Cyan/Green/Yellow/Red/Pink/Purple/Fuchsia/Rose/Lavender/Sky/Mint/Lemon/Sand/Cocoa/Cream)")
  end
  local name = extractString(args, "name") or ""
  local note = extractString(args, "note") or ""
  local duration = tonumber(args:match('"duration"%s*:%s*(%d+)')) or 1
  local customData = extractString(args, "custom_data") or ""
  local ok = item:AddMarker(frameId, color, name, note, duration, customData)
  return string.format(
    '{"added":%s,"clip_id":%s,"frame_id":%d,"color":%s,"name":%s}',
    tostring(ok), jsonEscape(clipId), frameId, jsonEscape(color), jsonEscape(name)
  )
end

local function handleClipMarkersDeleteByColor(args)
  local item, clipId = resolveMediaPoolItem(args)
  local color = extractString(args, "color")
  if not color or color == "" then error("color mangler (eller 'All')") end
  if color ~= "All" and not MARKER_COLORS[color] then
    error("Ugyldig color: " .. color .. " (eller 'All')")
  end
  local ok = item:DeleteMarkersByColor(color)
  return string.format(
    '{"deleted":%s,"clip_id":%s,"color":%s}',
    tostring(ok), jsonEscape(clipId), jsonEscape(color)
  )
end

local function handleClipMarkersDeleteAtFrame(args)
  local item, clipId = resolveMediaPoolItem(args)
  local frameId = tonumber(args:match('"frame_id"%s*:%s*(%d+)'))
  if not frameId then error("frame_id mangler") end
  local ok = item:DeleteMarkerAtFrame(frameId)
  return string.format(
    '{"deleted":%s,"clip_id":%s,"frame_id":%d}',
    tostring(ok), jsonEscape(clipId), frameId
  )
end

-- Color versions — on currently selected timeline item
local function currentTimelineItem()
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local item = timeline:GetCurrentVideoItem()
  if not item then error("Ingen valgt timeline-item") end
  return item
end

local function parseVersionType(args)
  local vt = tonumber(args:match('"version_type"%s*:%s*(%d+)'))
  if vt == nil then return 0 end -- default local
  if vt ~= 0 and vt ~= 1 then
    error("version_type må være 0 (local) eller 1 (remote)")
  end
  return vt
end

local function handleVersionAdd(args)
  local item = currentTimelineItem()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local versionType = parseVersionType(args)
  local ok = item:AddVersion(name, versionType)
  return string.format(
    '{"added":%s,"name":%s,"version_type":%d}',
    tostring(ok), jsonEscape(name), versionType
  )
end

local function handleVersionGetCurrent(_args)
  local item = currentTimelineItem()
  local current = item:GetCurrentVersion()
  if not current then return '{"current":null}' end
  local name = current.versionName or ""
  local versionType = tonumber(current.versionType) or 0
  return string.format(
    '{"current":{"name":%s,"version_type":%d}}',
    jsonEscape(name), versionType
  )
end

local function handleVersionGetNames(args)
  local item = currentTimelineItem()
  local versionType = parseVersionType(args)
  local names = item:GetVersionNames(versionType) or {}
  local parts = {}
  for _, n in ipairs(names) do
    table.insert(parts, jsonEscape(n))
  end
  return string.format(
    '{"version_type":%d,"names":[%s]}',
    versionType, table.concat(parts, ",")
  )
end

local function handleVersionLoad(args)
  local item = currentTimelineItem()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local versionType = parseVersionType(args)
  local ok = item:LoadVersionByName(name, versionType)
  return string.format(
    '{"loaded":%s,"name":%s,"version_type":%d}',
    tostring(ok), jsonEscape(name), versionType
  )
end

local function handleVersionRename(args)
  local item = currentTimelineItem()
  local oldName = extractString(args, "old_name")
  if not oldName or oldName == "" then error("old_name mangler") end
  local newName = extractString(args, "new_name")
  if not newName or newName == "" then error("new_name mangler") end
  local versionType = parseVersionType(args)
  local ok = item:RenameVersionByName(oldName, newName, versionType)
  return string.format(
    '{"renamed":%s,"old_name":%s,"new_name":%s,"version_type":%d}',
    tostring(ok), jsonEscape(oldName), jsonEscape(newName), versionType
  )
end

local function handleVersionDelete(args)
  local item = currentTimelineItem()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local versionType = parseVersionType(args)
  local ok = item:DeleteVersionByName(name, versionType)
  return string.format(
    '{"deleted":%s,"name":%s,"version_type":%d}',
    tostring(ok), jsonEscape(name), versionType
  )
end

HANDLERS["clip.markersList"] = handleClipMarkersList
HANDLERS["clip.markersAdd"] = handleClipMarkersAdd
HANDLERS["clip.markersDeleteByColor"] = handleClipMarkersDeleteByColor
HANDLERS["clip.markersDeleteAtFrame"] = handleClipMarkersDeleteAtFrame
HANDLERS["version.add"] = handleVersionAdd
HANDLERS["version.getCurrent"] = handleVersionGetCurrent
HANDLERS["version.getNames"] = handleVersionGetNames
HANDLERS["version.load"] = handleVersionLoad
HANDLERS["version.rename"] = handleVersionRename
HANDLERS["version.delete"] = handleVersionDelete

-- ---------------------------------------------------------------------------
-- MediaPool folder-management
-- ---------------------------------------------------------------------------

-- Finn folder ved path "Master/Wedding/Day 1".  Tom string eller "Master"
-- returnerer root. Tar bare hensyn til segment-navn (case-sensitivt) — hvis
-- to undermapper deler navn vinner første.
local function findFolderByPath(rootFolder, path)
  if not path or path == "" or path == "Master" or path == "/" then
    return rootFolder
  end
  local parts = {}
  for p in path:gmatch("[^/]+") do table.insert(parts, p) end
  local startIdx = 1
  local rootName = rootFolder:GetName() or "Master"
  if parts[1] == "Master" or parts[1] == rootName then
    startIdx = 2
  end
  local current = rootFolder
  for i = startIdx, #parts do
    local subs = current:GetSubFolderList() or {}
    local found
    for _, f in ipairs(subs) do
      if f:GetName() == parts[i] then found = f; break end
    end
    if not found then
      error("Fant ikke folder-segment '" .. parts[i] .. "' i path '" .. path .. "'")
    end
    current = found
  end
  return current
end

local function walkFolderTree(folder, parentPath, list)
  local name = folder:GetName() or "Master"
  local myPath
  if parentPath == "" then
    myPath = name
  else
    myPath = parentPath .. "/" .. name
  end
  local clips = folder:GetClipList() or {}
  local subs = folder:GetSubFolderList() or {}
  table.insert(list, string.format(
    '{"path":%s,"name":%s,"clip_count":%d,"subfolder_count":%d}',
    jsonEscape(myPath), jsonEscape(name), #clips, #subs
  ))
  for _, sub in ipairs(subs) do
    walkFolderTree(sub, myPath, list)
  end
end

local function handleFolderListAll(_args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local root = mediaPool:GetRootFolder()
  if not root then error("Klarte ikke åpne root folder") end
  local list = {}
  walkFolderTree(root, "", list)
  return string.format(
    '{"count":%d,"folders":[%s]}',
    #list, table.concat(list, ",")
  )
end

local function handleFolderGetCurrent(_args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local current = mediaPool:GetCurrentFolder()
  if not current then return '{"path":null,"name":null}' end
  local name = current:GetName() or ""
  -- Beste-effort path: vi vandrer fra root og finner currents match.
  local root = mediaPool:GetRootFolder()
  local list = {}
  walkFolderTree(root, "", list)
  -- Vi har ikke handle-equality cross-call, så vi best-effort via name.
  return string.format(
    '{"name":%s,"clip_count":%d,"subfolder_count":%d}',
    jsonEscape(name),
    #(current:GetClipList() or {}),
    #(current:GetSubFolderList() or {})
  )
end

local function handleFolderSetCurrent(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local root = mediaPool:GetRootFolder()
  local path = extractString(args, "path")
  if not path or path == "" then error("path mangler") end
  local target = findFolderByPath(root, path)
  if not target then error("Fant ikke folder: " .. path) end
  local ok = mediaPool:SetCurrentFolder(target)
  return string.format(
    '{"set":%s,"path":%s,"name":%s}',
    tostring(ok), jsonEscape(path), jsonEscape(target:GetName() or "")
  )
end

local function handleFolderCreate(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local root = mediaPool:GetRootFolder()
  local parentPath = extractString(args, "parent_path") or ""
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local parent = findFolderByPath(root, parentPath)
  if not parent then error("Fant ikke parent folder: " .. parentPath) end
  local newFolder = mediaPool:AddSubFolder(parent, name)
  if not newFolder then error("AddSubFolder returnerte nil (kanskje duplikat-navn?)") end
  local parentName = parent:GetName() or "Master"
  local newPath
  if parentPath == "" or parentPath == "Master" then
    newPath = parentName .. "/" .. name
  else
    newPath = parentPath .. "/" .. name
  end
  return string.format(
    '{"created":true,"path":%s,"name":%s,"parent_path":%s}',
    jsonEscape(newPath), jsonEscape(name), jsonEscape(parentPath)
  )
end

local function handleFolderMoveClips(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local root = mediaPool:GetRootFolder()
  local targetPath = extractString(args, "target_path")
  if not targetPath or targetPath == "" then error("target_path mangler") end
  local target = findFolderByPath(root, targetPath)
  if not target then error("Fant ikke target folder: " .. targetPath) end

  -- clip_ids er array av MediaPoolItem unique-IDs (samme som vi bruker
  -- ellers via findMediaPoolItemById).
  local clipIdsBlock = args:match('"clip_ids"%s*:%s*(%b[])')
  if not clipIdsBlock then error("clip_ids mangler (array av strings)") end
  local clips = {}
  local ids = {}
  for id in clipIdsBlock:gmatch('"([^"]+)"') do
    local item = findMediaPoolItemById(mediaPool, id)
    if not item then error("Fant ikke MediaPoolItem: " .. id) end
    table.insert(clips, item)
    table.insert(ids, id)
  end
  if #clips == 0 then error("clip_ids er tom") end

  local ok = mediaPool:MoveClips(clips, target)
  return string.format(
    '{"moved":%s,"count":%d,"target_path":%s}',
    tostring(ok), #clips, jsonEscape(targetPath)
  )
end

HANDLERS["folder.listAll"] = handleFolderListAll
HANDLERS["folder.getCurrent"] = handleFolderGetCurrent
HANDLERS["folder.setCurrent"] = handleFolderSetCurrent
HANDLERS["folder.create"] = handleFolderCreate
HANDLERS["folder.moveClips"] = handleFolderMoveClips

-- ---------------------------------------------------------------------------
-- ProjectManager (database-folders + project CRUD)
-- ---------------------------------------------------------------------------

-- ProjectManager-folders er DATABASE-folders (ulik Media Pool-folders).
-- pm:GotoRootFolder, GotoParentFolder, OpenFolder navigerer PM-tre;
-- vi har ingen vei tilbake til en spesifikk path uten å resolve sti
-- via gjentatte OpenFolder-call. Holder API enkelt: getInfo gir
-- snapshot, navigateFolder bytter context.

local function getPM()
  local resolve = Resolve()
  if not resolve then error("Resolve-API ikke tilgjengelig") end
  local pm = resolve:GetProjectManager()
  if not pm then error("ProjectManager utilgjengelig") end
  return pm
end

local function jsonArrayOfStrings(arr)
  if type(arr) ~= "table" then return "[]" end
  local parts = {}
  for _, s in ipairs(arr) do
    table.insert(parts, jsonEscape(tostring(s)))
  end
  return "[" .. table.concat(parts, ",") .. "]"
end

-- pm.getInfo — snapshot av currently loaded prosjekt + current PM folder
-- + projects og subfolders i denne folderen. Én call for hele state.
local function handlePmGetInfo(_args)
  local pm = getPM()
  local current = pm:GetCurrentProject()
  local currentName = current and current:GetName() or ""
  local folderName = pm:GetCurrentFolder() or ""
  local projects = pm:GetProjectListInCurrentFolder() or {}
  -- GetFolderListInCurrentFolder finnes i nyere API; vi sjekker
  -- defensivt om den finnes for kompat.
  local folders = {}
  if pm.GetFolderListInCurrentFolder then
    folders = pm:GetFolderListInCurrentFolder() or {}
  end
  return string.format(
    '{"current_project":%s,"current_folder":%s,"projects":%s,"subfolders":%s}',
    jsonEscape(currentName), jsonEscape(folderName),
    jsonArrayOfStrings(projects), jsonArrayOfStrings(folders)
  )
end

local function handlePmCreateProject(args)
  local pm = getPM()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local mediaPath = extractString(args, "media_path")
  local project
  if mediaPath and mediaPath ~= "" then
    project = pm:CreateProject(name, mediaPath)
  else
    project = pm:CreateProject(name)
  end
  if not project then
    error("CreateProject returnerte nil (kanskje duplikat-navn i current folder?)")
  end
  return string.format(
    '{"created":true,"name":%s,"media_path":%s}',
    jsonEscape(name), jsonEscape(mediaPath or "")
  )
end

local function handlePmLoadProject(args)
  local pm = getPM()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local project = pm:LoadProject(name)
  if not project then error("LoadProject feilet — fant ikke '" .. name .. "' i current PM folder") end
  return string.format(
    '{"loaded":true,"name":%s}',
    jsonEscape(name)
  )
end

local function handlePmSaveProject(_args)
  local pm = getPM()
  local current = pm:GetCurrentProject()
  if not current then error("Ingen aktivt prosjekt å lagre") end
  local ok = pm:SaveProject()
  return string.format(
    '{"saved":%s,"name":%s}',
    tostring(ok), jsonEscape(current:GetName() or "")
  )
end

local function handlePmDeleteProject(args)
  local pm = getPM()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local ok = pm:DeleteProject(name)
  return string.format(
    '{"deleted":%s,"name":%s}',
    tostring(ok), jsonEscape(name)
  )
end

local function handlePmCreateFolder(args)
  local pm = getPM()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local ok = pm:CreateFolder(name)
  return string.format(
    '{"created":%s,"name":%s}',
    tostring(ok), jsonEscape(name)
  )
end

-- pm.navigateFolder({to: "root" | "parent" | folder_name})
local function handlePmNavigateFolder(args)
  local pm = getPM()
  local to = extractString(args, "to")
  if not to or to == "" then error("to mangler ('root', 'parent', eller folder-navn)") end
  local ok
  local op
  if to == "root" then
    ok = pm:GotoRootFolder()
    op = "root"
  elseif to == "parent" then
    ok = pm:GotoParentFolder()
    op = "parent"
  else
    ok = pm:OpenFolder(to)
    op = "open"
  end
  local newFolder = pm:GetCurrentFolder() or ""
  return string.format(
    '{"navigated":%s,"op":%s,"to":%s,"current_folder":%s}',
    tostring(ok), jsonEscape(op), jsonEscape(to), jsonEscape(newFolder)
  )
end

HANDLERS["pm.getInfo"] = handlePmGetInfo
HANDLERS["pm.createProject"] = handlePmCreateProject
HANDLERS["pm.loadProject"] = handlePmLoadProject
HANDLERS["pm.saveProject"] = handlePmSaveProject
HANDLERS["pm.deleteProject"] = handlePmDeleteProject
HANDLERS["pm.createFolder"] = handlePmCreateFolder
HANDLERS["pm.navigateFolder"] = handlePmNavigateFolder

-- ---------------------------------------------------------------------------
-- Fusion comps på currently selected timeline-item
-- ---------------------------------------------------------------------------

-- Fusion comps lever PÅ timeline items, ikke MediaPoolItems. Alle
-- operasjoner her gjelder current video item — bytt selection i
-- Resolve eller flytt playhead først hvis du vil treffe spesifikt item.

local function currentVideoItem()
  local _, project = getResolveContext()
  local timeline = project:GetCurrentTimeline()
  if not timeline then error("Ingen aktiv timeline") end
  local item = timeline:GetCurrentVideoItem()
  if not item then error("Ingen valgt video item") end
  return item
end

local function handleFusionGetCompNames(_args)
  local item = currentVideoItem()
  local names = item:GetFusionCompNames() or {}
  return string.format(
    '{"item":%s,"count":%d,"names":%s}',
    jsonEscape(item:GetName() or ""), #names, jsonArrayOfStrings(names)
  )
end

local function handleFusionAddComp(_args)
  local item = currentVideoItem()
  local comp = item:AddFusionComp()
  if not comp then error("AddFusionComp returnerte nil") end
  return string.format(
    '{"added":true,"item":%s}',
    jsonEscape(item:GetName() or "")
  )
end

local function handleFusionLoadComp(args)
  local item = currentVideoItem()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local comp = item:LoadFusionCompByName(name)
  if not comp then error("LoadFusionCompByName feilet — fant ikke '" .. name .. "'") end
  return string.format(
    '{"loaded":true,"name":%s,"item":%s}',
    jsonEscape(name), jsonEscape(item:GetName() or "")
  )
end

local function handleFusionRenameComp(args)
  local item = currentVideoItem()
  local oldName = extractString(args, "old_name")
  if not oldName or oldName == "" then error("old_name mangler") end
  local newName = extractString(args, "new_name")
  if not newName or newName == "" then error("new_name mangler") end
  local ok = item:RenameFusionCompByName(oldName, newName)
  return string.format(
    '{"renamed":%s,"old_name":%s,"new_name":%s}',
    tostring(ok), jsonEscape(oldName), jsonEscape(newName)
  )
end

local function handleFusionDeleteComp(args)
  local item = currentVideoItem()
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local ok = item:DeleteFusionCompByName(name)
  return string.format(
    '{"deleted":%s,"name":%s}',
    tostring(ok), jsonEscape(name)
  )
end

local function handleFusionImportComp(args)
  local item = currentVideoItem()
  local path = extractString(args, "path")
  if not path or path == "" then error("path mangler") end
  local comp = item:ImportFusionComp(path)
  if not comp then error("ImportFusionComp returnerte nil (sjekk at path er en gyldig .setting-fil)") end
  return string.format(
    '{"imported":true,"path":%s}',
    jsonEscape(path)
  )
end

local function handleFusionExportComp(args)
  local item = currentVideoItem()
  local path = extractString(args, "path")
  if not path or path == "" then error("path mangler") end
  local compIndex = tonumber(args:match('"comp_index"%s*:%s*(%d+)'))
  if not compIndex then error("comp_index mangler (1-basert)") end
  local ok = item:ExportFusionComp(path, compIndex)
  return string.format(
    '{"exported":%s,"path":%s,"comp_index":%d}',
    tostring(ok), jsonEscape(path), compIndex
  )
end

HANDLERS["fusion.getCompNames"] = handleFusionGetCompNames
HANDLERS["fusion.addComp"] = handleFusionAddComp
HANDLERS["fusion.loadComp"] = handleFusionLoadComp
HANDLERS["fusion.renameComp"] = handleFusionRenameComp
HANDLERS["fusion.deleteComp"] = handleFusionDeleteComp
HANDLERS["fusion.importComp"] = handleFusionImportComp
HANDLERS["fusion.exportComp"] = handleFusionExportComp

-- ---------------------------------------------------------------------------
-- Import / Export: timelines + projects
-- ---------------------------------------------------------------------------

-- mediaPool.importTimelineFromFile(file_path, timeline_name?,
--   import_source_clips?, source_clips_path?, interlace_processing?)
-- Lar Director instansiere ferdig timeline-skjelett fra
-- .aaf/.edl/.xml/.fcpxml/.drt/.adl/.otio.
local function handleMediaPoolImportTimeline(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local filePath = extractString(args, "file_path")
  if not filePath or filePath == "" then error("file_path mangler") end

  local options = {}
  local timelineName = extractString(args, "timeline_name")
  if timelineName and timelineName ~= "" then
    options.timelineName = timelineName
  end
  local sourceClipsPath = extractString(args, "source_clips_path")
  if sourceClipsPath and sourceClipsPath ~= "" then
    options.sourceClipsPath = sourceClipsPath
  end
  if args:match('"import_source_clips"%s*:%s*true') then
    options.importSourceClips = true
  elseif args:match('"import_source_clips"%s*:%s*false') then
    options.importSourceClips = false
  end
  if args:match('"interlace_processing"%s*:%s*true') then
    options.interlaceProcessing = true
  end

  local timeline = mediaPool:ImportTimelineFromFile(filePath, options)
  if not timeline then
    error("ImportTimelineFromFile feilet — sjekk path + filtype + at format støttes")
  end
  return string.format(
    '{"imported":true,"timeline_name":%s,"file_path":%s,"fps":%s}',
    jsonEscape(timeline:GetName() or ""),
    jsonEscape(filePath),
    jsonEscape(timeline:GetSetting("timelineFrameRate") or "")
  )
end

-- mediaPool.deleteTimelines(timeline_names[])
-- Finn ved navn (iterer GetTimelineByIndex 1..N) → DeleteTimelines.
local function handleMediaPoolDeleteTimelines(args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local namesBlock = args:match('"timeline_names"%s*:%s*(%b[])')
  if not namesBlock then error("timeline_names mangler (array av strings)") end
  local wantedNames = {}
  for n in namesBlock:gmatch('"([^"]+)"') do
    wantedNames[n] = true
  end

  local count = project:GetTimelineCount() or 0
  local timelines = {}
  local matched = {}
  for i = 1, count do
    local tl = project:GetTimelineByIndex(i)
    if tl then
      local name = tl:GetName() or ""
      if wantedNames[name] then
        table.insert(timelines, tl)
        table.insert(matched, name)
      end
    end
  end
  if #timelines == 0 then
    error("Fant ingen timelines matching: " .. namesBlock)
  end

  local ok = mediaPool:DeleteTimelines(timelines)
  local matchedParts = {}
  for _, n in ipairs(matched) do
    table.insert(matchedParts, jsonEscape(n))
  end
  return string.format(
    '{"deleted":%s,"count":%d,"names":[%s]}',
    tostring(ok), #matched, table.concat(matchedParts, ",")
  )
end

-- pm.importProject(file_path, project_name?) — .drp-import inn i current
-- PM-folder.
local function handlePmImportProject(args)
  local pm = getPM()
  local filePath = extractString(args, "file_path")
  if not filePath or filePath == "" then error("file_path mangler") end
  local projectName = extractString(args, "project_name")
  local ok
  if projectName and projectName ~= "" then
    ok = pm:ImportProject(filePath, projectName)
  else
    ok = pm:ImportProject(filePath)
  end
  return string.format(
    '{"imported":%s,"file_path":%s,"project_name":%s}',
    tostring(ok), jsonEscape(filePath), jsonEscape(projectName or "")
  )
end

-- pm.exportProject(project_name, file_path, with_stills_and_luts?)
local function handlePmExportProject(args)
  local pm = getPM()
  local projectName = extractString(args, "project_name")
  if not projectName or projectName == "" then error("project_name mangler") end
  local filePath = extractString(args, "file_path")
  if not filePath or filePath == "" then error("file_path mangler") end

  -- Default true; bare false hvis eksplisitt
  local withStillsAndLuts = true
  if args:match('"with_stills_and_luts"%s*:%s*false') then
    withStillsAndLuts = false
  end

  local ok = pm:ExportProject(projectName, filePath, withStillsAndLuts)
  return string.format(
    '{"exported":%s,"project_name":%s,"file_path":%s,"with_stills_and_luts":%s}',
    tostring(ok), jsonEscape(projectName), jsonEscape(filePath),
    tostring(withStillsAndLuts)
  )
end

HANDLERS["mediaPool.importTimelineFromFile"] = handleMediaPoolImportTimeline
HANDLERS["mediaPool.deleteTimelines"] = handleMediaPoolDeleteTimelines
HANDLERS["pm.importProject"] = handlePmImportProject
HANDLERS["pm.exportProject"] = handlePmExportProject

-- ---------------------------------------------------------------------------
-- Fusion node scripting (inside-comp API)
-- ---------------------------------------------------------------------------

-- Hver Director-call er en fresh Lua-invocation, så vi kan ikke cache
-- comp-handler på tvers. Hver handler re-resolverer:
--   1. Get selected timeline-item
--   2. Hvis comp_name gitt: LoadFusionCompByName
--   3. Hvis ikke: bruk siste comp i listen
local function getFusionComp(args)
  local item = currentVideoItem()
  local compName = extractString(args, "comp_name")
  if compName and compName ~= "" then
    local comp = item:LoadFusionCompByName(compName)
    if not comp then
      error("Fant ikke Fusion comp: " .. compName)
    end
    return comp, compName
  end
  local names = item:GetFusionCompNames()
  if not names or #names == 0 then
    error("Ingen Fusion comp på dette itemet — lag med fusion.addComp først")
  end
  local lastName = names[#names]
  local comp = item:LoadFusionCompByName(lastName)
  if not comp then error("LoadFusionCompByName(" .. lastName .. ") returnerte nil") end
  return comp, lastName
end

-- coerceValue — Fusion SetInput godtar tall, string, bool. JSON-arg er
-- string. Vi prøver number → boolean → string.
local function coerceValue(raw)
  if raw == nil then return nil end
  -- Bool?
  if raw == "true" then return true end
  if raw == "false" then return false end
  -- Number?
  local n = tonumber(raw)
  if n ~= nil then return n end
  return raw
end

local function fusionCompGetInfo(args)
  local comp, compName = getFusionComp(args)
  local toolList = comp:GetToolList(false) or {}
  -- GetToolList returnerer {[1]=tool, [2]=tool, ...} eller dict — håndtér begge
  local tools = {}
  if toolList[1] then
    for _, tool in ipairs(toolList) do
      local name = tool.Name or tool:GetAttrs and tool:GetAttrs().TOOLS_Name or ""
      local toolType = tool:GetAttrs and tool:GetAttrs().TOOLS_RegID or ""
      table.insert(tools, string.format(
        '{"name":%s,"type":%s}',
        jsonEscape(tostring(name)), jsonEscape(tostring(toolType))
      ))
    end
  else
    for name, tool in pairs(toolList) do
      local toolType = tool:GetAttrs and tool:GetAttrs().TOOLS_RegID or ""
      table.insert(tools, string.format(
        '{"name":%s,"type":%s}',
        jsonEscape(tostring(name)), jsonEscape(tostring(toolType))
      ))
    end
  end
  return string.format(
    '{"comp":%s,"tool_count":%d,"tools":[%s]}',
    jsonEscape(compName), #tools, table.concat(tools, ",")
  )
end

local function fusionCompAddTool(args)
  local comp = getFusionComp(args)
  local toolType = extractString(args, "tool_type")
  if not toolType or toolType == "" then error("tool_type mangler (f.eks. 'Background', 'TextPlus', 'Merge')") end
  local x = tonumber(args:match('"x"%s*:%s*(-?%d+)')) or -1
  local y = tonumber(args:match('"y"%s*:%s*(-?%d+)')) or -1
  local name = extractString(args, "name")

  local tool = comp:AddTool(toolType, x, y)
  if not tool then error("AddTool(" .. toolType .. ") returnerte nil") end
  if name and name ~= "" then
    tool:SetAttrs({ TOOLS_Name = name })
  end
  local attrs = tool:GetAttrs() or {}
  local finalName = attrs.TOOLS_Name or ""
  return string.format(
    '{"added":true,"name":%s,"tool_type":%s,"x":%d,"y":%d}',
    jsonEscape(finalName), jsonEscape(toolType), x, y
  )
end

local function fusionCompDeleteTool(args)
  local comp = getFusionComp(args)
  local name = extractString(args, "name")
  if not name or name == "" then error("name mangler") end
  local tool = comp:FindTool(name)
  if not tool then error("Fant ikke tool: " .. name) end
  comp:SetActiveTool(tool)
  comp:Execute("composition.SelectAll(false)\ncomposition.ActiveTool:Select(true)\ncomposition.Cut()")
  -- Cut sletter selected tool — alternativt: tool:Delete() hvis tilgjengelig
  return string.format(
    '{"deleted":true,"name":%s}',
    jsonEscape(name)
  )
end

local function fusionCompSetInput(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local inputName = extractString(args, "input_name")
  if not inputName or inputName == "" then error("input_name mangler") end
  local rawValue = extractString(args, "value")
  if rawValue == nil then error("value mangler") end

  local tool = comp:FindTool(toolName)
  if not tool then error("Fant ikke tool: " .. toolName) end
  local coerced = coerceValue(rawValue)
  local ok = tool:SetInput(inputName, coerced)
  return string.format(
    '{"set":%s,"tool":%s,"input":%s,"value":%s}',
    tostring(ok ~= nil and ok ~= false),
    jsonEscape(toolName), jsonEscape(inputName), jsonEscape(tostring(rawValue))
  )
end

local function fusionCompConnectInput(args)
  local comp = getFusionComp(args)
  local destTool = extractString(args, "dest_tool")
  if not destTool or destTool == "" then error("dest_tool mangler") end
  local destInput = extractString(args, "dest_input")
  if not destInput or destInput == "" then error("dest_input mangler") end
  local srcTool = extractString(args, "src_tool")
  if not srcTool or srcTool == "" then error("src_tool mangler") end
  local srcOutput = extractString(args, "src_output") or "Output"

  local dest = comp:FindTool(destTool)
  if not dest then error("Fant ikke dest_tool: " .. destTool) end
  local src = comp:FindTool(srcTool)
  if not src then error("Fant ikke src_tool: " .. srcTool) end

  local destInputObj = dest:FindMainInput(destInput) or dest[destInput]
  if not destInputObj then error("Fant ikke input '" .. destInput .. "' på " .. destTool) end
  local srcOutputObj = src:FindMainOutput(srcOutput) or src[srcOutput]
  if not srcOutputObj then error("Fant ikke output '" .. srcOutput .. "' på " .. srcTool) end

  destInputObj:ConnectTo(srcOutputObj)
  return string.format(
    '{"connected":true,"dest":%s,"dest_input":%s,"src":%s,"src_output":%s}',
    jsonEscape(destTool), jsonEscape(destInput),
    jsonEscape(srcTool), jsonEscape(srcOutput)
  )
end

HANDLERS["fusionComp.getInfo"] = fusionCompGetInfo
HANDLERS["fusionComp.addTool"] = fusionCompAddTool
HANDLERS["fusionComp.deleteTool"] = fusionCompDeleteTool
HANDLERS["fusionComp.setInput"] = fusionCompSetInput
HANDLERS["fusionComp.connectInput"] = fusionCompConnectInput

-- ---------------------------------------------------------------------------
-- Fusion animation: keyframes + expressions + render-range
-- ---------------------------------------------------------------------------

-- Helper: hent input-objekt eller throw forklarende feil.
local function getToolInput(comp, toolName, inputName)
  local tool = comp:FindTool(toolName)
  if not tool then error("Fant ikke tool: " .. toolName) end
  local input = nil
  if tool.FindMainInput then
    input = tool:FindMainInput(inputName)
  end
  if not input then
    input = tool[inputName]
  end
  if not input then
    error("Fant ikke input '" .. inputName .. "' på tool '" .. toolName .. "'")
  end
  return tool, input
end

-- Helper: sjekk om input allerede er animert (koblet til BezierSpline)
-- eller har expression. Returnerer connected-tool eller nil.
local function getInputAnimSource(input)
  if not input.GetConnectedOutput then return nil end
  local connected = input:GetConnectedOutput()
  if not connected then return nil end
  -- ConnectedOutput er et Output-objekt — tool finnes via .GetTool eller via direkte ref
  if connected.GetTool then
    return connected:GetTool()
  end
  return nil
end

-- fusionComp.addKeyframe(tool_name, input_name, time, value, comp_name?)
-- Tilnærming: hvis input ikke er animert, kobler vi en ny BezierSpline.
-- Så setter vi comp.CurrentTime og kaller SetInput — Fusion oppretter
-- keyframe automatisk på den aktive splinen.
local function fusionCompAddKeyframe(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local inputName = extractString(args, "input_name")
  if not inputName or inputName == "" then error("input_name mangler") end
  local time = tonumber(args:match('"time"%s*:%s*(-?%d+%.?%d*)'))
  if not time then error("time mangler (frame-number, kan være float)") end
  local rawValue = extractString(args, "value")
  if rawValue == nil then error("value mangler") end

  local tool, input = getToolInput(comp, toolName, inputName)

  -- Hvis input ikke er animert, koble til ny BezierSpline
  local animSource = getInputAnimSource(input)
  if not animSource then
    local spline = comp:AddTool("BezierSpline", -32768, -32768)
    if not spline then error("Klarte ikke opprette BezierSpline for animasjon") end
    if input.ConnectTo then
      input:ConnectTo(spline)
    else
      error("Input støtter ikke ConnectTo — ikke animerbar")
    end
  end

  -- Save current time, jump, set, restore
  local origTime = comp.CurrentTime or 0
  comp:SetCurrentTime(time)
  local coerced = coerceValue(rawValue)
  local ok = tool:SetInput(inputName, coerced)
  comp:SetCurrentTime(origTime)

  return string.format(
    '{"keyframed":%s,"tool":%s,"input":%s,"time":%s,"value":%s}',
    tostring(ok ~= nil and ok ~= false),
    jsonEscape(toolName), jsonEscape(inputName),
    tostring(time), jsonEscape(tostring(rawValue))
  )
end

-- fusionComp.removeKeyframe(tool_name, input_name, time, comp_name?)
-- Disconnecter ikke splinen — sletter bare keyframe ved tid.
local function fusionCompRemoveKeyframe(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local inputName = extractString(args, "input_name")
  if not inputName or inputName == "" then error("input_name mangler") end
  local time = tonumber(args:match('"time"%s*:%s*(-?%d+%.?%d*)'))
  if not time then error("time mangler") end

  local _, input = getToolInput(comp, toolName, inputName)
  local animSource = getInputAnimSource(input)
  if not animSource then
    return string.format(
      '{"removed":false,"reason":"ikke-animert","tool":%s,"input":%s}',
      jsonEscape(toolName), jsonEscape(inputName)
    )
  end
  -- BezierSpline har KeyFrames som tabell { [time] = {value, ...} }
  if animSource.KeyFrames then
    animSource.KeyFrames[time] = nil
  elseif animSource.DeleteKeyFrame then
    animSource:DeleteKeyFrame(time)
  end
  return string.format(
    '{"removed":true,"tool":%s,"input":%s,"time":%s}',
    jsonEscape(toolName), jsonEscape(inputName), tostring(time)
  )
end

-- fusionComp.listKeyframes(tool_name, input_name, comp_name?)
local function fusionCompListKeyframes(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local inputName = extractString(args, "input_name")
  if not inputName or inputName == "" then error("input_name mangler") end

  local _, input = getToolInput(comp, toolName, inputName)
  local animSource = getInputAnimSource(input)
  if not animSource then
    return string.format(
      '{"animated":false,"tool":%s,"input":%s,"keyframes":[]}',
      jsonEscape(toolName), jsonEscape(inputName)
    )
  end
  local kfs = animSource.KeyFrames
  if type(kfs) ~= "table" then
    return string.format(
      '{"animated":true,"tool":%s,"input":%s,"keyframes":[]}',
      jsonEscape(toolName), jsonEscape(inputName)
    )
  end
  local parts = {}
  for t, v in pairs(kfs) do
    local val = type(v) == "table" and (v[1] or v.value) or v
    table.insert(parts, string.format(
      '{"time":%s,"value":%s}',
      tostring(t),
      type(val) == "string" and jsonEscape(val) or tostring(val)
    ))
  end
  return string.format(
    '{"animated":true,"tool":%s,"input":%s,"count":%d,"keyframes":[%s]}',
    jsonEscape(toolName), jsonEscape(inputName), #parts,
    table.concat(parts, ",")
  )
end

-- fusionComp.setExpression(tool_name, input_name, expression, comp_name?)
local function fusionCompSetExpression(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local inputName = extractString(args, "input_name")
  if not inputName or inputName == "" then error("input_name mangler") end
  local expression = extractString(args, "expression")
  if expression == nil then error("expression mangler (kan være tom string for å rydde)") end

  local _, input = getToolInput(comp, toolName, inputName)
  if not input.SetExpression then
    error("Input støtter ikke SetExpression")
  end
  local ok = input:SetExpression(expression)
  return string.format(
    '{"set":%s,"tool":%s,"input":%s,"expression":%s}',
    tostring(ok ~= nil and ok ~= false),
    jsonEscape(toolName), jsonEscape(inputName), jsonEscape(expression)
  )
end

-- fusionComp.removeAnimation(tool_name, input_name, comp_name?)
-- Disconnecter input fra spline OG rydder expression. Verdi blir
-- statisk på sin nåværende verdi-snapshot.
local function fusionCompRemoveAnimation(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local inputName = extractString(args, "input_name")
  if not inputName or inputName == "" then error("input_name mangler") end

  local _, input = getToolInput(comp, toolName, inputName)
  local cleared = false
  if input.SetExpression then
    input:SetExpression("")
    cleared = true
  end
  if input.ConnectTo then
    -- ConnectTo med nil disconnecter i de fleste Fusion-versjoner
    input:ConnectTo(nil)
    cleared = true
  end
  return string.format(
    '{"cleared":%s,"tool":%s,"input":%s}',
    tostring(cleared),
    jsonEscape(toolName), jsonEscape(inputName)
  )
end

-- fusionComp.setRenderRange(start, end, comp_name?)
-- Setter både Global og Render start/end. Fusion bruker disse to par.
local function fusionCompSetRenderRange(args)
  local comp = getFusionComp(args)
  local startFrame = tonumber(args:match('"start"%s*:%s*(-?%d+%.?%d*)'))
  local endFrame = tonumber(args:match('"end"%s*:%s*(-?%d+%.?%d*)'))
  if not startFrame then error("start mangler (frame-number)") end
  if not endFrame then error("end mangler (frame-number)") end
  if endFrame < startFrame then error("end må være >= start") end

  comp:SetAttrs({
    COMPN_GlobalStart = startFrame,
    COMPN_GlobalEnd = endFrame,
    COMPN_RenderStart = startFrame,
    COMPN_RenderEnd = endFrame,
  })
  return string.format(
    '{"set":true,"start":%s,"end":%s}',
    tostring(startFrame), tostring(endFrame)
  )
end

-- fusionComp.setCurrentTime(time, comp_name?)
local function fusionCompSetCurrentTime(args)
  local comp = getFusionComp(args)
  local time = tonumber(args:match('"time"%s*:%s*(-?%d+%.?%d*)'))
  if not time then error("time mangler") end
  comp:SetCurrentTime(time)
  return string.format(
    '{"set":true,"time":%s,"current_time":%s}',
    tostring(time), tostring(comp.CurrentTime or time)
  )
end

HANDLERS["fusionComp.addKeyframe"] = fusionCompAddKeyframe
HANDLERS["fusionComp.removeKeyframe"] = fusionCompRemoveKeyframe
HANDLERS["fusionComp.listKeyframes"] = fusionCompListKeyframes
HANDLERS["fusionComp.setExpression"] = fusionCompSetExpression
HANDLERS["fusionComp.removeAnimation"] = fusionCompRemoveAnimation
HANDLERS["fusionComp.setRenderRange"] = fusionCompSetRenderRange
HANDLERS["fusionComp.setCurrentTime"] = fusionCompSetCurrentTime

-- ---------------------------------------------------------------------------
-- Stabilize + IntelliSearch reset + Burn-in preset
-- ---------------------------------------------------------------------------

-- clip.stabilize — kjør stabilisering på currently selected timeline-item.
-- Bruker eksisterende stabiliserings-settings (useStabilizationSmoothCam +
-- relaterte) — sett dem først via timeline.setSetting/project.setSetting.
local function handleClipStabilize(_args)
  local item = currentVideoItem()
  local ok = item:Stabilize()
  return string.format(
    '{"stabilized":%s,"item":%s}',
    tostring(ok), jsonEscape(item:GetName() or "")
  )
end

-- folder.intelliReset — slett IntelliSearch-analyse på current MediaPool-
-- folder. Brukes før re-analyze med andre settings (better-mode vs faster,
-- identifyFaces på/av).
local function handleFolderIntelliReset(_args)
  local _, project = getResolveContext()
  local mediaPool = project:GetMediaPool()
  local current = mediaPool:GetCurrentFolder()
  if not current then error("Ingen aktiv folder") end
  local ok = current:ResetIntellisearchAnalysis()
  return string.format(
    '{"reset":%s,"folder":%s}',
    tostring(ok), jsonEscape(current:GetName() or "")
  )
end

-- clip.loadBurnInPreset(preset_name) — last data burn-in preset (timecode,
-- clip-name, custom-data overlays) på currently selected timeline-item.
-- preset_name må matche et eksisterende preset i Resolve's burn-in-bibliotek.
local function handleClipLoadBurnInPreset(args)
  local item = currentVideoItem()
  local presetName = extractString(args, "preset_name")
  if not presetName or presetName == "" then error("preset_name mangler") end
  local ok = item:LoadBurnInPreset(presetName)
  return string.format(
    '{"loaded":%s,"preset_name":%s,"item":%s}',
    tostring(ok), jsonEscape(presetName), jsonEscape(item:GetName() or "")
  )
end

HANDLERS["clip.stabilize"] = handleClipStabilize
HANDLERS["folder.intelliReset"] = handleFolderIntelliReset
HANDLERS["clip.loadBurnInPreset"] = handleClipLoadBurnInPreset

-- ---------------------------------------------------------------------------
-- Fusion tool-presets (save/load enkeltnoder som .setting-filer)
-- ---------------------------------------------------------------------------

-- fusionComp.saveToolPreset(tool_name, file_path, comp_name?)
-- Lagrer en enkelt tool sin konfigurasjon (alle Input-verdier + animasjon)
-- som .setting-fil. Brukes for å bygge bibliotek av gjenbrukbare
-- title/lower-third/effekt-templates.
local function fusionCompSaveToolPreset(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local filePath = extractString(args, "file_path")
  if not filePath or filePath == "" then error("file_path mangler") end

  local tool = comp:FindTool(toolName)
  if not tool then error("Fant ikke tool: " .. toolName) end

  -- SaveSettings finnes på Tool-objekter; returnerer typisk Bool eller path.
  local ok = false
  if tool.SaveSettings then
    ok = tool:SaveSettings(filePath) ~= nil
  else
    error("Tool støtter ikke SaveSettings")
  end
  return string.format(
    '{"saved":%s,"tool":%s,"file_path":%s}',
    tostring(ok), jsonEscape(toolName), jsonEscape(filePath)
  )
end

-- fusionComp.loadToolPreset(file_path, target_tool_name?, x?, y?, comp_name?)
-- Laster en .setting-fil. Hvis target_tool_name er gitt — overskriver
-- den eksisterende toolens innstillinger (tool:LoadSettings). Hvis ikke —
-- paster .settings inn i comp-en som ny(e) tool(s) (comp:Paste).
local function fusionCompLoadToolPreset(args)
  local comp = getFusionComp(args)
  local filePath = extractString(args, "file_path")
  if not filePath or filePath == "" then error("file_path mangler") end
  local targetName = extractString(args, "target_tool_name")
  local x = tonumber(args:match('"x"%s*:%s*(-?%d+)'))
  local y = tonumber(args:match('"y"%s*:%s*(-?%d+)'))

  if targetName and targetName ~= "" then
    -- Overskriv eksisterende tool
    local target = comp:FindTool(targetName)
    if not target then error("Fant ikke target tool: " .. targetName) end
    if not target.LoadSettings then
      error("Tool støtter ikke LoadSettings")
    end
    local ok = target:LoadSettings(filePath) ~= nil
    return string.format(
      '{"loaded":%s,"mode":"overwrite","target":%s,"file_path":%s}',
      tostring(ok), jsonEscape(targetName), jsonEscape(filePath)
    )
  end

  -- Paste som ny tool(s) via Settings-tabell
  if not bmd or not bmd.readfile then
    error("bmd.readfile utilgjengelig — kan ikke lese .setting (bruk target_tool_name for overwrite)")
  end
  local settingsTable = bmd.readfile(filePath)
  if type(settingsTable) ~= "table" then
    error("Kunne ikke parse .setting-fil: " .. filePath)
  end
  if x or y then
    settingsTable.__flags = settingsTable.__flags or {}
    settingsTable.__flags.x = x or -1
    settingsTable.__flags.y = y or -1
  end
  local pasted = comp:Paste(settingsTable)
  return string.format(
    '{"loaded":%s,"mode":"paste","file_path":%s}',
    tostring(pasted), jsonEscape(filePath)
  )
end

HANDLERS["fusionComp.saveToolPreset"] = fusionCompSaveToolPreset
HANDLERS["fusionComp.loadToolPreset"] = fusionCompLoadToolPreset

-- ---------------------------------------------------------------------------
-- 3D-transform helper (set Position/Rotation/Scale i én call)
-- ---------------------------------------------------------------------------

-- fusionComp.set3DTransform(tool_name, position?, rotation?, scale?, comp_name?)
-- Wraps multiple SetInput-kall for vector-inputs. Default input-navn matcher
-- standard 3D-noder (Transform3D, Camera3D, lys, Shape3D etc.):
--   - Translate.X / Translate.Y / Translate.Z
--   - Rotate.X / Rotate.Y / Rotate.Z
--   - XScale / YScale / ZScale (eller scalar Scale for uniform)
-- Bruk per_axis_prefixes for å overstyre hvis tool bruker andre navn.
local function fusionCompSet3DTransform(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end

  local tool = comp:FindTool(toolName)
  if not tool then error("Fant ikke tool: " .. toolName) end

  local setCount = 0
  local function trySetInput(name, value)
    if value == nil then return end
    local ok = pcall(function() tool:SetInput(name, value) end)
    if ok then setCount = setCount + 1 end
  end

  -- Position
  local px = tonumber(args:match('"position"%s*:%s*{[^}]-"x"%s*:%s*(-?%d+%.?%d*)'))
  local py = tonumber(args:match('"position"%s*:%s*{[^}]-"y"%s*:%s*(-?%d+%.?%d*)'))
  local pz = tonumber(args:match('"position"%s*:%s*{[^}]-"z"%s*:%s*(-?%d+%.?%d*)'))
  trySetInput("Translate.X", px)
  trySetInput("Translate.Y", py)
  trySetInput("Translate.Z", pz)

  -- Rotation
  local rx = tonumber(args:match('"rotation"%s*:%s*{[^}]-"x"%s*:%s*(-?%d+%.?%d*)'))
  local ry = tonumber(args:match('"rotation"%s*:%s*{[^}]-"y"%s*:%s*(-?%d+%.?%d*)'))
  local rz = tonumber(args:match('"rotation"%s*:%s*{[^}]-"z"%s*:%s*(-?%d+%.?%d*)'))
  trySetInput("Rotate.X", rx)
  trySetInput("Rotate.Y", ry)
  trySetInput("Rotate.Z", rz)

  -- Scale: enten {x, y, z} eller scalar tall (uniform)
  local sx = tonumber(args:match('"scale"%s*:%s*{[^}]-"x"%s*:%s*(-?%d+%.?%d*)'))
  local sy = tonumber(args:match('"scale"%s*:%s*{[^}]-"y"%s*:%s*(-?%d+%.?%d*)'))
  local sz = tonumber(args:match('"scale"%s*:%s*{[^}]-"z"%s*:%s*(-?%d+%.?%d*)'))
  local scalarScale = tonumber(args:match('"scale"%s*:%s*(-?%d+%.?%d*)'))
  if scalarScale and not (sx or sy or sz) then
    trySetInput("XScale", scalarScale)
    trySetInput("YScale", scalarScale)
    trySetInput("ZScale", scalarScale)
  else
    trySetInput("XScale", sx)
    trySetInput("YScale", sy)
    trySetInput("ZScale", sz)
  end

  return string.format(
    '{"set":true,"tool":%s,"inputs_set":%d}',
    jsonEscape(toolName), setCount
  )
end

HANDLERS["fusionComp.set3DTransform"] = fusionCompSet3DTransform

-- ---------------------------------------------------------------------------
-- Tracker scripting (2D Tracker + PlanarTracker)
-- ---------------------------------------------------------------------------

-- fusionComp.trackerTrack(tool_name, direction, comp_name?)
-- direction: "forward" eller "backward". Lang-løpende operasjon —
-- analyserer hvert frame i comp-range. Bruker 60s timeout som default
-- per call (kan overstyres via plugin-wrapper).
local function fusionCompTrackerTrack(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local direction = extractString(args, "direction") or "forward"
  if direction ~= "forward" and direction ~= "backward" then
    error("direction må være 'forward' eller 'backward'")
  end

  local tool = comp:FindTool(toolName)
  if not tool then error("Fant ikke tool: " .. toolName) end

  local ok
  if direction == "forward" then
    if not tool.TrackForward then error("Tool støtter ikke TrackForward — ikke en Tracker?") end
    ok = tool:TrackForward()
  else
    if not tool.TrackBackward then error("Tool støtter ikke TrackBackward — ikke en Tracker?") end
    ok = tool:TrackBackward()
  end

  return string.format(
    '{"tracked":%s,"tool":%s,"direction":%s}',
    tostring(ok ~= nil and ok ~= false),
    jsonEscape(toolName), jsonEscape(direction)
  )
end

-- fusionComp.trackerGetCenter(tool_name, time?, comp_name?)
-- Returnerer tracked center-position ved gitt frame (eller current time).
-- Brukes for å lese tracker-data → bruk i annen tool's input via setInput
-- eller connectInput med src_output: "SteadyPosition" / "UnsteadyPosition".
local function fusionCompTrackerGetCenter(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local time = tonumber(args:match('"time"%s*:%s*(-?%d+%.?%d*)'))
  if not time then time = comp.CurrentTime or 0 end

  local tool = comp:FindTool(toolName)
  if not tool then error("Fant ikke tool: " .. toolName) end

  -- Tracker exposes GetSelectedTrackedCenter(time) eller via Steady/UnsteadyPosition[time]
  local px, py
  if tool.GetSelectedTrackedCenter then
    local pos = tool:GetSelectedTrackedCenter(time)
    if pos then
      px = pos[1] or pos.X
      py = pos[2] or pos.Y
    end
  end
  -- Fallback: prøv SteadyPosition[time]
  if px == nil and tool.SteadyPosition then
    local sp = tool.SteadyPosition[time]
    if type(sp) == "table" then
      px = sp[1] or sp.X
      py = sp[2] or sp.Y
    end
  end

  if px == nil or py == nil then
    return string.format(
      '{"found":false,"tool":%s,"time":%s,"reason":"Tracker ikke tracked enda — kjør trackerTrack først"}',
      jsonEscape(toolName), tostring(time)
    )
  end
  return string.format(
    '{"found":true,"tool":%s,"time":%s,"x":%s,"y":%s}',
    jsonEscape(toolName), tostring(time), tostring(px), tostring(py)
  )
end

HANDLERS["fusionComp.trackerTrack"] = fusionCompTrackerTrack
HANDLERS["fusionComp.trackerGetCenter"] = fusionCompTrackerGetCenter

-- ---------------------------------------------------------------------------
-- Mask-region helper: bygg + posisjonér + koble til target's EffectMask
-- ---------------------------------------------------------------------------

-- fusionComp.addMaskRegion(target_tool, shape, x, y, width, height,
--   soft_edge?, invert?, comp_name?)
--
-- Wrapper-call som dekker det vanligste mask-pattern: lag en mask-node,
-- posisjonér + størrelsesett, og koble til target tool sin EffectMask-input.
-- Brukes for video-cloning (mask en halvdel), object-removal (mask
-- objekt-region), invisible-transition (kombinér med Magic Mask på subjekt).
--
-- Koordinater er normalisert 0-1. Rectangle: x/y = senter. Width/Height
-- som fraksjon av frame. Default soft_edge=0.005, invert=false.
local function fusionCompAddMaskRegion(args)
  local comp = getFusionComp(args)
  local targetName = extractString(args, "target_tool")
  if not targetName or targetName == "" then error("target_tool mangler") end
  local shape = extractString(args, "shape") or "rectangle"
  if shape ~= "rectangle" and shape ~= "ellipse" then
    error("shape må være 'rectangle' eller 'ellipse'")
  end
  local x = tonumber(args:match('"x"%s*:%s*(-?%d+%.?%d*)'))
  local y = tonumber(args:match('"y"%s*:%s*(-?%d+%.?%d*)'))
  local width = tonumber(args:match('"width"%s*:%s*(-?%d+%.?%d*)'))
  local height = tonumber(args:match('"height"%s*:%s*(-?%d+%.?%d*)'))
  if not x or not y or not width or not height then
    error("x, y, width, height må alle være tall (0-1 normalisert)")
  end
  local softEdge = tonumber(args:match('"soft_edge"%s*:%s*(-?%d+%.?%d*)')) or 0.005
  local invert = args:match('"invert"%s*:%s*true') ~= nil

  -- Verifiser at target eksisterer
  local target = comp:FindTool(targetName)
  if not target then error("Fant ikke target_tool: " .. targetName) end

  -- Opprett mask-tool. Rectangle/Ellipse er RegID i Fusion.
  local toolType = shape == "ellipse" and "Ellipse" or "Rectangle"
  local mask = comp:AddTool(toolType, -1, -1)
  if not mask then error("Klarte ikke opprette " .. toolType) end

  -- Sett posisjon via Center.X / Center.Y
  pcall(function() mask:SetInput("Center.X", x) end)
  pcall(function() mask:SetInput("Center.Y", y) end)
  -- Sett størrelse via Width / Height (eller XWidth/YHeight for Ellipse)
  if shape == "rectangle" then
    pcall(function() mask:SetInput("Width", width) end)
    pcall(function() mask:SetInput("Height", height) end)
  else
    -- Ellipse bruker Width som radius * 2 og lignende — Fusion API
    -- har Width og Height typisk for ellipse-bounding-box.
    pcall(function() mask:SetInput("Width", width) end)
    pcall(function() mask:SetInput("Height", height) end)
  end
  -- Soft edge
  pcall(function() mask:SetInput("SoftEdge", softEdge) end)
  -- Invert
  pcall(function() mask:SetInput("PaintMode", invert and 1 or 0) end)

  -- Koble mask → target's EffectMask
  local maskName = (mask:GetAttrs() or {}).TOOLS_Name or ""
  local connected = false
  if target.FindMainInput then
    local em = target:FindMainInput("EffectMask")
    if em and em.ConnectTo then
      -- Mask-tools eksponerer "Mask"-output
      local maskOut = mask:FindMainOutput and mask:FindMainOutput("Mask")
      if maskOut then
        em:ConnectTo(maskOut)
        connected = true
      end
    end
  end

  return string.format(
    '{"created":true,"mask_name":%s,"shape":%s,"target":%s,' ..
    '"connected_to_effect_mask":%s,"x":%s,"y":%s,"width":%s,"height":%s,' ..
    '"soft_edge":%s,"invert":%s}',
    jsonEscape(maskName), jsonEscape(shape), jsonEscape(targetName),
    tostring(connected),
    tostring(x), tostring(y), tostring(width), tostring(height),
    tostring(softEdge), tostring(invert)
  )
end

HANDLERS["fusionComp.addMaskRegion"] = fusionCompAddMaskRegion

-- ---------------------------------------------------------------------------
-- Easing curves på BezierSpline-keyframes
-- ---------------------------------------------------------------------------

-- fusionComp.setKeyframeEasing(tool_name, input_name, easing, time?, comp_name?)
--
-- Setter ease-pattern på keyframes på en animert input. Hvis time
-- utelates: appliseres på ALLE eksisterende keyframes. Endrer ikke
-- verdier — kun handle-tangents og step-flags.
--
-- Easing-modi:
--   "linear"      — rett linje (default i Fusion)
--   "ease_in"     — slow start (krummer venstre handle)
--   "ease_out"    — slow end (krummer høyre handle) — mest "naturlig"
--   "ease_in_out" — slow start + slow end (S-kurve)
--   "smooth"      — auto-smooth tangents (kontinuerlig kurvatur)
--   "hold"        — step (ingen interpolasjon)
local EASING_TYPES = {
  linear = true, ease_in = true, ease_out = true,
  ease_in_out = true, smooth = true, hold = true,
}

-- Applisér easing-flags på en keyframe-entry (KeyFrames[time]).
-- Fusion BezierSpline.KeyFrames[time] kan være tabell { value, LH, RH, Flags }
-- eller bare verdi. Vi forsøker å sette Flags trygt.
local function applyEasingToKeyframe(kf, easing)
  if type(kf) ~= "table" then
    -- Kan ikke endre primitive verdier
    return false
  end
  kf.Flags = kf.Flags or {}
  -- Reset known flags først
  kf.Flags.Linear = nil
  kf.Flags.Smooth = nil
  kf.Flags.StepIn = nil
  kf.Flags.StepOut = nil

  if easing == "linear" then
    kf.Flags.Linear = true
  elseif easing == "smooth" then
    kf.Flags.Smooth = true
  elseif easing == "hold" then
    kf.Flags.StepIn = true
    kf.Flags.StepOut = true
  elseif easing == "ease_in" then
    -- Slow start: LH (venstre handle) drar mot keyframe-verdi
    if kf.LH then kf.LH = { kf.LH[1], kf.LH[2] or 0 } end
    kf.Flags.Smooth = false
  elseif easing == "ease_out" then
    -- Slow end: RH (høyre handle) drar mot keyframe-verdi
    if kf.RH then kf.RH = { kf.RH[1], kf.RH[2] or 0 } end
    kf.Flags.Smooth = false
  elseif easing == "ease_in_out" then
    -- S-kurve: begge handles drar mot keyframe-verdi
    if kf.LH then kf.LH = { kf.LH[1], kf.LH[2] or 0 } end
    if kf.RH then kf.RH = { kf.RH[1], kf.RH[2] or 0 } end
    kf.Flags.Smooth = false
  end
  return true
end

local function fusionCompSetKeyframeEasing(args)
  local comp = getFusionComp(args)
  local toolName = extractString(args, "tool_name")
  if not toolName or toolName == "" then error("tool_name mangler") end
  local inputName = extractString(args, "input_name")
  if not inputName or inputName == "" then error("input_name mangler") end
  local easing = extractString(args, "easing")
  if not easing or easing == "" then error("easing mangler") end
  if not EASING_TYPES[easing] then
    error("Ugyldig easing: " .. easing ..
      " (gyldige: linear, ease_in, ease_out, ease_in_out, smooth, hold)")
  end
  local specificTime = tonumber(args:match('"time"%s*:%s*(-?%d+%.?%d*)'))

  local _, input = getToolInput(comp, toolName, inputName)
  local animSource = getInputAnimSource(input)
  if not animSource then
    error("Input er ikke animert — addKeyframe først")
  end
  local kfs = animSource.KeyFrames
  if type(kfs) ~= "table" then
    error("Ingen keyframes på spline")
  end

  local applied = 0
  if specificTime then
    if kfs[specificTime] then
      if applyEasingToKeyframe(kfs[specificTime], easing) then
        applied = 1
      end
    end
  else
    for _, kf in pairs(kfs) do
      if applyEasingToKeyframe(kf, easing) then
        applied = applied + 1
      end
    end
  end

  return string.format(
    '{"applied":%d,"tool":%s,"input":%s,"easing":%s,"scope":%s}',
    applied, jsonEscape(toolName), jsonEscape(inputName), jsonEscape(easing),
    specificTime and jsonEscape("frame:" .. tostring(specificTime)) or jsonEscape("all")
  )
end

HANDLERS["fusionComp.setKeyframeEasing"] = fusionCompSetKeyframeEasing

-- ---------------------------------------------------------------------------
-- Loader + Saver (fil-I/O i Fusion-comp)
-- ---------------------------------------------------------------------------

-- fusionComp.addLoader(file_path, x?, y?, comp_name?)
-- Adds Loader-node pointing at file. Common use: clean plate fra Photoshop,
-- image overlays, logos, custom backgrounds, video-mellomdokumenter.
local function fusionCompAddLoader(args)
  local comp = getFusionComp(args)
  local filePath = extractString(args, "file_path")
  if not filePath or filePath == "" then error("file_path mangler") end
  local x = tonumber(args:match('"x"%s*:%s*(-?%d+)')) or -1
  local y = tonumber(args:match('"y"%s*:%s*(-?%d+)')) or -1

  local loader = comp:AddTool("Loader", x, y)
  if not loader then error("AddTool('Loader') returnerte nil") end
  -- Loader bruker "Clip" eller "Filename" — prøv begge for kompat
  local fileSet = false
  pcall(function()
    loader.Clip[1] = { Filename = filePath, FormatID = "FFmpeg", StartFrame = 0, LengthSetManually = false }
    fileSet = true
  end)
  if not fileSet then
    pcall(function() loader:SetInput("Filename", filePath); fileSet = true end)
  end

  local name = (loader:GetAttrs() or {}).TOOLS_Name or ""
  return string.format(
    '{"added":true,"name":%s,"tool_type":"Loader","file_path":%s,"file_set":%s}',
    jsonEscape(name), jsonEscape(filePath), tostring(fileSet)
  )
end

-- fusionComp.addSaver(file_path, x?, y?, comp_name?)
local function fusionCompAddSaver(args)
  local comp = getFusionComp(args)
  local filePath = extractString(args, "file_path")
  if not filePath or filePath == "" then error("file_path mangler") end
  local x = tonumber(args:match('"x"%s*:%s*(-?%d+)')) or -1
  local y = tonumber(args:match('"y"%s*:%s*(-?%d+)')) or -1

  local saver = comp:AddTool("Saver", x, y)
  if not saver then error("AddTool('Saver') returnerte nil") end
  local fileSet = false
  pcall(function()
    saver.Clip[1] = { Filename = filePath, FormatID = "FFmpeg", StartFrame = 0, LengthSetManually = false }
    fileSet = true
  end)
  if not fileSet then
    pcall(function() saver:SetInput("Filename", filePath); fileSet = true end)
  end

  local name = (saver:GetAttrs() or {}).TOOLS_Name or ""
  return string.format(
    '{"added":true,"name":%s,"tool_type":"Saver","file_path":%s,"file_set":%s}',
    jsonEscape(name), jsonEscape(filePath), tostring(fileSet)
  )
end

HANDLERS["fusionComp.addLoader"] = fusionCompAddLoader
HANDLERS["fusionComp.addSaver"] = fusionCompAddSaver

-- ---------------------------------------------------------------------------
-- Whip Pan helper (directional blur med animated bell-curve length)
-- ---------------------------------------------------------------------------

-- fusionComp.addWhipPan(target_tool, direction, start_frame, end_frame,
--   peak_strength?, comp_name?)
--
-- Klassisk whip-pan-effekt: directional blur som ramper opp og ned i en
-- bell-curve. Brukes for energy-cuts (mest brukt edit-teknikk i bryllup
-- per research). Auto-skaper DirectionalBlur, animerer Length, og setter
-- Angle basert på direction.
--
-- direction:
--   "horizontal"     — 0° (L-R blur)
--   "vertical"       — 90° (vertikal blur)
--   "diagonal_up"    — 45°
--   "diagonal_down"  — -45°
--   eller tall (grader)
local function fusionCompAddWhipPan(args)
  local comp = getFusionComp(args)
  local targetName = extractString(args, "target_tool")
  if not targetName or targetName == "" then error("target_tool mangler") end
  local target = comp:FindTool(targetName)
  if not target then error("Fant ikke target: " .. targetName) end

  local direction = extractString(args, "direction") or "horizontal"
  local startFrame = tonumber(args:match('"start_frame"%s*:%s*(-?%d+%.?%d*)'))
  local endFrame = tonumber(args:match('"end_frame"%s*:%s*(-?%d+%.?%d*)'))
  if not startFrame or not endFrame then
    error("start_frame og end_frame må være tall")
  end
  if endFrame <= startFrame then error("end_frame må være > start_frame") end
  local peakStrength = tonumber(args:match('"peak_strength"%s*:%s*(-?%d+%.?%d*)')) or 0.1

  -- Konverter direction → grader
  local angle = 0
  if direction == "horizontal" then angle = 0
  elseif direction == "vertical" then angle = 90
  elseif direction == "diagonal_up" then angle = 45
  elseif direction == "diagonal_down" then angle = -45
  else
    local n = tonumber(direction)
    if n then
      angle = n
    else
      error("direction må være horizontal/vertical/diagonal_up/diagonal_down eller grader")
    end
  end

  local blur = comp:AddTool("DirectionalBlur", -1, -1)
  if not blur then error("AddTool('DirectionalBlur') feilet") end

  pcall(function() blur:SetInput("Angle", angle) end)

  -- Koble Length til BezierSpline for animasjon
  local lengthInput = nil
  if blur.FindMainInput then lengthInput = blur:FindMainInput("Length") end
  if not lengthInput then lengthInput = blur["Length"] end
  if lengthInput and lengthInput.ConnectTo then
    local spline = comp:AddTool("BezierSpline", -32768, -32768)
    if spline then lengthInput:ConnectTo(spline) end
  end

  -- Bell-curve: start 0 → mid peak → end 0
  local midFrame = (startFrame + endFrame) / 2
  local origTime = comp.CurrentTime or 0

  comp:SetCurrentTime(startFrame)
  blur:SetInput("Length", 0)
  comp:SetCurrentTime(midFrame)
  blur:SetInput("Length", peakStrength)
  comp:SetCurrentTime(endFrame)
  blur:SetInput("Length", 0)
  comp:SetCurrentTime(origTime)

  -- Koble target.Output → blur.Input
  local connected = false
  if target.FindMainOutput and blur.FindMainInput then
    local targetOutput = target:FindMainOutput("Output")
    local blurInput = blur:FindMainInput("Input")
    if targetOutput and blurInput and blurInput.ConnectTo then
      blurInput:ConnectTo(targetOutput)
      connected = true
    end
  end

  local name = (blur:GetAttrs() or {}).TOOLS_Name or ""
  return string.format(
    '{"added":true,"name":%s,"target":%s,"angle":%s,"start_frame":%s,"end_frame":%s,' ..
    '"peak_strength":%s,"connected_to_target":%s}',
    jsonEscape(name), jsonEscape(targetName), tostring(angle),
    tostring(startFrame), tostring(endFrame), tostring(peakStrength),
    tostring(connected)
  )
end

HANDLERS["fusionComp.addWhipPan"] = fusionCompAddWhipPan

-- ---------------------------------------------------------------------------
-- Speed Ramp helper (TimeSpeed med animated Speed input)
-- ---------------------------------------------------------------------------

-- fusionComp.addSpeedRamp(target_tool, ramp_type, start_frame, end_frame,
--   slow_factor?, comp_name?)
--
-- Variable retime via TimeSpeed-node. Brukes for slow-mo dans/kyss-momenter
-- og dramatiske bullet-time-effekter. Per research er retime kun delvis
-- scriptable på timeline-nivå — Fusion TimeSpeed gir oss full kontroll.
--
-- ramp_type:
--   "in"        — normal → slow (entering slow-mo)
--   "out"       — slow → normal (exiting slow-mo)
--   "in_out"    — normal → slow → normal (klassisk slow-mo moment)
--   "bullet_time" — extreme slow i midten med rask ramp-in/out
--
-- slow_factor er Speed-verdi ved peak (default 0.25 = 4x sakte). 1.0 = normal,
-- 0.5 = halv hastighet, 2.0 = dobbel hastighet (kan brukes for speed-up).
local function fusionCompAddSpeedRamp(args)
  local comp = getFusionComp(args)
  local targetName = extractString(args, "target_tool")
  if not targetName or targetName == "" then error("target_tool mangler") end
  local target = comp:FindTool(targetName)
  if not target then error("Fant ikke target: " .. targetName) end

  local rampType = extractString(args, "ramp_type") or "in_out"
  if rampType ~= "in" and rampType ~= "out" and rampType ~= "in_out" and rampType ~= "bullet_time" then
    error("ramp_type må være in/out/in_out/bullet_time")
  end
  local startFrame = tonumber(args:match('"start_frame"%s*:%s*(-?%d+%.?%d*)'))
  local endFrame = tonumber(args:match('"end_frame"%s*:%s*(-?%d+%.?%d*)'))
  if not startFrame or not endFrame then
    error("start_frame og end_frame må være tall")
  end
  if endFrame <= startFrame then error("end_frame må være > start_frame") end
  local slowFactor = tonumber(args:match('"slow_factor"%s*:%s*(-?%d+%.?%d*)')) or 0.25
  if slowFactor <= 0 then error("slow_factor må være > 0") end

  local ts = comp:AddTool("TimeSpeed", -1, -1)
  if not ts then error("AddTool('TimeSpeed') feilet") end

  -- Koble Speed til BezierSpline
  local speedInput = nil
  if ts.FindMainInput then speedInput = ts:FindMainInput("Speed") end
  if not speedInput then speedInput = ts["Speed"] end
  if speedInput and speedInput.ConnectTo then
    local spline = comp:AddTool("BezierSpline", -32768, -32768)
    if spline then speedInput:ConnectTo(spline) end
  end

  local origTime = comp.CurrentTime or 0

  if rampType == "in" then
    -- normal → slow
    comp:SetCurrentTime(startFrame); ts:SetInput("Speed", 1.0)
    comp:SetCurrentTime(endFrame); ts:SetInput("Speed", slowFactor)
  elseif rampType == "out" then
    -- slow → normal
    comp:SetCurrentTime(startFrame); ts:SetInput("Speed", slowFactor)
    comp:SetCurrentTime(endFrame); ts:SetInput("Speed", 1.0)
  elseif rampType == "in_out" then
    -- normal → slow → normal (klassisk slow-mo)
    local midFrame = (startFrame + endFrame) / 2
    comp:SetCurrentTime(startFrame); ts:SetInput("Speed", 1.0)
    comp:SetCurrentTime(midFrame); ts:SetInput("Speed", slowFactor)
    comp:SetCurrentTime(endFrame); ts:SetInput("Speed", 1.0)
  elseif rampType == "bullet_time" then
    -- Ekstreme: rask ramp inn til veldig sakte, hold, rask ramp ut
    local range = endFrame - startFrame
    local rampIn = startFrame + range * 0.15
    local rampOut = startFrame + range * 0.85
    local extremeSlow = slowFactor / 3  -- 3x slower enn vanlig slow_factor
    comp:SetCurrentTime(startFrame); ts:SetInput("Speed", 1.0)
    comp:SetCurrentTime(rampIn); ts:SetInput("Speed", extremeSlow)
    comp:SetCurrentTime(rampOut); ts:SetInput("Speed", extremeSlow)
    comp:SetCurrentTime(endFrame); ts:SetInput("Speed", 1.0)
  end

  comp:SetCurrentTime(origTime)

  -- Koble target.Output → ts.Input
  local connected = false
  if target.FindMainOutput and ts.FindMainInput then
    local targetOutput = target:FindMainOutput("Output")
    local tsInput = ts:FindMainInput("Input")
    if targetOutput and tsInput and tsInput.ConnectTo then
      tsInput:ConnectTo(targetOutput)
      connected = true
    end
  end

  local name = (ts:GetAttrs() or {}).TOOLS_Name or ""
  return string.format(
    '{"added":true,"name":%s,"target":%s,"ramp_type":%s,"start_frame":%s,' ..
    '"end_frame":%s,"slow_factor":%s,"connected_to_target":%s}',
    jsonEscape(name), jsonEscape(targetName), jsonEscape(rampType),
    tostring(startFrame), tostring(endFrame), tostring(slowFactor),
    tostring(connected)
  )
end

HANDLERS["fusionComp.addSpeedRamp"] = fusionCompAddSpeedRamp

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
