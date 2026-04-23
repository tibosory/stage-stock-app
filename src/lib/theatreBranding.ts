import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const KEYS = {
  NAME: 'stagestock_theatre_name',
  ADDRESS: 'stagestock_theatre_address',
  LOGO_URI: 'stagestock_theatre_logo_uri',
} as const;

const LOGO_FILE = 'theatre_logo.jpg';

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type TheatreBrandingStored = {
  theatreName: string;
  theatreAddress: string;
  logoUri: string | null;
};

export type PdfBranding = {
  theatreName: string;
  theatreAddress: string;
  logoDataUri: string | null;
};

export async function loadTheatreBranding(): Promise<TheatreBrandingStored> {
  const [name, address, logoUri] = await Promise.all([
    AsyncStorage.getItem(KEYS.NAME),
    AsyncStorage.getItem(KEYS.ADDRESS),
    AsyncStorage.getItem(KEYS.LOGO_URI),
  ]);
  return {
    theatreName: name ?? '',
    theatreAddress: address ?? '',
    logoUri: logoUri ?? null,
  };
}

export async function saveTheatreIdentity(name: string, address: string): Promise<void> {
  await AsyncStorage.multiSet([
    [KEYS.NAME, name],
    [KEYS.ADDRESS, address],
  ]);
}

/** Copie l’image choisie dans le stockage persistant de l’app. */
export async function storePickedLogoFile(sourceUri: string): Promise<string> {
  const base = FileSystem.documentDirectory;
  if (!base) throw new Error('Stockage document indisponible');
  const dest = `${base}${LOGO_FILE}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  await AsyncStorage.setItem(KEYS.LOGO_URI, dest);
  return dest;
}

export async function clearTheatreLogo(): Promise<void> {
  const u = await AsyncStorage.getItem(KEYS.LOGO_URI);
  if (u) {
    try {
      await FileSystem.deleteAsync(u, { idempotent: true });
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(KEYS.LOGO_URI);
  }
}

async function readLogoDataUri(uri: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const mime = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

export async function getPdfBranding(): Promise<PdfBranding> {
  const stored = await loadTheatreBranding();
  const logoDataUri = stored.logoUri ? await readLogoDataUri(stored.logoUri) : null;
  return {
    theatreName: stored.theatreName,
    theatreAddress: stored.theatreAddress,
    logoDataUri,
  };
}

/** En-tête complet pour fiches PDF (prêt, A4, etc.). */
export function buildPdfOrgHeaderHtml(b: PdfBranding): string {
  const name = b.theatreName.trim();
  const addr = b.theatreAddress.trim();
  if (!name && !addr && !b.logoDataUri) return '';

  const nameHtml = name
    ? `<div style="font-size:17px;font-weight:bold;color:#111;">${esc(name)}</div>`
    : '';
  const addrHtml = addr
    ? `<div style="font-size:11px;color:#333;white-space:pre-wrap;margin-top:4px;line-height:1.35;">${esc(addr)}</div>`
    : '';
  const logoHtml = b.logoDataUri
    ? `<img src="${b.logoDataUri}" style="max-height:56px;max-width:140px;object-fit:contain;" alt="" />`
    : '';

  return `
<div style="display:flex;flex-direction:row;align-items:flex-start;gap:14px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #ccc;">
  ${logoHtml}
  <div style="flex:1;min-width:0;">${nameHtml}${addrHtml}</div>
</div>`;
}

/** Bandeau compact pour petites étiquettes (souvent sans logo). */
export function buildPdfOrgMicroForLabel(
  b: PdfBranding,
  format: 'carte_visite' | 'petite' | 'large'
): string {
  const name = b.theatreName.trim();
  const addrFirst = b.theatreAddress.trim().split('\n')[0]?.trim() ?? '';
  const hasText = name || addrFirst;
  const hasLogo = !!b.logoDataUri && (format === 'carte_visite' || format === 'large');

  if (!hasText && !hasLogo) return '';

  if (format === 'petite') {
    const line = [name, addrFirst].filter(Boolean).join(' · ');
    if (!line) return '';
    return `<div style="text-align:center;font-size:5px;color:#555;margin-bottom:2px;line-height:1.15;">${esc(line)}</div>`;
  }

  const logoHtml = hasLogo
    ? `<img src="${b.logoDataUri}" style="max-height:8mm;max-width:14mm;object-fit:contain;flex-shrink:0;" alt="" />`
    : '';
  const titleHtml = name ? `<div style="font-size:8px;font-weight:bold;line-height:1.1;">${esc(name)}</div>` : '';
  const subHtml = addrFirst
    ? `<div style="font-size:6px;color:#555;line-height:1.1;margin-top:1px;">${esc(addrFirst)}</div>`
    : '';

  return `
<div style="display:flex;flex-direction:row;align-items:center;justify-content:center;margin-bottom:3px;gap:4px;">
  ${logoHtml}
  <div style="text-align:center;max-width:62mm;">${titleHtml}${subHtml}</div>
</div>`;
}
