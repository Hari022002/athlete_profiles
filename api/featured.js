const { FEATURED_SLUGS, resolveAthleteDetails, setCorsHeaders, athleteCache } = require('./_shared');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const results = [];
  for (const slug of FEATURED_SLUGS) {
    let details = athleteCache.get(slug);
    if (!details) {
      details = await resolveAthleteDetails(slug, '');
    }
    if (details) results.push(details);
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify(results));
};
