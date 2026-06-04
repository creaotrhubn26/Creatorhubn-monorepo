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
