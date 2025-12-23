function toSnakeCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function mapTableNames(names) {
  return names.reduce((acc, name) => {
    acc[name] = toSnakeCase(name);
    return acc;
  }, {});
}

// demo run
const camel = ['actionUsageStats', 'adminNotifications', 'clientGalleries', 'cmsPages'];
console.log(mapTableNames(camel));

// ✅ ESM export (not CommonJS)
export { toSnakeCase, mapTableNames };
