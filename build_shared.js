const fs = require('fs');
const path = require('path');

const cache = JSON.parse(fs.readFileSync(path.join(__dirname, 'api', 'athlete_images_cache.json'), 'utf8'));

const code = `const GITHUB_ATHLETE_URL = 'https://raw.githubusercontent.com/Hari022002/athlete_data/main/athlete.json';

// Embedded 400+ verified high-resolution portraits & profile metadata
const EMBEDDED_CACHE = ${JSON.stringify(cache, null, 2)};

const athleteCache = new Map();
for (const item of EMBEDDED_CACHE) {
  if (item && item.slug) {
    athleteCache.set(item.slug, item);
  }
}

// 33 Top Champions
const FEATURED_SLUGS = [
  'neeraj-chopra', 'simone-biles', 'jannik-sinner', 'teddy-riner', 'katie-ledecky',
  'long-ma', 'armand-duplantis', 'noah-lyles', 'yingsha-sun', 'qinwen-zheng',
  'carlos-alcaraz', 'leon-marchand', 'victor-wembanyama', 'stephen-curry', 'lebron-james',
  'rebeca-andrade', 'zhanle-pan', 'caeleb-dressel', 'femke-bol', 'sydney-mclaughlin',
  'usain-bolt', 'coco-gauff', 'manu-bhaker', 'arshad-nadeem', 'novak-djokovic',
  'summer-mcintosh', 'rayssa-leal', 'yuto-horigome', 'eliud-kipchoge', 'tadej-pogacar',
  'sara-conti', 'julien-alfred', 'ariarne-titmus'
];

// Initialize allAthletes synchronously with verified photo champions first
let allAthletes = EMBEDDED_CACHE.filter(p => p.slug && p.image).map(p => ({
  slug: p.slug,
  name: p.name,
  url: p.url || ('https://www.olympics.com/en/athletes/' + p.slug)
}));
let fullDataMerged = false;

async function ensureAthletesLoaded() {
  if (fullDataMerged) return allAthletes;
  try {
    const res = await fetch(GITHUB_ATHLETE_URL);
    if (res.ok) {
      const raw = await res.json();
      const withPhotos = [];
      const others = [];
      const seen = new Set();

      for (const p of EMBEDDED_CACHE) {
        if (p.slug && p.image && !seen.has(p.slug)) {
          seen.add(p.slug);
          withPhotos.push({
            slug: p.slug,
            name: p.name,
            url: p.url || ('https://www.olympics.com/en/athletes/' + p.slug)
          });
        }
      }

      for (const ath of raw) {
        if (!seen.has(ath.slug)) {
          seen.add(ath.slug);
          others.push(ath);
        }
      }

      allAthletes = [...withPhotos, ...others];
      fullDataMerged = true;
    }
  } catch (err) {
    console.error('Failed loading athletes from GitHub:', err.message);
  }
  return allAthletes;
}

async function resolveAthleteDetails(slug, name) {
  if (athleteCache.has(slug)) {
    const cached = athleteCache.get(slug);
    if (cached && cached.image) {
      return cached;
    }
  }

  const cleanName = name || slug.replace(/-/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase());
  const profileUrl = 'https://www.olympics.com/en/athletes/' + slug;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      let athlete = null;
      const nextMatch = html.match(/<script id="__NEXT_DATA__" type="application\\/json">([\\s\\S]*?)<\\/script>/i) ||
                        html.match(/<script[^>]*>([\\s\\S]*?"displayName":[\\s\\S]*?)<\\/script>/i);
      if (nextMatch) {
        try {
          const parsed = JSON.parse(nextMatch[1]);
          athlete = parsed.props?.pageProps?.athlete || parsed.props?.pageProps?.initialProps?.content?.athlete;
        } catch (e) {}
      }

      const ogImage = html.match(/property="og:image"\\s+content="([^"]+)"/i)?.[1] ||
                      html.match(/content="([^"]+)"\\s+property="og:image"/i)?.[1] || null;
      const ogTitle = html.match(/property="og:title"\\s+content="([^"]+)"/i)?.[1] || cleanName;
      const ogDesc = html.match(/property="og:description"\\s+content="([^"]+)"/i)?.[1] || '';

      let imgTemplate = athlete?.imageUrl || athlete?.thumbnail?.urlTemplate || null;
      let highRes = null;
      let thumb = null;

      if (imgTemplate) {
        highRes = imgTemplate.replace('{formatInstructions}', 't_1-1_600/f_auto');
        thumb = imgTemplate.replace('{formatInstructions}', 't_social_share_thumb/f_auto');
      } else if (ogImage && ogImage.includes('/primary/')) {
        const id = ogImage.split('/primary/')[1];
        highRes = 'https://img.olympics.com/images/image/private/t_1-1_600/f_auto/primary/' + id;
        thumb = ogImage;
      }

      let country = athlete?.countryObject?.name || 
                    athlete?.olympicResults?.[0]?.noc?.longName ||
                    athlete?.tags?.find(t => t.extraData?.some(d => d.key === 'NOCCode' || d.key === 'TriLetter'))?.text ||
                    detectCountry(html, ogDesc);
      let countryCode = athlete?.countryObject?.triLetterCode || 
                        athlete?.olympicResults?.[0]?.noc?.code ||
                        null;
      let discipline = athlete?.disciplines?.[0]?.title || 
                       athlete?.discipline ||
                       detectDiscipline(html, ogDesc);

      const titleClean = athlete?.displayName || ogTitle.split('|')[0].split('Biography')[0].split('Records')[0].trim() || cleanName;

      const record = {
        slug,
        name: titleClean,
        image: highRes || null,
        thumbnail: thumb || ogImage || null,
        description: ogDesc || athlete?.metaDescription || 'Olympic athlete from the official Olympic Games database.',
        discipline: discipline || 'Olympic Sport',
        country: country || 'International',
        countryCode: countryCode || null,
        url: profileUrl
      };

      athleteCache.set(slug, record);
      return record;
    }
  } catch (err) {}

  // Fallback to Olympics Search API
  try {
    const searchRes = await fetch('https://www.olympics.com/en/api/v2/search/full/type/athletes/query/' + encodeURIComponent(slug.replace(/-/g, ' ')) + '/top/3/skip/0', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });
    if (searchRes.ok) {
      const data = await searchRes.json();
      const items = data.modules?.find(m => m.type === 'searchResult')?.content || [];
      const item = items.find(i => i.slug === slug) || items[0];
      if (item) {
        const img = item.thumb ? item.thumb.replace('{formatInstructions}', 't_1-1_600/f_auto') : null;
        const thumb = item.thumb ? item.thumb.replace('{formatInstructions}', 't_social_share_thumb/f_auto') : null;
        const searchRecord = {
          slug: item.slug || slug,
          name: item.title || cleanName,
          image: img,
          thumbnail: thumb,
          description: item.description || 'Olympic athlete profile.',
          discipline: item.discipline || 'Olympic Sport',
          country: item.country || 'International',
          countryCode: item.countryCode || null,
          url: profileUrl
        };
        athleteCache.set(slug, searchRecord);
        return searchRecord;
      }
    }
  } catch (e) {}

  const fallback = {
    slug,
    name: cleanName,
    image: null,
    thumbnail: null,
    description: 'Official athlete registered in the Olympic Games database.',
    discipline: 'Olympic Sport',
    country: 'International',
    countryCode: null,
    url: profileUrl
  };
  athleteCache.set(slug, fallback);
  return fallback;
}

function detectDiscipline(html, desc) {
  const list = [
    'Artistic Gymnastics', 'Swimming', 'Table Tennis', 'Tennis',
    'Basketball', 'Judo', 'Badminton', 'Boxing', 'Shooting', 'Archery',
    'Diving', 'Skateboarding', 'Weightlifting', 'Wrestling', 'Fencing',
    'Cycling Road', 'Cycling Track', 'Rowing', 'Alpine Skiing', 'Figure Skating',
    'Freestyle Skiing', 'Snowboard', 'Speed Skating', 'Biathlon', 'Golf',
    'Football', 'Volleyball', 'Handball', 'Water Polo', 'Triathlon', 'Taekwondo',
    'Canoe Sprint', 'Canoe Slalom', 'Sport Climbing', 'Surfing', 'Breaking', 'Athletics'
  ];
  const fullText = (html + ' ' + desc).toLowerCase();
  for (const d of list) {
    if (fullText.includes(d.toLowerCase())) return d;
  }
  return 'Olympic Sport';
}

function detectCountry(html, desc) {
  const countries = [
    { name: 'Spain', flag: '🇪🇸' },
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
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Norway', flag: '🇳🇴' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Kenya', flag: '🇰🇪' },
    { name: 'Jamaica', flag: '🇯🇲' },
    { name: 'Serbia', flag: '🇷🇸' },
    { name: 'Slovenia', flag: '🇸🇮' },
    { name: 'Saint Lucia', flag: '🇱🇨' },
    { name: 'Pakistan', flag: '🇵🇰' }
  ];
  const fullText = (html + ' ' + desc).toLowerCase();
  for (const c of countries) {
    if (fullText.includes(c.name.toLowerCase())) return c.name;
  }
  return 'International';
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
`;

fs.writeFileSync(path.join(__dirname, 'api', '_shared.js'), code, 'utf8');
console.log('Successfully re-compiled api/_shared.js with improved resolution & photo matching!');
