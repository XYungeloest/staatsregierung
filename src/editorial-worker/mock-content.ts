function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export const mockEditorialFiles: Record<string, string> = {
  'content/organisation/governments.json': json({ governments: [{ slug: 'erster-staatsrat', title: 'Erster Staatsrat', kind: 'state-council', validFrom: '2026-01-01', validTo: null, coalition: 'Lokale Vorschaukoalition', coalitionShort: 'Vorschau', coalitionParties: ['vorschau'], legislature: 'Vorschauperiode', predecessor: null, seatOfGovernment: 'Dresden', coalitionSeats: 1, parliamentSeats: 1, sourceRefs: ['lokaler-mock'] }] }),
  'content/organisation/offices.json': json({ offices: [
    { slug: 'staatspraesident', title: 'Staatspräsident', role: 'head', membership: 'member', exclusive: true, canLeadMinistry: false },
    { slug: 'stellvertretender-staatspraesident', title: 'Stellvertretender Staatspräsident', role: 'deputy', membership: 'member', exclusive: true, canLeadMinistry: true },
    { slug: 'staatsratsmitglied', title: 'Staatsratsmitglied', role: 'member', membership: 'member', exclusive: false, canLeadMinistry: true },
  ] }),
  'content/organisation/assignments.json': json({ assignments: [
    { id: 'mock-leitung', personSlug: 'karl-honecker', officeSlug: 'staatspraesident', ministrySlug: null, governmentSlug: 'erster-staatsrat', title: 'Staatspräsident', validFrom: '2026-01-01', validTo: null, sortOrder: 10, sourceRefs: ['lokaler-mock'] },
    { id: 'mock-stellvertretung', personSlug: 'mateo-delgado', officeSlug: 'stellvertretender-staatspraesident', ministrySlug: 'vorschau-ressort', governmentSlug: 'erster-staatsrat', title: 'Stellvertretender Staatspräsident und Staatsrat für Vorschauen', validFrom: '2026-01-01', validTo: null, sortOrder: 20, sourceRefs: ['lokaler-mock'] },
  ] }),
  'content/regierung/mitglieder/karl-honecker.json': json({ slug: 'karl-honecker', name: 'Dr. Karl Honecker', kurzbiografie: 'Lokales Testprofil.', langbiografie: ['Dieses Profil dient ausschließlich dem lokalen Mock.'], bild: '/images/regierung/karl-honecker-ii.jpg', bildAlt: 'Porträt von Dr. Karl Honecker', bildnachweis: 'Lokaler Mock' }),
  'content/regierung/mitglieder/mateo-delgado.json': json({ slug: 'mateo-delgado', name: 'Dr. Mateo Delgado', kurzbiografie: 'Lokales Testprofil.', langbiografie: ['Dieses Profil dient ausschließlich dem lokalen Mock.'], bild: '/images/regierung/mateo-delgado.jpg', bildAlt: 'Porträt von Dr. Mateo Delgado', bildnachweis: 'Lokaler Mock' }),
  'content/ressorts/vorschau-ressort.json': json({ slug: 'vorschau-ressort', name: 'Staatssekretariat für lokale Vorschauen', kurzname: 'Vorschauressort', teaser: 'Lokaler Beispieldatensatz.', aufgaben: ['Formulare und Diffs lokal prüfen'], kontakt: { email: 'vorschau@freistaat-ostdeutschland.de' }, bild: '/images/ministerien/staatskanzlei.jpg', bildAlt: 'Beispielbild des Vorschauressorts', bildnachweis: 'Lokaler Mock', themen: ['Vorschau'], verknuepfteLinks: [] }),
  'content/themen/vorschau-thema.json': json({ slug: 'vorschau-thema', title: 'Lokales Vorschauthema', teaser: 'Beispieldatensatz für die Formularprüfung.', status: 'geplant', cluster: 'staat-demokratie', priority: 50, featured: false, updatedAt: '2026-08-09', knowledgeProjectRefs: [], beschlossen: [], umgesetzt: [], naechsteSchritte: ['Entwurf prüfen'], rechtsgrundlagen: [], faq: [], federfuehrendesRessort: 'vorschau-ressort' }),
  'content/portal/home.json': json({ hero: { eyebrow: 'Lokaler Mock', title: 'Redaktionsstudio lokal prüfen', lead: 'Dieser Datensatz wird nicht veröffentlicht.', image: '/images/ministerien/staatskanzlei.jpg', imageAlt: 'Lokales Vorschaubild', searchLabel: 'Suche', searchPlaceholder: 'Suchbegriff' }, portalAccesses: [{ title: 'Staatsrat', description: 'Lokaler Einstieg', href: '/staatsregierung/', icon: 'government' }], importantItems: [{ id: 'regierung', governmentSlug: 'erster-staatsrat', href: '/staatsregierung/', icon: 'government' }] }),
  'content/regierung/cabinet-page.json': json({ slug: 'cabinet-page', title: 'Erster Staatsrat', lead: 'Lokale Vorschau.', politicalContext: ['Beispielabsatz.'], chronologyTitle: 'Chronologie', chronology: [{ date: '2026-01-01', text: 'Mock angelegt.' }], topicHighlightSlugs: ['vorschau-thema'] }),
  'content/dashboard/action-plan.json': json({ items: [{ id: 'mock', title: 'Mock prüfen', description: 'Lokalen Adapter prüfen.', status: 'angelegt', ressort: 'Vorschauressort', href: '/' }] }),
  'content/dashboard/timeline.json': json({ entries: [{ id: 'mock', date: '2026-01-01', title: 'Mock gestartet', type: 'projekt', summary: 'Lokaler Adapter ist verfügbar.' }] }),
};
