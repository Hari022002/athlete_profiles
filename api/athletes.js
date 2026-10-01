const { ensureAthletesLoaded, resolveAthleteDetails, setCorsHeaders, athleteCache } = require('./_shared');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const allAthletes = await ensureAthletesLoaded();
  const parsedUrl = new URL(req.url, 'http://localhost');
  const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
  const page = Math.max(parseInt(parsedUrl.searchParams.get('page'), 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(parsedUrl.searchParams.get('limit'), 10) || 36, 1), 100);

  let filtered = allAthletes;
  if (q) {
    filtered = allAthletes.filter(ath => 
      (ath.name && ath.name.toLowerCase().includes(q)) || 
      (ath.slug && ath.slug.toLowerCase().includes(q))
    );
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const rawItems = filtered.slice(start, start + limit);

  const items = await Promise.all(
    rawItems.map(async (item) => {
      let details = athleteCache.get(item.slug);
      if (!details) {
        details = await resolveAthleteDetails(item.slug, item.name);
      }
      return {
        slug: item.slug,
        name: details?.name || item.name,
        url: item.url,
        image: details?.image || details?.thumbnail || null,
        thumbnail: details?.thumbnail || null,
        discipline: details?.discipline || 'Olympic Athlete',
        country: details?.country || '🌐 International',
        description: details?.description || ''
      };
    })
  );

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify({
    total,
    page,
    limit,
    totalPages,
    items
  }));
};
