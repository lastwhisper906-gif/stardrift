import type { ShipState, GamePhase } from '../state/GameState.js'

const PANEL_BASE = `
  position:absolute;
  background:rgba(0,12,25,0.58);
  border:1px solid rgba(0,255,136,0.16);
  padding:10px 14px;
  border-radius:3px;
  line-height:1.7;
  text-shadow:0 0 7px currentColor;
`

function bar(fillId: string, trackColor: string): string {
  return `<span style="display:inline-block;width:76px;height:7px;background:${trackColor};border:1px solid rgba(255,255,255,0.12);vertical-align:middle;border-radius:2px"><span id="${fillId}" style="display:block;height:100%;width:100%;border-radius:2px;transition:width 0.12s,background 0.3s"></span></span>`
}

export class HUD {
  private readonly root: HTMLDivElement
  private readonly speedEl: HTMLElement
  private readonly thrFill: HTMLElement
  private readonly thrVal: HTMLElement
  private readonly hullFill: HTMLElement
  private readonly hullVal: HTMLElement
  private readonly o2Fill: HTMLElement
  private readonly o2Val: HTMLElement
  private readonly warningPanel: HTMLElement
  private readonly distEl: HTMLElement
  private readonly damageOverlay: HTMLElement
  private interactPrompt!: HTMLElement
  private repairPrompt!: HTMLElement
  private alienPanel!: HTMLElement
  private alienDistEl!: HTMLElement
  private alienHpEl!: HTMLElement
  private prevHull = 100

  constructor() {
    this.root = document.createElement('div')
    this.root.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      pointer-events:none;
      font-family:'Courier New',monospace;
      font-size:12px;
      color:#00ff88;
    `

    // ── Top-left: Speed + Throttle ───────────────────────────────────────
    const tlPanel = document.createElement('div')
    tlPanel.style.cssText = PANEL_BASE + 'top:14px;left:14px;min-width:170px;'
    tlPanel.innerHTML = `
      <div>SPD &nbsp;<span id="hud-spd" style="color:#88ffcc;font-size:14px;font-weight:bold">0.0</span> <span style="color:#4488aa;font-size:10px">m/s</span></div>
      <div style="margin-top:2px">THR &nbsp;${bar('hud-thr-fill', '#001a0a')} <span id="hud-thr-val" style="color:#88ffcc;margin-left:5px">0%</span></div>
    `
    this.root.appendChild(tlPanel)

    // ── Top-right: Hull + Oxygen ─────────────────────────────────────────
    const trPanel = document.createElement('div')
    trPanel.style.cssText = PANEL_BASE + 'top:14px;right:14px;min-width:180px;text-align:right;'
    trPanel.innerHTML = `
      <div>HULL &nbsp;${bar('hud-hull-fill', '#1a0000')} <span id="hud-hull-val" style="color:#88ffcc;margin-left:5px">100%</span></div>
      <div style="margin-top:2px">O₂ &nbsp;&nbsp;&nbsp;${bar('hud-o2-fill', '#00061a')} <span id="hud-o2-val" style="color:#88ccff;margin-left:5px">100%</span></div>
    `
    this.root.appendChild(trPanel)

    // ── Top-center: Event warning ─────────────────────────────────────────
    const warnPanel = document.createElement('div')
    warnPanel.style.cssText = `
      position:absolute;top:14px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(40,15,0,0.65);
      border:1px solid rgba(255,160,0,0.35);
      padding:8px 20px;border-radius:3px;
      text-shadow:0 0 10px #ffaa00;
    `
    warnPanel.innerHTML = `
      <div id="hud-warn-text" style="color:#ffaa00;font-size:15px;font-weight:bold;letter-spacing:3px">⚠ ASTEROID INCOMING ⚠</div>
      <div id="hud-dist" style="color:#ffcc66;font-size:11px;margin-top:3px">DIST: ---</div>
    `
    this.root.appendChild(warnPanel)

    // ── F-key interact prompt (bottom center) ────────────────────────────
    const interactPrompt = document.createElement('div')
    interactPrompt.style.cssText = `
      position:absolute;bottom:28px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(0,20,40,0.60);
      border:1px solid rgba(0,170,255,0.35);
      padding:6px 18px;border-radius:3px;
      color:#00aaff;font-size:13px;letter-spacing:2px;
      text-shadow:0 0 8px #00aaff;
    `
    interactPrompt.textContent = '[F]  SIT AT HELM'
    this.root.appendChild(interactPrompt)

    // ── Repair prompt (secondary prompt above interact) ───────────────────
    const repairPrompt = document.createElement('div')
    repairPrompt.style.cssText = `
      position:absolute;bottom:68px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(0,25,0,0.65);
      border:1px solid rgba(0,255,100,0.35);
      padding:6px 18px;border-radius:3px;
      color:#00ff88;font-size:13px;letter-spacing:2px;
      text-shadow:0 0 8px #00ff88;
    `
    this.root.appendChild(repairPrompt)

    // ── Alien encounter warning panel ─────────────────────────────────────
    const alienPanel = document.createElement('div')
    alienPanel.style.cssText = `
      position:absolute;top:14px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(0,25,5,0.65);
      border:1px solid rgba(0,200,80,0.35);
      padding:8px 20px;border-radius:3px;
      text-shadow:0 0 10px #00ff44;
    `
    alienPanel.innerHTML = `
      <div style="color:#00ff44;font-size:15px;font-weight:bold;letter-spacing:3px">⚠ ALIEN VESSEL ⚠</div>
      <div id="hud-alien-dist" style="color:#88ffaa;font-size:11px;margin-top:3px">DIST: ---</div>
      <div id="hud-alien-hp" style="color:#88ffaa;font-size:11px">HULL: ████</div>
    `
    this.root.appendChild(alienPanel)

    // ── Damage vignette overlay ───────────────────────────────────────────
    const dmg = document.createElement('div')
    dmg.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:radial-gradient(ellipse at center,transparent 35%,rgba(220,0,0,0.7) 100%);
      pointer-events:none;opacity:0;
    `
    this.root.appendChild(dmg)

    document.body.appendChild(this.root)

    this.speedEl = document.getElementById('hud-spd')!
    this.thrFill = document.getElementById('hud-thr-fill')!
    this.thrVal = document.getElementById('hud-thr-val')!
    this.hullFill = document.getElementById('hud-hull-fill')!
    this.hullVal = document.getElementById('hud-hull-val')!
    this.o2Fill = document.getElementById('hud-o2-fill')!
    this.o2Val = document.getElementById('hud-o2-val')!
    this.warningPanel = warnPanel
    this.distEl         = document.getElementById('hud-dist')!
    this.interactPrompt = interactPrompt
    this.repairPrompt   = repairPrompt
    this.alienPanel     = alienPanel
    this.alienDistEl    = document.getElementById('hud-alien-dist')!
    this.alienHpEl      = document.getElementById('hud-alien-hp')!
    this.damageOverlay = dmg
  }

  update(ship: ShipState, phase: GamePhase, asteroidDist?: number): void {
    // Speed
    const spd = Math.sqrt(ship.velocity[0] ** 2 + ship.velocity[1] ** 2 + ship.velocity[2] ** 2)
    this.speedEl.textContent = spd.toFixed(1)

    // Throttle (max = 5)
    const thrPct = Math.max(0, Math.min(100, (ship.throttle / 5) * 100))
    this.thrFill.style.width = `${thrPct}%`
    this.thrFill.style.background = thrPct > 75 ? '#ffaa00' : '#00ff88'
    this.thrVal.textContent = `${Math.round(thrPct)}%`

    // Hull
    const hull = Math.max(0, Math.min(100, ship.hull))
    this.hullFill.style.width = `${hull}%`
    this.hullFill.style.background = hull < 30 ? '#ff3333' : hull < 60 ? '#ffaa00' : '#00ff88'
    this.hullVal.style.color = hull < 30 ? '#ff6666' : '#88ffcc'
    this.hullVal.textContent = `${Math.round(hull)}%`

    // Oxygen
    const o2 = Math.max(0, Math.min(100, ship.oxygen))
    this.o2Fill.style.width = `${o2}%`
    this.o2Fill.style.background = o2 < 25 ? '#ff5500' : '#0088ff'
    this.o2Val.textContent = `${Math.round(o2)}%`

    // Damage flash
    if (ship.hull < this.prevHull) this.flashDamage()
    this.prevHull = ship.hull

    // Asteroid warning
    if (phase === 'IN_EVENT' && asteroidDist !== undefined) {
      this.warningPanel.style.display = 'block'
      this.distEl.textContent = `DIST: ${Math.round(asteroidDist)} m`
    } else {
      this.warningPanel.style.display = 'none'
    }
  }

  setInteractPrompt(show: boolean): void {
    this.interactPrompt.style.display = show ? 'block' : 'none'
  }

  setRepairPrompt(show: boolean, hull: number): void {
    this.repairPrompt.style.display = show ? 'block' : 'none'
    if (show) {
      this.repairPrompt.textContent = hull < 100
        ? `HOLD [E] TO REPAIR — HULL ${Math.round(hull)}%`
        : 'HULL INTACT'
    }
  }

  setAlienWarning(show: boolean, dist?: number, health?: number): void {
    this.alienPanel.style.display = show ? 'block' : 'none'
    if (show && dist !== undefined && health !== undefined) {
      this.alienDistEl.textContent = `DIST: ${Math.round(dist)} m`
      const bars = '█'.repeat(Math.max(0, health)) + '░'.repeat(Math.max(0, 4 - health))
      this.alienHpEl.textContent   = `HULL: ${bars}`
    }
  }

  private flashDamage(): void {
    this.damageOverlay.style.transition = 'none'
    this.damageOverlay.style.opacity = '1'
    requestAnimationFrame(() => {
      this.damageOverlay.style.transition = 'opacity 0.65s ease-out'
      this.damageOverlay.style.opacity = '0'
    })
  }
}
