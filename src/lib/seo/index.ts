import { siteConfig } from '../../config/site.ts';

export interface SeoBreadcrumbItem {
  label: string;
  href?: string;
}

export interface SeoImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export type StructuredData = Record<string, unknown>;

function getBaseUrl(site?: URL): URL {
  return site ?? new URL(siteConfig.seo.siteUrl);
}

export function toAbsoluteUrl(path: string, site?: URL): string {
  if (/^https?:\/\//iu.test(path)) {
    return path;
  }

  return new URL(path, getBaseUrl(site)).toString();
}

export function buildCanonicalUrl(currentUrl: URL, site?: URL): string {
  return new URL(currentUrl.pathname, getBaseUrl(site ?? currentUrl)).toString();
}

export function buildPageTitle(title: string): string {
  const trimmedTitle = title.trim();

  if (trimmedTitle === siteConfig.seo.siteName || trimmedTitle === siteConfig.authorityName) {
    return trimmedTitle;
  }

  return `${trimmedTitle} | ${siteConfig.authorityName}`;
}

export function buildWebSiteJsonLd(site?: URL): StructuredData {
  const absoluteSiteUrl = getBaseUrl(site).toString();

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.seo.siteName,
    alternateName: siteConfig.authorityName,
    description: siteConfig.seo.defaultDescription,
    url: absoluteSiteUrl,
    inLanguage: 'de-DE',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${toAbsoluteUrl(siteConfig.paths.lawSearch, site)}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildOrganizationJsonLd(site?: URL): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.authorityName,
    alternateName: siteConfig.seo.siteName,
    description: siteConfig.seo.defaultDescription,
    url: getBaseUrl(site).toString(),
    logo: toAbsoluteUrl(siteConfig.officialFlagAssetPath, site),
    address: {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.contact.addressLines[0],
      postalCode: '01097',
      addressLocality: 'Dresden',
      addressCountry: 'DE',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'Bürgerservice',
        telephone: siteConfig.contact.citizenService.phone,
        email: siteConfig.contact.citizenService.email,
        availableLanguage: 'de',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'Pressestelle',
        telephone: siteConfig.contact.pressOffice.phone,
        email: siteConfig.contact.pressOffice.email,
        availableLanguage: 'de',
      },
    ],
  };
}

export function buildBreadcrumbJsonLd(
  items: SeoBreadcrumbItem[],
  currentPath: string,
  site?: URL,
): StructuredData | undefined {
  const listItems = items
    .map((item, index) => {
      const hasHref = typeof item.href === 'string' && item.href.length > 0;

      if (!hasHref && index !== items.length - 1) {
        return undefined;
      }

      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.label,
        item: toAbsoluteUrl(item.href ?? currentPath, site),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (listItems.length === 0) {
    return undefined;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: listItems,
  };
}

export interface ArticleJsonLdInput {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  image?: SeoImage;
  articleSection?: string;
  authorName?: string;
}

export function buildArticleJsonLd(
  input: ArticleJsonLdInput,
  site?: URL,
): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url: toAbsoluteUrl(input.url, site),
    datePublished: input.datePublished,
    dateModified: input.datePublished,
    inLanguage: 'de-DE',
    articleSection: input.articleSection,
    author: {
      '@type': 'Organization',
      name: input.authorName ?? siteConfig.authorityName,
    },
    publisher: {
      '@type': 'Organization',
      name: siteConfig.authorityName,
      logo: {
        '@type': 'ImageObject',
        url: toAbsoluteUrl(siteConfig.officialFlagAssetPath, site),
      },
    },
    image: input.image
      ? {
          '@type': 'ImageObject',
          url: toAbsoluteUrl(input.image.url, site),
          caption: input.image.alt,
          width: input.image.width,
          height: input.image.height,
        }
      : undefined,
  };
}

export interface EventJsonLdInput {
  title: string;
  description: string;
  url: string;
  startDate: string;
  location: string;
}

export function buildEventJsonLd(input: EventJsonLdInput, site?: URL): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.title,
    description: input.description,
    url: toAbsoluteUrl(input.url, site),
    startDate: input.startDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: input.location,
      address: {
        '@type': 'PostalAddress',
        addressLocality: input.location,
        addressCountry: 'DE',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: siteConfig.authorityName,
      url: getBaseUrl(site).toString(),
    },
  };
}
