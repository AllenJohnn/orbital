import * as THREE from 'three'
import type { Ref } from 'vue'
import { usePlanet } from './usePlanet'
import { kepler186System } from '~/data/kepler186System'

const SYSTEM_REVEAL_AT = 0.68

export const useOrbitalScene = (
  containerRef: Ref<HTMLElement | null>,
  scrollProgress: Ref<number>
) => {
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let starParticles: THREE.Points
  let sunSprite: THREE.Sprite
  let systemMapGroup: THREE.Group
  let systemMapMaterials: THREE.Material[] = []
  let glareSprite: THREE.Sprite
  let glareTexture: THREE.CanvasTexture
  let animationFrameId = 0
  let initialized = false
  let rendererReady = false
  let running = false
  let planetController: ReturnType<typeof usePlanet> | null = null
  let pixelRatio = 1
  const maxPixelRatio = () => Math.min(window.devicePixelRatio || 1, 1.5)
  const minPixelRatio = () => Math.min(window.devicePixelRatio || 1, 0.75)
  let slowFrames = 0
  let fastFrames = 0
  let previousFrameTime = 0
  let lastFrameDelta = 0
  let lastProfileTime = 0
  let detailedPlanetCompileStarted = false
  let detailedPlanetCompileTimer: number | undefined

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

  const createRadialTexture = (warm = false) => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (context) {
      const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128)
      if (warm) {
        gradient.addColorStop(0, 'rgba(255, 248, 224, 0.92)')
        gradient.addColorStop(0.10, 'rgba(255, 224, 184, 0.58)')
        gradient.addColorStop(0.30, 'rgba(255, 174, 112, 0.22)')
        gradient.addColorStop(0.62, 'rgba(255, 126, 66, 0.07)')
        gradient.addColorStop(1, 'rgba(255, 126, 66, 0)')
      } else {
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
        gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.95)')
        gradient.addColorStop(0.3, 'rgba(210, 230, 255, 0.4)')
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      }
      context.fillStyle = gradient
      context.fillRect(0, 0, 256, 256)
    }
    return new THREE.CanvasTexture(canvas)
  }

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

    for (let i = 0; i < starCount; i++) {
      const distLayer = Math.pow(Math.random(), 3.0)
      const radius = 1000 + distLayer * 15000
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      let y = radius * Math.sin(phi) * Math.sin(theta)
      if (Math.random() > 0.3) y *= 0.2

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20000
      opacities[i] = (Math.random() * 0.7 + 0.1) * (1.0 - distLayer * 0.7)
      sizes[i] = Math.pow(Math.random(), 4.0) * 2.5 + 0.3
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xffffff) },
        uPixelRatio: { value: pixelRatio }
      },
      vertexShader: `
        attribute float aOpacity;
        attribute float aSize;
        varying float vOpacity;
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

    starParticles = new THREE.Points(geometry, material)
    scene.add(starParticles)
  }

  const createSystemOverview = () => {
    systemMapGroup = new THREE.Group()

    for (const world of kepler186System.worlds) {
      const orbitRadius = (world.diagramRadius / 0.84) * 8000
      const points: THREE.Vector3[] = []
      for (let i = 0; i < 192; i++) {
        const angle = (i / 192) * Math.PI * 2
        points.push(
          sunSprite.position.clone()
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
        const phase = world.diagramAngle - kepler186System.worlds[4]!.diagramAngle
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(58, 16, 12),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(world.markerColor),
            transparent: true,
            opacity: 0,
            depthWrite: false
          })
        )
        marker.position.copy(sunSprite.position)
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

  const setPixelRatio = (nextRatio: number) => {
    if (!renderer || !camera || Math.abs(nextRatio - pixelRatio) < 0.01) return
    pixelRatio = nextRatio
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    const starMaterial = starParticles?.material as THREE.ShaderMaterial | undefined
    if (starMaterial?.uniforms?.uPixelRatio) {
      starMaterial.uniforms.uPixelRatio.value = pixelRatio
    }
  }

  const onWindowResize = () => {
    if (!camera || !renderer) return
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      running = false
      cancelAnimationFrame(animationFrameId)
      animationFrameId = 0
      previousFrameTime = 0
      return
    }
    if (initialized && rendererReady && !running) {
      running = true
      animationFrameId = requestAnimationFrame(animate)
    }
  }

  const init = () => {
    if (!containerRef.value || initialized) return
    initialized = true
    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, 0.00015)

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 25000)
    camera.position.z = 6000

    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' })
    pixelRatio = maxPixelRatio()
    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    containerRef.value.appendChild(renderer.domElement)

    createStarField()

    const sunMaterial = new THREE.SpriteMaterial({
      map: createRadialTexture(),
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    sunSprite = new THREE.Sprite(sunMaterial)
    sunSprite.position.copy(sunDir).multiplyScalar(8000)
    sunSprite.scale.set(600, 600, 1)
    scene.add(sunSprite)
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

    planetController = usePlanet(scene)
    window.addEventListener('resize', onWindowResize, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)

    const precompileDetailedPlanet = () => {
      if (!initialized || detailedPlanetCompileStarted || !renderer || !camera || !planetController) return
      detailedPlanetCompileStarted = true

      void planetController.precompileDetails(renderer, camera).then(() => {
        if (!initialized || !planetController) return
        planetController.setDetailsVisible(true)
      }).catch((error: unknown) => {
        console.warn('ORBITAL detailed planet shader precompile failed; showing the detailed scene anyway.', error)
        if (!initialized || !planetController) return
        planetController.setDetailsVisible(true)
      })
    }

    const startRenderer = () => {
      if (!initialized) return
      glareSprite.visible = false
      rendererReady = true
      if (!document.hidden && !running) {
        running = true
        animationFrameId = requestAnimationFrame(animate)
      }
      detailedPlanetCompileTimer = window.setTimeout(precompileDetailedPlanet, 120)
    }

    // Render the space scene first, then reveal the planet only after its full
    // terrain, cloud, and atmosphere shaders have compiled.
    glareSprite.visible = true
    void renderer.compileAsync(scene, camera).then(() => {
      startRenderer()
    }).catch((error: unknown) => {
      console.warn('ORBITAL preview shader precompile failed; continuing with normal rendering.', error)
      startRenderer()
    })
  }

  const animate = (timestamp: number) => {
    if (!running) return
    animationFrameId = requestAnimationFrame(animate)

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
    const p = scrollProgress.value
    const journeyProgress = THREE.MathUtils.clamp(p / SYSTEM_REVEAL_AT, 0, 1)
    const systemProgress = THREE.MathUtils.clamp((p - SYSTEM_REVEAL_AT) / (1 - SYSTEM_REVEAL_AT), 0, 1)
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

    const nextFov = p <= SYSTEM_REVEAL_AT
      ? THREE.MathUtils.lerp(45, 80, easeProgress)
      : THREE.MathUtils.lerp(80, 52, systemEase)
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
      sunScreen.copy(sunSprite.position).project(camera)
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
      starParticles.rotation.y += 0.0001
      starParticles.rotation.x += 0.00005
      const material = starParticles.material as THREE.ShaderMaterial
      const baseBrightness = THREE.MathUtils.lerp(1.0, 0.3, Math.pow(p, 4))
      const brightness = baseBrightness + eclipseFactor * 1.5
      material.uniforms.uColor.value.setRGB(brightness, brightness, brightness)
    }

    if (planetController) {
      planetController.planetGroup.rotation.y = THREE.MathUtils.lerp(0, Math.PI / 6, easeProgress)
      planetController.planetGroup.rotation.x = THREE.MathUtils.lerp(0, -Math.PI / 24, easeProgress)
      planetController.update(time, journeyProgress, alignmentEnvelope)
    }

    if (systemMapGroup) {
      systemMapGroup.visible = p > SYSTEM_REVEAL_AT
      setSystemMapOpacity(systemEase)
    }

    renderer.render(scene, camera)

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
    rendererReady = false
    running = false
    if (animationFrameId) cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
    previousFrameTime = 0
    lastFrameDelta = 0
    lastProfileTime = 0
    detailedPlanetCompileStarted = false
    if (detailedPlanetCompileTimer !== undefined) window.clearTimeout(detailedPlanetCompileTimer)
    detailedPlanetCompileTimer = undefined
    window.removeEventListener('resize', onWindowResize)
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
      if (sunSprite) scene.remove(sunSprite)
      if (glareSprite) scene.remove(glareSprite)
    }
    if (starParticles) {
      starParticles.geometry.dispose()
      ;(starParticles.material as THREE.Material).dispose()
    }
    if (sunSprite) {
      const material = sunSprite.material as THREE.SpriteMaterial
      material.map?.dispose()
      material.dispose()
    }
    if (glareSprite) (glareSprite.material as THREE.Material).dispose()
    glareTexture?.dispose()
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
