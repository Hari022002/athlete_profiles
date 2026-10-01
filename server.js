const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const {
  FEATURED_SLUGS,
  ensureAthletesLoaded,
  resolveAthleteDetails,
  setCorsHeaders,
  athleteCache
} = require('./api/_shared');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: Paginated 40,000 Athletes List
  if (pathname === '/api/athletes') {
    const allAthletes = await ensureAthletesLoaded();
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
          country: details?.country || 'International',
          countryCode: details?.countryCode || null,
          description: details?.description || ''
        };
      })
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      total,
      page,
      limit,
      totalPages,
      items
    }));
    return;
  }

  // API 2: Single Athlete Details by Slug
  if (pathname === '/api/athlete-details') {
    const slug = (parsedUrl.searchParams.get('slug') || '').trim();
    const name = parsedUrl.searchParams.get('name') || '';
    if (!slug) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing slug parameter' }));
      return;
    }

    const details = await resolveAthleteDetails(slug, name);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(details));
    return;
  }

  // API 3: Top Featured Champions
  if (pathname === '/api/featured') {
    const results = [];
    for (const slug of FEATURED_SLUGS) {
      let details = athleteCache.get(slug);
      if (!details) {
        details = await resolveAthleteDetails(slug, '');
      }
      if (details) results.push(details);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
    return;
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content, 'utf-8');
    }
  });
});

ensureAthletesLoaded().then(() => {
  server.listen(PORT, () => {
    console.log(`Olympics Athlete Showcase running at http://localhost:${PORT}`);
  });
});
