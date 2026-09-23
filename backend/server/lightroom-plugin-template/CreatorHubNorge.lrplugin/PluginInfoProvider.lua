local LrView = import 'LrView'

local Defaults = require 'CreatorHubDefaults'

local function tokenPreview(token)
  if not token or token == '' then
    return 'Ikke generert'
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
        title = 'CreatorHub Norge',
        synopsis = 'CreatorHub S3 med valgfritt Google Drive-speil.',
        f:column {
          spacing = f:control_spacing(),
          f:static_text {
            title = 'Denne pluginpakken er generert direkte fra CreatorHub for din bruker.',
          },
          f:static_text {
            title = 'Verifisert konto: ' .. Defaults.accountEmail,
          },
          f:static_text {
            title = Defaults.deskBrokerUrl ~= ''
              and 'Innlogging: CreatorHub Desk SSO (kortlivet sesjon)'
              or 'Innlogging: separat Lightroom-token',
          },
          f:static_text {
            title = 'API-base: ' .. Defaults.apiBaseUrl,
          },
          f:static_text {
            title = 'Plugin-token: ' .. tokenPreview(Defaults.pluginToken),
          },
          f:static_text {
            title = Defaults.driveAvailable
              and 'Eksporter til CreatorHub S3, med valgfri privat speilkopi i Google Drive.'
              or 'Eksporter til CreatorHub S3. Koble Google Drive i CreatorHub for valgfri speiling.',
          },
        },
      },
    }
  end,
}
