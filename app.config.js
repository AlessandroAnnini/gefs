const fs = require("fs");
const path = require("path");

function loadDotEnv() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

loadDotEnv();

const appJson = require("./app.json");

function isUsableMapsKey(value) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 && !trimmed.includes("${");
}

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo.extra ?? {}),
      hasGoogleMapsKey: isUsableMapsKey(process.env.GOOGLE_MAPS_API_KEY),
    },
    android: {
      ...appJson.expo.android,
      config: {
        googleMaps: {
          apiKey: "${GOOGLE_MAPS_API_KEY}",
        },
      },
    },
  },
};
