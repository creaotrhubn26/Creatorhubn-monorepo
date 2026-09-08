/**
 * Tester for koblingsstatusen i Marketing Cockpit.
 *
 * Disse finnes på grunn av to samtidige feil som var usynlige i UI-et,
 * fordi begge produserte et troverdig «Ikke tilkoblet»:
 *
 *   1. `configured` ble lest fra profile.data / ig.data / cta.data.
 *      Backend har feltet på TOPPNIVÅ i summary-svaret — de leste
 *      feltene finnes ikke — så Facebook og Instagram ble alltid vist
 *      som frakoblet, selv når samme skjerm viste LIVE-data og 2481
 *      følgere rett under.
 *   2. LinkedIn ble hentet fra /linkedin/connection-status (finnes
 *      ikke) og lest som `.connected`; svaret har `state`.
 *
 * Fixturene under speiler backendens faktiske returverdier:
 *   role-room-marketing-cockpit-routes.ts:233 (configured, toppnivå)
 *   role-room-marketing-cockpit-routes.ts:64/141 (profile.id, ig.userId)
 *   role-room-routes.ts:4473 (state + connection.linkedInMemberId)
 */

import { describe, expect, it } from 'vitest';

import { mapSocialConnections } from './SocialConnectionsPanel';

/** Summary slik backend faktisk svarer når alt er satt opp. */
const CONFIGURED_SUMMARY = {
  ok: true,
  configured: {
    pageId: true,
    pageToken: true,
    igUserId: true,
    trackedHashtags: ['norskcasting'],
  },
  profile: { ok: true, data: { id: 'page-1', name: 'The Role Room', fanCount: 2481 } },
  ig: { ok: true, data: { userId: 'ig-1', username: 'theroleroom', followersCount: 1893 } },
};

describe('mapSocialConnections — Facebook og Instagram', () => {
  it('leser configured fra TOPPNIVÅ, ikke fra seksjonene', () => {
    const s = mapSocialConnections(CONFIGURED_SUMMARY, {}, {});
    expect(s.facebook.configured).toBe(true);
    expect(s.instagram.configured).toBe(true);
  });

  it('plukker id-ene fra riktige feltnavn (id / userId)', () => {
    const s = mapSocialConnections(CONFIGURED_SUMMARY, {}, {});
    expect(s.facebook.pageId).toBe('page-1');
    expect(s.instagram.userId).toBe('ig-1');
  });

  it('REGRESJON: den gamle formen alene gjør ingen konfigurert', () => {
    // Slik den gamle koden trodde svaret så ut. Ingen `configured` på
    // toppnivå ⇒ ingenting skal rapporteres som konfigurert.
    const gammel = {
      profile: { ok: true, data: { configured: true, pageId: 'p' } },
      ig: { ok: true, data: { configured: true, igUserId: 'i' } },
      cta: { ok: true, data: { configured: true } },
    };
    const s = mapSocialConnections(gammel, {}, {});
    expect(s.facebook.configured).toBe(false);
    expect(s.instagram.configured).toBe(false);
  });

  it('krever både id og token — en Page-ID uten token er ikke brukbar', () => {
    const utenToken = { configured: { pageId: true, pageToken: false, igUserId: true } };
    const s = mapSocialConnections(utenToken, {}, {});
    expect(s.facebook.configured).toBe(false);
    expect(s.instagram.configured).toBe(false);
  });

  it('IG krever eget bruker-id i tillegg til token', () => {
    const utenIg = { configured: { pageId: true, pageToken: true, igUserId: false } };
    const s = mapSocialConnections(utenIg, {}, {});
    expect(s.facebook.configured).toBe(true);
    expect(s.instagram.configured).toBe(false);
  });

  it('rapporterer frakoblet når summary feilet helt', () => {
    const s = mapSocialConnections({}, {}, {});
    expect(s.facebook.configured).toBe(false);
    expect(s.instagram.configured).toBe(false);
    expect(s.facebook.pageId).toBeUndefined();
  });
});

describe('mapSocialConnections — LinkedIn', () => {
  it('leser state === "connected", ikke .connected', () => {
    const li = {
      configured: true,
      state: 'connected',
      connection: { linkedInMemberId: 'urn:li:person:42', linkedInName: 'Daniel' },
    };
    const s = mapSocialConnections(CONFIGURED_SUMMARY, {}, li);
    expect(s.linkedin.connected).toBe(true);
    expect(s.linkedin.memberId).toBe('urn:li:person:42');
  });

  it('behandler expired som ikke tilkoblet', () => {
    const s = mapSocialConnections(CONFIGURED_SUMMARY, {}, { state: 'expired', connection: {} });
    expect(s.linkedin.connected).toBe(false);
  });

  it('disconnected gir frakoblet uten memberId', () => {
    const s = mapSocialConnections(CONFIGURED_SUMMARY, {}, { state: 'disconnected', connection: null });
    expect(s.linkedin.connected).toBe(false);
    expect(s.linkedin.memberId).toBeUndefined();
  });

  it('REGRESJON: { connected: true } alene teller ikke — det var det gamle feltet', () => {
    const s = mapSocialConnections(CONFIGURED_SUMMARY, {}, { connected: true });
    expect(s.linkedin.connected).toBe(false);
  });

  it('tomt svar (404 svelget) gir frakoblet, ikke krasj', () => {
    const s = mapSocialConnections(CONFIGURED_SUMMARY, {}, {});
    expect(s.linkedin.connected).toBe(false);
  });
});

describe('mapSocialConnections — TikTok', () => {
  it('godtar både flat form og connection-innpakket form', () => {
    const flat = mapSocialConnections({}, { connected: true, username: 'roleroom' }, {});
    expect(flat.tiktok.connected).toBe(true);
    expect(flat.tiktok.username).toBe('roleroom');

    const nested = mapSocialConnections(
      {},
      { connection: { connected: true, username: 'roleroom', scopes: ['video.upload'] } },
      {},
    );
    expect(nested.tiktok.connected).toBe(true);
    expect(nested.tiktok.username).toBe('roleroom');
    expect(nested.tiktok.scopes).toEqual(['video.upload']);
  });

  it('gir tom scopes-liste når ingenting er oppgitt', () => {
    const s = mapSocialConnections({}, {}, {});
    expect(s.tiktok.connected).toBe(false);
    expect(s.tiktok.scopes).toEqual([]);
  });
});

describe('mapSocialConnections — robusthet', () => {
  it('tåler null og undefined uten å kaste', () => {
    expect(() => mapSocialConnections(null, null, null)).not.toThrow();
    expect(() => mapSocialConnections(undefined, undefined, undefined)).not.toThrow();
    const s = mapSocialConnections(null, null, null);
    expect(s.facebook.configured).toBe(false);
    expect(s.tiktok.connected).toBe(false);
  });

  it('tåler at seksjonene mangler helt', () => {
    const s = mapSocialConnections({ configured: { pageId: true, pageToken: true } }, {}, {});
    expect(s.facebook.configured).toBe(true);
    expect(s.facebook.pageId).toBeUndefined();
  });
});
