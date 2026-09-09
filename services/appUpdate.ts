import { Platform } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";

const GITHUB_REPO = "AlessandroAnnini/gefs";
const PACKAGE_ID = "com.alessandroannini.gefs";
const APK_CACHE = `${FileSystem.cacheDirectory ?? ""}gefs-update.apk`;
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export interface AvailableUpdate {
  versionName: string;
  versionCode: number;
  apkUrl: string;
  apkSize: number;
}

let cachedUpdate: AvailableUpdate | null = null;

export function getCachedUpdate(): AvailableUpdate | null {
  return cachedUpdate;
}

interface GithubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  assets: GithubAsset[];
}

function githubHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "GEFS",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function localVersionCode(): number {
  const n = Number(Constants.nativeBuildVersion);
  return Number.isFinite(n) ? n : 0;
}

export function localVersionName(): string {
  return (
    Constants.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    "0.0.0"
  );
}

function parseSemver(value: string): number[] {
  return value
    .replace(/^v/, "")
    .split(".")
    .slice(0, 3)
    .map((part) => {
      const n = Number(part);
      return Number.isFinite(n) ? n : 0;
    });
}

function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function isNewerUpdate(update: AvailableUpdate): boolean {
  const localCode = localVersionCode();
  if (localCode > 0 && update.versionCode > 0) {
    return update.versionCode > localCode;
  }
  return compareSemver(update.versionName, localVersionName()) > 0;
}

async function readUpdateJson(
  url: string
): Promise<{ versionName?: string; versionCode?: number } | null> {
  try {
    const res = await fetch(url, { headers: githubHeaders() });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      versionName?: unknown;
      versionCode?: unknown;
    };
    const versionName =
      typeof body.versionName === "string" ? body.versionName : undefined;
    const versionCode =
      typeof body.versionCode === "number" && Number.isFinite(body.versionCode)
        ? body.versionCode
        : undefined;
    return { versionName, versionCode };
  } catch {
    return null;
  }
}

export async function fetchLatestUpdate(): Promise<AvailableUpdate | null> {
  if (Platform.OS !== "android") return null;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
    { headers: githubHeaders() }
  );
  if (!res.ok) {
    throw new Error("Could not check for updates.");
  }

  const release = (await res.json()) as GithubRelease;
  const apk = release.assets.find((asset) =>
    asset.name.toLowerCase().endsWith(".apk")
  );
  if (!apk) return null;

  const metaAsset = release.assets.find(
    (asset) => asset.name.toLowerCase() === "update.json"
  );
  const meta = metaAsset
    ? await readUpdateJson(metaAsset.browser_download_url)
    : null;

  const versionName = meta?.versionName ?? release.tag_name.replace(/^v/, "");
  const versionCode = meta?.versionCode ?? 0;

  const update: AvailableUpdate = {
    versionName,
    versionCode,
    apkUrl: apk.browser_download_url,
    apkSize: apk.size,
  };

  cachedUpdate = isNewerUpdate(update) ? update : null;
  return cachedUpdate;
}

export async function downloadAndInstallUpdate(
  update: AvailableUpdate,
  onProgress?: (progress: number) => void
): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error("Updates are only available on Android.");
  }
  if (!FileSystem.cacheDirectory) {
    throw new Error("Could not download the update.");
  }

  const existing = await FileSystem.getInfoAsync(APK_CACHE);
  if (existing.exists) {
    await FileSystem.deleteAsync(APK_CACHE, { idempotent: true });
  }

  const download = FileSystem.createDownloadResumable(
    update.apkUrl,
    APK_CACHE,
    { headers: githubHeaders() },
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const total =
        totalBytesExpectedToWrite > 0
          ? totalBytesExpectedToWrite
          : update.apkSize;
      if (total > 0) onProgress?.(totalBytesWritten / total);
    }
  );

  const result = await download.downloadAsync();
  if (!result?.uri) {
    throw new Error("Could not download the update.");
  }

  const info = await FileSystem.getInfoAsync(result.uri);
  const size = info.exists && "size" in info ? info.size : 0;
  if (update.apkSize > 0 && size !== update.apkSize) {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
    throw new Error("Could not download the update.");
  }

  await installApk(result.uri);
}

async function openUnknownAppsSettings(): Promise<void> {
  await IntentLauncher.startActivityAsync(
    "android.settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES",
    { data: `package:${PACKAGE_ID}` }
  );
}

async function installApk(fileUri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  try {
    await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
      data: contentUri,
      type: "application/vnd.android.package-archive",
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
  } catch {
    await openUnknownAppsSettings();
    throw new Error(
      "Allow GEFS to install unknown apps, then try the update again."
    );
  }
}
