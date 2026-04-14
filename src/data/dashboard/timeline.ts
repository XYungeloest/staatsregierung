import {
  getBudgetUrl,
  getGovernmentUrl,
  getPressReleaseUrl,
  getTopicUrl,
} from '../../lib/portal/routes.ts';
import { getNormUrl } from '../../lib/norms/routes.ts';
import type { TimelineEntry } from '../../lib/portal/modules.ts';

const timelineEntrySeed: TimelineEntry[] = [
  {
    id: 'kabinett-honecker-bildung',
    date: '2025-12-20',
    title: 'Kabinett Honecker bildet die Staatsregierung',
    type: 'kabinett',
    summary:
      'Mit der Kabinettsbildung werden Ressortzuständigkeiten, Regierungsleitung und die politische Arbeitsgrundlage des Portals gesetzt.',
    ressort: 'Staatskanzlei',
    href: getGovernmentUrl(),
  },
  {
    id: 'mietpreis-und-kappungsgrenzen',
    date: '2025-12-30',
    title: 'Mietpreis- und Kappungsgrenzenregelungen treten in Kraft',
    type: 'gesetz',
    summary:
      'Die wohnungspolitische Regulierung wird mit Mietpreisbegrenzung und Kappungsgrenzen frühzeitig rechtlich abgesichert.',
    ressort: 'Inneres und Kommunales',
    href: getNormUrl('verordnung-zur-bestimmung-der-gebiete-mit-mietpreisbegrenzung-bei-mietbeginn'),
  },
  {
    id: 'landesbank-und-vergabe',
    date: '2026-01-26',
    title: 'Landesbank- und Vergaberecht werden neu geordnet',
    type: 'gesetz',
    summary:
      'Die finanzpolitische Infrastruktur des Freistaates wird mit Landesbankgesetz, Tariftreue und Verkündungsrecht konsolidiert.',
    ressort: 'Fiskus',
    href: getTopicUrl('haushalt-und-finanzen'),
  },
  {
    id: 'abkommen-polen',
    date: '2026-03-05',
    title: 'Grenzüberschreitendes Abkommen mit Polen wird aufgenommen',
    type: 'gesetz',
    summary:
      'Die Nachbarschaftspolitik erhält mit dem Abkommen zur grenzüberschreitenden Zusammenarbeit einen tragenden völkerrechtlichen Bezugspunkt.',
    ressort: 'Völkerfreundschaft',
    href: getTopicUrl('nachbarschaft-und-europa'),
  },
  {
    id: 'ndr-staatsvertrag',
    date: '2026-03-08',
    title: 'Rundfunkneuordnung wird staatsvertraglich abgesichert',
    type: 'gesetz',
    summary:
      'Die Rundfunkreform verbindet den Ostdeutschen Fernsehfunk mit einer staatsvertraglichen Neuordnung des Medienraums.',
    ressort: 'Kultur und Wissenschaft',
    href: getTopicUrl('rundfunkreform'),
  },
  {
    id: 'haushaltsgesetz',
    date: '2026-03-23',
    title: 'Doppelhaushalt 2025/2026 wird als Finanzrahmen wirksam',
    type: 'haushalt',
    summary:
      'Mit dem Haushaltsgesetz erhält die Regierungsarbeit einen verbindlichen Finanzrahmen für Ressorts, Investitionen und Fonds.',
    ressort: 'Fiskus',
    href: getBudgetUrl(),
  },
  {
    id: 'kulturpassgesetz',
    date: '2026-03-23',
    title: 'Kulturpassgesetz tritt in Kraft',
    type: 'gesetz',
    summary:
      'Der Kulturpass schafft einen neuen, landesweit sichtbaren Zugang zu kultureller Teilhabe für junge Erwachsene.',
    ressort: 'Kultur und Wissenschaft',
    href: getNormUrl('ostdeutsches-kulturpassgesetz'),
  },
  {
    id: 'transparenzpaket',
    date: '2026-03-23',
    title: 'Transparenz- und Lobbyregisterpaket wird abgeschlossen',
    type: 'gesetz',
    summary:
      'Informationszugang, Transparenz und Beteiligtendokumentation werden als zusammenhängendes Reformpaket rechtsförmig umgesetzt.',
    ressort: 'Rechtsstaatlichkeit',
    href: getTopicUrl('transparenz-und-lobbyregister'),
  },
  {
    id: 'wohnvollzug',
    date: '2026-03-24',
    title: 'Wohnvollzug wird mit Durchführungs- und Übergangsrecht konkretisiert',
    type: 'projekt',
    summary:
      'Die operative Steuerung der Wohnvergesellschaftung wird mit flankierenden Verordnungen und Bewertungsregeln vertieft.',
    ressort: 'Inneres und Kommunales',
    href: getTopicUrl('wohnen-und-vergesellschaftung'),
  },
  {
    id: 'staatliche-auszeichnungen',
    date: '2026-03-31',
    title: 'Stiftung staatlicher Auszeichnungen wird bekannt gemacht',
    type: 'presse',
    summary:
      'Die Staatsregierung verbindet symbolische Staatlichkeit mit öffentlicher Kommunikation und einer sichtbaren Auszeichnungsordnung.',
    ressort: 'Staatskanzlei',
    href: getPressReleaseUrl('freistaat-stiftet-neue-staatliche-auszeichnungen'),
  },
  {
    id: 'iran-abschiebungen',
    date: '2026-03-03',
    title: 'Abschiebungen in den Iran werden vorübergehend ausgesetzt',
    type: 'presse',
    summary:
      'Die Staatsregierung erläutert eine vorläufige humanitäre Entscheidung im Zusammenspiel von Sicherheits- und Menschenrechtspolitik.',
    ressort: 'Grenzschutz und bewaffnete Organe',
    href: getPressReleaseUrl('abschiebungen-in-den-iran-voruebergehend-ausgesetzt'),
  },
  {
    id: 'schulmilcherlass',
    date: '2026-04-07',
    title: 'Schulmilcherlass ergänzt die Bildungs- und Sozialpraxis',
    type: 'gesetz',
    summary:
      'Flankierende Verwaltungsvorschriften vertiefen die alltagspraktische Umsetzung der Bildungs- und Fürsorgepolitik.',
    ressort: 'Bildung und Sport',
    href: getNormUrl('schulmilcherlass'),
  },
];

export const timelineEntries = [...timelineEntrySeed].sort((left, right) =>
  left.date.localeCompare(right.date),
);
