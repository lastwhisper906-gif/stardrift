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
  private readonly warnTextEl: HTMLElement
  private readonly damageOverlay: HTMLElement
  private interactPrompt!: HTMLElement
  private launchPrompt!: HTMLElement
  private repairPrompt!: HTMLElement
  private alienPanel!: HTMLElement
  private alienDistEl!: HTMLElement
  private alienHpEl!: HTMLElement
  private gameOverlay!: HTMLElement
  private modeIndicator!: HTMLElement
  private missionPanel!: HTMLElement
  private missionFill!: HTMLElement
  private missionDist!: HTMLElement
  private o2Prompt!: HTMLElement
  private hitFlash!: HTMLElement
  private titleScreen!: HTMLElement
  private combatPrompt!: HTMLElement
  private stationPanel!: HTMLElement
  private stationText!: HTMLElement
  private dockBanner!: HTMLElement
  private dockPrompt!: HTMLElement
  private landPrompt!: HTMLElement
  private anchorPrompt!: HTMLElement
  private mineralRow!: HTMLElement
  private mineralFill!: HTMLElement
  private mineralVal!: HTMLElement
  private evaBanner!: HTMLElement
  private surfaceLockHint!: HTMLElement
  private surfaceControlHint!: HTMLElement
  private dockTimer = 0
  private prevHull = 100
  private _titleDismissed = false

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

    // ── Top-right: Hull + Oxygen + Minerals ─────────────────────────────────
    const trPanel = document.createElement('div')
    trPanel.style.cssText = PANEL_BASE + 'top:14px;right:14px;min-width:180px;text-align:right;'
    trPanel.innerHTML = `
      <div>HULL &nbsp;${bar('hud-hull-fill', '#1a0000')} <span id="hud-hull-val" style="color:#88ffcc;margin-left:5px">100%</span></div>
      <div style="margin-top:2px">O₂ &nbsp;&nbsp;&nbsp;${bar('hud-o2-fill', '#00061a')} <span id="hud-o2-val" style="color:#88ccff;margin-left:5px">100%</span></div>
      <div id="hud-min-row" style="margin-top:2px;display:none">MIN &nbsp;&nbsp;${bar('hud-min-fill', '#001a1a')} <span id="hud-min-val" style="color:#00ffcc;margin-left:5px">0</span></div>
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

    // ── Launch prompt (shown when inside sub-ship, not yet launched) ──────
    const launchPrompt = document.createElement('div')
    launchPrompt.style.cssText = `
      position:absolute;bottom:68px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(25,10,0,0.70);
      border:1px solid rgba(255,140,0,0.50);
      padding:8px 22px;border-radius:3px;
      color:#ffaa00;font-size:13px;letter-spacing:2px;
      text-shadow:0 0 10px #ff8800;
    `
    launchPrompt.textContent = '[F]  출격  LAUNCH'
    this.root.appendChild(launchPrompt)

    // ── Dock/return prompt (shown when subship flying near main ship) ──────
    const dockPrompt = document.createElement('div')
    dockPrompt.style.cssText = `
      position:absolute;bottom:68px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(0,20,35,0.72);
      border:1px solid rgba(0,200,255,0.50);
      padding:8px 22px;border-radius:3px;
      color:#00ccff;font-size:13px;letter-spacing:2px;
      text-shadow:0 0 10px #00aaff;
    `
    dockPrompt.textContent = '[F]  복귀  DOCK'
    this.root.appendChild(dockPrompt)

    // ── Land prompt (subship flying near planet surface) ──────────────────
    const landPrompt = document.createElement('div')
    landPrompt.style.cssText = `
      position:absolute;bottom:68px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(10,25,10,0.72);
      border:1px solid rgba(0,220,100,0.50);
      padding:8px 22px;border-radius:3px;
      color:#00ee88;font-size:13px;letter-spacing:2px;
      text-shadow:0 0 10px #00cc66;
    `
    landPrompt.textContent = '[F]  착지  LAND'
    this.root.appendChild(landPrompt)

    // ── Anchor / mining prompt (planet surface mode) ──────────────────────
    const anchorPrompt = document.createElement('div')
    anchorPrompt.style.cssText = `
      position:absolute;bottom:108px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(0,20,15,0.72);
      border:1px solid rgba(0,200,130,0.40);
      padding:8px 22px;border-radius:3px;
      color:#00ddaa;font-size:13px;letter-spacing:2px;
      text-shadow:0 0 8px #00aa88;
    `
    anchorPrompt.textContent = '[E]  앵커 박기'
    this.root.appendChild(anchorPrompt)

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

    // ── Title / start screen ────────────────────────────────────────────────
    const titleScreen = document.createElement('div')
    titleScreen.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(0,0,8,0.95);
      font-family:'Courier New',monospace;
      pointer-events:auto;z-index:100;
    `
    titleScreen.innerHTML = `
      <div style="color:#00ff88;font-size:52px;font-weight:bold;letter-spacing:10px;text-shadow:0 0 30px #00ff88,0 0 60px #00aa55;margin-bottom:10px">STARDRIFT</div>
      <div style="color:#4488aa;font-size:14px;letter-spacing:5px;margin-bottom:36px">DEEP SPACE SURVIVAL MISSION</div>
      <div style="color:#2a3a4a;background:rgba(0,10,20,0.7);border:1px solid rgba(0,100,150,0.2);padding:18px 32px;border-radius:4px;font-size:11px;line-height:2.0;text-align:left;max-width:540px;margin-bottom:30px">
        <span style="color:#4488aa;letter-spacing:2px">WALKING MODE</span>&nbsp;&nbsp;WASD move • Shift run • Space jump • C crouch<br>
        <span style="color:#4488aa;letter-spacing:2px">PILOTING    </span>&nbsp;&nbsp;W/S throttle • A/D yaw • ↑/R pitch • Q/E roll • Z/X vertical<br>
        <span style="color:#4488aa;letter-spacing:2px">INTERACT    </span>&nbsp;&nbsp;F sit/stand • Tab exterior view<br>
        <span style="color:#00ff88;letter-spacing:2px">STATIONS    </span>&nbsp;&nbsp;🟩 REPAIR (left) • 🟦 O₂ (right) — hold E to use<br>
        <span style="color:#ff8844;letter-spacing:2px">EVENTS      </span>&nbsp;&nbsp;ASTEROID: steer away • ALIEN: press Space to fire
      </div>
      <div style="color:#00aaff;font-size:13px;letter-spacing:4px;animation:pulse 1.5s ease-in-out infinite">PRESS ANY KEY TO BEGIN</div>
      <style>@keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}</style>
    `
    this.root.appendChild(titleScreen)

    // ── Station waypoint (bottom-center of top area) ─────────────────────
    const stationPanel = document.createElement('div')
    stationPanel.style.cssText = `
      position:absolute;top:70px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(0,15,25,0.55);
      border:1px solid rgba(0,160,200,0.25);
      padding:5px 16px;border-radius:3px;
      color:#00aacc;font-size:11px;letter-spacing:2px;
    `
    stationPanel.innerHTML = '<span id="hud-station-text">STATION: --- km</span>'
    this.root.appendChild(stationPanel)

    // ── Combat prompt (Space to fire) ─────────────────────────────────────
    const combatPrompt = document.createElement('div')
    combatPrompt.style.cssText = `
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      text-align:center;display:none;
      pointer-events:none;
    `
    combatPrompt.innerHTML = `
      <div style="color:#ff4444;font-size:13px;letter-spacing:3px;text-shadow:0 0 10px #ff4444;animation:pulse 0.8s infinite">⚠ ALIEN IN RANGE — PRESS [SPACE] TO FIRE ⚠</div>
      <style>@keyframes pulse{0%,100%{opacity:0.6}50%{opacity:1}}</style>
    `
    this.root.appendChild(combatPrompt)

    // ── Mission progress (bottom-left) ───────────────────────────────────
    const missionPanel = document.createElement('div')
    missionPanel.style.cssText = PANEL_BASE + 'bottom:14px;left:14px;min-width:180px;'
    missionPanel.innerHTML = `
      <div style="margin-bottom:3px;font-size:10px;color:#4488aa;letter-spacing:2px">MISSION PROGRESS</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:100px;height:6px;background:#001a0a;border:1px solid rgba(255,255,255,0.12);border-radius:2px">
          <span id="hud-miss-fill" style="display:block;height:100%;width:0%;background:#00ff88;border-radius:2px;transition:width 0.3s"></span>
        </span>
        <span id="hud-miss-dist" style="color:#88ffcc;font-size:11px">0.0 km</span>
      </div>
    `
    this.root.appendChild(missionPanel)

    // ── O2 station prompt ─────────────────────────────────────────────────
    const o2Prompt = document.createElement('div')
    o2Prompt.style.cssText = `
      position:absolute;bottom:108px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(0,10,30,0.65);
      border:1px solid rgba(0,120,255,0.35);
      padding:6px 18px;border-radius:3px;
      color:#0088ff;font-size:13px;letter-spacing:2px;
      text-shadow:0 0 8px #0088ff;
    `
    o2Prompt.textContent = 'HOLD [E] TO REFILL O₂'
    this.root.appendChild(o2Prompt)

    // ── Hit flash (green success flash) ───────────────────────────────────
    const hitFlash = document.createElement('div')
    hitFlash.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      background:radial-gradient(ellipse at center,transparent 40%,rgba(0,200,100,0.45) 100%);
      pointer-events:none;opacity:0;
    `
    this.root.appendChild(hitFlash)

    // ── Mode indicator (bottom-right) ─────────────────────────────────────
    const modeIndicator = document.createElement('div')
    modeIndicator.style.cssText = `
      position:absolute;bottom:10px;right:14px;
      color:#334455;font-size:11px;letter-spacing:1px;
    `
    modeIndicator.textContent = 'WALKING'
    this.root.appendChild(modeIndicator)

    // ── Game-over / win full-screen overlay ────────────────────────────────
    const gameOverlay = document.createElement('div')
    gameOverlay.style.cssText = `
      position:fixed;top:0;left:0;width:100%;height:100%;
      display:none;flex-direction:column;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.72);
      font-family:'Courier New',monospace;
      pointer-events:auto;
    `
    this.root.appendChild(gameOverlay)

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
    this.distEl       = document.getElementById('hud-dist')!
    this.warnTextEl   = document.getElementById('hud-warn-text')!
    this.interactPrompt = interactPrompt
    this.repairPrompt   = repairPrompt
    this.alienPanel     = alienPanel
    this.alienDistEl    = document.getElementById('hud-alien-dist')!
    this.alienHpEl      = document.getElementById('hud-alien-hp')!
    this.stationPanel   = stationPanel
    this.stationText    = document.getElementById('hud-station-text')!

    // ── Docking success banner ─────────────────────────────────────────────
    const dockBanner = document.createElement('div')
    dockBanner.style.cssText = `
      position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);
      text-align:center;display:none;
      background:rgba(0,20,10,0.75);
      border:1px solid rgba(0,255,100,0.45);
      padding:14px 30px;border-radius:5px;
      color:#00ff88;font-size:18px;letter-spacing:4px;
      text-shadow:0 0 16px #00ff88;
    `
    dockBanner.textContent = '✓ DOCKED  —  HULL & O₂ RESTORED'
    this.root.appendChild(dockBanner)

    // ── EVA progress banner ────────────────────────────────────────────────
    const evaBanner = document.createElement('div')
    evaBanner.style.cssText = `
      position:absolute;top:38%;left:50%;transform:translate(-50%,-50%);
      text-align:center;display:none;
      background:rgba(10,20,30,0.75);
      border:1px solid rgba(255,160,0,0.35);
      padding:10px 24px;border-radius:4px;
      color:#ffaa00;font-size:13px;letter-spacing:3px;
    `
    evaBanner.innerHTML = `
      EVA IN PROGRESS — REPAIRING HULL<br>
      <span style="display:inline-block;width:160px;height:6px;background:#1a1200;border:1px solid rgba(255,160,0,0.3);border-radius:2px;margin-top:6px;vertical-align:middle">
        <span id="hud-eva-fill" style="display:block;height:100%;width:0%;background:#ffaa00;border-radius:2px;transition:width 0.3s"></span>
      </span>
    `
    this.root.appendChild(evaBanner)

    // ── Surface: pointer-lock hint (shown when mouse look is not yet acquired) ─
    const surfaceLockHint = document.createElement('div')
    surfaceLockHint.style.cssText = `
      position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
      text-align:center;display:none;
      background:rgba(0,10,20,0.70);
      border:1px solid rgba(0,160,255,0.35);
      padding:10px 24px;border-radius:4px;
      color:#66bbff;font-size:13px;letter-spacing:2px;
      text-shadow:0 0 8px #0088cc;
      animation:pulse 1.5s ease-in-out infinite;
    `
    surfaceLockHint.textContent = 'Click to look around'
    this.root.appendChild(surfaceLockHint)

    // ── Surface: control hints (Q/E/W movement keys) ─────────────────────────
    const surfaceControlHint = document.createElement('div')
    surfaceControlHint.style.cssText = `
      position:absolute;bottom:40px;left:50%;transform:translateX(-50%);
      text-align:center;display:none;
      background:rgba(0,12,20,0.60);
      border:1px solid rgba(0,180,120,0.25);
      padding:6px 18px;border-radius:3px;
      color:#448877;font-size:11px;letter-spacing:1px;
    `
    surfaceControlHint.textContent = 'Q/E plant axe  ·  W advance  ·  A/D rotate  ·  F lift off'
    this.root.appendChild(surfaceControlHint)

    this.surfaceLockHint    = surfaceLockHint
    this.surfaceControlHint = surfaceControlHint
    this.dockBanner     = dockBanner
    this.dockPrompt     = dockPrompt
    this.landPrompt     = landPrompt
    this.anchorPrompt   = anchorPrompt
    this.mineralRow     = document.getElementById('hud-min-row')!
    this.mineralFill    = document.getElementById('hud-min-fill')!
    this.mineralVal     = document.getElementById('hud-min-val')!
    this.evaBanner      = evaBanner
    this.gameOverlay    = gameOverlay
    this.modeIndicator  = modeIndicator
    this.missionPanel   = missionPanel
    this.missionFill    = document.getElementById('hud-miss-fill')!
    this.missionDist    = document.getElementById('hud-miss-dist')!
    this.o2Prompt       = o2Prompt
    this.hitFlash       = hitFlash
    this.titleScreen    = titleScreen
    this.combatPrompt   = combatPrompt
    this.damageOverlay  = dmg
    this.launchPrompt   = launchPrompt
  }

  update(ship: ShipState, phase: GamePhase, threatDist?: number, eventId = 'asteroid'): void {
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

    // Threat warning panel
    if (phase === 'IN_EVENT' && threatDist !== undefined) {
      this.warningPanel.style.display = 'block'
      this.distEl.textContent = `DIST: ${Math.round(threatDist)} m`
      const labels: Record<string, string> = {
        asteroid:  '⚠ ASTEROID INCOMING ⚠',
        blackhole: '⚠ GRAVITATIONAL ANOMALY ⚠',
        eva:       '⚠ EVA IN PROGRESS ⚠',
        planet:    '◉ PLANET DETECTED ◉',
      }
      this.warnTextEl.textContent = labels[eventId] ?? '⚠ ALERT ⚠'
    } else {
      this.warningPanel.style.display = 'none'
    }
  }

  setInteractPrompt(show: boolean): void {
    this.interactPrompt.style.display = show ? 'block' : 'none'
  }

  setLaunchPrompt(show: boolean): void {
    this.launchPrompt.style.display = show ? 'block' : 'none'
  }

  setDockPrompt(show: boolean): void {
    this.dockPrompt.style.display = show ? 'block' : 'none'
  }

  setLandPrompt(show: boolean): void {
    this.landPrompt.style.display = show ? 'block' : 'none'
  }

  setAnchorPrompt(show: boolean, anchored: boolean): void {
    this.anchorPrompt.style.display = show ? 'block' : 'none'
    if (show) {
      this.anchorPrompt.textContent = anchored
        ? '홀드 [E]  채굴  MINE  ⛏'
        : '[E]  앵커 박기  ANCHOR'
    }
  }

  setMinerals(n: number): void {
    if (n <= 0) { this.mineralRow.style.display = 'none'; return }
    this.mineralRow.style.display = 'block'
    const pct = Math.min(100, n * 20)  // 5 minerals = 100%
    this.mineralFill.style.width = `${pct}%`
    this.mineralFill.style.background = '#00ffcc'
    this.mineralVal.textContent = `${n}`
  }

  setRepairPrompt(show: boolean, hull: number): void {
    this.repairPrompt.style.display = show ? 'block' : 'none'
    if (show) {
      this.repairPrompt.textContent = hull < 100
        ? `HOLD [E] TO REPAIR — HULL ${Math.round(hull)}%`
        : 'HULL INTACT'
    }
  }

  setMissionProgress(distM: number, goalM = 5000): void {
    const pct = Math.min(100, (distM / goalM) * 100)
    this.missionFill.style.width = `${pct}%`
    this.missionDist.textContent = `${(distM / 1000).toFixed(2)} km`
  }

  setO2Prompt(show: boolean): void {
    this.o2Prompt.style.display = show ? 'block' : 'none'
  }

  showDockSuccess(): void {
    this.dockBanner.style.display = 'block'
    this.dockTimer = 3.5
  }

  setEvaProgress(show: boolean, progress = 0): void {
    this.evaBanner.style.display = show ? 'block' : 'none'
    if (show) {
      const fill = document.getElementById('hud-eva-fill')
      if (fill) fill.style.width = `${Math.round(progress * 100)}%`
    }
  }

  tick(dt: number): void {
    if (this.dockTimer > 0) {
      this.dockTimer -= dt
      if (this.dockTimer <= 0) this.dockBanner.style.display = 'none'
    }
  }

  setStationWaypoint(show: boolean, distM?: number, dockReady?: boolean): void {
    this.stationPanel.style.display = show ? 'block' : 'none'
    if (show && distM !== undefined) {
      if (dockReady) {
        this.stationText.textContent = '▶ DOCK [SPACE] ◀'
        this.stationPanel.style.color = '#00ff88'
        this.stationPanel.style.borderColor = 'rgba(0,200,100,0.5)'
      } else {
        const km = (distM / 1000).toFixed(1)
        this.stationText.textContent = `STATION: ${km} km`
        this.stationPanel.style.color = '#00aacc'
        this.stationPanel.style.borderColor = 'rgba(0,160,200,0.25)'
      }
    }
  }

  isTitleDismissed(): boolean { return this._titleDismissed }

  dismissTitle(): void {
    this._titleDismissed = true
    this.titleScreen.style.display = 'none'
  }

  setCombatPrompt(show: boolean): void {
    this.combatPrompt.style.display = show ? 'block' : 'none'
  }

  setSurfaceLockHint(show: boolean): void {
    this.surfaceLockHint.style.display = show ? 'block' : 'none'
  }

  setSurfaceControlHint(show: boolean): void {
    this.surfaceControlHint.style.display = show ? 'block' : 'none'
  }

  flashHit(): void {
    this.hitFlash.style.transition = 'none'
    this.hitFlash.style.opacity = '1'
    requestAnimationFrame(() => {
      this.hitFlash.style.transition = 'opacity 0.4s ease-out'
      this.hitFlash.style.opacity = '0'
    })
  }

  setMode(mode: string): void {
    this.modeIndicator.textContent = mode.toUpperCase()
  }

  showEndScreen(type: 'destroyed' | 'oxygen' | 'win', distM: number): void {
    this.gameOverlay.style.display = 'flex'
    const isWin = type === 'win'
    const title  = isWin ? '✦ DESTINATION REACHED ✦' : type === 'oxygen' ? '— CREW LOST —' : '— SHIP DESTROYED —'
    const color  = isWin ? '#00ff88' : '#ff4444'
    const sub    = isWin
      ? `${Math.round(distM / 1000)} km traveled — Mission Complete`
      : 'Press  [R]  to restart'
    this.gameOverlay.innerHTML = `
      <div style="color:${color};font-size:36px;letter-spacing:6px;text-shadow:0 0 20px ${color};margin-bottom:20px">${title}</div>
      <div style="color:#aabbcc;font-size:16px;letter-spacing:3px">${sub}</div>
      ${isWin ? '' : '<div style="color:#556677;font-size:12px;margin-top:12px;letter-spacing:2px">Distance: ' + Math.round(distM) + ' m</div>'}
    `
  }

  hideEndScreen(): void {
    this.gameOverlay.style.display = 'none'
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
