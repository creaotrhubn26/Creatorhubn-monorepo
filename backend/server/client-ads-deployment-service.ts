/**
 * client-ads-deployment-service.ts
 *
 * N2-B5 — Tracking-deployment per metode.
 *
 * Genererer deploy-payload (snippets / API-calls / JSON) for hver av de
 * 5 tracking-methods som er definert i client_ads_configs.tracking_method:
 *
 *   1. gtag_snippets   — Klassisk <script> som lim-ind på klient-side
 *   2. gtm_api         — Vi sender tags til klientens GTM-container via API
 *   3. proxy           — Server-side: klient POST-er til vår /track-endpoint
 *                        som så fyrer gtag på vegne. Token-gated.
 *   4. wordpress_plugin— Vår WP-plugin pull-er config fra /wp-config-endpoint
 *   5. manual          — Bare oppskrift, ingen automasjon
 *
 * Hver method returnerer { instructions, payload } så frontend kan vise
 * riktig copy-paste-snippet eller "Klar til deploy"-knapp.
 */

import type { Pool } from "pg";
import crypto from "node:crypto";

export type TrackingMethod = 'pending' | 'proxy' | 'gtag_snippets' | 'gtm_api' | 'wordpress_plugin' | 'manual';

export interface DeploymentPayload {
  method: TrackingMethod;
  ready: boolean;
  instructions: string[];                     // Bestemor-vennlige steg
  snippets?: Array<{
    location: 'head' | 'body' | 'before-conversion' | 'thank-you-page';
    description: string;
    code: string;
    language: 'html' | 'js' | 'json';
  }>;
  apiCalls?: Array<{
    description: string;
    method: string;
    endpoint: string;
    note?: string;
  }>;
  proxyConfig?: {
    proxyToken: string;
    trackEndpointUrl: string;
    examplePayload: Record<string, unknown>;
  };
  warnings?: string[];
}

interface ConfigRow {
  id: string;
  client_name: string;
  client_website_url: string;
  google_ads_customer_id: string | null;
  oauth_connected_at: string | null;
  tracking_method: TrackingMethod;
  tracking_proxy_token: string | null;
}

interface ActionRow {
  id: string;
  action_name: string;
  display_name: string | null;
  google_ads_label: string | null;
  goal_category: string;
  trigger_type: string;
  url_pattern: string | null;
  trigger_config: Record<string, unknown>;
  default_value: number | null;
  currency: string;
  use_dynamic_value: boolean;
}

async function loadConfigAndActions(
  pool: Pool, configId: string,
): Promise<{ config: ConfigRow; actions: ActionRow[] } | null> {
  const c = await pool.query<ConfigRow>(
    `SELECT id::text, client_name, client_website_url, google_ads_customer_id,
            oauth_connected_at, tracking_method, tracking_proxy_token
     FROM client_ads_configs WHERE id = $1::uuid`,
    [configId],
  );
  if (c.rowCount === 0) return null;
  const a = await pool.query<ActionRow>(
    `SELECT id::text, action_name, display_name, google_ads_label, goal_category,
            trigger_type, url_pattern, trigger_config, default_value, currency,
            use_dynamic_value
     FROM client_ads_actions
     WHERE config_id = $1::uuid AND is_active = TRUE`,
    [configId],
  );
  return { config: c.rows[0], actions: a.rows };
}

/**
 * Method 1 — Klassiske gtag-snippets.
 * Klient limer inn én <head>-block + per-action event-fire.
 */
function buildGtagSnippets(
  config: ConfigRow, actions: ActionRow[], googleAdsConversionId?: string,
): DeploymentPayload {
  const conversionId = googleAdsConversionId
    || process.env.GOOGLE_ADS_CONVERSION_ID
    || `AW-CONVERSION_ID`;

  const headSnippet = `<!-- Global site tag (gtag.js) — Google Ads conversion tracking -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${conversionId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${conversionId}');
</script>`;

  const snippets: DeploymentPayload['snippets'] = [{
    location: 'head',
    description: `Global gtag-script — lim inn rett før </head> på ALLE sider`,
    code: headSnippet,
    language: 'html',
  }];

  for (const action of actions) {
    if (!action.google_ads_label) {
      snippets.push({
        location: 'before-conversion',
        description: `${action.display_name || action.action_name} — Google Ads-label mangler. Provisjon i Setup-fanen.`,
        code: `<!-- mangler google_ads_label for ${action.action_name} -->`,
        language: 'html',
      });
      continue;
    }

    const sendTo = `${conversionId}/${action.google_ads_label}`;
    const valueFragment = action.use_dynamic_value
      ? `'value': YOUR_DYNAMIC_VALUE,  // erstatt med ekte verdi`
      : `'value': ${action.default_value ?? 0},`;

    const eventName = action.goal_category === 'purchase' ? 'purchase'
      : action.goal_category === 'submit_lead_form' ? 'generate_lead'
      : action.goal_category === 'sign_up' ? 'sign_up'
      : 'conversion';

    let snippet = '';
    if (action.trigger_type === 'page_load') {
      snippet = `<!-- ${action.display_name || action.action_name} — fyrer ved page_load (URL: ${action.url_pattern || 'alle'}) -->
<script>
  gtag('event', '${eventName}', {
    'send_to': '${sendTo}',
    ${valueFragment}
    'currency': '${action.currency}'
  });
</script>`;
    } else if (action.trigger_type === 'form_submit') {
      const selector = (action.trigger_config?.formSelector as string) || 'form';
      snippet = `<!-- ${action.display_name || action.action_name} — fyrer ved form_submit -->
<script>
  document.querySelector('${selector}')?.addEventListener('submit', function() {
    gtag('event', '${eventName}', {
      'send_to': '${sendTo}',
      ${valueFragment}
      'currency': '${action.currency}'
    });
  });
</script>`;
    } else if (action.trigger_type === 'click') {
      const selector = (action.trigger_config?.clickSelector as string) || 'a.cta';
      snippet = `<!-- ${action.display_name || action.action_name} — fyrer ved klikk på '${selector}' -->
<script>
  document.querySelectorAll('${selector}').forEach(function(el) {
    el.addEventListener('click', function() {
      gtag('event', '${eventName}', {
        'send_to': '${sendTo}',
        ${valueFragment}
        'currency': '${action.currency}'
      });
    });
  });
</script>`;
    } else {
      snippet = `<!-- ${action.display_name || action.action_name} — manuell trigger (kall gtag fra appkoden din) -->
gtag('event', '${eventName}', {
  send_to: '${sendTo}',
  ${action.use_dynamic_value ? "value: YOUR_DYNAMIC_VALUE," : `value: ${action.default_value ?? 0},`}
  currency: '${action.currency}'
});`;
    }

    snippets.push({
      location: action.trigger_type === 'page_load' && action.url_pattern?.includes('thank') ? 'thank-you-page' : 'body',
      description: `${action.display_name || action.action_name} (${action.trigger_type})`,
      code: snippet,
      language: action.trigger_type === 'manual' ? 'js' : 'html',
    });
  }

  return {
    method: 'gtag_snippets',
    ready: !!config.google_ads_customer_id && actions.every((a) => !!a.google_ads_label),
    instructions: [
      `1. Kopier "Global gtag-script" inn rett før </head> i klientens HTML.`,
      `2. For hver konvertering: lim inn snippeten på riktig side eller hook.`,
      `3. Test ved å trigge handlingen og se etter "Tag fired" i Google Tag Assistant.`,
      `4. Conversions vises i Google Ads UI etter 24-48 timer.`,
    ],
    snippets,
    warnings: actions.filter((a) => !a.google_ads_label).map(
      (a) => `${a.action_name} mangler google_ads_label — provisjon via "Setup → Conversions" først.`,
    ),
  };
}

/**
 * Method 2 — GTM API.
 * Vi sender tags til klientens GTM container (memo #87 O4).
 * Her returnerer vi JSON payload som API-en konsumerer.
 */
function buildGtmApiPayload(
  config: ConfigRow, actions: ActionRow[], googleAdsConversionId?: string,
): DeploymentPayload {
  const conversionId = googleAdsConversionId || process.env.GOOGLE_ADS_CONVERSION_ID || 'AW-CONVERSION_ID';

  const tags = actions.map((a) => ({
    name: `Google Ads Conversion — ${a.display_name || a.action_name}`,
    type: 'gtag',
    parameter: [
      { type: 'template', key: 'tagId', value: conversionId },
      { type: 'template', key: 'eventName', value: a.goal_category === 'purchase' ? 'purchase' : 'conversion' },
      { type: 'template', key: 'eventParameters', value: JSON.stringify({
        send_to: a.google_ads_label ? `${conversionId}/${a.google_ads_label}` : conversionId,
        value: a.use_dynamic_value ? '{{Dynamic Value}}' : a.default_value ?? 0,
        currency: a.currency,
      }) },
    ],
    firingTriggerId: [`trigger_${a.action_name}`],
  }));

  return {
    method: 'gtm_api',
    ready: !!config.google_ads_customer_id && actions.every((a) => !!a.google_ads_label),
    instructions: [
      `1. Klikk "Deploy via GTM API" — vi sender tags-payload til klientens GTM-container.`,
      `2. Du må ha GTM Container ID + access via klientens OAuth-flyt.`,
      `3. Tags går automatisk live etter publisering i GTM (manuell godkjenning kreves i container).`,
      `4. Verifiser i Google Tag Assistant + Real-time Reports etter 5 min.`,
    ],
    apiCalls: [{
      description: 'Lag tags i klientens GTM workspace',
      method: 'POST',
      endpoint: `/api/role-room/ads-configs/${config.id}/gtm/deploy`,
      note: `Sender ${tags.length} tags`,
    }],
    snippets: [{
      location: 'body',
      description: 'GTM tags-payload (referanse)',
      code: JSON.stringify({ tags }, null, 2),
      language: 'json',
    }],
    warnings: actions.filter((a) => !a.google_ads_label).map(
      (a) => `${a.action_name} mangler google_ads_label`,
    ),
  };
}

/**
 * Method 3 — Server-side proxy.
 * Vi gir klienten en token + endpoint. Når deres backend trenger å fyre
 * en konvertering, POST-er de til vår /track-endpoint som så bruker
 * Google Ads API direkte (sikrere — token aldri eksponert i browser).
 */
async function buildProxyConfig(
  pool: Pool, config: ConfigRow, actions: ActionRow[],
): Promise<DeploymentPayload> {
  // Sørg for at proxy-token finnes
  let proxyToken = config.tracking_proxy_token;
  if (!proxyToken) {
    proxyToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `UPDATE client_ads_configs
         SET tracking_proxy_token = $1, updated_at = NOW()
       WHERE id = $2::uuid`,
      [proxyToken, config.id],
    );
  }

  const trackUrl = (process.env.BACKEND_BASE_URL || 'https://creatorhub-backend-rtbl.onrender.com')
    + '/api/role-room/ads/track';

  return {
    method: 'proxy',
    ready: !!config.google_ads_customer_id && actions.length > 0,
    instructions: [
      `1. Klient lagrer proxy-token (gjør IKKE den public — bare i backend).`,
      `2. Når en konvertering skjer (kjøp / signup / lead), POST til vårt endpoint.`,
      `3. Vi videresender til Google Ads med deres OAuth-token (sikker server-side).`,
      `4. Verifiser leveranse via /diagnostics-tab (B6).`,
    ],
    proxyConfig: {
      proxyToken,
      trackEndpointUrl: trackUrl,
      examplePayload: {
        config_id: config.id,
        action: actions[0]?.action_name || 'product_purchase',
        value: 1490,
        currency: 'NOK',
        order_id: 'ORD-12345',
        user_email_hashed: 'sha256(email)',
      },
    },
    snippets: [{
      location: 'body',
      description: 'Eksempel curl-call fra klientens backend',
      code: `curl -X POST '${trackUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Proxy-Token: ${proxyToken}' \\
  -d '{
    "config_id": "${config.id}",
    "action": "${actions[0]?.action_name || 'product_purchase'}",
    "value": 1490,
    "currency": "NOK",
    "order_id": "ORD-12345"
  }'`,
      language: 'js',
    }],
  };
}

/**
 * Method 4 — WordPress-plugin.
 * Vår plugin pull-er konfig + actions fra et offentlig endpoint.
 * Returnerer JSON-konfig klienten kan kopiere inn i plugin-settings.
 */
function buildWordpressConfig(config: ConfigRow, actions: ActionRow[]): DeploymentPayload {
  const pluginConfigUrl = (process.env.BACKEND_BASE_URL || 'https://creatorhub-backend-rtbl.onrender.com')
    + `/api/role-room/ads-configs/${config.id}/wp-config?token=${config.tracking_proxy_token || 'MISSING'}`;

  return {
    method: 'wordpress_plugin',
    ready: !!config.google_ads_customer_id && actions.length > 0,
    instructions: [
      `1. Installer "Role Room Ads"-pluginen fra WordPress.org (eller upload zip).`,
      `2. I plugin-settings, lim inn config-URL nedenfor.`,
      `3. Plugin henter automatisk gtag-config + WooCommerce-hooks for purchase-events.`,
      `4. Test ved å gjøre en testbestilling i sandbox.`,
    ],
    snippets: [{
      location: 'body',
      description: 'Config-URL for "Role Room Ads"-pluginen',
      code: pluginConfigUrl,
      language: 'js',
    }],
    warnings: !config.tracking_proxy_token
      ? ['Proxy-token mangler — bytt til "proxy" method først for å generere token']
      : undefined,
  };
}

/**
 * Method 5 — Manuell.
 * Bare oppskrift, ingen automasjon. Brukes for klienter med custom-stack.
 */
function buildManualGuide(config: ConfigRow, actions: ActionRow[]): DeploymentPayload {
  return {
    method: 'manual',
    ready: true,
    instructions: [
      `1. Klienten har en custom-stack vi ikke automatiserer for.`,
      `2. Send dem PDF-guide med ${actions.length} action-events + Google Ads conversion-ID.`,
      `3. Be dem fyre 'conversion'-event for hver action med riktig 'send_to'-param.`,
      `4. Du må manuelt bekrefte deployment i "Diagnostics"-fanen.`,
    ],
    snippets: actions.map((a) => ({
      location: 'body' as const,
      description: `${a.display_name || a.action_name} — manuell oppskrift`,
      code: `# ${a.display_name || a.action_name}
# Når denne handlingen skjer (${a.trigger_type}), fyre:
gtag('event', 'conversion', {
  send_to: '${process.env.GOOGLE_ADS_CONVERSION_ID || 'AW-XXX'}/${a.google_ads_label || 'LABEL_MISSING'}',
  value: ${a.default_value ?? 0},
  currency: '${a.currency}'
});`,
      language: 'js' as const,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────

export async function buildDeploymentPayload(
  pool: Pool,
  opts: { configId: string; method: TrackingMethod; googleAdsConversionId?: string },
): Promise<DeploymentPayload | { error: string }> {
  const loaded = await loadConfigAndActions(pool, opts.configId);
  if (!loaded) return { error: 'not_found' };

  const { config, actions } = loaded;

  if (actions.length === 0) {
    return {
      method: opts.method,
      ready: false,
      instructions: [],
      warnings: ['Ingen actions konfigurert. Provisjon i Setup-fanen først.'],
    };
  }

  switch (opts.method) {
    case 'gtag_snippets':
      return buildGtagSnippets(config, actions, opts.googleAdsConversionId);
    case 'gtm_api':
      return buildGtmApiPayload(config, actions, opts.googleAdsConversionId);
    case 'proxy':
      return await buildProxyConfig(pool, config, actions);
    case 'wordpress_plugin':
      return buildWordpressConfig(config, actions);
    case 'manual':
      return buildManualGuide(config, actions);
    case 'pending':
      return {
        method: 'pending',
        ready: false,
        instructions: ['Velg en deployment-metode først (gtag_snippets, gtm_api, proxy, wordpress_plugin eller manual).'],
      };
  }
}

/**
 * Marker en deployment som applied — setter tracking_deployed_at og
 * (valgfritt) bytter tracking_method på client_ads_configs.
 */
export async function markDeploymentApplied(
  pool: Pool,
  opts: { configId: string; method: TrackingMethod },
): Promise<{ ok: boolean }> {
  await pool.query(
    `UPDATE client_ads_configs
       SET tracking_method = $1, tracking_deployed_at = NOW(), updated_at = NOW()
     WHERE id = $2::uuid`,
    [opts.method, opts.configId],
  );
  return { ok: true };
}

/**
 * Verifiser at gtag/pixel faktisk er deployet på klientens nettside.
 * Henter klientens HTML og leter etter conversion-ID + send_to-strings.
 *
 * Note: dette er en lett-versjon. For ekte verifisering trenger vi
 * Google Ads Diagnostics API (B6) for å bekrefte at conversion mottas.
 */
export async function validateDeployment(
  pool: Pool,
  configId: string,
): Promise<{
  ok: boolean;
  conversionIdFound: boolean;
  actionsFound: string[];
  actionsMissing: string[];
  fetchedAt: string;
  url: string;
  statusCode?: number;
  error?: string;
}> {
  const loaded = await loadConfigAndActions(pool, configId);
  if (!loaded) {
    return {
      ok: false, conversionIdFound: false, actionsFound: [], actionsMissing: [],
      fetchedAt: new Date().toISOString(), url: '', error: 'not_found',
    };
  }

  const { config, actions } = loaded;
  const url = config.client_website_url;
  const conversionId = process.env.GOOGLE_ADS_CONVERSION_ID || '';

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (RoleRoom-AdsValidator)' },
    });
    const html = await r.text();

    const conversionIdFound = !!conversionId && html.includes(conversionId);
    const actionsFound: string[] = [];
    const actionsMissing: string[] = [];

    for (const a of actions) {
      if (!a.google_ads_label) {
        actionsMissing.push(`${a.action_name} (label mangler)`);
        continue;
      }
      const sendToString = `${conversionId}/${a.google_ads_label}`;
      if (html.includes(sendToString) || html.includes(a.google_ads_label)) {
        actionsFound.push(a.action_name);
      } else {
        actionsMissing.push(a.action_name);
      }
    }

    return {
      ok: conversionIdFound && actionsMissing.length === 0,
      conversionIdFound, actionsFound, actionsMissing,
      fetchedAt: new Date().toISOString(),
      url, statusCode: r.status,
    };
  } catch (err) {
    return {
      ok: false, conversionIdFound: false, actionsFound: [], actionsMissing: actions.map((a) => a.action_name),
      fetchedAt: new Date().toISOString(),
      url, error: (err as Error).message,
    };
  }
}
