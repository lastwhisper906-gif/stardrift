import { test, expect, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const SHOT_DIR   = path.join(__dirname, '..', 'verify112')
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dbg = (page: Page, fn: string) => page.evaluate((f) => (window as any).__debug[f](), fn)

async function pollUntil(page: Page, check: () => Promise<boolean>, timeoutMs = 25000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await check()) return true
    await page.waitForTimeout(250)
  }
  return false
}

test('Issue 112 — land on planet, character floats ~3 m above surface', async ({ page }) => {
  // Headless rAF throttles to ~4 fps and dt is clamped to 0.05 s, so the
  // cinematic landing sequence advances ~5x slower than wall-clock.
  test.setTimeout(300000)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

  await boot(page)

  // ── Board the subship and launch ──────────────────────────────────────────
  await dbg(page, 'teleportToSubship')
  await page.waitForTimeout(300)
  await page.keyboard.press('KeyF')          // board → subship_piloting (docked)
  await page.waitForTimeout(400)
  await page.keyboard.press('KeyF')          // start launch (hatch_open → descending)

  const flying = await pollUntil(page, async () =>
    (await dbg(page, 'getLaunchPhase')) === 'flying', 70000)
  expect(flying, 'subship reached flying phase').toBe(true)

  // ── Warp to the planet and trigger the landing sequence ───────────────────
  await dbg(page, 'teleportSubshipToPlanet')
  await page.waitForTimeout(300)
  const landed = await dbg(page, 'triggerLand')
  expect(landed, 'triggerLand accepted').toBe(true)

  // Mid-descent screenshot (cinematic touchdown in progress).
  await page.waitForTimeout(1500)
  await shot(page, '1-touching-down')

  // ── Wait through touching_down → disembarking → tethering → on_surface ────
  let lastState: unknown = null
  const onSurface = await pollUntil(page, async () => {
    lastState = await dbg(page, 'getLandState')
    return (lastState as { surfaceLandPhase: string }).surfaceLandPhase === 'on_surface'
  }, 160000)
  expect(onSurface, `reached on_surface phase; last=${JSON.stringify(lastState)}`).toBe(true)

  await page.waitForTimeout(500)
  await shot(page, '2-on-surface-floating')

  // ── Verify the character floats ~3 m above the sphere ─────────────────────
  const mode = await dbg(page, 'getMode')
  expect(mode, 'camera in planet_surface mode').toBe('planet_surface')

  const zg = await dbg(page, 'getSurfaceZeroG') as { distFromCenter: number }
  // PLANET_RADIUS (350) + SURFACE_FOOT (3.0) = 353 at the foot.
  expect(zg.distFromCenter, 'character floats ~3 m above radius 350')
    .toBeGreaterThan(352)
  expect(zg.distFromCenter).toBeLessThan(354)

  expect(errors, `JS errors:\n${errors.join('\n')}`).toHaveLength(0)
})
