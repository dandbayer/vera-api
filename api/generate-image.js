// api/generate-image.js — Vercel Serverless Function
// Gera imagem no Ideogram, baixa server-side e retorna como base64

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

    // 1. Gera a imagem no Ideogram
    const ideogramRes = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: {
        'Api-Key': process.env.IDEOGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_request: {
          prompt: prompt,
          aspect_ratio: 'ASPECT_1_1',
          model: 'V_2_TURBO',
          magic_prompt_option: 'AUTO',
          style_type: 'REALISTIC',
        }
      })
    });

    if (!ideogramRes.ok) {
      const errText = await ideogramRes.text();
      console.error('Ideogram generate error:', errText);
      return res.status(502).json({ error: 'Ideogram API error', detail: errText });
    }

    const data = await ideogramRes.json();
    const imageUrl = data?.data?.[0]?.url;

    if (!imageUrl) {
      return res.status(502).json({ error: 'Sem URL na resposta do Ideogram', raw: data });
    }

    // 2. Baixa a imagem server-side (sem restrição de CORS)
    // Tenta primeiro sem Api-Key, depois com
    let imgRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VERA/1.0)',
        'Accept': 'image/png,image/webp,image/*,*/*',
      }
    });

    if (!imgRes.ok) {
      // Segunda tentativa com autenticação
      imgRes = await fetch(imageUrl, {
        headers: {
          'Api-Key': process.env.IDEOGRAM_API_KEY,
          'User-Agent': 'Mozilla/5.0 (compatible; VERA/1.0)',
          'Accept': 'image/png,image/webp,image/*,*/*',
        }
      });
    }

    if (!imgRes.ok) {
      console.error('Falha ao baixar imagem:', imgRes.status, imgRes.statusText);
      return res.status(502).json({
        error: 'Não foi possível baixar a imagem gerada',
        httpStatus: imgRes.status,
        imageUrl
      });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/png';
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    // 3. Retorna como data URL — sem CORS, sem expiração, pronto para o canvas
    return res.status(200).json({ url: dataUrl });

  } catch (err) {
    console.error('Generate image error:', err);
    return res.status(500).json({ error: err.message });
  }
}
