import * as THREE from 'three'
import type { PlanetVisual } from '~/types/atlas'
import type { RenderQualityTier } from '~/config/celestialRender'
import { CELESTIAL_RENDER_CONFIG } from '~/config/celestialRender'
import { PLANET_SURFACE_CONFIG } from '~/config/planetSurface'
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

  let currentVisual: PlanetVisual = initialVisual ?? defaultKepler186fVisual
  let effectsVisible = false

  const setEffectsVisible = (visible: boolean) => {
    effectsVisible = visible
    if (atmosphereMesh) atmosphereMesh.visible = visible
    if (cloudGroup) cloudGroup.visible = visible
    if (moonPivot) moonPivot.visible = visible
  }

  const disposePlanetResources = () => {
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
        uEclipseStrength: { value: 0 }
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

  let reducedMotion = false

  const setRenderQuality = (tier: RenderQualityTier, prefersReducedMotion = false) => {
    reducedMotion = prefersReducedMotion
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
    detailGroup.visible = true
    setEffectsVisible(false)
    try {
      await renderer.compileAsync(scene, camera)
    } finally {
      detailGroup.visible = wasVisible
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
    setAtmosphereCameraRadius,
    cleanup,
    get surfaceRotation() {
      return surfaceMesh ? surfaceMesh.rotation.y : 0
    }
  }
}
