import * as THREE from 'three'
import type { Ref } from 'vue'
import { usePlanet } from './usePlanet'

export const useOrbitalScene = (containerRef: Ref<HTMLElement | null>, scrollProgress: Ref<number>) => {
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let starParticles: THREE.Points
  let sunSprite: THREE.Sprite
  let glareSprite: THREE.Sprite
  let glareTexture: THREE.CanvasTexture
  let animationFrameId = 0
  let initialized = false
  let rendererReady = false
  let running = false
  let planetController: ReturnType<typeof usePlanet> | null = null
  let pixelRatio = 1
  let slowFrames = 0
  let fastFrames = 0
  let previousFrameTime = 0
  let lastFrameDelta = 0
  let lastProfileTime = 0

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
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
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

    glareTexture = createRadialTexture(true)
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

    // Precompile asynchronously so shader linking does not block the page's
    // main thread on first load or after HMR. Keep the overlay in the compile
    // set so the first Sun-facing frame cannot trigger a late compile.
    glareSprite.visible = true
    void renderer.compileAsync(scene, camera).then(() => {
      if (!initialized) return
      glareSprite.visible = false
      rendererReady = true
      if (!document.hidden && !running) {
        running = true
        animationFrameId = requestAnimationFrame(animate)
      }
    }).catch((error: unknown) => {
      console.warn('ORBITAL shader precompile failed; continuing with normal rendering.', error)
      if (!initialized) return
      glareSprite.visible = false
      rendererReady = true
      if (!document.hidden && !running) {
        running = true
        animationFrameId = requestAnimationFrame(animate)
      }
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
        if (slowFrames >= 5 && pixelRatio > 1.0) {
          setPixelRatio(Math.max(1.0, pixelRatio - 0.125))
          slowFrames = 0
        }
      } else if (frameMs < 19) {
        fastFrames++
        slowFrames = 0
        if (fastFrames >= 180 && pixelRatio < Math.min(window.devicePixelRatio || 1, 1.5)) {
          setPixelRatio(Math.min(Math.min(window.devicePixelRatio || 1, 1.5), pixelRatio + 0.125))
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
    const easeProgress = p < 0.5
      ? 2 * p * p
      : 1 - Math.pow(-2 * p + 2, 2) / 2
    const currentZ = 6000 * Math.pow(404 / 6000, easeProgress)

    basePos.set(
      THREE.MathUtils.lerp(0, 40, easeProgress),
      THREE.MathUtils.lerp(0, -15, easeProgress),
      currentZ
    )

    const orbitFactor = p > 0.5 ? THREE.MathUtils.smoothstep(p, 0.5, 0.88) : 0
    const eclipseAngleProgress = p <= 0.88 ? orbitFactor : 1.0 + ((p - 0.88) / 0.12) * 0.2
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
    const surfaceApproachProgress = THREE.MathUtils.clamp((p - 0.75) / 0.25, 0, 1)
    up.copy(finalPos).normalize()
    forward.crossVectors(up, rotationAxis).normalize()
    lookHorizon.copy(finalPos).addScaledVector(forward, 1000).addScaledVector(up, -80)
    finalLookAt.set(0, 0, 0).lerp(lookHorizon, Math.pow(surfaceApproachProgress, 4.0) * 0.95)
    camera.lookAt(finalLookAt)
    camera.rotation.z += THREE.MathUtils.lerp(0, 0.05, easeProgress)

    const nextFov = THREE.MathUtils.lerp(45, 80, easeProgress)
    if (Math.abs(camera.fov - nextFov) > 0.1) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }

    camera.getWorldDirection(cameraForward)
    const sunAlignment = Math.max(0, cameraForward.dot(sunDir))
    const alignmentEnvelope = THREE.MathUtils.smoothstep(sunAlignment, 0.68, 0.86)
    const rayProjection = finalPos.dot(sunDir)
    const rayDiscriminant = rayProjection * rayProjection - (finalPos.lengthSq() - 400 * 400)
    const sunVisibility = rayProjection < 0
      ? 1.0 - THREE.MathUtils.smoothstep(rayDiscriminant, -4000, 5000)
      : 1.0
    const activeGlare = Math.pow(alignmentEnvelope, 1.35) * sunVisibility

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
      glareSprite.material.opacity = activeGlare * 0.65
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
      planetController.update(time, p, alignmentEnvelope)
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
    window.removeEventListener('resize', onWindowResize)
    document.removeEventListener('visibilitychange', onVisibilityChange)

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
