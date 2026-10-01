const url = require('url');
const { resolveAthleteDetails, setCorsHeaders } = require('./_shared');

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const slug = (parsedUrl.query.slug || '').trim();
  const name = parsedUrl.query.name || '';

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
