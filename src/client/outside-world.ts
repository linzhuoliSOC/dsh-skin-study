/**
 * 书房门外的体素郊野。不加载 minecraft-from-scratch/index.html，
 * 但外观对齐那份：16px 合图、分面明暗、草地侧面绿边、树与石丘。
 * 木门是独立网格，userData.unbreakable，不可挖掉。
 */
import * as THREE from 'three'
import type { WalkKey } from './study-3d'

const EYE = 1.62
const BODY_R = 0.3
const BODY_H = 1.8
const WALK_SPEED = 4.4
const SPRINT_SPEED = 7.0
const LOOK_SENS = 0.0022
const GRAVITY = 26
const JUMP_VEL = 8.8
const TERMINAL = -45
export const OUTSIDE_SAVE_KEY = 'dsh.study.outside.v1'
export const OUTSIDE_HOTBAR = [
  { name: '草地', swatch: 'linear-gradient(#6fae4d 0%,#6fae4d 30%,#8a5f3a 30%)' },
  { name: '泥土', swatch: '#8a5f3a' },
  { name: '石头', swatch: '#7f8078' },
  { name: '橡木', swatch: 'linear-gradient(#9a6b3c 0%,#9a6b3c 45%,#6e4c2a 45%)' },
  { name: '树叶', swatch: '#3f7d2f' },
  { name: '木板', swatch: '#a9824f' },
] as const
const W = 48
const H = 32
const D = 48
const BS = 0.5
const AIR = 0
const GRASS = 1
const DIRT = 2
const STONE = 3
const WOOD = 4
const LEAVES = 5
const PLANKS = 6
const ATLAS_N = 8

type Aabb = { x0: number; x1: number; z0: number; z1: number }

const mulberry32 = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const hash2 = (x: number, z: number, seed: number) => {
  let h = (x * 374761393 + z * 668265263 + seed) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
const valueNoise = (x: number, z: number, seed: number) => {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const v00 = hash2(xi, zi, seed)
  const v10 = hash2(xi + 1, zi, seed)
  const v01 = hash2(xi, zi + 1, seed)
  const v11 = hash2(xi + 1, zi + 1, seed)
  return v00 * (1 - u) * (1 - v) + v10 * u * (1 - v) + v01 * (1 - u) * v + v11 * u * v
}
const fbm = (x: number, z: number) => {
  let v = 0
  let a = 1
  let f = 1
  for (let o = 0; o < 4; o += 1) {
    v += a * valueNoise(x * f, z * f, 12345 + o * 97)
    a *= 0.5
    f *= 2
  }
  return v
}
const heightAt = (x: number, z: number) => {
  const n = fbm(x * 0.055, z * 0.055)
  return Math.max(4, Math.min(H - 12, Math.round(7 + n * 14)))
}

const shade = (r: number, g: number, b: number, d: number) =>
  `rgb(${Math.max(0, Math.min(255, Math.round(r + d)))},${Math.max(0, Math.min(255, Math.round(g + d)))},${Math.max(0, Math.min(255, Math.round(b + d)))})`

const makeAtlas = () => {
  const T = 16
  const c = document.createElement('canvas')
  c.width = T * ATLAS_N
  c.height = T
  const g = c.getContext('2d')
  if (!g) return null
  const put = (tile: number, x: number, y: number, style: string) => {
    g.fillStyle = style
    g.fillRect(tile * T + x, y, 1, 1)
  }
  const r1 = mulberry32(20260816)
  const r2 = mulberry32(20260817)
  for (let y = 0; y < T; y += 1) {
    for (let x = 0; x < T; x += 1) {
      put(0, x, y, shade(106, 170, 64, (r1() - 0.5) * 40))
      if (y < 4) put(1, x, y, shade(106, 170, 64, (r2() - 0.5) * 34))
      else put(1, x, y, shade(134, 96, 67, (r2() - 0.5) * 30))
      put(2, x, y, shade(134, 96, 67, (r1() - 0.5) * 34))
      put(3, x, y, shade(125, 125, 125, (r2() - 0.5) * 22))
      const dist = Math.hypot(x - 7.5, y - 7.5)
      const ring = Math.floor(dist * 1.9) % 2
      put(4, x, y, ring ? shade(150, 110, 74, (r1() - 0.5) * 20) : shade(116, 82, 52, (r1() - 0.5) * 20))
      const col = Math.floor(x / 3) % 2
      put(5, x, y, col ? shade(108, 84, 52, (r2() - 0.5) * 20) : shade(88, 68, 42, (r2() - 0.5) * 20))
      if (r1() < 0.1) g.clearRect(6 * T + x, y, 1, 1)
      else put(6, x, y, shade(56, 122, 44, (r1() - 0.5) * 40))
      let pr = 158 + (r2() - 0.5) * 22
      let pg = 122 + (r2() - 0.5) * 22
      let pb = 84 + (r2() - 0.5) * 22
      if (x % 4 === 0) {
        pr *= 0.7
        pg *= 0.7
        pb *= 0.7
      }
      put(7, x, y, shade(pr, pg, pb, 0))
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const makeDoorTex = () => {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 32
  const g = c.getContext('2d')
  if (!g) return null
  g.fillStyle = '#8b6238'
  g.fillRect(0, 0, 16, 32)
  const panels: [number, number, number, number][] = [
    [2, 2, 5, 10], [9, 2, 5, 10],
    [2, 14, 5, 6], [9, 14, 5, 6],
    [2, 22, 5, 8], [9, 22, 5, 8],
  ]
  for (const [x, y, w, h] of panels) {
    g.fillStyle = '#a07848'
    g.fillRect(x, y, w, h)
    g.fillStyle = '#6a4a28'
    g.strokeStyle = '#5a3c20'
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  }
  g.fillStyle = '#c4a15a'
  g.fillRect(13, 16, 2, 2)
  g.fillStyle = '#3a2a18'
  g.fillRect(0, 0, 16, 1)
  g.fillRect(0, 31, 16, 1)
  g.fillRect(0, 0, 1, 32)
  g.fillRect(15, 0, 1, 32)
  const tex = new THREE.CanvasTexture(c)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const TILE = {
  [GRASS]: { top: 0, side: 1, bottom: 2 },
  [DIRT]: { top: 2, side: 2, bottom: 2 },
  [STONE]: { top: 3, side: 3, bottom: 3 },
  [WOOD]: { top: 4, side: 5, bottom: 4 },
  [LEAVES]: { top: 6, side: 6, bottom: 6 },
  [PLANKS]: { top: 7, side: 7, bottom: 7 },
} as const
const FACES = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0],
  [-1, 0, 0, 0, 0, 1, 0, 1, 0],
  [0, 1, 0, 0, 0, 1, 1, 0, 0],
  [0, -1, 0, 1, 0, 0, 0, 0, 1],
  [0, 0, 1, 1, 0, 0, 0, 1, 0],
  [0, 0, -1, -1, 0, 0, 0, 1, 0],
]
const SHADES = [0.62, 0.62, 1, 0.46, 0.8, 0.8]
const UW = 1 / ATLAS_N
const HALF = BS / 2

export interface OutsideWorld {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  enterWalk: () => void
  setMoveKey: (key: WalkKey, down: boolean) => void
  look: (dx: number, dy: number) => void
  updateWalk: () => boolean
  pickHotspot: (clientX: number, clientY: number, canvas: HTMLElement) => string | null
  isNearDoor: () => boolean
  /** 准星/点击挖方块。门不可挖，返回 door。 */
  tryPunch: () => 'broke' | 'door' | 'none'
  tryPlace: () => 'placed' | 'none'
  setMining: (down: boolean) => void
  setPlacing: (down: boolean) => void
  selectSlot: (i: number) => void
  getSelected: () => number
  takeDoorHint: () => boolean
  placeOutside: () => void
  saveNow: () => void
  setAspect: (aspect: number) => void
  dispose: () => void
}

export function createOutsideWorld(): OutsideWorld {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87ceeb)
  scene.fog = new THREE.Fog(0x87ceeb, 28, 72)
  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 160)
  camera.rotation.order = 'YXZ'

  const data = new Uint8Array(W * H * D)
  const inB = (x: number, y: number, z: number) => x >= 0 && x < W && y >= 0 && y < H && z >= 0 && z < D
  const idx = (x: number, y: number, z: number) => (y * D + z) * W + x
  const get = (x: number, y: number, z: number) => (inB(x, y, z) ? data[idx(x, y, z)] : AIR)
  const set = (x: number, y: number, z: number, v: number) => {
    if (inB(x, y, z)) data[idx(x, y, z)] = v
  }
  const isTrans = (x: number, y: number, z: number) => {
    const b = get(x, y, z)
    return b === AIR || b === LEAVES
  }

  const rng = mulberry32(20260816)
  for (let z = 0; z < D; z += 1) {
    for (let x = 0; x < W; x += 1) {
      const h = heightAt(x, z)
      for (let y = 0; y <= h; y += 1) {
        set(x, y, z, y === h ? GRASS : y >= h - 3 ? DIRT : STONE)
      }
    }
  }
  for (let z = 1; z < D - 1; z += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      if (rng() >= 0.006) continue
      const bh = heightAt(x, z)
      const bl = 1 + Math.floor(rng() * 2)
      for (let bx = -1; bx <= 1; bx += 1) {
        for (let bz = -1; bz <= 1; bz += 1) {
          if (Math.abs(bx) === 1 && Math.abs(bz) === 1 && rng() < 0.5) continue
          for (let by = 0; by < bl; by += 1) set(x + bx, bh + by, z + bz, STONE)
        }
      }
    }
  }
  for (let z = 3; z < D - 3; z += 1) {
    for (let x = 3; x < W - 3; x += 1) {
      if (rng() >= 0.014) continue
      const h = heightAt(x, z)
      if (h < 6) continue
      if (x > W / 2 - 6 && x < W / 2 + 6 && z > D / 2 + 2 && z < D / 2 + 12) continue
      const trunk = 3 + Math.floor(rng() * 3)
      for (let i = 1; i <= trunk; i += 1) set(x, h + i, z, WOOD)
      const ly = h + trunk
      for (let dy = 0; dy <= 2; dy += 1) {
        const r = dy === 1 ? 2 : 1
        for (let dx = -r; dx <= r; dx += 1) {
          for (let dz = -r; dz <= r; dz += 1) {
            if (dy === 1 && Math.abs(dx) === r && Math.abs(dz) === r && rng() < 0.6) continue
            if (get(x + dx, ly + dy, z + dz) === AIR) set(x + dx, ly + dy, z + dz, LEAVES)
          }
        }
      }
      if (get(x, ly + 3, z) === AIR) set(x, ly + 3, z, LEAVES)
    }
  }

  const cabinX = Math.floor(W / 2)
  const cabinZ = Math.floor(D / 2) + 6
  const cabinH = heightAt(cabinX, cabinZ)
  for (let x = cabinX - 3; x <= cabinX + 3; x += 1) {
    for (let z = cabinZ - 3; z <= cabinZ + 3; z += 1) {
      for (let y = cabinH; y <= cabinH + 5; y += 1) {
        if (get(x, y, z) !== AIR && y > cabinH) set(x, y, z, AIR)
      }
      set(x, cabinH, z, PLANKS)
    }
  }
  for (let y = 1; y <= 4; y += 1) {
    for (let x = cabinX - 3; x <= cabinX + 3; x += 1) {
      for (const z of [cabinZ - 3, cabinZ + 3]) {
        const hole = z === cabinZ + 3 && x >= cabinX - 1 && x <= cabinX + 1 && y <= 4
        if (!hole) set(x, cabinH + y, z, PLANKS)
        else set(x, cabinH + y, z, AIR)
      }
    }
    for (let z = cabinZ - 2; z <= cabinZ + 2; z += 1) {
      set(cabinX - 3, cabinH + y, z, PLANKS)
      set(cabinX + 3, cabinH + y, z, PLANKS)
    }
  }
  for (let x = cabinX - 3; x <= cabinX + 3; x += 1) {
    for (let z = cabinZ - 3; z <= cabinZ + 3; z += 1) set(x, cabinH + 5, z, PLANKS)
  }

  let selectedIdx = 0
  const bytesToB64 = (buf: Uint8Array) => {
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    }
    return btoa(bin)
  }
  const b64ToBytes = (s: string, into: Uint8Array) => {
    const bin = atob(s)
    if (bin.length !== into.length) return false
    for (let i = 0; i < bin.length; i += 1) into[i] = bin.charCodeAt(i)
    return true
  }
  type SavedPose = { x: number; y: number; z: number; yaw: number; pitch: number }
  let savedPose: SavedPose | null = null
  try {
    const raw = localStorage.getItem(OUTSIDE_SAVE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as {
        v?: number; w?: number; h?: number; d?: number; blocks?: string
        x?: number; y?: number; z?: number; yaw?: number; pitch?: number; slot?: number
      }
      if (s.v === 1 && s.w === W && s.h === H && s.d === D && typeof s.blocks === 'string' && b64ToBytes(s.blocks, data)) {
        if (typeof s.slot === 'number' && Number.isFinite(s.slot)) {
          selectedIdx = Math.max(0, Math.min(OUTSIDE_HOTBAR.length - 1, s.slot | 0))
        }
        if ([s.x, s.y, s.z, s.yaw, s.pitch].every((n) => typeof n === 'number' && Number.isFinite(n))) {
          savedPose = { x: s.x as number, y: s.y as number, z: s.z as number, yaw: s.yaw as number, pitch: s.pitch as number }
        }
      }
    }
  } catch { /* 存档损坏则用新生成的世界 */ }

  const atlas = makeAtlas()
  const positions: number[] = []
  const uvs: number[] = []
  const cols: number[] = []
  const indices: number[] = []
  let ii = 0
  for (let x = 0; x < W; x += 1) {
    for (let z = 0; z < D; z += 1) {
      for (let y = 0; y < H; y += 1) {
        const b = get(x, y, z)
        if (b === AIR) continue
        const tm = TILE[b as keyof typeof TILE]
        if (!tm) continue
        for (let fi = 0; fi < 6; fi += 1) {
          const f = FACES[fi]
          if (!isTrans(x + f[0], y + f[1], z + f[2])) continue
          const tile = fi === 2 ? tm.top : fi === 3 ? tm.bottom : tm.side
          const u0 = tile * UW
          const u1 = u0 + UW
          const ox = f[0] * HALF
          const oy = f[1] * HALF
          const oz = f[2] * HALF
          const tx = f[3] * HALF
          const ty = f[4] * HALF
          const tz = f[5] * HALF
          const vx = f[6] * HALF
          const vy = f[7] * HALF
          const vz = f[8] * HALF
          const cx = x * BS + HALF
          const cy = y * BS + HALF
          const cz = z * BS + HALF
          const s = SHADES[fi]
          positions.push(
            cx + ox + tx + vx, cy + oy + ty + vy, cz + oz + tz + vz,
            cx + ox - tx + vx, cy + oy - ty + vy, cz + oz - tz + vz,
            cx + ox - tx - vx, cy + oy - ty - vy, cz + oz - tz - vz,
            cx + ox + tx - vx, cy + oy + ty - vy, cz + oz + tz - vz,
          )
          uvs.push(u0, 1, u1, 1, u1, 0, u0, 0)
          cols.push(s, s, s, s, s, s, s, s, s, s, s, s)
          indices.push(ii, ii + 1, ii + 2, ii, ii + 2, ii + 3)
          ii += 4
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  const blockMat = new THREE.MeshBasicMaterial({
    map: atlas ?? undefined,
    vertexColors: true,
    alphaTest: 0.5,
  })
  const worldMesh = new THREE.Mesh(geo, blockMat)
  worldMesh.matrixAutoUpdate = false
  scene.add(worldMesh)

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.75, fog: false, depthWrite: false,
  })
  const clouds = new THREE.Group()
  const cr = mulberry32(99)
  for (let i = 0; i < 8; i += 1) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(7 + cr() * 11, 1.1, 4 + cr() * 6), cloudMat)
    m.position.set((cr() - 0.5) * W * BS, 22 + cr() * 4, (cr() - 0.5) * D * BS)
    clouds.add(m)
  }
  scene.add(clouds)

  const door = new THREE.Group()
  door.userData.hotspot = 'door'
  door.userData.unbreakable = true
  const doorTex = makeDoorTex()
  const doorMat = new THREE.MeshBasicMaterial({ map: doorTex ?? undefined, color: doorTex ? 0xffffff : 0x8b6238 })
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.95, 0.1), doorMat)
  leaf.userData.unbreakable = true
  const doorWorldX = cabinX * BS + HALF
  const doorWorldZ = (cabinZ + 3) * BS + HALF + 0.06
  const doorY = (cabinH + 1) * BS + 0.98
  leaf.position.set(0, 0, 0)
  door.position.set(doorWorldX, doorY, doorWorldZ)
  door.add(leaf)
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.09), new THREE.MeshBasicMaterial({ color: 0xc4a15a }))
  knob.position.set(0.52, -0.06, 0.08)
  knob.userData.unbreakable = true
  door.add(knob)
  scene.add(door)

  const toWorld = (gx: number, gz: number) => [gx * BS + HALF, gz * BS + HALF] as const
  const [wx0] = toWorld(cabinX - 3, 0)
  const [wx1] = toWorld(cabinX + 3, 0)
  const [, wz0] = toWorld(0, cabinZ - 3)
  const [, wz1] = toWorld(0, cabinZ + 3)
  const solids: Aabb[] = [
    { x0: wx0 - 0.25, x1: wx1 + 0.25, z0: wz0 - 0.25, z1: wz0 + 0.25 },
    { x0: wx0 - 0.25, x1: wx0 + 0.25, z0: wz0 - 0.25, z1: wz1 + 0.25 },
    { x0: wx1 - 0.25, x1: wx1 + 0.25, z0: wz0 - 0.25, z1: wz1 + 0.25 },
    { x0: wx0 - 0.25, x1: doorWorldX - 0.78, z0: wz1 - 0.25, z1: wz1 + 0.25 },
    { x0: doorWorldX + 0.78, x1: wx1 + 0.25, z0: wz1 - 0.25, z1: wz1 + 0.25 },
    { x0: doorWorldX - 0.76, x1: doorWorldX + 0.76, z0: doorWorldZ - 0.14, z1: doorWorldZ + 0.14 },
  ]

  const isSolid = (x: number, y: number, z: number) => {
    const b = get(x, y, z)
    return b !== AIR && b !== LEAVES
  }
  const surfaceY = (wx: number, wz: number) => {
    const gx = Math.floor(wx / BS)
    const gz = Math.floor(wz / BS)
    let top = 0
    for (let y = H - 1; y >= 0; y -= 1) {
      if (isSolid(gx, y, gz)) {
        top = y
        break
      }
    }
    return (top + 1) * BS
  }
  const groundUnder = (wx: number, wz: number, footY: number) => {
    const gx = Math.floor(wx / BS)
    const gz = Math.floor(wz / BS)
    let y = Math.floor((footY - 1e-3) / BS)
    if (!Number.isFinite(y) || y >= H) y = H - 1
    if (y < 0) return surfaceY(wx, wz)
    for (; y >= 0; y -= 1) {
      if (isSolid(gx, y, gz)) return (y + 1) * BS
    }
    return surfaceY(wx, wz)
  }
  const ceilingAt = (wx: number, wz: number, fromY: number) => {
    const gx = Math.floor(wx / BS)
    const gz = Math.floor(wz / BS)
    for (let y = Math.max(0, Math.floor(fromY / BS)); y < H; y += 1) {
      if (isSolid(gx, y, gz)) return y * BS
    }
    return H * BS
  }
  const circleHits = (x: number, z: number, box: Aabb) => {
    const nx = Math.min(box.x1, Math.max(box.x0, x))
    const nz = Math.min(box.z1, Math.max(box.z0, z))
    return (x - nx) * (x - nx) + (z - nz) * (z - nz) < BODY_R * BODY_R
  }
  const blocked = (x: number, z: number) => {
    const min = BS * 1.2
    const maxX = (W - 1.2) * BS
    const maxZ = (D - 1.2) * BS
    if (x < min || z < min || x > maxX || z > maxZ) return true
    return solids.some((b) => circleHits(x, z, b))
  }
  const tryMove = (x: number, z: number, dx: number, dz: number) => {
    if (!blocked(x + dx, z + dz)) return [x + dx, z + dz] as const
    if (!blocked(x + dx, z)) return [x + dx, z] as const
    if (!blocked(x, z + dz)) return [x, z + dz] as const
    return [x, z] as const
  }

  const walk = {
    yaw: 0,
    pitch: -0.08,
    last: 0,
    footY: 0,
    vy: 0,
    grounded: true,
    forward: false,
    back: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
  }
  const applyLook = () => {
    camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ')
  }
  const enterWalk = () => {
    applyLook()
    walk.last = 0
  }
  const look = (dx: number, dy: number) => {
    walk.yaw -= dx * LOOK_SENS
    walk.pitch -= dy * LOOK_SENS
    walk.pitch = Math.min(1.2, Math.max(-1.2, walk.pitch))
    applyLook()
  }
  const setMoveKey = (key: WalkKey, down: boolean) => {
    walk[key] = down
  }
  const updateWalk = () => {
    const now = performance.now()
    const dt = Math.min(0.05, walk.last ? (now - walk.last) / 1000 : 0)
    walk.last = now
    applyLook()
    let mx = 0
    let mz = 0
    if (walk.forward) mz -= 1
    if (walk.back) mz += 1
    if (walk.left) mx -= 1
    if (walk.right) mx += 1
    if (mx !== 0 || mz !== 0) {
      const inv = 1 / Math.hypot(mx, mz)
      mx *= inv
      mz *= inv
      const speed = (walk.sprint ? SPRINT_SPEED : WALK_SPEED) * dt
      const sin = Math.sin(walk.yaw)
      const cos = Math.cos(walk.yaw)
      const dx = (mx * cos + mz * sin) * speed
      const dz = (-mx * sin + mz * cos) * speed
      const [nx, nz] = tryMove(camera.position.x, camera.position.z, dx, dz)
      camera.position.x = nx
      camera.position.z = nz
    }
    if (walk.grounded) {
      const step = groundUnder(camera.position.x, camera.position.z, walk.footY + 0.56)
      if (step > walk.footY && step <= walk.footY + 0.56) walk.footY = step
    }
    if (walk.jump && walk.grounded) {
      walk.vy = JUMP_VEL
      walk.grounded = false
    }
    walk.vy -= GRAVITY * dt
    if (walk.vy < TERMINAL) walk.vy = TERMINAL
    let ny = walk.footY + walk.vy * dt
    const ground = groundUnder(camera.position.x, camera.position.z, Math.max(walk.footY, ny) + 0.08)
    const ceil = ceilingAt(camera.position.x, camera.position.z, walk.footY + BODY_H * 0.35)
    if (ny <= ground + 1e-4) {
      ny = ground
      walk.vy = 0
      walk.grounded = true
    } else {
      walk.grounded = false
    }
    if (ny + BODY_H > ceil) {
      const pushed = ceil - BODY_H
      if (pushed >= ground) {
        ny = pushed
        if (walk.vy > 0) walk.vy = 0
      } else {
        ny = ground
        walk.vy = 0
        walk.grounded = true
      }
    }
    if (!Number.isFinite(ny) || ny < 0.05) {
      ny = surfaceY(camera.position.x, camera.position.z)
      walk.vy = 0
      walk.grounded = true
    }
    walk.footY = ny
    camera.position.y = ny + EYE
    clouds.position.x = Math.sin(now * 0.00004) * 6
    if (mining && now - lastMine > 170) {
      lastMine = now
      if (tryPunch() === 'door') punchNote = 'door'
    }
    if (placing && now - lastPlace > 280) {
      lastPlace = now
      tryPlace()
    }
    if (now - lastPoseSave > 2000) {
      lastPoseSave = now
      scheduleSave()
    }
    return true
  }
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pickHotspot = (clientX: number, clientY: number, canvas: HTMLElement) => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    for (const hit of raycaster.intersectObject(door, true)) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        if (obj.userData.hotspot === 'door' || obj.userData.unbreakable) return 'door'
        obj = obj.parent
      }
    }
    return null
  }
  const isNearDoor = () => {
    const p = camera.position
    return Math.abs(p.x - doorWorldX) < 1.05 && Math.abs(p.z - doorWorldZ) < 1.15
  }
  const rebuildMesh = () => {
    const positions: number[] = []
    const uvs: number[] = []
    const cols: number[] = []
    const indices: number[] = []
    let ii = 0
    for (let x = 0; x < W; x += 1) {
      for (let z = 0; z < D; z += 1) {
        for (let y = 0; y < H; y += 1) {
          const b = get(x, y, z)
          if (b === AIR) continue
          const tm = TILE[b as keyof typeof TILE]
          if (!tm) continue
          for (let fi = 0; fi < 6; fi += 1) {
            const f = FACES[fi]
            if (!isTrans(x + f[0], y + f[1], z + f[2])) continue
            const tile = fi === 2 ? tm.top : fi === 3 ? tm.bottom : tm.side
            const u0 = tile * UW
            const ox = f[0] * HALF
            const oy = f[1] * HALF
            const oz = f[2] * HALF
            const tx = f[3] * HALF
            const ty = f[4] * HALF
            const tz = f[5] * HALF
            const vx = f[6] * HALF
            const vy = f[7] * HALF
            const vz = f[8] * HALF
            const cx = x * BS + HALF
            const cy = y * BS + HALF
            const cz = z * BS + HALF
            const s = SHADES[fi]
            positions.push(
              cx + ox + tx + vx, cy + oy + ty + vy, cz + oz + tz + vz,
              cx + ox - tx + vx, cy + oy - ty + vy, cz + oz - tz + vz,
              cx + ox - tx - vx, cy + oy - ty - vy, cz + oz - tz - vz,
              cx + ox + tx - vx, cy + oy + ty - vy, cz + oz + tz - vz,
            )
            uvs.push(u0, 1, u0 + UW, 1, u0 + UW, 0, u0, 0)
            cols.push(s, s, s, s, s, s, s, s, s, s, s, s)
            indices.push(ii, ii + 1, ii + 2, ii, ii + 2, ii + 3)
            ii += 4
          }
        }
      }
    }
    const next = new THREE.BufferGeometry()
    next.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    next.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    next.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
    next.setIndex(indices)
    next.computeBoundingSphere()
    worldMesh.geometry.dispose()
    worldMesh.geometry = next
  }
  let mining = false
  let lastMine = 0
  let lastPunchAt = 0
  let punchNote: 'door' | null = null
  const PUNCH_GAP = 170
  const takeDoorHint = () => {
    if (punchNote !== 'door') return false
    punchNote = null
    return true
  }
  const tryPunch = (): 'broke' | 'door' | 'none' => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - lastPunchAt < PUNCH_GAP) return 'none'
    ndc.set(0, 0)
    raycaster.setFromCamera(ndc, camera)
    const doorHits = raycaster.intersectObject(door, true)
    const worldHits = raycaster.intersectObject(worldMesh, false)
    const doorHit = doorHits[0]
    const worldHit = worldHits[0]
    if (doorHit && (!worldHit || doorHit.distance <= worldHit.distance + 0.02) && doorHit.distance < 8) {
      lastPunchAt = now
      return 'door'
    }
    if (!worldHit || worldHit.distance > 8) return 'none'
    const n = worldHit.face?.normal ?? new THREE.Vector3(0, 1, 0)
    const p = worldHit.point.clone().addScaledVector(n, -0.02)
    const gx = Math.floor(p.x / BS)
    const gy = Math.floor(p.y / BS)
    const gz = Math.floor(p.z / BS)
    if (!inB(gx, gy, gz) || gy <= 0) return 'none'
    if (get(gx, gy, gz) === AIR) return 'none'
    set(gx, gy, gz, AIR)
    rebuildMesh()
    lastPunchAt = now
    lastMine = now
    scheduleSave()
    return 'broke'
  }
  const PALETTE = [GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS] as const
  let placing = false
  let lastPlace = 0
  const tryPlace = (): 'placed' | 'none' => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - lastPlace < 160) return 'none'
    ndc.set(0, 0)
    raycaster.setFromCamera(ndc, camera)
    const doorHits = raycaster.intersectObject(door, true)
    const worldHits = raycaster.intersectObject(worldMesh, false)
    const doorHit = doorHits[0]
    const worldHit = worldHits[0]
    if (doorHit && (!worldHit || doorHit.distance <= worldHit.distance + 0.02) && doorHit.distance < 8) {
      return 'none'
    }
    if (!worldHit || worldHit.distance > 8) return 'none'
    const n = worldHit.face?.normal ?? new THREE.Vector3(0, 1, 0)
    const p = worldHit.point.clone().addScaledVector(n, 0.08)
    const gx = Math.floor(p.x / BS)
    const gy = Math.floor(p.y / BS)
    const gz = Math.floor(p.z / BS)
    if (!inB(gx, gy, gz) || get(gx, gy, gz) !== AIR) return 'none'
    const minX = gx * BS
    const maxX = minX + BS
    const minY = gy * BS
    const maxY = minY + BS
    const minZ = gz * BS
    const maxZ = minZ + BS
    const px = camera.position.x
    const py = walk.footY
    const pz = camera.position.z
    if (maxX > px - BODY_R && minX < px + BODY_R &&
        maxY > py && minY < py + BODY_H &&
        maxZ > pz - BODY_R && minZ < pz + BODY_R) return 'none'
    set(gx, gy, gz, PALETTE[selectedIdx])
    rebuildMesh()
    lastPlace = now
    scheduleSave()
    return 'placed'
  }
  const setMining = (down: boolean) => {
    mining = down
    if (down) lastMine = typeof performance !== 'undefined' ? performance.now() : Date.now()
  }
  const setPlacing = (down: boolean) => {
    placing = down
    if (down) lastPlace = typeof performance !== 'undefined' ? performance.now() : Date.now()
  }
  const selectSlot = (i: number) => {
    const n = OUTSIDE_HOTBAR.length
    selectedIdx = ((i % n) + n) % n
    scheduleSave()
  }
  const getSelected = () => selectedIdx
  let saveTimer = 0
  let lastPoseSave = 0
  const saveNow = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = 0
    }
    try {
      localStorage.setItem(OUTSIDE_SAVE_KEY, JSON.stringify({
        v: 1, w: W, h: H, d: D,
        blocks: bytesToB64(data),
        x: camera.position.x,
        y: walk.footY,
        z: camera.position.z,
        yaw: walk.yaw,
        pitch: walk.pitch,
        slot: selectedIdx,
      }))
    } catch { /* 配额满/隐私模式：本次不落盘 */ }
  }
  const scheduleSave = () => {
    if (saveTimer) return
    saveTimer = window.setTimeout(() => {
      saveTimer = 0
      saveNow()
    }, 400)
  }
  const applyPose = (x: number, y: number, z: number, yaw: number, pitch: number) => {
    const gx = Number.isFinite(x) ? x : doorWorldX
    const gz = Number.isFinite(z) ? z : doorWorldZ + 2.4
    let gy = y
    if (!Number.isFinite(gy) || gy < 0.05 || gy > H * BS) gy = surfaceY(gx, gz)
    walk.yaw = yaw
    walk.pitch = Math.min(1.2, Math.max(-1.2, pitch))
    walk.footY = gy
    walk.vy = 0
    walk.grounded = true
    walk.jump = false
    walk.last = 0
    camera.position.set(gx, gy + EYE, gz)
    applyLook()
  }
  const placeOutside = () => {
    const sx = doorWorldX
    const sz = doorWorldZ + 2.4
    applyPose(sx, surfaceY(sx, sz), sz, 0, -0.08)
  }
  const setAspect = (aspect: number) => {
    camera.aspect = aspect
    camera.updateProjectionMatrix()
  }
  const dispose = () => {
    saveNow()
    worldMesh.geometry.dispose()
    blockMat.dispose()
    atlas?.dispose()
    doorTex?.dispose()
    door.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        ;(o.material as THREE.Material).dispose()
      }
    })
    clouds.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    cloudMat.dispose()
  }

  if (savedPose) applyPose(savedPose.x, savedPose.y, savedPose.z, savedPose.yaw, savedPose.pitch)
  else placeOutside()
  return {
    scene, camera, enterWalk, setMoveKey, look, updateWalk,
    pickHotspot, isNearDoor, tryPunch, tryPlace, setMining, setPlacing,
    selectSlot, getSelected, takeDoorHint, placeOutside, saveNow, setAspect, dispose,
  }
}
