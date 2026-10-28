/* COSMOS — CSE 2004 Website #2
   APIs: NASA APOD + Open-Meteo Forecast + Open-Meteo Geocoding
         + browser Geolocation + browser Web Storage.
   Built with ordinary browser JavaScript; no build tools or API keys. */
(() => {
  'use strict';

  const APOD_BASE = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
  const WEATHER_BASE = 'https://api.open-meteo.com/v1/forecast';
  const GEO_BASE = 'https://geocoding-api.open-meteo.com/v1/search';
  const STORAGE_KEY = 'cosmos.saved.apod.v2';
  const FIRST_APOD = '1995-06-16';
  const $ = (selector) => document.querySelector(selector);
  const state = { apod: null, saved: [], latestDate: null, viewDate: null, requestId: 0 };
  const abortAfter = 15000;

  async function getJSON(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), abortAfter);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 404 ? 'No record is available for this date.' : `The service returned HTTP ${response.status}.`);
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The request took too long. Please try again.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function dateOffset(iso, days) {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function apodId(iso) { return iso.slice(2).replaceAll('-', ''); }
  function fullDate(iso) {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }
  function shortDate(iso) {
    return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function stripHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = String(html || '');
    return (div.textContent || '').replace(/^\s*Explanation:\s*/i, '').trim();
  }
  function setText(selector, value) { $(selector).textContent = value; }
  function safeUrl(raw) {
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  }
  function imageFor(item) { return safeUrl(item?.hdurl) || (item?.media_type === 'image' ? safeUrl(item?.url) : ''); }
  function savedHas(date) { return state.saved.some(item => item.date === date); }

  function loadSaved() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      state.saved = Array.isArray(parsed) ? parsed.filter(item => item && typeof item.date === 'string' && typeof item.title === 'string').slice(0, 80) : [];
    } catch { state.saved = []; }
    renderCollection();
  }
  function persistSaved() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.saved));
      return true;
    } catch {
      $('#apodStatus').textContent = 'Storage is unavailable in this browser. Your selection will last until this page closes.';
      return false;
    }
  }
  function updateSaveButton() {
    const item = state.apod;
    $('#saveApod').disabled = !item;
    const saved = item && savedHas(item.date);
    setText('#saveIcon', saved ? '♥' : '♡');
    setText('#saveLabel', saved ? 'Saved to collection' : 'Save discovery');
    $('#saveApod').setAttribute('aria-pressed', String(Boolean(saved)));
  }
  function toggleSaved() {
    if (!state.apod) return;
    const item = state.apod;
    if (savedHas(item.date)) {
      state.saved = state.saved.filter(saved => saved.date !== item.date);
      $('#apodStatus').textContent = 'Removed from your collection.';
    } else {
      state.saved.unshift({ date: item.date, title: item.title, hdurl: imageFor(item), media_type: item.media_type });
      $('#apodStatus').textContent = 'Saved. You can revisit this discovery below.';
    }
    persistSaved();
    updateSaveButton();
    renderCollection();
  }

  function renderCollection() {
    setText('#navCount', String(state.saved.length));
    setText('#collectionCount', String(state.saved.length).padStart(2, '0'));
    const grid = $('#collectionGrid');
    grid.replaceChildren();
    $('#clearCollection').hidden = state.saved.length === 0;
    if (!state.saved.length) {
      const empty = document.createElement('div');
      empty.className = 'collection-empty';
      empty.innerHTML = '<span class="empty-symbol" aria-hidden="true">✦</span><h3>Your archive begins with wonder.</h3><p>Save a NASA discovery above to make this space your own.</p><a href="#discovery">Explore today’s picture ↗</a>';
      grid.append(empty);
      return;
    }
    state.saved.forEach(item => {
      const card = document.createElement('article');
      card.className = 'collection-card';
      const visual = document.createElement('a');
      visual.className = 'card-image';
      visual.href = '#discovery';
      visual.setAttribute('aria-label', `Open ${item.title}`);
      if (item.hdurl) {
        const img = document.createElement('img');
        img.src = safeUrl(item.hdurl); img.alt = item.title; img.loading = 'lazy';
        img.onerror = () => { img.remove(); };
        visual.append(img);
      }
      visual.addEventListener('click', () => loadApod(item.date));
      const content = document.createElement('div');
      content.className = 'card-content';
      const date = document.createElement('span'); date.className = 'card-date'; date.textContent = shortDate(item.date).toUpperCase();
      const title = document.createElement('h3'); title.textContent = item.title;
      const actions = document.createElement('div'); actions.className = 'card-actions';
      const open = document.createElement('button'); open.type = 'button'; open.className = 'open-card'; open.textContent = 'Revisit ↗';
      open.addEventListener('click', () => { loadApod(item.date); $('#discovery').scrollIntoView({ behavior: 'smooth' }); });
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove ×'; remove.setAttribute('aria-label', `Remove ${item.title} from collection`);
      remove.addEventListener('click', () => {
        state.saved = state.saved.filter(saved => saved.date !== item.date);
        persistSaved(); renderCollection(); updateSaveButton();
      });
      actions.append(open, remove); content.append(date, title, actions); card.append(visual, content); grid.append(card);
    });
  }

  function renderApod(item) {
    state.apod = item;
    state.viewDate = item.date;
    $('#apodError').hidden = true;
    $('#apodLoading').hidden = true;
    const image = $('#apodImage');
    image.hidden = true;
    image.removeAttribute('src');
    const imageURL = imageFor(item);
    if (imageURL) {
      image.alt = item.alt || `Astronomy picture: ${item.title}`;
      image.src = imageURL;
      image.hidden = false;
      image.onerror = () => { image.hidden = true; $('#apodVisual').style.background = 'radial-gradient(circle at 55% 45%,#283c50,#080b13 80%)'; $('#apodStatus').textContent = 'NASA’s image could not load. You can still open the original source.'; };
    }
    const source = safeUrl(item.permalink) || (item.url?.includes('science.nasa.gov') ? safeUrl(item.url) : '') || 'https://science.nasa.gov/';
    const videoLink = $('#apodMediaLink');
    videoLink.hidden = item.media_type === 'image';
    videoLink.href = source;
    videoLink.firstChild.textContent = item.media_type === 'image' ? 'Explore on NASA ' : 'Watch / read on NASA ';
    $('#apodSource').href = source;
    setText('#apodDateLabel', fullDate(item.date).toUpperCase());
    setText('#apodTitle', item.title || 'Untitled cosmic discovery');
    const credit = stripHTML(item.credit || item.copyright).replace(/^credit\s*&\s*copyright\s*:?/i, '').trim();
    setText('#apodCredit', credit ? `Image credit: ${credit}` : 'Image: NASA Astronomy Picture of the Day');
    setText('#apodSerial', item.date.replaceAll('-', '.'));
    const description = stripHTML(item.explanation) || 'Explore the full story on NASA.';
    setText('#apodDescription', description);
    $('#apodDescription').classList.remove('expanded');
    $('#descriptionToggle').hidden = description.length < 270;
    setText('#descriptionToggle', 'Read full story ↗');
    $('#apodDate').value = item.date;
    if (!state.latestDate || item.date > state.latestDate) state.latestDate = item.date;
    $('#apodDate').max = state.latestDate;
    $('#prevDay').disabled = item.date <= FIRST_APOD;
    $('#nextDay').disabled = item.date >= state.latestDate;
    updateSaveButton();
    $('#apodStatus').textContent = '';
  }

  async function loadApod(date = null) {
    const requestId = ++state.requestId;
    state.viewDate = date;
    state.apod = null;
    $('#saveApod').disabled = true;
    $('#prevDay').disabled = true; $('#nextDay').disabled = true;
    $('#apodError').hidden = true;
    $('#apodLoading').hidden = false;
    $('#apodImage').hidden = true;
    $('#apodMediaLink').hidden = true;
    $('#apodStatus').textContent = '';
    const url = date ? `${APOD_BASE}/${apodId(date)}` : APOD_BASE;
    try {
      let payload = await getJSON(url);
      if (requestId !== state.requestId) return;
      const item = Array.isArray(payload) ? payload[0] : payload;
      if (!item || !item.date || (date && item.date !== date)) throw new Error('NASA did not return the requested date.');
      renderApod(item);
    } catch (error) {
      if (requestId !== state.requestId) return;
      $('#apodLoading').hidden = true;
      $('#apodError').hidden = false;
      $('#apodError').textContent = `${error.message} Try another date or reload the page.`;
      $('#apodDate').max = state.latestDate || new Date().toISOString().slice(0, 10);
      $('#prevDay').disabled = !date || date <= FIRST_APOD;
      $('#nextDay').disabled = !date || !state.latestDate || date >= state.latestDate;
    }
  }

  /* Tonight's sky — estimates based on local 8–11 PM hourly weather. */
  function condition(code) {
    if (code === 0) return 'Clear sky';
    if (code <= 3) return 'Partly cloudy';
    if (code === 45 || code === 48) return 'Fog';
    if (code >= 51 && code <= 67) return 'Rain / drizzle';
    if (code >= 71 && code <= 77) return 'Snow';
    if (code >= 80 && code <= 82) return 'Showers';
    if (code >= 85 && code <= 86) return 'Snow showers';
    if (code >= 95) return 'Thunderstorms';
    return 'Variable weather';
  }
  function adverse(code) {
    return code === 45 || code === 48 || (code >= 51 && code <= 99);
  }
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

  function renderWeather(payload, place) {
    const hourly = payload.hourly;
    if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.cloud_cover) || !Array.isArray(hourly.temperature_2m) || !Array.isArray(hourly.weather_code)) {
      throw new Error('Weather information is incomplete. Try again shortly.');
    }
    const now = payload.current?.time || hourly.time[0];
    let day = now.slice(0, 10);
    const hour = Number(now.slice(11, 13));
    // After the last viewing hour, show tomorrow night's forecast instead.
    if (hour >= 23) day = dateOffset(day, 1);
    let hours = hourly.time.map((time, index) => ({ time, index })).filter(entry => entry.time.startsWith(day) && Number(entry.time.slice(11, 13)) >= Math.max(20, day === now.slice(0, 10) ? hour : 20) && Number(entry.time.slice(11, 13)) <= 23);
    if (!hours.length) hours = hourly.time.map((time, index) => ({ time, index })).filter(entry => entry.time.startsWith(day) && Number(entry.time.slice(11, 13)) >= 20 && Number(entry.time.slice(11, 13)) <= 23);
    if (!hours.length) throw new Error('The evening forecast is unavailable for this location.');
    const samples = hours.map(entry => ({
      label: entry.time.slice(11, 16),
      cloud: Number(hourly.cloud_cover[entry.index]),
      temp: Number(hourly.temperature_2m[entry.index]),
      code: Number(hourly.weather_code[entry.index]),
    })).filter(item => [item.cloud, item.temp, item.code].every(Number.isFinite));
    if (!samples.length) throw new Error('The hourly forecast is missing weather readings.');
    const cloud = Math.round(average(samples.map(item => item.cloud)));
    const temp = Math.round(average(samples.map(item => item.temp)));
    const bad = samples.some(item => adverse(item.code));
    const worstCode = samples.find(item => adverse(item.code))?.code ?? samples[0].code;
    const verdict = bad ? 'Poor' : cloud <= 15 ? 'Excellent' : cloud <= 45 ? 'Good' : 'Poor';
    const reason = bad ? `The forecast includes ${condition(worstCode).toLowerCase()}. Consider waiting for a clearer night.`
      : cloud <= 15 ? 'Very little cloud is expected — a promising evening to head outside.'
        : cloud <= 45 ? 'Some clouds are expected, but there may be clear patches worth catching.'
          : 'Cloud cover may obscure much of the night sky. Another evening may be better.';
    setText('#forecastPlace', place);
    setText('#forecastPeriod', `${shortDate(day)} · ${samples[0].label}–${samples.at(-1).label} local time`);
    setText('#forecastVerdict', verdict);
    $('#forecastVerdict').style.color = verdict === 'Excellent' ? '#c9f2d9' : verdict === 'Good' ? '#efe3b8' : '#edb9a8';
    setText('#forecastReason', reason);
    setText('#cloudStat', `${cloud}%`);
    setText('#tempStat', `${temp}°C`);
    setText('#conditionStat', condition(worstCode));
    setText('#hourlyRange', `${samples[0].label}–${samples.at(-1).label}`);
    const chart = $('#hourlyChart'); chart.replaceChildren();
    samples.forEach(({ label, cloud: cover }) => {
      const cell = document.createElement('div'); cell.className = 'hourly-cell';
      const time = document.createElement('strong'); time.textContent = label;
      const track = document.createElement('div'); track.className = 'hourly-track';
      const bar = document.createElement('i'); bar.style.width = `${Math.max(0, Math.min(100, cover))}%`; track.append(bar);
      const text = document.createElement('span'); text.textContent = `${Math.round(cover)}% clouds`;
      cell.append(time, track, text); chart.append(cell);
    });
    setText('#skyFeedback', `Showing a real forecast for ${place}.`);
    $('#skyFeedback').classList.remove('error');
  }

  let weatherRequestId = 0;
  async function getSky(lat, lon, place) {
    const id = ++weatherRequestId;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setText('#skyFeedback', 'Reading the forecast for your sky...');
    $('#skyFeedback').classList.remove('error');
    $('#locateButton').disabled = true;
    try {
      const params = new URLSearchParams({
        latitude: String(lat), longitude: String(lon),
        current: 'temperature_2m,cloud_cover,weather_code',
        hourly: 'cloud_cover,weather_code,temperature_2m',
        timezone: 'auto', forecast_days: '3',
      });
      const data = await getJSON(`${WEATHER_BASE}?${params}`);
      if (id === weatherRequestId) renderWeather(data, place);
    } catch (error) {
      if (id === weatherRequestId) {
        setText('#skyFeedback', `Couldn't load this forecast: ${error.message}`);
        $('#skyFeedback').classList.add('error');
      }
    } finally {
      $('#locateButton').disabled = false;
    }
  }
  async function searchCity(event) {
    event.preventDefault();
    const name = $('#cityInput').value.trim();
    if (!name) { setText('#skyFeedback', 'Please enter a city name.'); return; }
    setText('#skyFeedback', `Searching for ${name}...`);
    $('#skyFeedback').classList.remove('error');
    const button = $('#cityForm button'); button.disabled = true;
    try {
      const params = new URLSearchParams({ name, count: '1', language: 'en', format: 'json' });
      const data = await getJSON(`${GEO_BASE}?${params}`);
      const place = data?.results?.[0];
      if (!place) throw new Error('City not found. Try a nearby major city.');
      await getSky(place.latitude, place.longitude, [place.name, place.admin1, place.country].filter(Boolean).join(', '));
    } catch (error) {
      setText('#skyFeedback', error.message);
      $('#skyFeedback').classList.add('error');
    } finally { button.disabled = false; }
  }
  function locate() {
    if (!navigator.geolocation) {
      setText('#skyFeedback', 'Your browser does not support location. Search for a city instead.');
      return;
    }
    setText('#skyFeedback', 'Asking your browser for location permission...');
    $('#skyFeedback').classList.remove('error');
    navigator.geolocation.getCurrentPosition(
      position => getSky(position.coords.latitude, position.coords.longitude, 'Your current location'),
      () => { setText('#skyFeedback', 'Location unavailable or permission denied. You can search for a city instead.'); $('#skyFeedback').classList.add('error'); },
      { enableHighAccuracy: false, timeout: 11000, maximumAge: 600000 }
    );
  }

  function init() {
    $('#saveApod').addEventListener('click', toggleSaved);
    $('#prevDay').addEventListener('click', () => { if (state.apod || state.viewDate) loadApod(dateOffset(state.apod?.date || state.viewDate, -1)); });
    $('#nextDay').addEventListener('click', () => { if (state.apod || state.viewDate) loadApod(dateOffset(state.apod?.date || state.viewDate, 1)); });
    $('#apodDate').max = new Date().toISOString().slice(0, 10);
    $('#apodDate').addEventListener('change', event => {
      const date = event.target.value;
      if (date >= FIRST_APOD && date <= ($('#apodDate').max)) loadApod(date);
    });
    $('#descriptionToggle').addEventListener('click', () => {
      const expanded = $('#apodDescription').classList.toggle('expanded');
      $('#descriptionToggle').textContent = expanded ? 'Read less ↑' : 'Read full story ↗';
    });
    $('#locateButton').addEventListener('click', locate);
    $('#cityForm').addEventListener('submit', searchCity);
    $('#clearCollection').addEventListener('click', () => {
      if (!state.saved.length || !window.confirm('Remove all saved discoveries from your collection?')) return;
      state.saved = []; persistSaved(); renderCollection(); updateSaveButton();
    });
    loadSaved();
    loadApod();
  }

  init();
})();
