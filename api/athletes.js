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

    // If local dataset has no matches, query the live Olympics database search API
    if (filtered.length === 0) {
      try {
        const searchUrl = `https://www.olympics.com/en/api/v2/search/full/type/athletes/query/${encodeURIComponent(q)}/top/${limit}/skip/${(page - 1) * limit}`;
        const searchRes = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        });
        if (searchRes.ok) {
          const data = await searchRes.json();
          const items = data.modules?.find(m => m.type === 'searchResult')?.content || [];
          const totalCount = parseInt(data.modules?.find(m => m.type === 'searchResultCount')?.content?.count, 10) || items.length;

          const mappedItems = items.map(item => {
            const rawImg = item.thumb || null;
            const highImg = rawImg ? rawImg.replace('{formatInstructions}', 't_1-1_600/f_auto') : null;
            const thumbImg = rawImg ? rawImg.replace('{formatInstructions}', 't_social_share_thumb/f_auto') : null;
            const slug = item.slug || (item.url ? item.url.replace('/en/athletes/', '') : q.replace(/\s+/g, '-'));

            const record = {
              slug,
              name: item.title || item.name || slug,
              url: item.url ? (item.url.startsWith('http') ? item.url : `https://www.olympics.com${item.url}`) : `https://www.olympics.com/en/athletes/${slug}`,
              image: highImg,
              thumbnail: thumbImg,
              discipline: item.discipline || 'Olympic Athlete',
              country: item.country || 'International',
              countryCode: item.countryCode || null,
              description: item.description || ''
            };

            if (highImg) {
              athleteCache.set(slug, record);
            }
            return record;
          });

          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({
            total: totalCount,
            page,
            limit,
            totalPages: Math.ceil(totalCount / limit) || 1,
            items: mappedItems
          }));
          return;
        }
      } catch (err) {
        console.error('Error fetching live search results:', err.message);
      }
    }
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const start = (page - 1) * limit;
  const rawItems = filtered.slice(start, start + limit);

  const items = await Promise.all(
    rawItems.map(async (item) => {
      let details = athleteCache.get(item.slug);
      if (!details || !details.image) {
        details = await resolveAthleteDetails(item.slug, item.name);
      }
      return {
        slug: item.slug,
        name: details?.name || item.name,
        url: item.url,
        image: details?.image || details?.thumbnail || null,
        thumbnail: details?.thumbnail || null,
        discipline: details?.discipline || 'Olympic Athlete',
        country: details?.country || 'International',
        countryCode: details?.countryCode || null,
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
