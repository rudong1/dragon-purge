'use strict';

// Convert the approved artwork into application icon formats, keeping its art intact.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const { default: pngToIco } = await import('png-to-ico');
  const root = path.resolve(__dirname, '..');
  const target = path.join(root, 'desktop', 'assets');
  await fs.mkdir(target, { recursive: true });
  const png = await sharp(path.join(root, 'docs', 'assets', 'desktop-pet.png'))
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(target, 'icon.png'), png);
  await fs.writeFile(path.join(target, 'icon.ico'), await pngToIco(png));
  console.log('Created desktop/assets/icon.png and icon.ico');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
