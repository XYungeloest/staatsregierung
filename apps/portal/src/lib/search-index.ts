import { loadAllNorms } from '@ostrecht/shared/lib/norms/content.ts';
import { isInheritedAmendment } from '@ostrecht/shared/lib/norms/inventory.ts';
import { getNormOriginInfo } from '@ostrecht/shared/lib/norms/origin.ts';
import { getPublicNormSummary } from '@ostrecht/shared/lib/norms/identity.ts';
import { toDisplayText } from '@ostrecht/shared/lib/norms/presentation.ts';
import { loadAllVerkuendungen } from '@ostrecht/shared/lib/norms/publications.ts';
import { getNormUrl, getPublicationUrl } from '@ostrecht/shared/lib/norms/routes.ts';
import { getApplicableVersion } from '@ostrecht/shared/lib/norms/versions.ts';
import { siteConfig, siteUrls, type PortalSectionKey } from '@ostrecht/shared/config/site.ts';
import {
  loadBeteiligungsUebersicht,
  loadBudgetPages,
  loadEvents,
  loadFreestatePages,
  loadGovernmentMembers,
  loadJobOffers,
  loadMinistries,
  loadPages,
  loadPressReleases,
  loadSpeeches,
  loadTopics,
} from '@ostrecht/shared/lib/portal/content.ts';
import { loadLegislativeProcedures } from '@ostrecht/shared/lib/portal/legislation.ts';
import {
  getAccessibilityUrl,
  getBudgetPageUrl,
  getContactUrl,
  getEventUrl,
  getFreestatePageUrl,
  getGovernmentMemberUrl,
  getHoldingsUrl,
  getImprintUrl,
  getJobUrl,
  getKreisreformUrl,
  getMinistryUrl,
  getPressReleaseUrl,
  getPrivacyUrl,
  getSpeechUrl,
  getTopicUrl,
} from '@ostrecht/shared/lib/portal/routes.ts';
import { buildPortalRouteInventory } from './route-inventory.ts';

/**
 * Der Suchbestand des Staatsportals liegt in zwei Dateien.
 *
 * `/search-index.json` trägt die Portalinhalte mit ihrem sichtbaren Fließtext; die Suchseite lädt
 * sie sofort. `/search-index-recht.json` trägt die Bezeichnungen des Rechtsbestands in schmaler
 * Form und wird erst geladen, wenn der Bereichsfilter das Recht überhaupt einschließt. Vor der
 * Trennung lud jeder erste Suchaufruf 4,68 MB (5.469 Einträge, davon 92,7 Prozent Recht); der
 * Volltext einer Vorschrift bleibt Sache der Rechtssuche, die dafür eine eigene Datenbank hat.
 */
export interface PortalSearchEntry {
  id: string;
  section: PortalSectionKey;
  type: string;
  typeLabel: string;
  title: string;
  /** Weitere Bezeichnungen derselben Seite, etwa der Bereichsname der Hauptnavigation. */
  aliases?: string[];
  description: string;
  url: string;
  text: string;
  date?: string;
  /** Bereichseinstiege ranken vor Detailseiten desselben Bereichs. */
  landing?: boolean;
}

export interface LawSearchEntry {
  typeLabel: string;
  title: string;
  /** Abkürzung und Kurztitel: eine exakte Eingabe wie „OstSchulG“ trifft hier. */
  aliases?: string[];
  description: string;
  /** Adresse ohne Origin; die Suchseite setzt `origin` aus der Nutzlast davor. */
  url: string;
  text: string;
  date?: string;
}

export interface PortalSearchPayload {
  generatedAt: string;
  entries: PortalSearchEntry[];
}

export interface LawSearchPayload {
  generatedAt: string;
  /** Origin des Rechtsportals; die Einträge tragen nur ihren Pfad. */
  origin: string;
  entries: LawSearchEntry[];
}

const servicePageUrls: Record<string, () => string> = {
  barrierefreiheit: getAccessibilityUrl,
  datenschutz: getPrivacyUrl,
  impressum: getImprintUrl,
  kontakt: getContactUrl,
};

function joinText(values: Array<string | string[] | null | undefined>): string {
  return values.flatMap((value) => (Array.isArray(value) ? value : [value])).filter(Boolean).join(' ');
}

/** Sichtbarer Text einer Portalseite: Fließtext, Teaser, Zwischenüberschriften und Datenfelder. */
function extractPortalSearchText(values: Array<string | string[] | null | undefined>): string {
  return joinText(values).replace(/\s+/gu, ' ').trim();
}

const sectionLabels = new Map(siteConfig.sections.map((section) => [section.key, section.label]));

export async function buildPortalSearchEntries(): Promise<PortalSearchEntry[]> {
  const [
    inventory,
    members,
    ministries,
    topics,
    pressReleases,
    speeches,
    events,
    budgetPages,
    freestatePages,
    servicePages,
    holdingsOverview,
    jobOffers,
    legislativeProcedures,
  ] = await Promise.all([
    buildPortalRouteInventory(),
    loadGovernmentMembers(),
    loadMinistries(),
    loadTopics(),
    loadPressReleases(),
    loadSpeeches(),
    loadEvents(),
    loadBudgetPages(),
    loadFreestatePages(),
    loadPages(),
    loadBeteiligungsUebersicht(),
    loadJobOffers(),
    loadLegislativeProcedures(),
  ]);

  // Der Fließtext je Adresse; das Inventar liefert Titel, Bereich und Kurzbeschreibung.
  const bodyByPath = new Map<string, string>();
  const dateByPath = new Map<string, string>();
  const typeByPath = new Map<string, { type: string; typeLabel: string }>();
  const record = (
    path: string,
    text: string,
    type: { type: string; typeLabel: string },
    date?: string,
  ) => {
    bodyByPath.set(path, text);
    typeByPath.set(path, type);
    if (date) dateByPath.set(path, date);
  };

  for (const member of members) {
    record(
      getGovernmentMemberUrl(member.slug),
      extractPortalSearchText([member.ressort, member.kurzbiografie, member.langbiografie]),
      { type: 'government', typeLabel: member.current ? 'Staatsrat' : 'Regierungsarchiv' },
    );
  }
  for (const ministry of ministries) {
    record(
      getMinistryUrl(ministry.slug),
      extractPortalSearchText([ministry.kurzname, ministry.leitung, ministry.aufgaben, ministry.themen]),
      { type: 'ministry', typeLabel: 'Staatssekretariat' },
    );
  }
  for (const topic of topics) {
    record(
      getTopicUrl(topic.slug),
      extractPortalSearchText([
        topic.teaser,
        topic.status,
        topic.federfuehrendesRessort,
        topic.beschlossen,
        topic.umgesetzt,
        topic.naechsteSchritte,
        topic.rechtsgrundlagen.map((entry) => entry.label),
        topic.faq.flatMap((entry) => [entry.question, entry.answer]),
        topic.keyDates.flatMap((entry) => [entry.label, entry.note ?? '']),
        // Alle sichtbaren Inhaltsmodule der Themenseite, nicht nur ihre Statusfelder.
        topic.modules.flatMap((entry) => [
          entry.title,
          entry.intro ?? '',
          ...entry.items.flatMap((item) =>
            Object.entries(item)
              // Datumswerte tragen keinen Suchwert, Bezeichnungen und Texte schon.
              .filter(([key, value]) => typeof value === 'string' && !key.toLowerCase().includes('date'))
              .map(([, value]) => value as string),
          ),
        ]),
      ]),
      { type: 'topic', typeLabel: 'Thema' },
      topic.updatedAt,
    );
  }
  for (const release of pressReleases) {
    record(
      getPressReleaseUrl(release.slug),
      extractPortalSearchText([release.teaser, release.ressort, release.tags, release.body]),
      { type: 'press', typeLabel: 'Pressemitteilung' },
      release.date,
    );
  }
  for (const speech of speeches) {
    record(
      getSpeechUrl(speech.slug),
      extractPortalSearchText([speech.teaser, speech.sprecher, speech.body]),
      { type: 'speech', typeLabel: 'Rede' },
      speech.date,
    );
  }
  for (const event of events) {
    record(
      getEventUrl(event.slug),
      extractPortalSearchText([event.teaser, event.location, event.body, event.relatedLegislationSlugs]),
      { type: 'event', typeLabel: 'Termin' },
      event.date,
    );
  }
  for (const page of budgetPages) {
    record(getBudgetPageUrl(page.slug), extractPortalSearchText([page.teaser, page.body]), {
      type: 'budget',
      typeLabel: 'Haushalt',
    });
  }
  for (const page of freestatePages) {
    record(getFreestatePageUrl(page.slug), extractPortalSearchText([page.body]), {
      type: 'freestate',
      typeLabel: 'Über den Freistaat',
    });
  }
  for (const job of jobOffers) {
    record(
      getJobUrl(job.slug),
      extractPortalSearchText([job.teaser, job.ressort, job.standort, job.arbeitsbereich, job.employmentType, job.payGrade, job.body]),
      { type: 'job', typeLabel: 'Karriere' },
      job.datePosted,
    );
  }
  for (const page of servicePages) {
    const getUrl = servicePageUrls[page.slug];
    if (getUrl) {
      record(getUrl(), extractPortalSearchText([page.body]), { type: 'service', typeLabel: 'Service' });
    }
  }
  bodyByPath.set(
    getHoldingsUrl(),
    extractPortalSearchText([
      holdingsOverview.lead,
      holdingsOverview.introduction,
      holdingsOverview.sections.flatMap((section) => [
        section.title,
        section.intro,
        ...section.items.flatMap((item) => [item.title, item.label ?? '', item.text, item.note ?? '']),
      ]),
      holdingsOverview.changes.flatMap((change) => [change.title, change.label, change.text]),
      holdingsOverview.continuingItems,
      holdingsOverview.unresolvedItems,
    ]),
  );
  dateByPath.set(getHoldingsUrl(), holdingsOverview.asOf);

  const entries = inventory
    .filter((route) => route.search)
    .map((route): PortalSearchEntry => {
      const kind = typeByPath.get(route.path) ?? {
        type: route.section,
        typeLabel: sectionLabels.get(route.section) ?? 'Staatsportal',
      };
      const aliases = route.landing ? [sectionLabels.get(route.section) ?? ''].filter(Boolean) : [];
      return {
        id: route.path,
        section: route.section,
        type: kind.type,
        typeLabel: kind.typeLabel,
        title: route.title,
        ...(aliases.length > 0 ? { aliases } : {}),
        description: route.description,
        url: route.path,
        text: extractPortalSearchText([route.searchText, bodyByPath.get(route.path)]),
        ...(route.lastmod ?? dateByPath.get(route.path)
          ? { date: route.lastmod ?? dateByPath.get(route.path) }
          : {}),
        ...(route.landing ? { landing: true } : {}),
      };
    });

  // Gesetzgebungsverfahren haben keine eigene Seite; sie verweisen auf ihr Thema.
  const known = new Set(entries.map((entry) => entry.url));
  for (const procedure of legislativeProcedures) {
    const url =
      procedure.slug === 'kreis-und-bezirksneuordnungsgesetz'
        ? getKreisreformUrl()
        : procedure.relatedTopics[0]
          ? getTopicUrl(procedure.relatedTopics[0])
          : '';
    if (!url || !known.has(url)) continue;
    const target = entries.find((entry) => entry.url === url);
    if (!target) continue;
    target.text = extractPortalSearchText([
      target.text,
      procedure.title,
      procedure.shortTitle,
      procedure.documentNumber,
      procedure.initiator,
      procedure.statusLabel,
      procedure.leadCommittee,
      procedure.proposedCommittee,
      procedure.recommendation?.documentNumber,
    ]);
  }

  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export async function buildPortalSearchPayload(): Promise<PortalSearchPayload> {
  return { generatedAt: new Date().toISOString(), entries: await buildPortalSearchEntries() };
}

/**
 * Schmaler Rechtsindex: Bezeichnung, Abkürzung, Sachgebiete und Fundstelle einer Vorschrift –
 * genug, um sie im Staatsportal zu finden und zu benennen. Der Volltext bleibt in der
 * Rechtssuche, die ihn aus der Laufzeitdatenbank liest.
 */
export async function buildLawSearchEntries(): Promise<LawSearchEntry[]> {
  const [norms, publications] = await Promise.all([loadAllNorms(), loadAllVerkuendungen()]);

  const entries: LawSearchEntry[] = [
    // Dieselbe Grundmenge wie Verzeichnisse, A–Z und Standardsuche des Rechtsportals: ohne die
    // aus dem sächsischen Rechtsstand übernommenen Änderungsvorschriften. Sie sind historische
    // Änderungsträger und bleiben über die Rechtssuche erreichbar, auf die die Trefferliste
    // ausdrücklich verweist.
    ...norms
      .filter((norm) => !isInheritedAmendment({ type: norm.meta.type, originKind: getNormOriginInfo(norm, norms).kind }))
      .map((norm) => {
        const aliases = [toDisplayText(norm.meta.abbr ?? ''), toDisplayText(norm.meta.shortTitle ?? '')]
          .map((value) => value.trim())
          .filter(Boolean);
        const validFrom = getApplicableVersion(norm)?.validFrom;
        return {
          typeLabel: 'Recht',
          title: toDisplayText(norm.meta.title),
          ...(aliases.length > 0 ? { aliases: [...new Set(aliases)] } : {}),
          // Abgeleitete Formeln bleiben unveröffentlicht; die Suche zeigt dann keinen Anrisstext.
          description: toDisplayText(getPublicNormSummary(norm.meta) ?? ''),
          url: getNormPath(norm.meta.slug),
          text: joinText([
            toDisplayText(norm.meta.responsibleMinistry ?? norm.meta.ministry),
            norm.meta.subjects.map(toDisplayText),
            norm.meta.keywords.map(toDisplayText),
          ]),
          ...(validFrom ? { date: validFrom } : {}),
        };
      }),
    ...publications.map((publication) => ({
      typeLabel: 'Verkündung',
      title: toDisplayText(publication.title),
      description: `${publication.publication} ${publication.year} Nr. ${publication.issue}`,
      url: getPublicationPath(publication.slug),
      text: joinText([publication.publication, publication.place, publication.publisher]),
      date: publication.date,
    })),
  ];

  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

function toPath(url: string): string {
  return url.startsWith('http') ? new URL(url).pathname : url;
}

function getNormPath(slug: string): string {
  return toPath(getNormUrl(slug));
}

function getPublicationPath(slug: string): string {
  return toPath(getPublicationUrl(slug));
}

export async function buildLawSearchPayload(): Promise<LawSearchPayload> {
  return {
    generatedAt: new Date().toISOString(),
    origin: siteUrls.law,
    entries: await buildLawSearchEntries(),
  };
}
