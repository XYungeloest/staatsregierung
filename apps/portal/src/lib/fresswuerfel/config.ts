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
  result: { title: string; description: string; publishedOn?: string; explanation?: string; image?: { src: string; alt: string; width: number; height: number } } | null;
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
  if (c.result !== null && (!c.result.title || !c.result.description || Object.keys(c.result).some(k => !['title', 'description', 'publishedOn', 'explanation', 'image'].includes(k)))) throw new Error('Ungültiges Ergebnis');
  const publishedOn = c.result?.publishedOn;
  if (publishedOn !== undefined && (!/^\d{4}-\d{2}-\d{2}$/u.test(publishedOn)
    || new Date(publishedOn).toJSON()?.slice(0, 10) !== publishedOn)) {
    throw new Error('Ungültiges Veröffentlichungsdatum des Ergebnisses');
  }
  const image = c.result?.image;
  if (image && (!/^\/images\/fresswuerfel\/[a-z0-9-]+\.webp$/.test(image.src) || !image.alt?.trim()
    || !Number.isInteger(image.width) || image.width <= 0 || !Number.isInteger(image.height) || image.height <= 0)) {
    throw new Error('Ungültiges Ergebnisbild');
  }
  return c;
}
export const campaign = validateCampaign(source);
export function campaignSummary(c: Campaign, now = Date.now()) {
  if (c.phase === 'ergebnis' && c.result) {
    return { title: `${c.result.title} – das Fresswürfel-Maskottchen`, description: c.result.description };
  }
  if (isSubmissionPhase(c, now)) return { title: campaignTitle, description: campaignLead };
  const title = 'Maskottchenwettbewerb für Fresswürfel';
  if (c.phase === 'sichtung') return { title, description: 'Die Handelsorganisation Ost sichtet die eingereichten Ideen für das Maskottchen ihrer geplanten Schnellrestaurantkette.' };
  if (c.phase === 'ergebnis') return { title, description: 'Die Handelsorganisation Ost gibt das Ergebnis des Wettbewerbs nach der Freigabe bekannt.' };
  if (c.endsAt && now >= Date.parse(c.endsAt)) return { title, description: 'Die Einreichungsfrist für den Maskottchenwettbewerb ist abgelaufen.' };
  return { title, description: 'Die Handelsorganisation Ost bereitet den Maskottchenwettbewerb für ihre geplante Schnellrestaurantkette vor.' };
}
export function isSubmissionPhase(c: Campaign, now = Date.now()): boolean {
  return c.phase === 'einreichung' && (!c.startsAt || now >= Date.parse(c.startsAt)) && (!c.endsAt || now < Date.parse(c.endsAt));
}
export function showTeaser(c: Campaign, now: number): boolean {
  return isSubmissionPhase(c, now) && Boolean(c.teaserFrom && c.teaserUntil && now >= Date.parse(c.teaserFrom) && now < Date.parse(c.teaserUntil));
}
export function formatCampaignDate(date: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'long', timeStyle: 'short' }).format(new Date(date));
}
