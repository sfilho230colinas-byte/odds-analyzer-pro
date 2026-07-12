// api/stats.js
// Função serverless do Vercel — roda no servidor, nunca no navegador.
// Mantém a chave FOOTBALL_DATA_API_KEY escondida (configurada nas variáveis de ambiente do projeto no Vercel).
// Proxy para a football-data.org: https://www.football-data.org

export default async function handler(req, res) {
  const { action } = req.query;
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "FOOTBALL_DATA_API_KEY não configurada. Adicione essa variável de ambiente no painel do projeto no Vercel (Settings → Environment Variables) e faça um novo deploy.",
    });
  }

  try {
    if (action === "teams") {
      const { comp } = req.query;
      if (!comp) return res.status(400).json({ error: 'Parâmetro "comp" é obrigatório, ex: /api/stats?action=teams&comp=BSA' });

      const r = await fetch(`https://api.football-data.org/v4/competitions/${encodeURIComponent(comp)}/teams`, {
        headers: { "X-Auth-Token": apiKey },
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.message || "Erro ao buscar times." });

      const teams = (data.teams || [])
        .map((t) => ({ id: t.id, name: t.shortName || t.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
      return res.status(200).json({ teams });
    }

    if (action === "team-form") {
      const { teamId, matches: matchCountRaw } = req.query;
      if (!teamId) return res.status(400).json({ error: 'Parâmetro "teamId" é obrigatório.' });
      const n = Math.min(parseInt(matchCountRaw, 10) || 6, 15);

      const r = await fetch(`https://api.football-data.org/v4/teams/${encodeURIComponent(teamId)}/matches?status=FINISHED&limit=${n + 5}`, {
        headers: { "X-Auth-Token": apiKey },
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: data?.message || "Erro ao buscar jogos do time." });

      const sorted = (data.matches || []).slice().sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));
      const list = sorted.slice(0, n);

      let scored = 0, conceded = 0, used = 0;
      const detail = [];
      list.forEach((m) => {
        const isHome = m.homeTeam?.id === Number(teamId);
        const gf = isHome ? m.score?.fullTime?.home : m.score?.fullTime?.away;
        const ga = isHome ? m.score?.fullTime?.away : m.score?.fullTime?.home;
        if (gf === null || gf === undefined || ga === null || ga === undefined) return;
        scored += gf;
        conceded += ga;
        used++;
        detail.push({
          date: m.utcDate,
          opponent: isHome ? (m.awayTeam?.shortName || m.awayTeam?.name) : (m.homeTeam?.shortName || m.homeTeam?.name),
          venue: isHome ? "casa" : "fora",
          gf,
          ga,
        });
      });

      res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
      return res.status(200).json({
        matchesUsed: used,
        avgScored: used ? +(scored / used).toFixed(2) : null,
        avgConceded: used ? +(conceded / used).toFixed(2) : null,
        detail,
      });
    }

    return res.status(400).json({ error: 'Parâmetro "action" inválido. Use "teams" ou "team-form".' });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao contatar a API de estatísticas." });
  }
}
