--[[
  insert-from-postagent.lua — DaVinci Resolve script

  Henter alle filer fra ~/PostAgent/outbox/, importerer til Media Pool
  i Resolve, og varsler brukeren. Brukeren kan deretter dra dem til
  timeline manuelt (auto-insert er fragile i Resolve scripting).

  Hvordan kjøre:
    Workspace → Scripts → Comp/Edit → insert-from-postagent

  Outbox tømmes etter import — flytt heller filer til arkiv hvis du
  vil beholde dem.
]]--

local function getOutboxPath()
  local home = os.getenv("HOME")
  if not home then error("HOME-env mangler") end
  local dir = home .. "/PostAgent/outbox"
  return dir
end

local function listFiles(dir)
  local files = {}
  local p = io.popen('ls -1 "' .. dir .. '" 2>/dev/null')
  if not p then return files end
  for line in p:lines() do
    if line:match("%.png$") or line:match("%.tif$") or line:match("%.tiff$") or line:match("%.psd$") then
      table.insert(files, dir .. "/" .. line)
    end
  end
  p:close()
  return files
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
    print("[Post Agent] Ingen filer i outbox — har du eksportert tilbake fra Photoshop?")
    return
  end

  local imported = mediaPool:ImportMedia(files)
  if not imported or #imported == 0 then
    print("[Post Agent] Resolve avviste importen — sjekk format")
    return
  end

  print(string.format("[Post Agent] Importert %d filer fra outbox til Media Pool", #imported))
  print("[Post Agent] Dra dem til timeline når du er klar")

  -- Flytt outbox-filer til arkiv så de ikke importeres på nytt
  local archiveDir = outbox .. "/.archive"
  os.execute(string.format("mkdir -p \"%s\"", archiveDir))
  for _, f in ipairs(files) do
    os.execute(string.format("mv \"%s\" \"%s/\"", f, archiveDir))
  end
end

local ok, err = pcall(importFromOutbox)
if not ok then
  print("[Post Agent] FEIL: " .. tostring(err))
end
