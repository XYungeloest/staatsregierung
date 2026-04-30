import type { APIRoute } from 'astro';
import { siteConfig } from '../../../config/site.ts';
import { loadEvents } from '../../../lib/portal/content.ts';
import { getEventUrl } from '../../../lib/portal/index.ts';

function escapeIcs(value: string): string {
  return value
    .replace(/\\/gu, '\\\\')
    .replace(/;/gu, '\\;')
    .replace(/,/gu, '\\,')
    .replace(/\r?\n/gu, '\\n');
}

function toDateValue(value: string): string {
  return value.replace(/-/gu, '');
}

function absoluteUrl(path: string, site: URL): string {
  return new URL(path, site).toString();
}

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ?? new URL(siteConfig.seo.siteUrl);
  const events = await loadEvents();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Freistaat Ostdeutschland//Pressekalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Presse- und Regierungstermine',
    ...events.map((event) => [
      'BEGIN:VEVENT',
      `UID:${event.slug}@freistaat-ostdeutschland.de`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d{3}Z$/u, 'Z')}`,
      `DTSTART;VALUE=DATE:${toDateValue(event.date)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.teaser)}`,
      `LOCATION:${escapeIcs(event.location)}`,
      `URL:${absoluteUrl(getEventUrl(event.slug), baseUrl)}`,
      'END:VEVENT',
    ].join('\r\n')),
    'END:VCALENDAR',
  ];

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
    },
  });
};
