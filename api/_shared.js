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
  if (allAthletes.length > 0) return allAthletes;
  try {
    const res = await fetch(GITHUB_ATHLETE_URL);
    if (res.ok) {
      allAthletes = await res.json();
    }
  } catch (err) {
    console.error('Failed loading athletes from GitHub:', err.message);
  }
  return allAthletes;
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
    country: '🌐 International',
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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = {
  FEATURED_SLUGS,
  ensureAthletesLoaded,
  resolveAthleteDetails,
  setCorsHeaders,
  athleteCache
};
