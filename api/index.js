const url = require('url');

const GITHUB_ATHLETE_URL = 'https://raw.githubusercontent.com/Hari022002/athlete_data/main/athlete.json';

// In-memory cache across serverless warm invocations
let allAthletes = [];
const athleteCache = new Map();

// Featured champions slugs
const FEATURED_SLUGS = [
  'neeraj-chopra', 'simone-biles', 'jannik-sinner', 'teddy-riner', 'katie-ledecky',
  'long-ma', 'armand-duplantis', 'noah-lyles', 'sun-yingsha', 'zheng-qinwen',
  'carlos-alcaraz', 'leon-marchand', 'victor-wembanyama', 'stephen-curry', 'lebron-james',
  'rebeca-andrade', 'pan-zhanle', 'caeleb-dressel', 'femke-bol', 'sydney-mclaughlin-levrone',
  'sukhee-shim', 'sara-conti', 'petr-gumennik'
];

async function ensureAthletesLoaded() {
  if (allAthletes.length > 0) return;
  try {
    const res = await fetch(GITHUB_ATHLETE_URL);
    if (res.ok) {
      allAthletes = await res.json();
    }
  } catch (err) {
    console.error('Failed loading athletes from GitHub:', err.message);
  }
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
    const timeoutId = setTimeout(() => controller.abort(), 2000);

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

// Vercel Serverless Function Entry Point
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  await ensureAthletesLoaded();

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname.replace(/^\/api/, '');

  // 1. GET /api/athletes
  if (pathname === '/athletes' || pathname === '') {
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

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      total,
      page,
      limit,
      totalPages,
      items
    }));
    return;
  }

  // 2. GET /api/athlete-details
  if (pathname === '/athlete-details') {
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
    return;
  }

  // 3. GET /api/featured
  if (pathname === '/featured') {
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
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
};
