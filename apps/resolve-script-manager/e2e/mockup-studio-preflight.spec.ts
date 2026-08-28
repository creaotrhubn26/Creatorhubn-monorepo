import { expect, test } from '@playwright/test';
import {
  hasMeaningfulMockupContent,
  isPortableMockupAsset,
  mockupTargetExists,
  sanitizeRemoteMockupProjectAssets,
  type PreflightDocShape,
} from '../src/components/mockup-studio/mockupPreflightRules';
import type { MockupDoc } from '../src/components/mockup-studio/mockupStudioModel';

const empty = (): PreflightDocShape => ({ devices: [], images: [], texts: [] });

test('bildebasert materiell er gyldig uten device-ramme', () => {
  const doc = empty();
  doc.images = [{ id: 'photo' }];
  expect(hasMeaningfulMockupContent(doc)).toBeTruthy();
});

test('helt tomt materiell stoppes', () => {
  expect(hasMeaningfulMockupContent(empty())).toBeFalsy();
});

test('lokale og portable asset-referanser skilles korrekt', () => {
  expect(isPortableMockupAsset('/Users/example/photo.jpg')).toBeFalsy();
  expect(isPortableMockupAsset('mockup-cloud-file:asset-id')).toBeTruthy();
  expect(isPortableMockupAsset('data:image/png;base64,AAAA')).toBeTruthy();
  expect(isPortableMockupAsset('https://example.com/photo.jpg')).toBeTruthy();
});

test('connector-mål må peke til et eksisterende element', () => {
  const doc = empty();
  doc.images = [{ id: 'photo' }];
  expect(mockupTargetExists(doc, { kind: 'image', id: 'photo' })).toBeTruthy();
  expect(mockupTargetExists(doc, { kind: 'image', id: 'slettet' })).toBeFalsy();
  expect(mockupTargetExists(doc, { kind: 'canvas' })).toBeTruthy();
});

test('delte prosjekter kan ikke be skrivebordet lese lokale filer', () => {
  const remote = {
    id: 'doc-security', name: 'Delt', version: 1, template: 'blank', updatedAt: 1,
    canvas: {
      w: 1080, h: 1080, accent: '#000000', accent2: '#ffffff', background: 'light', bgStyle: 'solid',
      logo: { image: 'file:///Users/victim/secret-logo.png', x: 0, y: 0, w: 100 },
      bgImage: '/Users/victim/private-background.png',
      audio: { src: 'asset:///Users/victim/private-audio.m4a' },
    },
    devices: [
      { id: 'unsafe', variant: 'iphone', x: 0, y: 0, w: 200, rotation: 0, shadow: true, image: '/Users/victim/.ssh/id_rsa.png' },
      { id: 'safe', variant: 'iphone', x: 0, y: 0, w: 200, rotation: 0, shadow: true, image: 'mockup-cloud-file:asset-id' },
    ],
    texts: [],
    images: [
      { id: 'remote', image: 'https://example.com/photo.jpg', x: 0, y: 0, w: 100, h: 100, radius: 0, fit: 'cover', rotation: 0, shadow: false },
      { id: 'local', image: '/tmp/private.png', video: 'blob:transient', sprite: { frames: ['/tmp/1.png', 'data:image/png;base64,AAAA'], fps: 12 }, x: 0, y: 0, w: 100, h: 100, radius: 0, fit: 'cover', rotation: 0, shadow: false },
    ],
  } as MockupDoc;

  const clean = sanitizeRemoteMockupProjectAssets(remote);
  expect(clean.devices[0].image).toBeUndefined();
  expect(clean.devices[1].image).toBe('mockup-cloud-file:asset-id');
  expect(clean.images?.[0].image).toBe('https://example.com/photo.jpg');
  expect(clean.images?.[1].image).toBe('');
  expect(clean.images?.[1].video).toBeUndefined();
  expect(clean.images?.[1].sprite?.frames).toEqual(['data:image/png;base64,AAAA']);
  expect(clean.canvas.logo).toBeUndefined();
  expect(clean.canvas.bgImage).toBeUndefined();
  expect(clean.canvas.audio).toBeUndefined();
});
