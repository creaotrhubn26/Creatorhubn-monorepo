// AUTO-GENERERT av frontend/scripts/generate-netlify-host-routes.mjs — ikke rediger for hånd.
// Kilde: frontend/vercel.json. Regenereres ved hver frontend-build.

export interface HostRoute {
  source: string;
  hostPattern: string | null;
  uaPattern: string | null;
  destination: string;
}

export const HOST_ROUTES: HostRoute[] = [
  {
    "source": "/robots.txt",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": null,
    "destination": "/theroleroom-robots.txt"
  },
  {
    "source": "/sitemap.xml",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": null,
    "destination": "https://creatorhub-backend-rtbl.onrender.com/api/theroleroom-sitemap.xml"
  },
  {
    "source": "/robots.txt",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": null,
    "destination": "/leadgrid-robots.txt"
  },
  {
    "source": "/sitemap.xml",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": null,
    "destination": "/leadgrid-sitemap.xml"
  },
  {
    "source": "/akademi",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/leadgrid/akademi.html"
  },
  {
    "source": "/akademi/samarbeid-salg-marked",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/leadgrid/akademi-samarbeid-salg-marked.html"
  },
  {
    "source": "/akademi/velge-crm-feltsalg",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/leadgrid/akademi-velge-crm-feltsalg.html"
  },
  {
    "source": "/",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/leadgrid/landing.html"
  },
  {
    "source": "/priser",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/leadgrid/priser.html"
  },
  {
    "source": "/skaffe-leads-guide",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/leadgrid/skaffe-leads-guide.html"
  },
  {
    "source": "/feltsalg-for-salgsteam",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/leadgrid/feltsalg-for-salgsteam.html"
  },
  {
    "source": "/personvern",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/leadgrid/personvern.html"
  },
  {
    "source": "/llms.txt",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": null,
    "destination": "/theroleroom-llms.txt"
  },
  {
    "source": "/llms.txt",
    "hostPattern": "((www\\.)?leadgrid\\.no|leadgrid\\.theroleroom\\.com)",
    "uaPattern": null,
    "destination": "/leadgrid-llms.txt"
  },
  {
    "source": "/casting-svindel-tegn",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/casting-svindel-tegn.html"
  },
  {
    "source": "/barn-samtykke-film",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/barn-samtykke-film.html"
  },
  {
    "source": "/bak-castingen",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/bak-castingen.html"
  },
  {
    "source": "/vart-syn",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/vart-syn.html"
  },
  {
    "source": "/selvtape-tips",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/selvtape-tips.html"
  },
  {
    "source": "/operativsystem",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/operativsystem.html"
  },
  {
    "source": "/norsk-casting-ordliste",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/norsk-casting-ordliste.html"
  },
  {
    "source": "/arbeidstilsynet-guide-produksjon",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/arbeidstilsynet-guide-produksjon.html"
  },
  {
    "source": "/sentimental-value-effekten",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/sentimental-value-effekten.html"
  },
  {
    "source": "/crew-i-norge-2026",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/crew-i-norge-2026.html"
  },
  {
    "source": "/innspillingsdag-koordinering",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/innspillingsdag-koordinering.html"
  },
  {
    "source": "/intimacy-coordinator-norge",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/intimacy-coordinator-norge.html"
  },
  {
    "source": "/kamera-folk-verktoy-2026",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/kamera-folk-verktoy-2026.html"
  },
  {
    "source": "/etterproduksjon-norge-2026",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/etterproduksjon-norge-2026.html"
  },
  {
    "source": "/produksjons-os",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/produksjons-os.html"
  },
  {
    "source": "/innholdsprodusent-norge",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/innholdsprodusent-norge.html"
  },
  {
    "source": "/dansestudio-norge",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/dansestudio-norge.html"
  },
  {
    "source": "/verktoy-for-filmutdanninger",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/verktoy-for-filmutdanninger.html"
  },
  {
    "source": "/norsk-casting-prosess",
    "hostPattern": "(www\\.)?theroleroom\\.com",
    "uaPattern": ".*(GPTBot|ChatGPT-User|OAI-SearchBot|Googlebot|Google-Extended|bingbot|anthropic-ai|Claude-Web|ClaudeBot|PerplexityBot|Perplexity-User|CCBot|cohere-ai|Bytespider|Applebot-Extended|DuckAssistBot|meta-externalagent|Amazonbot|facebookexternalhit|LinkedInBot|Twitterbot|Slackbot|WhatsApp|TelegramBot).*",
    "destination": "/geo/norsk-casting-prosess.html"
  },
  {
    "source": "/robots.txt",
    "hostPattern": null,
    "uaPattern": null,
    "destination": "/creatorhubn-robots.txt"
  },
  {
    "source": "/sitemap.xml",
    "hostPattern": null,
    "uaPattern": null,
    "destination": "/creatorhubn-sitemap.xml"
  },
  {
    "source": "/llms.txt",
    "hostPattern": null,
    "uaPattern": null,
    "destination": "/creatorhubn-llms.txt"
  }
];
