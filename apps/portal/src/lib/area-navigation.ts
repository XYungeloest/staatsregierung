import { siteConfig } from '@ostrecht/shared/config/site.ts';
import { getBudgetPageUrl, getBudgetUrl, getFreestatePageUrl, getKreisreformUrl, getPressUrl, getSiteUrl, getTopicsUrl } from '@ostrecht/shared/lib/portal/routes.ts';

type Area = (typeof siteConfig.mainNavigation)[number]['pathKey'];
interface Link { label: string; href: string }

const children = {
  freestate: [
    { label: 'Land und Leute', href: getFreestatePageUrl('land-und-leute') },
    { label: 'Bezirke und Kreise', href: getFreestatePageUrl('bezirke') },
    { label: 'Gebietssuche zur Kreisreform', href: `${getKreisreformUrl()}#bezirk-suche` },
    { label: 'Staatsaufbau und Verfassung', href: getFreestatePageUrl('staatsaufbau') },
    { label: 'Geschichte', href: getFreestatePageUrl('geschichte') },
    { label: 'Landesfarben und Hoheitszeichen', href: getFreestatePageUrl('landesfarben-und-hoheitszeichen') },
  ],
  government: [
    { label: 'Staatspräsident', href: getSiteUrl('ministerPresident') },
    { label: 'Staatssekretariate und Zuständigkeiten', href: getSiteUrl('cabinet') },
    { label: 'Mitglieder und Personenprofile', href: getSiteUrl('governmentMembers') },
    { label: 'Öffentliche Beteiligungen', href: getSiteUrl('holdings') },
    { label: 'Frühere Staatsregierungen', href: getSiteUrl('previousCabinets') },
  ],
  topics: [
    { label: 'Aktuelle Vorhaben', href: `${getTopicsUrl()}#aktuell` },
    { label: 'Reformdossiers', href: `${getTopicsUrl()}#schwerpunkte` },
    { label: 'Koalition', href: getSiteUrl('coalition') },
    { label: '15-Punkte-Plan', href: getSiteUrl('actionPlan') },
    { label: 'Recht und Gesetzgebung', href: getSiteUrl('lawBridge') },
  ],
  budget: [
    { label: 'Haushaltsperioden und Einzelpläne', href: `${getBudgetUrl()}#perioden` },
    { label: 'Einnahmen und Ausgaben', href: `${getBudgetUrl()}#kennzahlen` },
    { label: 'Sondervermögen', href: getBudgetPageUrl('sondervermoegen') },
    { label: 'Finanzdaten und Downloads', href: `${getBudgetUrl()}#bereiche` },
  ],
  press: [
    { label: 'Pressemitteilungen', href: getSiteUrl('pressReleases') },
    { label: 'Reden', href: getSiteUrl('pressSpeeches') },
    { label: 'Termine', href: getSiteUrl('pressDates') },
    { label: 'Pressemitteilungen abonnieren', href: `${getPressUrl()}rss.xml` },
  ],
  service: [
    { label: 'Kontakt', href: getSiteUrl('contact') },
    { label: 'Karriere', href: getSiteUrl('career') },
    { label: 'Publikationen', href: getSiteUrl('publications') },
    { label: 'Häufige Fragen', href: getSiteUrl('faq') },
    { label: 'Barrierefreiheit', href: getSiteUrl('accessibility') },
  ],
} satisfies Record<Area, Link[]>;

export const portalAreas = siteConfig.mainNavigation.map(({ label, pathKey }) => ({
  label, href: getSiteUrl(pathKey), children: children[pathKey],
}));

export function activePortalArea(pathname: string) {
  // Übergreifende Wege wie das Regierungsprogramm behalten ihre eingeführten Adressen.
  return portalAreas.find((area) => area.children.some(({ href }) =>
    !href.includes('#') && pathname.startsWith(href)))
    ?? (pathname.startsWith(getKreisreformUrl()) ? portalAreas.find((area) => area.href === getSiteUrl('freestate'))
      : portalAreas.find((area) => pathname.startsWith(area.href)));
}
