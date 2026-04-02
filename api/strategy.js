// api/strategy.js — Vercel Serverless Function
// Recebe briefing + imagem de referência, chama Claude, retorna estratégia + copy

import Anthropic from '@anthropic-ai/sdk';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: { bodyParser: false }
};

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Parse multipart form
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const brand    = fields.brand?.[0]    || '';
    const segment  = fields.segment?.[0]  || '';
    const audience = fields.audience?.[0] || '';
    const tone     = fields.tone?.[0]     || '';
    const goal     = fields.goal?.[0]     || '';
    const theme    = fields.theme?.[0]    || '';

    // Read reference image as base64 (if provided)
    let imageContent = null;
    const refFile = files.refImage?.[0];
    if (refFile) {
      const imgData = fs.readFileSync(refFile.filepath);
      const base64  = imgData.toString('base64');
      const mime    = refFile.mimetype || 'image/jpeg';
      imageContent = { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };
    }

    const TONE_MAP = {
      profissional: 'profissional e confiável, linguagem formal mas acessível',
      divertido: 'divertido e descontraído, com leveza e emojis estratégicos',
      inspirador: 'inspirador e motivacional, com frases de impacto',
      urgente: 'urgente e direto, com call-to-action forte',
      luxo: 'sofisticado e exclusivo, linguagem premium, sem informalidades',
      tecnico: 'técnico e especialista, mostrando autoridade no assunto',
    };
    const GOAL_MAP = {
      vender: 'converter em venda direta, com gatilhos de urgência e benefício claro',
      engajar: 'gerar engajamento genuíno, comentários e salvamentos',
      informar: 'educar e informar de forma clara e memorável',
      lancamento: 'criar expectativa e desejo pelo lançamento',
      promocao: 'comunicar a promoção com senso de urgência',
      branding: 'fortalecer a marca e criar conexão emocional',
    };

    const userPrompt = `
Você é a VERA — especialista sênior em marketing digital, copywriting e estratégia de conteúdo para redes sociais.

BRIEFING DO CLIENTE:
- Marca: ${brand}
- Segmento: ${segment}
- Público-alvo: ${audience}
- Tom de voz: ${TONE_MAP[tone] || tone}
- Objetivo: ${GOAL_MAP[goal] || goal}
- Tema/Produto do post: ${theme}
${imageContent ? '- Imagem de referência visual fornecida. (usada para extrair cores e estilo)' : ''}

ENTREGUE obrigatoriamente um JSON válido com EXATAMENTE estas chaves (sem markdown, sem texto extra):

{
  "positioning": "1-2 frases sobre o posicionamento estratégico da marca para este post",
  "bestTime": "Melhor horário para postar (dia da semana + horário + justificativa breve)",
  "hashtags": "10 hashtags relevantes misturando populares e de nicho, separadas por espaço",
  "toneApplied": "Como o tom foi aplicado na copy (1 frase)",
  "tip": "1 dica estratégica extra para maximizar o alcance deste post",
  "copyFeed": "Headline principal do post feed (máx 12 palavras, impactante)\nSubtítulo ou complemento (1 linha)\nCall-to-action (1 linha curta)",
  "copyStories": "Headline para stories (mais curto, direto)\nTexto de apoio (1 linha)\nCTA stories (ex: 'Arrasta pra cima 👆')",
  "captionFeed": "Legenda completa para o feed (3-5 parágrafos, com emojis, hashtags no final, CTA claro)",
  "captionStories": "Legenda/texto de apoio para stories (curta, máx 3 linhas, tom direto)",
  "imagePrompt": "Prompt em inglês para gerador de imagem AI (Ideogram). Descreva: estilo visual, cores dominantes, composição, mood, elementos principais. Evite rostos. Foco em: atmosfera, textura, abstrato ou ambiente. Máx 200 palavras."
}

IMPORTANTE: 
- copyFeed e copyStories usam \\n para quebra de linha
- imagePrompt deve ser uma cena de fundo impactante, sem texto, sem logo, sem pessoas com rosto nítido
- Responda SOMENTE o JSON, sem nenhum texto antes ou depois
    `.trim();

    const messages = [];
    if (imageContent) {
      messages.push({ role: 'user', content: [imageContent, { type: 'text', text: userPrompt }] });
    } else {
      messages.push({ role: 'user', content: userPrompt });
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages,
    });

    const rawText = response.content.map(b => b.type === 'text' ? b.text : '').join('').trim();

    // Parse JSON — strip fences if present
    let parsed;
    try {
      const clean = rawText.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      console.error('JSON parse error:', rawText);
      return res.status(500).json({ error: 'Resposta inválida do Claude', raw: rawText });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Strategy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
