// Enllaços compartits de Drive i Canva convertits a adreces que es poden inserir.

function embedCandidate(value) {
  const raw = String(value || '').trim();
  const iframeSource = raw.match(/src=["']([^"']+)["']/i)?.[1];
  return (iframeSource || raw).replaceAll('&amp;', '&');
}

export function normalizeDriveUrl(value) {
  try {
    const url = new URL(embedCandidate(value));
    const host = url.hostname.toLowerCase();
    if (!['drive.google.com', 'docs.google.com'].includes(host)) return '';
    const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || url.searchParams.get('id');
    if (fileId) return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
    const documentMatch = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (!documentMatch) return '';
    const [, kind, id] = documentMatch;
    if (kind === 'presentation') {
      return `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/embed?start=true&loop=true&delayms=10000`;
    }
    return `https://docs.google.com/${kind}/d/${encodeURIComponent(id)}/preview`;
  } catch {
    return '';
  }
}

export function normalizeCanvaUrl(value) {
  try {
    const url = new URL(embedCandidate(value));
    if (url.protocol !== 'https:' || !(url.hostname === 'canva.com' || url.hostname.endsWith('.canva.com'))) return '';
    url.searchParams.set('embed', '');
    return url.toString();
  } catch {
    return '';
  }
}
