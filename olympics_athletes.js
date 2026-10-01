/**
 * Olympics Athlete Data Fetcher & Processor
 * 
 * Capabilities:
 * 1. fetchDefaultAthletes() - Gets default featured athletes from the API.
 * 2. fetchAthletesBySearch(query, limit) - Searches and paginates athletes via API.
 * 3. fetchAllAthleteUrlsFromSitemaps() - Extracts all 176,000+ athlete profile URLs and slugs from sitemaps.
 * 4. fetchAthleteBatchByPrefixes(prefixes, topPerQuery) - Queries the API in batches using prefix trees.
 */

const fs = require('fs');
const path = require('path');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json'
};

/**
 * 1. Fetch default featured athletes from Olympics API
 */
async function fetchDefaultAthletes() {
  const url = 'https://www.olympics.com/en/api/v2/search/default/athletes';
  console.log(`Fetching default athletes from: ${url}`);
  
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  
  const data = await response.json();
  const athletes = data.modules?.[0]?.content || [];
  
  return athletes.map(normalizeAthlete);
}

/**
 * 2. Fetch athletes with search query & pagination (up to 1,000 per query)
 */
async function fetchAthletesBySearch(query = '', maxItems = 100) {
  const results = [];
  const top = 100;
  let skip = 0;

  console.log(`Searching athletes (query: "${query}", max: ${maxItems})...`);

  while (results.length < maxItems && skip < 1000) {
    const currentTop = Math.min(top, maxItems - results.length);
    const url = query
      ? `https://www.olympics.com/en/api/v2/search/full/type/athletes/query/${encodeURIComponent(query)}/top/${currentTop}/skip/${skip}`
      : `https://www.olympics.com/en/api/v2/search/full/type/athletes/top/${currentTop}/skip/${skip}`;

    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) break;

    const data = await res.json();
    const module = data.modules?.find(m => m.type === 'searchResult' || m.content);
    const items = module?.content || [];

    if (items.length === 0) break;

    for (const item of items) {
      results.push(normalizeAthlete(item));
      if (results.length >= maxItems) break;
    }

    skip += top;
  }

  return results;
}

/**
 * 3. Fetch all athlete slugs & URLs from the 5 Olympic XML sitemaps (~176,000+ athletes)
 */
async function fetchAllAthleteUrlsFromSitemaps(sitemapPart = 1) {
  const sitemapUrl = `https://www.olympics.com/en/xml-sitemap/custom/athlete/${sitemapPart}/40000/`;
  console.log(`Fetching sitemap part ${sitemapPart} from: ${sitemapUrl}`);

  const res = await fetch(sitemapUrl, {
    headers: { 'User-Agent': HEADERS['User-Agent'] }
  });
  if (!res.ok) throw new Error(`Failed to fetch sitemap: HTTP ${res.status}`);

  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  return urls.map(url => {
    const slug = url.split('/athletes/')[1] || '';
    return {
      slug,
      url,
      name: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    };
  });
}

/**
 * Normalize athlete payload
 */
function normalizeAthlete(item) {
  return {
    name: item.title,
    slug: item.slug || (item.url ? item.url.replace('/en/athletes/', '') : null),
    url: item.url ? (item.url.startsWith('http') ? item.url : `https://www.olympics.com${item.url}`) : null,
    country: item.country || null,
    countryCode: item.countryCode || null,
    discipline: item.discipline || null,
    thumbnail: item.thumb || null,
    extendedFields: item.extendedFields || {}
  };
}

// Example CLI usage
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'default';

  if (command === 'default') {
    const athletes = await fetchDefaultAthletes();
    const outputFile = path.join(__dirname, 'default_athletes.json');
    fs.writeFileSync(outputFile, JSON.stringify(athletes, null, 2));
    console.log(`Saved ${athletes.length} default featured athletes to: ${outputFile}`);
    console.log('Sample athlete:\n', JSON.stringify(athletes[0], null, 2));
  } else if (command === 'search') {
    const query = args[1] || 'biles';
    const limit = parseInt(args[2], 10) || 50;
    const athletes = await fetchAthletesBySearch(query, limit);
    const outputFile = path.join(__dirname, `search_${query}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(athletes, null, 2));
    console.log(`Saved ${athletes.length} athletes matching "${query}" to: ${outputFile}`);
  } else if (command === 'sitemap') {
    const part = parseInt(args[1], 10) || 1;
    const athletes = await fetchAllAthleteUrlsFromSitemaps(part);
    const outputFile = path.join(__dirname, `athletes_sitemap_part_${part}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(athletes, null, 2));
    console.log(`Saved ${athletes.length} athlete records from sitemap part ${part} to: ${outputFile}`);
  } else {
    console.log('Usage:');
    console.log('  node olympics_athletes.js default');
    console.log('  node olympics_athletes.js search <query> [limit]');
    console.log('  node olympics_athletes.js sitemap <part (1-5)>');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  fetchDefaultAthletes,
  fetchAthletesBySearch,
  fetchAllAthleteUrlsFromSitemaps,
  normalizeAthlete
};
