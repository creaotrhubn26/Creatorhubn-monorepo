import { describe, expect, it } from 'vitest';
import { __test__ } from './claude-json-helper.js';

const { stripMarkdownFence, extractFirstJsonObject } = __test__;

describe('stripMarkdownFence', () => {
  it('returns unwrapped body when text is fenced as json', () => {
    const input = '```json\n{"a":1}\n```';
    expect(stripMarkdownFence(input)).toBe('{"a":1}');
  });

  it('returns unwrapped body when fence has no language tag', () => {
    const input = '```\n{"a":1}\n```';
    expect(stripMarkdownFence(input)).toBe('{"a":1}');
  });

  it('returns trimmed text when no fence present', () => {
    expect(stripMarkdownFence('  {"a":1}  ')).toBe('{"a":1}');
  });
});

describe('extractFirstJsonObject', () => {
  it('extracts a single object', () => {
    expect(extractFirstJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it('extracts when wrapped in prose', () => {
    const input = 'Here is the result:\n{"a": 1, "b": 2}\nLet me know!';
    expect(extractFirstJsonObject(input)).toBe('{"a": 1, "b": 2}');
  });

  it('handles nested objects and string braces', () => {
    const input = '{"outer": {"inner": "value with } inside"}, "tail": 1}';
    expect(extractFirstJsonObject(input)).toBe(input);
  });

  it('returns null if no object present', () => {
    expect(extractFirstJsonObject('just prose')).toBeNull();
  });

  it('handles escaped quotes inside strings', () => {
    const input = '{"q": "she said \\"hi\\""}';
    expect(extractFirstJsonObject(input)).toBe(input);
  });
});
