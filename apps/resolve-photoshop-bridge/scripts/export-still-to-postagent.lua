--[[
  export-still-to-postagent.lua — DaVinci Resolve script

  Eksporterer aktiv timeline-still til ~/PostAgent/inbox/ med RIK
  metadata som lar insert-from-postagent.lua auto-erstatte clip-source
  uten å trenge manuell drag.

  Filer som skrives:
    <epoch>_<project>_<timecode>.png      — selve stillen
    <samme prefix>.json                   — metadata for auto-replace

  Metadata-skjema v2:
    {
      "source": "davinci-resolve",
      "schema_version": 2,
      "epoch": 1717322000,
      "project_name": "Bryllup Emma & Jonas",
      "timeline_name": "Main",
      "timecode": "01:23:45:00",
      "frame_at_playhead": 124980,
      "clip_at_playhead": {
        "media_pool_item_id": "abc123",
        "clip_name": "GH010053.MP4",
        "source_path": "/Volumes/Footage/GH010053.MP4",
        "track_kind": "video",
        "track_index": 1,
        "start_frame": 120000,
        "end_frame": 130000
      }
    }

  Hvordan kjøre:
    Workspace → Scripts → Edit → export-still-to-postagent
]]--

local function getInboxPath()
  local home = os.getenv("HOME")
  if not home then error("HOME-env mangler") end
  local dir = home .. "/PostAgent/inbox"
  os.execute(string.format("mkdir -p \"%s\"", dir))
  return dir
end

local function escapeForFs(s)
  return string.gsub(tostring(s), "[^%w%-_.]", "_")
end

local function nowEpoch()
  return tostring(os.time())
end

local function timecodeToFrame(tc, fps)
  local h, m, s, f = tc:match("(%d+):(%d+):(%d+):(%d+)")
  if not h then return 0 end
  return ((tonumber(h) * 3600 + tonumber(m) * 60 + tonumber(s)) * fps) + tonumber(f)
end

local function findItemAtPlayhead(timeline, playheadFrame)
  local trackCount = timeline:GetTrackCount("video")
  local found = nil
  for trackIdx = 1, trackCount do
    local items = timeline:GetItemListInTrack("video", trackIdx)
    if items then
      for _, item in ipairs(items) do
        local s = item:GetStart()
        local e = item:GetEnd()
        if s and e and playheadFrame >= s and playheadFrame < e then
          found = { item = item, track_index = trackIdx }
        end
      end
    end
  end
  return found
end

local function serializeClipMetadata(item, trackIdx)
  if not item then return "null" end
  local mpi = item:GetMediaPoolItem()
  if not mpi then return "null" end

  local clipName = mpi:GetClipProperty("Clip Name") or "(ukjent)"
  local filePath = mpi:GetClipProperty("File Path") or ""
  local mpiId = mpi:GetUniqueId() or ""
  local startF = item:GetStart() or 0
  local endF = item:GetEnd() or 0

  return string.format(
    '{"media_pool_item_id":"%s","clip_name":%s,"source_path":%s,"track_kind":"video","track_index":%d,"start_frame":%d,"end_frame":%d}',
    mpiId,
    string.format("%q", clipName),
    string.format("%q", filePath),
    trackIdx,
    startF,
    endF
  )
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
  local timelineName = timeline:GetName() or "Unknown"

  local fps = tonumber(timeline:GetSetting("timelineFrameRate")) or 24
  local timecode = timeline:GetCurrentTimecode() or "00:00:00:00"
  local frameAtPlayhead = timecodeToFrame(timecode, fps)

  local clipFound = findItemAtPlayhead(timeline, frameAtPlayhead)
  local clipMetadata = clipFound
    and serializeClipMetadata(clipFound.item, clipFound.track_index)
    or "null"

  local stills = timeline:GrabStill()
  if not stills then error("Klarte ikke gjøre still ved playhead") end

  local gallery = project:GetGallery()
  local stillAlbum = gallery:GetCurrentStillAlbum()
  local inbox = getInboxPath()
  local epoch = nowEpoch()
  local prefix = string.format("%s_%s_%s", epoch, escapeForFs(projectName), escapeForFs(timecode))
  local jsonPath = string.format("%s/%s.json", inbox, prefix)

  local exported = stillAlbum:ExportStills({ stills }, inbox, prefix, "png")
  if not exported then
    print("[Post Agent] Eksport feilet — sjekk DR-versjon")
    return
  end

  local meta = string.format(
    '{"source":"davinci-resolve","schema_version":2,"epoch":%s,"project_name":%s,"timeline_name":%s,"timecode":"%s","frame_at_playhead":%d,"fps":%s,"clip_at_playhead":%s}',
    epoch,
    string.format("%q", projectName),
    string.format("%q", timelineName),
    timecode,
    frameAtPlayhead,
    tostring(fps),
    clipMetadata
  )
  local f = io.open(jsonPath, "w")
  if f then
    f:write(meta)
    f:close()
  end

  stillAlbum:DeleteStills({ stills })

  print(string.format("[Post Agent] Eksportert: %s.png (+ metadata)", prefix))
  if clipFound then
    print("[Post Agent] Clip-info bevart — insert-from-postagent kan auto-replace")
  else
    print("[Post Agent] Ingen clip under playhead — auto-replace ikke mulig, men ny media-import fungerer")
  end
end

local ok, err = pcall(exportStill)
if not ok then
  print("[Post Agent] FEIL: " .. tostring(err))
end
