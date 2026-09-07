/**
 * leadgrid-connectors.tsx — Connector Marketplace på /leadgrid/connectors
 *
 * Skiller tydelig mellom implementerte import-/API-flater og planlagte,
 * ferdigpakkede connectorer. Offentlige påstander skal samsvare med
 * Public Leads API v1 og faktisk routede sider.
 */

import React, { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Cloud,
  Code,
  Database,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  Key,
  Link2,
  MessageSquare,
  Sparkles,
  Users,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface Connector {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  status: "live" | "planned";
  category: "crm" | "communication" | "automation" | "developer";
  features: string[];
  docUrl?: string;
  docLabel?: string;
}

const CONNECTORS: Connector[] = [
  {
    id: "csv_import",
    name: "CSV / Excel-import",
    description:
      "Innebygd Leadgrid-flyt for innloggede workspaces, med forhåndsvisning og kolonnemapping.",
    Icon: FileSpreadsheet,
    status: "live",
    category: "crm",
    features: [
      "CSV, XLSX og XLS",
      "Forhåndsvisning før import",
      "Automatisk og manuell kolonnemapping",
      "Dedup på e-post, telefon eller navn + by",
    ],
    docUrl: "/leadgrid/import",
    docLabel: "Åpne import",
  },
  {
    id: "url_research",
    name: "URL Research",
    description:
      "Innebygd research-flyt for innloggede workspaces, med opptil 100 nettadresser per batch.",
    Icon: Link2,
    status: "live",
    category: "automation",
    features: [
      "1–100 nettadresser per batch",
      "Brønnøysund-, nettsted- og kartresearch",
      "Løpende fremdrift",
      "Retry eller hopp over per element",
    ],
    docUrl: "/leadgrid/import",
    docLabel: "Åpne URL Research",
  },
  {
    id: "public_api",
    name: "Public Leads API v1",
    description:
      "Prosjektbundet REST-API for leads, anbefalinger og append-only resultatdata fra for eksempel Dentum.",
    Icon: Code,
    status: "live",
    category: "developer",
    features: [
      "Prosjektbundet tilgang som standard",
      "Les og opprett leads",
      "Les Next Best Action-anbefalinger",
      "Skriv seks typer prosjektresultater",
    ],
    docUrl: "/leadgrid/utviklere",
    docLabel: "Les API-dokumentasjonen",
  },
  {
    id: "openapi",
    name: "OpenAPI 3.1",
    description:
      "Maskinlesbar spesifikasjon for den implementerte Public Leads API v1-kontrakten.",
    Icon: FileJson,
    status: "live",
    category: "developer",
    features: [
      "OpenAPI 3.1",
      "Swagger UI",
      "Eksakte request- og response-skjemaer",
      "Prosjekt- og scope-dokumentasjon",
    ],
    docUrl: "/api/v1/openapi.json",
    docLabel: "Åpne OpenAPI JSON",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description:
      "Planlagt ferdigpakket connector. Bruk Public Leads API v1 for en kontrollert custom-integrasjon i mellomtiden.",
    Icon: Cloud,
    status: "planned",
    category: "crm",
    features: ["Lead-mapping", "Prosjektavgrensning", "Kontrollert synk"],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description:
      "Planlagt ferdigpakket connector. Ingen offisiell toveis HubSpot-sync er publisert ennå.",
    Icon: Database,
    status: "planned",
    category: "crm",
    features: ["Lead-mapping", "Pipeline-mapping", "Prosjektavgrensning"],
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description:
      "Planlagt ferdigpakket connector. CSV-import og Public Leads API v1 er tilgjengelig i dag.",
    Icon: Workflow,
    status: "planned",
    category: "crm",
    features: ["Lead-import", "Feltmapping", "Prosjektavgrensning"],
  },
  {
    id: "zapier",
    name: "Zapier",
    description:
      "Planlagt adapter. Det finnes ikke en publisert Leadgrid Zapier-app eller triggerkatalog ennå.",
    Icon: Zap,
    status: "planned",
    category: "automation",
    features: ["Prosjektbundne actions", "Resultathendelser", "Retry-strategi"],
  },
  {
    id: "make",
    name: "Make",
    description:
      "Planlagt modulsett. Custom HTTP-moduler kan bruke Public Leads API v1 etter godkjent API-tilgang.",
    Icon: Wrench,
    status: "planned",
    category: "automation",
    features: ["HTTP-basert integrasjon", "Prosjektscope", "Outcome-events"],
  },
  {
    id: "n8n",
    name: "n8n",
    description:
      "Planlagt Leadgrid-node. Generisk HTTP Request kan brukes mot den dokumenterte API-kontrakten.",
    Icon: Bot,
    status: "planned",
    category: "automation",
    features: ["Self-hosted flyt", "Prosjektscope", "Outcome-events"],
  },
  {
    id: "slack",
    name: "Slack",
    description:
      "Planlagt ferdigpakket connector. Leadgrid har foreløpig ingen offentlig utgående webhook-katalog.",
    Icon: MessageSquare,
    status: "planned",
    category: "communication",
    features: [
      "Planlagt varsling",
      "Prosjektfiltrering",
      "Kontrollert innhold",
    ],
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    description:
      "Planlagt ferdigpakket connector. Ingen offentlig Teams-sync er publisert ennå.",
    Icon: Users,
    status: "planned",
    category: "communication",
    features: [
      "Planlagt varsling",
      "Prosjektfiltrering",
      "Kontrollert innhold",
    ],
  },
];

const CATEGORIES = [
  { id: "all", label: "Alle", icon: Sparkles },
  { id: "crm", label: "CRM", icon: Database },
  { id: "automation", label: "Automasjon", icon: Zap },
  { id: "communication", label: "Kommunikasjon", icon: MessageSquare },
  { id: "developer", label: "Utvikler", icon: Code },
] as const;

const OUTCOME_TYPES = [
  "pilot_invited",
  "meeting_completed",
  "profile_published",
  "inquiry_received",
  "booking_confirmed",
  "attendance_confirmed",
] as const;

const LIVE_COUNT = CONNECTORS.filter(
  (connector) => connector.status === "live",
).length;
const PLANNED_COUNT = CONNECTORS.length - LIVE_COUNT;

export default function LeadgridConnectorsPage() {
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]["id"]>("all");
  const filtered =
    category === "all"
      ? CONNECTORS
      : CONNECTORS.filter((connector) => connector.category === category);

  return (
    <div className="min-h-screen bg-[#05010f] text-[#F4F0FF]">
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/25 bg-purple-500/15 px-4 py-1.5 text-sm font-medium text-purple-300">
          <Zap className="h-4 w-4" />
          Public Leads API v1 · prosjektbundet som standard
        </div>
        <h1 className="mb-4 bg-gradient-to-r from-purple-300 to-pink-400 bg-clip-text text-5xl font-bold text-transparent md:text-6xl">
          Connector Marketplace
        </h1>
        <p className="mx-auto mb-4 max-w-2xl text-xl text-purple-100/60">
          Bruk de innebygde importverktøyene eller bygg direkte mot en
          versjonert API-kontrakt.
        </p>
        <p className="mx-auto mb-8 max-w-2xl text-sm text-purple-100/50">
          Ferdigpakkede CRM-, automasjons- og kommunikasjonsconnectorer vises
          tydelig som planlagt frem til de er publisert og verifisert.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="/api/v1/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-purple-600 px-6 py-3 font-medium text-white transition hover:bg-purple-500"
          >
            <Code className="h-4 w-4" /> Swagger UI{" "}
            <ExternalLink className="h-3 w-3" />
          </a>
          <Link href="/leadgrid/utviklere/soknad">
            <button className="inline-flex items-center gap-2 rounded-full border-2 border-purple-400 bg-transparent px-6 py-3 font-medium text-purple-300 transition hover:bg-purple-500/10">
              <Key className="h-4 w-4" /> Søk om API-tilgang
            </button>
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { value: String(LIVE_COUNT), label: "Implementert nå" },
            { value: String(PLANNED_COUNT), label: "Planlagt" },
            { value: String(OUTCOME_TYPES.length), label: "Resultattyper" },
            { value: "OpenAPI 3.1", label: "Kontrakt" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center"
            >
              <div className="text-2xl font-bold text-purple-300">
                {stat.value}
              </div>
              <div className="text-xs text-purple-100/50">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((item) => {
            const Icon = item.icon;
            const active = category === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCategory(item.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-purple-600 text-white"
                    : "bg-white/[0.06] text-purple-100/70 hover:bg-white/[0.12]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((connector) => (
            <ConnectorCard key={connector.id} connector={connector} />
          ))}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl rounded-3xl border border-purple-500/20 bg-gradient-to-br from-[#171130] to-[#2a1548] p-8 text-white md:p-12">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-medium">
            <Code className="h-3 w-3" /> FOR UTVIKLERE
          </div>
          <h2 className="mb-4 text-3xl font-bold">
            Bygg mot den verifiserte API-kontrakten
          </h2>
          <p className="mb-6 text-purple-100/60">
            Nye nøkler bindes til ett Leadgrid-prosjekt som standard. API v1
            støtter lesing og opprettelse av leads, lesing av anbefalinger og
            sikker registrering av prosjektresultater.
          </p>
          <div className="mb-4 overflow-x-auto rounded-lg border border-white/10 bg-[#03000a] p-4 font-mono text-sm">
            <span className="text-green-400">$</span> curl{" "}
            <span className="text-yellow-300">
              &quot;https://creatorhub-backend-rtbl.onrender.com/api/v1/leads?limit=50&quot;
            </span>{" "}
            <br />
            &nbsp;&nbsp;-H{" "}
            <span className="text-yellow-300">
              &quot;Authorization: Bearer lgk_live_...&quot;
            </span>
          </div>
          <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100/80">
            API v1 har ikke en generell lead-oppdateringsrute eller en offentlig
            utgående webhook-katalog ennå. Ikke bygg en toveis-sync som
            forutsetter disse funksjonene.
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/leadgrid/utviklere">
              <button className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2 font-medium text-gray-900 transition hover:bg-gray-100">
                <Code className="h-4 w-4" /> Les dokumentasjonen
              </button>
            </Link>
            <a
              href="/api/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 font-medium text-white transition hover:bg-purple-500"
            >
              <FileJson className="h-4 w-4" /> OpenAPI JSON
            </a>
            <Link href="/leadgrid/utviklere/soknad">
              <button className="inline-flex items-center gap-2 rounded-lg bg-purple-500/20 px-5 py-2 font-medium text-white transition hover:bg-purple-500/30">
                <Key className="h-4 w-4" /> Søk om API-tilgang
              </button>
            </Link>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-4 text-center text-3xl font-bold">
          Lukket resultatflyt for kundeprosjekter
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-center text-purple-100/60">
          Med <code>outcomes.write</code> kan et kundesystem sende disse
          aggregerte resultatene tilbake på riktig prosjekt og lead.
        </p>
        <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-2 lg:grid-cols-3">
          {OUTCOME_TYPES.map((eventType) => (
            <div
              key={eventType}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 font-mono text-sm text-purple-300"
            >
              <CheckCircle2 className="mr-2 inline h-4 w-4 text-green-400" />
              {eventType}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-br from-purple-700 to-pink-700 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-4xl font-bold">
            Skal du koble et kundesystem til Leadgrid?
          </h2>
          <p className="mb-8 text-xl opacity-90">
            Beskriv prosjektet og databehovet. Vi vurderer scopes og
            prosjektbinding før en nøkkel utstedes.
          </p>
          <Link href="/leadgrid/utviklere/soknad">
            <button className="rounded-full bg-white px-8 py-4 text-lg font-bold text-purple-700 shadow-xl transition hover:scale-105">
              Søk om API-tilgang <ArrowRight className="ml-2 inline h-5 w-5" />
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
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-purple-400/40 hover:shadow-[0_0_30px_rgba(167,139,250,0.15)]">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-500/25 bg-purple-500/15">
          <Icon className="h-6 w-6 text-purple-300" />
        </div>
        <StatusBadge status={connector.status} />
      </div>
      <h3 className="mb-1 text-xl font-bold text-[#F4F0FF]">
        {connector.name}
      </h3>
      <p className="mb-4 text-sm text-purple-100/60">{connector.description}</p>
      <ul className="mb-4 flex-1 space-y-1">
        {connector.features.map((feature) => (
          <li
            key={feature}
            className="flex items-center gap-2 text-sm text-purple-100/80"
          >
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
            {feature}
          </li>
        ))}
      </ul>
      {connector.docUrl && (
        <a
          href={connector.docUrl}
          className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-purple-300 hover:text-purple-200"
        >
          {connector.docLabel ?? "Les mer"} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Connector["status"] }) {
  if (status === "live") {
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-green-500/25 bg-green-500/15 px-2 py-1 text-xs font-bold text-green-300">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Implementert
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/15 px-2 py-1 text-xs font-bold text-orange-300">
      <Clock className="h-3 w-3" /> Planlagt
    </div>
  );
}
