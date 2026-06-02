import { test, expect, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

const SHOT_DIR = path.join(__dirname, '..', 'screenshots')
if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true })

async function shot(page: Page, name: string) {
  const p = path.join(SHOT_DIR, `${name}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 ${name}`)
  return p
}

function collectErrors(page: Page): string[] {
  const errs: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errs.push(msg.text()) })
  page.on('pageerror', err => errs.push(err.message))
  return errs
}

/** Boot the game and dismiss the title screen */
async function boot(page: Page) {
  await page.goto('/')
  await page.waitForTimeout(2000) // let Three.js + HUD initialise
  // Title screen covers the viewport (pointer-events:auto, z-index:100).
  // Click at centre coords (bypasses actionability checks) then press Space.
  await page.mouse.click(640, 360)
  await page.keyboard.press('Space')
  await page.waitForTimeout(600) // let title fade + game loop stabilise
}

test.describe('STARDRIFT — visual smoke tests', () => {

  test('1. Page loads — canvas renders, no JS errors', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible({ timeout: 10_000 })
    await shot(page, '01-initial-load')
    expect(errors, `JS errors on load:\n${errors.join('\n')}`).toHaveLength(0)
  })

  test('2. Title screen shown before input — STARDRIFT text visible', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    await page.waitForTimeout(1500)
    await shot(page, '02-title-screen')
    // Title screen div should be visible (pointer-events:auto, z-index:100)
    const title = page.getByText('STARDRIFT')
    await expect(title).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('3. Dismiss title with Space — title screen hides', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')
    await page.waitForTimeout(2000)
    await shot(page, '03a-before-dismiss')
    await page.mouse.click(640, 360) // click title overlay to focus page
    await page.keyboard.press('Space')
    await page.waitForTimeout(600)
    await shot(page, '03b-after-dismiss')
    // Title screen should now be hidden (display:none)
    const title = page.getByText('STARDRIFT').first()
    await expect(title).toBeHidden()
    expect(errors).toHaveLength(0)
  })

  test('4. Canvas fills the viewport', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThan(800)
    expect(box!.height).toBeGreaterThan(400)
    await shot(page, '04-canvas-dimensions')
  })

  test('5. Walking mode — WASD moves character', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)
    await shot(page, '05a-walking-start')

    // Walk forward
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(700)
    await page.keyboard.up('KeyW')
    await shot(page, '05b-walk-forward')

    // Strafe right
    await page.keyboard.down('KeyD')
    await page.waitForTimeout(500)
    await page.keyboard.up('KeyD')
    await shot(page, '05c-strafe-right')

    expect(errors).toHaveLength(0)
  })

  test('6. Sit at helm (F key) — enters piloting mode', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)

    // Character starts near helm — press F to sit
    await page.keyboard.press('KeyF')
    await page.waitForTimeout(600)
    await shot(page, '06-piloting-mode')

    // HUD mode indicator should say "piloting" (not walking)
    // Also verify no crash
    expect(errors).toHaveLength(0)
  })

  test('7. Piloting — throttle up (Shift) and yaw (A/D)', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)
    await page.keyboard.press('KeyF') // sit at helm
    await page.waitForTimeout(400)

    await page.keyboard.down('ShiftLeft') // boost
    await page.waitForTimeout(1200)
    await page.keyboard.up('ShiftLeft')
    await shot(page, '07a-throttle-boost')

    await page.keyboard.down('KeyA') // yaw left
    await page.waitForTimeout(700)
    await page.keyboard.up('KeyA')
    await shot(page, '07b-yaw-left')

    await page.keyboard.down('KeyD') // yaw right
    await page.waitForTimeout(700)
    await page.keyboard.up('KeyD')
    await shot(page, '07c-yaw-right')

    expect(errors).toHaveLength(0)
  })

  test('8. Exterior view toggle (Tab)', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)
    await page.keyboard.press('KeyF') // sit at helm
    await page.waitForTimeout(400)

    await page.keyboard.press('Tab') // exterior view
    await page.waitForTimeout(600)
    await shot(page, '08a-exterior-view')

    await page.keyboard.press('Tab') // back to cockpit
    await page.waitForTimeout(400)
    await shot(page, '08b-back-to-cockpit')

    expect(errors).toHaveLength(0)
  })

  test('9. P key triggers asteroid event in piloting mode', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)
    await page.keyboard.press('KeyF') // sit at helm
    await page.waitForTimeout(400)

    await page.keyboard.press('KeyP') // debug: trigger asteroid
    await page.waitForTimeout(1000)
    await shot(page, '09-asteroid-event')

    expect(errors).toHaveLength(0)
  })

  test('10. Leave helm (F again) — returns to walking mode', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)
    await page.keyboard.press('KeyF') // sit
    await page.waitForTimeout(400)
    await page.keyboard.press('KeyF') // leave
    await page.waitForTimeout(400)
    await shot(page, '10-back-to-walking')
    expect(errors).toHaveLength(0)
  })

  test('11. Jump and crouch in walking mode', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)
    await page.keyboard.press('Space') // jump
    await page.waitForTimeout(600)
    await shot(page, '11a-jump')
    await page.keyboard.press('KeyC') // crouch
    await page.waitForTimeout(400)
    await shot(page, '11b-crouch')
    expect(errors).toHaveLength(0)
  })

  test('12. No crash after 10 seconds idle (events, physics running)', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)
    await page.keyboard.press('KeyF') // sit at helm — events start firing
    await page.waitForTimeout(10_000)
    await shot(page, '12-10s-idle')
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    expect(errors).toHaveLength(0)
  })

  test('13. Planet visible — icy sphere renders without errors', async ({ page }) => {
    const errors = collectErrors(page)
    await boot(page)
    await page.keyboard.press('KeyF')       // sit at helm
    await page.waitForTimeout(400)
    await page.keyboard.down('ShiftLeft')   // boost toward planet (spawns at z=-500)
    await page.waitForTimeout(2500)
    await page.keyboard.up('ShiftLeft')
    await shot(page, '13-planet-icy-approach')
    expect(errors).toHaveLength(0)
  })

})
