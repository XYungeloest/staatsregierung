import assert from 'node:assert/strict';
import test from 'node:test';

import { parseNormMeta, parseNormVersion } from '@ostrecht/shared/lib/norms/schema.ts';

const localRevosaxSource = {
  kind: 'revosax-snapshot',
  label: 'Amtliche REVOSax-Fassung, gültig 2018-05-25 bis 2024-08-16',
  availability: 'versioned',
  localSource: 'data/recht/sources/revosax/gesundheitsdienstgesetz/3348.12.html',
  url: 'https://www.revosax.sachsen.de/vorschrift/3348.12',
  retrievedAt: '2026-08-23',
  sha256: '0c8e1875b1e1bd75bf545f49a80a5ce488ccef1fc2dbdd4e0792de2551ffaafc',
  lawId: '3348',
  sourceValidFrom: '2018-05-25',
  sourceValidTo: '2024-08-16',
  sourceRole: 'official-snapshot',
};

const r2RevosaxSource = {
  kind: 'revosax-snapshot',
  label: 'Amtliche REVOSax-Fassung, gültig ab 2023-10-31',
  availability: 'r2-archived',
  objectKey: 'revosax/2023-11-01/20250.1.html',
  url: 'https://www.revosax.sachsen.de/vorschrift/20250.1',
  retrievedAt: '2026-09-03',
  sha256: 'e0d5a02ce28a8d9fad47d8b8133fac18cfb5ffd9f0a1bd0d673d1ef76e41d69d',
  lawId: '20250',
  sourceValidFrom: '2023-10-31',
  sourceRole: 'official-snapshot',
  mediaType: 'text/html',
};

function version(sourceReferences: unknown[]) {
  return parseNormVersion({
    versionId: '2023-11-01',
    validFrom: '2023-11-01',
    validTo: null,
    isCurrent: true,
    citation: 'Verordnung vom 27. September 2023 (SächsGVBl. S. 837)',
    changeNote: 'Ausgangsfassung.',
    sourceReferences,
    body: [{ type: 'paragraph', label: '§ 1', children: [{ type: 'paragraphText', text: 'Text.' }] }],
  });
}

test('lokal versionierte REVOSax-Quelle bleibt gültig', () => {
  const parsed = version([localRevosaxSource]);
  assert.equal(parsed.sourceReferences?.[0].availability, 'versioned');
  assert.equal(parsed.sourceReferences?.[0].localSource, localRevosaxSource.localSource);
  assert.equal(parsed.sourceReferences?.[0].objectKey, undefined);
});

test('in R2 archivierte REVOSax-Quelle wird mit vollständiger Provenienz akzeptiert', () => {
  const parsed = version([r2RevosaxSource]);
  const source = parsed.sourceReferences?.[0];
  assert.equal(source?.availability, 'r2-archived');
  assert.equal(source?.objectKey, 'revosax/2023-11-01/20250.1.html');
  assert.equal(source?.localSource, undefined);
  assert.equal(source?.sha256, r2RevosaxSource.sha256);
  assert.equal(source?.sourceRole, 'official-snapshot');
  const meta = parseNormMeta({
    id: 'x', slug: 'x', title: 'X', shortTitle: 'X', type: 'verordnung', subjects: ['Landesrecht'], keywords: [],
    initialCitation: 'Verordnung vom 27. September 2023', predecessor: null, successor: null, summary: 'S.', status: 'in-force',
    sourceReferences: [r2RevosaxSource, { ...r2RevosaxSource, bucket: 'ostrecht-recht-quellen' }],
  });
  assert.equal(meta.sourceReferences?.[1].bucket, 'ostrecht-recht-quellen');
});

test('R2-Quelle ohne Hash wird abgelehnt', () => {
  const { sha256, ...withoutHash } = r2RevosaxSource;
  assert.throws(() => version([withoutHash]), /sha256: ist für eine in R2 archivierte Quelle erforderlich/u);
  assert.throws(() => version([{ ...r2RevosaxSource, sha256: 'ABC' }]), /sha256: muss ein SHA-256-Hexwert/u);
});

test('R2-Quelle ohne Object-Key oder mit unvollständiger amtlicher Provenienz wird abgelehnt', () => {
  const { objectKey, ...withoutKey } = r2RevosaxSource;
  assert.throws(() => version([withoutKey]), /objectKey: ist für eine in R2 archivierte Quelle erforderlich/u);
  assert.throws(() => version([{ ...r2RevosaxSource, objectKey: 'ohne-praefix.html' }]), /objectKey: muss ein R2-Objektschlüssel/u);
  const { url, ...withoutUrl } = r2RevosaxSource;
  assert.throws(() => version([withoutUrl]), /url: muss die amtliche Fassungs-URL/u);
  const { lawId, ...withoutLawId } = r2RevosaxSource;
  assert.throws(() => version([withoutLawId]), /lawId: ist für eine in R2 archivierte REVOSax-Quelle erforderlich/u);
  const { sourceValidFrom, ...withoutValidity } = r2RevosaxSource;
  assert.throws(() => version([withoutValidity]), /sourceValidFrom: ist für eine in R2 archivierte REVOSax-Quelle erforderlich/u);
  const { retrievedAt, ...withoutRetrievedAt } = r2RevosaxSource;
  assert.throws(() => version([withoutRetrievedAt]), /retrievedAt: ist für eine in R2 archivierte Quelle erforderlich/u);
  assert.throws(() => version([{ ...r2RevosaxSource, sourceRole: 'visual-control' }]), /sourceRole: muss für eine in R2 archivierte REVOSax-Quelle official-snapshot oder envelope-snapshot sein/u);
  // Die Mantelvorschrift eines eigenständig geführten Artikels ist als envelope-snapshot zulässig.
  assert.equal(version([{ ...r2RevosaxSource, sourceRole: 'envelope-snapshot' }]).sourceReferences?.[0]?.sourceRole, 'envelope-snapshot');
  assert.throws(() => version([{ ...r2RevosaxSource, mediaType: 'application/pdf' }]), /mediaType: muss für eine in R2 archivierte REVOSax-Quelle text\/html sein/u);
});

test('Mischformen aus Repositorydatei und R2-Objekt werden abgelehnt', () => {
  assert.throws(() => version([{ ...localRevosaxSource, objectKey: 'revosax/2023-11-01/3348.12.html' }]), /objectKey: ist nur für eine in R2 archivierte Quelle/u);
  assert.throws(() => version([{ ...localRevosaxSource, bucket: 'ostrecht-recht-quellen' }]), /objectKey: ist nur für eine in R2 archivierte Quelle/u);
  assert.throws(() => version([{ ...r2RevosaxSource, localSource: 'data/recht/sources/revosax/x/20250.1.html' }]), /localSource: darf bei einer in R2 archivierten Quelle nicht gesetzt sein/u);
  const { localSource, ...versionedWithoutFile } = localRevosaxSource;
  assert.throws(() => version([versionedWithoutFile]), /localSource: ist für eine versionierte Quelle erforderlich/u);
  assert.throws(() => version([{ ...r2RevosaxSource, kind: 'structured-html-transcription' }]), /availability: r2-archived ist nur für revosax-snapshot zulässig/u);
  assert.throws(() => version([{ ...r2RevosaxSource, availability: 'external' }]), /availability: muss einer dieser Werte sein/u);
});
