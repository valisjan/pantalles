// Lectura de la jornada que publica Guàrdies (cursos/{curs}/guardiesPublicDays/{data}).
// Els estats coincideixen amb els del full de guàrdies.

export const ROW_STATUS_LABELS = Object.freeze({
  open: 'Sense cobrir',
  covered: 'Cobreix',
  coteacher: 'Queden amb',
  returns: 'Torna al seu grup',
  'not-done': 'No realitzada',
  info: 'No cal cobrir-la',
});

export function isPatioHour(hour) {
  return hour?.key === 'PATI' || hour?.kind === 'patio';
}

export function rowStatus(row) {
  if (row?.group === 'Guàrdia') return 'info';
  if (row?.assigned) {
    if (row.cancelled) return 'not-done';
    return row.coTeacher ? 'coteacher' : 'covered';
  }
  return row?.returnsToGroup ? 'returns' : 'open';
}

// Text de la columna de cobertura quan no hi ha ningú assignat.
export function rowCoverText(row) {
  if (row?.assigned) return row.assigned;
  const status = rowStatus(row);
  if (status === 'returns' || status === 'info') return 'Sense substitució';
  return 'Pendent';
}

// Qui es fa càrrec del grup: professorat de guàrdia, el docent que ja hi era
// (codocència) o professorat alliberat per una sortida.
export const COVER_ROLE_LABELS = Object.freeze({
  guard: 'Guàrdia',
  coteacher: 'Queden amb',
  released: 'Alliberat/ada',
});

export function rowRole(row) {
  if (!row?.assigned) return '';
  if (row.coTeacher || row.source === 'co-teacher') return 'coteacher';
  if (row.source === 'guard') return 'guard';
  if (row.source === 'released') return 'released';
  // Un altre docent o una jornada publicada abans que se'n guardés l'origen.
  return 'other';
}

export function rowCoverLabel(row) {
  const status = rowStatus(row);
  if (status === 'covered' || status === 'coteacher') return COVER_ROLE_LABELS[rowRole(row)] || ROW_STATUS_LABELS[status];
  return ROW_STATUS_LABELS[status];
}

// La G darrere el nom: qui cobreix és professorat de guàrdia.
export function rowSourceMark(row) {
  return rowStatus(row) === 'covered' && rowRole(row) === 'guard' ? 'guard' : '';
}

// Guàrdies que algú ha de fer (o fer-se càrrec) en una hora.
export function needsGuard(row) {
  return ['open', 'covered'].includes(rowStatus(row));
}

export function hourSummary(hour) {
  const rows = isPatioHour(hour) ? [] : (hour?.rows || []);
  return {
    absences: rows.length,
    guards: rows.filter(needsGuard).length,
    open: rows.filter((row) => rowStatus(row) === 'open').length,
  };
}

export function daySummary(day) {
  const hours = Array.isArray(day?.hours) ? day.hours : [];
  return hours.reduce((total, hour) => {
    const summary = hourSummary(hour);
    return {
      absences: total.absences + summary.absences,
      guards: total.guards + summary.guards,
      open: total.open + summary.open,
      outings: total.outings,
    };
  }, { absences: 0, guards: 0, open: 0, outings: Array.isArray(day?.groupsOut) ? day.groupsOut.length : 0 });
}

// Etiqueta curta d'una hora ("1a", "Pati") per a la barra de sessions.
export function shortHourLabel(hour, index) {
  if (isPatioHour(hour)) return 'Pati';
  return String(hour?.label || '').match(/^\d+a/)?.[0] || `${index + 1}a`;
}
