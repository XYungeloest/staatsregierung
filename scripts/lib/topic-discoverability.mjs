const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

export function getActiveHighlights(topics, referenceDate) {
  return topics
    .filter((topic) => topic.highlightFrom
      && topic.highlightFrom <= referenceDate
      && (!topic.highlightUntil || topic.highlightUntil >= referenceDate))
    .sort((left, right) => right.priority - left.priority
      || right.updatedAt.localeCompare(left.updatedAt)
      || left.title.localeCompare(right.title, 'de'));
}

export function validateDiscoverability({ topics, referenceDate, policy }) {
  const problems = [];
  const activeHighlights = getActiveHighlights(topics, referenceDate);
  const minimumActiveHighlights = policy?.minimumActiveHighlights;

  if (!Number.isInteger(minimumActiveHighlights) || minimumActiveHighlights < 1) {
    problems.push('discoverability.minimumActiveHighlights muss eine positive ganze Zahl sein');
  } else if (activeHighlights.length < minimumActiveHighlights) {
    problems.push(`Themendiscoverability: am Stichtag ${referenceDate} sind nur ${activeHighlights.length} statt mindestens ${minimumActiveHighlights} aktuelle Vorhaben hervorgehoben`);
  }

  const editorialLead = policy?.editorialLead;
  if (editorialLead !== undefined) {
    if (!editorialLead || typeof editorialLead !== 'object' || Array.isArray(editorialLead)) {
      problems.push('discoverability.editorialLead muss ein Objekt sein');
    } else {
      const { topicSlug, from, until } = editorialLead;
      if (typeof topicSlug !== 'string' || !topics.some((topic) => topic.slug === topicSlug)) {
        problems.push(`discoverability.editorialLead.topicSlug: unbekanntes Thema ${String(topicSlug)}`);
      }
      if (!datePattern.test(from ?? '') || !datePattern.test(until ?? '') || from > until) {
        problems.push('discoverability.editorialLead: from und until müssen einen gültigen, aufsteigenden Datumszeitraum bilden');
      } else if (from <= referenceDate && referenceDate <= until && activeHighlights[0]?.slug !== topicSlug) {
        problems.push(`Themendiscoverability: ${topicSlug} muss im redaktionellen Zeitraum ${from} bis ${until} das höchst priorisierte aktuelle Vorhaben sein`);
      }
    }
  }

  return { activeHighlights, problems };
}
