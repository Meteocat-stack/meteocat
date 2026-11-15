# Third-party files and data

meteocat bundles a few open-source files so visitors' browsers don't contact
outside servers for them. Each keeps its own licence.

| What | Where | Licence |
|---|---|---|
| D3 7.9.0 | `docs/vendor/d3.min.js` | ISC, © 2010–2023 Mike Bostock |
| Observable Plot 0.6.16 | `docs/vendor/plot.umd.min.js` | ISC, © 2020–2023 Observable, Inc. |
| GoatCounter count.js | `docs/vendor/count.js` | ISC, © GoatCounter (Martin Tournoij) |
| Inter font (latin, latin-ext; 400, 500, 600) | `docs/vendor/fonts/` | SIL Open Font License 1.1, full text in `docs/vendor/fonts/OFL.txt` |
| Country flags | `docs/vendor/flags/` | Public domain, from [Flagpedia](https://flagpedia.net/) / flagcdn.com |

The ISC licence text: Permission to use, copy, modify, and/or distribute this
software for any purpose with or without fee is hereby granted, provided that
the above copyright notice and this permission notice appear in all copies.
THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES.

## Data used at runtime (not stored in this repository)

- **Weather:** [Open-Meteo.com](https://open-meteo.com/) Historical Weather API,
  CC BY 4.0. Contains modified Copernicus Climate Change Service information
  (ERA5, ERA5-Land, ECMWF). The free API is for non-commercial use.
- **Place search:** Open-Meteo Geocoding (based on [GeoNames](https://www.geonames.org/), CC BY 4.0)
  and [Photon](https://photon.komoot.io) by komoot, with data
  [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL).
