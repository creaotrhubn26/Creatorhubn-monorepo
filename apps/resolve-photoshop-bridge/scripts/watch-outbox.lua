--[[
  watch-outbox.lua — DaVinci Resolve Tier 2 sync

  Looper kontinuerlig og poller ~/PostAgent/outbox/ hvert 2 sekund.
  Når nye filer dukker opp (fra Photoshop sin resolve.exportBack),
  kjøres `insert-from-postagent.lua`-logikken automatisk — brukeren
  slipper å manuelt kjøre insert-scriptet.

  HVORDAN BRUKE:
    1. Start redigeringen i Resolve som vanlig
    2. Workspace → Scripts → Edit → watch-outbox
    3. Scriptet kjører til du stopper Resolve (eller manuelt avbryter)
    4. Photoshop-eksporter blir auto-replaced/imported i sanntid

  Begrensninger:
    - Lua sleep blokkerer denne tråden, men IKKE Resolve sin UI-tråd.
    - Hvis Resolve crasher må du restarte scriptet manuelt.
    - Krever at outbox/ er på lokal disk (ikke sync'et over nettverk
      som kan ha sen mtime-oppdatering).
]]--

local POLL_INTERVAL_SEC = 2
local OUTBOX_PATH = (os.getenv("HOME") or "") .. "/PostAgent/outbox"

local function listFiles(dir)
  local files = {}
  local p = io.popen('ls -1 "' .. dir .. '" 2>/dev/null')
  if not p then return files end
  for line in p:lines() do
    if line:match("%.png$") or line:match("%.tif$") or line:match("%.tiff$") or line:match("%.psd$") or line:match("%.jpg$") or line:match("%.jpeg$") then
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

local function extractStringField(json, key)
  local pattern = '"' .. key .. '"%s*:%s*"([^"]*)"'
  return json:match(pattern)
end

local function extractNumberField(json, key)
  local pattern = '"' .. key .. '"%s*:%s*(%-?%d+%.?%d*)'
  local n = json:match(pattern)
  return n and tonumber(n) or nil
end

local function parseMetadata(jsonStr)
  if not jsonStr then return nil end
  local schemaVersion = extractNumberField(jsonStr, "schema_version")
  if not schemaVersion or schemaVersion < 2 then return nil end
  local clipBlock = jsonStr:match('"clip_at_playhead"%s*:%s*({[^}]+})')
  if not clipBlock or clipBlock == "null" then
    return { has_clip = false }
  end
  return {
    has_clip = true,
    media_pool_item_id = extractStringField(clipBlock, "media_pool_item_id"),
    clip_name = extractStringField(clipBlock, "clip_name"),
    source_path = extractStringField(clipBlock, "source_path"),
    track_index = extractNumberField(clipBlock, "track_index"),
  }
end

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

local function processFile(fileName, mediaPool, archiveDir)
  local fullPath = OUTBOX_PATH .. "/" .. fileName
  local prefix = fileName:gsub("%.[^.]+$", "")
  local metaPath = OUTBOX_PATH .. "/" .. prefix .. ".json"
  local metaJson = readFile(metaPath)
  local meta = parseMetadata(metaJson)

  local handled = false
  if meta and meta.has_clip and meta.media_pool_item_id then
    local mpi = findMediaPoolItemById(mediaPool, meta.media_pool_item_id)
    if mpi and mpi:ReplaceClip(fullPath) then
      print(string.format("[Post Agent watch] AUTO-REPLACE: %s → %s", meta.clip_name or "?", fileName))
      handled = true
    end
  end
  if not handled then
    local result = mediaPool:ImportMedia({ fullPath })
    if result and #result > 0 then
      print(string.format("[Post Agent watch] IMPORT: %s", fileName))
    else
      print(string.format("[Post Agent watch] FEILET: %s", fileName))
      return -- ikke arkivér så vi kan retry neste iterasjon
    end
  end

  os.execute(string.format("mv \"%s\" \"%s/\"", fullPath, archiveDir))
  if metaJson then
    os.execute(string.format("mv \"%s\" \"%s/\"", metaPath, archiveDir))
  end
end

local function watchLoop()
  local resolve = Resolve()
  if not resolve then error("Resolve-API ikke tilgjengelig") end
  local pm = resolve:GetProjectManager()
  local project = pm:GetCurrentProject()
  if not project then error("Ingen aktivt prosjekt") end
  local mediaPool = project:GetMediaPool()

  os.execute(string.format("mkdir -p \"%s\"", OUTBOX_PATH))
  local archiveDir = OUTBOX_PATH .. "/.archive"
  os.execute(string.format("mkdir -p \"%s\"", archiveDir))

  print("[Post Agent watch] Aktiv. Poller " .. OUTBOX_PATH .. " hvert " .. POLL_INTERVAL_SEC .. "s")
  print("[Post Agent watch] Stopp ved å lukke Resolve eller avbryt scriptet manuelt.")

  local iterations = 0
  while true do
    iterations = iterations + 1
    local files = listFiles(OUTBOX_PATH)
    if #files > 0 then
      for _, fileName in ipairs(files) do
        processFile(fileName, mediaPool, archiveDir)
      end
    end
    -- Gi UI-tråden plass + ikke spam logg
    if iterations % 30 == 0 then
      print(string.format("[Post Agent watch] %d iterasjoner, fortsatt aktiv", iterations))
    end
    os.execute("sleep " .. POLL_INTERVAL_SEC)
  end
end

local ok, err = pcall(watchLoop)
if not ok then
  print("[Post Agent watch] STOPPET: " .. tostring(err))
end
