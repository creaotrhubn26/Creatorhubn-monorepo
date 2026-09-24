local LrApplication = import 'LrApplication'
local LrDialogs = import 'LrDialogs'
local LrFileUtils = import 'LrFileUtils'
local LrHttp = import 'LrHttp'
local LrPathUtils = import 'LrPathUtils'
local LrPrefs = import 'LrPrefs'
local LrTasks = import 'LrTasks'
local LrUUID = import 'LrUUID'
local LrView = import 'LrView'
local bind = LrView.bind

local Defaults = require 'CreatorHubDefaults'

local prefs = LrPrefs.prefsForPlugin()

local function metadataString(photo, key, formatted)
  local ok, value = LrTasks.pcall(function()
    if formatted then
      return photo:getFormattedMetadata(key)
    end
    return photo:getRawMetadata(key)
  end)
  if not ok or value == nil then
    return ''
  end
  return tostring(value)
end

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
  exportSettings.creatorhubProjectItems = exportSettings.creatorhubProjectItems or Defaults.projects or {}
  exportSettings.creatorhubDriveAvailable = exportSettings.creatorhubDriveAvailable == true or Defaults.driveAvailable == true
  exportSettings.creatorhubConnectionStatus = trim(exportSettings.creatorhubConnectionStatus)
    or 'Installerte pluginfiler funnet. Kontrollerer CreatorHub Desk…'
end

local function buildRequestBody(photo, exportPath, exportSettings)
  local title = trim(photo:getFormattedMetadata('title')) or LrPathUtils.removeExtension(LrPathUtils.leafName(exportPath))
  local caption = trim(photo:getFormattedMetadata('caption')) or 'Eksportert fra CreatorHub Lightroom plugin'
  local collectionName = trim(exportSettings.creatorhubCollectionName)
  local projectId = trim(exportSettings.creatorhubProjectId)
  local projectName = trim(exportSettings.creatorhubProjectName)
  local availableProjects = exportSettings.creatorhubProjectItems or Defaults.projects
  if not projectName and projectId and availableProjects then
    for _, project in ipairs(availableProjects) do
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
    '"cameraMake":' .. encodeJsonString(metadataString(photo, 'cameraMake', true)),
    '"cameraModel":' .. encodeJsonString(metadataString(photo, 'cameraModel', true)),
    '"lens":' .. encodeJsonString(metadataString(photo, 'lens', true)),
    '"focalLength":' .. encodeJsonString(metadataString(photo, 'focalLength', true)),
    '"aperture":' .. encodeJsonString(metadataString(photo, 'aperture', true)),
    '"shutterSpeed":' .. encodeJsonString(metadataString(photo, 'shutterSpeed', true)),
    '"isoSpeedRating":' .. encodeJsonString(metadataString(photo, 'isoSpeedRating', false)),
    '"dimensions":' .. encodeJsonString(metadataString(photo, 'dimensions', true)),
    '"gps":' .. encodeJsonString(metadataString(photo, 'gps', true)),
    '"colorLabel":' .. encodeJsonString(metadataString(photo, 'colorNameForLabel', true)),
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

local function extractJsonBoolean(responseBody, fieldName)
  if not responseBody then
    return nil
  end
  local value = string.match(responseBody, '"' .. fieldName .. '"%s*:%s*(%a+)')
  if value == 'true' then
    return true
  end
  if value == 'false' then
    return false
  end
  return nil
end

local function decodeUrlComponent(value)
  local decoded = string.gsub(value or '', '+', ' ')
  return string.gsub(decoded, '%%(%x%x)', function(hex)
    return string.char(tonumber(hex, 16))
  end)
end

local function parseProjectOptions(encoded)
  local projects = {}
  for entry in string.gmatch(encoded or '', '([^&]+)') do
    local separator = string.find(entry, '=', 1, true)
    if separator then
      local id = decodeUrlComponent(string.sub(entry, 1, separator - 1))
      local title = decodeUrlComponent(string.sub(entry, separator + 1))
      if id ~= '' then
        projects[#projects + 1] = { title = title ~= '' and title or id, value = id }
      end
    end
  end
  return projects
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
    return nil, LOC('$$$/CreatorHub/Error/DeskUnavailable=CreatorHub Desk could not be reached. Open Desk and verify that you are signed in. ^1', describeHttpError(responseInfo) or '')
  end
  local token = extractJsonString(responseBody, 'token')
  local apiBaseUrl = extractJsonString(responseBody, 'apiBaseUrl')
  local accountEmail = extractJsonString(responseBody, 'accountEmail')
  local projectOptions = parseProjectOptions(extractJsonString(responseBody, 'projectOptions'))
  local driveAvailable = extractJsonBoolean(responseBody, 'driveAvailable')
  if not token or not apiBaseUrl then
    local errorCode = extractJsonString(responseBody, 'error') or 'desk_login_required'
    return nil, LOC('$$$/CreatorHub/Error/DeskSignedOut=CreatorHub Desk is not signed in (^1).', errorCode)
  end
  return {
    token = token,
    apiBaseUrl = apiBaseUrl,
    accountEmail = accountEmail or Defaults.accountEmail,
    projects = projectOptions,
    driveAvailable = driveAvailable == true,
  }, nil
end

local function queueRoot()
  return LrPathUtils.child(
    LrPathUtils.getStandardFilePath('appData'),
    'CreatorHub/Lightroom/OfflineQueue'
  )
end

local function queueRenderedPhoto(photo, exportPath, exportSettings)
  local root = queueRoot()
  LrFileUtils.createAllDirectories(root)
  local id = string.gsub(LrUUID.generateUUID(), '[^%w]', '')
  local queueFileName = id .. '-' .. LrPathUtils.leafName(exportPath)
  local queuedPath = LrPathUtils.child(root, queueFileName)
  local metadataPath = LrPathUtils.child(root, id .. '.json')
  local requestBody = buildRequestBody(photo, exportPath, exportSettings)
  local queuedBody = string.sub(requestBody, 1, -2)
    .. ',"queueFileName":' .. encodeJsonString(queueFileName) .. '}'
  LrFileUtils.copy(exportPath, queuedPath)
  LrFileUtils.writeFile(metadataPath, queuedBody)
  return queuedPath
end

local function postRenderedFile(exportPath, requestBody, apiBaseUrl, pluginToken)
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
    return nil, 'Network error while uploading. ' .. tostring(responseBody)
  end
  if not responseBody then
    return nil, 'Network error while uploading. '
      .. (describeHttpError(responseInfo) or 'CreatorHub could not be reached.')
  end
  if not string.find(responseBody, '"success"%s*:%s*true') then
    return nil, responseBody
  end
  return responseBody, nil
end

local function drainOfflineQueue(exportSettings, deskSession)
  local root = queueRoot()
  if not LrFileUtils.exists(root) then
    return 0, 0
  end
  local apiBaseUrl = deskSession and deskSession.apiBaseUrl
    or trim(exportSettings.creatorhubApiBaseUrl)
    or Defaults.apiBaseUrl
  local pluginToken = deskSession and deskSession.token
    or trim(exportSettings.creatorhubPluginToken)
    or Defaults.pluginToken
  if not apiBaseUrl or not pluginToken then
    return 0, 0
  end

  local completed = 0
  local remaining = 0
  for metadataPath in LrFileUtils.directoryEntries(root) do
    if string.match(metadataPath, '%.json$') then
      local requestBody = LrFileUtils.readFile(metadataPath)
      local queueFileName = extractJsonString(requestBody, 'queueFileName')
      if queueFileName and (string.find(queueFileName, '/', 1, true) or string.find(queueFileName, '\\', 1, true)) then
        queueFileName = nil
      end
      local queuedPath = queueFileName and LrPathUtils.child(root, queueFileName) or nil
      if queuedPath and LrFileUtils.exists(queuedPath) then
        local responseBody = postRenderedFile(queuedPath, requestBody, apiBaseUrl, pluginToken)
        if responseBody then
          LrFileUtils.delete(queuedPath)
          LrFileUtils.delete(metadataPath)
          completed = completed + 1
        else
          remaining = remaining + 1
        end
      else
        remaining = remaining + 1
      end
    end
  end
  return completed, remaining
end

local function uploadRenderedPhoto(photo, exportPath, exportSettings, deskSession)
  local apiBaseUrl = trim(exportSettings.creatorhubApiBaseUrl) or Defaults.apiBaseUrl
  local pluginToken = trim(exportSettings.creatorhubPluginToken) or Defaults.pluginToken
  if hasDeskBroker() then
    if not deskSession then
      return false, LOC '$$$/CreatorHub/Error/SessionMissing=The CreatorHub Desk session is missing. Open Desk and try the export again.'
    end
    apiBaseUrl = deskSession.apiBaseUrl
    pluginToken = deskSession.token
  end
  if not apiBaseUrl or not pluginToken then
    return false, LOC '$$$/CreatorHub/Error/CredentialsMissing=The CreatorHub API base or plug-in token is missing.'
  end
  if not trim(exportSettings.creatorhubProjectId) then
    return false, LOC '$$$/CreatorHub/Error/ProjectRequired=Select a CreatorHub project before exporting.'
  end

  local requestBody = buildRequestBody(photo, exportPath, exportSettings)
  local responseBody, uploadError = postRenderedFile(exportPath, requestBody, apiBaseUrl, pluginToken)
  if not responseBody then
    return false, uploadError
  end

  local assetId = extractJsonString(responseBody, 'assetId')
  local driveFileId = extractJsonString(responseBody, 'driveFileId')
  local driveMirrorError = extractJsonString(responseBody, 'driveMirrorError')
  if assetId and driveFileId then
    return true, LOC('$$$/CreatorHub/Status/SecuredDrive=Secured in CreatorHub. Drive mirror ^1 was created.', driveFileId), 'mirrored', assetId
  end
  if assetId and exportSettings.creatorhubMirrorToDrive == true and driveMirrorError then
    return true, LOC('$$$/CreatorHub/Status/DriveFailed=Secured in CreatorHub, but Google Drive mirroring failed: ^1', driveMirrorError), 'warning', assetId
  end
  if assetId and exportSettings.creatorhubMirrorToDrive == true then
    return true, LOC '$$$/CreatorHub/Status/DriveUnconfirmed=Secured in CreatorHub, but the Drive mirror was not confirmed.', 'warning', assetId
  end
  if assetId then
    return true, LOC '$$$/CreatorHub/Status/Secured=Secured and verified in CreatorHub.', 'not_requested', assetId
  end

  return false, 'CreatorHub svarte uten verifisert asset-id.'
end

local function deletePublishedPhotos(publishSettings, arrayOfPhotoIds, deletedCallback)
  initializeSettings(publishSettings)
  local deskSession = nil
  if hasDeskBroker() then
    local sessionError
    deskSession, sessionError = requestDeskSession()
    if not deskSession then
      LrDialogs.message(LOC '$$$/CreatorHub/PluginName=CreatorHub', sessionError, 'critical')
      return
    end
  end
  local apiBaseUrl = deskSession and deskSession.apiBaseUrl
    or trim(publishSettings.creatorhubApiBaseUrl)
    or Defaults.apiBaseUrl
  local pluginToken = deskSession and deskSession.token
    or trim(publishSettings.creatorhubPluginToken)
    or Defaults.pluginToken
  local responseBody = LrHttp.postMultipart(apiBaseUrl .. '/plugin/unpublish-photos', {
    { name = 'assetIds', value = table.concat(arrayOfPhotoIds, ',') },
  }, {
    { field = 'X-Lightroom-Plugin-Token', value = pluginToken },
  }, 60)
  if not responseBody or not string.find(responseBody, '"success"%s*:%s*true') then
    LrDialogs.message(
      LOC '$$$/CreatorHub/PluginName=CreatorHub',
      'CreatorHub could not remove the selected photos from the publish service.',
      'critical'
    )
    return
  end
  for _, photoId in ipairs(arrayOfPhotoIds) do
    deletedCallback(photoId)
  end
end

return {
  allowFileFormats = { 'JPEG', 'TIFF' },
  supportsIncrementalPublish = true,
  deletePhotosFromPublishedCollection = deletePublishedPhotos,
  metadataThatTriggersRepublish = {
    default = true,
    title = true,
    caption = true,
    keywords = true,
    gps = true,
    dateCreated = true,
  },
  exportPresetFields = {
    { key = 'creatorhubProjectId', default = '' },
    { key = 'creatorhubProjectName', default = '' },
    { key = 'creatorhubCollectionName', default = '' },
    { key = 'creatorhubMirrorToDrive', default = false },
    { key = 'creatorhubCustomerName', default = '' },
    { key = 'creatorhubCustomerEmail', default = '' },
    { key = 'creatorhubCompanyName', default = '' },
    { key = 'creatorhubCategory', default = 'Lightroom Uploads' },
  },
  startDialog = function(propertyTable)
    initializeSettings(propertyTable)
    if hasDeskBroker() then
      LrTasks.startAsyncTask(function()
        local session, sessionError = requestDeskSession()
        if not session then
          propertyTable.creatorhubConnectionStatus = sessionError or LOC '$$$/CreatorHub/Error/DeskUnavailableShort=CreatorHub Desk could not be reached.'
          return
        end
        propertyTable.creatorhubProjectItems = session.projects or {}
        if #propertyTable.creatorhubProjectItems == 0 then
          propertyTable.creatorhubConnectionStatus = LOC(
            '$$$/CreatorHub/Status/NoWritableProjects=Connected as ^1, but no writable projects were found.',
            session.accountEmail or Defaults.accountEmail
          )
        else
          propertyTable.creatorhubConnectionStatus = LOC(
            '$$$/CreatorHub/Status/ReadyAs=Ready through CreatorHub Desk as ^1',
            session.accountEmail or Defaults.accountEmail
          )
        end
        propertyTable.creatorhubDriveAvailable = session.driveAvailable == true
        if not propertyTable.creatorhubDriveAvailable then
          propertyTable.creatorhubMirrorToDrive = false
        end
        local selectedProject = trim(propertyTable.creatorhubProjectId)
        local selectedExists = false
        for _, project in ipairs(propertyTable.creatorhubProjectItems) do
          if project.value == selectedProject then
            selectedExists = true
            break
          end
        end
        if not selectedExists then
          propertyTable.creatorhubProjectId = propertyTable.creatorhubProjectItems[1]
            and propertyTable.creatorhubProjectItems[1].value
            or ''
        end
      end)
    end
  end,

  sectionsForTopOfDialog = function(f, propertyTable)
    initializeSettings(propertyTable)
    local projectControl = f:popup_menu {
      value = bind 'creatorhubProjectId',
      items = bind 'creatorhubProjectItems',
      width_in_chars = 35,
    }
    local authenticationControl
    if hasDeskBroker() then
      authenticationControl = f:column {
        spacing = f:control_spacing(),
        f:static_text {
          title = bind 'creatorhubConnectionStatus',
          fill_horizontal = 1,
        },
        f:static_text {
          title = LOC '$$$/CreatorHub/Export/DeskAuth=Sign-in and sign-out are managed in CreatorHub Desk. No permanent cloud token is stored in the plug-in.',
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
        title = LOC '$$$/CreatorHub/Export/SectionTitle=CreatorHub',
        synopsis = bind 'creatorhubCategory',
        f:column {
          spacing = f:control_spacing(),
          f:static_text {
            title = LOC '$$$/CreatorHub/Export/Storage=CreatorHub S3 is always the source of truth. Google Drive can be used as an extra mirror when connected.',
            fill_horizontal = 1,
          },
          f:static_text {
            title = LOC('$$$/CreatorHub/Export/VerifiedAccount=Verified CreatorHub account: ^1', Defaults.accountEmail),
            fill_horizontal = 1,
          },
          authenticationControl,
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = LOC '$$$/CreatorHub/Export/Collection=Collection / gallery', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCollectionName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = LOC '$$$/CreatorHub/Export/Project=CreatorHub project', width = 140, alignment = 'right' },
            projectControl,
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = LOC '$$$/CreatorHub/Export/ProjectName=Project name', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubProjectName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = '', width = 140 },
            f:checkbox {
              title = LOC '$$$/CreatorHub/Export/DriveMirror=Create a private Google Drive mirror',
              value = bind 'creatorhubMirrorToDrive',
              enabled = bind 'creatorhubDriveAvailable',
            },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = LOC '$$$/CreatorHub/Export/Customer=Customer', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCustomerName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = LOC '$$$/CreatorHub/Export/CustomerEmail=Customer email', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCustomerEmail', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = LOC '$$$/CreatorHub/Export/Company=Company', width = 140, alignment = 'right' },
            f:edit_field { value = bind 'creatorhubCompanyName', width_in_chars = 35 },
          },
          f:row {
            spacing = f:label_spacing(),
            f:static_text { title = LOC '$$$/CreatorHub/Export/Category=Category', width = 140, alignment = 'right' },
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
      title = LOC '$$$/CreatorHub/Export/Progress=Sending photos to CreatorHub',
    }

    local totalRenditions = exportContext.exportSession:countRenditions()
    local uploadedCount = 0
    local driveMirroredCount = 0
    local driveWarningMessages = {}
    local failedMessages = {}
    local queuedCount = 0
    local deskSession = nil
    local drivePreflightWarning = nil
    if hasDeskBroker() then
      local sessionError
      deskSession, sessionError = requestDeskSession()
      if not deskSession then
        LrDialogs.message(LOC '$$$/CreatorHub/PluginName=CreatorHub', sessionError or LOC '$$$/CreatorHub/Error/DeskUnavailableShort=CreatorHub Desk could not be reached.', 'critical')
        progressScope:done()
        return
      end
      exportSettings.creatorhubProjectItems = deskSession.projects or {}
      if not trim(exportSettings.creatorhubProjectId) and exportSettings.creatorhubProjectItems[1] then
        exportSettings.creatorhubProjectId = exportSettings.creatorhubProjectItems[1].value
      end
      local selectedProjectExists = false
      for _, project in ipairs(exportSettings.creatorhubProjectItems) do
        if project.value == trim(exportSettings.creatorhubProjectId) then
          selectedProjectExists = true
          break
        end
      end
      if not selectedProjectExists then
        LrDialogs.message(
          LOC '$$$/CreatorHub/PluginName=CreatorHub',
          LOC '$$$/CreatorHub/Error/ProjectUnavailable=The selected project no longer exists or you do not have write access. Select an available project and try again.',
          'critical'
        )
        progressScope:done()
        return
      end
      if exportSettings.creatorhubMirrorToDrive == true and deskSession.driveAvailable ~= true then
        exportSettings.creatorhubMirrorToDrive = false
        drivePreflightWarning = LOC '$$$/CreatorHub/Warning/DriveSkipped=Google Drive was skipped because it is not connected to the CreatorHub account.'
      end
    end

    local resumedCount, remainingQueuedCount = drainOfflineQueue(exportSettings, deskSession)

    for _, rendition in exportContext:renditions { stopIfCanceled = true } do
      if progressScope:isCanceled() then
        break
      end

      local success, renderedPathOrMessage = rendition:waitForRender()
      if success then
        local callSucceeded, uploadSuccess, uploadMessage, driveStatus, publishedAssetId = LrTasks.pcall(
          uploadRenderedPhoto,
          rendition.photo,
          renderedPathOrMessage,
          exportSettings,
          deskSession
        )
        if not callSucceeded then
          local queueSucceeded, queueResult = LrTasks.pcall(
            queueRenderedPhoto,
            rendition.photo,
            renderedPathOrMessage,
            exportSettings
          )
          if queueSucceeded then
            queuedCount = queuedCount + 1
            failedMessages[#failedMessages + 1] = LOC('$$$/CreatorHub/Error/UnexpectedQueued=Unexpected plug-in error. The file was added to the CreatorHub offline queue. ^1', tostring(uploadSuccess))
          else
            failedMessages[#failedMessages + 1] = LOC('$$$/CreatorHub/Error/QueueFailed=Unexpected plug-in error, and the offline queue failed: ^1', tostring(queueResult))
          end
        elseif uploadSuccess then
          uploadedCount = uploadedCount + 1
          if publishedAssetId and rendition.recordPublishedPhotoId then
            rendition:recordPublishedPhotoId(publishedAssetId)
          end
          if driveStatus == 'mirrored' then
            driveMirroredCount = driveMirroredCount + 1
          elseif driveStatus == 'warning' then
            driveWarningMessages[#driveWarningMessages + 1] = uploadMessage
          end
        else
          local queueSucceeded, queueResult = LrTasks.pcall(
            queueRenderedPhoto,
            rendition.photo,
            renderedPathOrMessage,
            exportSettings
          )
          if queueSucceeded then
            queuedCount = queuedCount + 1
            failedMessages[#failedMessages + 1] = (uploadMessage or LOC '$$$/CreatorHub/Error/UnknownUpload=Unknown upload error.')
              .. LOC '$$$/CreatorHub/Status/QueuedSuffix= The file was added to the CreatorHub offline queue.'
          else
            failedMessages[#failedMessages + 1] = (uploadMessage or LOC '$$$/CreatorHub/Error/UnknownUpload=Unknown upload error.')
              .. LOC('$$$/CreatorHub/Error/QueueSuffix= Could not save the offline queue: ^1', tostring(queueResult))
          end
        end
      else
        failedMessages[#failedMessages + 1] = tostring(renderedPathOrMessage)
      end

      progressScope:setPortionComplete(uploadedCount + #failedMessages, totalRenditions)
    end

    progressScope:done()

    if drivePreflightWarning and uploadedCount > 0 then
      driveWarningMessages[#driveWarningMessages + 1] = drivePreflightWarning
    end

    if #failedMessages > 0 then
      LrDialogs.message(
        LOC '$$$/CreatorHub/PluginName=CreatorHub',
        LOC(
          '$$$/CreatorHub/Export/FailureSummary=Export completed with errors. ^1 uploaded (^2 resumed), ^3 queued, ^4 failed.^n^n^5',
          tostring(uploadedCount + resumedCount), tostring(resumedCount), tostring(queuedCount),
          tostring(#failedMessages), table.concat(failedMessages, '\n')
        ),
        'warning'
      )
      return
    end

    if #driveWarningMessages > 0 then
      LrDialogs.message(
        LOC '$$$/CreatorHub/PluginName=CreatorHub',
        string.format(
          '%d bilde%s er sikret og verifisert i CreatorHub. Google Drive har %d advarsel%s.\n\n%s',
          uploadedCount,
          uploadedCount == 1 and '' or 'r',
          #driveWarningMessages,
          #driveWarningMessages == 1 and '' or 'er',
          table.concat(driveWarningMessages, '\n')
        ),
        'warning'
      )
      return
    end

    LrDialogs.message(
      LOC '$$$/CreatorHub/PluginName=CreatorHub',
      LOC(
        '$$$/CreatorHub/Export/Complete=Export complete. ^1 photo(s) verified in CreatorHub^2.',
        tostring(uploadedCount + resumedCount),
        driveMirroredCount > 0 and LOC '$$$/CreatorHub/Export/DriveSuffix= and mirrored to Google Drive' or ''
      ) .. (remainingQueuedCount > 0 and ('\n' .. tostring(remainingQueuedCount) .. ' file(s) remain in the offline queue.') or '')
    )
  end,
}
