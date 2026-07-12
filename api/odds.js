// api/odds.js
// Função serverless do Vercel — roda no servidor, nunca no navegador.
// Mantém a chave ODDS_API_KEY escondida (configurada nas variáveis de ambiente do projeto no Vercel).
// Proxy para a The Odds API: https://the-odds-api.com

export default async function handler(req, res) {
  const { sport } = req.query;
  const apiKey = process.env.ODDS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "ODDS_API_KEY não configurada. Adicione essa variável de ambiente no painel do projeto no Vercel (Settings → Environment Variables) e faça um novo deploy.",
    });
  }
  if (!sport) {
    return res.status(400).json({ error: 'Parâmetro "sport" é obrigatório, ex: /api/odds?sport=soccer_brazil_campeonato' });
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sport)}/odds/?apiKey=${apiKey}&regions=eu,uk&markets=h2h&oddsFormat=decimal`;
    const upstream = await fetch(url);
    const remaining = upstream.headers.get("x-requests-remaining");
    const used = upstream.headers.get("x-requests-used");
    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data?.message || "Erro ao buscar odds na fonte." });
    }

    // cache curto na borda do Vercel: conserva sua cota mensal (plano free = 500 créditos/mês)
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    return res.status(200).json({ events: data, requestsRemaining: remaining, requestsUsed: used });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao contatar a API de odds." });
  }
}
