/**
 * Génère les PNG Expo pour l’icône app et l’adaptive icon Android.
 *
 * - icon.png : 1024×1024, logo dans la partie haute + libellé « Stage Stock » lisible en bas.
 * - adaptive-icon.png : logo seul dans la zone sûr ~60 % (pas de texte — évite la coupe sous masque).
 *
 * Source du visuel : uniquement assets/icon-master.png. S’il est absent, il est créé une fois
 * en copiant icon.png (visuel sans libellé généré — remplacez ce fichier si besoin).
 * Photo chat → icon-master : placez assets/icon-cat-source.png puis npm run icons:from-cat
 * Régénérer icon.png : uniquement à partir d’icon-master pour éviter d’empiler le texte.
 *
 * Usage : node scripts/build-icons.cjs
 *
 * Après avoir mis à jour icon.png / adaptive-icon.png : pour que l’APK Android
 * (y compris EAS) affiche la bonne icône lanceur, il faut aussi régénérer les
 * mipmaps natives : npm run icons:sync-android (puis commit android/ si besoin).
 */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const BG = { r: 11, g: 12, b: 15, alpha: 1 }; // #0B0C0F
const SIZE = 1024;
/** Réserve basse pour le texte (le logo tient au-dessus). */
const LOWER_BAND = Math.floor(SIZE * 0.26);
const LOGO_H = SIZE - LOWER_BAND;
/** Zone sûre adaptive : ~60 %. */
const SAFE_FRACTION = 0.6;
const SAFE = Math.round(SIZE * SAFE_FRACTION);

const assets = path.join(__dirname, '..', 'assets');

function resolveMasterPath() {
  const master = path.join(assets, 'icon-master.png');
  const legacy = path.join(assets, 'icon.png');
  if (!fs.existsSync(master) && fs.existsSync(legacy)) {
    fs.copyFileSync(legacy, master);
    console.warn(
      '[build-icons] Créé assets/icon-master.png depuis icon.png — éditez icon-master (visuel brut) pour les prochains builds.'
    );
  }
  if (fs.existsSync(master)) return master;
  return null;
}

function titleOverlayPng() {
  const svg = `
<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <text
    x="${SIZE / 2}"
    y="${SIZE - Math.floor(LOWER_BAND / 2) + 18}"
    text-anchor="middle"
    font-family="Segoe UI, system-ui, -apple-system, sans-serif"
    font-size="52"
    font-weight="700"
    fill="#f9fafb"
    stroke="#0b0c0f"
    stroke-width="3"
    paint-order="stroke fill"
  >Stage Stock</text>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function main() {
  const inputPath = resolveMasterPath();
  if (!inputPath) {
    console.error('Fichier manquant : assets/icon-master.png ou assets/icon.png');
    process.exit(1);
  }

  const master = fs.readFileSync(inputPath);
  const outIcon = path.join(assets, 'icon.png');
  const outAdaptive = path.join(assets, 'adaptive-icon.png');

  const logoStrip = await sharp(master)
    .resize(SIZE, LOGO_H, {
      fit: 'contain',
      background: BG,
    })
    .png()
    .toBuffer();

  const titleLayer = await titleOverlayPng();

  const iconBuf = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: BG,
    },
  })
    .composite([
      { input: logoStrip, left: 0, top: 0 },
      { input: titleLayer, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  const inner = await sharp(master)
    .resize(SAFE, SAFE, { fit: 'inside' })
    .png()
    .toBuffer();

  const { width: w, height: h } = await sharp(inner).metadata();
  const left = Math.floor((SIZE - (w || 0)) / 2);
  const top = Math.floor((SIZE - (h || 0)) / 2);

  const adaptiveBuf = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: inner, left, top }])
    .png()
    .toBuffer();

  fs.writeFileSync(outIcon, iconBuf);
  fs.writeFileSync(outAdaptive, adaptiveBuf);

  console.log(
    `OK: icon.png + adaptive-icon.png (${SIZE}×${SIZE}), ` +
      `logo ~${LOGO_H}px + bande libellé, source=${path.basename(inputPath)}, adaptive ${SAFE}×${SAFE}`
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
