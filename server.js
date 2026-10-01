const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const CACHE_FILE = path.join(__dirname, 'athlete_images_cache.json');
const GITHUB_ATHLETE_URL = 'https://raw.githubusercontent.com/Hari022002/athlete_data/main/athlete.json';

// In-memory 40,000 athlete store
let allAthletes = [];
const athleteCache = new Map();

// 1. Load athletes: Try local file first, fallback to GitHub Raw URL automatically
async function loadAthleteData() {
  const localFiles = ['athlete.json', 'athletes_sitemap_part_1.json'];
  let loaded = false;

  let rawAthletes = [];
  for (const file of localFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      try {
        rawAthletes = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        console.log(`Loaded ${rawAthletes.length} athletes from local ${file}`);
        loaded = true;
        break;
      } catch (e) {}
    }
  }

  if (!loaded) {
    console.log(`Fetching 40,000 athletes directly from GitHub: ${GITHUB_ATHLETE_URL}...`);
    try {
      const res = await fetch(GITHUB_ATHLETE_URL);
      if (res.ok) {
        rawAthletes = await res.json();
        console.log(`Successfully loaded ${rawAthletes.length} athletes directly from GitHub!`);
      }
    } catch (err) {
      console.error('Failed to fetch from GitHub:', err.message);
    }
  }

  // Load disk image cache if present
  let diskCache = [];
  if (fs.existsSync(CACHE_FILE)) {
    try {
      diskCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      for (const item of diskCache) {
        if (item.slug) athleteCache.set(item.slug, item);
      }
    } catch (e) {}
  }

  // Prioritize photo-rich athletes first
  const withPhotos = [];
  const others = [];
  const seen = new Set();

  for (const p of diskCache) {
    if (p.slug && p.image && !seen.has(p.slug)) {
      seen.add(p.slug);
      withPhotos.push({
        slug: p.slug,
        name: p.name,
        url: p.url || `https://www.olympics.com/en/athletes/${p.slug}`
      });
    }
  }

  for (const ath of rawAthletes) {
    if (!seen.has(ath.slug)) {
      seen.add(ath.slug);
      others.push(ath);
    }
  }

  allAthletes = [...withPhotos, ...others];
}

// Save cache to disk periodically
let saveTimeout = null;
function persistCache() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const array = Array.from(athleteCache.values());
      fs.writeFileSync(CACHE_FILE, JSON.stringify(array), 'utf8');
    } catch (e) {}
  }, 1000);
}

// Resolve athlete profile details and image from Olympics.com
async function resolveAthleteDetails(slug, name) {
  if (athleteCache.has(slug)) {
    return athleteCache.get(slug);
  }

  const cleanName = name || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const profileUrl = `https://www.olympics.com/en/athletes/${slug}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(profileUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || null;
      const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || cleanName;
      const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';

      let highRes = ogImage;
      if (ogImage && ogImage.includes('/primary/')) {
        const id = ogImage.split('/primary/')[1];
        highRes = `https://img.olympics.com/images/image/private/t_1-1_600/f_auto/primary/${id}`;
      }

      const titleClean = ogTitle.split('|')[0].split('Biography')[0].split('Records')[0].trim() || cleanName;

      const record = {
        slug,
        name: titleClean,
        image: highRes || null,
        thumbnail: ogImage || null,
        description: ogDesc || 'Olympic athlete from the official Olympic Games sitemap.',
        discipline: detectDiscipline(html, ogDesc),
        country: detectCountry(html, ogDesc),
        url: profileUrl
      };

      athleteCache.set(slug, record);
      persistCache();
      return record;
    }
  } catch (err) {}

  const fallback = {
    slug,
    name: cleanName,
    image: null,
    thumbnail: null,
    description: 'Official athlete registered in the Olympic Games database.',
    discipline: 'Olympic Sport',
    country: 'International',
    url: profileUrl
  };
  athleteCache.set(slug, fallback);
  persistCache();
  return fallback;
}

function detectDiscipline(html, desc) {
  const list = [
    'Athletics', 'Artistic Gymnastics', 'Swimming', 'Table Tennis', 'Tennis',
    'Basketball', 'Judo', 'Badminton', 'Boxing', 'Shooting', 'Archery',
    'Diving', 'Skateboarding', 'Weightlifting', 'Wrestling', 'Fencing',
    'Cycling Road', 'Cycling Track', 'Rowing', 'Alpine Skiing', 'Figure Skating',
    'Freestyle Skiing', 'Snowboard', 'Speed Skating', 'Biathlon', 'Golf',
    'Football', 'Volleyball', 'Handball', 'Water Polo', 'Triathlon', 'Taekwondo',
    'Canoe Sprint', 'Canoe Slalom', 'Sport Climbing', 'Surfing', 'Breaking'
  ];
  const fullText = (html + ' ' + desc).toLowerCase();
  for (const d of list) {
    if (fullText.includes(d.toLowerCase())) return d;
  }
  return 'Olympic Sports';
}

function detectCountry(html, desc) {
  const countries = [
    { name: 'India', flag: '🇮🇳' },
    { name: 'United States', flag: '🇺🇸' },
    { name: 'China', flag: '🇨🇳' },
    { name: 'France', flag: '🇫🇷' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Japan', flag: '🇯🇵' },
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Great Britain', flag: '🇬🇧' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'Brazil', flag: '🇧🇷' },
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Korea', flag: '🇰🇷' },
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Norway', flag: '🇳🇴' },
    { name: 'Sweden', flag: '🇸🇪' }
  ];
  const fullText = (html + ' ' + desc).toLowerCase();
  for (const c of countries) {
    if (fullText.includes(c.name.toLowerCase())) return `${c.flag} ${c.name}`;
  }
  return '🌐 International';
}

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
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 1: Paginated 40,000 Athletes List
  if (pathname === '/api/athletes') {
    const q = (parsedUrl.query.q || '').trim().toLowerCase();
    const page = Math.max(parseInt(parsedUrl.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(parsedUrl.query.limit, 10) || 36, 1), 100);

    let filtered = allAthletes;
    if (q) {
      filtered = allAthletes.filter(ath => 
        ath.name.toLowerCase().includes(q) || ath.slug.toLowerCase().includes(q)
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
    const slug = (parsedUrl.query.slug || '').trim();
    const name = parsedUrl.query.name || '';
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
    const featuredSlugs = [
      'neeraj-chopra', 'simone-biles', 'jannik-sinner', 'teddy-riner', 'katie-ledecky',
      'long-ma', 'armand-duplantis', 'noah-lyles', 'sun-yingsha', 'zheng-qinwen',
      'carlos-alcaraz', 'leon-marchand', 'victor-wembanyama', 'stephen-curry', 'lebron-james',
      'rebeca-andrade', 'pan-zhanle', 'caeleb-dressel', 'femke-bol', 'sydney-mclaughlin-levrone',
      'sukhee-shim', 'sara-conti', 'petr-gumennik'
    ];

    const results = [];
    for (const slug of featuredSlugs) {
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

loadAthleteData().then(() => {
  server.listen(PORT, () => {
    console.log(`Olympics Athlete Showcase running at http://localhost:${PORT}`);
  });
});
