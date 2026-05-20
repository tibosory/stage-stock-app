/**
 * Génère les PNG Expo pour l’icône app et l’adaptive icon Android.
 *
 * - icon.png : 1024×1024, logo contrasté + libellé « CATRACK Pro » lisible.
 * - adaptive-icon.png : logo seul dans la zone sûre ~66 % (pas de texte).
 * - splash.png : visuel de lancement propre (logo centré + halo léger).
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
const LOWER_BAND = Math.floor(SIZE * 0.24);
const LOGO_H = SIZE - LOWER_BAND;
/** Zone sûre adaptive : ~66 %. */
const SAFE_FRACTION = 0.66;
const SAFE = Math.round(SIZE * SAFE_FRACTION);
const SPLASH_SIZE = 2048;

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
  >CATRACK Pro</text>
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
  const outSplash = path.join(assets, 'splash.png');

  const logoStrip = await sharp(master)
    .resize(SIZE, LOGO_H, {
      fit: 'contain',
      background: BG,
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen(0.35, 0.9, 1.1)
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
    .sharpen(0.25, 0.8, 1.05)
    .png()
    .toBuffer();

  const inner = await sharp(master)
    .resize(SAFE, SAFE, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
    .sharpen(0.35, 0.9, 1.1)
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

  const splashIconSize = Math.round(SPLASH_SIZE * 0.36);
  const splashInner = await sharp(master)
    .resize(splashIconSize, splashIconSize, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
    .sharpen(0.35, 0.9, 1.1)
    .png()
    .toBuffer();
  const splashGlow = await sharp(
    Buffer.from(`
      <svg width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="46%" r="34%">
            <stop offset="0%" stop-color="#34D399" stop-opacity="0.50"/>
            <stop offset="55%" stop-color="#34D399" stop-opacity="0.16"/>
            <stop offset="100%" stop-color="#34D399" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" fill="url(#g)"/>
      </svg>`)
  )
    .png()
    .toBuffer();
  const splashMeta = await sharp(splashInner).metadata();
  const splashLeft = Math.floor((SPLASH_SIZE - (splashMeta.width || 0)) / 2);
  const splashTop = Math.floor((SPLASH_SIZE - (splashMeta.height || 0)) / 2) - Math.floor(SPLASH_SIZE * 0.03);
  const splashBuf = await sharp({
    create: {
      width: SPLASH_SIZE,
      height: SPLASH_SIZE,
      channels: 4,
      background: BG,
    },
  })
    .composite([
      { input: splashGlow, left: 0, top: 0 },
      { input: splashInner, left: splashLeft, top: splashTop },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(outIcon, iconBuf);
  fs.writeFileSync(outAdaptive, adaptiveBuf);
  fs.writeFileSync(outSplash, splashBuf);

  console.log(
    `OK: icon.png + adaptive-icon.png + splash.png, source=${path.basename(inputPath)}`
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
