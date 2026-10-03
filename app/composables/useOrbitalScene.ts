import * as THREE from 'three'
import type { Ref } from 'vue'
import { usePlanet } from './usePlanet'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export const useOrbitalScene = (containerRef: Ref<HTMLElement | null>, scrollProgress: Ref<number>) => {
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let composer: EffectComposer
  let bloomPass: UnrealBloomPass
  let starParticles: THREE.Points
  let sunSprite: THREE.Sprite
  let animationFrameId: number
  let planetController: ReturnType<typeof usePlanet> | null = null

  const createStarTexture = () => {
    // Generate a beautiful, realistic glowing star sprite
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.95)')
      gradient.addColorStop(0.3, 'rgba(210, 230, 255, 0.4)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 256, 256)
    }
    return new THREE.CanvasTexture(canvas)
  }

  const init = () => {
    if (!containerRef.value) return

    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, 0.00015) 

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 25000) 
    camera.position.z = 6000

    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }) 
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    containerRef.value.appendChild(renderer.domElement)

    const renderScene = new RenderPass(scene, camera)
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85)
    bloomPass.threshold = 0.95 // Restrict bloom strictly to the sun-facing highlights and bright city lights
    bloomPass.strength = 0.15  // Much more subtle, photographic bloom instead of heavy neon
    bloomPass.radius = 0.8     // Softer diffusion

    composer = new EffectComposer(renderer)
    composer.addPass(renderScene)
    composer.addPass(bloomPass)

    createStarField()
    
    // Add the sun sprite
    const sunMaterial = new THREE.SpriteMaterial({
      map: createStarTexture(),
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    sunSprite = new THREE.Sprite(sunMaterial)
    // The sun is placed far away along the exact sun direction vector
    const sunDir = new THREE.Vector3(1.0, 0.5, 0.2).normalize()
    sunSprite.position.copy(sunDir.clone().multiplyScalar(8000))
    sunSprite.scale.set(600, 600, 1)
    scene.add(sunSprite)
    
    planetController = usePlanet(scene)

    window.addEventListener('resize', onWindowResize)
    animate()
  }

  // ... (keep createStarField as is, replace just the top part)

  const createStarField = () => {
    const starGeometry = new THREE.BufferGeometry()
    const starCount = 8000 // slightly increased for depth
    const isMobile = window.innerWidth < 768
    const actualStarCount = isMobile ? Math.floor(starCount * 0.4) : starCount

    const positions = new Float32Array(actualStarCount * 3)
    const opacities = new Float32Array(actualStarCount)
    const sizes = new Float32Array(actualStarCount)

    for (let i = 0; i < actualStarCount; i++) {
      // Use exponential distance distribution for depth (most stars far away, few closer)
      // Distance from center (0,0,0)
      const distLayer = Math.pow(Math.random(), 3.0); 
      const r = 1000 + distLayer * 15000;
      
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);

      // Add some clustering/banding to simulate galactic plane (Milky way effect)
      // Compress the Y axis for about 70% of the stars
      let yOffset = r * Math.sin(phi) * Math.sin(theta);
      if (Math.random() > 0.3) {
         yOffset *= 0.2; // Flatten into a disc-like band
      }

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = yOffset;
      const z = (Math.random() - 0.5) * 20000; 

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Far stars are dimmer, close stars can be brighter
      const depthIntensity = 1.0 - (distLayer * 0.7); 
      opacities[i] = (Math.random() * 0.7 + 0.1) * depthIntensity;
      
      // Sizes vary significantly. A few large stars, many tiny ones.
      sizes[i] = Math.pow(Math.random(), 4.0) * 2.5 + 0.3;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    starGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))
    starGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0xffffff) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      },
      vertexShader: `
        attribute float aOpacity;
        attribute float aSize;
        varying float vOpacity;
        uniform float uTime;
        uniform float uPixelRatio;

        void main() {
          vOpacity = aOpacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (1000.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        uniform vec3 uColor;

        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.1, dist) * vOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })

    starParticles = new THREE.Points(starGeometry, starMaterial)
    scene.add(starParticles)
  }

  const onWindowResize = () => {
    if (!camera || !renderer) return
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    if (composer) composer.setSize(window.innerWidth, window.innerHeight)
  }

  // --- SHARED VECTORS FOR ANIMATE LOOP (Avoid GC pressure) ---
  const _basePos = new THREE.Vector3()
  const _sunDir = new THREE.Vector3(1.0, 0.5, 0.2).normalize()
  const _shadowDir = _sunDir.clone().negate()
  const _startDir = new THREE.Vector3(0, 0, 1)
  const _rotationAxis = new THREE.Vector3().crossVectors(_startDir, _shadowDir).normalize()
  const _totalOrbitAngle = _startDir.angleTo(_shadowDir)
  const _finalPos = new THREE.Vector3()
  const _camToSun = _sunDir.clone()
  const _camToPlanet = new THREE.Vector3()
  const _lookCenter = new THREE.Vector3(0, 0, 0)
  const _up = new THREE.Vector3()
  const _forward = new THREE.Vector3()
  const _lookHorizon = new THREE.Vector3()
  const _finalLookAt = new THREE.Vector3()
  const _cameraForward = new THREE.Vector3()

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    const time = performance.now() * 0.001
    const p = scrollProgress.value

    const startZ = 6000
    const endZ = 404
    
    const easeProgress = p < 0.5 
      ? 2 * p * p 
      : 1 - Math.pow(-2 * p + 2, 2) / 2

    const currentZ = startZ * Math.pow(endZ / startZ, easeProgress)
    
    _basePos.set(
      THREE.MathUtils.lerp(0, 40, easeProgress),
      THREE.MathUtils.lerp(0, -15, easeProgress),
      currentZ
    )
    
    let orbitFactor = 0
    if (p > 0.5) {
      orbitFactor = THREE.MathUtils.smoothstep(p, 0.5, 0.88)
    }
    let eclipseAngleProgress = 0
    if (p <= 0.88) {
      eclipseAngleProgress = orbitFactor
    } else {
      const postP = (p - 0.88) / 0.12
      eclipseAngleProgress = 1.0 + postP * 0.2 
    }

    const currentOrbitAngle = eclipseAngleProgress * _totalOrbitAngle
    
    _finalPos.copy(_basePos).applyAxisAngle(_rotationAxis, currentOrbitAngle)
    
    _camToPlanet.set(0,0,0).sub(_finalPos).normalize()
    const angleToSun = _camToSun.angleTo(_camToPlanet)
    
    const safeLen = Math.max(_finalPos.length(), 400.1)
    const planetAngularRadius = Math.asin(400 / safeLen)
    
    const eclipseFactor = 1.0 - THREE.MathUtils.clamp(
      (angleToSun - planetAngularRadius * 0.6) / (planetAngularRadius * 0.6), 
      0, 1
    )

    if (camera) {
      camera.position.copy(_finalPos)
      
      const surfaceApproachProgress = THREE.MathUtils.clamp((p - 0.75) / 0.25, 0, 1)
      
      _up.copy(_finalPos).normalize()
      _forward.crossVectors(_up, _rotationAxis).normalize()
      _lookHorizon.copy(_finalPos).add(_forward.multiplyScalar(1000)).sub(_up.multiplyScalar(80))
      
      const lookEase = Math.pow(surfaceApproachProgress, 4.0)
      _finalLookAt.copy(_lookCenter).lerp(_lookHorizon, lookEase * 0.95)
      
      camera.lookAt(_finalLookAt)
      
      // Cinematic banking
      camera.rotation.z += THREE.MathUtils.lerp(0, 0.05, easeProgress)
      
      // Dynamic FOV
      const newFov = THREE.MathUtils.lerp(45, 80, easeProgress)
      if (Math.abs(camera.fov - newFov) > 0.1) {
        camera.fov = newFov
        camera.updateProjectionMatrix()
      }
      
      // --- CINEMATIC SOLAR GLARE ---
      camera.getWorldDirection(_cameraForward)
      const starAlignment = Math.max(0.0, _cameraForward.dot(_sunDir))
      
      // Exponential alignment curve so it only washes out when staring near the sun
      const glareIntensity = Math.pow(starAlignment, 12.0)
      const extremeGlare = Math.pow(starAlignment, 32.0)
      
      // Occlusion masks the glare if the star is behind the planet
      const occlusionMask = 1.0 - eclipseFactor
      const activeGlare = (glareIntensity * 0.8 + extremeGlare * 2.0) * occlusionMask
      
      // Wash out exposure subtly
      renderer.toneMappingExposure = 1.0 + (activeGlare * 0.7)
      
      // Overpower the bloom to mimic a flooded camera sensor
      if (bloomPass) {
        // Base bloom is stronger in dark, replaced by glare when facing sun
        const baseStrength = THREE.MathUtils.lerp(0.15, 0.02, eclipseFactor)
        bloomPass.strength = baseStrength + (glareIntensity * 0.5 * occlusionMask)
        bloomPass.radius = 0.8 + (glareIntensity * 0.6 * occlusionMask)
      }
    }

    if (starParticles) {
      starParticles.rotation.y += 0.0001
      starParticles.rotation.x += 0.00005
      
      const material = starParticles.material as THREE.ShaderMaterial
      if (material.uniforms) {
        material.uniforms.uTime.value = time
        const baseBrightness = THREE.MathUtils.lerp(1.0, 0.3, Math.pow(p, 4))
        const eclipseBrightnessBoost = eclipseFactor * 1.5
        const finalBrightness = baseBrightness + eclipseBrightnessBoost
        material.uniforms.uColor.value.setRGB(finalBrightness, finalBrightness, finalBrightness)
      }
    }
    
    if (planetController) {
      if (planetController.planetGroup) {
        planetController.planetGroup.rotation.y = THREE.MathUtils.lerp(0, Math.PI / 6, easeProgress)
        planetController.planetGroup.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 24, easeProgress)
      }
      planetController.update(time, p)
    }

    if (composer) {
      composer.render()
    } else if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  const cleanup = () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', onWindowResize)
    
    if (planetController) {
      planetController.cleanup()
    }
    
    if (composer) {
      composer.renderTarget1.dispose()
      composer.renderTarget2.dispose()
      if (bloomPass) {
        bloomPass.dispose()
      }
    }
    
    if (renderer && renderer.domElement && containerRef.value) {
      containerRef.value.removeChild(renderer.domElement)
      renderer.dispose()
    }
    
    if (starParticles) {
      starParticles.geometry.dispose()
      ;(starParticles.material as THREE.Material).dispose()
    }
    
    if (sunSprite) {
      const mat = sunSprite.material as THREE.SpriteMaterial
      if (mat.map) mat.map.dispose()
      mat.dispose()
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
