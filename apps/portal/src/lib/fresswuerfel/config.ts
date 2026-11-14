import source from '../../../../../content/kampagnen/fresswuerfel.json' with { type: 'json' };

export const campaignPath = '/themen/fresswuerfel-maskottchen/';
export const campaignTitle = 'Wie soll das Fresswürfel-Maskottchen aussehen?';
export const campaignLead = 'Für Fresswürfel, die geplante Schnellrestaurantkette der Handelsorganisation Ost, suchen wir ein Maskottchen. Beschreiben Sie Ihre Idee oder reichen Sie eine Skizze ein.';
export type Phase = 'vorbereitet' | 'einreichung' | 'sichtung' | 'ergebnis';
export interface Candidate { slug: string; title: string; description: string; image?: { src: string; alt: string } }
export interface Campaign {
  phase: Phase;
  startsAt: string | null;
  endsAt: string | null;
  teaserFrom: string | null;
  teaserUntil: string | null;
  privacyContact: string | null;
  retentionDays: number | null;
  candidates: Candidate[];
  result: { title: string; description: string; explanation?: string } | null;
}
export function validateCampaign(value: unknown): Campaign {
  const c = value as Campaign;
  if (!c || !['vorbereitet', 'einreichung', 'sichtung', 'ergebnis'].includes(c.phase)) throw new Error('Ungültige Kampagnenphase');
  for (const key of ['startsAt', 'endsAt', 'teaserFrom', 'teaserUntil'] as const) {
    if (c[key] !== null && (typeof c[key] !== 'string' || !/T.*(Z|[+-]\d\d:\d\d)$/.test(c[key]!) || !Number.isFinite(Date.parse(c[key]!)))) throw new Error(`Ungültiger Termin: ${key}`);
  }
  if (c.startsAt && c.endsAt && Date.parse(c.startsAt) >= Date.parse(c.endsAt)) throw new Error('Ende muss nach Start liegen');
  if (c.retentionDays !== null && (!Number.isInteger(c.retentionDays) || c.retentionDays < 1 || c.retentionDays > 730)) throw new Error('Ungültige Löschfrist');
  if (c.privacyContact !== null && (typeof c.privacyContact !== 'string' || !c.privacyContact.trim())) throw new Error('Datenschutzkontakt fehlt');
  if (!Array.isArray(c.candidates) || c.candidates.some(x => !x.slug || !x.title || !x.description || Object.keys(x).some(k => !['slug', 'title', 'description', 'image'].includes(k)))) throw new Error('Ungültige öffentliche Auswahl');
  for (const item of c.candidates) {
    if (item.image && (!/^\/images\/fresswuerfel\/auswahl\/[0-9a-f-]+\.webp$/.test(item.image.src) || !item.image.alt?.trim())) throw new Error('Ungültiges freigegebenes Bild');
  }
  if (new Set(c.candidates.map(x => x.slug)).size !== c.candidates.length) throw new Error('Doppelte Kandidatur');
  if (c.result !== null && (!c.result.title || !c.result.description || Object.keys(c.result).some(k => !['title', 'description', 'explanation'].includes(k)))) throw new Error('Ungültiges Ergebnis');
  return c;
}
export const campaign = validateCampaign(source);
export function isSubmissionPhase(c: Campaign, now = Date.now()): boolean {
  return c.phase === 'einreichung' && (!c.startsAt || now >= Date.parse(c.startsAt)) && (!c.endsAt || now < Date.parse(c.endsAt));
}
export function showTeaser(c: Campaign, now: number): boolean {
  return isSubmissionPhase(c, now) && Boolean(c.teaserFrom && c.teaserUntil && now >= Date.parse(c.teaserFrom) && now < Date.parse(c.teaserUntil));
}
export function formatCampaignDate(date: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'short' }).format(new Date(date));
}
