# GEFS

**Ensemble weather, on your phone.**

GEFS is a small Android/iOS app for reading *uncertainty*, not a single pretty line. It plots control runs, ensemble members, and percentile bands so you can see whether rain, wind, or temperature is a consensus or a gamble.

Forecasts come from [Open-Meteo](https://open-meteo.com/) ensemble models. Location is GPS or a point on the map.

<p align="center">
  <img src="assets/images/icon.png" alt="GEFS icon" width="96" height="96" />
</p>

---

## What you see

Each chart is an hourly ensemble for the selected variables:

- **Temperature 2 m**, with frost / heat markers when members cross 0 °C or 35 °C
- **Precipitation**, with a cumulative fill, daily median (P10–P90), and a 12-hour rain-probability strip
- **Mean sea-level pressure**
- **Wind 10 m**, plus gusts when the model provides them

Swipe one chart and a crosshair follows on the others. Pull to refresh. Settings control model, horizon, variables, light/dark, and whether Y-axis labels are shown.

## Models

| Model in Settings | Open-Meteo id | Grid | Typical horizon |
| --- | --- | --- | --- |
| ECMWF IFS 0.25° | `ecmwf_ifs025` | ~25 km, global | 14 days |
| GFS 0.25° | `gfs025` | ~25 km, global | 10 days |
| ICON Seamless | `icon_seamless` | ICON-EU then global | 7 days |
| ICON CH1 1 km | `meteoswiss_icon_ch1_ensemble` | ~1 km, Central Europe | ~33 hours (capped at 2 days) |

ICON Seamless is the better default for Italy in the first few days (ICON-EU). ECMWF is the better medium-range pick. CH1 is a convection-permitting ensemble: useful for local cells, not for a two-week outlook, and not for locations outside Central Europe.

## Stack

Expo 55, Expo Router, React Native 0.83, Victory Native + Skia, Zustand, TanStack Query, NativeWind.

## Setup

```bash
npm install
cp .env.example .env
# put a Google Maps API key in .env as GOOGLE_MAPS_API_KEY
npx expo start
```

| Script | Purpose |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` | Debug build / run on Android |
| `npm run android:apk` | Release APK (`NODE_ENV=production`, arm64-v8a only) |
| `npm run ios` | Debug build / run on iOS |
| `npm run web` | Web (charts are built for native) |

Maps need `GOOGLE_MAPS_API_KEY`. Forecasts do not. For a store-signed APK, copy `keystore.properties.example` to `keystore.properties` and point it at a real keystore.

The sideload APK is **arm64-v8a only** (typical phones). Download the latest from [GitHub Releases](https://github.com/AlessandroAnnini/gefs/releases/latest). Pushing a `v*` tag builds that APK in GitHub Actions; add a `GOOGLE_MAPS_API_KEY` repository secret so maps work in the CI build. From 3.7.0, Android can check that Release and open the system installer. For an x86_64 emulator, override the ABI when running a debug build: `./android/gradlew -p android assembleDebug -PreactNativeArchitectures=x86_64`.

## Data and terms

Hourly ensembles are requested from `https://ensemble-api.open-meteo.com/v1/ensemble`. Open-Meteo’s non-commercial use is under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); commercial use needs their licence.

Attribute the data as **Open-Meteo**. Upstream models belong to ECMWF, NOAA, DWD, and MeteoSwiss. These are experimental visualizations, not official warnings. For alerts, use your national weather service.

## Licence

Personal project. Source is the repository; weather data remains under the providers’ terms.
