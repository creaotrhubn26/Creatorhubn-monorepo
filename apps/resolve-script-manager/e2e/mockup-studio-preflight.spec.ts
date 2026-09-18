import { expect, test } from '@playwright/test';
import {
  hasMeaningfulMockupContent,
  isPortableMockupAsset,
  mockupTargetExists,
  type PreflightDocShape,
} from '../src/components/mockup-studio/mockupPreflightRules';

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
