local LrView = import 'LrView'

local Defaults = require 'CreatorHubDefaults'

local function tokenPreview(token)
  if not token or token == '' then
    return LOC '$$$/CreatorHub/NotGenerated=Not generated'
  end

  if string.len(token) <= 12 then
    return token
  end

  return string.sub(token, 1, 8) .. '...' .. string.sub(token, -4)
end

return {
  sectionsForTopOfDialog = function(f, _propertyTable)
    return {
      {
        title = LOC '$$$/CreatorHub/PluginName=CreatorHub',
        synopsis = LOC '$$$/CreatorHub/Info/Synopsis=CreatorHub S3 with optional Google Drive mirror.',
        f:column {
          spacing = f:control_spacing(),
          f:static_text {
            title = LOC '$$$/CreatorHub/Info/Generated=This plug-in was generated directly by CreatorHub for your account.',
          },
          f:static_text {
            title = LOC('$$$/CreatorHub/Info/VerifiedAccount=Verified account: ^1', Defaults.accountEmail),
          },
          f:static_text {
            title = Defaults.deskBrokerUrl ~= ''
              and LOC '$$$/CreatorHub/Info/DeskSignIn=Sign-in: CreatorHub Desk SSO (short-lived session)'
              or LOC '$$$/CreatorHub/Info/TokenSignIn=Sign-in: separate Lightroom token',
          },
          f:static_text {
            title = LOC('$$$/CreatorHub/Info/ApiBase=API base: ^1', Defaults.apiBaseUrl),
          },
          f:static_text {
            title = LOC('$$$/CreatorHub/Info/Token=Plug-in token: ^1', tokenPreview(Defaults.pluginToken)),
          },
          f:static_text {
            title = Defaults.driveAvailable
              and LOC '$$$/CreatorHub/Info/DriveAvailable=Export to CreatorHub S3, with an optional private Google Drive mirror.'
              or LOC '$$$/CreatorHub/Info/DriveUnavailable=Export to CreatorHub S3. Connect Google Drive in CreatorHub for optional mirroring.',
          },
        },
      },
    }
  end,
}
