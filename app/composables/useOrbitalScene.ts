import * as THREE from 'three'
import gsap from 'gsap'
import { getGPUTier } from 'detect-gpu'
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect
} from 'postprocessing'
import type { Ref } from 'vue'
import { usePlanet } from './usePlanet'
import { getSystem } from '~/data/systems'
import { TIMELINE } from '~/config/timeline'
import { POST_PROCESSING_CONFIG } from '~/config/postprocessing'
import { CELESTIAL_RENDER_CONFIG, type RenderQualityTier } from '~/config/celestialRender'
import { milkyWayFragmentShader, milkyWayVertexShader, solarFragmentShader, solarVertexShader } from '~/shaders/spaceShaders'

const kepler186System = getSystem('kepler-186')!
const SYSTEM_REVEAL_AT = TIMELINE.systemReveal

export const useOrbitalScene = (
  containerRef: Ref<HTMLElement | null>,
  scrollProgress: Ref<number>,
  onUnavailable?: () => void,
) => {
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let composer: EffectComposer | null = null
  let renderPass: RenderPass | null = null
  let effectPasses: EffectPass[] = []
  let qualityTier: 'high' | 'medium' | 'low' = 'medium'
  let starParticles: THREE.Points
  let sunMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  let milkyWayMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>
  let systemMapGroup: THREE.Group
  let systemMapMaterials: THREE.Material[] = []
  let glareSprite: THREE.Sprite
  let glareTexture: THREE.CanvasTexture
  let initialized = false
  let running = false
  let renderTicker: ((time: number) => void) | undefined
  let planetController: ReturnType<typeof usePlanet> | null = null
  let pixelRatio = 1
  const maxPixelRatio = () => Math.min(window.devicePixelRatio || 1, 1.5)
  const minPixelRatio = () => Math.min(window.devicePixelRatio || 1, 0.75)
  const isAtMinimumPixelRatio = () => pixelRatio <= minPixelRatio() + 0.001
  let slowFrames = 0
  let fastFrames = 0
  let previousFrameTime = 0
  let smoothedProgress = 0
  let progressVelocity = 0
  let lastFrameDelta = 0
  let lastProfileTime = 0
  let visualCompileRevision = 0
  let reducedMotion = false

  const sunDir = new THREE.Vector3(1.0, 0.5, 0.2).normalize()
  const rotationAxis = new THREE.Vector3()
  const startDir = new THREE.Vector3(0, 0, 1)
  const totalOrbitAngle = startDir.angleTo(sunDir.clone().negate())
  const basePos = new THREE.Vector3()
  const finalPos = new THREE.Vector3()
  const camToPlanet = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const up = new THREE.Vector3()
  const right = new THREE.Vector3()
  const lookHorizon = new THREE.Vector3()
  const finalLookAt = new THREE.Vector3()
  const cameraForward = new THREE.Vector3()
  const sunScreen = new THREE.Vector3()
  const glarePosition = new THREE.Vector3()
  const systemOrbitAxisX = sunDir.clone().negate().normalize()
  const systemOrbitNormal = systemOrbitAxisX.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
  const systemOrbitAxisY = systemOrbitNormal.clone().cross(systemOrbitAxisX).normalize()
  const systemCenter = sunDir.clone().multiplyScalar(4000)
  const systemCameraEnd = systemCenter.clone().addScaledVector(systemOrbitNormal, 18500)

  rotationAxis.crossVectors(startDir, sunDir.clone().negate()).normalize()

  const createLensFlareTexture = () => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 256
    const context = canvas.getContext('2d')

    if (context) {
      context.globalCompositeOperation = 'lighter'

      const halo = context.createRadialGradient(256, 128, 0, 256, 128, 124)
      halo.addColorStop(0, 'rgba(255, 248, 226, 0.95)')
      halo.addColorStop(0.06, 'rgba(255, 219, 158, 0.55)')
      halo.addColorStop(0.22, 'rgba(255, 159, 76, 0.18)')
      halo.addColorStop(1, 'rgba(255, 126, 48, 0)')
      context.fillStyle = halo
      context.fillRect(0, 0, canvas.width, canvas.height)

      const streak = context.createLinearGradient(0, 0, canvas.width, 0)
      streak.addColorStop(0, 'rgba(255, 172, 92, 0)')
      streak.addColorStop(0.2, 'rgba(255, 187, 112, 0.06)')
      streak.addColorStop(0.42, 'rgba(255, 220, 166, 0.18)')
      streak.addColorStop(0.49, 'rgba(255, 241, 211, 0.58)')
      streak.addColorStop(0.5, 'rgba(255, 255, 245, 0.92)')
      streak.addColorStop(0.51, 'rgba(255, 241, 211, 0.58)')
      streak.addColorStop(0.58, 'rgba(255, 220, 166, 0.18)')
      streak.addColorStop(0.8, 'rgba(255, 187, 112, 0.06)')
      streak.addColorStop(1, 'rgba(255, 172, 92, 0)')
      context.fillStyle = streak
      context.fillRect(0, 127.4, canvas.width, 1.2)

      const beam = context.createLinearGradient(0, 111, 0, 145)
      beam.addColorStop(0, 'rgba(255, 220, 174, 0)')
      beam.addColorStop(0.42, 'rgba(255, 224, 184, 0.22)')
      beam.addColorStop(0.5, 'rgba(255, 246, 225, 0.82)')
      beam.addColorStop(0.58, 'rgba(255, 224, 184, 0.22)')
      beam.addColorStop(1, 'rgba(255, 220, 174, 0)')
      context.fillStyle = beam
      context.fillRect(0, 111, canvas.width, 34)

      const core = context.createLinearGradient(0, 0, canvas.width, 0)
      core.addColorStop(0, 'rgba(255, 255, 255, 0)')
      core.addColorStop(0.43, 'rgba(255, 238, 204, 0.18)')
      core.addColorStop(0.5, 'rgba(255, 255, 255, 0.98)')
      core.addColorStop(0.57, 'rgba(255, 238, 204, 0.18)')
      core.addColorStop(1, 'rgba(255, 255, 255, 0)')
      context.fillStyle = core
      context.fillRect(0, 126, canvas.width, 4)

      const verticalRay = context.createLinearGradient(0, 0, 0, canvas.height)
      verticalRay.addColorStop(0, 'rgba(255, 198, 128, 0)')
      verticalRay.addColorStop(0.5, 'rgba(255, 226, 184, 0.14)')
      verticalRay.addColorStop(1, 'rgba(255, 198, 128, 0)')
      context.fillStyle = verticalRay
      context.fillRect(254.5, 0, 3, canvas.height)

      context.globalCompositeOperation = 'source-over'
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  const createStarField = () => {
    const geometry = new THREE.BufferGeometry()
    const starCount = window.innerWidth < 768 ? 3200 : 8000
    const positions = new Float32Array(starCount * 3)
    const opacities = new Float32Array(starCount)
    const sizes = new Float32Array(starCount)
    const colors = new Float32Array(starCount * 3)

    for (let i = 0; i < starCount; i++) {
      const distLayer = Math.pow(Math.random(), 3.0)
      // Keep the point field well behind the camera at every orbit distance.
      // Near-camera points used to balloon into bright clumps when projected.
      const radius = 18000 + distLayer * 7000
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = radius * Math.cos(phi)
      opacities[i] = (Math.random() * 0.7 + 0.1) * (1.0 - distLayer * 0.7)
      sizes[i] = 0.72 + Math.random() * 0.38
      const tint = Math.random()
      const starColor = tint < 0.18
        ? [1.0, 0.72, 0.5]
        : tint < 0.36
          ? [0.72, 0.84, 1.0]
          : [0.92, 0.96, 1.0]
      colors.set(starColor, i * 3)
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffffff) },
        uPixelRatio: { value: pixelRatio },
        uWarp: { value: 0 }
      },
      vertexShader: `
        attribute float aOpacity;
        attribute float aSize;
        attribute vec3 aColor;
        varying float vOpacity;
        varying vec3 vColor;
        varying vec2 vScreenDir;
        uniform float uPixelRatio;
        uniform float uWarp;
        void main() {
          vOpacity = aOpacity;
          vColor = aColor;
          vec3 p = position;
          // Warp: accelerate stars towards the observer along Z
          p.z += uWarp * 18000.0 * (0.8 + aOpacity * 0.4);
          if (p.z > 9000.0) {
            p.z -= 30000.0;
          }
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          float size = aSize * uPixelRatio * (12000.0 / -mvPosition.z);
          size *= (1.0 + uWarp * 4.0);
          gl_PointSize = clamp(size, 1.0, 2.2);
          vec4 proj = projectionMatrix * mvPosition;
          vScreenDir = normalize(proj.xy / max(0.001, length(proj.xy)));
          gl_Position = proj;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        varying vec3 vColor;
        varying vec2 vScreenDir;
        uniform vec3 uColor;
        uniform float uWarp;
        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          vec3 starColor = uColor * vColor;
          if (uWarp > 0.001) {
            float radial = dot(coord, vScreenDir);
            float perp = coord.x * vScreenDir.y - coord.y * vScreenDir.x;
            radial /= (1.0 + uWarp * 10.0);
            float dist = length(vec2(radial, perp * 2.2));
            if (dist > 0.5) discard;
            float alpha = smoothstep(0.5, 0.05, dist) * vOpacity;
            vec3 warpColor = mix(starColor, vec3(1.2, 1.35, 1.6), uWarp * 0.75);
            gl_FragColor = vec4(warpColor, alpha);
          } else {
            float dist = distance(gl_PointCoord, vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = smoothstep(0.5, 0.1, dist) * vOpacity;
            gl_FragColor = vec4(starColor, alpha);
          }
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    starParticles = new THREE.Points(geometry, material)
    scene.add(starParticles)
  }

  const createMilkyWay = () => {
    const geometry = new THREE.SphereGeometry(50000, 48, 32)
    const material = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: CELESTIAL_RENDER_CONFIG.milkyWay.opacity.medium } },
      vertexShader: milkyWayVertexShader,
      fragmentShader: milkyWayFragmentShader,
      defines: { MILKYWAY_LOW_QUALITY: 1 },
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    })
    milkyWayMesh = new THREE.Mesh(geometry, material)
    milkyWayMesh.renderOrder = -10
    scene.add(milkyWayMesh)
  }

  const createSun = () => {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uStarColor: { value: new THREE.Color(kepler186System.starColor) },
        uTime: { value: 0 },
        uCoronaStrength: { value: CELESTIAL_RENDER_CONFIG.star.coronaStrength.medium },
        uGranulationStrength: { value: CELESTIAL_RENDER_CONFIG.star.granulationStrength },
        uFlareStrength: { value: CELESTIAL_RENDER_CONFIG.star.flareStrength }
      },
      vertexShader: solarVertexShader,
      fragmentShader: solarFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    })
    sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    sunMesh.position.copy(sunDir).multiplyScalar(8000)
    sunMesh.scale.set(600, 600, 1)
    sunMesh.frustumCulled = false
    scene.add(sunMesh)
  }

  const getEffectiveQualityTier = (): RenderQualityTier =>
    reducedMotion || isAtMinimumPixelRatio() ? 'low' : qualityTier

  const applyCelestialQuality = () => {
    const tier = getEffectiveQualityTier()
    const starMaterial = sunMesh?.material
    if (starMaterial) {
      if (starMaterial.uniforms.uCoronaStrength) {
        starMaterial.uniforms.uCoronaStrength.value = CELESTIAL_RENDER_CONFIG.star.coronaStrength[tier]
      }
      if (starMaterial.uniforms.uGranulationStrength) {
        starMaterial.uniforms.uGranulationStrength.value = tier === 'low'
          ? CELESTIAL_RENDER_CONFIG.star.granulationStrength * 0.5
          : CELESTIAL_RENDER_CONFIG.star.granulationStrength
      }
      if (starMaterial.uniforms.uFlareStrength) {
        starMaterial.uniforms.uFlareStrength.value = tier === 'low'
          ? CELESTIAL_RENDER_CONFIG.star.flareStrength * 0.4
          : CELESTIAL_RENDER_CONFIG.star.flareStrength
      }
    }

    const milkyMaterial = milkyWayMesh?.material
    if (milkyMaterial) {
      if (milkyMaterial.uniforms.uOpacity) {
        milkyMaterial.uniforms.uOpacity.value = CELESTIAL_RENDER_CONFIG.milkyWay.opacity[tier]
      }
      const nextDefines = tier === 'low' ? { MILKYWAY_LOW_QUALITY: 1 } : {}
      if (JSON.stringify(milkyMaterial.defines) !== JSON.stringify(nextDefines)) {
        milkyMaterial.defines = nextDefines
        milkyMaterial.needsUpdate = true
      }
    }

    planetController?.setRenderQuality(tier, reducedMotion)
  }

  const createSystemOverview = () => {
    if (systemMapGroup) {
      scene.remove(systemMapGroup)
      systemMapGroup.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose()
      })
      for (const material of systemMapMaterials) material.dispose()
      systemMapMaterials = []
    }

    const currentSys = kepler186System
    systemMapGroup = new THREE.Group()

    for (const world of currentSys.planets) {
      const orbitRadius = (world.diagramRadius / 0.84) * 8000
      const points: THREE.Vector3[] = []
      for (let i = 0; i < 192; i++) {
        const angle = (i / 192) * Math.PI * 2
        points.push(
          sunMesh.position.clone()
            .addScaledVector(systemOrbitAxisX, Math.cos(angle) * orbitRadius)
            .addScaledVector(systemOrbitAxisY, Math.sin(angle) * orbitRadius)
        )
      }

      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(points)
      const orbitMaterial = new THREE.LineBasicMaterial({
        color: 0x9aafc0,
        transparent: true,
        opacity: 0,
        depthWrite: false
      })
      const orbit = new THREE.LineLoop(orbitGeometry, orbitMaterial)
      orbit.renderOrder = 2
      systemMapGroup.add(orbit)
      systemMapMaterials.push(orbitMaterial)

      if (!world.surveyed) {
        const referencePlanet = currentSys.planets.find((p) => p.surveyed) ?? currentSys.planets[0]
        const phase = world.diagramAngle - (referencePlanet?.diagramAngle ?? 0)
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(58, 16, 12),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(world.markerColor ?? '#8faec7'),
            transparent: true,
            opacity: 0,
            depthWrite: false
          })
        )
        marker.position.copy(sunMesh.position)
          .addScaledVector(systemOrbitAxisX, Math.cos(phase) * orbitRadius)
          .addScaledVector(systemOrbitAxisY, Math.sin(phase) * orbitRadius)
        marker.renderOrder = 3
        systemMapGroup.add(marker)
        systemMapMaterials.push(marker.material)
      }
    }

    scene.add(systemMapGroup)
  }

  const setSystemMapOpacity = (opacity: number) => {
    for (const material of systemMapMaterials) {
      const fadeMaterial = material as THREE.Material & { opacity: number }
      fadeMaterial.opacity = opacity * (material instanceof THREE.LineBasicMaterial ? 0.32 : 1)
    }
  }

  const rebuildEffectPasses = () => {
    if (!composer || !camera) return

    for (const pass of effectPasses) {
      composer.removePass(pass)
      pass.dispose()
    }
    effectPasses = []

    const addPass = (...effects: Array<BloomEffect | ChromaticAberrationEffect | NoiseEffect | SMAAEffect | ToneMappingEffect | VignetteEffect>) => {
      if (!composer || effects.length === 0) return
      const pass = new EffectPass(camera, ...effects)
      composer.addPass(pass)
      effectPasses.push(pass)
    }
    const createVignette = () => new VignetteEffect({
      offset: POST_PROCESSING_CONFIG.vignette.offset,
      darkness: POST_PROCESSING_CONFIG.vignette.darkness
    })
    const createToneMapping = () => new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })

    const fullQuality = qualityTier === 'high' && !reducedMotion
    const mediumQuality = qualityTier === 'medium' && !reducedMotion && !isAtMinimumPixelRatio()

    if (fullQuality && !isAtMinimumPixelRatio()) {
      const bloom = new BloomEffect({
        mipmapBlur: true,
        intensity: POST_PROCESSING_CONFIG.bloom.intensity,
        luminanceThreshold: POST_PROCESSING_CONFIG.bloom.luminanceThreshold,
        luminanceSmoothing: POST_PROCESSING_CONFIG.bloom.luminanceSmoothing,
        radius: POST_PROCESSING_CONFIG.bloom.radius,
        levels: POST_PROCESSING_CONFIG.bloom.levels
      })
      const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true })
      grain.blendMode.setOpacity(POST_PROCESSING_CONFIG.grain.amount)
      const vignette = createVignette()
      const aberration = new ChromaticAberrationEffect({
        offset: new THREE.Vector2(POST_PROCESSING_CONFIG.aberration.offset, POST_PROCESSING_CONFIG.aberration.offset),
        radialModulation: true,
        modulationOffset: POST_PROCESSING_CONFIG.aberration.modulationOffset
      })

      // pmndrs restricts UV-sampling effects to one per EffectPass.
      addPass(bloom, vignette, grain)
      addPass(aberration)
      addPass(new SMAAEffect(), createToneMapping())
      return
    }

    if (fullQuality) {
      addPass(createVignette())
      addPass(new SMAAEffect(), createToneMapping())
      return
    }

    if (mediumQuality) {
      const bloom = new BloomEffect({
        mipmapBlur: true,
        intensity: POST_PROCESSING_CONFIG.bloom.intensity,
        luminanceThreshold: POST_PROCESSING_CONFIG.bloom.luminanceThreshold,
        luminanceSmoothing: POST_PROCESSING_CONFIG.bloom.luminanceSmoothing,
        radius: POST_PROCESSING_CONFIG.bloom.radius,
        levels: POST_PROCESSING_CONFIG.bloom.levels
      })
      const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true })
      grain.blendMode.setOpacity(POST_PROCESSING_CONFIG.grain.amount)
      addPass(bloom, createVignette(), grain, createToneMapping())
      return
    }

    addPass(createVignette(), createToneMapping())
  }

  const setPixelRatio = (nextRatio: number) => {
    if (!renderer || !camera || Math.abs(nextRatio - pixelRatio) < 0.01) return
    const wasAtMinimum = isAtMinimumPixelRatio()
    pixelRatio = nextRatio
    renderer.setPixelRatio(pixelRatio)
    const width = containerRef.value?.clientWidth || window.innerWidth
    const height = containerRef.value?.clientHeight || window.innerHeight
    if (composer) composer.setSize(width, height)
    else renderer.setSize(width, height)
    const starMaterial = starParticles?.material as THREE.ShaderMaterial | undefined
    if (starMaterial?.uniforms?.uPixelRatio) {
      starMaterial.uniforms.uPixelRatio.value = pixelRatio
    }
    if (wasAtMinimum !== isAtMinimumPixelRatio()) {
      rebuildEffectPasses()
      applyCelestialQuality()
    }
  }

  const setStarColor = (colorHex: string) => {
    if (!sunMesh || !glareSprite) return
    const col = new THREE.Color(colorHex)
    sunMesh.material.uniforms.uStarColor?.value.copy(col)
    glareSprite.material.color.copy(col)
  }

  const onWindowResize = () => {
    if (!camera || !renderer) return
    const width = containerRef.value?.clientWidth || window.innerWidth
    const height = containerRef.value?.clientHeight || window.innerHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    if (composer) composer.setSize(width, height)
    else renderer.setSize(width, height)
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      previousFrameTime = 0
      return
    }
    previousFrameTime = 0
  }

  const init = () => {
    if (!containerRef.value || initialized) return
    initialized = true
    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, 0.00015)

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 25000)
    camera.position.z = 6000

    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })
    } catch (error) {
      console.warn('ORBITAL WebGL is unavailable; showing the static scene poster.', error)
      initialized = false
      onUnavailable?.()
      return
    }
    pixelRatio = maxPixelRatio()
    const width = containerRef.value.clientWidth || window.innerWidth
    const height = containerRef.value.clientHeight || window.innerHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(pixelRatio)
    // Keep tone mapping in the post stack and let pmndrs perform the final
    // output color-space conversion once.
    renderer.toneMapping = THREE.NoToneMapping
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setSize(width, height)
    containerRef.value.appendChild(renderer.domElement)

    try {
      const supportsHalfFloat = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float')
      composer = new EffectComposer(renderer, {
        frameBufferType: supportsHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType,
        multisampling: 0
      })
      renderPass = new RenderPass(scene, camera)
      composer.addPass(renderPass)
      composer.setSize(width, height)
      rebuildEffectPasses()
    } catch (error) {
      console.warn('ORBITAL post-processing is unavailable; using the direct WebGL render path.', error)
      composer?.dispose()
      composer = null
      renderPass = null
      effectPasses = []
    }

    // Render immediately at medium quality; GPU detection can finish in the
    // background without delaying the scene or introducing a loading screen.
    void getGPUTier({ glContext: renderer.getContext() }).then((result) => {
      if (!initialized) return
      if (result.type === 'FALLBACK' || result.type === 'SSR') {
        qualityTier = 'medium'
      } else if (result.tier >= 3) {
        qualityTier = 'high'
      } else if (result.tier === 2) {
        qualityTier = 'medium'
      } else {
        qualityTier = 'low'
      }
      rebuildEffectPasses()
      applyCelestialQuality()
    }).catch((error: unknown) => {
      console.warn('ORBITAL GPU quality detection failed; using medium quality.', error)
      if (initialized) {
        qualityTier = 'medium'
        rebuildEffectPasses()
        applyCelestialQuality()
      }
    })

    createStarField()
    createMilkyWay()
    createSun()
    createSystemOverview()

    glareTexture = createLensFlareTexture()
    const glareMaterial = new THREE.SpriteMaterial({
      map: glareTexture,
      color: 0xffe4c2,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    })
    glareSprite = new THREE.Sprite(glareMaterial)
    glareSprite.visible = false
    glareSprite.renderOrder = 1000
    scene.add(glareSprite)

    const initialVisual = kepler186System.planets[0]?.visual
    planetController = usePlanet(scene, initialVisual, kepler186System.starColor)
    applyCelestialQuality()

    const precompileCurrentPlanet = (keepHiddenOnFailure = false) => {
      if (!initialized || !renderer || !camera || !planetController) return
      const revision = ++visualCompileRevision

      void planetController.precompileTerrain(renderer, camera).then(() => {
        if (!initialized || !planetController || revision !== visualCompileRevision) return
        planetController.setDetailsVisible(true)
        return planetController.precompileEffects(renderer, camera)
      }).then(() => {
        if (!initialized || !planetController || revision !== visualCompileRevision) return
        planetController.setEffectsVisible(true)
      }).catch((error: unknown) => {
        console.warn('ORBITAL detailed planet shader precompile failed.', error)
        if (!initialized || !planetController || revision !== visualCompileRevision) return
        planetController.setDetailsVisible(!keepHiddenOnFailure)
        planetController.setEffectsVisible(false)
      })
    }

    setStarColor(kepler186System.starColor)
    window.addEventListener('resize', onWindowResize, { passive: true })
    window.visualViewport?.addEventListener('resize', onWindowResize, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)

    const startRenderer = () => {
      if (!initialized) return
      glareSprite.visible = false
      if (!document.hidden && !running) {
        running = true
        renderTicker = (time: number) => animate(time * 1000)
        gsap.ticker.add(renderTicker)
      }
      precompileCurrentPlanet(true)
    }

    // Draw the star field immediately. Waiting for shader compilation here
    // leaves the entire experience black on browsers with slow GPU compilers.
    // The detailed planet is revealed only after its shaders are ready.
    startRenderer()
  }

  const animate = (timestamp: number) => {
    if (!running || document.hidden) return

    const deltaSeconds = previousFrameTime > 0
      ? Math.min((timestamp - previousFrameTime) / 1000, 0.05)
      : 0
    if (previousFrameTime > 0) {
      lastFrameDelta = timestamp - previousFrameTime
      const frameMs = lastFrameDelta
      if (frameMs > 25) {
        slowFrames++
        fastFrames = 0
        if (slowFrames >= 5 && pixelRatio > minPixelRatio()) {
          setPixelRatio(Math.max(minPixelRatio(), pixelRatio - 0.125))
          slowFrames = 0
        }
      } else if (frameMs < 19) {
        fastFrames++
        slowFrames = 0
        if (fastFrames >= 180 && pixelRatio < maxPixelRatio()) {
          setPixelRatio(Math.min(maxPixelRatio(), pixelRatio + 0.125))
          fastFrames = 0
        }
      } else {
        slowFrames = 0
        fastFrames = 0
      }
    }
    previousFrameTime = timestamp

    const time = timestamp * 0.001
    const rawProgress = scrollProgress.value

    if (deltaSeconds > 0 && !reducedMotion) {
      const omega = 14
      const error = smoothedProgress - rawProgress
      const c = progressVelocity + omega * error
      const decay = Math.exp(-omega * deltaSeconds)
      const nextError = (error + c * deltaSeconds) * decay
      progressVelocity = (progressVelocity - omega * c * deltaSeconds) * decay
      smoothedProgress = rawProgress + nextError
    } else if (reducedMotion) {
      smoothedProgress = rawProgress
      progressVelocity = 0
    }

    // Reduced-motion: snap to stable poses
    const p = reducedMotion
      ? rawProgress < 0.2 ? 0 : rawProgress < 0.53 ? 0.48 : rawProgress < SYSTEM_REVEAL_AT ? 0.62 : 1
      : smoothedProgress
    const journeyProgress = THREE.MathUtils.clamp(p / SYSTEM_REVEAL_AT, 0, 1)
    const systemProgress = THREE.MathUtils.clamp((p - SYSTEM_REVEAL_AT) / (TIMELINE.warpOutStart - SYSTEM_REVEAL_AT), 0, 1)
    const systemEase = THREE.MathUtils.smoothstep(systemProgress, 0, 1)
    const easeProgress = journeyProgress < 0.5
      ? 2 * journeyProgress * journeyProgress
      : 1 - Math.pow(-2 * journeyProgress + 2, 2) / 2
    const currentZ = 6000 * Math.pow(404 / 6000, easeProgress)

    basePos.set(
      THREE.MathUtils.lerp(0, 40, easeProgress),
      THREE.MathUtils.lerp(0, -15, easeProgress),
      currentZ
    )

    const orbitFactor = journeyProgress > 0.5 ? THREE.MathUtils.smoothstep(journeyProgress, 0.5, 0.88) : 0
    const eclipseAngleProgress = journeyProgress <= 0.88 ? orbitFactor : 1.0 + ((journeyProgress - 0.88) / 0.12) * 0.2
    finalPos.copy(basePos).applyAxisAngle(rotationAxis, eclipseAngleProgress * totalOrbitAngle)
    camToPlanet.set(0, 0, 0).sub(finalPos).normalize()
    const angleToSun = sunDir.angleTo(camToPlanet)
    const safeLength = Math.max(finalPos.length(), 400.1)
    const planetAngularRadius = Math.asin(400 / safeLength)
    const eclipseFactor = 1.0 - THREE.MathUtils.clamp(
      (angleToSun - planetAngularRadius * 0.6) / (planetAngularRadius * 0.6),
      0,
      1
    )

    camera.position.copy(finalPos)
    const surfaceApproachProgress = THREE.MathUtils.clamp((journeyProgress - 0.75) / 0.25, 0, 1)
    up.copy(finalPos).normalize()
    forward.crossVectors(up, rotationAxis).normalize()
    lookHorizon.copy(finalPos).addScaledVector(forward, 1000).addScaledVector(up, -80)
    finalLookAt.set(0, 0, 0).lerp(lookHorizon, Math.pow(surfaceApproachProgress, 4.0) * 0.95)
    camera.lookAt(finalLookAt)
    if (p <= SYSTEM_REVEAL_AT) {
      camera.rotation.z += THREE.MathUtils.lerp(0, 0.05, easeProgress)
    } else {
      camera.position.lerp(systemCameraEnd, systemEase)
      finalLookAt.lerp(systemCenter, systemEase)
      camera.lookAt(finalLookAt)
    }
    planetController?.setAtmosphereCameraRadius(camera.position.length())
    sunMesh.quaternion.copy(camera.quaternion)
    if (sunMesh.material.uniforms.uTime) {
      sunMesh.material.uniforms.uTime.value = reducedMotion ? 0 : time
    }

    // Warp Out segment
    const isWarping = !reducedMotion && p >= TIMELINE.warpOutStart
    const warpFactor = isWarping ? (p - TIMELINE.warpOutStart) / (1 - TIMELINE.warpOutStart) : 0

    const baseFov = p <= SYSTEM_REVEAL_AT
      ? THREE.MathUtils.lerp(45, 80, easeProgress)
      : THREE.MathUtils.lerp(80, 52, systemEase)
    const nextFov = isWarping ? baseFov + warpFactor * 26 : baseFov

    if (Math.abs(camera.fov - nextFov) > 0.1) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }

    camera.getWorldDirection(cameraForward)
    const sunAlignment = Math.max(0, cameraForward.dot(sunDir))
    const alignmentEnvelope = THREE.MathUtils.smoothstep(sunAlignment, 0.68, 0.86)
    const lensAlignment = THREE.MathUtils.smoothstep(sunAlignment, 0.5, 0.8)
    const rayProjection = finalPos.dot(sunDir)
    const rayDiscriminant = rayProjection * rayProjection - (finalPos.lengthSq() - 400 * 400)
    const sunVisibility = rayProjection < 0
      ? 1.0 - THREE.MathUtils.smoothstep(rayDiscriminant, -4000, 5000)
      : 1.0
    const flareFade = 1 - THREE.MathUtils.smoothstep(p, SYSTEM_REVEAL_AT - 0.08, SYSTEM_REVEAL_AT + 0.04)
    const activeGlare = Math.pow(lensAlignment, 0.85) * sunVisibility * flareFade

    if (activeGlare > 0.005) {
      camera.updateMatrixWorld()
      sunScreen.copy(sunMesh.position).project(camera)
      right.setFromMatrixColumn(camera.matrixWorld, 0)
      up.setFromMatrixColumn(camera.matrixWorld, 1)
      const distance = 8
      const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance
      const halfWidth = halfHeight * camera.aspect
      glarePosition.copy(camera.position)
        .addScaledVector(cameraForward, distance)
        .addScaledVector(right, sunScreen.x * halfWidth)
        .addScaledVector(up, sunScreen.y * halfHeight)
      glareSprite.position.copy(glarePosition)
      glareSprite.quaternion.copy(camera.quaternion)
      glareSprite.scale.set(halfWidth * 1.8, halfHeight * 1.8, 1)
      glareSprite.material.opacity = activeGlare * 0.82
      glareSprite.visible = true
    } else {
      glareSprite.visible = false
    }

    if (starParticles) {
      if (!reducedMotion) {
        starParticles.rotation.y += 0.0001
        starParticles.rotation.x += 0.00005
      }
      const starMaterial = starParticles.material as THREE.ShaderMaterial
      const baseBrightness = THREE.MathUtils.lerp(1.0, 0.3, Math.pow(p, 4))
      const brightness = baseBrightness + eclipseFactor * 1.5
      starMaterial.uniforms.uColor?.value.setRGB(brightness, brightness, brightness)
      if (starMaterial.uniforms.uWarp) {
        starMaterial.uniforms.uWarp.value = warpFactor
      }
    }

    if (planetController) {
      planetController.planetGroup.rotation.y = THREE.MathUtils.lerp(0, Math.PI / 6, easeProgress)
      planetController.planetGroup.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 24, easeProgress)
      planetController.update(reducedMotion ? 0 : time, journeyProgress, alignmentEnvelope)
    }

    if (systemMapGroup) {
      systemMapGroup.visible = rawProgress > SYSTEM_REVEAL_AT
      setSystemMapOpacity(reducedMotion ? 1 : systemEase)
    }

    if (composer) composer.render(deltaSeconds)
    else renderer.render(scene, camera)

    if (import.meta.dev && timestamp - lastProfileTime >= 1000) {
      const info = renderer.info
      console.debug('[ORBITAL perf]', {
        scrollProgress: Number(p.toFixed(3)),
        frameDeltaMs: Number(lastFrameDelta.toFixed(1)),
        pixelRatio,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures
      })
      lastProfileTime = timestamp
    }
  }

  const cleanup = () => {
    if (!initialized) return
    initialized = false
    running = false
    if (renderTicker) gsap.ticker.remove(renderTicker)
    renderTicker = undefined
    previousFrameTime = 0
    smoothedProgress = 0
    progressVelocity = 0
    lastFrameDelta = 0
    lastProfileTime = 0
    visualCompileRevision++
    window.removeEventListener('resize', onWindowResize)
    window.visualViewport?.removeEventListener('resize', onWindowResize)
    document.removeEventListener('visibilitychange', onVisibilityChange)

    if (systemMapGroup) {
      scene.remove(systemMapGroup)
      systemMapGroup.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) object.geometry.dispose()
      })
      for (const material of systemMapMaterials) material.dispose()
      systemMapMaterials = []
    }

    planetController?.cleanup()
    planetController = null
    if (scene) {
      if (starParticles) scene.remove(starParticles)
      if (sunMesh) scene.remove(sunMesh)
      if (milkyWayMesh) scene.remove(milkyWayMesh)
      if (glareSprite) scene.remove(glareSprite)
    }
    if (starParticles) {
      starParticles.geometry.dispose()
      ;(starParticles.material as THREE.Material).dispose()
    }
    if (sunMesh) {
      sunMesh.geometry.dispose()
      sunMesh.material.dispose()
    }
    if (milkyWayMesh) {
      milkyWayMesh.geometry.dispose()
      milkyWayMesh.material.dispose()
    }
    if (glareSprite) (glareSprite.material as THREE.Material).dispose()
    glareTexture?.dispose()
    composer?.dispose()
    composer = null
    renderPass = null
    effectPasses = []
    if (renderer) {
      renderer.domElement.parentElement?.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }

  return {
    init,
    cleanup,
    get scene() { return scene },
    get camera() { return camera },
    get starParticles() { return starParticles },
    get planetGroup() { return planetController?.planetGroup },
    get surfaceRotation() { return planetController?.surfaceRotation ?? 0 }
  }
}
