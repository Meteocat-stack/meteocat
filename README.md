# meteocat

How has the weather changed where you live? meteocat compares the same day, date range
or season across every year since 1985, for any place in Europe.

Pick a place and a period, such as Bratislava in summer or 4 August. You get four
cards, each with a one-line summary:

- **Temperature:** the average day and night temperature for each year, with a bar
  from the coldest night to the warmest day.
- **Hot and freezing days:** how many tropical days (maximum 30 °C or more), tropical
  nights (minimum 20 °C or more), frost days (minimum below 0 °C) and ice days
  (maximum below 0 °C) each year had. These are the standard definitions used by
  Central European weather services.
- **Rain and snow:** total rain (mm) and fresh snow (cm) for each year.
- **Wind:** the average wind speed and the strongest gust for each year.

It's a small static website: plain HTML, CSS and JavaScript, with no build step and no server code.

## Run it on your computer

You need Python (already installed on most computers). In this folder, run:

```bash
python -m http.server 8765 --directory docs
```

Then open http://localhost:8765 in your browser. Double-clicking `index.html` doesn't
work, because browsers block the weather requests from local files.

## Settings

Two lines near the top of `docs/index.html`:

```html
<meta name="mc:goatcounter" content="">  <!-- GoatCounter code, e.g. "meteocat"; empty = no visitor stats -->
<meta name="mc:contact" content="">      <!-- public contact email shown under "About and privacy" -->
```

## Project layout

```
docs/
  index.html     page structure and settings
  style.css      look and feel, light and dark mode
  app.js         place search, data loading, calculations and charts
  icon.svg       app icon
  vendor/        bundled libraries, font and flags (see THIRD_PARTY.md)
```

## How the numbers are made

- **Data:** the [Open-Meteo](https://open-meteo.com/) historical archive, model
  `era5_seamless`. That's ERA5-Land (about 10 km) for temperature and ERA5 (about 28 km)
  for wind, rain and snow. The same model is used for every year, so years compare fairly.
- **Day and night:** "day" is the average of the hours 07:00–20:00 local time. "Night"
  is 21:00 the evening before until 06:00.
- **Winter:** winter 2026 means 1 Dec 2025 – 28 Feb 2026, and a range that crosses New
  Year is labelled the same way (2025/26).
- **Missing data:** a year with missing days is left out. The newest data appears about
  5–6 days late.
- **Limits:** values describe an area, not a weather station. Very local events such as
  tornadoes or hail usually don't show up.

## Privacy

- No cookies, no ads and no tracking.
- Visitor stats are optional, and counted with [GoatCounter](https://www.goatcounter.com/),
  which uses no cookies and stores no IP addresses.
- Weather already loaded and recent places are kept only in the visitor's own browser
  (localStorage).
- The full privacy note is in the page under "About and privacy".

## Publish

The site is static, so any free static host works. With GitHub Pages:

1. Push this repository to GitHub.
2. Open **Settings → Pages**, choose **Deploy from a branch**, then the `main` branch and the `/docs` folder, and save.
3. After a minute or two the site is live at `https://<your-username>.github.io/<repository-name>/`.

## Licence

The meteocat code is released under the [MIT Licence](LICENSE). Bundled libraries,
the font, the flags and the weather and place data keep their own licences: see
[THIRD_PARTY.md](THIRD_PARTY.md).

Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0), contains modified
Copernicus Climate Change Service information. Places from GeoNames and
[© OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
