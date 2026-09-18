import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';

import {
  createScriptGuardianAgent,
  runGuardianRules,
  runGuardianLlm,
  scriptGuardianIssueApplier,
  SUGGESTION_TYPE_GUARDIAN_ISSUE,
  type GuardianSnapshot,
} from './ai-script-guardian-agent.js';

function snapshot(over: Partial<GuardianSnapshot> = {}): GuardianSnapshot {
  return {
    scenes: [
      { id: 'nsc_p01', code: 'P01', workingId: 'P01', title: 'Skoleveien', subtitle: 'W01 · 1797, ettermiddag', era: '1797', episodeId: 'nep_1', knowledge: {}, sourceRefs: [{ tag: 'W', ref: 'W' }], updatedAt: '2026-09-18T10:00:00.000Z', beforeState: 'Bok hos Elise.', action: 'Nora tar boken.', afterState: '' },
      { id: 'nsc_p07', code: 'P07', workingId: 'P07', title: 'Papiret', subtitle: 'W06 · 1817, tjue år senere', era: '1802', episodeId: null, knowledge: { saidAloud: 'Jeg så lyset i skogen.' }, sourceRefs: [], updatedAt: '2026-09-18T11:00:00.000Z', beforeState: '', action: '', afterState: '' },
    ],
    lines: [
      { id: 'nsl_1', sceneId: 'nsc_p01', cueId: 'W01.01', speakerComponentId: 'char_nora', speakerLabel: 'NORA', sourceType: 'E', textEn: 'Must you read all the way home?' },
      { id: 'nsl_2', sceneId: 'nsc_p01', cueId: 'W01.02', speakerComponentId: null, speakerLabel: 'ELISE', sourceType: '', textEn: 'You will not drop my book, will you?' },
      { id: 'nsl_3', sceneId: 'nsc_p01', cueId: 'W01.03', speakerComponentId: null, speakerLabel: 'GAMLE HANS', sourceType: 'T', textEn: 'Go home, children.' },
    ],
    characters: [{ id: 'char_nora', name: 'Nora', profile: { authorTruth: 'Nora er «det som følger».', observable: 'Et vanlig barn.' } }, { id: 'char_elise', name: 'Elise', profile: {} }],
    episodes: [{ id: 'nep_1', code: 'E01', title: 'Skoleveien', playersLearn: 'Leken og roten.' }],
    questions: [{ id: 'noq_1', code: 'Q07', status: 'open', createdAt: '2026-06-01T00:00:00.000Z', question: 'Hvem tenner lykten?' }],
    gates: [{ sceneId: 'nsc_p01', gateKey: 'picture', status: 'passed', evidenceRefs: [] }],
    ...over,
  };
}

describe('runGuardianRules (deterministisk pass)', () => {
  it('finner epoke-brudd, ukjent taler, replikk uten kildetype, scene uten episode, gate uten bevis-ref, gamle spørsmål og ufullstendig kunnskap', () => {
    const issues = runGuardianRules(snapshot(), new Date('2026-09-18T12:00:00Z'));
    const types = issues.map((i) => i.issueType).sort();
    expect(types).toEqual(['era_mismatch', 'gate_without_evidence_ref', 'knowledge_incomplete', 'line_without_source', 'open_question_stale', 'scene_without_episode', 'speaker_unknown']);
    const era = issues.find((i) => i.issueType === 'era_mismatch')!;
    expect(era).toMatchObject({ severity: 'high', sceneCodes: ['P07'], origin: 'rule' });
    expect(era.description).toContain('1802');
    expect(era.description).toContain('1817');
    // ELISE matcher karakteren på navn selv uten speakerComponentId → ikke flagget; GAMLE HANS flagges.
    const unknown = issues.filter((i) => i.issueType === 'speaker_unknown');
    expect(unknown).toHaveLength(1);
    expect(unknown[0].title).toContain('GAMLE HANS');
    expect(issues.find((i) => i.issueType === 'line_without_source')!.description).toContain('W01.02');
    expect(issues.find((i) => i.issueType === 'open_question_stale')!.description).toContain('Q07');
    for (const i of issues) expect(i.suggestedQuestion.length).toBeGreaterThan(10);
  });

  it('ren seed gir null funn (akseptansen for What Follows Us)', () => {
    const clean = snapshot({
      scenes: [{ id: 'nsc_p01', code: 'P01', workingId: 'P01', title: 'Skoleveien', subtitle: 'W01 · 1797', era: '1797', episodeId: 'nep_1', knowledge: { saidAloud: 'x', othersObserve: 'y' }, sourceRefs: [{ tag: 'W', ref: 'W' }], updatedAt: '2026-09-18T10:00:00.000Z', beforeState: '', action: '', afterState: '' }],
      lines: [{ id: 'nsl_1', sceneId: 'nsc_p01', cueId: 'W01.01', speakerComponentId: 'char_nora', speakerLabel: 'NORA', sourceType: 'E', textEn: 'x' }, { id: 'nsl_2', sceneId: 'nsc_p01', cueId: 'W01.02', speakerComponentId: null, speakerLabel: 'MINNET AV NORA', sourceType: 'U', textEn: 'y' }],
      questions: [{ id: 'noq_1', code: 'Q07', status: 'done', createdAt: '2026-01-01T00:00:00.000Z', question: 'x' }],
      gates: [{ sceneId: 'nsc_p01', gateKey: 'picture', status: 'passed', evidenceRefs: ['asset:nas_1'] }],
    });
    expect(runGuardianRules(clean, new Date('2026-09-18T12:00:00Z'))).toEqual([]);
  });
});

describe('runGuardianLlm', () => {
  it('uten ANTHROPIC_API_KEY → [] (kun deterministisk pass)', async () => {
    const prev = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
    try { expect(await runGuardianLlm(snapshot(), snapshot().scenes)).toEqual([]); }
    finally { if (prev) process.env.ANTHROPIC_API_KEY = prev; }
  });
});

describe('createScriptGuardianAgent', () => {
  it('laster snapshot fra DB, kjører reglene og hopper over LLM i deterministisk modus', async () => {
    const query = vi.fn(async (sql: string) => {
      if (/FROM narrative_scenes/.test(sql)) return { rows: [{ id: 'nsc_p07', code: 'P07', working_id: 'P07', title: 'Papiret', subtitle: 'W06 · 1817', era: '1802', episode_id: null, knowledge: {}, source_refs: [], updated_at: new Date(), before_state: '', action: '', after_state: '' }] };
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const agent = createScriptGuardianAgent(pool);
    const out = await agent.generate({ projectId: 'proj', userId: 'u1', sourceType: 'project', sourceId: 'proj', payload: { mode: 'deterministic' } });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ suggestionType: SUGGESTION_TYPE_GUARDIAN_ISSUE, confidence: 0.95, sourceType: 'project', sourceId: 'proj' });
    expect((out[0].payload as { issueType: string }).issueType).toBe('era_mismatch');
    // Ingen oppslag i casting_ai_suggestions i deterministisk modus.
    expect(query.mock.calls.some(([q]) => /casting_ai_suggestions/.test(String(q)))).toBe(false);
  });
});

describe('scriptGuardianIssueApplier', () => {
  it('godta = åpent spørsmål med kildemerke A/script-guardian, aldri endring av manus', async () => {
    const inserts: unknown[][] = [];
    const client = { query: vi.fn(async (sql: string, params: unknown[]) => { if (/INSERT INTO narrative_open_questions/.test(sql)) { inserts.push(params); return { rows: [{ id: 'noq_new', project_id: 'proj', code: params[2], kind: params[3], question: params[4], context: params[5], status: 'open', decision: '', source_refs: JSON.parse(String(params[8])), sort_order: 0, created_at: new Date(), updated_at: new Date() }] }; } return { rows: [] }; }) };
    const result = await scriptGuardianIssueApplier.apply(
      { id: 'sug_abc123xyz', projectId: 'proj', suggestionType: SUGGESTION_TYPE_GUARDIAN_ISSUE, sourceType: 'project', sourceId: 'proj', agentName: 'script-guardian-agent', modelVersion: 'claude-opus-5', confidence: 0.9, status: 'accepted', createdAt: '', updatedAt: '',
        payload: { issueType: 'knowledge_leak', severity: 'high', title: 'Nora vet om lykten', description: 'Nora nevner lykten før den er vist.', sceneIds: ['nsc_p05'], sceneCodes: ['P05'], evidence: [{ ref: 'W04.03', quote: 'The lantern…' }], suggestedQuestion: 'Kan Nora vite om lykten i P05?', origin: 'llm' } },
      { projectId: 'proj', userId: 'u1', client: client as never },
    );
    expect(result).toMatchObject({ openQuestionId: 'noq_new', code: 'AI-123XYZ', issueType: 'knowledge_leak' });
    expect(inserts[0][3]).toBe('question');
    expect(inserts[0][4]).toBe('Kan Nora vite om lykten i P05?');
    expect(JSON.parse(String(inserts[0][8]))).toEqual([{ tag: 'A', ref: 'script-guardian', note: 'P05' }]);
    expect(client.query.mock.calls.some(([q]) => /UPDATE narrative_scenes|UPDATE narrative_scene_lines|DELETE/.test(String(q)))).toBe(false);
  });
});
