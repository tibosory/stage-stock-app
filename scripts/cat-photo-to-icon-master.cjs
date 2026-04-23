/**
 * Prépare assets/icon-master.png à partir d’une photo du chat (assets/icon-cat-source.png).
 *
 * - Recadrage carré centré (légèrement remonté pour favoriser la tête sur les photos paysage).
 * - Détourage « doux » : masque circulaire (coins transparents) — fiable sans ML en Node.
 * - Optionnel : suppression de fond sombre uniforme (coins) par seuil couleur (tolérance).
 *
 * Ensuite : npm run icons:build
 *
 * Usage : node scripts/cat-photo-to-icon-master.cjs
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const assets = path.join(__dirname, '..', 'assets');
const SRC = path.join(assets, 'icon-cat-source.png');
const OUT = path.join(assets, 'icon-master.png');
const SIZE = 1024;

/** RGB approximatif du thème (#0B0C0F) + tolérance pour vignettage léger. */
const BG = { r: 11, g: 12, b: 15 };
const COLOR_DIST_MAX = 42;

async function removeNearSolidBackground(rgbaBuffer, width, height, channels) {
  const out = Buffer.from(rgbaBuffer);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const dr = r - BG.r;
      const dg = g - BG.g;
      const db = b - BG.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist <= COLOR_DIST_MAX) {
        out[i + 3] = 0;
      }
    }
  }
  return out;
}

function circleMaskPng(size) {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Fichier manquant : assets/icon-cat-source.png');
    process.exit(1);
  }

  const meta = await sharp(SRC).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (!w || !h) {
    console.error('Impossible de lire les dimensions de la source.');
    process.exit(1);
  }

  const side = Math.min(w, h);
  let left = Math.floor((w - side) / 2);
  let top = Math.floor((h - side) / 2);
  const biasY = Math.floor(h * 0.06);
  top = Math.max(0, top - biasY);

  let pipeline = sharp(SRC)
    .extract({ left, top, width: side, height: side })
    .resize(SIZE, SIZE, { fit: 'fill' })
    .ensureAlpha();

  const raw = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const ch = info.channels;
  if (ch !== 4) {
    console.error('Attendu RGBA après ensureAlpha.');
    process.exit(1);
  }

  const keyed = await removeNearSolidBackground(data, info.width, info.height, ch);

  const maskBuf = await circleMaskPng(SIZE);
  const outBuf = await sharp(keyed, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .toBuffer();

  fs.writeFileSync(OUT, outBuf);
  console.log(
    `OK: ${path.relative(process.cwd(), OUT)} (${SIZE}×${SIZE}), recadrage ${side}×${side} @ (${left},${top}), fond sombre atténué + masque circulaire.`
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
