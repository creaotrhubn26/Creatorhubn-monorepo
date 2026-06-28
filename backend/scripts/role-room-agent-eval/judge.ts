/**
 * LLM-as-judge for the Role Room Agent answer-quality eval.
 *
 * Scores a candidate answer against a free-text rubric on three dimensions
 * (groundedness, no-hallucination, actionability) plus an overall score.
 *
 * The Anthropic SDK is loaded LAZILY using the same optional-SDK pattern as
 * server/role-room-agent-bootstrap-claude.ts: `import('@anthropic-ai/sdk')
 * .catch(() => null)` + ANTHROPIC_API_KEY. If neither is available the judge
 * returns null and the caller (run-eval.ts) handles the skip — so this module
 * never throws on a missing dependency.
 */

import { parseJudgeJson, type JudgeScores } from './scorecard.ts';
import type { RoleRoomAgentEvalContext } from './fixtures.ts';

const JUDGE_SYSTEM_PROMPT = `Du er en streng evaluator for svar fra "The Role Room Agent", en AI-assistent for kreative produksjonsteam. Du vurderer KVALITETEN på et kandidatsvar mot den oppgitte prosjektkonteksten og forventningene.

Du scorer på tre dimensjoner, hver fra 0 til 5 (heltall):
- groundedness: I hvilken grad er svaret forankret i den faktiske prosjektkonteksten? Siterer det felt/id-er som faktisk finnes? (5 = alt forankret og verifiserbart, 0 = løsrevet fra konteksten)
- noHallucination: Unngår svaret å finne på fakta som IKKE finnes i konteksten (budsjettall, navn, frister, godkjenninger)? (5 = ingen oppdiktede fakta, 0 = inneholder klart oppdiktede fakta). KRITISK: oppdiktede tall eller ekte navn (i stedet for {{candidate_n}}/{{crew_n}}) skal straffes hardt.
- actionability: Gir svaret et konkret, nyttig neste steg for produsenten? (5 = klart handlingsrettet, 0 = vagt/ubrukelig)

Vurder også et samlet "overall" (0-5) som helhetsinntrykk, vektet mot noHallucination.

Du MÅ svare med KUN gyldig JSON, ingen markdown, på formen:
{"groundedness": <0-5>, "noHallucination": <0-5>, "actionability": <0-5>, "overall": <0-5>, "rationale": "<kort begrunnelse på norsk>"}`;

export interface JudgeInput {
  question: string;
  context: RoleRoomAgentEvalContext;
  answer: string;
  expectations: string;
  /** Override judge model (default from env or a sensible Claude default). */
  model?: string;
}

let cachedJudgeClient: unknown = null;

async function getJudgeClient(): Promise<any> {
  if (cachedJudgeClient) return cachedJudgeClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  // @ts-ignore — optional SDK, resolved at runtime
  const mod: any = await import('@anthropic-ai/sdk').catch(() => null);
  if (!mod) return null;
  const AnthropicCtor = mod.default ?? mod.Anthropic;
  cachedJudgeClient = new AnthropicCtor({ apiKey });
  return cachedJudgeClient;
}

function defaultJudgeModel(): string {
  return process.env.ROLE_ROOM_AGENT_EVAL_JUDGE_MODEL || 'claude-sonnet-4-6';
}

/**
 * Judge a single answer. Returns null when the SDK/key is unavailable or the
 * call/parse fails — callers treat null as "skipped". Never throws.
 */
export async function judgeAnswer(input: JudgeInput): Promise<JudgeScores | null> {
  const client = await getJudgeClient();
  if (!client) {
    console.warn(
      '[role-room-agent-eval:judge]',
      JSON.stringify({ reason: 'anthropic_client_unavailable', hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) }),
    );
    return null;
  }

  const model = input.model || defaultJudgeModel();
  const userPayload = {
    question: input.question,
    projectContext: input.context,
    expectations: input.expectations,
    candidateAnswer: input.answer,
  };

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: JUDGE_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Evaluer dette svaret. Returner kun JSON.\n\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
    });

    const blocks = (response as any)?.content ?? [];
    let text = '';
    for (const block of blocks) {
      if (block?.type === 'text' && typeof block.text === 'string') {
        text += block.text;
      }
    }
    const scores = parseJudgeJson(text);
    if (!scores) {
      console.warn(
        '[role-room-agent-eval:judge]',
        JSON.stringify({ reason: 'judge_parse_failed', model, textLength: text.length }),
      );
    }
    return scores;
  } catch (err) {
    console.warn(
      '[role-room-agent-eval:judge]',
      JSON.stringify({ reason: 'judge_request_threw', model, error: err instanceof Error ? err.message : String(err) }),
    );
    return null;
  }
}
