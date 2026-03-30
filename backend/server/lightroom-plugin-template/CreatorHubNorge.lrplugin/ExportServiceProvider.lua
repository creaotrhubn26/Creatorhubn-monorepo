local LrApplication = import 'LrApplication'
local LrDialogs = import 'LrDialogs'
local LrHttp = import 'LrHttp'
local LrPathUtils = import 'LrPathUtils'
local LrPrefs = import 'LrPrefs'
local LrTasks = import 'LrTasks'
local LrView = import 'LrView'
local bind = LrView.bind

local Defaults = require 'CreatorHubDefaults'

local prefs = LrPrefs.prefsForPlugin()

local BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

local function trim(value)
  if value == nil then
    return nil
  end

  local asString = tostring(value)
  local normalized = string.gsub(asString, '^%s+', '')
  normalized = string.gsub(normalized, '%s+$', '')
  if normalized == '' then
    return nil
  end

  return normalized
end

local function jsonEscape(value)
  local source = value or ''
  source = string.gsub(source, '\\', '\\\\')
  source = string.gsub(source, '"', '\\"')
  source = string.gsub(source, '\n', '\\n')
  source = string.gsub(source, '\r', '\\r')
  source = string.gsub(source, '\t', '\\t')
  return source
end

local function encodeJsonString(value)
  return '"' .. jsonEscape(value or '') .. '"'
end

local function encodeStringArray(values)
  local encoded = {}
  for index, value in ipairs(values) do
    encoded[index] = encodeJsonString(value)
  end

  return '[' .. table.concat(encoded, ',') .. ']'
end

local function base64Encode(data)
  return ((data:gsub('.', function(character)
    local byte = string.byte(character)
    local bits = ''
    for bitIndex = 8, 1, -1 do
      local power = 2 ^ (bitIndex - 1)
      if byte % (power * 2) - byte % power > 0 then
        bits = bits .. '1'
      else
        bits = bits .. '0'
      end
    end
    return bits
  end) .. '0000'):gsub('%d%d%d?%d?%d?%d?', function(chunk)
    if #chunk < 6 then
      return ''
    end
    local value = 0
    for bitIndex = 1, 6 do
      if string.sub(chunk, bitIndex, bitIndex) == '1' then
        value = value + 2 ^ (6 - bitIndex)
      end
    end
    return string.sub(BASE64_ALPHABET, value + 1, value + 1)
  end) .. ({ '', '==', '=' })[#data % 3 + 1])
end

local function splitKeywords(value)
  local keywords = {}
  if not value or value == '' then
    return keywords
  end

  local normalized = string.gsub(value, ';', ',')
  normalized = string.gsub(normalized, '|', ',')
  for segment in string.gmatch(normalized, '([^,]+)') do
    local keyword = trim(segment)
    if keyword then
      keywords[#keywords + 1] = keyword
    end
  end

  return keywords
end

local function getMimeTypeFromPath(exportPath)
  local lowerPath = string.lower(exportPath)
  if string.match(lowerPath, '%.png$') then
    return 'image/png'
  end
  if string.match(lowerPath, '%.webp$') then
    return 'image/webp'
  end
  if string.match(lowerPath, '%.gif$') then
    return 'image/gif'
  end
  if string.match(lowerPath, '%.tif$') or string.match(lowerPath, '%.tiff$') then
    return 'image/tiff'
  end
  return 'image/jpeg'
end

local function readFileBinary(exportPath)
  local fileHandle = io.open(exportPath, 'rb')
  if not fileHandle then
    return nil, 'Kunne ikke lese eksportfilen fra Lightroom.'
  end

  local content = fileHandle:read('*all')
  fileHandle:close()
  return content, nil
end

local function rememberSettings(exportSettings)
  prefs.apiBaseUrl = trim(exportSettings.creatorhubApiBaseUrl) or Defaults.apiBaseUrl
  prefs.pluginToken = trim(exportSettings.creatorhubPluginToken) or Defaults.pluginToken
  prefs.collectionName = trim(exportSettings.creatorhubCollectionName) or ''
  prefs.projectName = trim(exportSettings.creatorhubProjectName) or ''
  prefs.customerName = trim(exportSettings.creatorhubCustomerName) or ''
  prefs.customerEmail = trim(exportSettings.creatorhubCustomerEmail) or ''
  prefs.companyName = trim(exportSettings.creatorhubCompanyName) or ''
  prefs.category = trim(exportSettings.creatorhubCategory) or 'Lightroom Uploads'
end

local function initializeSettings(exportSettings)
  exportSettings.creatorhubApiBaseUrl = trim(exportSettings.creatorhubApiBaseUrl) or trim(prefs.apiBaseUrl) or Defaults.apiBaseUrl
  exportSettings.creatorhubPluginToken = trim(exportSettings.creatorhubPluginToken) or trim(prefs.pluginToken) or Defaults.pluginToken
  exportSettings.creatorhubCollectionName = trim(exportSettings.creatorhubCollectionName) or trim(prefs.collectionName) or ''
  exportSettings.creatorhubProjectName = trim(exportSettings.creatorhubProjectName) or trim(prefs.projectName) or ''
  exportSettings.creatorhubCustomerName = trim(exportSettings.creatorhubCustomerName) or trim(prefs.customerName) or ''
  exportSettings.creatorhubCustomerEmail = trim(exportSettings.creatorhubCustomerEmail) or trim(prefs.customerEmail) or ''
  exportSettings.creatorhubCompanyName = trim(exportSettings.creatorhubCompanyName) or trim(prefs.companyName) or ''
  exportSettings.creatorhubCategory = trim(exportSettings.creatorhubCategory) or trim(prefs.category) or 'Lightroom Uploads'
end

local function buildRequestBody(photo, exportPath, fileData, exportSettings)
  local title = trim(photo:getFormattedMetadata('title')) or LrPathUtils.removeExtension(LrPathUtils.leafName(exportPath))
  local caption = trim(photo:getFormattedMetadata('caption')) or 'Eksportert fra CreatorHub Lightroom plugin'
  local collectionName = trim(exportSettings.creatorhubCollectionName)
  local projectName = trim(exportSettings.creatorhubProjectName)
  local customerName = trim(exportSettings.creatorhubCustomerName)
  local customerEmail = trim(exportSettings.creatorhubCustomerEmail)
  local companyName = trim(exportSettings.creatorhubCompanyName)
  local category = trim(exportSettings.creatorhubCategory) or collectionName or 'Lightroom Uploads'
  local rating = tonumber(photo:getRawMetadata('rating')) or 0
  local keywords = splitKeywords(photo:getFormattedMetadata('keywordTags') or '')
  local captureDate = trim(photo:getFormattedMetadata('dateTimeOriginal')) or ''
  local originalFileName = trim(photo:getFormattedMetadata('fileName')) or LrPathUtils.leafName(exportPath)

  local metadataFragments = {
    '"lightroomPluginVersion":' .. encodeJsonString(Defaults.pluginVersion),
    '"lightroomCatalogName":' .. encodeJsonString(LrApplication.activeCatalog():getName() or ''),
    '"originalFileName":' .. encodeJsonString(originalFileName),
  }

  local fragments = {
    '"filename":' .. encodeJsonString(LrPathUtils.leafName(exportPath)),
    '"title":' .. encodeJsonString(title),
    '"caption":' .. encodeJsonString(caption),
    '"collectionName":' .. encodeJsonString(collectionName or ''),
    '"projectName":' .. encodeJsonString(projectName or ''),
    '"customerName":' .. encodeJsonString(customerName or ''),
    '"customerEmail":' .. encodeJsonString(customerEmail or ''),
    '"companyName":' .. encodeJsonString(companyName or ''),
    '"category":' .. encodeJsonString(category),
    '"profession":' .. encodeJsonString('photographer'),
    '"mimeType":' .. encodeJsonString(getMimeTypeFromPath(exportPath)),
    '"fileDataBase64":' .. encodeJsonString(base64Encode(fileData)),
    '"keywords":' .. encodeStringArray(keywords),
    '"rating":' .. tostring(rating),
    '"captureDate":' .. encodeJsonString(captureDate),
    '"metadata":{' .. table.concat(metadataFragments, ',') .. '}',
  }

  return '{' .. table.concat(fragments, ',') .. '}'
end

local function extractJsonString(responseBody, fieldName)
  if not responseBody then
    return nil
  end

  local pattern = '"' .. fieldName .. '"%s*:%s*"(.-)"'
  return string.match(responseBody, pattern)
end

local function uploadRenderedPhoto(photo, exportPath, exportSettings)
  local fileData, readError = readFileBinary(exportPath)
  if not fileData then
    return false, readError or 'Kunne ikke lese den rendrerte filen.'
  end

  local apiBaseUrl = trim(exportSettings.creatorhubApiBaseUrl) or Defaults.apiBaseUrl
  local pluginToken = trim(exportSettings.creatorhubPluginToken) or Defaults.pluginToken
  if not apiBaseUrl or not pluginToken then
    return false, 'CreatorHub API-base eller plugin-token mangler.'
  end

  local requestBody = buildRequestBody(photo, exportPath, fileData, exportSettings)
  local endpoint = apiBaseUrl .. '/plugin/export-photo'
  local responseBody = LrHttp.post(endpoint, requestBody, {
    { field = 'Content-Type', value = 'application/json' },
    { field = 'X-Lightroom-Plugin-Token', value = pluginToken },
  })

  if not responseBody or not string.find(responseBody, '"success"%s*:%s*true') then
    return false, responseBody or 'CreatorHub svarte ikke med gyldig JSON.'
  end

  local showcaseItemId = extractJsonString(responseBody, 'showcaseItemId')
  local driveFileId = extractJsonString(responseBody, 'driveFileId')
  if showcaseItemId and driveFileId then
    return true, 'Showcase item ' .. showcaseItemId .. ' opprettet. Drive-fil ' .. driveFileId .. ' lagret.'
  end

  return true, 'Eksport fullført til CreatorHub og Google Drive.'
end

return {
  startDialog = function(propertyTable)
    initializeSettings(propertyTable)
  end,

  sectionsForTopOfDialog = function(f, propertyTable)
    initializeSettings(propertyTable)

    return {
      {
        title = 'CreatorHub Norge',
        synopsis = bind 'creatorhubCategory',
        f:column {
          spacing = f:control_spacing(),
          f:static_text {
            title = 'Eksporter rendrede bilder direkte til CreatorHub. Originalfilene lagres i Google Drive via din eksisterende Workspace-kobling.',
            fill_horizontal = 1,
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'API Base URL', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubApiBaseUrl', width_in_chars = 45 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Plugin-token', width = 140, alignment = 'right' },
            f:password_field { value = bind 'creatorhubPluginToken', width_in_chars = 45 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Collection / Galleri', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCollectionName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Prosjekt', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubProjectName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Kunde', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCustomerName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Kunde-e-post', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCustomerEmail', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Firma', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCompanyName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Kategori', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCategory', width_in_chars = 35 },
          },
        },
      },
    }
  end,

  processRenderedPhotos = function(functionContext, exportContext)
    local exportSettings = exportContext.propertyTable
    initializeSettings(exportSettings)
    rememberSettings(exportSettings)

    local progressScope = exportContext:configureProgress {
      title = 'CreatorHub Norge',
    }

    local totalRenditions = exportContext.exportSession:countRenditions()
    local uploadedCount = 0
    local failedMessages = {}

    for _, rendition in exportContext:renditions { stopIfCanceled = true } do
      if progressScope:isCanceled() then
        break
      end

      local success, renderedPathOrMessage = rendition:waitForRender()
      if success then
        local uploadSuccess, uploadMessage = uploadRenderedPhoto(rendition.photo, renderedPathOrMessage, exportSettings)
        if uploadSuccess then
          uploadedCount = uploadedCount + 1
        else
          failedMessages[#failedMessages + 1] = uploadMessage or 'Ukjent opplastingsfeil.'
        end
      else
        failedMessages[#failedMessages + 1] = tostring(renderedPathOrMessage)
      end

      progressScope:setPortionComplete(uploadedCount + #failedMessages, totalRenditions)
    end

    progressScope:done()

    if #failedMessages > 0 then
      LrDialogs.message(
        'CreatorHub Norge',
        string.format(
          'Eksport fullført med feil. %d lastet opp, %d feilet.\n\n%s',
          uploadedCount,
          #failedMessages,
          table.concat(failedMessages, '\n')
        ),
        'warning'
      )
      return
    end

    LrDialogs.message(
      'CreatorHub Norge',
      string.format(
        'Eksport fullført. %d bilde%s lagret i Google Drive og publisert til CreatorHub.',
        uploadedCount,
        uploadedCount == 1 and '' or 'r'
      )
    )
  end,
}
