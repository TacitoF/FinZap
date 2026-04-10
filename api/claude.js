// api/claude.js — Vercel Serverless Function (CommonJS)

// ESSENCIAL: força o Vercel a parsear o body como JSON
module.exports.config = { api: { bodyParser: true } };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key nao configurada.' });

  try {
    let body = req.body;
    if (!body) return res.status(400).json({ error: 'Body vazio' });
    if (typeof body === 'string') body = JSON.parse(body);

    const system     = body.system;
    const messages   = body.messages;
    const model      = body.model      || 'claude-haiku-4-5-20251001';
    const max_tokens = body.max_tokens || 300;

    if (!messages) return res.status(400).json({ error: 'Campo messages ausente' });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || 'Erro na API Anthropic' });
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Excecao: ' + err.message });
  }
};