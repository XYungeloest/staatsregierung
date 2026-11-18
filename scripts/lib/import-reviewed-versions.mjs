/**
 * Schutz redaktionell geprüfter Bestandsfassungen beim Normimport.
 *
 * Eine nichtamtliche konsolidierte Lesefassung unter `Gesetze/` (Klassifikation
 * „consolidated“) ist keine amtliche Verkündung. Führt `data/recht/consolidation-sources.json`
 * eine gespeicherte Fassung als `existingVersionSeed` einer Konsolidierung, ist ihr Normtext
 * gegen die amtlichen Änderungsvorschriften geprüft und Ausgangspunkt der Folgefassungen. Der
 * Import übernimmt dann den gespeicherten Normtext, statt ihn aus der Lesefassung neu zu
 * erzeugen; ein Neueinlesen der Lesefassung überschreibt die geprüfte Fassung nicht.
 */

export function reviewedSeedVersionIds(consolidationSources, slug) {
  const seed = consolidationSources?.targets?.[slug]?.existingVersionSeed;
  return new Set(seed?.versionId ? [seed.versionId] : []);
}

/**
 * Ersetzt den aus der Lesefassung erzeugten Normtext jeder Fassung, die als geprüfte
 * Ausgangsfassung geführt und gespeichert ist, durch den gespeicherten Normtext. Fassungen
 * ohne Seed-Kennzeichnung oder ohne gespeicherte Datei bleiben unverändert.
 */
export function preferReviewedSeedBodies(record, storedVersions, seedVersionIds) {
  const preserved = [];
  const versions = (record.versions ?? []).map((version) => {
    if (!seedVersionIds?.has(version.versionId)) return version;
    const stored = (storedVersions ?? []).find((candidate) => candidate.versionId === version.versionId);
    if (!stored?.body) return version;
    preserved.push(version.versionId);
    return { ...version, body: structuredClone(stored.body) };
  });
  return { record: { ...record, versions }, preserved };
}

/**
 * Titel eines Verkündungseintrags: Der Eintrag verweist über `versionId` auf die verkündete
 * Fassung und trägt deren Bezeichnung. Ein später geänderter Titel der Norm (meta.title folgt
 * der geltenden Fassung) wird nicht in die frühere Ausgabe zurückgetragen.
 */
export function publicationEntryTitle(version, meta) {
  return version?.title ?? meta?.title;
}
