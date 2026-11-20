import assert from 'node:assert/strict';
import test from 'node:test';
import { selectHomeNotices } from '../apps/portal/src/lib/home-notices.ts';
import { parseHomeContent } from '@ostrecht/shared/lib/portal/schema.ts';

const notice = { id: 'haupt', title: 'Hinweis', href: '/dienst/', icon: 'press' };
const home = (items: unknown[]) => parseHomeContent({ hero: { eyebrow: 'A', title: 'B', lead: 'C', image: '/bild.jpg',
  imageAlt: 'Bild', searchLabel: 'Suche', searchPlaceholder: 'Suchen' }, portalAccesses: [], importantItems: items });
test('Hinweise berücksichtigen beide Grenztage, Regierung, redaktionelle Freigabe und Ersatzpriorität', () => {
  const { importantItems } = home([{ ...notice, validFrom: '2030-02-01', validUntil: '2030-02-03', priority: 4 },
    { ...notice, id: 'ersatz', replaces: 'haupt', priority: 2 }, { ...notice, id: 'reserve', replaces: 'haupt', priority: 1 },
    { ...notice, id: 'amt', governmentSlug: 'alt' }, { ...notice, id: 'gesperrt', enabled: false }, { ...notice, id: 'zweiter' }]);
  const ids = (day: string) => selectHomeNotices(importantItems, day, 'neu').map((i) => i.id);
  assert.deepEqual(ids('2030-02-01'), ['haupt', 'zweiter']);
  assert.deepEqual(ids('2030-02-03'), ['haupt', 'zweiter']);
  assert.deepEqual(ids('2030-02-04'), ['ersatz', 'zweiter']);
  assert.deepEqual(ids('2030-01-31'), ['ersatz', 'zweiter']);
  assert.throws(() => home([{ ...notice, validUntil: '2030-02-30' }]), /Kalendertag/);
  assert.throws(() => home([{ ...notice, replaces: 'haupt' }]), /Ersatzbezug/);
});
