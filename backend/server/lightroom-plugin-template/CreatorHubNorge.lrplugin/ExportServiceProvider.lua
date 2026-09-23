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

local function hasDeskBroker()
  return Defaults.deskBrokerUrl
    and Defaults.deskBrokerUrl ~= ''
    and Defaults.deskBrokerSecret
    and Defaults.deskBrokerSecret ~= ''
end

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

local function rememberSettings(exportSettings)
  if hasDeskBroker() then
    prefs.apiBaseUrl = nil
    prefs.pluginToken = nil
  else
    prefs.apiBaseUrl = trim(exportSettings.creatorhubApiBaseUrl) or Defaults.apiBaseUrl
    prefs.pluginToken = trim(exportSettings.creatorhubPluginToken) or Defaults.pluginToken
  end
  prefs.collectionName = trim(exportSettings.creatorhubCollectionName) or ''
  prefs.projectId = trim(exportSettings.creatorhubProjectId) or ''
  prefs.projectName = trim(exportSettings.creatorhubProjectName) or ''
  prefs.mirrorToDrive = exportSettings.creatorhubMirrorToDrive == true
  prefs.customerName = trim(exportSettings.creatorhubCustomerName) or ''
  prefs.customerEmail = trim(exportSettings.creatorhubCustomerEmail) or ''
  prefs.companyName = trim(exportSettings.creatorhubCompanyName) or ''
  prefs.category = trim(exportSettings.creatorhubCategory) or 'Lightroom Uploads'
end

local function initializeSettings(exportSettings)
  if hasDeskBroker() then
    exportSettings.creatorhubApiBaseUrl = Defaults.apiBaseUrl
    exportSettings.creatorhubPluginToken = ''
  else
    exportSettings.creatorhubApiBaseUrl = trim(exportSettings.creatorhubApiBaseUrl) or trim(prefs.apiBaseUrl) or Defaults.apiBaseUrl
    exportSettings.creatorhubPluginToken = trim(exportSettings.creatorhubPluginToken) or trim(prefs.pluginToken) or Defaults.pluginToken
  end
  exportSettings.creatorhubCollectionName = trim(exportSettings.creatorhubCollectionName) or trim(prefs.collectionName) or ''
  exportSettings.creatorhubProjectId = trim(exportSettings.creatorhubProjectId) or trim(prefs.projectId) or ''
  if exportSettings.creatorhubProjectId == '' and Defaults.projects and Defaults.projects[1] then
    exportSettings.creatorhubProjectId = Defaults.projects[1].value
  end
  exportSettings.creatorhubProjectName = trim(exportSettings.creatorhubProjectName) or trim(prefs.projectName) or ''
  if exportSettings.creatorhubMirrorToDrive == nil then
    exportSettings.creatorhubMirrorToDrive = prefs.mirrorToDrive == true
  end
  exportSettings.creatorhubCustomerName = trim(exportSettings.creatorhubCustomerName) or trim(prefs.customerName) or ''
  exportSettings.creatorhubCustomerEmail = trim(exportSettings.creatorhubCustomerEmail) or trim(prefs.customerEmail) or ''
  exportSettings.creatorhubCompanyName = trim(exportSettings.creatorhubCompanyName) or trim(prefs.companyName) or ''
  exportSettings.creatorhubCategory = trim(exportSettings.creatorhubCategory) or trim(prefs.category) or 'Lightroom Uploads'
end

local function buildRequestBody(photo, exportPath, exportSettings)
  local title = trim(photo:getFormattedMetadata('title')) or LrPathUtils.removeExtension(LrPathUtils.leafName(exportPath))
  local caption = trim(photo:getFormattedMetadata('caption')) or 'Eksportert fra CreatorHub Lightroom plugin'
  local collectionName = trim(exportSettings.creatorhubCollectionName)
  local projectId = trim(exportSettings.creatorhubProjectId)
  local projectName = trim(exportSettings.creatorhubProjectName)
  if not projectName and projectId and Defaults.projects then
    for _, project in ipairs(Defaults.projects) do
      if project.value == projectId then
        projectName = project.title
        break
      end
    end
  end
  local customerName = trim(exportSettings.creatorhubCustomerName)
  local customerEmail = trim(exportSettings.creatorhubCustomerEmail)
  local companyName = trim(exportSettings.creatorhubCompanyName)
  local category = trim(exportSettings.creatorhubCategory) or collectionName or 'Lightroom Uploads'
  local rating = tonumber(photo:getRawMetadata('rating')) or 0
  local keywords = splitKeywords(photo:getFormattedMetadata('keywordTags') or '')
  local captureDate = trim(photo:getFormattedMetadata('dateTimeOriginal')) or ''
  local originalFileName = trim(photo:getFormattedMetadata('fileName')) or LrPathUtils.leafName(exportPath)
  local catalogPath = LrApplication.activeCatalog():getPath()
  local catalogName = catalogPath
    and LrPathUtils.removeExtension(LrPathUtils.leafName(catalogPath))
    or ''

  local metadataFragments = {
    '"lightroomPluginVersion":' .. encodeJsonString(Defaults.pluginVersion),
    '"lightroomCatalogName":' .. encodeJsonString(catalogName),
    '"originalFileName":' .. encodeJsonString(originalFileName),
  }

  local fragments = {
    '"filename":' .. encodeJsonString(LrPathUtils.leafName(exportPath)),
    '"title":' .. encodeJsonString(title),
    '"caption":' .. encodeJsonString(caption),
    '"collectionName":' .. encodeJsonString(collectionName or ''),
    '"projectId":' .. encodeJsonString(projectId or ''),
    '"projectName":' .. encodeJsonString(projectName or ''),
    '"customerName":' .. encodeJsonString(customerName or ''),
    '"customerEmail":' .. encodeJsonString(customerEmail or ''),
    '"companyName":' .. encodeJsonString(companyName or ''),
    '"category":' .. encodeJsonString(category),
    '"profession":' .. encodeJsonString('photographer'),
    '"mimeType":' .. encodeJsonString(getMimeTypeFromPath(exportPath)),
    '"mirrorToDrive":' .. (exportSettings.creatorhubMirrorToDrive == true and 'true' or 'false'),
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

local function describeHttpError(responseInfo)
  if type(responseInfo) ~= 'table' or type(responseInfo.error) ~= 'table' then
    return nil
  end

  return trim(responseInfo.error.name)
    or trim(responseInfo.error.errorCode)
    or trim(responseInfo.error.nativeCode)
end

local function requestDeskSession()
  local requestSucceeded, responseBody, responseInfo = LrTasks.pcall(function()
    return LrHttp.postMultipart(Defaults.deskBrokerUrl .. '/v1/lightroom/session', {}, {
      { field = 'Authorization', value = 'Bearer ' .. Defaults.deskBrokerSecret },
    }, 20)
  end)
  if not requestSucceeded or not responseBody then
    return nil, 'CreatorHub Desk kunne ikke nås. Åpne Desk og kontroller at du er logget inn. '
      .. (describeHttpError(responseInfo) or '')
  end
  local token = extractJsonString(responseBody, 'token')
  local apiBaseUrl = extractJsonString(responseBody, 'apiBaseUrl')
  local accountEmail = extractJsonString(responseBody, 'accountEmail')
  if not token or not apiBaseUrl then
    local errorCode = extractJsonString(responseBody, 'error') or 'desk_login_required'
    return nil, 'CreatorHub Desk er ikke innlogget (' .. errorCode .. ').'
  end
  return {
    token = token,
    apiBaseUrl = apiBaseUrl,
    accountEmail = accountEmail or Defaults.accountEmail,
  }, nil
end

local function uploadRenderedPhoto(photo, exportPath, exportSettings)
  local apiBaseUrl = trim(exportSettings.creatorhubApiBaseUrl) or Defaults.apiBaseUrl
  local pluginToken = trim(exportSettings.creatorhubPluginToken) or Defaults.pluginToken
  if hasDeskBroker() then
    local session, sessionError = requestDeskSession()
    if not session then
      return false, sessionError
    end
    apiBaseUrl = session.apiBaseUrl
    pluginToken = session.token
  end
  if not apiBaseUrl or not pluginToken then
    return false, 'CreatorHub API-base eller plugin-token mangler.'
  end
  if not trim(exportSettings.creatorhubProjectId) then
    return false, 'Velg eller lim inn CreatorHub prosjekt-ID før eksport.'
  end

  local requestBody = buildRequestBody(photo, exportPath, exportSettings)
  local endpoint = apiBaseUrl .. '/plugin/export-photo'
  local requestSucceeded, responseBody, responseInfo = LrTasks.pcall(function()
    return LrHttp.postMultipart(endpoint, {
      {
        name = 'metadataJson',
        value = requestBody,
        contentType = 'application/json',
      },
      {
        name = 'file',
        fileName = LrPathUtils.leafName(exportPath),
        filePath = exportPath,
        contentType = getMimeTypeFromPath(exportPath),
      },
    }, {
      { field = 'X-Lightroom-Plugin-Token', value = pluginToken },
    }, 900)
  end)

  if not requestSucceeded then
    return false, 'Nettverksfeil under opplasting. Den eksporterte filen er beholdt lokalt. ' .. tostring(responseBody)
  end

  if not responseBody then
    return false, 'Nettverksfeil under opplasting. Den eksporterte filen er beholdt lokalt. '
      .. (describeHttpError(responseInfo) or 'CreatorHub kunne ikke nås.')
  end

  if not string.find(responseBody, '"success"%s*:%s*true') then
    return false, responseBody
  end

  local assetId = extractJsonString(responseBody, 'assetId')
  local driveFileId = extractJsonString(responseBody, 'driveFileId')
  if assetId and driveFileId then
    return true, 'Sikret i CreatorHub. Drive-speil ' .. driveFileId .. ' er opprettet.'
  end
  if assetId then
    return true, 'Sikret og verifisert i CreatorHub.'
  end

  return false, 'CreatorHub svarte uten verifisert asset-id.'
end

return {
  startDialog = function(propertyTable)
    initializeSettings(propertyTable)
  end,

  sectionsForTopOfDialog = function(f, propertyTable)
    initializeSettings(propertyTable)
    local projectControl
    if Defaults.projects and #Defaults.projects > 0 then
      projectControl = f:popup_menu {
        value = bind 'creatorhubProjectId',
        items = Defaults.projects,
        width_in_chars = 35,
      }
    else
      projectControl = f:edit_field {
        value = bind 'creatorhubProjectId',
        width_in_chars = 35,
      }
    end
    local authenticationControl
    if hasDeskBroker() then
      authenticationControl = f:column {
        spacing = f:control_spacing(),
        f:static_text {
          title = 'Tilkoblet via CreatorHub Desk som ' .. Defaults.accountEmail,
          fill_horizontal = 1,
        },
        f:static_text {
          title = 'Innlogging og utlogging styres i CreatorHub Desk. Ingen permanent sky-token lagres i pluginen.',
          fill_horizontal = 1,
        },
      }
    else
      authenticationControl = f:column {
        spacing = f:control_spacing(),
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
      }
    end

    return {
      {
        title = 'CreatorHub Norge',
        synopsis = bind 'creatorhubCategory',
        f:column {
          spacing = f:control_spacing(),
          f:static_text {
            title = 'CreatorHub S3 er alltid hovedlager. Google Drive kan brukes som ekstra speil når kontoen er koblet.',
            fill_horizontal = 1,
          },
          f:static_text {
            title = 'Verifisert CreatorHub-konto: ' .. Defaults.accountEmail,
            fill_horizontal = 1,
          },
          authenticationControl,
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Collection / Galleri', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCollectionName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'CreatorHub-prosjekt', width = 140, alignment = 'right' },
            projectControl,
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = 'Prosjekt', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubProjectName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = '', width = 140 },
            f:checkbox {
              title = Defaults.driveAvailable
                and 'Lag privat speilkopi i Google Drive'
                or 'Google Drive er ikke koblet i CreatorHub',
              value = bind 'creatorhubMirrorToDrive',
              enabled = Defaults.driveAvailable,
            },
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
        local callSucceeded, uploadSuccess, uploadMessage = LrTasks.pcall(
          uploadRenderedPhoto,
          rendition.photo,
          renderedPathOrMessage,
          exportSettings
        )
        if not callSucceeded then
          failedMessages[#failedMessages + 1] = 'Uventet pluginfeil. Den eksporterte filen er beholdt lokalt. ' .. tostring(uploadSuccess)
        elseif uploadSuccess then
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
        'Eksport fullført. %d bilde%s er verifisert i CreatorHub%s.',
        uploadedCount,
        uploadedCount == 1 and '' or 'r',
        exportSettings.creatorhubMirrorToDrive == true and ' og speilet til Google Drive' or ''
      )
    )
  end,
}
