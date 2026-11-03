// siMADA Vercel API proxy - CommonJS for reliable Vercel Node.js deployment.
// Required environment variable: MASDA_GAS_URL = deployed Google Apps Script Web App URL ending in /exec.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  if (req.method === 'OPTIONS') { res.setHeader('Allow', 'POST, OPTIONS'); return res.status(204).end(); }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return res.status(405).json({ success:false, code:'METHOD_NOT_ALLOWED', message:'Gunakan metode POST.' }); }
  const gasUrl = String(process.env.MASDA_GAS_URL || '').trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(gasUrl)) return res.status(500).json({ success:false, code:'GAS_URL_INVALID', message:'MASDA_GAS_URL belum benar. Isi dengan URL Web App Google Apps Script yang berakhiran /exec.' });
  try {
    let body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    if (!Object.keys(body).length && req && typeof req[Symbol.asyncIterator] === 'function') {
      let raw = ''; for await (const chunk of req) raw += chunk.toString(); if (raw) body = JSON.parse(raw);
    }
    if (!body || body.action !== 'rpc' || typeof body.method !== 'string') return res.status(400).json({ success:false, code:'INVALID_REQUEST', message:'Format permintaan API tidak sesuai. Aksi RPC tidak ditemukan.' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    let upstream, raw;
    try {
      upstream = await fetch(gasUrl, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8', 'Accept':'application/json' }, body:JSON.stringify(body), redirect:'follow', signal:controller.signal });
      raw = await upstream.text();
    } finally { clearTimeout(timeout); }
    let data;
    try { data = JSON.parse(raw); }
    catch (_) {
      const preview = String(raw || '').replace(/\s+/g, ' ').slice(0, 220);
      console.error('siMADA GAS returned non-JSON:', upstream && upstream.status, preview);
      return res.status(502).json({ success:false, code:'GAS_NON_JSON', message:'Google Apps Script tidak mengembalikan JSON. Periksa deployment Web App, akses, lalu deploy New version. HTTP GAS: ' + (upstream ? upstream.status : 'unknown') + '. Respons: ' + (preview || '(kosong)') });
    }
    return res.status(200).json(data);
  } catch (err) {
    const timedOut = err && err.name === 'AbortError';
    console.error('siMADA API proxy error:', err && err.stack ? err.stack : err);
    return res.status(502).json({ success:false, code:timedOut?'GAS_TIMEOUT':'API_PROXY_ERROR', message:timedOut?'Google Apps Script tidak merespons dalam 25 detik.':'Proxy API gagal: ' + (err && err.message ? err.message : 'kesalahan tidak diketahui.') });
  }
};
