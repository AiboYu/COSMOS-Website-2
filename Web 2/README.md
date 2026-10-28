# COSMOS — A place to look up

A cinematic, single-page astronomy discovery app for CSE 2004 Website #2. Built with ordinary HTML, CSS, and JavaScript; no framework, build step, API key, or paid service is needed.

## Running locally

Open Terminal in this folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/` in Chrome. You may also open `index.html` directly, but browser location permissions work best on `http://localhost` or an HTTPS deployment.

## Features / APIs

| Feature | API type | API |
|---|---|---|
| Daily astronomy discovery + date archive | Data | NASA APOD (WordPress endpoint) |
| Tonight's cloud-cover outlook | Data | Open-Meteo Forecast API |
| Manual city lookup | Data | Open-Meteo Geocoding API |
| Use current location | Browser | Geolocation API (`navigator.geolocation`) |
| Save & revisit pictures | Browser | Web Storage API (`localStorage`) |

The night-sky outlook looks at hourly forecast data for 8–11 PM local time. It estimates sky clarity primarily from average cloud cover, with rain, fog, snow and thunderstorms lowering the outlook. It is **not** an astronomical or light-pollution forecast.

## Files

- `index.html` — accessible, semantic single-page markup
- `styles.css` — responsive visual system
- `js/app.js` — API handling, UI logic, saved collection, errors
- `assets/saturn-art.jpg` — original procedural artist's rendering for the hero, **not NASA photography**

NASA APOD images and stories are loaded live from NASA when the website is opened. Individual APOD images may credit third-party astrophotographers; their source and credit are shown alongside each image. The hero Saturn rendering is original art and is labeled accordingly.

## Deployment

Upload all files, keeping their folder structure, to GitHub Pages, Netlify, or Vercel static hosting. Submit the public URL and ZIP folder to the course site. HTTPS enables browser Geolocation when permission is granted.

## Known behavior

- APOD or weather services must be reachable on the user's network. If a service is down or blocked, an on-page error is displayed instead of fabricated data.
- Geolocation only runs after clicking **Use my location**. If denied, users can enter a city manually.
- The favorites collection lives only in that browser's localStorage. Clearing browser site data clears the saved collection.
- API-derived APOD images are not included in the project ZIP because they are fetched live.

## Attribution and academic integrity

NASA APOD (https://science.nasa.gov/) / Open-Meteo (https://open-meteo.com/). COSMOS is an independent student project and is not affiliated with or endorsed by NASA. If AI tools materially authored code, report the AI usage proportion honestly in the submission form.
