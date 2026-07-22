/**
 * techLogos.ts — ren mapper: tech-navn i en node → simple-icons-slug.
 *
 * simple-icons (åpen SVG-pakke, tusenvis av produkt-logoer) serveres via
 * https://cdn.simpleicons.org/<slug>. techLogoUrl() bygger URL-en; malen bruker
 * den i <img>. Node uten kjent tech → tom slug → nøytralt fallback-merke i malen.
 */

// Mer spesifikke mønstre FØR generiske (awslambda før amazonaws, nextjs før react).
const MAP: Array<[RegExp, string]> = [
  [/aws\s*lambda|\blambda\b/i, 'awslambda'],
  [/bedrock|claude|anthropic|sonnet|haiku/i, 'anthropic'],
  [/\baws\b|amazon(?!\s*lambda)/i, 'amazonaws'],
  [/next\.?js|nextjs/i, 'nextdotjs'],
  [/\breact\b/i, 'react'],
  [/\bvite\b/i, 'vite'],
  [/typescript|\bts\b/i, 'typescript'],
  [/\bnode(\.js)?\b/i, 'nodedotjs'],
  [/\bdeno\b/i, 'deno'],
  [/\bbun\b/i, 'bun'],
  [/tailwind/i, 'tailwindcss'],
  [/chrome|extension/i, 'googlechrome'],
  [/webrtc/i, 'webrtc'],
  [/supabase/i, 'supabase'],
  [/firebase/i, 'firebase'],
  [/\bneon\b/i, 'neon'],
  [/postgres/i, 'postgresql'],
  [/\bmysql\b/i, 'mysql'],
  [/mongo/i, 'mongodb'],
  [/\bredis\b/i, 'redis'],
  [/stripe/i, 'stripe'],
  [/resend/i, 'resend'],
  [/sendgrid/i, 'sendgrid'],
  [/twilio/i, 'twilio'],
  [/google\s*ads|\bads\b/i, 'googleads'],
  [/ga4|google\s*analytics|\bgtm\b|tag\s*manager/i, 'googleanalytics'],
  [/\bopenai\b|gpt/i, 'openai'],
  [/vercel/i, 'vercel'],
  [/\brender\b/i, 'render'],
  [/cloudflare/i, 'cloudflare'],
  [/\bdocker\b/i, 'docker'],
  [/kubernetes|\bk8s\b/i, 'kubernetes'],
  [/github/i, 'github'],
  [/gitlab/i, 'gitlab'],
  [/\bpython\b/i, 'python'],
  [/\bgo(lang)?\b/i, 'go'],
  [/\brust\b/i, 'rust'],
  [/auth0/i, 'auth0'],
  [/\bokta\b/i, 'okta'],
  [/elasticsearch|\belastic\b/i, 'elasticsearch'],
  [/\bkafka\b/i, 'apachekafka'],
  [/\bnginx\b/i, 'nginx'],
  [/graphql/i, 'graphql'],
  [/\bvue\b/i, 'vuedotjs'],
  [/svelte/i, 'svelte'],
  [/angular/i, 'angular'],
];

/** Node-tekst (label + undertekst) → simple-icons-slug, eller '' hvis ingen kjent tech. */
export function techLogoSlug(text: string): string {
  const s = text ?? '';
  for (const [re, slug] of MAP) if (re.test(s)) return slug;
  return '';
}

/** Full URL til den hvite logo-varianten (for mørk bakgrunn). '' hvis ingen slug. */
export function techLogoUrl(slug: string, variant: 'white' | 'color' = 'white'): string {
  if (!slug) return '';
  return variant === 'white'
    ? `https://cdn.simpleicons.org/${slug}/white`
    : `https://cdn.simpleicons.org/${slug}`;
}
