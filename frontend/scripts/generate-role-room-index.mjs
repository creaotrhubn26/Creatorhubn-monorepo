/**
 * Builds a host-specific HTML shell from Vite's compiled index.html.
 *
 * The React application is shared by several domains, but crawlers and API
 * clients do not necessarily execute the synchronous host-aware JavaScript in
 * index.html. Keeping a second source document would make security/bootstrap
 * scripts drift. This post-build step instead copies the compiled shell (with
 * its hashed assets) and replaces only public metadata for theroleroom.com.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '..', 'client', 'dist');
const sourcePath = resolve(distDir, 'index.html');
const targetPath = resolve(distDir, 'role-room-index.html');

const metadata = {
  title: 'The Role Room — Fra klasserom til kino, ett system for film- og innholdsproduksjon',
  description:
    'Operativsystemet som følger deg fra utdanning til bransje — fra idé via casting og gjennomføring til produksjonen er distribuert og sett av publikum.',
  canonical: 'https://theroleroom.com/',
  image: 'https://theroleroom.com/role-room-assets/landing_backdrop_with_logo.webp',
};

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceMeta(html, attribute, key, content) {
  const expression = new RegExp(
    `<meta\\b(?=[^>]*\\b${attribute}=["']${key}["'])[^>]*>`,
    'i',
  );
  if (!expression.test(html)) {
    throw new Error(`generate-role-room-index: mangler meta ${attribute}=${key}`);
  }
  return html.replace(
    expression,
    `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(content)}" />`,
  );
}

function replaceLink(html, rel, href, extra = '') {
  const expression = new RegExp(
    `<link\\b(?=[^>]*\\brel=["']${rel}["'])[^>]*>`,
    'i',
  );
  if (!expression.test(html)) {
    throw new Error(`generate-role-room-index: mangler link rel=${rel}`);
  }
  return html.replace(
    expression,
    `<link rel="${escapeAttribute(rel)}" href="${escapeAttribute(href)}"${extra} />`,
  );
}

let html = await readFile(sourcePath, 'utf8');
html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${metadata.title}</title>`);
html = replaceMeta(html, 'name', 'description', metadata.description);
html = replaceMeta(html, 'name', 'theme-color', '#0A0118');
html = replaceMeta(html, 'name', 'apple-mobile-web-app-title', 'The Role Room');
html = replaceMeta(html, 'property', 'og:site_name', 'The Role Room');
html = replaceMeta(html, 'property', 'og:title', metadata.title);
html = replaceMeta(html, 'property', 'og:description', metadata.description);
html = replaceMeta(html, 'property', 'og:url', metadata.canonical);
html = replaceMeta(html, 'property', 'og:image', metadata.image);
html = replaceMeta(html, 'property', 'og:locale', 'nb_NO');
html = replaceMeta(html, 'name', 'twitter:title', metadata.title);
html = replaceMeta(html, 'name', 'twitter:description', metadata.description);
html = replaceMeta(html, 'name', 'twitter:image', metadata.image);
html = replaceLink(html, 'canonical', metadata.canonical);
html = replaceLink(html, 'icon', '/TheRoleRoom_App_Logo.png', ' type="image/png"');
html = replaceLink(html, 'shortcut icon', '/TheRoleRoom_App_Logo.png', ' type="image/png"');
html = replaceLink(html, 'apple-touch-icon', '/TheRoleRoom_App_Logo.png');
html = replaceLink(html, 'manifest', '/theroleroom.webmanifest');

html = html.replace(
  /<script\b[^>]*\bdata-seo-ld=["'][^"']+["'][^>]*>[\s\S]*?<\/script>/gi,
  '',
);
const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': 'https://theroleroom.com/#organization',
    name: 'The Role Room',
    legalName: 'Creatorhub AS',
    url: metadata.canonical,
    logo: 'https://theroleroom.com/TheRoleRoom_App_Logo.png',
    email: 'support@theroleroom.com',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://theroleroom.com/#website',
    name: 'The Role Room',
    url: metadata.canonical,
    publisher: { '@id': 'https://theroleroom.com/#organization' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': 'https://theroleroom.com/#software',
    name: 'The Role Room',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: metadata.canonical,
    description:
      'Produksjonsflate for film, TV og innholdsproduksjon med casting, talentportal, crew og produksjonsplan i ett rom.',
    publisher: { '@id': 'https://theroleroom.com/#organization' },
  },
];
const jsonLd = structuredData
  .map(
    (value, index) =>
      `<script type="application/ld+json" data-seo-ld="role-room-${index}">${JSON.stringify(value).replace(/</g, '\\u003c')}</script>`,
  )
  .join('\n');
html = html.replace('</head>', `${jsonLd}\n</head>`);

if (!/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']\/(?:js|assets)\//i.test(html)) {
  throw new Error('generate-role-room-index: bygget skall mangler Vite-assets eller Role Room-metadata');
}

const requiredMetadata = [
  `<title>${metadata.title}</title>`,
  `<meta name="description" content="${escapeAttribute(metadata.description)}" />`,
  '<meta name="apple-mobile-web-app-title" content="The Role Room" />',
  '<meta property="og:site_name" content="The Role Room" />',
  `<meta property="og:title" content="${escapeAttribute(metadata.title)}" />`,
  `<meta property="og:url" content="${metadata.canonical}" />`,
  `<meta name="twitter:title" content="${escapeAttribute(metadata.title)}" />`,
  `<link rel="canonical" href="${metadata.canonical}" />`,
  '<link rel="manifest" href="/theroleroom.webmanifest" />',
];
for (const fragment of requiredMetadata) {
  if (!html.includes(fragment)) {
    throw new Error(`generate-role-room-index: mangler forventet metadata: ${fragment}`);
  }
}

const roleRoomStructuredDataCount = html.match(/data-seo-ld="role-room-/g)?.length ?? 0;
if (roleRoomStructuredDataCount !== structuredData.length) {
  throw new Error('generate-role-room-index: ufullstendig Role Room structured data');
}
if (/<(?:title|meta|link)\b[^>]*(?:CreatorHub Norge|creatorhubn\.com)/i.test(html)) {
  throw new Error('generate-role-room-index: CreatorHub-metadata lekket til Role Room-skallet');
}

await writeFile(targetPath, html, 'utf8');
console.log('generate-role-room-index: dist/role-room-index.html skrevet fra bygget index.html');
