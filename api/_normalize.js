export function normalizeApiRequest(req) {
  try {
    const host = req.headers?.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    if (!url.pathname.startsWith('/api/')) {
      url.pathname = `/api${url.pathname.startsWith('/') ? '' : '/'}${url.pathname}`;
      req.url = `${url.pathname}${url.search}`;
    }
  } catch {
    // Leave req.url as-is if it cannot be parsed.
  }
}


export function setNoStoreHeaders(res) {
  if (!res || typeof res.setHeader !== "function") return;
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
}
