const fs = require("fs");
const path = require("path");

const META = "com.google.android.geo.API_KEY";
const PLACEHOLDER = "${GOOGLE_MAPS_API_KEY}";
const manifestPath = path.join("android", "app", "src", "main", "AndroidManifest.xml");
const gradlePath = path.join("android", "app", "build.gradle");
const requireKey = process.argv.includes("--require");

function loadDotEnv() {
  const file = path.join(__dirname, "..", ".env");
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

function isUsableKey(value) {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 && !trimmed.includes("${");
}

function restoreManifestPlaceholder(text) {
  const metaRe = new RegExp(
    `<meta-data android:name="${META.replace(/\./g, "\\.")}" android:value="[^"]*"/>`
  );
  const placeholderTag = `<meta-data android:name="${META}" android:value="${PLACEHOLDER}"/>`;
  if (metaRe.test(text)) {
    return text.replace(metaRe, placeholderTag);
  }
  return text.replace("</application>", `    ${placeholderTag}\n  </application>`);
}

function ensureGradlePlaceholder(text) {
  let next = text;
  if (!next.includes("projectRootDir")) {
    next = next.replace(
      /def projectRoot = .+\n/,
      (line) =>
        `${line}def projectRootDir = rootDir.getAbsoluteFile().getParentFile()\n`
    );
  }
  if (!next.includes("def mapsApiKey")) {
    const block = `
def mapsApiKey = System.getenv("GOOGLE_MAPS_API_KEY") ?: ""
if (mapsApiKey.isEmpty()) {
    def envFile = new File(projectRootDir, ".env")
    if (envFile.exists()) {
        envFile.eachLine { line ->
            def trimmed = line.trim()
            if (trimmed.startsWith("GOOGLE_MAPS_API_KEY=")) {
                mapsApiKey = trimmed.substring("GOOGLE_MAPS_API_KEY=".length()).replaceAll(/^["']|["']$/, "")
            }
        }
    }
}
`;
    next = next.replace(
      /def projectRootDir = .+\n/,
      (line) => `${line}${block}`
    );
  }
  if (!next.includes("GOOGLE_MAPS_API_KEY: mapsApiKey")) {
    next = next.replace(
      /versionName\s+"[^"]+"\n/,
      (line) => `${line}        manifestPlaceholders = [GOOGLE_MAPS_API_KEY: mapsApiKey]\n`
    );
  }
  return next;
}

loadDotEnv();

const apiKey = (process.env.GOOGLE_MAPS_API_KEY ?? "").trim();
if (!isUsableKey(apiKey)) {
  const message =
    "GOOGLE_MAPS_API_KEY is missing. Set it in .env or the GOOGLE_MAPS_API_KEY environment / Actions secret.";
  if (requireKey) {
    console.error(message);
    process.exit(1);
  }
  console.warn(message);
}

if (fs.existsSync(manifestPath)) {
  const before = fs.readFileSync(manifestPath, "utf8");
  const after = restoreManifestPlaceholder(before);
  if (after !== before) {
    fs.writeFileSync(manifestPath, after);
    console.log("Restored Google Maps API key placeholder in AndroidManifest.xml");
  }
}

if (fs.existsSync(gradlePath)) {
  const before = fs.readFileSync(gradlePath, "utf8");
  const after = ensureGradlePlaceholder(before);
  if (after !== before) {
    fs.writeFileSync(gradlePath, after);
    console.log("Ensured Gradle substitutes GOOGLE_MAPS_API_KEY at build time");
  }
} else if (requireKey) {
  console.error("android/app/build.gradle missing; run expo prebuild first");
  process.exit(1);
}
