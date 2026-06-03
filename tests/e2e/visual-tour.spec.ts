import { test, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const SHOT_DIR   = path.join(__dirname, '..', 'tour')
fs.mkdirSync(SHOT_DIR, { recursive: true })

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) })
}

async function boot(page: Page) {
  await page.goto('/')
  await page.waitForTimeout(2000)
  await page.mouse.click(640, 360)
  await page.keyboard.press('Space')
  await page.waitForTimeout(800)
}

// Inject a helper that lets us warp the character to a position
async function warpCharacter(page: Page, x: number, y: number, z: number) {
  await page.evaluate(([px, py, pz]) => {
    // Access Three.js scene — character position is stored on shipGroup children
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    void canvas   // just ensure scene is ready
    // The game loop reads charWorldPos, but we can trigger the mode change
    // by dispatching a synthetic keydown after warping via DOM
    void [px, py, pz]
  }, [x, y, z])
}
void warpCharacter  // suppress unused warning

test('visual tour', async ({ page }) => {
  // ── 1. Title screen ───────────────────────────────────────────────────────
  await page.goto('/')
  await page.waitForTimeout(2000)
  await shot(page, '1-title')

  // ── 2. Cockpit — walking mode ─────────────────────────────────────────────
  await boot(page)
  await shot(page, '2-walking-cockpit')

  // ── 3. Cockpit — looking at helm & consoles (walk forward 2 s) ───────────
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2000)   // 2s × 4 m/s = 8m → past the helm
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(300)
  await shot(page, '3-walked-to-helm')

  // ── 4. Piloting mode (F key — character should now be inside isNearHelm) ──
  // Walk backward just a touch so character is AT the helm (z ~1.5)
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(500)
  await page.keyboard.up('KeyS')
  await page.keyboard.press('KeyF')
  await page.waitForTimeout(600)
  await shot(page, '4-piloting-cockpit')

  // ── 5. Planet — fly toward it ─────────────────────────────────────────────
  await page.keyboard.down('ShiftLeft')
  await page.waitForTimeout(4000)
  await page.keyboard.up('ShiftLeft')
  await shot(page, '5-planet-approach')

  // ── 6. Exterior view (Tab) ────────────────────────────────────────────────
  await page.keyboard.press('Tab')
  await page.waitForTimeout(600)
  await shot(page, '6-exterior-ship')

  // ── 7. Back to cockpit piloting ───────────────────────────────────────────
  await page.keyboard.press('Tab')
  await page.waitForTimeout(400)
  await shot(page, '7-cockpit-piloting')

  // ── 8. Asteroid event (P key) ─────────────────────────────────────────────
  await page.keyboard.press('KeyP')
  await page.waitForTimeout(1000)
  await shot(page, '8-asteroid-warning')

  // ── 9. Leave helm → walk to back of ship → corridor ───────────────────────
  await page.keyboard.press('KeyF')     // leave helm
  await page.waitForTimeout(400)
  await page.keyboard.down('KeyS')      // walk backward through ship
  await page.waitForTimeout(3500)
  await page.keyboard.up('KeyS')
  await page.waitForTimeout(300)
  await shot(page, '9-corridor-hangar')

  // ── 10. Walk further — hangar area ────────────────────────────────────────
  await page.keyboard.down('KeyS')
  await page.waitForTimeout(2500)
  await page.keyboard.up('KeyS')
  await page.waitForTimeout(300)
  await shot(page, '10-hangar-subship')
})
