import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const rootDir = process.cwd();
const contentDir = resolve(rootDir, 'content');
const seedDir = resolve(rootDir, 'db', 'seeds');
const seedFilePath = resolve(seedDir, '0001_seed.sql');

const projectStatusItems = [
  {
    id: 'regierungssitz-dresden',
    title: 'Regierungskoordination in Dresden',
    description:
      'Die Staatsregierung ist mit sichtbarer Leitungsstruktur, klaren Zuständigkeiten und dauerhaftem Bezugspunkt Dresden im Portal verankert.',
    status: 'umgesetzt',
    ressort: 'Staatskanzlei',
    href: '/staatsregierung/ministerpraesident/',
    references: [],
  },
  {
    id: 'kabinett-und-ressorts',
    title: 'Kabinett und Ressorts',
    description:
      'Die Ressortstruktur, die Kabinettsmitglieder und die institutionelle Aufgabenordnung des Freistaates sind vollständig aufgebaut.',
    status: 'umgesetzt',
    ressort: 'Staatskanzlei',
    href: '/staatsregierung/kabinett/',
    references: [],
  },
  {
    id: 'rechtsordnung-und-verkuendung',
    title: 'Verfassung, Verkündung und Rechtszugang',
    description:
      'Verfassung, Verkündungslogik und ein integrierter Zugang zu aktuellen und historischen Fassungen sind unter /recht/ gebündelt.',
    status: 'umgesetzt',
    ressort: 'Rechtsstaatlichkeit',
    href: '/recht/verfassung/',
    references: [
      {
        label: 'Verfassung',
        normSlug: 'gesetz-zur-veranderung-der-verfassung-zur-anderung-der-verku-437sg5',
      },
      {
        label: 'Gesetz über Verkündungen und Bekanntmachungen',
        normSlug: 'gesetz-uber-verkundungen-und-bekanntmachungen',
      },
    ],
  },
  {
    id: 'wohnen-und-vergesellschaftung',
    title: 'Wohnen und Vergesellschaftung',
    description:
      'Wohnraumschutz, Vergesellschaftung, Preisregulierung und Vollzugsinstrumente bilden ein tragendes Kernprojekt der Landespolitik.',
    status: 'umgesetzt',
    ressort: 'Inneres und Kommunales',
    href: '/themen/wohnen-und-vergesellschaftung/',
    references: [
      { label: 'Vergesellschaftungsrahmengesetz', normSlug: 'vergesellschaftungsrahmengesetz' },
      { label: 'Wohnvergesellschaftungsgesetz', normSlug: 'wohnvergesellschaftungsgesetz' },
    ],
  },
  {
    id: 'mobilitaet-und-oepnv',
    title: 'ÖPNV und Mobilität',
    description:
      'Planung, Finanzierung und Strukturaufbau sind angelegt; fachrechtliche Vertiefungen für Tarif- und Reaktivierungsfragen folgen schrittweise.',
    status: 'teilweise_umgesetzt',
    ressort: 'Mobilität und Infrastruktur',
    href: '/themen/oepnv-und-mobilitaet/',
    references: [],
  },
  {
    id: 'bildungsreform',
    title: 'Bildungsreform',
    description:
      'Schulneuordnung, Kita-Entlastung und ergänzende Verordnungen bilden bereits einen breiten Umsetzungsstand der Bildungsreform.',
    status: 'umgesetzt',
    ressort: 'Bildung und Sport',
    href: '/themen/bildungsreform/',
    references: [
      {
        label: 'Gesetz zur Neuordnung des Ostdeutschen Schulsystems',
        normSlug: 'gesetz-zur-neuordnung-des-ostdeutschen-schulsystems',
      },
    ],
  },
  {
    id: 'kulturpass',
    title: 'Kulturpass und kulturelle Teilhabe',
    description:
      'Der Kulturpass ist als eigenständiges Leistungsinstrument aufgebaut und bereits direkt mit dem Rechtsportal verbunden.',
    status: 'umgesetzt',
    ressort: 'Kultur und Wissenschaft',
    href: '/themen/kulturpass/',
    references: [
      { label: 'Ostdeutsches Kulturpassgesetz', normSlug: 'ostdeutsches-kulturpassgesetz' },
    ],
  },
  {
    id: 'demokratie-und-sicherheit',
    title: 'Demokratie und Sicherheit',
    description:
      'Rechtsstaatliche Kontrolle, Antidiskriminierung und sicherheitspolitische Handlungsfähigkeit werden gemeinsam fortgeführt.',
    status: 'umgesetzt',
    ressort: 'Rechtsstaatlichkeit',
    href: '/themen/demokratie-und-sicherheit/',
    references: [],
  },
  {
    id: 'rundfunkreform',
    title: 'Rundfunkreform',
    description:
      'Die Rundfunkordnung des Freistaates wurde mit dem Ostdeutschen Fernsehfunk und staatsvertraglichen Anpassungen neu geordnet.',
    status: 'umgesetzt',
    ressort: 'Kultur und Wissenschaft',
    href: '/themen/rundfunkreform/',
    references: [],
  },
  {
    id: 'krankenhausfonds',
    title: 'Krankenhausfonds und öffentliche Sicherung',
    description:
      'Der Krankenhaussicherungs- und Rekommunalisierungsfonds ist als zentrales Instrument staatlicher Daseinsvorsorge normativ verankert.',
    status: 'umgesetzt',
    ressort: 'Soziale Fürsorge',
    href: '/themen/krankenhausfonds/',
    references: [
      {
        label: 'Krankenhaussicherungs- und Rekommunalisierungsfondsgesetz',
        normSlug: 'ostdeutsches-krankenhaussicherungsund-rekommunalisierungsfondsgesetz',
      },
    ],
  },
  {
    id: 'familie-und-soziales',
    title: 'Familie und Soziales',
    description:
      'Familienentlastung und soziale Sicherung sind angelegt und teilweise umgesetzt, insbesondere über Kita- und Fürsorgepolitik.',
    status: 'teilweise_umgesetzt',
    ressort: 'Soziale Fürsorge',
    href: '/themen/familie-und-soziales/',
    references: [],
  },
  {
    id: 'nachbarschaft-und-europa',
    title: 'Nachbarschaft und Europa',
    description:
      'Grenzüberschreitende Zusammenarbeit mit Polen und Tschechien ist institutionell und normativ bereits fest verankert.',
    status: 'umgesetzt',
    ressort: 'Völkerfreundschaft',
    href: '/themen/nachbarschaft-und-europa/',
    references: [],
  },
  {
    id: 'transparenz-und-lobbyregister',
    title: 'Transparenz und Lobbyregister',
    description:
      'Informationszugang, Transparenzpflichten und Beteiligtendokumentation sind mit tragenden Landesnormen im Portal eingebunden.',
    status: 'umgesetzt',
    ressort: 'Rechtsstaatlichkeit',
    href: '/themen/transparenz-und-lobbyregister/',
    references: [
      {
        label: 'Ostdeutsches Transparenz- und Informationsfreiheitsgesetz',
        normSlug: 'ostdeutsches-transparenzund-informationsfreiheitsgesetz',
      },
    ],
  },
  {
    id: 'haushalt-und-finanzen',
    title: 'Haushalt und Finanzen',
    description:
      'Doppelhaushalt, Landesbank und Vergaberecht bilden die finanzpolitische Grundarchitektur des Landes.',
    status: 'umgesetzt',
    ressort: 'Fiskus',
    href: '/themen/haushalt-und-finanzen/',
    references: [
      {
        label: 'Haushaltsgesetz 2025/2026',
        normSlug: 'gesetz-uber-die-feststellung-des-haushaltsplanes-des-freista-cc1hib-2',
      },
    ],
  },
  {
    id: 'service-und-verwaltungszugang',
    title: 'Service und Verwaltungszugang',
    description:
      'Servicewege, Kontakt, FAQ, Barrierefreiheit und redaktionelle Übersicht sind angelegt und werden schrittweise nutzerfreundlicher gebündelt.',
    status: 'angelegt',
    ressort: 'Staatskanzlei',
    href: '/service/',
    references: [],
  },
];

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNullableString(value) {
  return value === null || value === undefined || value === '' ? 'NULL' : sqlString(value);
}

function sqlBoolean(value) {
  return value ? '1' : '0';
}

function sqlJson(value) {
  return sqlString(JSON.stringify(value));
}

async function readJsonCollection(directorySegments) {
  const directoryPath = join(contentDir, ...directorySegments);
  const fileNames = (await readdir(directoryPath))
    .filter((fileName) => fileName.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right, 'de'));

  const records = await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = join(directoryPath, fileName);
      const raw = await readFile(filePath, 'utf8');
      return JSON.parse(raw);
    }),
  );

  return records;
}

function buildPressReleaseStatements(records) {
  return records.map(
    (record) => `INSERT INTO press_releases (
  slug,
  title,
  published_at,
  ressort,
  teaser,
  image_url,
  media_key,
  image_alt,
  image_credit,
  tags_json,
  body_json,
  is_featured,
  related_topic_slugs_json,
  related_norm_slugs_json,
  related_press_slugs_json
) VALUES (
  ${sqlString(record.slug)},
  ${sqlString(record.title)},
  ${sqlString(record.date)},
  ${sqlString(record.ressort)},
  ${sqlString(record.teaser)},
  ${sqlNullableString(record.image)},
  NULL,
  ${sqlString(record.imageAlt)},
  ${sqlString(record.imageCredit)},
  ${sqlJson(record.tags ?? [])},
  ${sqlJson(record.body ?? [])},
  ${sqlBoolean(Boolean(record.isFeatured))},
  ${sqlJson(record.relatedTopicSlugs ?? [])},
  ${sqlJson(record.relatedNormSlugs ?? [])},
  ${sqlJson(record.relatedPressSlugs ?? [])}
);`,
  );
}

function buildEventStatements(records) {
  return records.map(
    (record) => `INSERT INTO events (
  slug,
  title,
  event_date,
  location,
  teaser,
  body_json,
  image_url,
  media_key,
  image_alt
) VALUES (
  ${sqlString(record.slug)},
  ${sqlString(record.title)},
  ${sqlString(record.date)},
  ${sqlString(record.location)},
  ${sqlString(record.teaser)},
  ${sqlJson(record.body ?? [])},
  NULL,
  NULL,
  NULL
);`,
  );
}

function buildJobStatements(records) {
  return records.map(
    (record) => `INSERT INTO jobs (
  slug,
  title,
  ressort,
  standort,
  arbeitsbereich,
  date_posted,
  application_deadline,
  employment_type,
  pay_grade,
  teaser,
  body_json,
  contact_json,
  image_url,
  media_key,
  image_alt,
  image_credit,
  is_active
) VALUES (
  ${sqlString(record.slug)},
  ${sqlString(record.title)},
  ${sqlString(record.ressort)},
  ${sqlString(record.standort)},
  ${sqlString(record.arbeitsbereich)},
  ${sqlString(record.datePosted)},
  ${sqlString(record.applicationDeadline)},
  ${sqlString(record.employmentType)},
  ${sqlNullableString(record.payGrade)},
  ${sqlString(record.teaser)},
  ${sqlJson(record.body ?? [])},
  ${record.contact ? sqlJson(record.contact) : 'NULL'},
  ${sqlNullableString(record.image)},
  NULL,
  ${sqlNullableString(record.imageAlt)},
  ${sqlNullableString(record.imageCredit)},
  1
);`,
  );
}

function buildProjectStatusStatements(records) {
  return records.map(
    (record, index) => `INSERT INTO project_status (
  id,
  title,
  description,
  status,
  ressort,
  href,
  references_json,
  position
) VALUES (
  ${sqlString(record.id)},
  ${sqlString(record.title)},
  ${sqlString(record.description)},
  ${sqlString(record.status)},
  ${sqlString(record.ressort)},
  ${sqlString(record.href)},
  ${sqlJson(record.references ?? [])},
  ${index + 1}
);`,
  );
}

async function main() {
  const [pressReleases, events, jobs] = await Promise.all([
    readJsonCollection(['presse', 'mitteilungen']),
    readJsonCollection(['presse', 'termine']),
    readJsonCollection(['service', 'stellen']),
  ]);

  const statements = [
    '-- Automatisch generiert durch scripts/generate-d1-seed.mjs',
    'DELETE FROM press_releases;',
    'DELETE FROM events;',
    'DELETE FROM jobs;',
    'DELETE FROM project_status;',
    ...buildPressReleaseStatements(pressReleases),
    ...buildEventStatements(events),
    ...buildJobStatements(jobs),
    ...buildProjectStatusStatements(projectStatusItems),
    '',
  ];

  await mkdir(seedDir, { recursive: true });
  await writeFile(seedFilePath, `${statements.join('\n')}\n`, 'utf8');

  console.log(`Seed-Datei geschrieben: ${seedFilePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
