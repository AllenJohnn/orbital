import * as THREE from 'three'
import { planetVertexShader, planetFragmentShader, atmosphereVertexShader, atmosphereFragmentShader, cloudsVertexShader, cloudsFragmentShader, moonFragmentShader } from '../shaders/planetShaders'

export const usePlanet = (scene: THREE.Scene) => {
  const planetGroup = new THREE.Group()
  const detailGroup = new THREE.Group()
  detailGroup.visible = false
  planetGroup.add(detailGroup)
  
  // Place planet at center
  planetGroup.position.set(0, 0, 0)
  
  // 1. Planet Surface
  const radius = 400
  const widthSegments = 128
  const heightSegments = 128
  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments)
  
  const sunDirection = new THREE.Vector3(1.0, 0.5, 0.2).normalize()

  const surfaceMaterial = new THREE.ShaderMaterial({
    vertexShader: planetVertexShader,
    fragmentShader: planetFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSunDirection: { value: sunDirection }
    }
  })
  
  const surface = new THREE.Mesh(geometry, surfaceMaterial)
  planetGroup.add(surface)
  
  // Create a separate group for rotation so we can apply axial tilt
  const planetRotationGroup = new THREE.Group()
  // Axial tilt of 15 degrees
  planetRotationGroup.rotation.x = 15 * (Math.PI / 180)
  planetRotationGroup.rotation.z = -5 * (Math.PI / 180) // Slight Z tilt
  
  planetRotationGroup.add(surface)
  
  // 2. Atmosphere
  const atmosphereRadius = radius * 1.08
  const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, widthSegments, heightSegments)
  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    uniforms: {
      uSunDirection: { value: sunDirection },
      uAtmosphereColor: { value: new THREE.Color(0x6a9dff) },
      uViewSunAlignment: { value: 0 }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, 
    depthWrite: false
  })
  
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  planetGroup.add(atmosphere) // Atmosphere does not need axial tilt
  
  // 3. Clouds
  const cloudGroup = new THREE.Group()
  const cloudGeometries: THREE.BufferGeometry[] = []
  const cloudMaterial = new THREE.ShaderMaterial({
    vertexShader: cloudsVertexShader,
    fragmentShader: cloudsFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSunDirection: { value: sunDirection }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide // Ensure clouds are visible from inside
  })
  
  // Shell texturing for cheap volumetric clouds
  const cloudLayers = 3;
  for (let i = 0; i < cloudLayers; i++) {
    // Keep the three shells that contribute visible volume; outer edge shells
    // were fully faded by the shader but still paid for a complete draw.
    const layerRadius = radius * (1.02 + i * 0.005);
    const cGeo = new THREE.SphereGeometry(layerRadius, widthSegments, heightSegments)
    cloudGeometries.push(cGeo)
    const cMesh = new THREE.Mesh(cGeo, cloudMaterial)
    cloudGroup.add(cMesh)
  }
  
  planetRotationGroup.add(cloudGroup) // Clouds spin with the planet
  
  detailGroup.add(planetRotationGroup)
  detailGroup.add(atmosphere)
  
  // 4. Moon
  const moonRadius = radius * 0.15
  const moonGeometry = new THREE.SphereGeometry(moonRadius, 64, 64)
  const moonMaterial = new THREE.ShaderMaterial({
    vertexShader: planetVertexShader, 
    fragmentShader: moonFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSunDirection: { value: sunDirection }
    }
  })
  const moon = new THREE.Mesh(moonGeometry, moonMaterial)
  const moonOrbitRadius = radius * 3.5
  moon.position.set(moonOrbitRadius, 100, -200)
  
  const moonPivot = new THREE.Group()
  moonPivot.add(moon)
  moonPivot.rotation.z = Math.PI / 12
  detailGroup.add(moonPivot) // Independent from axial tilt
  
  scene.add(planetGroup)
  
  const update = (time: number, progress: number, viewSunAlignment = 0) => {
    atmosphereMaterial.uniforms.uViewSunAlignment.value = viewSunAlignment
    // 1. Deterministic scroll-driven rotation (surface)
    // 240 degrees total rotation as we approach
    const targetRotation = progress * (240 * Math.PI / 180)
    surface.rotation.y = targetRotation
    
    // Clouds rotate very slightly faster than the surface (e.g. 10% faster)
    cloudGroup.rotation.y = targetRotation * 1.1
    
    // 2. Independent celestial motion (Moon)
    moon.rotation.y = time * 0.1 // Moon's own rotation
    moonPivot.rotation.y = time * 0.015 // Slow, independent orbital motion
    
    // Shader uniforms (for fbm noise evolution)
    surfaceMaterial.uniforms.uTime.value = time * 0.5 // Slow down surface terrain evolution
    cloudMaterial.uniforms.uTime.value = time
    moonMaterial.uniforms.uTime.value = time * 1.5
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

  const cleanup = () => {
    geometry.dispose()
    surfaceMaterial.dispose()
    atmosphereGeometry.dispose()
    atmosphereMaterial.dispose()
    for (const geometry of cloudGeometries) geometry.dispose()
    cloudMaterial.dispose()
    moonGeometry.dispose()
    moonMaterial.dispose()
    scene.remove(planetGroup)
  }
  
  return {
    planetGroup,
    update,
    precompileDetails,
    setDetailsVisible,
    cleanup,
    get surfaceRotation() { return surface.rotation.y }
  }
}
