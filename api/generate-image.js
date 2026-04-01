// api/generate-image.js — Vercel Serverless Function
// Recebe prompt, chama Ideogram API, retorna URL da imagem

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

    const ideogramRes = await fetch('https://api.ideogram.ai/generate', {
      method: 'POST',
      headers: {
        'Api-Key': process.env.IDEOGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_request: {
          prompt: prompt,
          aspect_ratio: 'ASPECT_1_1',   // Feed — depois renderizamos stories via canvas crop
          model: 'V_2_TURBO',
          magic_prompt_option: 'AUTO',
          style_type: 'REALISTIC',
        }
      })
    });

    if (!ideogramRes.ok) {
      const errText = await ideogramRes.text();
      console.error('Ideogram error:', errText);
      return res.status(502).json({ error: 'Ideogram API error', detail: errText });
    }

    const data = await ideogramRes.json();
    const imageUrl = data?.data?.[0]?.url;

    if (!imageUrl) {
      return res.status(502).json({ error: 'Sem URL na resposta do Ideogram', raw: data });
    }

    return res.status(200).json({ url: imageUrl });

  } catch (err) {
    console.error('Generate image error:', err);
    return res.status(500).json({ error: err.message });
  }
}
