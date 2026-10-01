/**
 * Olympics Athlete Photo Showcase - Client Engine
 * Browses all 40,000+ athletes from the GitHub dataset with instant search and clean modal details.
 */

let currentPage = 1;
const pageSize = 36;
let currentSearchQuery = '';
let isFetching = false;
let hasMore = true;
let totalAthletesCount = 40000;

// Country Flag Mapping
const COUNTRY_FLAGS = {
  'USA': '🇺🇸', 'US': '🇺🇸', 'United States': '🇺🇸', 'America': '🇺🇸',
  'IND': '🇮🇳', 'IN': '🇮🇳', 'India': '🇮🇳',
  'CHN': '🇨🇳', 'CN': '🇨🇳', 'China': '🇨🇳',
  'FRA': '🇫🇷', 'FR': '🇫🇷', 'France': '🇫🇷',
  'ITA': '🇮🇹', 'IT': '🇮🇹', 'Italy': '🇮🇹',
  'JPN': '🇯🇵', 'JP': '🇯🇵', 'Japan': '🇯🇵',
  'GER': '🇩🇪', 'DE': '🇩🇪', 'Germany': '🇩🇪',
  'GBR': '🇬🇧', 'GB': '🇬🇧', 'UK': '🇬🇧', 'Great Britain': '🇬🇧',
  'AUS': '🇦🇺', 'AU': '🇦🇺', 'Australia': '🇦🇺',
  'BRA': '🇧🇷', 'BR': '🇧🇷', 'Brazil': '🇧🇷',
  'ESP': '🇪🇸', 'ES': '🇪🇸', 'Spain': '🇪🇸',
  'IDN': '🇮🇩', 'ID': '🇮🇩', 'Indonesia': '🇮🇩',
  'KOR': '🇰🇷', 'KR': '🇰🇷', 'Korea': '🇰🇷',
  'NOR': '🇳🇴', 'NO': '🇳🇴', 'Norway': '🇳🇴',
  'SWE': '🇸🇪', 'SE': '🇸🇪', 'Sweden': '🇸🇪',
  'RUS': '🇷🇺', 'RU': '🇷🇺', 'Russia': '🇷🇺',
  'CAN': '🇨🇦', 'CA': '🇨🇦', 'Canada': '🇨🇦',
  'SRI': '🇱🇰', 'LK': '🇱🇰', 'Sri Lanka': '🇱🇰',
  'JAM': '🇯🇲', 'JM': '🇯🇲', 'Jamaica': '🇯🇲',
  'KEN': '🇰🇪', 'KE': '🇰🇪', 'Kenya': '🇰🇪',
  'ETH': '🇪🇹', 'ET': '🇪🇹', 'Ethiopia': '🇪🇹',
  'SUI': '🇨🇭', 'CH': '🇨🇭', 'Switzerland': '🇨🇭',
  'NED': '🇳🇱', 'NL': '🇳🇱', 'Netherlands': '🇳🇱',
  'GRE': '🇬🇷', 'GR': '🇬🇷', 'Greece': '🇬🇷',
  'UKR': '🇺🇦', 'UA': '🇺🇦', 'Ukraine': '🇺🇦',
  'CUB': '🇨🇺', 'CU': '🇨🇺', 'Cuba': '🇨🇺',
  'MEX': '🇲🇽', 'MX': '🇲🇽', 'Mexico': '🇲🇽',
  'RSA': '🇿🇦', 'ZA': '🇿🇦', 'South Africa': '🇿🇦',
  'NZL': '🇳🇿', 'NZ': '🇳🇿', 'New Zealand': '🇳🇿',
  'BEL': '🇧🇪', 'BE': '🇧🇪', 'Belgium': '🇧🇪',
  'ARG': '🇦🇷', 'AR': '🇦🇷', 'Argentina': '🇦🇷'
};

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const searchSpinner = document.getElementById('searchSpinner');
const totalBadge = document.getElementById('totalBadge');
const featuredCarousel = document.getElementById('featuredCarousel');
const athleteGrid = document.getElementById('athleteGrid');
const gridLoading = document.getElementById('gridLoading');
const loadMoreWrapper = document.getElementById('loadMoreWrapper');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const emptyState = document.getElementById('emptyState');
const resetSearchBtn = document.getElementById('resetSearchBtn');
const resultsStats = document.getElementById('resultsStats');
const gridTitle = document.getElementById('gridTitle');
const gridSubtitle = document.getElementById('gridSubtitle');

// Modal Elements
const detailModal = document.getElementById('detailModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalHeroImg = document.getElementById('modalHeroImg');
const modalDisciplineBadge = document.getElementById('modalDisciplineBadge');
const modalAthleteName = document.getElementById('modalAthleteName');
const modalCountryFlag = document.getElementById('modalCountryFlag');
const modalCountryText = document.getElementById('modalCountryText');
const toast = document.getElementById('toast');

async function init() {
  setupSearch();
  setupModalListeners();
  setupPagination();
  await loadFeaturedAthletes();
  await loadAthletesPage(1, true);
}

// 1. Load Featured Champions
async function loadFeaturedAthletes() {
  try {
    const res = await fetch('/api/featured');
    if (!res.ok) return;
    const items = await res.json();
    featuredCarousel.innerHTML = '';

    items.forEach(ath => {
      const card = document.createElement('div');
      card.className = 'featured-card';
      const imgSrc = ath.image || ath.thumbnail || 'logo.png';
      const flag = getFlag(ath.countryCode || ath.country);

      card.innerHTML = `
        <img src="${imgSrc}" alt="${escapeHtml(ath.name)}" loading="lazy" class="${!ath.image ? 'contain-logo' : ''}" />
        <div class="card-gradient-overlay"></div>
        <div class="card-content">
          <h4 class="card-name">${escapeHtml(ath.name)} ${flag}</h4>
          <span class="card-discipline">${escapeHtml(ath.discipline || 'Olympic Champion')}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        openAthleteModal(ath);
      });

      featuredCarousel.appendChild(card);
    });
  } catch (err) {
    console.warn('Could not load featured:', err);
  }
}

// 2. Load Paginated 40,000 Athletes Grid
async function loadAthletesPage(page = 1, reset = false) {
  if (isFetching) return;
  isFetching = true;

  if (reset) {
    currentPage = 1;
    athleteGrid.innerHTML = '';
    hasMore = true;
    gridLoading.classList.remove('hidden');
    emptyState.classList.add('hidden');
  } else {
    loadMoreBtn.disabled = true;
    loadMoreBtn.querySelector('span').textContent = 'Loading...';
  }

  try {
    const url = `/api/athletes?page=${page}&limit=${pageSize}&q=${encodeURIComponent(currentSearchQuery)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('API request failed');
    const data = await res.json();

    totalAthletesCount = data.total;
    totalBadge.textContent = `${totalAthletesCount.toLocaleString()} Athletes`;

    if (reset && data.items.length === 0) {
      emptyState.classList.remove('hidden');
      loadMoreWrapper.classList.add('hidden');
      resultsStats.textContent = '0 records found';
      return;
    }

    // Render cards cleanly
    data.items.forEach(ath => {
      const card = createAthleteGridCard(ath);
      athleteGrid.appendChild(card);
    });

    const startNum = 1;
    const endNum = Math.min(page * pageSize, data.total);
    resultsStats.textContent = `Showing 1 - ${endNum.toLocaleString()} of ${data.total.toLocaleString()}`;

    // Update pagination state
    currentPage = page;
    hasMore = page < data.totalPages;
    loadMoreWrapper.classList.toggle('hidden', !hasMore);

    if (currentSearchQuery) {
      gridTitle.textContent = `Search Results for "${currentSearchQuery}"`;
      gridSubtitle.textContent = `Found ${data.total.toLocaleString()} matching athletes`;
    } else {
      gridTitle.textContent = 'All Athletes';
      gridSubtitle.textContent = 'Browsing complete 40,000+ Olympic archive';
    }
  } catch (err) {
    console.error('Error loading athletes:', err);
    showToast('Failed to load athletes.');
  } finally {
    isFetching = false;
    gridLoading.classList.add('hidden');
    loadMoreBtn.disabled = false;
    loadMoreBtn.querySelector('span').textContent = 'Load More Athletes';
  }
}

// 3. Create Athlete Card with Olympic Logo as Default/Fallback
function createAthleteGridCard(ath) {
  const card = document.createElement('div');
  card.className = 'grid-athlete-card';
  card.setAttribute('data-slug', ath.slug);

  const flag = getFlag(ath.countryCode || ath.country);
  const discipline = ath.discipline || 'Olympic Athlete';

  const mediaContainer = document.createElement('div');
  mediaContainer.className = 'grid-card-media';

  if (ath.image || ath.thumbnail) {
    const img = document.createElement('img');
    img.src = ath.image || ath.thumbnail;
    img.alt = ath.name;
    img.loading = 'lazy';
    
    img.onerror = () => {
      mediaContainer.innerHTML = '';
      mediaContainer.appendChild(createOlympicLogoFallbackNode());
    };
    mediaContainer.appendChild(img);
  } else {
    mediaContainer.appendChild(createOlympicLogoFallbackNode());
  }

  const body = document.createElement('div');
  body.className = 'grid-card-body';
  body.innerHTML = `
    <h3 class="grid-card-name">${escapeHtml(ath.name)}</h3>
    <div class="grid-card-sub">
      <span class="country-flag-icon-small">${flag}</span>
      <span>${escapeHtml(discipline)}</span>
    </div>
    <div class="view-action-hint">
      <span>View Details</span>
      <span>↗</span>
    </div>
  `;

  card.appendChild(mediaContainer);
  card.appendChild(body);

  card.addEventListener('click', async () => {
    if (ath.image) {
      openAthleteModal(ath);
    } else {
      showToast(`Loading profile for ${ath.name}...`);
      try {
        const res = await fetch(`/api/athlete-details?slug=${encodeURIComponent(ath.slug)}&name=${encodeURIComponent(ath.name)}`);
        if (res.ok) {
          const details = await res.json();
          openAthleteModal(details);
        } else {
          openAthleteModal(ath);
        }
      } catch (e) {
        openAthleteModal(ath);
      }
    }
  });

  return card;
}

// Olympic Logo fallback container for cards without a headshot
function createOlympicLogoFallbackNode() {
  const wrap = document.createElement('div');
  wrap.className = 'olympic-logo-card-fallback';
  wrap.innerHTML = `
    <img src="logo.png" alt="Olympic Logo" class="fallback-logo-img" />
  `;
  return wrap;
}

// 4. Open Athlete Details Modal (Shows full image or Olympic logo fallback)
function openAthleteModal(ath) {
  const imgSrc = ath.image || ath.thumbnail || 'logo.png';
  modalHeroImg.src = imgSrc;
  
  if (!ath.image && !ath.thumbnail) {
    modalHeroImg.classList.add('modal-fallback-logo');
  } else {
    modalHeroImg.classList.remove('modal-fallback-logo');
  }

  modalAthleteName.textContent = ath.name;
  modalDisciplineBadge.textContent = ath.discipline || 'Olympic Athlete';

  const flag = getFlag(ath.countryCode || ath.country);
  modalCountryFlag.textContent = flag;
  
  let countryClean = ath.country || ath.countryCode || 'International';
  countryClean = countryClean.replace(/^[A-Z]{2,3}\s+/i, '').replace(/^[^\w\s]+\s*/, '');
  modalCountryText.textContent = countryClean || 'Olympic Competitor';

  detailModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAthleteModal() {
  detailModal.classList.add('hidden');
  document.body.style.overflow = '';
}

// 5. Search Logic across 40,000 Athletes
function setupSearch() {
  let debounceTimer = null;

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearSearchBtn.classList.toggle('hidden', !val);

    clearTimeout(debounceTimer);
    searchSpinner.classList.remove('hidden');

    debounceTimer = setTimeout(() => {
      currentSearchQuery = val;
      searchSpinner.classList.add('hidden');
      loadAthletesPage(1, true);
    }, 280);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    clearSearchBtn.classList.add('hidden');
    loadAthletesPage(1, true);
    searchInput.focus();
  });

  resetSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    clearSearchBtn.classList.add('hidden');
    loadAthletesPage(1, true);
  });
}

// 6. Pagination & Modal Listeners
function setupPagination() {
  loadMoreBtn.addEventListener('click', () => {
    if (hasMore && !isFetching) {
      loadAthletesPage(currentPage + 1, false);
    }
  });

  // Infinite scroll trigger
  window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
      if (hasMore && !isFetching && !currentSearchQuery) {
        loadAthletesPage(currentPage + 1, false);
      }
    }
  });
}

function setupModalListeners() {
  closeModalBtn.addEventListener('click', closeAthleteModal);
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeAthleteModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !detailModal.classList.contains('hidden')) {
      closeAthleteModal();
    }
  });
}

function getFlag(countryStr) {
  if (!countryStr) return '🏅';
  const clean = countryStr.trim();
  
  // Exact match
  if (COUNTRY_FLAGS[clean]) return COUNTRY_FLAGS[clean];

  // Substring match
  for (const [key, flag] of Object.entries(COUNTRY_FLAGS)) {
    if (clean.toLowerCase().includes(key.toLowerCase())) return flag;
  }
  return '🏅';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', init);
