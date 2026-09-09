const fs = require("fs");
const path = require("path");

const file = path.join("android", "gradle.properties");
if (!fs.existsSync(file)) {
  console.error("android/gradle.properties missing; run expo prebuild first");
  process.exit(1);
}

let text = fs.readFileSync(file, "utf8");

const flags = {
  reactNativeArchitectures: "arm64-v8a",
  "expo.useLegacyPackaging": "true",
  "android.enableMinifyInReleaseBuilds": "true",
  "android.enableShrinkResourcesInReleaseBuilds": "true",
  "expo.gif.enabled": "false",
  "expo.webp.enabled": "false",
  "expo.webp.animated": "false",
  "org.gradle.jvmargs":
    "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError",
};

for (const [key, value] of Object.entries(flags)) {
  const re = new RegExp(`^${key.replace(/\./g, "\\.")}=.*$`, "m");
  if (re.test(text)) {
    text = text.replace(re, `${key}=${value}`);
  } else {
    text += `\n${key}=${value}\n`;
  }
}

fs.writeFileSync(file, text);
console.log("Pinned release packaging flags in android/gradle.properties");
