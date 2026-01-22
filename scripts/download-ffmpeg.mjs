/**
 * FFmpeg download script
 * Downloads ffmpeg binaries for bundling with the application.
 */

import { createWriteStream, existsSync, mkdirSync, unlinkSync, createReadStream } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import { createUnzip } from 'zlib'
import { Extract } from 'unzipper'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const ffmpegDir = join(projectRoot, 'python', 'ffmpeg')

// FFmpeg download URL (essentials build from gyan.dev - trusted source)
const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'

async function downloadFile(url, dest) {
  console.log(`Downloading from ${url}...`)
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }

  const fileStream = createWriteStream(dest)
  await pipeline(response.body, fileStream)
  console.log(`Downloaded to ${dest}`)
}

async function extractFFmpeg(zipPath, destDir) {
  console.log(`Extracting ffmpeg to ${destDir}...`)

  return new Promise((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(Extract({ path: destDir }))
      .on('close', resolve)
      .on('error', reject)
  })
}

async function findAndCopyBinaries(extractDir, destDir) {
  const { readdir, copyFile, stat } = await import('fs/promises')

  // Find the extracted folder (e.g., ffmpeg-7.0-essentials_build)
  const entries = await readdir(extractDir)
  const ffmpegFolder = entries.find(e => e.startsWith('ffmpeg-'))

  if (!ffmpegFolder) {
    throw new Error('Could not find ffmpeg folder in extracted archive')
  }

  const binDir = join(extractDir, ffmpegFolder, 'bin')

  // Copy the binaries we need
  const binaries = ['ffmpeg.exe', 'ffprobe.exe']

  for (const binary of binaries) {
    const src = join(binDir, binary)
    const dest = join(destDir, binary)

    if (existsSync(src)) {
      await copyFile(src, dest)
      const stats = await stat(dest)
      console.log(`Copied ${binary} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`)
    } else {
      console.warn(`Warning: ${binary} not found in ${binDir}`)
    }
  }
}

async function cleanup(tempDir, zipPath) {
  const { rm } = await import('fs/promises')

  try {
    if (existsSync(zipPath)) {
      unlinkSync(zipPath)
      console.log('Cleaned up zip file')
    }
    if (existsSync(tempDir)) {
      await rm(tempDir, { recursive: true })
      console.log('Cleaned up temp directory')
    }
  } catch (error) {
    console.warn('Cleanup warning:', error.message)
  }
}

async function main() {
  console.log('FFmpeg Download Script')
  console.log('======================')

  // Check if ffmpeg already exists
  const ffmpegExe = join(ffmpegDir, 'ffmpeg.exe')
  const ffprobeExe = join(ffmpegDir, 'ffprobe.exe')

  if (existsSync(ffmpegExe) && existsSync(ffprobeExe)) {
    console.log('FFmpeg binaries already exist, skipping download.')
    return
  }

  // Create directories
  if (!existsSync(ffmpegDir)) {
    mkdirSync(ffmpegDir, { recursive: true })
  }

  const tempDir = join(projectRoot, 'temp-ffmpeg')
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true })
  }

  const zipPath = join(tempDir, 'ffmpeg.zip')

  try {
    // Download
    await downloadFile(FFMPEG_URL, zipPath)

    // Extract
    await extractFFmpeg(zipPath, tempDir)

    // Copy binaries
    await findAndCopyBinaries(tempDir, ffmpegDir)

    console.log('\nFFmpeg binaries installed successfully!')
    console.log(`Location: ${ffmpegDir}`)

  } catch (error) {
    console.error('Error downloading ffmpeg:', error.message)
    process.exit(1)
  } finally {
    // Cleanup
    await cleanup(tempDir, zipPath)
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
