/**
 * 3D 书房场景模块（第三轮）：纯 Three.js，不碰业务 DOM、不注入服务。
 * buildStudyScene() 用基础几何体拼一间低模浅色书房——奶油墙、浅木地板、
 * 大窗透天光（窗棂+蓝天+太阳/月亮）、书桌+暖光台灯、书架彩色低饱和书、
 * 椅子、地毯、绿植；亮暗两套主题由 setTheme(dark) 一键切换（暗色：墙/地板
 * 转深可可，台灯与窗外暖/冷光点仍在）。
 * createStudyRoom(el) 在其上包 WebGLRenderer（软阴影 PCFSoft 1024、
 * pixelRatio<=1.5）与 OrbitControls（阻尼、极角/半径限位）。
 * 第六轮：自动巡航改为钟摆式往返摆动——不再用 OrbitControls.autoRotate
 * 单向绕圈，改在渲染循环（updateCruise）里自己推进方位角：以 min/max
 * Azimuth 的中点为基线、幅度 cruiseAmplitude（0.4~1.2，1.0=摆满限位
 * 范围）做三角波折返，俯仰/距离保持，写相机用 Spherical + lookAt。
 * 任何交互（OrbitControls start/键盘/Alt 拖拽）暂停摆动，松手后从当前
 * 方位继续（recapture 当前 azimuth，不跳变）。
 * 第七轮：补家具——右墙双人沙发（陶土棕织物+抱枕+木腿）、两盆绿植
 * （窗角高大叶/角落多肉，统一陶土盆）、书桌上墙竖幅书法卷轴
 * （Canvas 2D 生成宣纸+墨色「静」+红印章，无外部文件；暗色主题下
 * 宣纸 emissive 略亮）。全部低模、castShadow，随 setTheme 换色。
 * 第八轮：删除书柜顶垂吊植物；书柜旁加日式地台床+床头柜（木床架+
 * 米白床垫+双枕+薄被，床头小柜+自发光小台灯），沙发前加茶几+
 * 中国风雕龙煮茶茶具（Canvas 雕纹木茶盘+青釉茶壶+三只茶杯带垫）。
 * 新增物件全部低模、castShadow，随 setTheme 换色（暗色转深暖）。
 * 第九轮：家具与灯都是静态的，只相机在巡航。阴影贴图只在首帧和
 * setTheme 时重算（autoUpdate=false），避免每帧再走一遍 PCFSoft。
 * 第十一轮：第一人称走动（无小人）：WASD 平移、鼠标转头、AABB 碰家具。
 * WebGL 不可用时 createStudyRoom 抛错，由调用方回退到插画背景。
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

/** buildStudyScene 的返回：场景图 + 相机 + 主题切换 + 资源回收。 */
export interface StudyScene {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  setTheme: (dark: boolean) => void
  dispose: () => void
}

/** 用户可调的视角参数（缺省字段不动）。 */
export interface StudyControlOpts {
  rotateSpeed?: number
  zoomSpeed?: number
  /** 自动巡航开关（第六轮起语义=钟摆式往返摆动，字段名保持兼容旧设置）。 */
  autoRotate?: boolean
  /** 巡航速度 0.1~2（沿用旧 autoRotateSpeed 的角速度语义）。 */
  autoRotateSpeed?: number
  /** 摆动幅度 0.4~1.2（1.0=摆满 min~maxAzimuth 范围）。 */
  cruiseAmplitude?: number
}

/** createStudyRoom 的返回：再加渲染器、轨道控制器与参数套用。 */
export interface StudyRoom extends StudyScene {
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  /** 把用户设置套用到视角参数（灵敏度/巡航），调用方即时调用即时生效。 */
  applyControls: (opts: StudyControlOpts) => void
  /** 绕 target 微调视角（弧度：水平/俯仰），限位与 OrbitControls 一致——键盘与 Alt 拖拽用。 */
  rotateBy: (dTheta: number, dPhi: number) => void
  /** 按倍率拉近（<1）/拉远（>1），受 min/maxDistance 钳制——键盘 +/- 与 Alt 滚轮用。 */
  dollyBy: (factor: number) => void
  /** 重置视角到初始相机位与目标点（R 键用）。 */
  resetView: () => void
  /** 渲染循环每帧调用：巡航启用且非交互态时推进摆动相位并写相机。 */
  updateCruise: () => void
  /** 暂停巡航（可嵌套：漫游/拖拽等每个交互源各 pause 一次、resume 一次）。 */
  pauseCruise: () => void
  /** 解除一次暂停；全部解除后从当前方位继续摆（recapture，不跳变）。 */
  resumeCruise: () => void
  /** 屏幕坐标拾取场景热点（目前只有书桌 desk）；未命中返回 null。 */
  pickHotspot: (clientX: number, clientY: number) => string | null
  /** 切入第一人称走动（无角色模型，只改相机）。 */
  enterWalk: () => void
  /** 退出第一人称，把当前朝向收成轨道目标。 */
  exitWalk: () => void
  /** 是否处于第一人称走动。 */
  isWalking: () => boolean
  /** 设置 WASD/冲刺键状态。 */
  setMoveKey: (key: WalkKey, down: boolean) => void
  /** 鼠标位移转头（像素）。 */
  look: (dx: number, dy: number) => void
  /** 渲染循环调用：按真实时间走步与碰撞。返回是否正在走动。 */
  updateWalk: () => boolean
  /** 走到门边或点到门时为 true。 */
  isNearDoor: () => boolean
  /** 从屋外回来时站到门内侧，面朝房间。 */
  placeAtDoor: () => void
  /** 站到房间中央，面朝书桌/窗户（进书房时的出生点）。 */
  placeAtSpawn: () => void
}

export type WalkKey = 'forward' | 'back' | 'left' | 'right' | 'sprint' | 'jump'

/* ---- 亮暗两套配色 ---- */
const LIGHT = {
  wall: 0xf2ebdd, floor: 0xd8c49a, ceiling: 0xf7f1e4, fog: 0xf2ebdd,
  sky: 0xbfe2f2, sunDisc: 0xfff3c4, frame: 0xf8f3e6,
  wood: 0xc9a26e, woodDark: 0xa87f4d, shelfWood: 0xb78f63,
  rug: 0xe6d3ae, rugInner: 0xf0e2c4, pot: 0xb0705a, leaf: 0x7d9a5f,
  sofa: 0xb0714e, pillowA: 0x8f9a78, pillowB: 0xd9c9a8,
  bedding: 0xf1ead9, blanket: 0xd8c2a0, celadon: 0x4a6b5a,
  paper: 0xf6efdd, scrollGlow: 0.05,
  hemiSky: 0xfff6e0, hemiGround: 0xd8c49a, hemiIntensity: 0.55,
  sunColor: 0xfff2d8, sunIntensity: 1.55, lampIntensity: 0.35, lampEmissive: 0.35,
}
const DARK = {
  wall: 0x2f2719, floor: 0x463723, ceiling: 0x2a2214, fog: 0x241d12,
  sky: 0x18223a, sunDisc: 0xdfe8f5, frame: 0x6b5a44,
  wood: 0x6b5233, woodDark: 0x54402c, shelfWood: 0x5f4a2e,
  rug: 0x4d3f2c, rugInner: 0x5a4a36, pot: 0x6e4636, leaf: 0x4a6136,
  sofa: 0x74462e, pillowA: 0x59634c, pillowB: 0x8a7a5c,
  bedding: 0x7d6c50, blanket: 0x6b5638, celadon: 0x2f4a3a,
  paper: 0xe9dec2, scrollGlow: 0.35,
  hemiSky: 0x2a3348, hemiGround: 0x1a140c, hemiIntensity: 0.22,
  sunColor: 0x9ab0d8, sunIntensity: 0.18, lampIntensity: 1.5, lampEmissive: 1.1,
}
type Palette = typeof LIGHT

/** 书架用书的低饱和配色（亮暗通用，暗色靠光照自然压暗）。 */
const BOOK_COLORS = [0xb0705f, 0x7d9a6a, 0x6f88a8, 0xc2a468, 0x9480a8, 0xa8926a, 0x5f8a8a, 0xbd8a7a]

/** 确定性的伪随机（按序号取 hash），避免每次加载房间长得不一样。 */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Canvas 2D 生成竖幅书法卷轴纹理：白宣纸底（细噪点）+ 墨色汉字「静」与
 * 两笔飞白 + 右下角红色印章，纯程序化、无外部图片文件。
 * document/canvas 不可用（无 DOM 的冒烟环境）或绘制失败时返回 null，
 * 调用方退化为纯色宣纸材质；字体失败时退化为简单墨点+印章红点。
 */
function makeScrollTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  try {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 512
    const g = c.getContext('2d')
    if (!g) return null
    // 宣纸底：微黄白 + 稀疏纤维噪点
    g.fillStyle = '#faf5e8'
    g.fillRect(0, 0, 256, 512)
    for (let i = 0; i < 300; i += 1) {
      g.fillStyle = `rgba(120, 100, 70, ${0.02 + hash01(i + 600) * 0.05})`
      g.fillRect(hash01(i) * 256, hash01(i + 50) * 512, 1.5, 1.5)
    }
    g.strokeStyle = 'rgba(90, 70, 50, 0.35)' // 装裱边
    g.lineWidth = 3
    g.strokeRect(10, 10, 236, 492)
    try {
      // 墨色汉字 + 两笔飞白
      g.fillStyle = '#2b2620'
      g.font = '170px "Kaiti SC", "STKaiti", "KaiTi", "楷体", serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('静', 128, 205)
      g.strokeStyle = 'rgba(43, 38, 32, 0.85)'
      g.lineCap = 'round'
      g.lineWidth = 14
      g.beginPath(); g.moveTo(58, 358); g.quadraticCurveTo(130, 336, 200, 370); g.stroke()
      g.lineWidth = 8
      g.beginPath(); g.moveTo(80, 400); g.quadraticCurveTo(140, 420, 188, 396); g.stroke()
    } catch {
      // 退化：三个墨点
      g.fillStyle = '#2b2620'
      for (const [dx, dy, r] of [[100, 200, 26], [150, 260, 18], [120, 330, 14]]) {
        g.beginPath()
        g.arc(dx, dy, r, 0, Math.PI * 2)
        g.fill()
      }
    }
    // 红色印章（字体不可用时留纯红块也成立）
    g.fillStyle = '#b03a2a'
    g.fillRect(176, 434, 40, 40)
    try {
      g.fillStyle = 'rgba(250, 245, 232, 0.9)'
      g.font = '26px "Kaiti SC", "STKaiti", "KaiTi", serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText('印', 196, 455)
    } catch { /* 纯红印章即可 */ }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  } catch {
    return null
  }
}

/**
 * Canvas 2D 生成雕龙茶盘纹理：胡桃木底（拉丝木纹）+ 深色盘龙刻线
 * （S 形龙身 + 龙首圆与双角 + 回纹边框），纯程序化、无外部图片文件。
 * document/canvas 不可用或绘制失败时返回 null，调用方退化为纯色木材质。
 */
function makeTrayTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  try {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 160
    const g = c.getContext('2d')
    if (!g) return null
    // 胡桃木底 + 纵向拉丝木纹
    g.fillStyle = '#b08a58'
    g.fillRect(0, 0, 256, 160)
    for (let i = 0; i < 40; i += 1) {
      g.strokeStyle = `rgba(96, 64, 32, ${0.05 + hash01(i + 700) * 0.08})`
      g.lineWidth = 1 + hash01(i + 720) * 1.5
      const y = hash01(i + 740) * 160
      g.beginPath()
      g.moveTo(0, y)
      g.bezierCurveTo(80, y + (hash01(i + 760) - 0.5) * 10, 170, y + (hash01(i + 780) - 0.5) * 10, 256, y)
      g.stroke()
    }
    // 盘龙刻线：S 形龙身
    g.strokeStyle = 'rgba(72, 46, 22, 0.55)'
    g.lineCap = 'round'
    g.lineWidth = 5
    g.beginPath()
    g.moveTo(28, 104)
    g.bezierCurveTo(66, 44, 116, 128, 158, 68)
    g.bezierCurveTo(178, 40, 202, 48, 216, 70)
    g.stroke()
    // 背鳍短刻线（沿龙身几个固定点）
    g.lineWidth = 2
    for (const [fx, fy, dx, dy] of [[52, 82, -6, -12], [88, 78, -2, -13], [122, 96, 4, -12], [156, 62, 6, -11], [188, 52, 8, -9]]) {
      g.beginPath()
      g.moveTo(fx, fy)
      g.lineTo(fx + dx, fy + dy)
      g.stroke()
    }
    // 龙首：圈 + 双角
    g.lineWidth = 3
    g.beginPath()
    g.arc(222, 66, 12, 0, Math.PI * 2)
    g.stroke()
    g.beginPath(); g.moveTo(214, 56); g.lineTo(206, 42); g.stroke()
    g.beginPath(); g.moveTo(228, 54); g.lineTo(228, 38); g.stroke()
    // 回纹式边框
    g.strokeStyle = 'rgba(72, 46, 22, 0.4)'
    g.lineWidth = 2
    g.strokeRect(8, 8, 240, 144)
    g.strokeRect(16, 16, 224, 128)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  } catch {
    return null
  }
}

/**
 * 搭书房场景图（不创建渲染器，可在无 WebGL 环境构建，便于冒烟测试）。
 * 房间约 9 x 8 x 3.4：后墙开大窗，左墙靠书架，书桌贴后墙右侧，
 * 椅在桌前，地毯铺桌前方，绿植在窗左角。
 */
export function buildStudyScene(): StudyScene {
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(LIGHT.fog, 9, 26)
  scene.background = new THREE.Color(LIGHT.fog)

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 60)
  camera.position.set(0.45, 1.68, 0.55)

  /** 随主题换色的材质登记表。 */
  const themedMats: { m: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial; k: keyof Palette }[] = []
  const mat = (k: keyof Palette, opts: THREE.MeshStandardMaterialParameters = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: LIGHT[k] as number, roughness: 0.92, metalness: 0, ...opts })
    themedMats.push({ m, k })
    return m
  }
  const basic = (k: keyof Palette) => {
    const m = new THREE.MeshBasicMaterial({ color: LIGHT[k] as number })
    themedMats.push({ m, k })
    return m
  }
  const flat = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...opts })

  const box = (
    w: number, h: number, d: number, m: THREE.Material,
    x: number, y: number, z: number, shadow = true, parent: THREE.Object3D = scene,
  ) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
    mesh.position.set(x, y, z)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }

  /* ---- 房间壳：地板 / 天花 / 三面墙（后墙开窗洞） ---- */
  const W = 9, D = 8, H = 3.4, T = 0.12
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat('floor', { roughness: 0.85 }))
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat('ceiling'))
  ceil.rotation.x = Math.PI / 2
  ceil.position.y = H
  scene.add(ceil)

  const wallMat = mat('wall')
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat)
  sideL.rotation.y = Math.PI / 2
  sideL.position.set(-W / 2, H / 2, 0)
  sideL.receiveShadow = true
  scene.add(sideL)
  const sideR = sideL.clone()
  sideR.rotation.y = -Math.PI / 2
  sideR.position.x = W / 2
  scene.add(sideR)

  // 后墙（z=-D/2）窗洞：中心 x=-0.9，宽 2.8，窗台 y=1.0，窗顶 y=2.6
  const winX = -0.9, winW = 2.8, sillY = 1.0, winTop = 2.6
  const winL = winX - winW / 2, winR = winX + winW / 2
  box(winL + W / 2, H, T, wallMat, (-W / 2 + winL) / 2, H / 2, -D / 2, false) // 窗左段
  box(W / 2 - winR, H, T, wallMat, (winR + W / 2) / 2, H / 2, -D / 2, false) // 窗右段
  box(winW, sillY, T, wallMat, winX, sillY / 2, -D / 2, false) // 窗台下段
  box(winW, H - winTop, T, wallMat, winX, (winTop + H) / 2, -D / 2, false) // 窗顶段

  /* ---- 前墙开门：转到房间后侧出门，到屋外体素世界 ---- */
  const doorW = 0.96, doorH = 2.12, doorX = 0.12
  const doorL = doorX - doorW / 2, doorR = doorX + doorW / 2
  box(doorL + W / 2, H, T, wallMat, (-W / 2 + doorL) / 2, H / 2, D / 2, false)
  box(W / 2 - doorR, H, T, wallMat, (doorR + W / 2) / 2, H / 2, D / 2, false)
  box(doorW, H - doorH, T, wallMat, doorX, (doorH + H) / 2, D / 2, false)
  const door = new THREE.Group()
  door.name = 'door'
  door.userData.hotspot = 'door'
  scene.add(door)
  const doorMat = mat('woodDark', { roughness: 0.68 })
  const doorFace = mat('wood', { roughness: 0.62 })
  box(doorW - 0.05, doorH - 0.03, 0.07, doorMat, doorX, doorH / 2, D / 2 - 0.03, true, door)
  box(0.34, 0.72, 0.02, doorFace, doorX - 0.18, 1.48, D / 2 + 0.02, true, door)
  box(0.34, 0.72, 0.02, doorFace, doorX + 0.18, 1.48, D / 2 + 0.02, true, door)
  box(0.34, 0.68, 0.02, doorFace, doorX - 0.18, 0.56, D / 2 + 0.02, true, door)
  box(0.34, 0.68, 0.02, doorFace, doorX + 0.18, 0.56, D / 2 + 0.02, true, door)
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), mat('wood', { roughness: 0.35 }))
  knob.position.set(doorX + 0.38, 1.02, D / 2 + 0.05)
  door.add(knob)

  /* ---- 窗户：天空、太阳/月亮、窗框、窗棂、窗台 ---- */
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(winW + 1.6, winTop - sillY + 1.2), basic('sky'))
  sky.position.set(winX, (sillY + winTop) / 2, -D / 2 - 0.35)
  scene.add(sky)
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), basic('sunDisc'))
  sunDisc.position.set(winX - 0.7, 2.15, -D / 2 - 0.3)
  scene.add(sunDisc)

  const frameMat = mat('frame', { roughness: 0.6 })
  const fT = 0.07, fD = 0.18
  box(winW + fT * 2, fT, fD, frameMat, winX, sillY, -D / 2, false) // 下框
  box(winW + fT * 2, fT, fD, frameMat, winX, winTop, -D / 2, false) // 上框
  box(fT, winTop - sillY, fD, frameMat, winL, (sillY + winTop) / 2, -D / 2, false)
  box(fT, winTop - sillY, fD, frameMat, winR, (sillY + winTop) / 2, -D / 2, false)
  box(0.045, winTop - sillY, 0.06, frameMat, winX, (sillY + winTop) / 2, -D / 2, false) // 竖棂
  box(winW, 0.045, 0.06, frameMat, winX, (sillY + winTop) / 2, -D / 2, false) // 横棂
  box(winW + 0.3, 0.06, 0.24, frameMat, winX, sillY - 0.03, -D / 2 + 0.06) // 窗台板

  /* ---- 书桌 + 台灯（暖光点光源）；整组标 hotspot=desk，供点击展开工作区 ---- */
  const desk = new THREE.Group()
  desk.name = 'desk'
  desk.userData.hotspot = 'desk'
  scene.add(desk)
  const deskMat = mat('wood', { roughness: 0.7 })
  const deskX = 1.7, deskZ = -3.5
  box(1.9, 0.07, 0.85, deskMat, deskX, 0.75, deskZ, true, desk) // 桌面
  for (const [lx, lz] of [[-0.85, -0.32], [0.85, -0.32], [-0.85, 0.32], [0.85, 0.32]]) {
    box(0.07, 0.72, 0.07, deskMat, deskX + lx, 0.36, deskZ + lz, true, desk)
  }
  box(1.5, 0.28, 0.06, deskMat, deskX, 0.55, deskZ - 0.36, true, desk) // 桌后挡板

  const lampX = 1.15, lampZ = -3.55
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 16), mat('woodDark'))
  lampBase.position.set(lampX, 0.81, lampZ)
  lampBase.castShadow = true
  desk.add(lampBase)
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 8), mat('woodDark'))
  lampStem.position.set(lampX, 1.0, lampZ)
  desk.add(lampStem)
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xf0d9a8, roughness: 0.8, emissive: 0xffc978, emissiveIntensity: LIGHT.lampEmissive,
  })
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.18, 16, 1, true), shadeMat)
  shade.position.set(lampX, 1.2, lampZ)
  shade.castShadow = true
  desk.add(shade)
  const lampLight = new THREE.PointLight(0xffd9a0, LIGHT.lampIntensity, 6, 2)
  lampLight.position.set(lampX, 1.12, lampZ)
  desk.add(lampLight)

  /* ---- 书架（左墙）+ 彩色低饱和的书 ---- */
  const shelfMat = mat('shelfWood', { roughness: 0.75 })
  const shX = -W / 2 + 0.18, shW = 2.4, shH = 2.2, shD = 0.34, shZ = -0.6
  box(0.03, shH, shW, shelfMat, -W / 2 + 0.015, shH / 2, shZ) // 背板
  box(shD, shH, 0.05, shelfMat, shX, shH / 2, shZ - shW / 2) // 侧板
  box(shD, shH, 0.05, shelfMat, shX, shH / 2, shZ + shW / 2)
  box(shD, 0.05, shW, shelfMat, shX, shH - 0.025, shZ) // 顶板
  box(shD, 0.05, shW, shelfMat, shX, 0.025, shZ) // 底板
  const shelfRows = [0.55, 1.1, 1.65]
  for (const y of shelfRows) box(shD - 0.04, 0.04, shW - 0.08, shelfMat, shX, y, shZ)
  let bi = 0
  for (const rowY of shelfRows) {
    let z = shZ - shW / 2 + 0.12
    while (z < shZ + shW / 2 - 0.16) {
      const bw = 0.07 + hash01(bi) * 0.07
      const bh = 0.24 + hash01(bi + 100) * 0.1
      if (hash01(bi + 200) > 0.18) { // 偶尔留空隙
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(shD - 0.12, bh, bw),
          flat(BOOK_COLORS[bi % BOOK_COLORS.length], { roughness: 0.85 }),
        )
        book.position.set(shX, rowY + 0.02 + bh / 2, z + bw / 2)
        book.castShadow = true
        scene.add(book)
      }
      z += bw + 0.015
      bi += 1
    }
  }

  /* ---- 椅子 ---- */
  const chairMat = mat('woodDark', { roughness: 0.7 })
  const chair = new THREE.Group()
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), chairMat)
  seat.position.y = 0.45
  chair.add(seat)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.55, 0.05), chairMat)
  back.position.set(0, 0.75, -0.21)
  chair.add(back)
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), chairMat)
    leg.position.set(lx, 0.225, lz)
    chair.add(leg)
  }
  chair.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true } })
  chair.position.set(1.45, 0, -2.15)
  chair.rotation.y = -0.35
  scene.add(chair)

  /* ---- 第七轮：双人沙发（右墙，面向室内 -x，不挡巡航主视线） ---- */
  const sofaMat = mat('sofa', { roughness: 0.95 })
  const sofa = new THREE.Group()
  const sofaBox = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sofaMat)
    mesh.position.set(x, y, z)
    sofa.add(mesh)
  }
  sofaBox(1.5, 0.22, 0.7, 0, 0.26, 0) // 底座
  for (const cx of [-0.36, 0.36]) sofaBox(0.68, 0.13, 0.62, cx, 0.43, 0.03) // 两个坐垫
  sofaBox(1.5, 0.52, 0.16, 0, 0.62, -0.28) // 靠背
  for (const ax of [-0.78, 0.78]) sofaBox(0.16, 0.34, 0.7, ax, 0.48, 0) // 扶手
  for (const [lx, lz] of [[-0.7, -0.27], [0.7, -0.27], [-0.7, 0.27], [0.7, 0.27]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.15, 8), chairMat)
    leg.position.set(lx, 0.075, lz)
    sofa.add(leg)
  }
  // 两个低饱和抱枕（鼠尾草绿 + 米白）
  const pillowA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.12), mat('pillowA', { roughness: 0.95 }))
  pillowA.position.set(-0.42, 0.58, -0.16)
  pillowA.rotation.set(-0.18, 0.12, 0.06)
  sofa.add(pillowA)
  const pillowB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.12), mat('pillowB', { roughness: 0.95 }))
  pillowB.position.set(0.4, 0.57, -0.15)
  pillowB.rotation.set(-0.15, -0.15, -0.05)
  sofa.add(pillowB)
  sofa.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true } })
  sofa.position.set(4.02, 0, 0.4)
  sofa.rotation.y = -Math.PI / 2
  scene.add(sofa)

  /* ---- 地毯（外圈 + 内圈） ---- */
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), mat('rug'))
  rug.rotation.x = -Math.PI / 2
  rug.position.set(0.5, 0.012, -1.0)
  rug.receiveShadow = true
  scene.add(rug)
  const rugIn = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), mat('rugInner'))
  rugIn.rotation.x = -Math.PI / 2
  rugIn.position.set(0.5, 0.018, -1.0)
  rugIn.receiveShadow = true
  scene.add(rugIn)

  /* ---- 绿植（窗左角：花盆 + 放射状叶子） ---- */
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.3, 12), mat('pot'))
  pot.position.set(-3.5, 0.15, -3.3)
  pot.castShadow = true
  scene.add(pot)
  const leafMat = mat('leaf', { roughness: 0.8 })
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5 + hash01(i) * 0.25, 6), leafMat)
    const a = (i / 7) * Math.PI * 2
    leaf.position.set(-3.5 + Math.cos(a) * 0.08, 0.52, -3.3 + Math.sin(a) * 0.08)
    leaf.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45)
    leaf.castShadow = true
    scene.add(leaf)
  }

  /* ---- 第七轮：窗角高大叶植物（长杆 + 大叶，天堂鸟/琴叶榕感） ---- */
  const tallPot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 12), mat('pot'))
  tallPot.position.set(-2.6, 0.17, -3.55)
  tallPot.castShadow = true
  tallPot.receiveShadow = true
  scene.add(tallPot)
  const tallX = -2.6, tallZ = -3.55
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 + 0.4
    const stemH = 0.9 + hash01(i + 300) * 0.5
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, stemH, 6), leafMat)
    stem.position.set(tallX + Math.cos(a) * 0.05, 0.34 + stemH / 2, tallZ + Math.sin(a) * 0.05)
    stem.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22)
    stem.castShadow = true
    scene.add(stem)
    const bigLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), leafMat)
    bigLeaf.scale.set(0.9, 1.9, 0.25)
    bigLeaf.position.set(
      tallX + Math.cos(a) * (0.1 + stemH * 0.16),
      0.36 + stemH,
      tallZ + Math.sin(a) * (0.1 + stemH * 0.16),
    )
    bigLeaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5 + 0.2)
    bigLeaf.castShadow = true
    scene.add(bigLeaf)
  }

  /* ---- 第八轮：书柜顶垂吊植物已按用户反馈删除 ---- */

  /* ---- 第七轮：走道角落小多肉（短叶丛） ---- */
  const sucPot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.18, 10), mat('pot'))
  sucPot.position.set(4.0, 0.09, 2.6)
  sucPot.castShadow = true
  sucPot.receiveShadow = true
  scene.add(sucPot)
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2 + hash01(i + 500) * 0.1, 5), leafMat)
    leaf.position.set(4.0 + Math.cos(a) * 0.05, 0.26, 2.6 + Math.sin(a) * 0.05)
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
    leaf.castShadow = true
    scene.add(leaf)
  }

  /* ---- 第八轮：书柜旁日式地台床（贴左墙、与书柜同侧排开，不挡巡航视线） ---- */
  const bedX = -3.85, bedZ = 2.2
  const bedFrameMat = mat('wood', { roughness: 0.75 })
  box(1.15, 0.18, 2.1, bedFrameMat, bedX, 0.09, bedZ) // 地台床架
  box(1.15, 0.5, 0.06, bedFrameMat, bedX, 0.43, bedZ - 1.08) // 床头板（靠书柜一端）
  box(1.05, 0.14, 2.0, mat('bedding', { roughness: 0.95 }), bedX, 0.25, bedZ) // 米白床垫
  box(1.08, 0.045, 1.15, mat('blanket', { roughness: 0.98 }), bedX, 0.345, bedZ + 0.42) // 薄被（床尾半边）
  for (const px of [-0.27, 0.27]) { // 两个枕头（床头并排放）
    const bedPillow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.26), mat('pillowB', { roughness: 0.95 }))
    bedPillow.position.set(bedX + px, 0.365, bedZ - 0.82)
    bedPillow.rotation.x = -0.12
    bedPillow.castShadow = true
    bedPillow.receiveShadow = true
    scene.add(bedPillow)
  }

  /* ---- 第八轮：床头柜（床与书柜之间）+ 自发光小台灯（无独立光源，随主题） ---- */
  const nsX = -4.12, nsZ = 0.85
  const nsMat = mat('woodDark', { roughness: 0.7 })
  box(0.4, 0.42, 0.34, nsMat, nsX, 0.21, nsZ) // 柜体
  box(0.02, 0.14, 0.26, mat('wood', { roughness: 0.7 }), nsX + 0.21, 0.24, nsZ) // 抽屉面板
  const nsKnob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), mat('woodDark'))
  nsKnob.position.set(nsX + 0.225, 0.24, nsZ)
  nsKnob.castShadow = true
  scene.add(nsKnob)
  const nsLampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.025, 12), nsMat)
  nsLampBase.position.set(nsX, 0.433, nsZ)
  nsLampBase.castShadow = true
  scene.add(nsLampBase)
  const nsLampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 6), nsMat)
  nsLampStem.position.set(nsX, 0.51, nsZ)
  scene.add(nsLampStem)
  const nsShadeMat = new THREE.MeshStandardMaterial({
    color: 0xf0d9a8, roughness: 0.8, emissive: 0xffc978, emissiveIntensity: LIGHT.lampEmissive,
  })
  const nsShade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.09, 12, 1, true), nsShadeMat)
  nsShade.position.set(nsX, 0.6, nsZ)
  nsShade.castShadow = true
  scene.add(nsShade)

  /* ---- 第八轮：沙发前茶几 + 中国风雕龙煮茶茶具 ---- */
  const ctX = 2.9, ctZ = 0.4, ctTop = 0.36 // 茶几中心与桌面高度
  const ctMat = mat('woodDark', { roughness: 0.65 })
  box(0.95, 0.05, 0.5, ctMat, ctX, ctTop - 0.025, ctZ) // 桌面
  for (const [lx, lz] of [[-0.4, -0.18], [0.4, -0.18], [-0.4, 0.18], [0.4, 0.18]]) {
    box(0.05, ctTop - 0.05, 0.05, ctMat, ctX + lx, (ctTop - 0.05) / 2, ctZ + lz)
  }
  // 雕龙茶盘：Canvas 纹理木盘（纹理不可用时退化为纯色木）
  const trayTex = makeTrayTexture()
  const trayMat = new THREE.MeshStandardMaterial({
    color: LIGHT.woodDark, // 有纹理时作为木底色叠在 map 上，随主题换色
    ...(trayTex ? { map: trayTex } : {}),
    roughness: 0.55,
  })
  themedMats.push({ m: trayMat, k: 'woodDark' })
  const tea = new THREE.Group()
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.028, 0.3), trayMat)
  tray.position.set(0, 0.014, 0)
  tea.add(tray)
  // 青釉茶壶：弧线壶身 + 壶盖 + 斜壶嘴 + 盘龙柄（半环 + 小龙头）
  const teawareMat = mat('celadon', { roughness: 0.32 })
  const teapot = new THREE.Group()
  const potBody = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), teawareMat)
  potBody.scale.set(1, 0.82, 1)
  potBody.position.y = 0.055
  teapot.add(potBody)
  const potLid = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.02, 10), teawareMat)
  potLid.position.y = 0.105
  teapot.add(potLid)
  const potKnob = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 5), teawareMat)
  potKnob.position.y = 0.118
  teapot.add(potKnob)
  const potSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.013, 0.07, 8), teawareMat)
  potSpout.position.set(0.062, 0.075, 0)
  potSpout.rotation.z = -0.9
  teapot.add(potSpout)
  const potHandle = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.008, 6, 12, Math.PI), teawareMat)
  potHandle.position.set(-0.055, 0.055, 0)
  teapot.add(potHandle)
  const dragonHead = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), teawareMat)
  dragonHead.position.set(-0.055, 0.1, 0)
  teapot.add(dragonHead)
  const dragonSnout = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.014, 5), teawareMat)
  dragonSnout.position.set(-0.055, 0.106, 0.012)
  dragonSnout.rotation.x = Math.PI / 2
  teapot.add(dragonSnout)
  teapot.position.set(-0.12, 0.028, 0)
  tea.add(teapot)
  // 三只小圆杯 + 杯垫
  for (const [cx, cz] of [[0.08, 0.08], [0.15, -0.01], [0.06, -0.09]]) {
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.006, 10), teawareMat)
    saucer.position.set(cx, 0.031, cz)
    tea.add(saucer)
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.014, 0.028, 10), teawareMat)
    cup.position.set(cx, 0.048, cz)
    tea.add(cup)
  }
  tea.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true } })
  tea.position.set(ctX, ctTop, ctZ)
  tea.rotation.y = 0.25 // 茶盘斜向摆，壶嘴朝向沙发
  scene.add(tea)

  /* ---- 第七轮：书桌上墙竖幅书法卷轴（Canvas 纹理，暗色下宣纸微亮） ---- */
  const scrollTex = makeScrollTexture()
  const scrollMat = new THREE.MeshStandardMaterial({
    color: LIGHT.paper, // 有纹理时作为宣纸底色叠在 map 上，随主题换色
    ...(scrollTex ? { map: scrollTex, emissiveMap: scrollTex } : {}),
    roughness: 0.9,
    emissive: 0xfff2d0,
    emissiveIntensity: LIGHT.scrollGlow,
  })
  themedMats.push({ m: scrollMat, k: 'paper' })
  const scroll = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.3, 0.025), scrollMat)
  scroll.position.set(deskX, 2.0, -D / 2 + 0.09)
  scroll.castShadow = true
  scroll.receiveShadow = true
  scene.add(scroll)
  const rodMat = mat('woodDark', { roughness: 0.6 })
  for (const ry of [2.0 + 0.68, 2.0 - 0.68]) { // 上下木轴头
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 10), rodMat)
    rod.rotation.z = Math.PI / 2
    rod.position.set(deskX, ry, -D / 2 + 0.09)
    rod.castShadow = true
    scene.add(rod)
  }

  /* ---- 灯光：半球环境光 + 窗外日光（软阴影） + 台灯点光 ---- */
  const hemi = new THREE.HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, LIGHT.hemiIntensity)
  scene.add(hemi)

  const sun = new THREE.DirectionalLight(LIGHT.sunColor, LIGHT.sunIntensity)
  sun.position.set(-3.5, 5.5, -9)
  sun.target.position.set(0.8, 0, -1)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -7
  sun.shadow.camera.right = 7
  sun.shadow.camera.top = 7
  sun.shadow.camera.bottom = -7
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 25
  sun.shadow.bias = -0.0008
  sun.shadow.normalBias = 0.02
  scene.add(sun)
  scene.add(sun.target)

  /** 亮暗主题切换：材质色、雾/背景色、三类灯光参数一次换完。 */
  const setTheme = (dark: boolean) => {
    const p = dark ? DARK : LIGHT
    for (const { m, k } of themedMats) m.color.setHex(p[k] as number)
    ;(scene.fog as THREE.Fog).color.setHex(p.fog)
    ;(scene.background as THREE.Color).setHex(p.fog)
    hemi.color.setHex(p.hemiSky)
    hemi.groundColor.setHex(p.hemiGround)
    hemi.intensity = p.hemiIntensity
    sun.color.setHex(p.sunColor)
    sun.intensity = p.sunIntensity
    lampLight.intensity = p.lampIntensity
    shadeMat.emissiveIntensity = p.lampEmissive
    nsShadeMat.emissiveIntensity = p.lampEmissive // 第八轮：床头小台灯同步明暗
    scrollMat.emissiveIntensity = p.scrollGlow // 暗色下宣纸在暖光里略亮
  }

  /** 释放场景内全部几何体与材质（灯光随场景图一起被丢弃）。 */
  const dispose = () => {
    scrollTex?.dispose() // 第七轮：canvas 纹理随场景一起回收
    trayTex?.dispose() // 第八轮：茶盘雕龙 canvas 纹理一并回收
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
        const m = o.material as THREE.Material | THREE.Material[]
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m.dispose()
      }
    })
  }

  return { scene, camera, setTheme, dispose }
}

/**
 * 在容器元素里创建 WebGL 书房：渲染器（软阴影、pixelRatio<=1.5）+
 * OrbitControls（阻尼、极角/半径限位）。自动巡航是第六轮的钟摆式
 * 往返摆动（见 updateCruise），不再使用 OrbitControls.autoRotate。
 * WebGL 不可用会抛错，调用方负责回退。
 * @param el - 固定定位容器，canvas 会 append 进去并跟随其尺寸。
 */
export function createStudyRoom(el: HTMLElement): StudyRoom {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  renderer.setPixelRatio(Math.min(dpr, 1.5))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  // 场景几何与灯光都不动，每帧重算软阴影是纯浪费；首帧 + 换主题再烘一次
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  const { scene, camera, setTheme: applySceneTheme, dispose: disposeScene } = buildStudyScene()
  // 第一人称转头用 YXZ（和屋外一致）；巡航仍走 lookAt，不受 Euler 顺序影响
  camera.rotation.order = 'YXZ'
  const setTheme = (dark: boolean) => {
    applySceneTheme(dark)
    renderer.shadowMap.needsUpdate = true
  }

  const resize = () => {
    const w = el.clientWidth || 1
    const h = el.clientHeight || 1
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  // 用 ResizeObserver 持续跟随容器尺寸（初始化时容器可能尚未布局/尺寸为 0）
  let ro: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => resize())
    ro.observe(el)
  }
  if (typeof window !== 'undefined') window.addEventListener('resize', resize)
  el.appendChild(renderer.domElement)
  // 下一帧再校正一次，兜住布局/样式刚生效时的尺寸
  if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(() => resize())

  const AZIMUTH_MIN = -1.15
  const AZIMUTH_MAX = 1.15
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0.2, 1.12, -2.1)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.enablePan = false
  controls.minDistance = 2.2
  controls.maxDistance = 6.8
  controls.minPolarAngle = 0.55
  controls.maxPolarAngle = 1.72
  controls.minAzimuthAngle = AZIMUTH_MIN
  controls.maxAzimuthAngle = AZIMUTH_MAX
  // 第六轮：巡航不再走 autoRotate（恒为 false），摆动由 updateCruise 在渲染循环里写相机
  controls.autoRotate = false
  controls.update()
  let orbitListening = true
  const releaseOrbit = () => {
    controls.enabled = false
    controls.enableRotate = false
    controls.enableZoom = false
    controls.minAzimuthAngle = -Infinity
    controls.maxAzimuthAngle = Infinity
    if (orbitListening) {
      controls.disconnect()
      orbitListening = false
    }
  }
  const restoreOrbit = () => {
    controls.minAzimuthAngle = AZIMUTH_MIN
    controls.maxAzimuthAngle = AZIMUTH_MAX
    controls.enableRotate = true
    controls.enableZoom = true
    controls.enabled = true
    if (!orbitListening) {
      controls.connect(renderer.domElement)
      orbitListening = true
    }
  }

  /** 数值钳制（微调限位与巡航边界共用）。 */
  const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

  /* ---- 第五轮：程序化视角微调（键盘 / Alt 拖拽 / Alt 滚轮共用） ---- */
  const homePos = camera.position.clone()
  const homeTarget = controls.target.clone()
  const _offset = new THREE.Vector3()
  const _spherical = new THREE.Spherical()

  /* ---- 第六轮：钟摆式自动巡航（往返摆动，取代 autoRotate 单向绕圈） ----
     以方位角限位中点为基线做三角波折返：theta 在 [mid-half, mid+half]
     内匀速往返，half = 半量程 * amplitude；俯仰(phi)与距离(radius)不动。
     交互（OrbitControls start / 键盘 / Alt）暂停；恢复时 recapture 当前
     azimuth 作为摆动起点，继续沿原方向摆，不跳变。 */
  const cruise = {
    enabled: true, // 默认开，与旧版 autoRotate 默认一致
    speed: 0.35, // autoRotateSpeed 语义：角速度 = speed * (2π/60) rad/s
    amplitude: 1.0, // 0.4~1.2，1.0 = 摆满 min~maxAzimuth
    theta: 0, // 当前摆动方位角（recapture 时从相机捕获）
    dir: 1, // 摆动方向：+1 向右 / -1 向左
    pauseCount: 0, // 嵌套暂停计数（漫游、OrbitControls 拖拽各占一层）
    resumeTimer: 0, // 程序化微调（键盘/Alt）后的延时恢复
    last: 0, // updateCruise 的上一帧时间戳
  }
  /** 摆动边界：限位中点 ± 半量程*幅度，再钳回限位内（幅度>1 时不越界）。 */
  const cruiseBounds = (): [number, number] => {
    const lo = controls.minAzimuthAngle
    const hi = controls.maxAzimuthAngle
    const mid = (lo + hi) / 2
    const half = ((hi - lo) / 2) * cruise.amplitude
    return [Math.max(lo, mid - half), Math.min(hi, mid + half)]
  }
  /** 从当前相机捕获摆动起点；若已在边界外则钳回并把方向拨向界内。 */
  const recapture = () => {
    _offset.copy(camera.position).sub(controls.target)
    _spherical.setFromVector3(_offset)
    const [lo, hi] = cruiseBounds()
    cruise.theta = clampNum(_spherical.theta, lo, hi)
    if (cruise.theta <= lo) cruise.dir = 1
    else if (cruise.theta >= hi) cruise.dir = -1
  }
  const cruisePaused = () => cruise.pauseCount > 0 || cruise.resumeTimer !== 0
  const pauseCruise = () => { cruise.pauseCount += 1 }
  const resumeCruise = () => {
    cruise.pauseCount = Math.max(0, cruise.pauseCount - 1)
    if (!cruisePaused()) recapture()
  }
  /** 键盘/Alt 等程序化微调也算交互：暂停 0.6s（连续操作顺延），再从当前方位继续。 */
  const touchCruise = () => {
    if (cruise.resumeTimer) clearTimeout(cruise.resumeTimer)
    cruise.resumeTimer = window.setTimeout(() => {
      cruise.resumeTimer = 0
      if (!cruisePaused()) recapture()
    }, 600)
  }
  /** 渲染循环每帧调用：推进摆动相位并用 Spherical 写相机（保持 phi/半径/target）。 */
  const updateCruise = () => {
    if (walk.active) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const dt = Math.min(0.1, cruise.last ? (now - cruise.last) / 1000 : 0)
    cruise.last = now
    if (!cruise.enabled || cruisePaused() || dt <= 0) return
    const [lo, hi] = cruiseBounds()
    cruise.theta += cruise.dir * cruise.speed * (Math.PI / 30) * dt
    if (cruise.theta >= hi) { cruise.theta = hi; cruise.dir = -1 } // 到右端折返
    else if (cruise.theta <= lo) { cruise.theta = lo; cruise.dir = 1 } // 到左端折返
    _offset.copy(camera.position).sub(controls.target)
    _spherical.setFromVector3(_offset)
    _spherical.theta = cruise.theta
    _offset.setFromSpherical(_spherical)
    camera.position.copy(controls.target).add(_offset)
    camera.lookAt(controls.target)
  }
  // OrbitControls 交互（漫游拖拽/滚轮）：start 暂停、end 从当前方位继续
  const onControlsStart = () => pauseCruise()
  const onControlsEnd = () => resumeCruise()
  controls.addEventListener('start', onControlsStart)
  controls.addEventListener('end', onControlsEnd)
  recapture() // 以初始相机方位为摆动起点

  /* ---- 第十一轮：第一人称走动（无小人，只改相机） ---- */
  const EYE = 1.62
  const BODY_R = 0.28
  const BODY_H = 1.8
  const ROOM_CEIL = 3.4
  const WALK_SPEED = 3.1
  const SPRINT_SPEED = 5.0
  const LOOK_SENS = 0.0022
  const GRAVITY = 26
  const JUMP_VEL = 8.8
  const TERMINAL = -45
  const ROOM_HX = 4.5
  const ROOM_HZ = 4.0
  const ORBIT_FOV = camera.fov
  const WALK_FOV = 70
  type Aabb = { x0: number; x1: number; z0: number; z1: number }
  const walls: Aabb[] = [
    { x0: -ROOM_HX, x1: -ROOM_HX + 0.14, z0: -ROOM_HZ, z1: ROOM_HZ },
    { x0: ROOM_HX - 0.14, x1: ROOM_HX, z0: -ROOM_HZ, z1: ROOM_HZ },
    { x0: -ROOM_HX, x1: ROOM_HX, z0: -ROOM_HZ, z1: -ROOM_HZ + 0.14 },
    { x0: -ROOM_HX, x1: 0.12 - 0.48, z0: ROOM_HZ - 0.14, z1: ROOM_HZ },
    { x0: 0.12 + 0.48, x1: ROOM_HX, z0: ROOM_HZ - 0.14, z1: ROOM_HZ },
    { x0: 0.12 - 0.48, x1: 0.12 + 0.48, z0: ROOM_HZ - 0.12, z1: ROOM_HZ }, // 门扇，走近可点/触发
    { x0: 0.75, x1: 2.65, z0: -3.95, z1: -3.05 }, // 书桌
    { x0: 1.17, x1: 1.73, z0: -2.43, z1: -1.87 }, // 椅
    { x0: -4.5, x1: -4.0, z0: -1.85, z1: 0.65 }, // 书架
    { x0: 3.55, x1: 4.5, z0: -0.4, z1: 1.2 }, // 沙发
    { x0: 2.4, x1: 3.4, z0: 0.12, z1: 0.68 }, // 茶几
    { x0: -4.45, x1: -3.25, z0: 1.1, z1: 3.3 }, // 床
    { x0: -4.35, x1: -3.9, z0: 0.65, z1: 1.05 }, // 床头柜
    { x0: -3.75, x1: -3.25, z0: -3.55, z1: -3.05 }, // 窗边花盆
    { x0: -2.85, x1: -2.35, z0: -3.8, z1: -3.3 }, // 高叶
    { x0: 3.82, x1: 4.18, z0: 2.42, z1: 2.78 }, // 多肉
  ]
  const circleHits = (x: number, z: number, box: Aabb) => {
    const nx = clampNum(x, box.x0, box.x1)
    const nz = clampNum(z, box.z0, box.z1)
    const dx = x - nx
    const dz = z - nz
    return dx * dx + dz * dz < BODY_R * BODY_R
  }
  const blocked = (x: number, z: number) => {
    if (x < -ROOM_HX + BODY_R || x > ROOM_HX - BODY_R) return true
    if (z < -ROOM_HZ + BODY_R || z > ROOM_HZ - BODY_R) return true
    return walls.some((b) => circleHits(x, z, b))
  }
  const tryMove = (x: number, z: number, dx: number, dz: number) => {
    const nx = x + dx
    const nz = z + dz
    if (!blocked(nx, nz)) return [nx, nz] as const
    if (!blocked(x + dx, z)) return [x + dx, z] as const
    if (!blocked(x, z + dz)) return [x, z + dz] as const
    return [x, z] as const
  }
  const walkEuler = new THREE.Euler(0, 0, 0, 'YXZ')
  const walkFwd = new THREE.Vector3()
  const walk = {
    active: false,
    yaw: 0,
    pitch: 0,
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
  const applyWalkLook = () => {
    if (controls.enabled || orbitListening) releaseOrbit()
    camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ')
    camera.position.y = walk.footY + EYE
  }
  const resetJump = () => {
    walk.footY = 0
    walk.vy = 0
    walk.grounded = true
    walk.jump = false
  }
  const enterWalk = () => {
    releaseOrbit()
    if (walk.active) return
    walk.active = true
    walkEuler.setFromQuaternion(camera.quaternion, 'YXZ')
    walk.yaw = walkEuler.y
    walk.pitch = clampNum(walkEuler.x, -1.2, 1.2)
    camera.fov = WALK_FOV
    camera.updateProjectionMatrix()
    if (blocked(camera.position.x, camera.position.z) || camera.position.z > 2.4) {
      camera.position.set(0.45, EYE, 0.55)
      walk.yaw = 0.08
      walk.pitch = -0.05
      resetJump()
    } else {
      walk.footY = Math.max(0, camera.position.y - EYE)
      walk.vy = 0
      walk.grounded = walk.footY < 0.05
    }
    applyWalkLook()
    walk.last = 0
  }
  const exitWalk = () => {
    if (!walk.active) return
    walk.active = false
    walk.forward = walk.back = walk.left = walk.right = walk.sprint = walk.jump = false
    walk.last = 0
    resetJump()
    camera.fov = ORBIT_FOV
    camera.updateProjectionMatrix()
    walkFwd.set(0, 0, -1).applyQuaternion(camera.quaternion)
    walkFwd.y = 0
    if (walkFwd.lengthSq() < 1e-6) walkFwd.set(0, 0, -1)
    walkFwd.normalize()
    controls.target.copy(camera.position).addScaledVector(walkFwd, 2.5)
    restoreOrbit()
    controls.update()
    recapture()
  }
  const look = (dx: number, dy: number) => {
    enterWalk()
    walk.yaw -= dx * LOOK_SENS
    walk.pitch -= dy * LOOK_SENS
    walk.pitch = clampNum(walk.pitch, -1.2, 1.2)
    applyWalkLook()
  }
  const setMoveKey = (key: WalkKey, down: boolean) => {
    walk[key] = down
    if (down) enterWalk()
  }
  const isWalking = () => walk.active
  const updateWalk = () => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const dt = Math.min(0.05, walk.last ? (now - walk.last) / 1000 : 0)
    walk.last = now
    if (!walk.active) return false
    applyWalkLook()
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
    if (walk.jump && walk.grounded) {
      walk.vy = JUMP_VEL
      walk.grounded = false
    }
    walk.vy -= GRAVITY * dt
    if (walk.vy < TERMINAL) walk.vy = TERMINAL
    let ny = walk.footY + walk.vy * dt
    if (ny <= 0) {
      ny = 0
      walk.vy = 0
      walk.grounded = true
    } else {
      walk.grounded = false
    }
    if (ny + BODY_H > ROOM_CEIL) {
      ny = ROOM_CEIL - BODY_H
      if (walk.vy > 0) walk.vy = 0
    }
    walk.footY = ny
    camera.position.y = ny + EYE
    return true
  }

  /** 套用用户设置：只覆盖传入的字段，其余保持当前值。 */
  const applyControls = (opts: StudyControlOpts) => {
    if (typeof opts.rotateSpeed === 'number') controls.rotateSpeed = opts.rotateSpeed
    if (typeof opts.zoomSpeed === 'number') controls.zoomSpeed = opts.zoomSpeed
    if (typeof opts.autoRotate === 'boolean') {
      cruise.enabled = opts.autoRotate
      if (cruise.enabled && !walk.active && !cruisePaused()) recapture()
    }
    if (typeof opts.autoRotateSpeed === 'number') cruise.speed = opts.autoRotateSpeed
    if (typeof opts.cruiseAmplitude === 'number' && Number.isFinite(opts.cruiseAmplitude)) {
      cruise.amplitude = clampNum(opts.cruiseAmplitude, 0.4, 1.2)
      recapture() // 幅度变化后钳回新边界
    }
  }

  /* ---- 第五轮：程序化微调实现（共用上面的 _offset/_spherical 与限位钳制） ---- */
  const rotateBy = (dTheta: number, dPhi: number) => {
    if (walk.active) {
      look(dTheta / 0.0022, -dPhi / 0.0022)
      return
    }
    touchCruise() // 交互暂停巡航，0.6s 无后续操作后从当前方位继续
    _offset.copy(camera.position).sub(controls.target)
    _spherical.setFromVector3(_offset)
    _spherical.theta = clampNum(_spherical.theta + dTheta, controls.minAzimuthAngle, controls.maxAzimuthAngle)
    _spherical.phi = clampNum(_spherical.phi + dPhi, controls.minPolarAngle, controls.maxPolarAngle)
    _spherical.makeSafe()
    _offset.setFromSpherical(_spherical)
    camera.position.copy(controls.target).add(_offset)
    controls.update()
  }

  const dollyBy = (factor: number) => {
    touchCruise()
    _offset.copy(camera.position).sub(controls.target)
    _offset.setLength(clampNum(_offset.length() * factor, controls.minDistance, controls.maxDistance))
    camera.position.copy(controls.target).add(_offset)
    controls.update()
  }

  const resetView = () => {
    if (walk.active) exitWalk()
    touchCruise()
    camera.position.copy(homePos)
    controls.target.copy(homeTarget)
    controls.update()
  }

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pickHotspot = (clientX: number, clientY: number): string | null => {
    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width < 1 || rect.height < 1) return null
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    for (const hit of raycaster.intersectObjects(scene.children, true)) {
      let obj: THREE.Object3D | null = hit.object
      while (obj) {
        if (typeof obj.userData.hotspot === 'string') return obj.userData.hotspot
        obj = obj.parent
      }
    }
    return null
  }

  const isNearDoor = () => {
    const p = camera.position
    return p.z > 3.55 && p.z < 4.05 && Math.abs(p.x - 0.12) < 0.46
  }
  const placeWalk = (x: number, z: number, yaw: number, pitch: number) => {
    releaseOrbit()
    walk.active = true
    walk.forward = walk.back = walk.left = walk.right = walk.sprint = false
    resetJump()
    walk.yaw = yaw
    walk.pitch = pitch
    walk.last = 0
    camera.fov = WALK_FOV
    camera.updateProjectionMatrix()
    camera.position.set(x, EYE, z)
    applyWalkLook()
  }
  const placeAtDoor = () => {
    placeWalk(0.12, 1.85, 0, -0.04)
  }
  const placeAtSpawn = () => {
    placeWalk(0.45, 0.55, 0.08, -0.05)
  }

  const dispose = () => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', resize)
    if (cruise.resumeTimer) clearTimeout(cruise.resumeTimer) // 第六轮：收回延时恢复
    cruise.resumeTimer = 0
    controls.removeEventListener('start', onControlsStart)
    controls.removeEventListener('end', onControlsEnd)
    ro?.disconnect()
    controls.dispose()
    disposeScene()
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement.remove()
  }

  return {
    renderer, scene, camera, controls, applyControls, rotateBy, dollyBy, resetView,
    updateCruise, pauseCruise, resumeCruise, pickHotspot,
    enterWalk, exitWalk, isWalking, setMoveKey, look, updateWalk,
    isNearDoor, placeAtDoor, placeAtSpawn, setTheme, dispose,
  }
}
