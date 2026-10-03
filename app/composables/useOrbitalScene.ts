import * as THREE from 'three'
import type { Ref } from 'vue'
import { usePlanet } from './usePlanet'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export const useOrbitalScene = (containerRef: Ref<HTMLElement | null>) => {
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let composer: EffectComposer
  let starParticles: THREE.Points
  let animationFrameId: number
  let planetController: ReturnType<typeof usePlanet> | null = null

  const init = () => {
    if (!containerRef.value) return

    scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x000000, 0.0003) 

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000) 
    camera.position.z = 800

    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }) // antialias usually disabled when using postprocessing unless using FXAA
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    containerRef.value.appendChild(renderer.domElement)

    // Post-processing setup
    const renderScene = new RenderPass(scene, camera)
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85)
    bloomPass.threshold = 0.2
    bloomPass.strength = 1.2
    bloomPass.radius = 0.5

    composer = new EffectComposer(renderer)
    composer.addPass(renderScene)
    composer.addPass(bloomPass)

    createStarField()
    
    planetController = usePlanet(scene)

    window.addEventListener('resize', onWindowResize)
    animate()
  }

  const createStarField = () => {
    const starGeometry = new THREE.BufferGeometry()
    const starCount = 8000 // slightly increased for depth
    const isMobile = window.innerWidth < 768
    const actualStarCount = isMobile ? Math.floor(starCount * 0.4) : starCount

    const positions = new Float32Array(actualStarCount * 3)
    const opacities = new Float32Array(actualStarCount)
    const sizes = new Float32Array(actualStarCount)

    for (let i = 0; i < actualStarCount; i++) {
      const r = 3000 * Math.cbrt(Math.random()) + 500
      const theta = Math.random() * 2 * Math.PI
      const phi = Math.acos(2 * Math.random() - 1)

      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = (Math.random() - 0.5) * 6000 

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      opacities[i] = Math.random() * 0.8 + 0.2
      sizes[i] = (Math.random() * 1.5 + 0.5)
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

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    const time = performance.now() * 0.001

    if (starParticles) {
      starParticles.rotation.y += 0.0001
      starParticles.rotation.x += 0.00005
      
      const material = starParticles.material as THREE.ShaderMaterial
      if (material.uniforms) {
        material.uniforms.uTime.value = time
      }
    }
    
    if (planetController) {
      planetController.update(time)
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
    
    if (renderer && renderer.domElement && containerRef.value) {
      containerRef.value.removeChild(renderer.domElement)
      renderer.dispose()
    }
    
    if (starParticles) {
      starParticles.geometry.dispose()
      ;(starParticles.material as THREE.Material).dispose()
    }
  }

  return { 
    init, 
    cleanup, 
    get scene() { return scene }, 
    get camera() { return camera }, 
    get starParticles() { return starParticles },
    get planetGroup() { return planetController?.planetGroup }
  }
}
