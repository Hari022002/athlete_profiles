const { resolveAthleteDetails, setCorsHeaders } = require('./_shared');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const slug = (parsedUrl.searchParams.get('slug') || '').trim();
  const name = parsedUrl.searchParams.get('name') || '';

  if (!slug) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Missing slug parameter' }));
    return;
  }

  const details = await resolveAthleteDetails(slug, name);
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(JSON.stringify(details));
};
