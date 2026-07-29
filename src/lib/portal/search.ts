import { loadAllNorms } from '../norms/content.ts';
import { getApplicableVersion } from '../norms/versions.ts';
import { loadAllVerkuendungen } from '../norms/publications.ts';
import { getNormUrl, getPublicationUrl as getLawPublicationDetailUrl } from '../norms/routes.ts';
import { toDisplayText } from '../norms/presentation.ts';
import { loadLegislativeProcedures } from './legislation.ts';
import {
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
} from './content.ts';
import {
  getAccessibilityUrl,
  getBudgetPageUrl,
  getContactUrl,
  getEducationAndSchoolUrl,
  getEasyLanguageUrl,
  getEventUrl,
  getLawPublicationsUrl,
  getLawReferencesUrl,
  getFreestatePageUrl,
  getGovernmentMemberUrl,
  getImprintUrl,
  getJobUrl,
  getKreisreformUrl,
  getMinistryUrl,
  getPressReleaseUrl,
  getPrivacyUrl,
  getPublicationsUrl,
  getSchoolSystemUrl,
  getSpeechUrl,
  getSignLanguageUrl,
  getTopicUrl,
} from './routes.ts';

export interface PortalSearchEntry {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  description: string;
  url: string;
  text: string;
  date?: string;
}

export interface PortalSearchPayload {
  generatedAt: string;
  entries: PortalSearchEntry[];
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

export async function buildPortalSearchEntries(): Promise<PortalSearchEntry[]> {
  const [
    members,
    ministries,
    topics,
    pressReleases,
    speeches,
    events,
    budgetPages,
    freestatePages,
    servicePages,
    jobOffers,
    norms,
    publications,
    legislativeProcedures,
  ] = await Promise.all([
    loadGovernmentMembers(),
    loadMinistries(),
    loadTopics(),
    loadPressReleases(),
    loadSpeeches(),
    loadEvents(),
    loadBudgetPages(),
    loadFreestatePages(),
    loadPages(),
    loadJobOffers(),
    loadAllNorms(),
    loadAllVerkuendungen(),
    loadLegislativeProcedures(),
  ]);

  const entries: PortalSearchEntry[] = [
    {
      id: 'kreisreform',
      type: 'topic',
      typeLabel: 'Thema',
      title: 'Kreis- und Bezirksreform 2026',
      description: 'Gemeinden, Kreise und Bezirke in der neuen Verwaltungsgliederung suchen und vergleichen.',
      url: getKreisreformUrl(),
      text: 'Kreisreform Gebietsreform Gemeinde suchen neuer Kreis neuer Bezirk Kreis- und Bezirksneuordnung Gesetzgebungsverfahren 2026',
    },
    {
      id: 'education-and-school',
      type: 'topic',
      typeLabel: 'Thema',
      title: 'Bildung und Schule',
      description: 'Einstieg zu Schule, Bildungswegen, Zuständigkeiten und Rechtsgrundlagen.',
      url: getEducationAndSchoolUrl(),
      text: 'Bildung Schule Schulsystem Schularten Bildungswege Abschlüsse zuständige Stelle Volksbildung Wissenschaft',
    },
    {
      id: 'school-system',
      type: 'topic',
      typeLabel: 'Bildung',
      title: 'Schulsystem des Ostdeutschen Freistaates',
      description: 'Überblick über Schularten, Bildungswege, Abschlüsse und Übergänge im Schulsystem des Ostdeutschen Freistaates.',
      url: getSchoolSystemUrl(),
      text: 'Schule Schulsystem Bildung Polytechnische Oberschule POS Erweiterte Oberschule EOS Primarstufe Sekundarstufe Förderschule Berufsschule Berufsfachschule Fachoberschule Berufliches Gymnasium Fachschule Hochschulreife Berufsausbildung Zweiter Bildungsweg FOS DUBAS Studienqualifizierung Fachhochschulreife Grundschule Oberschule Gymnasium Gemeinschaftsschule Realschulabschluss Hauptschulabschluss',
    },
    {
      id: 'law-publications',
      type: 'law',
      typeLabel: 'Recht',
      title: 'Verkündungen',
      description: 'Ausgaben der Verkündungsblätter mit Fundstellen und Normfassungen.',
      url: getLawPublicationsUrl(),
      text: 'Verkündungen Gesetz- und Verordnungsblatt Staatsanzeiger Vertragsblatt Gemeinsames Ministerialblatt GMBl Fundstellen',
    },
    {
      id: 'law-references',
      type: 'law',
      typeLabel: 'Recht',
      title: 'Fundstellennachweise',
      description: 'Fundstellen nach Blatt, Ausgabe, Datum und Normfassung.',
      url: getLawReferencesUrl(),
      text: 'Fundstellen Nachweise OGVBl StAnzO OVertrBl Amtsblatt GMBl Gemeinsames Ministerialblatt',
    },
    {
      id: 'service-easy-language',
      type: 'service',
      typeLabel: 'Service',
      title: 'Leichte Sprache',
      description: 'Kurze Orientierung zu den wichtigsten Portalbereichen.',
      url: getEasyLanguageUrl(),
      text: 'Leichte Sprache Orientierung Staatsrat Staatsregierung Themen Recht Kontakt',
    },
    {
      id: 'service-sign-language',
      type: 'service',
      typeLabel: 'Service',
      title: 'Hinweis zu Gebärdensprache',
      description: 'Informationen zum derzeitigen Angebot in Gebärdensprache und zu alternativen Zugängen.',
      url: getSignLanguageUrl(),
      text: 'Gebärdensprache Video Kontakt Barrierefreiheit',
    },
    {
      id: 'service-publications',
      type: 'service',
      typeLabel: 'Service',
      title: 'Publikationen und Downloads',
      description: 'Verkündungen, Presseformate und zentrale Downloadangebote.',
      url: getPublicationsUrl(),
      text: 'Publikationen Downloads Verkündungen Presse RSS Kalender',
    },
    ...members.map((member) => ({
      id: `government-member:${member.slug}`,
      type: 'government',
      typeLabel: member.current ? 'Staatsrat' : 'Regierungsarchiv',
      title: member.name,
      description: member.currentOffices.length > 0
        ? member.currentOffices.map((office) => office.title).join('; ')
        : member.amt,
      url: getGovernmentMemberUrl(member.slug),
      text: joinText([member.ressort, member.kurzbiografie, member.langbiografie]),
    })),
    ...ministries.map((ministry) => ({
      id: `ministry:${ministry.slug}`,
      type: 'ministry',
      typeLabel: 'Staatssekretariat',
      title: ministry.name,
      description: ministry.teaser,
      url: getMinistryUrl(ministry.slug),
      text: joinText([ministry.kurzname, ministry.leitung, ministry.aufgaben, ministry.themen]),
    })),
    ...topics.map((topic) => ({
      id: `topic:${topic.slug}`,
      type: 'topic',
      typeLabel: 'Thema',
      title: topic.title,
      description: topic.teaser,
      url: getTopicUrl(topic.slug),
      text: joinText([
        topic.status,
        topic.federfuehrendesRessort,
        topic.beschlossen,
        topic.umgesetzt,
        topic.naechsteSchritte,
        topic.rechtsgrundlagen.map((entry) => entry.label),
      ]),
    })),
    ...pressReleases.map((release) => ({
      id: `press-release:${release.slug}`,
      type: 'press',
      typeLabel: 'Pressemitteilung',
      title: release.title,
      description: release.teaser,
      url: getPressReleaseUrl(release.slug),
      text: joinText([release.date, release.ressort, release.tags, release.body]),
      date: release.date,
    })),
    ...speeches.map((speech) => ({
      id: `speech:${speech.slug}`,
      type: 'speech',
      typeLabel: 'Rede',
      title: speech.title,
      description: speech.teaser,
      url: getSpeechUrl(speech.slug),
      text: joinText([speech.date, speech.sprecher, speech.body]),
      date: speech.date,
    })),
    ...events.map((event) => ({
      id: `event:${event.slug}`,
      type: 'event',
      typeLabel: 'Termin',
      title: event.title,
      description: event.teaser,
      url: getEventUrl(event.slug),
      text: joinText([event.date, event.location, event.body, event.relatedLegislationSlugs]),
      date: event.date,
    })),
    ...legislativeProcedures.map((procedure) => ({
      id: `legislation:${procedure.slug}`,
      type: 'legislation',
      typeLabel: 'Gesetzgebung',
      title: procedure.title,
      description: procedure.statusLabel,
      url: procedure.slug === 'kreis-und-bezirksneuordnungsgesetz'
        ? getKreisreformUrl()
        : procedure.relatedTopics[0]
          ? getTopicUrl(procedure.relatedTopics[0])
          : getLawPublicationsUrl(),
      text: joinText([
        procedure.shortTitle,
        procedure.documentNumber,
        procedure.initiator,
        procedure.statusLabel,
        procedure.leadCommittee,
        procedure.proposedCommittee,
        procedure.recommendation?.documentNumber,
        procedure.relatedTopics,
        procedure.relatedMinistries,
      ]),
      date: procedure.confirmedAsOf,
    })),
    ...budgetPages.map((page) => ({
      id: `budget:${page.slug}`,
      type: 'budget',
      typeLabel: 'Haushalt',
      title: page.title,
      description: page.teaser,
      url: getBudgetPageUrl(page.slug),
      text: joinText([page.body]),
    })),
    ...freestatePages.map((page) => ({
      id: `freestate:${page.slug}`,
      type: 'freestate',
      typeLabel: 'Über den Freistaat',
      title: page.title,
      description: page.body[0] ?? '',
      url: getFreestatePageUrl(page.slug),
      text: joinText([page.body]),
    })),
    ...servicePages.flatMap((page) => {
      const getUrl = servicePageUrls[page.slug];
      if (!getUrl) {
        return [];
      }

      return [{
        id: `service:${page.slug}`,
        type: 'service',
        typeLabel: 'Service',
        title: page.title,
        description: page.body[0] ?? '',
        url: getUrl(),
        text: joinText([page.body]),
      }];
    }),
    ...jobOffers.map((job) => ({
      id: `job:${job.slug}`,
      type: 'job',
      typeLabel: 'Karriere',
      title: job.title,
      description: job.teaser,
      url: getJobUrl(job.slug),
      text: joinText([
        job.ressort,
        job.standort,
        job.arbeitsbereich,
        job.employmentType,
        job.payGrade,
        job.body,
      ]),
      date: job.datePosted,
    })),
    ...norms.map((norm) => ({
      id: `law:${norm.meta.slug}`,
      type: 'law',
      typeLabel: 'Recht',
      title: toDisplayText(norm.meta.title),
      description: toDisplayText(norm.meta.summary),
      url: getNormUrl(norm.meta.slug),
      text: joinText([
        toDisplayText(norm.meta.shortTitle),
        toDisplayText(norm.meta.abbr),
        toDisplayText(norm.meta.responsibleMinistry ?? norm.meta.ministry),
        toDisplayText(norm.meta.enactingBody),
        norm.meta.subjects.map(toDisplayText),
        norm.meta.keywords.map(toDisplayText),
        toDisplayText(norm.meta.initialCitation),
        norm.meta.agreementDetails?.parties.map((party) => party.name),
        norm.meta.agreementDetails?.signatories.flatMap((signatory) => [
          signatory.name,
          signatory.office,
          signatory.representingParty,
        ]),
        norm.meta.agreementDetails?.legalBases.flatMap((basis) => [basis.label, basis.title]),
      ]),
      date: getApplicableVersion(norm)?.validFrom,
    })),
    ...publications.map((publication) => ({
      id: `law-publication:${publication.slug}`,
      type: 'law',
      typeLabel: 'Verkündung',
      title: toDisplayText(publication.title),
      description: `${publication.publication} ${publication.year} Nr. ${publication.issue}`,
      url: getLawPublicationDetailUrl(publication.slug),
      text: joinText([
        publication.date,
        publication.publication,
        publication.issue,
        publication.place,
        publication.publisher,
        publication.entries.map((entry) => `${entry.title} ${entry.citation}`),
      ]),
      date: publication.date,
    })),
  ];

  return entries.sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

export async function buildPortalSearchPayload(): Promise<PortalSearchPayload> {
  return {
    generatedAt: new Date().toISOString(),
    entries: await buildPortalSearchEntries(),
  };
}
