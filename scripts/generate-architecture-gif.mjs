import { chromium } from 'playwright'
import { execSync } from 'child_process'
import { mkdirSync, rmSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const framesDir = join(projectRoot, 'frames')
const htmlPath = join(projectRoot, 'architecture-animated.html')
const outputGif = join(projectRoot, 'architecture.gif')

async function generateGif() {
  console.log('🎬 Starting GIF generation...')

  // Clean up and create frames directory
  if (existsSync(framesDir)) {
    rmSync(framesDir, { recursive: true })
  }
  mkdirSync(framesDir)

  // Launch browser
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setViewportSize({ width: 1000, height: 900 })

  // Load the HTML file
  await page.goto(`file://${htmlPath}`)
  await page.waitForTimeout(500) // Let animations initialize

  console.log('📸 Capturing frames...')

  // Capture 60 frames over 3 seconds (20 fps)
  const totalFrames = 60
  const frameDelay = 50 // 50ms between frames

  for (let i = 0; i < totalFrames; i++) {
    const frameNum = String(i).padStart(4, '0')
    await page.screenshot({
      path: join(framesDir, `frame-${frameNum}.png`),
      fullPage: false
    })
    await page.waitForTimeout(frameDelay)

    if (i % 10 === 0) {
      console.log(`  Frame ${i + 1}/${totalFrames}`)
    }
  }

  await browser.close()
  console.log('✅ Frames captured!')

  // Convert to GIF using ffmpeg
  console.log('🎞️  Converting to GIF...')
  try {
    execSync(`ffmpeg -y -framerate 20 -i "${framesDir}/frame-%04d.png" -vf "fps=15,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" "${outputGif}"`, {
      stdio: 'inherit'
    })
    console.log(`\n✅ GIF created: ${outputGif}`)
  } catch (err) {
    console.error('❌ ffmpeg error:', err.message)
  }

  // Cleanup frames
  rmSync(framesDir, { recursive: true })
  console.log('🧹 Cleaned up temporary frames')
}

generateGif().catch(console.error)
