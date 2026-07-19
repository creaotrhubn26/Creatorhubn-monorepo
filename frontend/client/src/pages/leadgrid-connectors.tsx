/**
 * leadgrid-connectors.tsx — Connector Marketplace på /leadgrid/connectors
 *
 * Viser frem integrasjons-økosystemet bygget på Public API v1 (PR #873).
 *
 * Innhold:
 *   - 12 connector-cards i 4 kategorier (CRM / Automation / Communication / Developer)
 *   - Status-badge (Live / Beta / Coming Soon) m/ release date
 *   - Category filter
 *   - Stats-strip (live / coming soon / events / OpenAPI 3.1)
 *   - Developer CTA m/ inline curl-eksempel + Swagger UI / OpenAPI JSON / API-key
 *   - Webhook-events grid (22 events)
 *   - Partner Program CTA
 *
 * Mørkt tema som matcher leadgrid-landing (warm-dark + lilla accent) —
 * siden lå i lys lilla/hvit og brøt totalt med resten av leadgrid.no.
 * Ikoner (lucide) i stedet for emoji-logoer.
 */

import React, { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Code,
  Key,
  Webhook,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Zap,
  Database,
  FileSpreadsheet,
  Link2,
  Cloud,
  Workflow,
  Wrench,
  Bot,
  Users,
  Mail,
  Github,
  FileJson,
  type LucideIcon,
} from "lucide-react";

interface Connector {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  status: "live" | "beta" | "coming_soon";
  category: "crm" | "communication" | "automation" | "developer";
  features: string[];
  docUrl?: string;
  releaseDate?: string;
}

const CONNECTORS: Connector[] = [
  // Import (native)
  {
    id: "csv_import",
    name: "CSV / Excel-import",
    description:
      "Last opp eksisterende lead-lister fra Pipedrive/HubSpot/Excel. 3-stegs wizard m/ column-mapping + dedup.",
    Icon: FileSpreadsheet,
    status: "live",
    category: "crm",
    features: [
      "CSV + XLSX",
      "Auto-mapping + manuell mapping",
      "Dedup på e-post / telefon / navn+by",
      "Rollback per batch",
    ],
    docUrl: "/leadgrid/import",
  },
  {
    id: "url_extract",
    name: "URL-basert ekstraksjon",
    description:
      "Lim inn opptil 20 nettside-/SoMe-URLer — AI-en vår ekstraherer firma-data automatisk.",
    Icon: Link2,
    status: "live",
    category: "automation",
    features: [
      "Vanlige nettsider",
      "LinkedIn company pages",
      "Instagram-profiler",
      "Rate-limit 20 URL/min",
    ],
    docUrl: "/leadgrid/import",
  },
  // CRM
  {
    id: "salesforce",
    name: "Salesforce",
    description:
      "Bi-directional sync av leads + recommendations til Salesforce Sales Cloud",
    Icon: Cloud,
    status: "coming_soon",
    category: "crm",
    features: [
      "Lead-sync",
      "Activity-sync",
      "OAuth 2.0",
      "Webhook bi-directional",
    ],
    releaseDate: "Q3 2026",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description:
      "Sync Leadgrid leads + NBA-anbefalinger til HubSpot CRM",
    Icon: Database,
    status: "coming_soon",
    category: "crm",
    features: [
      "Lead-sync",
      "Pipeline-sync",
      "OAuth 2.0",
      "Property mapping",
    ],
    releaseDate: "Q3 2026",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description:
      "Hent leads fra Pipedrive og bruk Leadgrid Intelligence Engine for scoring",
    Icon: Workflow,
    status: "coming_soon",
    category: "crm",
    features: ["Lead import", "Webhook listener", "Intelligence overlay"],
    releaseDate: "Q4 2026",
  },
  // Automation
  {
    id: "zapier",
    name: "Zapier",
    description:
      "1000+ apper koblet til Leadgrid via API v1. Triggers + actions.",
    Icon: Zap,
    status: "live",
    category: "automation",
    features: [
      "Lead created trigger",
      "NBA triggered trigger",
      "Create lead action",
      "Update lead action",
    ],
    docUrl: "/leadgrid/docs/zapier",
  },
  {
    id: "make",
    name: "Make (Integromat)",
    description: "Visuelle workflows m/ Leadgrid",
    Icon: Wrench,
    status: "live",
    category: "automation",
    features: [
      "Full API v1 dekning",
      "Webhook subscriber",
      "Modul-bibliotek",
    ],
    docUrl: "/leadgrid/docs/make",
  },
  {
    id: "n8n",
    name: "n8n",
    description: "Self-hosted automation m/ Leadgrid-node",
    Icon: Bot,
    status: "beta",
    category: "automation",
    features: ["Open-source", "Self-hosted", "Custom workflows"],
  },
  // Communication
  {
    id: "slack",
    name: "Slack",
    description:
      "Webhook → Slack-kanal når NBA endrer, deal vinnes/tapes, territory.breach",
    Icon: MessageSquare,
    status: "live",
    category: "communication",
    features: [
      "recommendation.created → Slack",
      "deal.won → Slack",
      "followup.due → Slack",
      "territory.breach → Slack",
    ],
    docUrl: "/leadgrid/docs/slack",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description:
      "Samme webhook-events til Teams-kanal eller individuell chat",
    Icon: Users,
    status: "coming_soon",
    category: "communication",
    features: [
      "Adaptive Cards",
      "@-mention selger",
      "Bi-directional reply",
    ],
    releaseDate: "Q3 2026",
  },
  {
    id: "email",
    name: "E-post (Resend)",
    description: "Sendgrid/Resend transactional e-post fra Leadgrid",
    Icon: Mail,
    status: "live",
    category: "communication",
    features: [
      "NBA-summary daglig",
      "Deal won notifications",
      "Custom templates",
    ],
  },
  // Developer
  {
    id: "github",
    name: "GitHub Actions",
    description: "CI-eksempler for å integrere mot API v1",
    Icon: Github,
    status: "live",
    category: "developer",
    features: [
      "Workflow templates",
      "Auth-eksempler",
      "Webhook-validation",
    ],
    docUrl: "/leadgrid/docs/github-actions",
  },
  {
    id: "openapi",
    name: "OpenAPI 3.1 Spec",
    description:
      "Auto-generer klient-bibliotek (Python, Ruby, Go, etc.)",
    Icon: FileJson,
    status: "live",
    category: "developer",
    features: ["Maskinellbar spec", "Swagger UI", "Codegen-støtte"],
    docUrl: "/api/v1/openapi.json",
  },
  {
    id: "custom",
    name: "Custom Webhooks",
    description:
      "Lytt på 22 event-types og HMAC-signerte payloads",
    Icon: Webhook,
    status: "live",
    category: "developer",
    features: [
      "22 event types",
      "HMAC-SHA256 signering",
      "Auto-retry m/ exp backoff",
      "Secret-rotering (7d grace)",
    ],
    docUrl: "/leadgrid/docs/webhooks",
  },
];

const CATEGORIES = [
  { id: "all", label: "Alle", icon: Sparkles },
  { id: "crm", label: "CRM", icon: Database },
  { id: "automation", label: "Automation", icon: Zap },
  { id: "communication", label: "Kommunikasjon", icon: MessageSquare },
  { id: "developer", label: "Utvikler", icon: Code },
];

const WEBHOOK_EVENTS = [
  "lead.created",
  "lead.updated",
  "lead.status_changed",
  "lead.assigned",
  "lead.scored",
  "lead.pipeline_stage_changed",
  "lead.tagged",
  "lead.archived",
  "activity.created",
  "note.created",
  "visit.logged",
  "meeting.booked",
  "proposal.sent",
  "deal.won",
  "deal.lost",
  "followup.due",
  "followup.overdue",
  "recommendation.created",
  "recommendation.executed",
  "recommendation.snoozed",
  "route.created",
  "route.started",
];

export default function LeadgridConnectorsPage() {
  const [category, setCategory] = useState<string>("all");
  const filtered =
    category === "all"
      ? CONNECTORS
      : CONNECTORS.filter((c) => c.category === category);

  return (
    <div className="min-h-screen bg-[#05010f] text-[#F4F0FF]">
      {/* Hero */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-500/15 text-purple-300 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-purple-500/25">
          <Zap className="w-4 h-4" />
          Public API v1 m/ OpenAPI 3.1
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-transparent">
          Connector Marketplace
        </h1>
        <p className="text-xl text-purple-100/60 max-w-2xl mx-auto mb-8">
          Koble Leadgrid til alle dine verktøy via stabilt versjonert API + 22 webhook-events.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="/api/v1/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-full font-medium hover:bg-purple-500 transition"
          >
            <Code className="w-4 h-4" /> Swagger UI{" "}
            <ExternalLink className="w-3 h-3" />
          </a>
          <Link href="/leadgrid/api-keys">
            <button className="inline-flex items-center gap-2 bg-transparent border-2 border-purple-400 text-purple-300 px-6 py-3 rounded-full font-medium hover:bg-purple-500/10 transition">
              <Key className="w-4 h-4" /> Lag API-key
            </button>
          </Link>
        </div>
      </section>

      {/* Stats-strip */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { value: "5", label: "Live nå" },
            { value: "4", label: "Beta / Coming Soon" },
            { value: "22", label: "Webhook-events" },
            { value: "OpenAPI 3.1", label: "Schema-versjon" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center bg-white/[0.04] border border-white/10 rounded-xl p-4"
            >
              <div className="text-2xl font-bold text-purple-300">
                {stat.value}
              </div>
              <div className="text-xs text-purple-100/50">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Category filter */}
      <section className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                  active
                    ? "bg-purple-600 text-white"
                    : "bg-white/[0.06] text-purple-100/70 hover:bg-white/[0.12]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Connector grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {filtered.map((c) => (
            <ConnectorCard key={c.id} connector={c} />
          ))}
        </div>
      </section>

      {/* Developer CTA */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#171130] to-[#2a1548] border border-purple-500/20 rounded-3xl p-12 text-white">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-purple-500/20 px-3 py-1 rounded-full text-xs font-medium mb-4">
                <Code className="w-3 h-3" /> FOR UTVIKLERE
              </div>
              <h2 className="text-3xl font-bold mb-4">
                Bygg din egen connector på 30 minutter
              </h2>
              <p className="text-purple-100/60 mb-6">
                Public API v1 har stabilt schema. Auth via API-key, 60 RPM rate-limit, HMAC-signerte webhooks.
                Vi har OpenAPI 3.1-spec for code-gen i Python/Go/Ruby/TypeScript.
              </p>
              <div className="bg-[#03000a] border border-white/10 rounded-lg p-4 font-mono text-sm mb-4 overflow-x-auto">
                <span className="text-green-400">$</span> curl -H{" "}
                <span className="text-yellow-300">
                  &quot;Authorization: Bearer lgk_live_...&quot;
                </span>{" "}
                \<br />
                &nbsp;&nbsp;
                <span className="text-blue-300">
                  https://api.leadgrid.no/api/v1/leads
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/api/v1/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white text-gray-900 px-5 py-2 rounded-lg font-medium hover:bg-gray-100 transition inline-flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" /> Swagger UI
                </a>
                <a
                  href="/api/v1/openapi.json"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-500 transition inline-flex items-center gap-2"
                >
                  <Code className="w-4 h-4" /> OpenAPI JSON
                </a>
                <Link href="/leadgrid/api-keys">
                  <button className="bg-purple-500/20 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-500/30 transition inline-flex items-center gap-2">
                    <Key className="w-4 h-4" /> Lag API-key
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Webhook events */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">
          22 Webhook-events
        </h2>
        <p className="text-center text-purple-100/60 mb-8">
          Lytt på det som matter. HMAC-SHA256-signert payload.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
          {WEBHOOK_EVENTS.map((event) => (
            <div
              key={event}
              className="bg-white/[0.04] rounded-lg px-4 py-3 border border-white/10 text-sm font-mono text-purple-300"
            >
              <Webhook className="inline w-3 h-3 mr-1" /> {event}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-purple-700 to-pink-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Bygger du en connector?
          </h2>
          <p className="text-xl opacity-90 mb-8">
            Bli en del av Partner Programmet — co-marketing, revenue share, prioritert support.
          </p>
          <Link href="/leadgrid/partners">
            <button className="bg-white text-purple-700 px-8 py-4 rounded-full font-bold text-lg shadow-xl hover:scale-105 transition">
              Søk Partner Status{" "}
              <ArrowRight className="inline w-5 h-5 ml-2" />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function ConnectorCard({ connector }: { connector: Connector }) {
  const { Icon } = connector;
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl hover:border-purple-400/40 hover:shadow-[0_0_30px_rgba(167,139,250,0.15)] transition p-6 flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
          <Icon className="w-6 h-6 text-purple-300" />
        </div>
        <StatusBadge
          status={connector.status}
          releaseDate={connector.releaseDate}
        />
      </div>
      <h3 className="text-xl font-bold mb-1 text-[#F4F0FF]">{connector.name}</h3>
      <p className="text-sm text-purple-100/60 mb-4">{connector.description}</p>
      <ul className="space-y-1 mb-4 flex-1">
        {connector.features.map((f) => (
          <li
            key={f}
            className="flex items-center gap-2 text-sm text-purple-100/80"
          >
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {connector.docUrl && (
        <a
          href={connector.docUrl}
          className="text-sm font-medium text-purple-300 hover:text-purple-200 inline-flex items-center gap-1 mt-auto"
        >
          Se docs <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  releaseDate,
}: {
  status: Connector["status"];
  releaseDate?: string;
}) {
  if (status === "live") {
    return (
      <div className="inline-flex items-center gap-1 bg-green-500/15 text-green-300 px-2 py-1 rounded-full text-xs font-bold border border-green-500/25">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />{" "}
        Live
      </div>
    );
  }
  if (status === "beta") {
    return (
      <div className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-300 px-2 py-1 rounded-full text-xs font-bold border border-blue-500/25">
        <Sparkles className="w-3 h-3" /> Beta
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 bg-orange-500/15 text-orange-300 px-2 py-1 rounded-full text-xs font-bold border border-orange-500/25">
      <Clock className="w-3 h-3" /> {releaseDate ?? "Snart"}
    </div>
  );
}
