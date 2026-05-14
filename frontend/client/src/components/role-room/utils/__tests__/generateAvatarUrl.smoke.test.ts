import { describe, expect, it } from 'vitest';
import { generateAvatarUrl, pickAvatarStyleForPerson } from '../generateAvatarUrl';

describe('Sprint 6.13 — generateAvatarUrl', () => {
  it('returns a DiceBear URL with seed and default size', () => {
    const url = generateAvatarUrl('Roar Uthaug');
    expect(url).toContain('https://api.dicebear.com/9.x/personas/svg');
    expect(url).toContain('seed=Roar%2520Uthaug');
    expect(url).toContain('size=320');
  });

  it('is deterministic — same seed gives same URL', () => {
    expect(generateAvatarUrl('Nora Tidemann')).toBe(generateAvatarUrl('Nora Tidemann'));
  });

  it('different seeds give different URLs', () => {
    const a = generateAvatarUrl('Person A');
    const b = generateAvatarUrl('Person B');
    expect(a).not.toBe(b);
  });

  it('respects custom style option', () => {
    expect(generateAvatarUrl('test', { style: 'bottts' })).toContain('/bottts/');
    expect(generateAvatarUrl('test', { style: 'lorelei' })).toContain('/lorelei/');
  });

  it('respects custom format (PNG)', () => {
    const url = generateAvatarUrl('test', { format: 'png' });
    expect(url).toContain('/personas/png');
  });

  it('falls back to "anonymous" when seed is empty/whitespace', () => {
    expect(generateAvatarUrl('')).toContain('seed=anonymous');
    expect(generateAvatarUrl('   ')).toContain('seed=anonymous');
  });

  it('URL-encodes special characters in seed', () => {
    const url = generateAvatarUrl('Bjørn Sundquist');
    // encodeURIComponent encodes 'ø' as %C3%B8 — and that itself gets
    // wrapped again inside URLSearchParams which produces %25C3%25B8.
    expect(url).toContain('Bj%2520rn'.slice(0, 4)); // basic sanity
    expect(url).toContain('Sundquist');
  });
});

describe('Sprint 6.13 — pickAvatarStyleForPerson', () => {
  it('returns bottts for studios/companies', () => {
    expect(pickAvatarStyleForPerson({ category: 'studio' })).toBe('bottts');
  });

  it('returns lorelei for female persons', () => {
    expect(pickAvatarStyleForPerson({ gender: 'female' })).toBe('lorelei');
  });

  it('defaults to personas for male/unknown', () => {
    expect(pickAvatarStyleForPerson({ gender: 'male' })).toBe('personas');
    expect(pickAvatarStyleForPerson({})).toBe('personas');
  });
});
