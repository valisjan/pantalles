// Actualització del quiosc: detectar una versió nova publicada i decidir quan
// cal la recàrrega diària. Mòdul pur, sense DOM.

// Cada publicació genera un fitxer JavaScript principal amb un nom diferent.
export function bundleFromHtml(html) {
  for (const tag of String(html || '').match(/<script\b[^>]*>/gi) || []) {
    if (/\btype=["']module["']/i.test(tag)) {
      const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      if (src) return src;
    }
  }
  return '';
}

// Propera recàrrega diària (per defecte a les 6.30, abans de les classes).
export function nextDailyReload(from, hours = 6, minutes = 30) {
  const next = new Date(from);
  next.setHours(hours, minutes, 0, 0);
  if (next <= from) next.setDate(next.getDate() + 1);
  return next;
}
