import { test, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const OUT = path.join(__dirname, '..', 'tour')
fs.mkdirSync(OUT, { recursive: true })

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  console.log(`📸 ${name}`)
}

async function boot(page: Page) {
  await page.goto('http://localhost:3000')
  await page.waitForTimeout(2500)
  await page.mouse.click(640, 360)
  await page.keyboard.press('Space')
  await page.waitForTimeout(1000)
}

// Walk until the HUD mode indicator shows a given text
async function waitForMode(page: Page, modeText: string, timeout = 8000) {
  await page.waitForFunction(
    (txt) => {
      const body = document.body.innerText
      return body.includes(txt)
    },
    modeText,
    { timeout }
  ).catch(() => console.log(`  timeout waiting for mode: ${modeText}`))
}

test.use({ headless: false, viewport: { width: 1280, height: 720 } })

test('full game tour', async ({ page }) => {
  // ── 1. TITLE SCREEN ────────────────────────────────────────────────────────
  await page.goto('http://localhost:3000')
  await page.waitForTimeout(2000)
  await shot(page, '01-title')

  // ── 2. COCKPIT — WALKING ────────────────────────────────────────────────────
  await page.mouse.click(640, 360)
  await page.keyboard.press('Space')
  await page.waitForTimeout(1200)
  await shot(page, '02-cockpit-walking')

  // ── 3. WALK TO HELM (character needs to reach z < 1.8) ─────────────────────
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2200)   // 4 m/s × 2.2s = 8.8m → past helm
  await page.keyboard.up('KeyW')
  // Step back to helm zone
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(800)
  await page.keyboard.up('KeyS')
  await page.waitForTimeout(300)
  await shot(page, '03-at-helm')

  // ── 4. PILOTING MODE ───────────────────────────────────────────────────────
  await page.keyboard.press('KeyF')
  await page.waitForTimeout(800)
  await waitForMode(page, 'PILOTING')
  await shot(page, '04-piloting-1stperson')

  // ── 5. THROTTLE UP — fly toward planet ─────────────────────────────────────
  await page.keyboard.down('ShiftLeft')
  await page.waitForTimeout(3000)
  await page.keyboard.up('ShiftLeft')
  await shot(page, '05-boosting-to-planet')

  // ── 6. PLANET CLOSE-UP ─────────────────────────────────────────────────────
  await page.keyboard.down('ShiftLeft')
  await page.waitForTimeout(3500)
  await page.keyboard.up('ShiftLeft')
  await shot(page, '06-planet-surface-closeup')

  // ── 7. EXTERIOR VIEW ───────────────────────────────────────────────────────
  await page.keyboard.press('Tab')
  await page.waitForTimeout(800)
  await waitForMode(page, 'EXT VIEW')
  await shot(page, '07-exterior-view')

  // ── 8. ASTEROID EVENT ──────────────────────────────────────────────────────
  await page.keyboard.press('Tab')   // back to piloting
  await page.waitForTimeout(500)
  await page.keyboard.press('KeyP')  // trigger asteroid
  await page.waitForTimeout(1500)
  await shot(page, '08-asteroid-event')

  // ── 9. BACK TO WALKING ─────────────────────────────────────────────────────
  await page.keyboard.press('KeyF')  // leave helm
  await page.waitForTimeout(600)
  await waitForMode(page, 'WALKING')
  await shot(page, '09-back-to-walking')

  // ── 10. WALK TO CORRIDOR ───────────────────────────────────────────────────
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(3000)
  await page.keyboard.up('KeyS')
  await page.waitForTimeout(300)
  await shot(page, '10-corridor')

  // ── 11. HANGAR + SUBSHIP ───────────────────────────────────────────────────
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(3000)
  await page.keyboard.up('KeyS')
  await page.waitForTimeout(300)
  await shot(page, '11-hangar-subship')

  // ── 12. SIT IN SUBSHIP ─────────────────────────────────────────────────────
  await page.keyboard.press('KeyF')
  await page.waitForTimeout(800)
  await waitForMode(page, 'SUB-SHIP')
  await shot(page, '12-subship-cockpit')
})
