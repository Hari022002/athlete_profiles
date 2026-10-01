const fs = require('fs');
const path = require('path');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html'
};

// Popular & featured athlete slugs to ensure a rich immediate gallery
const CURATED_FEATURED_SLUGS = [
  'neeraj-chopra', 'simone-biles', 'jannik-sinner', 'teddy-riner', 'katie-ledecky',
  'long-ma', 'armand-duplantis', 'noah-lyles', 'sun-yingsha', 'zheng-qinwen',
  'carlos-alcaraz', 'leon-marchand', 'victor-wembanyama', 'stephen-curry', 'lebron-james',
  'rebeca-andrade', 'pan-zhanle', 'ariarne-titmus', 'summer-mcintosh', 'caeleb-dressel',
  'julien-alfred', 'femke-bol', 'sydney-mclaughlin-levrone', 'miltiadis-tentoglou', 'faith-kipyegon',
  'marcell-jacobs', 'shelly-ann-fraser-pryce', 'eliud-kipchoge', 'sifan-hassan', 'jakob-ingebrigtsen',
  'kevin-durant', 'nikola-jokic', 'shai-gilgeous-alexander', 'giannis-antetokounmpo', 'luka-doncic',
  'claresa-shields', 'oleksandr-usyk', 'imane-khelif', 'arshad-nadeem', 'manu-bhaker',
  'viktor-axelsen', 'an-se-young', 'carolina-marin', 'lee-zii-jia', 'muralitharan-thinaah',
  'yuto-horigome', 'rayssa-leal', 'cocona-hiraki', 'sky-brown', 'jaguar-nocturna',
  'tom-daley', 'quan-hongchan', 'chen-yuxi', 'jack-laugher', 'cassiel-rousseau',
  'mikaela-shiffrin', 'eileen-gu', 'yuzuru-hanyu', 'nathan-chen', 'chloe-kim',
  'johannes-thingnes-boe', 'federica-brignone', 'marco-odermatt', 'kamila-valieva', 'suzanne-schulting'
];

async function fetchAthleteProfile(slug, fallbackName) {
  try {
    const url = `https://www.olympics.com/en/athletes/${slug}`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      // Try search API fallback
      return await fetchFromSearchApi(slug, fallbackName);
    }
    const html = await res.text();
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || null;
    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || fallbackName;
    const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1] || '';
    
    // Clean up title
    const cleanName = ogTitle.split('|')[0].split('Biography')[0].split('Records')[0].trim() || fallbackName;

    // Try finding high quality image ID
    let highResImage = ogImage;
    if (ogImage && ogImage.includes('/primary/')) {
      const imgId = ogImage.split('/primary/')[1];
      highResImage = `https://img.olympics.com/images/image/private/t_1-1_600/f_auto/primary/${imgId}`;
    }

    // Try discovering discipline / country in text
    let country = null;
    let countryCode = null;
    let discipline = null;

    // Search common disciplines in description / title
    const disciplinesList = [
      'Athletics', 'Artistic Gymnastics', 'Swimming', 'Table Tennis', 'Tennis',
      'Basketball', 'Judo', 'Badminton', 'Boxing', 'Shooting', 'Archery',
      'Diving', 'Skateboarding', 'Weightlifting', 'Wrestling', 'Fencing',
      'Cycling Road', 'Cycling Track', 'Rowing', 'Alpine Skiing', 'Figure Skating',
      'Freestyle Skiing', 'Snowboard', 'Speed Skating', 'Biathlon', 'Golf'
    ];

    for (const d of disciplinesList) {
      if (html.toLowerCase().includes(d.toLowerCase()) || ogDesc.toLowerCase().includes(d.toLowerCase())) {
        discipline = d;
        break;
      }
    }

    return {
      slug,
      name: cleanName,
      image: highResImage || 'https://img.olympics.com/images/image/private/t_1-1_600/f_auto/primary/default_placeholder',
      thumbnail: ogImage || null,
      description: ogDesc,
      discipline: discipline || 'Olympic Sports',
      url: `https://www.olympics.com/en/athletes/${slug}`
    };
  } catch (err) {
    console.warn(`Error fetching ${slug}:`, err.message);
    return null;
  }
}

async function fetchFromSearchApi(slug, fallbackName) {
  try {
    const query = slug.replace(/-/g, ' ');
    const url = `https://www.olympics.com/en/api/v2/search/full/type/athletes/query/${encodeURIComponent(query)}/top/3/skip/0`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data.modules?.find(m => m.type === 'searchResult')?.content || [];
    if (items.length === 0) return null;

    const item = items.find(i => i.slug === slug) || items[0];
    let img = item.thumb ? item.thumb.replace('{formatInstructions}', 't_1-1_600/f_auto') : null;

    return {
      slug: item.slug || slug,
      name: item.title || fallbackName,
      image: img,
      thumbnail: item.thumb ? item.thumb.replace('{formatInstructions}', 't_social_share_thumb/f_auto') : null,
      country: item.country,
      countryCode: item.countryCode,
      discipline: item.discipline || 'Olympic Sports',
      url: item.url ? (item.url.startsWith('http') ? item.url : `https://www.olympics.com${item.url}`) : `https://www.olympics.com/en/athletes/${slug}`
    };
  } catch (e) {
    return null;
  }
}

async function buildAlbum() {
  console.log('Loading sitemap items...');
  const sitemapFile = path.join(__dirname, 'athletes_sitemap_part_1.json');
  let sitemapAthletes = [];
  if (fs.existsSync(sitemapFile)) {
    sitemapAthletes = JSON.parse(fs.readFileSync(sitemapFile, 'utf8'));
    console.log(`Loaded ${sitemapAthletes.length} sitemap records.`);
  }

  const sitemapMap = new Map();
  for (const item of sitemapAthletes) {
    sitemapMap.set(item.slug, item.name);
  }

  // Also include default athletes
  const defaultFile = path.join(__dirname, 'default_athletes.json');
  let defaultAthletes = [];
  if (fs.existsSync(defaultFile)) {
    defaultAthletes = JSON.parse(fs.readFileSync(defaultFile, 'utf8'));
  }

  console.log('Fetching curated athlete profiles with high-res photos...');
  const results = [];
  const seen = new Set();

  // First add default athletes
  for (const d of defaultAthletes) {
    if (!seen.has(d.slug)) {
      seen.add(d.slug);
      let highImg = d.thumbnail ? d.thumbnail.replace('{formatInstructions}', 't_1-1_600/f_auto') : null;
      results.push({
        slug: d.slug,
        name: d.name,
        image: highImg,
        thumbnail: d.thumbnail ? d.thumbnail.replace('{formatInstructions}', 't_social_share_thumb/f_auto') : null,
        country: d.country,
        countryCode: d.countryCode,
        discipline: d.discipline,
        url: d.url
      });
    }
  }

  // Now process curated athletes
  for (let i = 0; i < CURATED_FEATURED_SLUGS.length; i++) {
    const slug = CURATED_FEATURED_SLUGS[i];
    if (seen.has(slug)) continue;
    seen.add(slug);

    const fallbackName = sitemapMap.get(slug) || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    console.log(`[${i + 1}/${CURATED_FEATURED_SLUGS.length}] Fetching ${slug}...`);
    const profile = await fetchAthleteProfile(slug, fallbackName);
    if (profile && profile.image) {
      results.push(profile);
    }
    // Rate limit polite pause
    await new Promise(r => setTimeout(r, 120));
  }

  const outPath = path.join(__dirname, 'athletes_album_data.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Successfully generated album data with ${results.length} athletes to: ${outPath}`);
}

buildAlbum().catch(console.error);
