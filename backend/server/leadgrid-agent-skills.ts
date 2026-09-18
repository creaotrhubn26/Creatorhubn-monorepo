/**
 * Leadgrid iPad agent skills.
 *
 * Claude may only PROPOSE these tools. The native client validates the input,
 * binds every lead id to its currently loaded tenant context, and requires an
 * explicit user confirmation before any read or write is executed.
 */

export const LEADGRID_AGENT_SKILL_NAMES = [
  'leadgrid_find_duplicates',
  'leadgrid_enrich_company',
  'leadgrid_log_visit',
  'leadgrid_sync_offline_actions',
  'leadgrid_plan_follow_up',
  'leadgrid_data_quality',
] as const;

export type LeadgridAgentSkillName = typeof LEADGRID_AGENT_SKILL_NAMES[number];

export const LEADGRID_AGENT_SYSTEM_PROMPT = `
## Leadgrid iPad-agent

Du hjelper en selger med leads som allerede finnes i den aktive Leadgrid-organisasjonen.

Sikkerhetsregler:
- Du kan bare foreslå verktøyene som er oppgitt nedenfor. Du utfører aldri en handling selv.
- Alle verktøy, også lesende analyser, vises som et handlingskort og krever eksplisitt bekreftelse på iPad.
- Bruk bare lead-id-er som finnes i Leadgrid-konteksten. Hvis riktig lead er uklart, spør brukeren.
- Ikke foreslå sletting, sammenslåing eller automatisk overskriving av en lead.
- Ikke finn på kontaktdata, besøksnotater, koordinater eller tidspunkt.
- Oppfølgingstid må være ISO 8601 med tidssone og ligge i fremtiden.
- Foreslå synkronisering bare når brukeren uttrykkelig ber om det.
- Be aldri om eller gjengi passord, API-nøkler eller tokens.
- Skill tydelig mellom foreslått, bekreftet, sendt, lagt i offline-kø og feilet.
`.trim();

type AnthropicTool = {
  name: LeadgridAgentSkillName;
  description: string;
  input_schema: Record<string, unknown>;
};

const closedObject = (
  properties: Record<string, unknown>,
  required: string[] = [],
): Record<string, unknown> => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
});

const leadId = {
  type: 'string',
  minLength: 1,
  maxLength: 255,
  description: 'Eksakt lead-id fra den oppgitte Leadgrid-konteksten.',
};

export const LEADGRID_AGENT_SKILL_TOOLS: AnthropicTool[] = [
  {
    name: 'leadgrid_find_duplicates',
    description:
      'Sjekk én eksisterende lead mot Leadgrids tenant-avgrensede duplikatmotor. Read-only; brukeren må fortsatt bekrefte kortet.',
    input_schema: closedObject({ lead_id: leadId }, ['lead_id']),
  },
  {
    name: 'leadgrid_enrich_company',
    description:
      'Foreslå BRREG-berikelse av én lead. Kan oppdatere lagrede bedriftsdata og må bekreftes eksplisitt.',
    input_schema: closedObject(
      {
        lead_id: leadId,
        force_refresh: {
          type: 'boolean',
          description: 'Bare true når brukeren uttrykkelig ber om å ignorere gyldig cache.',
        },
      },
      ['lead_id'],
    ),
  },
  {
    name: 'leadgrid_log_visit',
    description:
      'Foreslå å logge en konkret kontakt eller et besøk. Kan sendes direkte eller legges tapsfritt i offline-kø etter bekreftelse.',
    input_schema: closedObject(
      {
        lead_id: leadId,
        visit_type: {
          type: 'string',
          enum: ['physical', 'phone', 'email', 'online_meeting', 'research'],
        },
        conversation_summary: { type: 'string', minLength: 1, maxLength: 4000 },
        contact_person: { type: 'string', minLength: 1, maxLength: 240 },
        notes: { type: 'string', maxLength: 20000 },
        new_status: {
          type: 'string',
          enum: [
            'unvisited', 'visited', 'return', 'not_present', 'declined',
            'interested', 'meeting_booked', 'proposal_sent', 'won', 'lost',
            'do_not_contact',
          ],
        },
        next_action: { type: 'string', minLength: 1, maxLength: 2000 },
        next_follow_up_at: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 med tidssone; må ligge i fremtiden.',
        },
      },
      ['lead_id', 'visit_type', 'conversation_summary'],
    ),
  },
  {
    name: 'leadgrid_sync_offline_actions',
    description:
      'Foreslå en eksplisitt synkronisering av ventende handlinger for aktiv organisasjon. Krever nett og brukerbekreftelse.',
    input_schema: closedObject({
      reason: { type: 'string', minLength: 1, maxLength: 500 },
    }),
  },
  {
    name: 'leadgrid_plan_follow_up',
    description:
      'Foreslå neste handling og tidspunkt for én lead. Oppdateringen kan køes offline etter eksplisitt bekreftelse.',
    input_schema: closedObject(
      {
        lead_id: leadId,
        next_follow_up_at: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 med tidssone; må ligge i fremtiden.',
        },
        next_action: { type: 'string', minLength: 1, maxLength: 2000 },
      },
      ['lead_id', 'next_follow_up_at', 'next_action'],
    ),
  },
  {
    name: 'leadgrid_data_quality',
    description:
      'Analyser manglende salgsdata lokalt for én lead eller det aktive prosjektet. Read-only og gjør ingen endringer.',
    input_schema: closedObject({
      lead_id: leadId,
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    }),
  },
];

export interface LeadgridFollowUpInput {
  nextFollowUpAt: string;
  nextAction: string;
}

export type LeadgridFollowUpParseResult =
  | { ok: true; value: LeadgridFollowUpInput }
  | { ok: false; issues: Array<{ path: string; message: string }> };

/** Server-side validation for the canonical follow-up write endpoint. */
export function parseLeadgridFollowUpInput(
  raw: unknown,
  now: Date = new Date(),
): LeadgridFollowUpParseResult {
  const body = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const nextAction = typeof body.next_action === 'string'
    ? body.next_action.trim()
    : '';
  const nextFollowUpAt = typeof body.next_follow_up_at === 'string'
    ? body.next_follow_up_at.trim()
    : '';
  const issues: Array<{ path: string; message: string }> = [];

  if (!nextAction) {
    issues.push({ path: 'next_action', message: 'Neste handling er påkrevd.' });
  } else if (nextAction.length > 2000) {
    issues.push({ path: 'next_action', message: 'Neste handling kan være maks 2000 tegn.' });
  }

  const hasTimezone = /(Z|[+-]\d{2}:\d{2})$/i.test(nextFollowUpAt);
  const date = new Date(nextFollowUpAt);
  if (!nextFollowUpAt || !hasTimezone || Number.isNaN(date.getTime())) {
    issues.push({
      path: 'next_follow_up_at',
      message: 'Tidspunkt må være gyldig ISO 8601 med tidssone.',
    });
  } else if (date.getTime() <= now.getTime()) {
    issues.push({
      path: 'next_follow_up_at',
      message: 'Oppfølgingstidspunktet må ligge i fremtiden.',
    });
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: { nextFollowUpAt: date.toISOString(), nextAction },
  };
}
