local LrHttp = import 'LrHttp'
local LrTasks = import 'LrTasks'

local Defaults = require 'CreatorHubDefaults'

local function hasDeskBroker()
  return Defaults.deskBrokerUrl
    and Defaults.deskBrokerUrl ~= ''
    and Defaults.deskBrokerSecret
    and Defaults.deskBrokerSecret ~= ''
end

if hasDeskBroker() then
  LrTasks.startAsyncTask(function()
    while true do
      LrTasks.pcall(function()
        LrHttp.postMultipart(Defaults.deskBrokerUrl .. '/v1/lightroom/heartbeat', {}, {
          { field = 'Authorization', value = 'Bearer ' .. Defaults.deskBrokerSecret },
        }, 5)
      end)
      LrTasks.sleep(60)
    end
  end)
end
