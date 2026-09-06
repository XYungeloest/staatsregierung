import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getLawBridgeUrl,
  getLawHomeUrl,
  getTopicUrl,
  resolvePortalPath,
} from '@ostrecht/shared/lib/portal/routes.ts';
import {
  getNormHistoryUrl,
  getNormUrl,
  getNormVersionUrl,
  getPublicationEntriesUrl,
  getPublicationUrl,
} from '@ostrecht/shared/lib/norms/routes.ts';

const lawOrigin = 'https://recht.freistaat-ostdeutschland.de';

test('Portal-Routen verweisen zentral und ohne altes Präfix auf OstRecht', () => {
  assert.equal(getLawHomeUrl(), `${lawOrigin}/`);
  assert.equal(getNormUrl('beispielgesetz'), `${lawOrigin}/norm/beispielgesetz/`);
  assert.equal(getNormHistoryUrl('beispielgesetz'), `${lawOrigin}/norm/beispielgesetz/history/`);
  assert.equal(
    getNormVersionUrl('beispielgesetz', '2026-08-01'),
    `${lawOrigin}/norm/beispielgesetz/version/2026-08-01/`,
  );
  assert.equal(getPublicationUrl('ogvbl-2026-01'), `${lawOrigin}/verkuendungen/ogvbl-2026-01/`);
  // Fundstellen sind eine Ansicht der Verkündungen, keine eigene Adresse mehr.
  assert.equal(getPublicationEntriesUrl(), `${lawOrigin}/verkuendungen/?ansicht=eintraege`);
  assert.equal(resolvePortalPath('/recht/norm/beispielgesetz/'), `${lawOrigin}/norm/beispielgesetz/`);
  assert.equal(getLawBridgeUrl(), '/recht/');
  assert.equal(getTopicUrl('bildung'), '/themen/bildung/');
});

test('generische Altadressen werden permanent auf die konfigurierbare Rechts-Origin geleitet', () => {
  const configuredOrigin = 'https://recht.test.invalid';
  execFileSync(process.execPath, ['scripts/prepare-site-public.mjs', 'portal'], {
    cwd: process.cwd(),
    env: { ...process.env, LAW_SITE_URL: configuredOrigin },
  });
  const redirects = readFileSync('apps/portal/.site-public/_redirects', 'utf8');

  assert.match(redirects, new RegExp(`/recht/suche/ ${configuredOrigin}/suche/ 301`, 'u'));
  assert.match(redirects, new RegExp(`/recht/verfassung/ ${configuredOrigin}/norm/staatsverfassung-des-freistaates-ostdeutschland/ 301`, 'u'));
  assert.match(redirects, new RegExp(`/recht/norm/\\* ${configuredOrigin}/norm/:splat 301`, 'u'));
  assert.match(redirects, new RegExp(`/recht/verkuendungen/\\* ${configuredOrigin}/verkuendungen/:splat 301`, 'u'));
  // Aufgelöste Bereiche führen ohne Zwischenschritt an ihren neuen Ort.
  assert.match(redirects, new RegExp(`/recht/fundstellen/ ${configuredOrigin}/verkuendungen/\\?ansicht=eintraege 301`, 'u'));
  assert.match(redirects, new RegExp(`/recht/rechtsentwicklung/ ${configuredOrigin}/suche/ 301`, 'u'));
  assert.doesNotMatch(redirects, /^\/recht\s/mu);
});
