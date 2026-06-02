--[[
  insert-from-postagent.lua — DaVinci Resolve script

  Henter alle filer fra ~/PostAgent/outbox/.
  Auto-replace-modus (V2): hvis fila har en sidefil .json med
  schema_version 2 og clip_at_playhead.media_pool_item_id, prøver vi
  å erstatte source på den ORIGINALE MediaPoolItem direkte. Da
  oppdateres timeline-klippet automatisk uten manuell drag.

  Fallback: import som vanlig ny media → manuell drag.

  Outbox tømmes (filer flyttes til .archive/) etter behandling.
]]--

local function getOutboxPath()
  local home = os.getenv("HOME")
  if not home then error("HOME-env mangler") end
  return home .. "/PostAgent/outbox"
end

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
        if clip:GetUniqueId() == targetId then
          return clip
        end
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

local function importFromOutbox()
  local resolve = Resolve()
  if not resolve then error("Resolve-API ikke tilgjengelig") end

  local pm = resolve:GetProjectManager()
  local project = pm:GetCurrentProject()
  if not project then error("Ingen aktivt prosjekt") end

  local mediaPool = project:GetMediaPool()
  local outbox = getOutboxPath()

  local files = listFiles(outbox)
  if #files == 0 then
    print("[Post Agent] Ingen filer i outbox")
    return
  end

  local autoReplaced = 0
  local imported = 0
  local archiveDir = outbox .. "/.archive"
  os.execute(string.format("mkdir -p \"%s\"", archiveDir))

  for _, fileName in ipairs(files) do
    local fullPath = outbox .. "/" .. fileName
    local prefix = fileName:gsub("%.[^.]+$", "")
    local metaPath = outbox .. "/" .. prefix .. ".json"
    local metaJson = readFile(metaPath)
    local meta = parseMetadata(metaJson)

    local handled = false

    if meta and meta.has_clip and meta.media_pool_item_id then
      local mpi = findMediaPoolItemById(mediaPool, meta.media_pool_item_id)
      if mpi then
        local ok = mpi:ReplaceClip(fullPath)
        if ok then
          autoReplaced = autoReplaced + 1
          handled = true
          print(string.format("[Post Agent] AUTO-REPLACE: %s → %s", meta.clip_name or "?", fileName))
        else
          print(string.format("[Post Agent] ReplaceClip avvist for %s — faller tilbake til import", meta.clip_name or "?"))
        end
      else
        print(string.format("[Post Agent] Fant ikke MediaPoolItem %s — original-clip slettet?", meta.media_pool_item_id or "?"))
      end
    end

    if not handled then
      local result = mediaPool:ImportMedia({ fullPath })
      if result and #result > 0 then
        imported = imported + 1
        print(string.format("[Post Agent] IMPORT: %s → Media Pool", fileName))
      else
        print(string.format("[Post Agent] Klarte ikke importere %s", fileName))
      end
    end

    os.execute(string.format("mv \"%s\" \"%s/\"", fullPath, archiveDir))
    if metaJson then
      os.execute(string.format("mv \"%s\" \"%s/\"", metaPath, archiveDir))
    end
  end

  print(string.format("[Post Agent] Ferdig: %d auto-replace + %d import = %d totalt",
    autoReplaced, imported, autoReplaced + imported))
  if autoReplaced > 0 then
    print("[Post Agent] Timeline-klippene oppdaterte seg automatisk")
  end
  if imported > 0 then
    print("[Post Agent] Nye media-items: dra til timeline manuelt")
  end
end

local ok, err = pcall(importFromOutbox)
if not ok then
  print("[Post Agent] FEIL: " .. tostring(err))
end
