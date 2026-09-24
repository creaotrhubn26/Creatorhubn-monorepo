return {
  LrSdkVersion = 13.0,
  LrSdkMinimumVersion = 6.0,
  LrToolkitIdentifier = 'com.creatorhub.norge.lightroom',
  LrPluginName = LOC '$$$/CreatorHub/PluginName=CreatorHub',
  LrInitPlugin = 'PluginInit.lua',
  LrPluginInfoProvider = 'PluginInfoProvider.lua',
  LrPluginInfoUrl = 'https://www.creatorhubn.com',
  VERSION = {
    major = __CREATORHUB_VERSION_MAJOR__,
    minor = __CREATORHUB_VERSION_MINOR__,
    revision = __CREATORHUB_VERSION_REVISION__,
    build = __CREATORHUB_VERSION_BUILD__,
  },
  LrExportServiceProvider = {
    title = LOC '$$$/CreatorHub/ExportServiceName=CreatorHub',
    file = 'ExportServiceProvider.lua',
  },
}
