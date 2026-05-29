#!/usr/bin/env node
/**
 * Generates Android mipmap and iOS AppIcon PNG files from icon.svg
 * Run: node scripts/generate-icons.js
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SVG = path.join(__dirname, "icon.svg");

const ANDROID_SIZES = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

const IOS_SIZES = [
  { name: "Icon-20.png", size: 20 },
  { name: "Icon-20@2x.png", size: 40 },
  { name: "Icon-20@3x.png", size: 60 },
  { name: "Icon-29.png", size: 29 },
  { name: "Icon-29@2x.png", size: 58 },
  { name: "Icon-29@3x.png", size: 87 },
  { name: "Icon-40.png", size: 40 },
  { name: "Icon-40@2x.png", size: 80 },
  { name: "Icon-40@3x.png", size: 120 },
  { name: "Icon-60@2x.png", size: 120 },
  { name: "Icon-60@3x.png", size: 180 },
  { name: "Icon-76.png", size: 76 },
  { name: "Icon-76@2x.png", size: 152 },
  { name: "Icon-83.5@2x.png", size: 167 },
  { name: "Icon-1024.png", size: 1024 },
];

async function generate() {
  const svgBuffer = fs.readFileSync(SVG);

  // ── Android legacy PNGs ───────────────────────────────────────────────────
  for (const { dir, size } of ANDROID_SIZES) {
    const outDir = path.join(ROOT, "android/app/src/main/res", dir);
    fs.mkdirSync(outDir, { recursive: true });

    const outFile = path.join(outDir, "ic_launcher.png");
    await sharp(svgBuffer).resize(size, size).png().toFile(outFile);
    console.log(`✓ Android ${dir}/ic_launcher.png (${size}×${size})`);

    const roundFile = path.join(outDir, "ic_launcher_round.png");
    await sharp(svgBuffer).resize(size, size).png().toFile(roundFile);
    console.log(`✓ Android ${dir}/ic_launcher_round.png`);
  }

  // ── Android adaptive icon (API 26+) ──────────────────────────────────────
  // Adaptive canvas is 108dp. Safe zone (always visible) is the inner 72dp.
  // We render the icon at 72/108 = 66.7% of the canvas, centred, transparent bg.
  const ADAPTIVE_SIZE = 432; // 4× 108dp
  const ICON_SIZE = Math.round(ADAPTIVE_SIZE * (72 / 108)); // ~288px
  const PADDING = Math.round((ADAPTIVE_SIZE - ICON_SIZE) / 2);

  const iconResized = await sharp(svgBuffer)
    .resize(ICON_SIZE, ICON_SIZE)
    .toBuffer();

  const foregroundBuffer = await sharp({
    create: {
      width: ADAPTIVE_SIZE,
      height: ADAPTIVE_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: iconResized, top: PADDING, left: PADDING }])
    .png()
    .toBuffer();

  // Write foreground to mipmap-xxxhdpi (anydpi XML will reference it)
  const fgDir = path.join(ROOT, "android/app/src/main/res/mipmap-xxxhdpi");
  fs.mkdirSync(fgDir, { recursive: true });
  fs.writeFileSync(
    path.join(fgDir, "ic_launcher_foreground.png"),
    foregroundBuffer,
  );
  console.log(
    `✓ Android adaptive foreground (${ADAPTIVE_SIZE}×${ADAPTIVE_SIZE})`,
  );

  // Background color XML
  const colorDir = path.join(ROOT, "android/app/src/main/res/values");
  fs.mkdirSync(colorDir, { recursive: true });
  const colorsXml = path.join(colorDir, "ic_launcher_background.xml");
  if (!fs.existsSync(colorsXml)) {
    fs.writeFileSync(
      colorsXml,
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0f0f12</color>\n</resources>\n`,
    );
    console.log("✓ Android adaptive background color XML");
  }

  // Adaptive icon XMLs in mipmap-anydpi-v26
  const anydpiDir = path.join(
    ROOT,
    "android/app/src/main/res/mipmap-anydpi-v26",
  );
  fs.mkdirSync(anydpiDir, { recursive: true });
  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anydpiDir, "ic_launcher.xml"), adaptiveXml);
  fs.writeFileSync(path.join(anydpiDir, "ic_launcher_round.xml"), adaptiveXml);
  console.log("✓ Android mipmap-anydpi-v26/ic_launcher.xml");
  console.log("✓ Android mipmap-anydpi-v26/ic_launcher_round.xml");

  // ── iOS ──────────────────────────────────────────────────────────────────
  const iosDir = path.join(
    ROOT,
    "ios/RTMPBroadcaster/Images.xcassets/AppIcon.appiconset",
  );
  fs.mkdirSync(iosDir, { recursive: true });

  for (const { name, size } of IOS_SIZES) {
    const outFile = path.join(iosDir, name);
    await sharp(svgBuffer).resize(size, size).png().toFile(outFile);
    console.log(`✓ iOS ${name} (${size}×${size})`);
  }

  // Write Contents.json for Xcode
  const contents = {
    images: [
      {
        idiom: "iphone",
        scale: "2x",
        size: "20x20",
        filename: "Icon-20@2x.png",
      },
      {
        idiom: "iphone",
        scale: "3x",
        size: "20x20",
        filename: "Icon-20@3x.png",
      },
      {
        idiom: "iphone",
        scale: "2x",
        size: "29x29",
        filename: "Icon-29@2x.png",
      },
      {
        idiom: "iphone",
        scale: "3x",
        size: "29x29",
        filename: "Icon-29@3x.png",
      },
      {
        idiom: "iphone",
        scale: "2x",
        size: "40x40",
        filename: "Icon-40@2x.png",
      },
      {
        idiom: "iphone",
        scale: "3x",
        size: "40x40",
        filename: "Icon-40@3x.png",
      },
      {
        idiom: "iphone",
        scale: "2x",
        size: "60x60",
        filename: "Icon-60@2x.png",
      },
      {
        idiom: "iphone",
        scale: "3x",
        size: "60x60",
        filename: "Icon-60@3x.png",
      },
      { idiom: "ipad", scale: "1x", size: "20x20", filename: "Icon-20.png" },
      { idiom: "ipad", scale: "2x", size: "20x20", filename: "Icon-20@2x.png" },
      { idiom: "ipad", scale: "1x", size: "29x29", filename: "Icon-29.png" },
      { idiom: "ipad", scale: "2x", size: "29x29", filename: "Icon-29@2x.png" },
      { idiom: "ipad", scale: "1x", size: "40x40", filename: "Icon-40.png" },
      { idiom: "ipad", scale: "2x", size: "40x40", filename: "Icon-40@2x.png" },
      { idiom: "ipad", scale: "2x", size: "76x76", filename: "Icon-76@2x.png" },
      {
        idiom: "ipad",
        scale: "2x",
        size: "83.5x83.5",
        filename: "Icon-83.5@2x.png",
      },
      {
        idiom: "ios-marketing",
        scale: "1x",
        size: "1024x1024",
        filename: "Icon-1024.png",
      },
    ],
    info: { author: "xcode", version: 1 },
  };
  fs.writeFileSync(
    path.join(iosDir, "Contents.json"),
    JSON.stringify(contents, null, 2),
  );
  console.log("✓ iOS Contents.json written");

  console.log("\nAll icons generated!");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
