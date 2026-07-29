export interface KreisreformLayerInfo {
  url: string;
  available: boolean;
  sizeBytes: number;
  reason?: string;
  featureCount?: number;
  bbox?: [number, number, number, number];
}

export interface KreisreformManifest {
  generatedAt: string;
  source: {
    geoPackage: string;
    neuordnungsgesetz: string;
    bezirkseinfuehrungsgesetz: string;
    vg250?: string;
    vg250Download?: string;
    sourceSrs: string;
    webSrs: string;
    layers: { name: string; srsId: number }[];
  };
  stats: {
    neueKreise: number;
    neueBezirke: number;
    gemeinden: number;
    wirksamAb: string;
    groessterKreis?: {
      name: string;
      typ: string;
      einwohner: number;
    };
  };
  layers: {
    neueKreise: KreisreformLayerInfo;
    neueBezirke: KreisreformLayerInfo;
    gemeindenSuche: KreisreformLayerInfo;
    alteKreise: KreisreformLayerInfo;
    alteBezirke: KreisreformLayerInfo;
    alteBundeslaender: KreisreformLayerInfo;
  };
  notice: string;
}

export interface AlterKreisReference {
  id: string;
  name: string;
  bundeslandAlt: string;
  bezirkAlt: string;
}

export interface NeuerKreisProperties {
  id: string;
  name: string;
  nameRaw: string;
  typ: 'Landkreis' | 'Kreisfreie Stadt';
  bezirkNeu: string;
  einwohner: number;
  flaecheKm2: number;
  gemeinden?: number;
  alteKreise: AlterKreisReference[];
  quelle: string;
}

export interface NeuerBezirkProperties {
  id: string;
  name: string;
  sitz: string;
  einwohner: number;
  flaecheKm2: number;
  kreise: string[];
  quelle: string;
}

export interface AlterKreisProperties {
  id: string;
  name: string;
  typ: string;
  bundeslandAlt: string;
  bezirkAlt: string;
  neueKreise: string[];
  quelle: string;
}

export interface AlterBezirkProperties {
  id: string;
  name: string;
  typ: string;
  sitz: string;
  kreise: string[];
  quelle: string;
}

export interface GeoJsonFeature<TProperties> {
  type: 'Feature';
  id?: string;
  bbox?: [number, number, number, number];
  properties: TProperties;
  geometry: unknown;
}

export interface GeoJsonFeatureCollection<TProperties> {
  type: 'FeatureCollection';
  bbox?: [number, number, number, number];
  features: GeoJsonFeature<TProperties>[];
}
