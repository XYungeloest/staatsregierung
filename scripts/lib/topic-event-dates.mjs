/** Nur als eingetreten gekennzeichnete Ereignisse begrenzen den fachlichen Stand. */
export function reportedEventProblems(topic, dates) {
  const problems = [];
  for (const { kind, slug } of topic.reportedEvents ?? []) {
    const date = dates[kind]?.get(slug);
    if (!date) problems.push(`reportedEvents: kein veröffentlichtes Ereignisdatum für ${kind}/${slug}`);
    else if (date > topic.updatedAt) problems.push(`reportedEvents: ${kind}/${slug} vom ${date} liegt nach dem Fachstand ${topic.updatedAt}`);
  }
  return problems;
}
