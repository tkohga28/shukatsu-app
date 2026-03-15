const sharp = require("sharp");
const path = require("path");

const svg = (size) => `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2563eb" rx="${Math.round(size * 0.12)}"/>
  <text
    x="${size / 2}"
    y="${size / 2}"
    font-family="Arial, Helvetica, sans-serif"
    font-size="${Math.round(size * 0.38)}px"
    font-weight="bold"
    fill="white"
    text-anchor="middle"
    dominant-baseline="central"
  >就活</text>
</svg>`;

(async () => {
  for (const size of [192, 512]) {
    await sharp(Buffer.from(svg(size)))
      .png()
      .toFile(path.join(__dirname, `../public/icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }
})();
