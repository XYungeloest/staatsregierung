import {
  getBudgetUrl,
  getCabinetUrl,
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
    title: 'Kabinett Honecker I bildet die Staatsregierung',
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
    ressort: 'Inneres und Wohnungswirtschaft',
    href: getNormUrl('verordnung-zur-bestimmung-der-gebiete-mit-mietpreisbegrenzung-bei-mietbeginn'),
  },
  {
    id: 'landesbank-und-vergabe',
    date: '2026-01-26',
    title: 'Landesbank- und Vergaberecht werden neu geordnet',
    type: 'gesetz',
    summary:
      'Die finanzpolitische Infrastruktur des Freistaates wird mit Landesbankgesetz, Tariftreue und Verkündungsrecht konsolidiert.',
    ressort: 'Finanzen',
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
    ressort: 'Rechtsstaatlichkeit und kulturelle Emanzipation',
    href: getTopicUrl('rundfunkreform'),
  },
  {
    id: 'haushaltsgesetz',
    date: '2026-03-23',
    title: 'Doppelhaushalt 2025/2026 wird als Finanzrahmen wirksam',
    type: 'haushalt',
    summary:
      'Mit dem Haushaltsgesetz erhält die Regierungsarbeit einen verbindlichen Finanzrahmen für Ressorts, Investitionen und Fonds.',
    ressort: 'Finanzen',
    href: getBudgetUrl(),
  },
  {
    id: 'kulturpassgesetz',
    date: '2026-03-23',
    title: 'Kulturpassgesetz tritt in Kraft',
    type: 'gesetz',
    summary:
      'Der Kulturpass schafft einen neuen, landesweit sichtbaren Zugang zu kultureller Teilhabe für junge Erwachsene.',
    ressort: 'Rechtsstaatlichkeit und kulturelle Emanzipation',
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
    ressort: 'Inneres und Wohnungswirtschaft',
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
    ressort: 'Staats- und Grenzsicherheit',
    href: getPressReleaseUrl('abschiebungen-in-den-iran-voruebergehend-ausgesetzt'),
  },
  {
    id: 'schulmilcherlass',
    date: '2026-04-07',
    title: 'Schulmilcherlass ergänzt die Bildungs- und Sozialpraxis',
    type: 'gesetz',
    summary:
      'Flankierende Verwaltungsvorschriften vertiefen die alltagspraktische Umsetzung der Bildungs- und Fürsorgepolitik.',
    ressort: 'Volksbildung und Wissenschaft',
    href: getNormUrl('schulmilcherlass'),
  },
  {
    id: 'kabinett-honecker-i-ende',
    date: '2026-05-04',
    title: 'Kabinett Honecker I endet als erste Aufbauphase',
    type: 'kabinett',
    summary:
      'Die bisherige Staatsregierung wird historisch nachvollziehbar archiviert; ihre Normen, Pressebeiträge und Programmstände bleiben im Portal erreichbar.',
    ressort: 'Staatskanzlei',
    href: getGovernmentUrl(),
  },
  {
    id: 'kabinett-honecker-ii',
    date: '2026-05-04',
    title: 'Kabinett Honecker II nimmt die Arbeit auf',
    type: 'kabinett',
    summary:
      'Mit dem Kabinett Honecker II beginnt die zweite sozialstaatliche Aufbauphase des Freistaates auf Grundlage des neuen 15-Punkte-Plans.',
    ressort: 'Staatskanzlei',
    href: getGovernmentUrl(),
  },
  {
    id: 'organisationserlass-05-2026',
    date: '2026-05-04',
    title: 'Organisationserlass 05/2026 ordnet Ressorts neu',
    type: 'gesetz',
    summary:
      'Die Staatsministerien erhalten neue Bezeichnungen; das bisherige Kultur-, Wissenschafts- und Tourismusressort wird aufgelöst und sachlich zugeordnet.',
    ressort: 'Staatskanzlei',
    href: getNormUrl('erlass-des-ministerprasidenten-uber-die-zustandigkeit-der-staatsministerien-organisationserlass-05-2026'),
  },
  {
    id: 'anwendungsgesetze-vergesellschaftung-mai-2026',
    date: '2026-05-15',
    title: 'Entwürfe zur öffentlichen Verkehrs- und Energieinfrastruktur werden eingebracht',
    type: 'projekt',
    summary:
      'Die Gesetzgebungsverfahren zur Ostdeutschen Eisenbahn sowie zur Energie- und Wärmeinfrastruktur sind im Landtag anhängig und für die zweite Lesung am 20. Juli 2026 vorgesehen.',
    ressort: 'Staatsregierung',
    href: getTopicUrl('oeffentliche-wirtschaft-und-strukturwandel'),
  },
  {
    id: 'kabinett-honecker-ii-erste-veraenderungen',
    date: '2026-05-19',
    title: 'Erste personelle Veränderungen im Kabinett Honecker II',
    type: 'kabinett',
    summary:
      'Thomas Henry Barlow übernimmt das Staatsministerium für Staats- und Grenzsicherheit und führt zugleich vorübergehend das Innenressort. Mia Wollrath scheidet aus dem Kabinett aus.',
    ressort: 'Staatskanzlei',
    href: getCabinetUrl(),
  },
  {
    id: 'koalitionsmehrheit-juli-2026',
    date: '2026-07-05',
    title: 'Koalition verfügt über elf von fünfzehn Sitzen',
    type: 'kabinett',
    summary:
      'Nach den dokumentierten Fraktionsübertritten verfügt die Regierungskoalition über elf der fünfzehn Sitze im 7. Ostdeutschen Landtag.',
    ressort: 'Staatskanzlei',
    href: getGovernmentUrl(),
  },
  {
    id: 'kabinett-honecker-ii-umbildung',
    date: '2026-07-07',
    title: 'Kabinett Honecker II wird umgebildet',
    type: 'kabinett',
    summary:
      'Volker Bagdadi übernimmt das Staatsministerium des Innern und für Wohnungswirtschaft. Yannik Schmäle übernimmt das Staatsministerium für Nachhaltigkeit und Energie. Thomas Henry Barlow bleibt Staatsminister für Staats- und Grenzsicherheit.',
    ressort: 'Staatskanzlei',
    href: getCabinetUrl(),
  },
  {
    id: 'dritte-plenarsitzung-gesetzespaket',
    date: '2026-07-20',
    title: 'Zwölf Gesetze werden verkündet',
    type: 'gesetz',
    summary:
      'Die Ausgaben 46 bis 57 des Gesetz- und Verordnungsblattes dokumentieren die Verkündung der zwölf zuvor für die dritte Plenarsitzung angesetzten Vorhaben. Einzelne Abstimmungsergebnisse sind damit nicht dokumentiert.',
    ressort: '7. Volkskammer',
    href: getTopicUrl('staatsreform-und-verfassung'),
  },
  {
    id: 'barlow-entlassung',
    date: '2026-07-20',
    title: 'Thomas Henry Barlow scheidet aus der Staatsorganisation aus',
    type: 'kabinett',
    summary:
      'Thomas Henry Barlow wird als Staatsminister für Staats- und Grenzsicherheit entlassen und gehört dem am Folgetag entstehenden ersten Staatsrat nicht an.',
    ressort: 'Staatskanzlei',
    href: getCabinetUrl(),
  },
  {
    id: 'erster-staatsrat',
    date: '2026-07-21',
    title: 'Erster Staatsrat nimmt die Arbeit auf',
    type: 'kabinett',
    summary:
      'Mit dem Inkrafttreten der Großen Staatsreform wird die bisherige Staatsregierung übergangsweise zum ersten Staatsrat. Dr. Karl Honecker wird erster Staatspräsident.',
    ressort: 'Staatskanzlei',
    href: getGovernmentUrl(),
  },
  {
    id: 'sero-verordnung',
    date: '2026-07-21',
    title: 'SERO-Verordnung tritt in Kraft',
    type: 'gesetz',
    summary:
      'Der Staatsrat schafft einen Rechtsrahmen für die Sekundärrohstoff-Erfassung und die landeseigene Kreislaufwirtschaftsinfrastruktur.',
    ressort: 'Nachhaltigkeit und Energie',
    href: getNormUrl('sero-verordnung'),
  },
  {
    id: 'kreis-und-bezirksneuordnung-wirksam',
    date: '2026-08-01',
    title: 'Neue Kreis- und Bezirksordnung tritt in Kraft',
    type: 'gesetz',
    summary:
      'Vierzehn Bezirke und die neu geordneten Kreise bilden den geltenden Gebietsstand. Die frühere Ordnung bleibt als historischer Vergleich erreichbar.',
    ressort: 'Inneres und Wohnungswirtschaft',
    href: getTopicUrl('kommunen-regionen-und-berlin'),
  },
];

export const timelineEntries = [...timelineEntrySeed].sort((left, right) =>
  left.date.localeCompare(right.date),
);
