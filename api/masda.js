// siMADA API proxy for Vercel.
// Keep ES Module syntax: the original siMADA project used `export default`.
// Vercel environment variable: MASDA_GAS_URL (Google Apps Script Web App URL ending /exec).

function sendJson(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.status(status).json(payload);
}

async function readRequestBody(req) {
  let body = req && req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); }
    catch (_) { throw Object.assign(new Error('Body permintaan bukan JSON yang valid.'), { code: 'INVALID_JSON' }); }
  }
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;

  // Fallback for runtimes that do not pre-parse the request body.
  if (req && typeof req[Symbol.asyncIterator] === 'function') {
    let raw = '';
    for await (const chunk of req) raw += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (raw.trim()) {
      try { return JSON.parse(raw); }
      catch (_) { throw Object.assign(new Error('Body permintaan bukan JSON yang valid.'), { code: 'INVALID_JSON' }); }
    }
  }
  return {};
}

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return sendJson(res, 200, { success: true, message: 'CORS preflight OK.' });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, OPTIONS');
      return sendJson(res, 405, { success: false, code: 'METHOD_NOT_ALLOWED', message: 'Gunakan metode POST.' });
    }

    const gasUrl = String(process.env.MASDA_GAS_URL || '').trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(gasUrl)) {
      return sendJson(res, 500, { success: false, code: 'GAS_URL_INVALID', message: 'MASDA_GAS_URL belum benar. Isi dengan URL Web App Google Apps Script yang berakhiran /exec.' });
    }

    const body = await readRequestBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body) || body.action !== 'rpc' || typeof body.method !== 'string' || !body.method.trim()) {
      return sendJson(res, 400, { success: false, code: 'INVALID_REQUEST', message: 'Format permintaan API tidak sesuai. Aksi RPC atau nama fungsi tidak ditemukan.' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    let upstream;
    let raw;
    try {
      upstream = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Accept': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow',
        signal: controller.signal
      });
      raw = await upstream.text();
    } finally {
      clearTimeout(timeoutId);
    }

    let data;
    try { data = JSON.parse(raw); }
    catch (_) {
      const preview = String(raw || '').replace(/\s+/g, ' ').slice(0, 240);
      console.error('[siMADA] GAS non-JSON response', upstream && upstream.status, preview);
      return sendJson(res, 502, {
        success: false,
        code: 'GAS_NON_JSON',
        message: 'Google Apps Script tidak mengembalikan JSON. HTTP GAS: ' + (upstream ? upstream.status : 'tidak diketahui') + '. Respons: ' + (preview || '(kosong)')
      });
    }

    // GAS may return application-level errors in JSON; preserve its payload for the frontend.
    return sendJson(res, 200, data);
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    const code = err && err.code === 'INVALID_JSON' ? 'INVALID_JSON' : (timedOut ? 'GAS_TIMEOUT' : 'API_PROXY_ERROR');
    console.error('[siMADA] API function failed:', err && err.stack ? err.stack : err);
    return sendJson(res, code === 'INVALID_JSON' ? 400 : 502, {
      success: false,
      code,
      message: code === 'INVALID_JSON' ? err.message : (timedOut ? 'Google Apps Script tidak merespons dalam 25 detik.' : 'Proxy API gagal: ' + (err && err.message ? err.message : 'kesalahan tidak diketahui.'))
    });
  }
}
