// Prüft das gespeicherte Statusfeld einer Vorschrift gegen Inkrafttreten, letzten Geltungstag
// (`expiryDate`) und den redaktionellen Stichtag. `expiryDate` ist der letzte Tag, an dem die
// Vorschrift gilt; am Stichtag selbst ist sie deshalb noch nicht aufgehoben.
export function normStatusProblems(meta, referenceDate) {
  const problems = [];
  if (meta.status === 'future-effective' && (!meta.effectiveDate || meta.effectiveDate <= referenceDate)) {
    problems.push('future-effective setzt ein Inkrafttreten nach dem Stichtag voraus');
  }
  if (meta.status === 'in-force' && meta.effectiveDate && meta.effectiveDate > referenceDate) {
    problems.push('in-force setzt ein Inkrafttreten am oder vor dem Stichtag voraus');
  }
  if (meta.status === 'pending-effective' && meta.effectiveDate) {
    problems.push('pending-effective darf kein unbelegtes konkretes Inkrafttretensdatum enthalten');
  }
  if (meta.status === 'repealed' && (!meta.expiryDate || meta.expiryDate >= referenceDate)) {
    problems.push('repealed setzt einen letzten Geltungstag vor dem Stichtag voraus');
  }
  return problems;
}
