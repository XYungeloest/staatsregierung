const asOf = '2040-01-01';
const refs = [{ sourceId: 'druck', locator: 'Artikel 3, Seite 4', role: 'primary' }];
export function syntheticKnowledge() {
  const collection = (type, entries) => ({ type, entries, document: { asOf }, file: 'knowledge/' + type + '.json' });
  return { editorial: { referenceDate: asOf }, sourcesDoc: { asOf },
    sources: [{ id: 'druck', title: 'Druckausgabe', path: 'Gesetze/test.html', type: 'official-gazette', status: 'primary' }],
    collections: [
      collection('person', [{ id: 'person', title: 'Person', status: 'historical', roles: [{ institutionId: 'institution', officeTitle: 'Vorsitz',
        validFrom: '2035-01-01', validTo: '2036-01-01', appointmentSource: refs[0] }] }]),
      collection('project', [{ id: 'projekt', title: 'Bau', aliases: ['Bauwesen'], status: 'editorially-confirmed',
        sourceRefs: refs, normRefs: [{ normSlug: 'bau', versionId: '2037-01-01' }] }]),
      collection('open-question', [{ id: 'frage', title: 'Welcher Nachweis?', questionStatus: 'open', requiredSource: 'Ausfertigung', affectedIds: ['projekt'] }]),
      collection('conversation-candidate', [{ id: 'idee', title: 'Bauwesen', status: 'unverified' }]),
      collection('proceeding', ['completed', 'cabinet-approved-draft', 'formal-outcome-unresolved'].map((stage, i) => ({
        id: 'v-' + i, title: 'Verfahren', stage, relatedIds: ['projekt'], proceedingType: i === 2 ? 'court' : 'legislation' }))),
    ],
    mandates: { asOf, mandates: [
      { id: 'auftrag', tier: 'fristgebunden', status: 'offen', subject: 'Bericht', normSlug: 'bau', deadlineDate: '2041-01-01', evidence: ['Quelle: bau/versions/2037-01-01.json', 'Drucknachweis'], sourceRefs: refs },
      { id: 'mantelverweis', duplicateOf: 'auftrag' }, { id: 'erloschen', tier: 'verfallen', subject: 'Frist abgelaufen' },
    ] }, agenda: { majorProjects: [{ id: 'plan', title: 'Baustelle', stage: 'concept', sourceRefs: refs }], asOf },
    holdingPositions: { portfolios: [] } };
}
