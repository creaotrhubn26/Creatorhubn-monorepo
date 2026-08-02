import { describe, expect, it } from 'vitest';

import { parseMermaidArch } from './mermaidArch.js';
import { techLogoSlug, techLogoUrl } from './techLogos.js';

const MMD = `graph TB
    subgraph Klient["🖥️ Klientlag"]
        Web["MedSide Web App<br/>(React + Vite + TS)"]
        MM["MediMeet<br/>(Video/WebRTC)"]
    end
    subgraph DB["🗄️ Supabase Postgres (Stockholm)"]
        Profiles["profiles<br/>user_roles<br/>user_specialties"]
        NoNotes[("❌ Ingen pasientdata,<br/>lyd eller notater lagres")]
    end
    subgraph Ekstern["🌍 Eksterne tjenester"]
        Bedrock["AWS Bedrock<br/>Claude Sonnet 4.5"]
        Lambda["AWS Lambda<br/>(fallback)"]
        Stripe["Stripe<br/>(abonnement)"]
    end
    Web --> Bedrock
    Web -->|kjøp| Stripe
    classDef privacy fill:#8b1a1a,stroke:#c99a2e,color:#f5f0e8
    class NoNotes privacy`;

describe('parseMermaidArch', () => {
  const d = parseMermaidArch(MMD, 'MedSide');
  it('gir 3 grupper med ikon + navn', () => {
    expect(d.groups.map((g) => g.name)).toEqual(['Klientlag', 'Supabase Postgres (Stockholm)', 'Eksterne tjenester']);
    expect(d.groups[0].icon).toBe('🖥️');
    expect(d.groups[1].icon).toBe('🗄️');
  });
  it('parser node-label + undertekst (<br/> → · , parenteser strippet)', () => {
    const web = d.groups[0].nodes[0];
    expect(web.label).toBe('MedSide Web App');
    expect(web.sub).toBe('React + Vite + TS');
    const prof = d.groups[1].nodes[0];
    expect(prof.sub).toBe('user_roles · user_specialties');
  });
  it('markerer privacy-node via class', () => {
    const noNotes = d.groups[1].nodes.find((n) => n.id === 'NoNotes');
    expect(noNotes?.privacy).toBe(true);
    expect(d.groups[0].nodes[0].privacy).toBe(false);
  });
  it('tildeler logoer på node OG gruppe-header', () => {
    expect(d.groups[0].nodes[0].logo).toBe('react');            // node: React
    expect(d.groups[1].nodes[0].logo).toBe('');                 // «profiles» har ingen tech-logo
    expect(d.groups[1].logo).toBe('supabase');                  // men gruppen «Supabase Postgres» får logo
    const ext = d.groups[2].nodes;
    expect(ext.find((n) => n.id === 'Bedrock')?.logo).toBe('anthropic');
    expect(ext.find((n) => n.id === 'Lambda')?.logo).toBe('awslambda');
    expect(ext.find((n) => n.id === 'Stripe')?.logo).toBe('stripe');
  });
  it('ignorerer kanter + tomt', () => {
    expect(parseMermaidArch('', 'x').groups).toEqual([]);
    // ingen «kjøp»/«fallback»-kant-labels havner som noder
    expect(d.groups.flatMap((g) => g.nodes).some((n) => /kjøp|fallback/i.test(n.label))).toBe(false);
  });
});

describe('techLogoSlug — spesifisitet + fallback', () => {
  it('aws lambda → awslambda (ikke amazonaws)', () => {
    expect(techLogoSlug('AWS Lambda non-stream')).toBe('awslambda');
  });
  it('bedrock/claude → anthropic', () => {
    expect(techLogoSlug('AWS Bedrock Claude Sonnet')).toBe('anthropic');
  });
  it('kjente techs', () => {
    expect(techLogoSlug('React + Vite')).toBe('react');
    expect(techLogoSlug('Supabase Auth')).toBe('supabase');
    expect(techLogoSlug('Postgres db')).toBe('postgresql');
    expect(techLogoSlug('Neon serverless')).toBe('neon');
  });
  it('ukjent → tom slug', () => {
    expect(techLogoSlug('BankID Criipto')).toBe('');
    expect(techLogoSlug('geo-check')).toBe('');
  });
  it('techLogoUrl bygger cdn.simpleicons.org-URL (white på mørk bg)', () => {
    expect(techLogoUrl('stripe')).toBe('https://cdn.simpleicons.org/stripe/white');
    expect(techLogoUrl('')).toBe('');
  });
});
