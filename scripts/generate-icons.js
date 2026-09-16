import { Jimp } from 'jimp'

const sizes = [
  { folder: 'mipmap-mdpi', size: 48 },
  { folder: 'mipmap-hdpi', size: 72 },
  { folder: 'mipmap-xhdpi', size: 96 },
  { folder: 'mipmap-xxhdpi', size: 144 },
  { folder: 'mipmap-xxxhdpi', size: 192 },
]

async function generateIcons() {
  const source = await Jimp.read('assets/icon.png')

  for (const { folder, size } of sizes) {
    const basePath = `android/app/src/main/res/${folder}`
    const resized = source.clone().cover({ w: size, h: size })

    await resized.write(`${basePath}/ic_launcher.png`)
    await resized.write(`${basePath}/ic_launcher_round.png`)
    await resized.write(`${basePath}/ic_launcher_foreground.png`)

    console.log(`Generated ${size}x${size} icons in ${folder}`)
  }

  // Also generate 512x512 for Play Store
  await source.clone().cover({ w: 512, h: 512 }).write('assets/icon-512.png')
  console.log('Done!')
}

generateIcons().catch(console.error)
