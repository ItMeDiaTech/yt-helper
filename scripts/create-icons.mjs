/**
 * Icon generation script
 * Converts YT-Icon.jpg to PNG and ICO formats for Electron
 */

import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const sourceImage = join(projectRoot, 'YT-Icon.jpg')
const resourcesDir = join(projectRoot, 'resources')

// Ensure resources directory exists
if (!existsSync(resourcesDir)) {
  mkdirSync(resourcesDir, { recursive: true })
}

async function createIcons() {
  console.log('Creating icons from YT-Icon.jpg...')

  // Create PNG at 256x256 (standard size for icons)
  const pngPath = join(resourcesDir, 'icon.png')
  await sharp(sourceImage)
    .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(pngPath)
  console.log('Created:', pngPath)

  // Create additional sizes for ICO
  const sizes = [16, 32, 48, 256]
  const pngBuffers = await Promise.all(
    sizes.map(size =>
      sharp(sourceImage)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()
    )
  )

  // Create ICO from PNG buffers
  const icoBuffer = await pngToIco(pngBuffers)
  const icoPath = join(resourcesDir, 'icon.ico')
  writeFileSync(icoPath, icoBuffer)
  console.log('Created:', icoPath)

  console.log('Icon generation complete!')
}

createIcons().catch(err => {
  console.error('Error creating icons:', err)
  process.exit(1)
})
