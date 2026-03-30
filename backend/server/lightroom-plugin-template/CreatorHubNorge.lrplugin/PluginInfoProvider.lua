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
        synopsis = 'Google Drive-lagring og showcase-publisering er aktivert.',
        f:column {
          spacing = f:control_spacing(),
          f:static_text {
            title = 'Denne pluginpakken er generert direkte fra CreatorHub for din bruker.',
          },
          f:static_text {
            title = 'API-base: ' .. Defaults.apiBaseUrl,
          },
          f:static_text {
            title = 'Plugin-token: ' .. tokenPreview(Defaults.pluginToken),
          },
          f:static_text {
            title = 'Eksporter via File > Export > CreatorHub Norge for å laste opp til Google Drive og publisere i showcase.',
          },
        },
      },
    }
  end,
}
