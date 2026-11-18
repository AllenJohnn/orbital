import * as THREE from 'three'
import type { PlanetVisual } from '~/types/atlas'
import type { RenderQualityTier } from '~/config/celestialRender'
import { CELESTIAL_RENDER_CONFIG } from '~/config/celestialRender'
import { PLANET_SURFACE_CONFIG } from '~/config/planetSurface'
import { SURFACE_APPROACH_CONFIG } from '~/config/surfaceApproach'
import {
  planetVertexShader,
  planetFragmentShader,
  atmosphereVertexShader,
  atmosphereFragmentShader,
  cloudsVertexShader,
  cloudsFragmentShader,
  moonFragmentShader
} from '../shaders/planetShaders'

export const defaultKepler186fVisual: PlanetVisual = {
  palette: ['#1a1714', '#998059', '#732e1a'],
  oceanLevel: PLANET_SURFACE_CONFIG.oceanLevel,
  cloudCover: PLANET_SURFACE_CONFIG.cloudCover,
  iceAmount: PLANET_SURFACE_CONFIG.iceAmount,
  atmosphereColor: '#6a9dff',
  atmosphereThickness: 1,
  cityLights: false,
  hasMoon: true,
  axialTiltDeg: 15,
  rotationSpeed: 1
}

export const usePlanet = (scene: THREE.Scene, initialVisual?: PlanetVisual, starColor = '#e5a35c') => {
  const planetGroup = new THREE.Group()
  const detailGroup = new THREE.Group()
  detailGroup.visible = false
  planetGroup.add(detailGroup)

  // Place planet at center
  planetGroup.position.set(0, 0, 0)
  scene.add(planetGroup)

  const radius = CELESTIAL_RENDER_CONFIG.atmosphere.planetRadius
  const atmosphereShellRadius = radius + CELESTIAL_RENDER_CONFIG.atmosphere.height * 0.82
  const surfaceQualityDefines = (tier: RenderQualityTier) => ({
    TERRAIN_OCTAVES: tier === 'low' ? 3 : tier === 'medium' ? 4 : 5,
    ...(tier === 'low' ? { PLANET_LOW_QUALITY: 1, PLANET_NO_CLOUD_SHADOWS: 1 } : {}),
    ...(tier === 'high' ? { PLANET_HIGH_QUALITY: 1 } : {})
  })
  const widthSegments = 128
  const heightSegments = 128
  const sunDirection = new THREE.Vector3(1.0, 0.5, 0.2).normalize()

  let planetRotationGroup: THREE.Group | null = null
  let surfaceGeometry: THREE.SphereGeometry | null = null
  let surfaceMaterial: THREE.ShaderMaterial | null = null
  let surfaceMesh: THREE.Mesh | null = null

  let atmosphereGeometry: THREE.SphereGeometry | null = null
  let atmosphereMaterial: THREE.ShaderMaterial | null = null
  let atmosphereMesh: THREE.Mesh | null = null

  let cloudGroup: THREE.Group | null = null
  const cloudGeometries: THREE.BufferGeometry[] = []
  let cloudMaterial: THREE.ShaderMaterial | null = null
  let cloudMaterialSecondary: THREE.ShaderMaterial | null = null

  let moonPivot: THREE.Group | null = null
  let moonGeometry: THREE.SphereGeometry | null = null
  let moonMaterial: THREE.ShaderMaterial | null = null
  let moonMesh: THREE.Mesh | null = null
  const eclipseDirection = new THREE.Vector3(0, 1, 0)
  const moonWorldPosition = new THREE.Vector3()
  const planetWorldPosition = new THREE.Vector3()

  let approachPivot: THREE.Group | null = null
  let approachPatch: THREE.Mesh | null = null
  let approachMaterial: THREE.ShaderMaterial | null = null
  let approachRocks: THREE.InstancedMesh | null = null
  let approachDust: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null
  const approachGeometries: Record<RenderQualityTier, THREE.BufferGeometry> = {
    low: new THREE.BufferGeometry(),
    medium: new THREE.BufferGeometry(),
    high: new THREE.BufferGeometry()
  }
  let approachQuality: RenderQualityTier = 'medium'
  const approachRotation = new THREE.Matrix3()
  const approachRotationMatrix = new THREE.Matrix4()
  const approachCenter = new THREE.Vector3()
  const localSurfacePoint = new THREE.Vector3()
  const inversePlanetMatrix = new THREE.Matrix4()
  const patchAxis = new THREE.Vector3(0, 0, 1)
  const rockUp = new THREE.Vector3(0, 1, 0)
  const rockPosition = new THREE.Vector3()
  const rockScale = new THREE.Vector3()
  const rockQuaternion = new THREE.Quaternion()
  const rockMatrix = new THREE.Matrix4()
  const rockColor = new THREE.Color()

  let currentVisual: PlanetVisual = initialVisual ?? defaultKepler186fVisual
  let effectsVisible = false

  const setEffectsVisible = (visible: boolean) => {
    effectsVisible = visible
    if (atmosphereMesh) atmosphereMesh.visible = visible
    if (cloudGroup) cloudGroup.visible = visible
    if (moonPivot) moonPivot.visible = visible
  }

  const buildApproachGeometry = (tier: RenderQualityTier) => {
    const geometry = approachGeometries[tier]
    const { radial, angular } = SURFACE_APPROACH_CONFIG.patchSegments[tier]
    const vertexCount = (radial + 1) * (angular + 1)
    const positions = new Float32Array(vertexCount * 3)
    const normals = new Float32Array(vertexCount * 3)
    const indices: number[] = []
    let offset = 0

    for (let ring = 0; ring <= radial; ring++) {
      const angle = SURFACE_APPROACH_CONFIG.patchAngularRadius * ring / radial
      const sinAngle = Math.sin(angle)
      const cosAngle = Math.cos(angle)
      for (let segment = 0; segment <= angular; segment++) {
        const around = segment / angular * Math.PI * 2
        const x = sinAngle * Math.cos(around)
        const y = sinAngle * Math.sin(around)
        const z = cosAngle
        positions.set([x * (radius + SURFACE_APPROACH_CONFIG.patchLift), y * (radius + SURFACE_APPROACH_CONFIG.patchLift), z * (radius + SURFACE_APPROACH_CONFIG.patchLift)], offset)
        normals.set([x, y, z], offset)
        offset += 3
      }
    }

    for (let ring = 0; ring < radial; ring++) {
      for (let segment = 0; segment < angular; segment++) {
        const a = ring * (angular + 1) + segment
        const b = a + angular + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
  }

  const setApproachQuality = (tier: RenderQualityTier) => {
    approachQuality = tier
    if (approachPatch) approachPatch.geometry = approachGeometries[tier]
    if (approachMaterial) {
      approachMaterial.defines = { ...surfaceQualityDefines(tier), APPROACH_PATCH: 1 }
      approachMaterial.needsUpdate = true
    }
    if (approachRocks) approachRocks.count = SURFACE_APPROACH_CONFIG.scatterCount[tier]
  }

  const updateApproach = (surfacePointWorld: THREE.Vector3, altitude: number, opacity: number, time: number, currentPixelRatio: number) => {
    if (!approachPivot || !surfaceMesh || !approachMaterial || !approachDust) return
    surfaceMesh.updateWorldMatrix(true, false)
    inversePlanetMatrix.copy(surfaceMesh.matrixWorld).invert()
    localSurfacePoint.copy(surfacePointWorld).applyMatrix4(inversePlanetMatrix)
    approachCenter.copy(localSurfacePoint).normalize()
    approachPivot.quaternion.setFromUnitVectors(patchAxis, approachCenter)
    approachPivot.updateMatrix()
    approachRotationMatrix.compose(approachPivot.position, approachPivot.quaternion, approachPivot.scale)
    approachRotation.setFromMatrix4(approachRotationMatrix)
    approachMaterial.uniforms.uTerrainTransform?.value.copy(approachRotation)
    approachMaterial.uniforms.uPatchCenter?.value.copy(approachCenter)
    if (approachMaterial.uniforms.uPatchOpacity) approachMaterial.uniforms.uPatchOpacity.value = opacity
    if (surfaceMaterial?.uniforms.uApproachCenter) surfaceMaterial.uniforms.uApproachCenter.value.copy(approachCenter)
    if (surfaceMaterial?.uniforms.uApproachBlend) surfaceMaterial.uniforms.uApproachBlend.value = opacity
    if (approachMaterial.uniforms.uApproachFogStrength) {
      approachMaterial.uniforms.uApproachFogStrength.value = SURFACE_APPROACH_CONFIG.fog.strength * opacity
    }
    const remainingCloudCover = PLANET_SURFACE_CONFIG.cloudCover * (1 - opacity * 0.74)
    if (cloudMaterial?.uniforms.uCloudCover) cloudMaterial.uniforms.uCloudCover.value = remainingCloudCover
    if (cloudMaterialSecondary?.uniforms.uCloudCover) cloudMaterialSecondary.uniforms.uCloudCover.value = remainingCloudCover
    if (approachDust.material.uniforms.uTime) approachDust.material.uniforms.uTime.value = time
    if (approachDust.material.uniforms.uPixelRatio) approachDust.material.uniforms.uPixelRatio.value = currentPixelRatio
    if (approachDust.material.uniforms.uFade) approachDust.material.uniforms.uFade.value = opacity
    approachDust.visible = opacity > 0.001
    if (approachRocks) {
      approachRocks.visible = opacity > 0.001
      ;(approachRocks.material as THREE.MeshBasicMaterial).opacity = opacity
    }
    approachPivot.visible = opacity > 0.001 && altitude < SURFACE_APPROACH_CONFIG.activationAltitude
  }

  const createApproachFeatures = () => {
    if (!surfaceMaterial || !surfaceMesh) return
    approachPivot = new THREE.Group()
    approachPivot.visible = false
    surfaceMesh.add(approachPivot)

    for (const tier of ['low', 'medium', 'high'] as const) buildApproachGeometry(tier)

    approachMaterial = surfaceMaterial.clone()
    approachMaterial.uniforms = {
      ...surfaceMaterial.uniforms,
      uTerrainTransform: { value: new THREE.Matrix3() },
      uPatchCenter: { value: new THREE.Vector3(0, 0, 1) },
      uPatchOpacity: { value: 0 },
      uPatchAngularRadius: { value: SURFACE_APPROACH_CONFIG.patchAngularRadius },
      uPatchEdgeFade: { value: SURFACE_APPROACH_CONFIG.patchEdgeFade },
      uApproachFogColor: { value: new THREE.Color(SURFACE_APPROACH_CONFIG.fog.color) },
      uApproachFogNear: { value: SURFACE_APPROACH_CONFIG.fog.near },
      uApproachFogFar: { value: SURFACE_APPROACH_CONFIG.fog.far },
      uApproachFogStrength: { value: SURFACE_APPROACH_CONFIG.fog.strength },
      uApproachDetailStrength: { value: SURFACE_APPROACH_CONFIG.detailStrength }
    }
    approachMaterial.defines = { ...surfaceQualityDefines('medium'), APPROACH_PATCH: 1 }
    approachMaterial.transparent = true
    approachMaterial.depthWrite = false
    approachMaterial.depthTest = true
    approachMaterial.polygonOffset = true
    approachMaterial.polygonOffsetFactor = -1
    approachMaterial.polygonOffsetUnits = -1
    approachMaterial.needsUpdate = true
    approachPatch = new THREE.Mesh(approachGeometries.medium, approachMaterial)
    approachPatch.renderOrder = 1
    approachPatch.frustumCulled = false
    approachPivot.add(approachPatch)

    const rockGeometry = new THREE.IcosahedronGeometry(1, 0)
    const rockPositions = rockGeometry.getAttribute('position')
    const rockColors = new Float32Array(rockPositions.count * 3)
    const vertex = new THREE.Vector3()
    const faceColor = new THREE.Color()
    for (let i = 0; i < rockPositions.count; i++) {
      vertex.fromBufferAttribute(rockPositions, i)
      const shade = THREE.MathUtils.clamp(0.58 + vertex.y * 0.26, 0.24, 0.92)
      faceColor.setRGB(shade * 0.48, shade * 0.43, shade * 0.36)
      rockColors.set([faceColor.r, faceColor.g, faceColor.b], i * 3)
    }
    rockGeometry.setAttribute('color', new THREE.BufferAttribute(rockColors, 3))
    const rockMaterial = new THREE.MeshBasicMaterial({ color: SURFACE_APPROACH_CONFIG.rockColor, vertexColors: true })
    rockMaterial.transparent = true
    rockMaterial.opacity = 0
    rockMaterial.depthWrite = false
    rockMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        float rockTpdf(vec2 pixel) {
          vec2 p = floor(pixel);
          float a = fract(sin(dot(p + vec2(19.19, 73.17), vec2(12.9898, 78.233))) * 43758.5453);
          float b = fract(sin(dot(p + vec2(47.11, 11.73), vec2(39.3468, 11.135))) * 24634.6345);
          return (a - b) * (1.0 / 255.0);
        }`
      ).replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.rgb += vec3(rockTpdf(gl_FragCoord.xy));')
    }
    rockMaterial.customProgramCacheKey = () => 'orbital-approach-rocks-dither-v1'
    approachRocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, SURFACE_APPROACH_CONFIG.scatterCount.high)
    approachRocks.instanceMatrix.setUsage(THREE.StaticDrawUsage)
    let seed = PLANET_SURFACE_CONFIG.seed * 7919
    const random = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let i = 0; i < approachRocks.count; i++) {
      const cosAngle = THREE.MathUtils.lerp(1, Math.cos(SURFACE_APPROACH_CONFIG.patchAngularRadius * 0.9), random())
      const sinAngle = Math.sqrt(1 - cosAngle * cosAngle)
      const around = random() * Math.PI * 2
      const direction = new THREE.Vector3(sinAngle * Math.cos(around), sinAngle * Math.sin(around), cosAngle)
      const sizeClass = random() < 0.09 ? 1.85 : random() < 0.34 ? 1.12 : 0.62
      const scale = sizeClass * (0.75 + random() * 0.6)
      rockPosition.copy(direction).multiplyScalar(radius + SURFACE_APPROACH_CONFIG.patchLift + scale * 0.32)
      rockQuaternion.setFromUnitVectors(rockUp, direction)
      rockQuaternion.multiply(new THREE.Quaternion().setFromAxisAngle(direction, random() * Math.PI * 2))
      rockScale.set(scale * (0.72 + random() * 0.55), scale * (0.55 + random() * 0.65), scale * (0.7 + random() * 0.55))
      rockMatrix.compose(rockPosition, rockQuaternion, rockScale)
      approachRocks.setMatrixAt(i, rockMatrix)
      rockColor.setHSL(0.08 + random() * 0.035, 0.12 + random() * 0.12, 0.27 + random() * 0.18)
      approachRocks.setColorAt(i, rockColor)
    }
    approachRocks.instanceMatrix.needsUpdate = true
    if (approachRocks.instanceColor) approachRocks.instanceColor.needsUpdate = true
    approachRocks.frustumCulled = false
    approachRocks.renderOrder = 2
    approachPivot.add(approachRocks)

    const dustPositions = new Float32Array(SURFACE_APPROACH_CONFIG.dust.count * 3)
    const dustAngularRadius = Math.min(
      SURFACE_APPROACH_CONFIG.patchAngularRadius * 0.98,
      SURFACE_APPROACH_CONFIG.dust.radius / radius
    )
    for (let i = 0; i < SURFACE_APPROACH_CONFIG.dust.count; i++) {
      const cosAngle = THREE.MathUtils.lerp(1, Math.cos(dustAngularRadius), random())
      const sinAngle = Math.sqrt(1 - cosAngle * cosAngle)
      const around = random() * Math.PI * 2
      const distance = radius + SURFACE_APPROACH_CONFIG.dust.height * (0.3 + random())
      dustPositions.set([sinAngle * Math.cos(around) * distance, sinAngle * Math.sin(around) * distance, cosAngle * distance], i * 3)
    }
    const dustGeometry = new THREE.BufferGeometry()
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3))
    const dustMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: SURFACE_APPROACH_CONFIG.dust.opacity },
        uFade: { value: 0 },
        uPixelRatio: { value: 1 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vDepth;
        void main() {
          vec3 drifted = position;
          drifted.x += sin(uTime * 0.21 + position.z * 0.017) * ${(SURFACE_APPROACH_CONFIG.dust.driftRate * 18).toFixed(3)};
          drifted.y += cos(uTime * 0.17 + position.x * 0.013) * ${(SURFACE_APPROACH_CONFIG.dust.driftRate * 12).toFixed(3)};
          vec4 mvPosition = modelViewMatrix * vec4(drifted, 1.0);
          vDepth = clamp(1.0 - length(mvPosition.xyz) / 700.0, 0.0, 1.0);
          gl_PointSize = clamp(uPixelRatio * (1.0 + vDepth * 1.8), 1.0, 3.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform float uFade;
        varying float vDepth;
        float dustTpdf(vec2 pixel) {
          vec2 p = floor(pixel);
          float a = fract(sin(dot(p + vec2(19.19, 73.17), vec2(12.9898, 78.233))) * 43758.5453);
          float b = fract(sin(dot(p + vec2(47.11, 11.73), vec2(39.3468, 11.135))) * 24634.6345);
          return (a - b) * (1.0 / 255.0);
        }
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5));
          if (radius > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.12, 0.5, radius)) * uOpacity * uFade * vDepth;
          vec3 color = vec3(0.73, 0.62, 0.48) + vec3(dustTpdf(gl_FragCoord.xy));
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    })
    approachDust = new THREE.Points(dustGeometry, dustMaterial)
    approachDust.frustumCulled = false
    approachDust.renderOrder = 3
    approachPivot.add(approachDust)
    setApproachQuality('medium')
  }

  const disposePlanetResources = () => {
    if (approachPivot) {
      approachPivot.parent?.remove(approachPivot)
      approachPivot.clear()
      approachPivot = null
    }
    if (approachMaterial) {
      approachMaterial.dispose()
      approachMaterial = null
    }
    if (approachRocks) {
      approachRocks.geometry.dispose()
      if (Array.isArray(approachRocks.material)) {
        for (const material of approachRocks.material) material.dispose()
      } else {
        approachRocks.material.dispose()
      }
      approachRocks = null
    }
    if (approachDust) {
      approachDust.geometry.dispose()
      approachDust.material.dispose()
      approachDust = null
    }
    for (const geometry of Object.values(approachGeometries)) geometry.dispose()

    // 1. Surface
    if (surfaceMesh) {
      if (planetRotationGroup) planetRotationGroup.remove(surfaceMesh)
      surfaceMesh = null
    }
    if (surfaceGeometry) {
      surfaceGeometry.dispose()
      surfaceGeometry = null
    }
    if (surfaceMaterial) {
      surfaceMaterial.dispose()
      surfaceMaterial = null
    }

    // 2. Atmosphere
    if (atmosphereMesh) {
      atmosphereMesh.parent?.remove(atmosphereMesh)
      atmosphereMesh = null
    }
    if (atmosphereGeometry) {
      atmosphereGeometry.dispose()
      atmosphereGeometry = null
    }
    if (atmosphereMaterial) {
      atmosphereMaterial.dispose()
      atmosphereMaterial = null
    }

    // 3. Clouds
    if (cloudGroup) {
      cloudGroup.clear()
      if (planetRotationGroup) planetRotationGroup.remove(cloudGroup)
      cloudGroup = null
    }
    for (const geo of cloudGeometries) {
      geo.dispose()
    }
    cloudGeometries.length = 0
    if (cloudMaterial) {
      cloudMaterial.dispose()
      cloudMaterial = null
    }
    if (cloudMaterialSecondary) {
      cloudMaterialSecondary.dispose()
      cloudMaterialSecondary = null
    }

    // 4. Moon
    if (moonMesh) {
      if (moonPivot) moonPivot.remove(moonMesh)
      moonMesh = null
    }
    if (moonGeometry) {
      moonGeometry.dispose()
      moonGeometry = null
    }
    if (moonMaterial) {
      moonMaterial.dispose()
      moonMaterial = null
    }
    if (moonPivot) {
      detailGroup.remove(moonPivot)
      moonPivot = null
    }

    // Remove rotation group
    if (planetRotationGroup) {
      detailGroup.remove(planetRotationGroup)
      planetRotationGroup = null
    }
  }

  const buildPlanet = (visual: PlanetVisual) => {
    disposePlanetResources()
    currentVisual = visual

    // 1. Planet Surface
    surfaceGeometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments)
    surfaceMaterial = new THREE.ShaderMaterial({
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: sunDirection },
        uCityLights: { value: visual.cityLights ? 1 : 0 },
        uPalette1: { value: new THREE.Color(visual.palette[0]) },
        uPalette2: { value: new THREE.Color(visual.palette[1]) },
        uPalette3: { value: new THREE.Color(visual.palette[2]) },
        uOceanLevel: { value: PLANET_SURFACE_CONFIG.oceanLevel },
        uIceAmount: { value: PLANET_SURFACE_CONFIG.iceAmount },
        uAtmosphereColor: { value: new THREE.Color(visual.atmosphereColor) },
        uAtmosphereThickness: { value: visual.atmosphereThickness },
        uStarColor: { value: new THREE.Color(starColor) },
        uRayleighCoefficients: { value: new THREE.Vector3(...CELESTIAL_RENDER_CONFIG.atmosphere.rayleighCoefficients) },
        uMieCoefficients: { value: new THREE.Vector3(...CELESTIAL_RENDER_CONFIG.atmosphere.mieCoefficients) },
        uAtmosphereHeight: { value: CELESTIAL_RENDER_CONFIG.atmosphere.height },
        uTerrainSeed: { value: PLANET_SURFACE_CONFIG.seed },
        uReliefStrength: { value: PLANET_SURFACE_CONFIG.reliefStrength },
        uOceanDeepColor: { value: new THREE.Color(PLANET_SURFACE_CONFIG.oceanColors.deep) },
        uOceanShallowColor: { value: new THREE.Color(PLANET_SURFACE_CONFIG.oceanColors.shallow) },
        uOceanShelfColor: { value: new THREE.Color(PLANET_SURFACE_CONFIG.oceanColors.shelf) },
        uFoamColor: { value: new THREE.Color(PLANET_SURFACE_CONFIG.oceanColors.foam) },
        uFoamStrength: { value: PLANET_SURFACE_CONFIG.foamStrength },
        uGlintStrength: { value: PLANET_SURFACE_CONFIG.glintStrength },
        uCloudShadowStrength: { value: PLANET_SURFACE_CONFIG.cloudShadowStrength.medium },
        uMoonDirection: { value: eclipseDirection },
        uEclipseStrength: { value: 0 },
        uApproachCenter: { value: new THREE.Vector3(0, 0, 1) },
        uApproachBlend: { value: 0 },
        uApproachRadius: { value: SURFACE_APPROACH_CONFIG.patchAngularRadius }
      },
      defines: surfaceQualityDefines('medium')
    })
    surfaceMesh = new THREE.Mesh(surfaceGeometry, surfaceMaterial)

    // Separate group for rotation so we can apply axial tilt
    planetRotationGroup = new THREE.Group()
    planetRotationGroup.rotation.x = (visual.axialTiltDeg ?? 15) * (Math.PI / 180)
    planetRotationGroup.rotation.z = -5 * (Math.PI / 180)
    planetRotationGroup.add(surfaceMesh)
    detailGroup.add(planetRotationGroup)

    // 2. Atmosphere
    if (visual.atmosphereThickness > 0.001) {
      atmosphereGeometry = new THREE.SphereGeometry(atmosphereShellRadius, widthSegments, heightSegments)
      atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
          uSunDirection: { value: sunDirection },
          uStarColor: { value: new THREE.Color(starColor) },
          uAtmosphereColor: { value: new THREE.Color(visual.atmosphereColor) },
          uAtmosphereThickness: { value: visual.atmosphereThickness },
          uViewSunAlignment: { value: 0 },
          uPlanetRadius: { value: radius },
          uAtmosphereHeight: { value: CELESTIAL_RENDER_CONFIG.atmosphere.height },
          uRayleighCoefficients: { value: new THREE.Vector3(...CELESTIAL_RENDER_CONFIG.atmosphere.rayleighCoefficients) },
          uMieCoefficients: { value: new THREE.Vector3(...CELESTIAL_RENDER_CONFIG.atmosphere.mieCoefficients) },
          uRayleighScaleHeight: { value: CELESTIAL_RENDER_CONFIG.atmosphere.rayleighScaleHeight },
          uMieScaleHeight: { value: CELESTIAL_RENDER_CONFIG.atmosphere.mieScaleHeight },
          uMieAnisotropy: { value: CELESTIAL_RENDER_CONFIG.atmosphere.mieAnisotropy },
          uTime: { value: 0 },
          uAuroraStrength: { value: 0 },
          uAuroraScale: { value: CELESTIAL_RENDER_CONFIG.aurora.curtainScale },
          uAuroraMotionRate: { value: CELESTIAL_RENDER_CONFIG.aurora.motionRate },
          uTwilightStrength: { value: CELESTIAL_RENDER_CONFIG.atmosphere.twilightStrength },
        },
        defines: {
          ATMOSPHERE_STEPS: CELESTIAL_RENDER_CONFIG.atmosphere.steps.medium
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false
      })
      atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
      atmosphereMesh.visible = effectsVisible
      planetRotationGroup.add(atmosphereMesh)
    }

    // 3. Clouds
    if (PLANET_SURFACE_CONFIG.cloudCover > 0.001) {
      cloudGroup = new THREE.Group()
      cloudGroup.visible = effectsVisible
      cloudMaterial = new THREE.ShaderMaterial({
        vertexShader: cloudsVertexShader,
        fragmentShader: cloudsFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSunDirection: { value: sunDirection },
          uCloudCover: { value: PLANET_SURFACE_CONFIG.cloudCover },
          uTerrainSeed: { value: PLANET_SURFACE_CONFIG.seed },
          uCloudLayer: { value: 0 }
        },
        defines: { CLOUD_OCTAVES: 3 },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
      cloudMaterialSecondary = cloudMaterial.clone()
      if (cloudMaterialSecondary.uniforms.uCloudLayer) {
        cloudMaterialSecondary.uniforms.uCloudLayer.value = 1
      }

      const lowerCloudGeometry = new THREE.SphereGeometry(radius * 1.02, widthSegments, heightSegments)
      const upperCloudGeometry = new THREE.SphereGeometry(radius * 1.02 + PLANET_SURFACE_CONFIG.cloudLayerSeparation, widthSegments, heightSegments)
      cloudGeometries.push(lowerCloudGeometry, upperCloudGeometry)
      cloudGroup.add(new THREE.Mesh(lowerCloudGeometry, cloudMaterial))
      cloudGroup.add(new THREE.Mesh(upperCloudGeometry, cloudMaterialSecondary))

      planetRotationGroup.add(cloudGroup)
    }

    // 4. Moon
    if (visual.hasMoon) {
      const moonRadius = radius * 0.15
      moonGeometry = new THREE.SphereGeometry(moonRadius, 64, 64)
      moonMaterial = new THREE.ShaderMaterial({
        vertexShader: planetVertexShader,
        fragmentShader: moonFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSunDirection: { value: sunDirection },
          uMoonReliefStrength: { value: PLANET_SURFACE_CONFIG.moonReliefStrength }
        }
      })
      moonMesh = new THREE.Mesh(moonGeometry, moonMaterial)
      const moonOrbitRadius = radius * 3.5
      moonMesh.position.set(moonOrbitRadius, 100, -200)

      moonPivot = new THREE.Group()
      moonPivot.add(moonMesh)
      moonPivot.rotation.z = Math.PI / 12
      moonPivot.visible = effectsVisible
      detailGroup.add(moonPivot)
    }
  }

  // Build the initial planet
  buildPlanet(currentVisual)
  createApproachFeatures()

  let reducedMotion = false

  const setRenderQuality = (tier: RenderQualityTier, prefersReducedMotion = false) => {
    reducedMotion = prefersReducedMotion
    setApproachQuality(tier)
    if (surfaceMaterial) {
      surfaceMaterial.defines = surfaceQualityDefines(tier)
      surfaceMaterial.needsUpdate = true
      if (surfaceMaterial.uniforms.uCloudShadowStrength) {
        surfaceMaterial.uniforms.uCloudShadowStrength.value = PLANET_SURFACE_CONFIG.cloudShadowStrength[tier]
      }
    }
    for (const material of [cloudMaterial, cloudMaterialSecondary]) {
      if (!material) continue
      material.defines = {
        CLOUD_OCTAVES: tier === 'low' ? 2 : tier === 'medium' ? 3 : 5,
        ...(tier === 'high' ? { CLOUD_HIGH_QUALITY: 1 } : {})
      }
      material.needsUpdate = true
    }
    if (!atmosphereMaterial) return

    const nextDefines = tier === 'low'
      ? { ATMOSPHERE_LOW_QUALITY: 1 }
      : { ATMOSPHERE_STEPS: CELESTIAL_RENDER_CONFIG.atmosphere.steps[tier] }
    atmosphereMaterial.defines = nextDefines
    atmosphereMaterial.needsUpdate = true
    if (atmosphereMaterial.uniforms.uAuroraStrength) {
      atmosphereMaterial.uniforms.uAuroraStrength.value = tier === 'low' || reducedMotion
        ? 0
        : CELESTIAL_RENDER_CONFIG.aurora.strength
    }
  }

  const setAtmosphereCameraRadius = (cameraRadius: number) => {
    if (!atmosphereMaterial) return
    const side = cameraRadius < atmosphereShellRadius ? THREE.BackSide : THREE.FrontSide
    if (atmosphereMaterial.side !== side) {
      atmosphereMaterial.side = side
      atmosphereMaterial.needsUpdate = true
    }
  }

  const update = (time: number, progress: number, viewSunAlignment = 0) => {
    if (atmosphereMaterial?.uniforms?.uViewSunAlignment) {
      atmosphereMaterial.uniforms.uViewSunAlignment.value = viewSunAlignment
    }
    if (atmosphereMaterial?.uniforms?.uTime) {
      atmosphereMaterial.uniforms.uTime.value = reducedMotion ? 0 : time
    }

    // 1. Deterministic scroll-driven rotation (surface)
    const targetRotation = progress * (240 * Math.PI / 180)
    if (surfaceMesh) {
      surfaceMesh.rotation.y = targetRotation
    }

    // Clouds rotate very slightly faster than the surface
    if (cloudGroup) {
      cloudGroup.rotation.y = targetRotation * 1.1
    }

    // 2. Independent celestial motion (Moon)
    if (moonMesh) {
      moonMesh.rotation.y = time * 0.1
    }
    if (moonPivot) {
      moonPivot.rotation.y = time * 0.015
    }
    if (moonMesh && surfaceMaterial?.uniforms?.uEclipseStrength) {
      planetGroup.updateMatrixWorld(true)
      moonMesh.getWorldPosition(moonWorldPosition)
      planetGroup.getWorldPosition(planetWorldPosition)
      eclipseDirection.copy(moonWorldPosition).sub(planetWorldPosition).normalize()
      const starAlignment = eclipseDirection.dot(sunDirection)
      surfaceMaterial.uniforms.uMoonDirection?.value.copy(eclipseDirection)
      surfaceMaterial.uniforms.uEclipseStrength.value = THREE.MathUtils.smoothstep(starAlignment, 0.985, 0.999)
    }

    // Shader uniforms
    if (surfaceMaterial?.uniforms?.uTime) {
      surfaceMaterial.uniforms.uTime.value = reducedMotion ? 0 : time * 0.5
    }
    if (cloudMaterial?.uniforms?.uTime) {
      cloudMaterial.uniforms.uTime.value = reducedMotion ? 0 : time
    }
    if (cloudMaterialSecondary?.uniforms?.uTime) {
      cloudMaterialSecondary.uniforms.uTime.value = reducedMotion ? 0 : time
    }
    if (moonMaterial?.uniforms?.uTime) {
      moonMaterial.uniforms.uTime.value = reducedMotion ? 0 : time * 1.5
    }
  }

  const precompileTerrain = async (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => {
    const wasVisible = detailGroup.visible
    const wasApproachVisible = approachPivot?.visible ?? false
    const previousApproachOpacity = approachMaterial?.uniforms.uPatchOpacity?.value ?? 0
    detailGroup.visible = true
    setEffectsVisible(false)
    if (approachPivot && approachMaterial) {
      approachPivot.visible = true
      if (approachMaterial.uniforms.uPatchOpacity) approachMaterial.uniforms.uPatchOpacity.value = 1
    }
    try {
      await renderer.compileAsync(scene, camera)
    } finally {
      detailGroup.visible = wasVisible
      if (approachPivot) approachPivot.visible = wasApproachVisible
      if (approachMaterial?.uniforms.uPatchOpacity) {
        approachMaterial.uniforms.uPatchOpacity.value = previousApproachOpacity
      }
    }
  }

  const precompileEffects = async (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => {
    const wasVisible = detailGroup.visible
    detailGroup.visible = true
    setEffectsVisible(true)
    try {
      await renderer.compileAsync(scene, camera)
    } finally {
      detailGroup.visible = wasVisible
      setEffectsVisible(false)
    }
  }

  const setDetailsVisible = (visible: boolean) => { detailGroup.visible = visible }

  const cleanup = () => {
    disposePlanetResources()
    scene.remove(planetGroup)
  }

  return {
    planetGroup,
    update,
    precompileTerrain,
    precompileEffects,
    setDetailsVisible,
    setEffectsVisible,
    setRenderQuality,
    updateApproach,
    setAtmosphereCameraRadius,
    cleanup,
    get surfaceRotation() {
      return surfaceMesh ? surfaceMesh.rotation.y : 0
    }
  }
}
