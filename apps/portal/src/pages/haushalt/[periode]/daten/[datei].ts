/**
 * Datendateien einer Snapshot-Periode: /haushalt/<periode>/daten/<datei>.
 *
 * Vorab erzeugt für jede sichtbare Snapshot-Periode (ohne Vorschau also nur für freigegebene
 * Perioden). Inhalt und Prüfsummen liefert `components/haushalt/ruecklagen/downloads.ts`; PDF und
 * XLSX entstehen nur, wenn der Snapshot das Ausgabedokument übernommen hat. Der Suchindex
 * (suchindex.json) ist eine eigene Datei neben diesem Endpunkt.
 */
import type { APIRoute } from 'astro';

import { getDatendatei, getDatendateien } from '../../../../components/haushalt/ruecklagen/downloads.ts';
import { getVisibleSnapshotPeriods } from '../../../../lib/haushalt/perioden.ts';

export const prerender = true;

export function getStaticPaths() {
  return getVisibleSnapshotPeriods().flatMap((periode) =>
    getDatendateien(periode.id).map((datei) => ({ params: { periode: periode.id, datei: datei.name } })),
  );
}

export const GET: APIRoute = ({ params }) => {
  const datei = getDatendatei(String(params.periode), String(params.datei));
  if (!datei) return new Response('Nicht gefunden', { status: 404 });
  const body = datei.body.buffer.slice(datei.body.byteOffset, datei.body.byteOffset + datei.body.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      'content-type': datei.contentType,
      'content-disposition': `${datei.format === 'JSON' ? 'inline' : 'attachment'}; filename="haushalt-${String(params.periode)}-${datei.name}"`,
    },
  });
};
