#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import polygonClipping from 'polygon-clipping';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data', 'geo', 'kreisreform');
const outputDir = path.join(rootDir, 'public', 'data', 'kreisreform');
const sourceGpkg = process.env.KREISREFORM_GPKG ?? path.join(dataDir, 'gebietsreform.gpkg');
const sourceVg250Gpkg =
  process.env.KREISREFORM_VG250_GPKG ?? path.join(dataDir, 'vg250', 'DE_VG250.gpkg');
const withVg250 = process.argv.includes('--with-vg250');

const sourceFiles = {
  geoPackage: path.relative(rootDir, sourceGpkg),
  neuordnungsgesetz: 'data/geo/kreisreform/bezirks-und-kreisneuordnungsgesetz-entwurf.md',
  bezirkseinfuehrungsgesetz: 'data/geo/kreisreform/ostdeutsches-bezirkseinfuehrungsgesetz.md',
  vg250: existsSync(sourceVg250Gpkg) ? path.relative(rootDir, sourceVg250Gpkg) : undefined,
  vg250Download:
    'https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/aktuell/vg250_01-01.utm32s.gpkg.ebenen.zip',
};

const districtReference = {
  Berlin: { sitz: 'Berlin', einwohner: 3685265, flaecheKm2: 891.12 },
  Elbsachsen: { sitz: 'Dresden', einwohner: 1173765, flaecheKm2: 4352.85 },
  Lausitz: { sitz: 'Cottbus/Chóśebuz', einwohner: 902066, flaecheKm2: 9130.41 },
  'Leipzig-Mittelsachsen': { sitz: 'Leipzig', einwohner: 1242186, flaecheKm2: 5178.88 },
  'Magdeburg-Anhalt': { sitz: 'Magdeburg', einwohner: 989950, flaecheKm2: 9613.2 },
  'Mecklenburg-Schwerin': { sitz: 'Schwerin', einwohner: 994000, flaecheKm2: 13445.59 },
  'Mittelmark-Fläming': { sitz: 'Potsdam', einwohner: 931262, flaecheKm2: 10035.09 },
  Nordmark: { sitz: 'Neuruppin', einwohner: 631368, flaecheKm2: 11095.69 },
  'Oderland-Uckermark': { sitz: 'Frankfurt (Oder)', einwohner: 993520, flaecheKm2: 10553 },
  'Saale-Harz': { sitz: 'Halle (Saale)', einwohner: 900054, flaecheKm2: 6959.2 },
  'Saale-Pleiße': { sitz: 'Jena', einwohner: 995613, flaecheKm2: 6984.94 },
  'Thüringer Wald-Eichsfeld': { sitz: 'Erfurt', einwohner: 1093308, flaecheKm2: 8378.43 },
  'Vogtland-Erzgebirge': { sitz: 'Chemnitz', einwohner: 1118622, flaecheKm2: 4853.48 },
  Vorpommern: { sitz: 'Greifswald', einwohner: 442926, flaecheKm2: 7574.53 },
};

const oldDistrictSeats = {
  Berlin: 'Berlin',
  Brandenburg: 'Potsdam',
  'Mecklenburg-Vorpommern': 'Schwerin',
  Niederlausitz: 'Cottbus/Chóśebuz',
  Oberlausitz: 'Bautzen/Budyšin',
  Sachsen: 'Dresden',
  'Sachsen-Anhalt': 'Magdeburg',
  Thüringen: 'Erfurt',
};

const kreisfreieStaedte = new Set([
  'Berlin',
  'Brandenburg an der Havel',
  'Chemnitz',
  'Cottbus',
  'Dessau-Roßlau',
  'Dresden',
  'Eisenach',
  'Eisenhüttenstadt',
  'Erfurt',
  'Frankfurt (Oder)',
  'Gera',
  'Gotha, Stadt',
  'Greifswald',
  'Görlitz, Stadt',
  'Halle (Saale)',
  'Hoyerswerda',
  'Jena',
  'Leipzig, Stadt',
  'Magdeburg',
  'Neubrandenburg',
  'Plauen',
  'Potsdam',
  'Rostock, Stadt',
  'Schwerin',
  'Stralsund',
  'Weimar',
  'Wismar',
  'Zwickau, Stadt',
]);

const stateByPrefix = {
  '11': 'Berlin',
  '12': 'Brandenburg',
  '13': 'Mecklenburg-Vorpommern',
  '14': 'Sachsen',
  '15': 'Sachsen-Anhalt',
  '16': 'Thüringen',
};

const oldKreisNames = {
  '11000': 'Berlin',
  '12051': 'Brandenburg an der Havel',
  '12052': 'Cottbus',
  '12053': 'Frankfurt (Oder)',
  '12054': 'Potsdam',
  '12060': 'Barnim',
  '12061': 'Dahme-Spreewald',
  '12062': 'Elbe-Elster',
  '12063': 'Havelland',
  '12064': 'Märkisch-Oderland',
  '12065': 'Oberhavel',
  '12066': 'Oberspreewald-Lausitz',
  '12067': 'Oder-Spree',
  '12068': 'Ostprignitz-Ruppin',
  '12069': 'Potsdam-Mittelmark',
  '12070': 'Prignitz',
  '12071': 'Spree-Neiße',
  '12072': 'Teltow-Fläming',
  '12073': 'Uckermark',
  '13003': 'Rostock',
  '13004': 'Schwerin',
  '13071': 'Mecklenburgische Seenplatte',
  '13072': 'Rostock',
  '13073': 'Vorpommern-Rügen',
  '13074': 'Nordwestmecklenburg',
  '13075': 'Vorpommern-Greifswald',
  '13076': 'Ludwigslust-Parchim',
  '14511': 'Chemnitz',
  '14521': 'Erzgebirgskreis',
  '14522': 'Mittelsachsen',
  '14523': 'Vogtlandkreis',
  '14524': 'Zwickau',
  '14612': 'Dresden',
  '14625': 'Bautzen',
  '14626': 'Görlitz',
  '14627': 'Meißen',
  '14628': 'Sächsische Schweiz-Osterzgebirge',
  '14713': 'Leipzig',
  '14729': 'Leipzig',
  '14730': 'Nordsachsen',
  '15001': 'Dessau-Roßlau',
  '15002': 'Halle (Saale)',
  '15003': 'Magdeburg',
  '15081': 'Altmarkkreis Salzwedel',
  '15082': 'Anhalt-Bitterfeld',
  '15083': 'Börde',
  '15084': 'Burgenlandkreis',
  '15085': 'Harz',
  '15086': 'Jerichower Land',
  '15087': 'Mansfeld-Südharz',
  '15088': 'Saalekreis',
  '15089': 'Salzlandkreis',
  '15090': 'Stendal',
  '15091': 'Wittenberg',
  '16051': 'Erfurt',
  '16052': 'Gera',
  '16053': 'Jena',
  '16054': 'Suhl',
  '16055': 'Weimar',
  '16061': 'Eichsfeld',
  '16062': 'Nordhausen',
  '16063': 'Wartburgkreis',
  '16064': 'Unstrut-Hainich-Kreis',
  '16065': 'Kyffhäuserkreis',
  '16066': 'Schmalkalden-Meiningen',
  '16067': 'Gotha',
  '16068': 'Sömmerda',
  '16069': 'Hildburghausen',
  '16070': 'Ilm-Kreis',
  '16071': 'Weimarer Land',
  '16072': 'Sonneberg',
  '16073': 'Saalfeld-Rudolstadt',
  '16074': 'Saale-Holzland-Kreis',
  '16075': 'Saale-Orla-Kreis',
  '16076': 'Greiz',
  '16077': 'Altenburger Land',
};

const niederlausitzIds = new Set(['12052', '12061', '12066', '12071']);
const oberlausitzIds = new Set(['14625', '14626']);

function oldBezirkForAgs(ags) {
  if (ags === '11000') return 'Berlin';
  if (niederlausitzIds.has(ags)) return 'Niederlausitz';
  if (oberlausitzIds.has(ags)) return 'Oberlausitz';
  const state = stateByPrefix[ags.slice(0, 2)];
  if (state === 'Brandenburg') return 'Brandenburg';
  if (state === 'Mecklenburg-Vorpommern') return 'Mecklenburg-Vorpommern';
  if (state === 'Sachsen') return 'Sachsen';
  if (state === 'Sachsen-Anhalt') return 'Sachsen-Anhalt';
  if (state === 'Thüringen') return 'Thüringen';
  return 'Unbekannt';
}

function assertInput() {
  const sqliteCheck = spawnSync('sqlite3', ['-version'], { encoding: 'utf8' });
  if (sqliteCheck.error || sqliteCheck.status !== 0) {
    throw new Error(
      'sqlite3 wurde nicht gefunden. Bitte SQLite installieren oder KREISREFORM_GPKG nach einer Umgebung mit sqlite3 ausführen.',
    );
  }

  if (!existsSync(sourceGpkg)) {
    throw new Error(
      `GeoPackage fehlt: ${path.relative(rootDir, sourceGpkg)}. Erwartet wird data/geo/kreisreform/gebietsreform.gpkg oder KREISREFORM_GPKG.`,
    );
  }

  if (withVg250 && !existsSync(sourceVg250Gpkg)) {
    throw new Error(
      `VG250-GeoPackage fehlt: ${path.relative(rootDir, sourceVg250Gpkg)}. Laden Sie den amtlichen VG250-Direktdownload des BKG und legen Sie DE_VG250.gpkg unter data/geo/kreisreform/vg250/ ab oder setzen Sie KREISREFORM_VG250_GPKG.`,
    );
  }
}

function queryJson(sql, databasePath = sourceGpkg) {
  const result = spawnSync('sqlite3', ['-json', databasePath, sql], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `sqlite3-Abfrage fehlgeschlagen: ${sql}`);
  }

  const stdout = result.stdout.trim();
  return stdout ? JSON.parse(stdout) : [];
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function displayKreisName(rawName) {
  return String(rawName).replace(/, Stadt$/u, '');
}

function roundNumber(value, digits = 2) {
  if (!Number.isFinite(value)) return undefined;
  return Number(value.toFixed(digits));
}

function readUInt32(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function readDouble(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
}

function dimensionForType(rawType) {
  if (rawType >= 3000) return 4;
  if (rawType >= 1000) return 3;
  return 2;
}

function baseGeometryType(rawType) {
  return rawType % 1000;
}

function parseWkbPoint(buffer, offset, littleEndian, dimensions) {
  const point = [readDouble(buffer, offset, littleEndian), readDouble(buffer, offset + 8, littleEndian)];
  return { point, offset: offset + dimensions * 8 };
}

function parseWkbGeometry(buffer, startOffset = 0) {
  let offset = startOffset;
  const byteOrder = buffer.readUInt8(offset);
  offset += 1;
  const littleEndian = byteOrder === 1;
  const rawType = readUInt32(buffer, offset, littleEndian);
  offset += 4;
  const geometryType = baseGeometryType(rawType);
  const dimensions = dimensionForType(rawType);

  if (geometryType === 3) {
    const ringCount = readUInt32(buffer, offset, littleEndian);
    offset += 4;
    const coordinates = [];
    for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
      const pointCount = readUInt32(buffer, offset, littleEndian);
      offset += 4;
      const ring = [];
      for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
        const parsed = parseWkbPoint(buffer, offset, littleEndian, dimensions);
        ring.push(parsed.point);
        offset = parsed.offset;
      }
      coordinates.push(ring);
    }
    return { geometry: { type: 'Polygon', coordinates }, offset };
  }

  if (geometryType === 6) {
    const polygonCount = readUInt32(buffer, offset, littleEndian);
    offset += 4;
    const coordinates = [];
    for (let polygonIndex = 0; polygonIndex < polygonCount; polygonIndex += 1) {
      const parsed = parseWkbGeometry(buffer, offset);
      if (parsed.geometry.type !== 'Polygon') {
        throw new Error('GeoPackage enthält ein MultiPolygon mit unerwartetem Teilgeometrietyp.');
      }
      coordinates.push(parsed.geometry.coordinates);
      offset = parsed.offset;
    }
    return { geometry: { type: 'MultiPolygon', coordinates }, offset };
  }

  throw new Error(`Nicht unterstützter WKB-Geometrietyp: ${rawType}`);
}

function parseGeoPackageGeometry(hexGeometry) {
  const buffer = Buffer.from(hexGeometry, 'hex');
  if (buffer.toString('ascii', 0, 2) !== 'GP') {
    throw new Error('Ungültige GeoPackage-Geometrie: Magic Header fehlt.');
  }

  const flags = buffer.readUInt8(3);
  const envelopeCode = (flags >> 1) & 0b111;
  const envelopeSize = [0, 32, 48, 48, 64][envelopeCode];
  if (envelopeSize === undefined) {
    throw new Error(`Ungültiger GeoPackage-Envelope-Code: ${envelopeCode}`);
  }

  const wkbOffset = 8 + envelopeSize;
  return parseWkbGeometry(buffer, wkbOffset).geometry;
}

function squaredDistanceToSegment(point, start, end) {
  const x = point[0];
  const y = point[1];
  let dx = end[0] - start[0];
  let dy = end[1] - start[1];

  if (dx !== 0 || dy !== 0) {
    const t = ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      return (x - end[0]) * (x - end[0]) + (y - end[1]) * (y - end[1]);
    }
    if (t > 0) {
      dx = start[0] + t * dx - x;
      dy = start[1] + t * dy - y;
      return dx * dx + dy * dy;
    }
  }

  dx = x - start[0];
  dy = y - start[1];
  return dx * dx + dy * dy;
}

function douglasPeucker(points, toleranceMeters) {
  if (points.length <= 2) return points;
  const sqTolerance = toleranceMeters * toleranceMeters;
  const markers = new Uint8Array(points.length);
  const stack = [[0, points.length - 1]];
  markers[0] = 1;
  markers[points.length - 1] = 1;

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxSqDistance = 0;
    let index = 0;

    for (let i = first + 1; i < last; i += 1) {
      const sqDistance = squaredDistanceToSegment(points[i], points[first], points[last]);
      if (sqDistance > maxSqDistance) {
        index = i;
        maxSqDistance = sqDistance;
      }
    }

    if (maxSqDistance > sqTolerance) {
      markers[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, index) => markers[index] === 1);
}

function pointsEqual(left, right) {
  return left[0] === right[0] && left[1] === right[1];
}

function closeRing(points) {
  if (points.length === 0) return points;
  const closed = pointsEqual(points[0], points[points.length - 1]);
  return closed ? points : [...points, points[0]];
}

function simplifyRing(ring, toleranceMeters) {
  const closedRing = closeRing(ring);
  const openRing = closedRing.slice(0, -1);
  if (openRing.length < 4) {
    return closedRing;
  }

  const simplified = douglasPeucker([...openRing, openRing[0]], toleranceMeters);
  const simplifiedOpen = pointsEqual(simplified[0], simplified[simplified.length - 1])
    ? simplified.slice(0, -1)
    : simplified;

  if (simplifiedOpen.length < 4) {
    return closedRing;
  }

  return closeRing(simplifiedOpen);
}

function utm32ToLonLat(easting, northing) {
  const a = 6378137;
  const f = 1 / 298.257222101;
  const e2 = f * (2 - f);
  const ePrime2 = e2 / (1 - e2);
  const k0 = 0.9996;
  const falseEasting = 500000;
  const lonOrigin = 9 * Math.PI / 180;

  const x = easting - falseEasting;
  const y = northing;
  const m = y / k0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const j1 = (3 * e1) / 2 - (27 * e1 ** 3) / 32;
  const j2 = (21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32;
  const j3 = (151 * e1 ** 3) / 96;
  const j4 = (1097 * e1 ** 4) / 512;
  const fp =
    mu +
    j1 * Math.sin(2 * mu) +
    j2 * Math.sin(4 * mu) +
    j3 * Math.sin(6 * mu) +
    j4 * Math.sin(8 * mu);

  const sinFp = Math.sin(fp);
  const cosFp = Math.cos(fp);
  const tanFp = Math.tan(fp);
  const c1 = ePrime2 * cosFp * cosFp;
  const t1 = tanFp * tanFp;
  const n1 = a / Math.sqrt(1 - e2 * sinFp * sinFp);
  const r1 = (a * (1 - e2)) / (1 - e2 * sinFp * sinFp) ** 1.5;
  const d = x / (n1 * k0);

  const lat =
    fp -
    ((n1 * tanFp) / r1) *
      (d * d / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ePrime2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ePrime2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon =
    lonOrigin +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ePrime2 + 24 * t1 * t1) * d ** 5) / 120) /
      cosFp;

  return [roundNumber((lon * 180) / Math.PI, 5), roundNumber((lat * 180) / Math.PI, 5)];
}

function transformRing(ring) {
  return ring.map(([x, y]) => utm32ToLonLat(x, y));
}

function transformGeometry(geometry, toleranceMeters) {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring) => transformRing(simplifyRing(ring, toleranceMeters))),
    };
  }

  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => transformRing(simplifyRing(ring, toleranceMeters))),
      ),
    };
  }

  throw new Error(`Nicht unterstützter GeoJSON-Geometrietyp: ${geometry.type}`);
}

function asMultiPolygonCoordinates(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`Nicht unterstützter GeoJSON-Geometrietyp: ${geometry.type}`);
}

function normalizeProjectedPolygon(polygon) {
  return polygon
    .map((ring) => closeRing(ring))
    .filter((ring) => ring.length >= 4);
}

function unionProjectedGeometries(geometries) {
  const polygons = geometries
    .flatMap(asMultiPolygonCoordinates)
    .map(normalizeProjectedPolygon)
    .filter((polygon) => polygon.length > 0);

  if (polygons.length === 0) {
    return { type: 'MultiPolygon', coordinates: [] };
  }

  let unioned = polygonClipping.union(polygons[0]);
  for (let index = 1; index < polygons.length; index += 1) {
    unioned = polygonClipping.union(unioned, polygons[index]);
  }

  return {
    type: 'MultiPolygon',
    coordinates: unioned,
  };
}

function extendBbox(bbox, point) {
  bbox[0] = Math.min(bbox[0], point[0]);
  bbox[1] = Math.min(bbox[1], point[1]);
  bbox[2] = Math.max(bbox[2], point[0]);
  bbox[3] = Math.max(bbox[3], point[1]);
}

function geometryBbox(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  const visitRing = (ring) => {
    for (const point of ring) extendBbox(bbox, point);
  };

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(visitRing);
  } else {
    geometry.coordinates.forEach((polygon) => polygon.forEach(visitRing));
  }

  return bbox.every(Number.isFinite) ? bbox.map((value) => roundNumber(value, 5)) : undefined;
}

function collectionBbox(features) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const feature of features) {
    const featureBbox = feature.bbox ?? geometryBbox(feature.geometry);
    if (!featureBbox) continue;
    extendBbox(bbox, [featureBbox[0], featureBbox[1]]);
    extendBbox(bbox, [featureBbox[2], featureBbox[3]]);
  }
  return bbox.every(Number.isFinite) ? bbox.map((value) => roundNumber(value, 5)) : undefined;
}

function writeJson(relativePath, data, pretty = false) {
  const outputPath = path.join(outputDir, relativePath);
  const json = JSON.stringify(data, null, pretty ? 2 : 0);
  writeFileSync(outputPath, `${json}\n`);
}

function fileInfo(relativePath, available = true, reason) {
  const outputPath = path.join(outputDir, relativePath);
  return {
    url: `/data/kreisreform/${relativePath}`,
    available,
    sizeBytes: available && existsSync(outputPath) ? statSync(outputPath).size : 0,
    reason,
  };
}

function makeFeatureCollection(features) {
  const collection = {
    type: 'FeatureCollection',
    bbox: collectionBbox(features),
    features,
  };
  return collection;
}

function aggregateGemeinden(gemeinden) {
  const byKreis = new Map();
  const byAgsKrs = new Map();

  for (const row of gemeinden) {
    const kreisName = row.krs_neu;
    if (!byKreis.has(kreisName)) {
      byKreis.set(kreisName, {
        einwohner: 0,
        flaecheKm2: 0,
        gemeinden: 0,
        altKreisIds: new Set(),
        sampleGemeinde: undefined,
      });
    }
    const aggregate = byKreis.get(kreisName);
    aggregate.einwohner += Number(row.EWZ ?? 0);
    aggregate.flaecheKm2 += Number(row.KFL ?? 0);
    aggregate.gemeinden += 1;
    aggregate.altKreisIds.add(row.ags_krs);
    if (!aggregate.sampleGemeinde) aggregate.sampleGemeinde = row;

    if (!byAgsKrs.has(row.ags_krs)) {
      byAgsKrs.set(row.ags_krs, {
        id: row.ags_krs,
        name: oldKreisNames[row.ags_krs] ?? row.ags_krs,
        bundeslandAlt: stateByPrefix[String(row.ags_krs).slice(0, 2)] ?? 'Unbekannt',
        bezirkAlt: oldBezirkForAgs(row.ags_krs),
        einwohner: 0,
        flaecheKm2: 0,
      });
    }
    const oldAggregate = byAgsKrs.get(row.ags_krs);
    oldAggregate.einwohner += Number(row.EWZ ?? 0);
    oldAggregate.flaecheKm2 += Number(row.KFL ?? 0);
  }

  return { byKreis, byAgsKrs };
}

function loadSourceRows() {
  const layers = queryJson("select table_name, srs_id from gpkg_contents where data_type = 'features' order by table_name;");
  const layerNames = new Set(layers.map((layer) => layer.table_name));
  for (const requiredLayer of ['gemeinden_mit_einwohner', 'kreise_mit_einwohnern', 'bezirke']) {
    if (!layerNames.has(requiredLayer)) {
      throw new Error(`Erforderlicher GeoPackage-Layer fehlt: ${requiredLayer}`);
    }
  }

  const gemeinden = queryJson(
    "select fid, AGS, ARS, GEN, BEZ, ags_krs, krs_neu, EWZ, KFL from gemeinden_mit_einwohner order by GEN;",
  );
  const kreise = queryJson(
    "select fid, hex(geom) as geom, AGS, ARS, GEN, BEZ, ags_krs, krs_neu, Einwohner, KFL, bezirk_neu from kreise_mit_einwohnern order by krs_neu;",
  );
  const bezirke = queryJson(
    "select fid, hex(geom) as geom, krs_neu, Einwohner, KFL, bezirk_neu from bezirke order by bezirk_neu;",
  );

  return { layers, gemeinden, kreise, bezirke };
}

function buildKreiseFeatures(kreise, gemeindenByKreis) {
  return kreise.map((row) => {
    const aggregate = gemeindenByKreis.get(row.krs_neu);
    const altKreise = [...(aggregate?.altKreisIds ?? [])].sort().map((ags) => ({
      id: ags,
      name: oldKreisNames[ags] ?? ags,
      bundeslandAlt: stateByPrefix[String(ags).slice(0, 2)] ?? 'Unbekannt',
      bezirkAlt: oldBezirkForAgs(ags),
    }));
    const geometry = transformGeometry(parseGeoPackageGeometry(row.geom), 80);
    const rawName = row.krs_neu;
    const feature = {
      type: 'Feature',
      id: slugify(rawName),
      bbox: geometryBbox(geometry),
      properties: {
        id: slugify(rawName),
        name: displayKreisName(rawName),
        nameRaw: rawName,
        typ: kreisfreieStaedte.has(rawName) ? 'Kreisfreie Stadt' : 'Landkreis',
        bezirkNeu: row.bezirk_neu,
        einwohner: Math.round(Number(row.Einwohner ?? aggregate?.einwohner ?? 0)),
        flaecheKm2: roundNumber(Number(aggregate?.flaecheKm2 ?? row.KFL ?? 0)),
        gemeinden: aggregate?.gemeinden ?? undefined,
        alteKreise: altKreise,
        quelle: 'GeoPackage / Gesetzesentwurf',
      },
      geometry,
    };
    return feature;
  });
}

function buildBezirkeFeatures(bezirke, kreiseFeatures) {
  const kreiseByBezirk = new Map();
  for (const feature of kreiseFeatures) {
    const bezirk = feature.properties.bezirkNeu;
    if (!kreiseByBezirk.has(bezirk)) kreiseByBezirk.set(bezirk, []);
    kreiseByBezirk.get(bezirk).push(`${feature.properties.typ} ${feature.properties.name}`);
  }

  return bezirke.map((row) => {
    const name = row.bezirk_neu;
    const reference = districtReference[name];
    const geometry = transformGeometry(parseGeoPackageGeometry(row.geom), 120);
    const kreise = (kreiseByBezirk.get(name) ?? []).sort((left, right) => left.localeCompare(right, 'de'));
    return {
      type: 'Feature',
      id: slugify(name),
      bbox: geometryBbox(geometry),
      properties: {
        id: slugify(name),
        name,
        sitz: reference?.sitz ?? 'Nicht angegeben',
        einwohner: reference?.einwohner ?? Math.round(Number(row.Einwohner ?? 0)),
        flaecheKm2: reference?.flaecheKm2 ?? roundNumber(Number(row.KFL ?? 0)),
        kreise,
        quelle: 'GeoPackage / Gesetzesentwurf',
      },
      geometry,
    };
  });
}

function buildGemeindenSearch(gemeinden, kreisFeatureLookup) {
  return gemeinden.map((row) => {
    const kreisFeature = kreisFeatureLookup.get(row.krs_neu);
    const agsKrs = row.ags_krs;
    return {
      id: row.AGS,
      ars: row.ARS,
      name: row.GEN,
      typ: row.BEZ,
      kreisNeu: displayKreisName(row.krs_neu),
      kreisNeuRaw: row.krs_neu,
      kreisNeuId: kreisFeature?.properties.id ?? slugify(row.krs_neu),
      bezirkNeu: kreisFeature?.properties.bezirkNeu,
      alterKreis: oldKreisNames[agsKrs] ?? agsKrs,
      alterKreisId: agsKrs,
      bundeslandAlt: stateByPrefix[String(agsKrs).slice(0, 2)] ?? 'Unbekannt',
      bezirkAlt: oldBezirkForAgs(agsKrs),
      einwohner: Math.round(Number(row.EWZ ?? 0)),
      flaecheKm2: roundNumber(Number(row.KFL ?? 0)),
    };
  });
}

function groupVg250Rows(rows, idKey = 'AGS') {
  const groups = new Map();
  for (const row of rows) {
    const id = String(row[idKey] ?? '');
    if (!id) continue;
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        rows: [],
        geometries: [],
      });
    }
    const group = groups.get(id);
    group.rows.push(row);
    group.geometries.push(parseGeoPackageGeometry(row.geom));
  }
  return [...groups.values()];
}

function buildNeueKreiseByOldKreis(gemeinden) {
  const mapping = new Map();
  for (const row of gemeinden) {
    const ags = row.ags_krs;
    if (!mapping.has(ags)) mapping.set(ags, new Set());
    mapping.get(ags).add(displayKreisName(row.krs_neu));
  }

  return new Map(
    [...mapping.entries()].map(([ags, values]) => [
      ags,
      [...values].sort((left, right) => left.localeCompare(right, 'de')),
    ]),
  );
}

function loadVg250Rows(tableName) {
  return queryJson(
    `select id, hex(geom) as geom, AGS, ARS, GEN, BEZ, SN_L, NUTS from ${tableName} where substr(AGS, 1, 2) in ('11','12','13','14','15','16') order by AGS, id;`,
    sourceVg250Gpkg,
  );
}

function makeUnavailableOldLayer(outputName) {
  const outputPath = path.join(outputDir, outputName);
  if (existsSync(outputPath)) rmSync(outputPath);
  return {
    ...fileInfo(
      outputName,
      false,
      `VG250-GeoPackage fehlt: ${path.relative(rootDir, sourceVg250Gpkg)}`,
    ),
    featureCount: 0,
  };
}

function buildOldKreisEntries(gemeinden) {
  const neueKreiseByAlt = buildNeueKreiseByOldKreis(gemeinden);
  const groups = groupVg250Rows(loadVg250Rows('vg250_krs'));

  return groups.map((group) => {
    const row = group.rows[0];
    const ags = group.id;
    const geometry = unionProjectedGeometries(group.geometries);
    const name = row.GEN ?? oldKreisNames[ags] ?? ags;
    const typ = row.BEZ ?? 'Kreis';
    return {
      id: ags,
      name,
      typ,
      bundeslandAlt: stateByPrefix[ags.slice(0, 2)] ?? 'Unbekannt',
      bezirkAlt: oldBezirkForAgs(ags),
      neueKreise: neueKreiseByAlt.get(ags) ?? [],
      geometry,
    };
  });
}

function buildOldKreisFeatures(oldKreisEntries) {
  return oldKreisEntries.map((entry) => {
    const geometry = transformGeometry(entry.geometry, 90);
    return {
      type: 'Feature',
      id: entry.id,
      bbox: geometryBbox(geometry),
      properties: {
        id: entry.id,
        name: entry.name,
        typ: entry.typ,
        bundeslandAlt: entry.bundeslandAlt,
        bezirkAlt: entry.bezirkAlt,
        neueKreise: entry.neueKreise,
        quelle: 'VG250 / Bezirkseinführungsgesetz',
      },
      geometry,
    };
  });
}

function buildOldBezirkFeatures(oldKreisEntries) {
  const byBezirk = new Map();
  for (const entry of oldKreisEntries) {
    if (!byBezirk.has(entry.bezirkAlt)) {
      byBezirk.set(entry.bezirkAlt, []);
    }
    byBezirk.get(entry.bezirkAlt).push(entry);
  }

  return [...byBezirk.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'de'))
    .map(([name, entries]) => {
      const projectedGeometry = unionProjectedGeometries(entries.map((entry) => entry.geometry));
      const geometry = transformGeometry(projectedGeometry, 130);
      const kreise = entries
        .map((entry) => `${entry.typ} ${entry.name}`)
        .sort((left, right) => left.localeCompare(right, 'de'));
      return {
        type: 'Feature',
        id: slugify(name),
        bbox: geometryBbox(geometry),
        properties: {
          id: slugify(name),
          name,
          typ: 'Bisheriger Bezirk',
          sitz: oldDistrictSeats[name] ?? 'Nicht angegeben',
          kreise,
          quelle: 'Bezirkseinführungsgesetz, aus VG250-Kreisgrenzen abgeleitet',
        },
        geometry,
      };
    });
}

function buildOldBundeslandFeatures() {
  const groups = groupVg250Rows(loadVg250Rows('vg250_lan'));
  return groups.map((group) => {
    const row = group.rows[0];
    const ags = group.id;
    const projectedGeometry = unionProjectedGeometries(group.geometries);
    const geometry = transformGeometry(projectedGeometry, 150);
    return {
      type: 'Feature',
      id: ags,
      bbox: geometryBbox(geometry),
      properties: {
        id: ags,
        name: row.GEN ?? stateByPrefix[ags] ?? ags,
        typ: row.BEZ ?? 'Land',
        bundeslandAlt: row.GEN ?? stateByPrefix[ags] ?? ags,
        quelle: 'VG250',
      },
      geometry,
    };
  });
}

function writeLayer(outputName, features) {
  const collection = makeFeatureCollection(features);
  writeJson(outputName, collection);
  return {
    ...fileInfo(outputName),
    featureCount: features.length,
    bbox: collection.bbox,
  };
}

function buildOldLayers(gemeinden) {
  if (!existsSync(sourceVg250Gpkg)) {
    if (withVg250) {
      throw new Error(
        `VG250-GeoPackage fehlt: ${path.relative(rootDir, sourceVg250Gpkg)}. Kreis- oder Bezirksgeometrien werden nicht erfunden.`,
      );
    }
    return {
      alteKreise: makeUnavailableOldLayer('alte-kreise.geojson'),
      alteBundeslaender: makeUnavailableOldLayer('alte-bundeslaender.geojson'),
      alteBezirke: makeUnavailableOldLayer('alte-bezirke.geojson'),
    };
  }

  const layers = queryJson("select table_name from gpkg_contents where data_type = 'features';", sourceVg250Gpkg);
  const layerNames = new Set(layers.map((layer) => layer.table_name));
  for (const requiredLayer of ['vg250_krs', 'vg250_lan']) {
    if (!layerNames.has(requiredLayer)) {
      throw new Error(`Erforderlicher VG250-Layer fehlt: ${requiredLayer}`);
    }
  }

  const oldKreisEntries = buildOldKreisEntries(gemeinden);
  const alteKreisFeatures = buildOldKreisFeatures(oldKreisEntries);
  const alteBezirkFeatures = buildOldBezirkFeatures(oldKreisEntries);
  const alteBundeslandFeatures = buildOldBundeslandFeatures();

  return {
    alteKreise: writeLayer('alte-kreise.geojson', alteKreisFeatures),
    alteBezirke: writeLayer('alte-bezirke.geojson', alteBezirkFeatures),
    alteBundeslaender: writeLayer('alte-bundeslaender.geojson', alteBundeslandFeatures),
  };
}

function main() {
  assertInput();
  mkdirSync(outputDir, { recursive: true });

  const { layers, gemeinden, kreise, bezirke } = loadSourceRows();
  const { byKreis: gemeindenByKreis } = aggregateGemeinden(gemeinden);
  const kreiseFeatures = buildKreiseFeatures(kreise, gemeindenByKreis);
  const kreisFeatureLookup = new Map(kreiseFeatures.map((feature) => [feature.properties.nameRaw, feature]));
  const bezirkeFeatures = buildBezirkeFeatures(bezirke, kreiseFeatures);
  const gemeindenSearch = buildGemeindenSearch(gemeinden, kreisFeatureLookup);

  const neueKreise = makeFeatureCollection(kreiseFeatures);
  const neueBezirke = makeFeatureCollection(bezirkeFeatures);

  writeJson('neue-kreise.geojson', neueKreise);
  writeJson('neue-bezirke.geojson', neueBezirke);
  writeJson('gemeinden-zur-suche.json', gemeindenSearch);

  const oldLayers = buildOldLayers(gemeinden);
  const largestKreis = [...kreiseFeatures].sort(
    (left, right) => right.properties.einwohner - left.properties.einwohner,
  )[0];

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: {
      ...sourceFiles,
      sourceSrs: 'EPSG:25832',
      webSrs: 'EPSG:4326',
      layers: layers.map((layer) => ({ name: layer.table_name, srsId: layer.srs_id })),
    },
    stats: {
      neueKreise: kreiseFeatures.length,
      neueBezirke: bezirkeFeatures.length,
      gemeinden: gemeinden.length,
      wirksamAb: '2027-01-01',
      groessterKreis: largestKreis
        ? {
            name: largestKreis.properties.name,
            typ: largestKreis.properties.typ,
            einwohner: largestKreis.properties.einwohner,
          }
        : undefined,
    },
    layers: {
      neueKreise: {
        ...fileInfo('neue-kreise.geojson'),
        featureCount: kreiseFeatures.length,
        bbox: neueKreise.bbox,
      },
      neueBezirke: {
        ...fileInfo('neue-bezirke.geojson'),
        featureCount: bezirkeFeatures.length,
        bbox: neueBezirke.bbox,
      },
      gemeindenSuche: {
        ...fileInfo('gemeinden-zur-suche.json'),
        featureCount: gemeindenSearch.length,
      },
      alteKreise: oldLayers.alteKreise,
      alteBezirke: oldLayers.alteBezirke,
      alteBundeslaender: oldLayers.alteBundeslaender,
    },
    notice:
      'Die Karte dient der anschaulichen Darstellung; rechtsverbindlich ist die verkündete Fassung des Gesetzes einschließlich Anlagen.',
  };

  writeJson('manifest.json', manifest, true);

  const warnings = [];
  for (const layerName of [
    'neue-kreise.geojson',
    'neue-bezirke.geojson',
    'alte-kreise.geojson',
    'alte-bezirke.geojson',
    'alte-bundeslaender.geojson',
  ]) {
    if (!existsSync(path.join(outputDir, layerName))) continue;
    const size = statSync(path.join(outputDir, layerName)).size;
    if (size > 8 * 1024 * 1024) {
      warnings.push(`${layerName} ist größer als 8 MB; Vector Tiles oder PMTiles prüfen.`);
    }
  }

  console.log(
    `Kreisreform-Kartendaten erzeugt: ${kreiseFeatures.length} neue Kreise, ${bezirkeFeatures.length} neue Bezirke, ${oldLayers.alteKreise.featureCount} alte Kreise, ${oldLayers.alteBezirke.featureCount} alte Bezirke, ${gemeindenSearch.length} Suchdatensätze.`,
  );
  for (const warning of warnings) console.warn(warning);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
