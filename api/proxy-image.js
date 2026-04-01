// api/proxy-image.js — Vercel Serverless Function
// Baixa a imagem do Ideogram server-side e repassa com CORS correto

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;

  if (!url) return res.status(400).json({ error: 'Parâmetro url obrigatório' });

  // Valida que é uma URL do Ideogram (segurança básica)
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'URL inválida' });
  }

  const allowedHosts = ['ideogram.ai', 'cdn.ideogram.ai'];
  if (!allowedHosts.some(host => parsed.hostname.endsWith(host))) {
    return res.status(403).json({ error: 'Host não permitido' });
  }

  try {
    const imageRes = await fetch(url, {
      headers: {
        // Simula um browser para evitar bloqueios
        'User-Agent': 'Mozilla/5.0 (compatible; VERA/1.0)',
      }
    });

    if (!imageRes.ok) {
      return res.status(502).json({ error: `Ideogram retornou ${imageRes.status}` });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/png';
    const buffer = await imageRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // cache 24h
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(Buffer.from(buffer));

  } catch (err) {
    console.error('Proxy image error:', err);
    return res.status(500).json({ error: err.message });
  }
}
