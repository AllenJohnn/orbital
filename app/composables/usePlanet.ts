import * as THREE from 'three'
import type { PlanetVisual } from '~/types/atlas'
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
  oceanLevel: 0.55,
  cloudCover: 0.55,
  iceAmount: 0.35,
  atmosphereColor: '#6a9dff',
  atmosphereThickness: 1,
  cityLights: false,
  hasMoon: true,
  axialTiltDeg: 15,
  rotationSpeed: 1
}

export const usePlanet = (scene: THREE.Scene, initialVisual?: PlanetVisual) => {
  const planetGroup = new THREE.Group()
  const detailGroup = new THREE.Group()
  detailGroup.visible = false
  planetGroup.add(detailGroup)

  // Place planet at center
  planetGroup.position.set(0, 0, 0)
  scene.add(planetGroup)

  const radius = 400
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

  let moonPivot: THREE.Group | null = null
  let moonGeometry: THREE.SphereGeometry | null = null
  let moonMaterial: THREE.ShaderMaterial | null = null
  let moonMesh: THREE.Mesh | null = null

  let currentVisual: PlanetVisual = initialVisual ?? defaultKepler186fVisual

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
      detailGroup.remove(atmosphereMesh)
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
        uOceanLevel: { value: visual.oceanLevel },
        uIceAmount: { value: visual.iceAmount },
        uAtmosphereColor: { value: new THREE.Color(visual.atmosphereColor) },
        uAtmosphereThickness: { value: visual.atmosphereThickness }
      }
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
      const atmosphereRadius = radius * 1.08
      atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, widthSegments, heightSegments)
      atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: atmosphereVertexShader,
        fragmentShader: atmosphereFragmentShader,
        uniforms: {
          uSunDirection: { value: sunDirection },
          uAtmosphereColor: { value: new THREE.Color(visual.atmosphereColor) },
          uAtmosphereThickness: { value: visual.atmosphereThickness },
          uViewSunAlignment: { value: 0 }
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })
      atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
      detailGroup.add(atmosphereMesh)
    }

    // 3. Clouds
    if (visual.cloudCover > 0.001) {
      cloudGroup = new THREE.Group()
      cloudMaterial = new THREE.ShaderMaterial({
        vertexShader: cloudsVertexShader,
        fragmentShader: cloudsFragmentShader,
        uniforms: {
          uTime: { value: 0 },
          uSunDirection: { value: sunDirection },
          uCloudCover: { value: visual.cloudCover }
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })

      const cloudLayers = 3
      for (let i = 0; i < cloudLayers; i++) {
        const layerRadius = radius * (1.02 + i * 0.005)
        const cGeo = new THREE.SphereGeometry(layerRadius, widthSegments, heightSegments)
        cloudGeometries.push(cGeo)
        const cMesh = new THREE.Mesh(cGeo, cloudMaterial)
        cloudGroup.add(cMesh)
      }

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
          uSunDirection: { value: sunDirection }
        }
      })
      moonMesh = new THREE.Mesh(moonGeometry, moonMaterial)
      const moonOrbitRadius = radius * 3.5
      moonMesh.position.set(moonOrbitRadius, 100, -200)

      moonPivot = new THREE.Group()
      moonPivot.add(moonMesh)
      moonPivot.rotation.z = Math.PI / 12
      detailGroup.add(moonPivot)
    }
  }

  // Build the initial planet
  buildPlanet(currentVisual)

  const update = (time: number, progress: number, viewSunAlignment = 0) => {
    if (atmosphereMaterial?.uniforms?.uViewSunAlignment) {
      atmosphereMaterial.uniforms.uViewSunAlignment.value = viewSunAlignment
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

    // Shader uniforms
    if (surfaceMaterial?.uniforms?.uTime) {
      surfaceMaterial.uniforms.uTime.value = time * 0.5
    }
    if (cloudMaterial?.uniforms?.uTime) {
      cloudMaterial.uniforms.uTime.value = time
    }
    if (moonMaterial?.uniforms?.uTime) {
      moonMaterial.uniforms.uTime.value = time * 1.5
    }
  }

  const precompileDetails = (renderer: THREE.WebGLRenderer, camera: THREE.Camera) => {
    detailGroup.visible = true
    try {
      return renderer.compileAsync(scene, camera)
    } finally {
      detailGroup.visible = false
    }
  }

  const setDetailsVisible = (visible: boolean) => {
    detailGroup.visible = visible
  }

  const setVisual = (nextVisual: PlanetVisual) => {
    buildPlanet(nextVisual)
  }

  const cleanup = () => {
    disposePlanetResources()
    scene.remove(planetGroup)
  }

  return {
    planetGroup,
    update,
    precompileDetails,
    setDetailsVisible,
    setVisual,
    cleanup,
    get surfaceRotation() {
      return surfaceMesh ? surfaceMesh.rotation.y : 0
    }
  }
}
