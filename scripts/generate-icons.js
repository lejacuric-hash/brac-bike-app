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
  const sourceWidth = source.bitmap.width
  const sourceHeight = source.bitmap.height

  for (const { folder, size } of sizes) {
    const basePath = `android/app/src/main/res/${folder}`

    // Create purple background
    const background = new Jimp({
      width: size,
      height: size,
      color: 0x370063ff, // #370063 fully opaque
    })

    // Calculate logo size with 15% padding on each side
    const padding = Math.round(size * 0.15)
    const maxLogoSize = size - padding * 2

    // Scale logo to fit within maxLogoSize x maxLogoSize
    const scale = Math.min(maxLogoSize / sourceWidth, maxLogoSize / sourceHeight)
    const logoWidth = Math.round(sourceWidth * scale)
    const logoHeight = Math.round(sourceHeight * scale)

    const logo = source.clone().resize({ w: logoWidth, h: logoHeight })

    // Center the logo on the background
    const x = Math.round((size - logoWidth) / 2)
    const y = Math.round((size - logoHeight) / 2)

    background.composite(logo, x, y)

    await background.write(`${basePath}/ic_launcher.png`)
    await background.write(`${basePath}/ic_launcher_round.png`)
    await background.write(`${basePath}/ic_launcher_foreground.png`)

    console.log(`Generated ${size}x${size} icons in ${folder}`)
  }

  // 512x512 for Play Store
  const bg512 = new Jimp({ width: 512, height: 512, color: 0x370063ff })
  const scale512 = Math.min((512 * 0.7) / sourceWidth, (512 * 0.7) / sourceHeight)
  const logo512 = source.clone().resize({
    w: Math.round(sourceWidth * scale512),
    h: Math.round(sourceHeight * scale512),
  })
  bg512.composite(
    logo512,
    Math.round((512 - logo512.bitmap.width) / 2),
    Math.round((512 - logo512.bitmap.height) / 2)
  )
  await bg512.write('assets/icon-512.png')

  console.log('Done!')
}

generateIcons().catch(console.error)
