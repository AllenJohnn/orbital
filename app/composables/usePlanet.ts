import * as THREE from 'three'
import { planetVertexShader, planetFragmentShader, atmosphereVertexShader, atmosphereFragmentShader, cloudsVertexShader, cloudsFragmentShader, moonFragmentShader } from '../shaders/planetShaders'

export const usePlanet = (scene: THREE.Scene) => {
  const planetGroup = new THREE.Group()
  
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
  
  // 2. Atmosphere
  const atmosphereRadius = radius * 1.15
  const atmosphereGeometry = new THREE.SphereGeometry(atmosphereRadius, widthSegments, heightSegments)
  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    uniforms: {
      uSunDirection: { value: sunDirection },
      uAtmosphereColor: { value: new THREE.Color(0x6a9dff) } // Softer pale blue
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide, // Render on the back side for a rim effect around the planet
    depthWrite: false
  })
  
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial)
  planetGroup.add(atmosphere)
  
  // 3. Clouds
  const cloudRadius = radius * 1.02
  const cloudGeometry = new THREE.SphereGeometry(cloudRadius, widthSegments, heightSegments)
  const cloudMaterial = new THREE.ShaderMaterial({
    vertexShader: cloudsVertexShader,
    fragmentShader: cloudsFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uSunDirection: { value: sunDirection }
    },
    transparent: true,
    depthWrite: false
  })
  
  const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial)
  planetGroup.add(clouds)
  
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
  // Place it far out, orbit radius
  const moonOrbitRadius = radius * 3.5
  moon.position.set(moonOrbitRadius, 100, -200)
  
  // Create a pivot for the moon to orbit the planet
  const moonPivot = new THREE.Group()
  moonPivot.add(moon)
  // Tilt the orbit slightly
  moonPivot.rotation.z = Math.PI / 12
  planetGroup.add(moonPivot)
  
  scene.add(planetGroup)
  
  const update = (time: number) => {
    surface.rotation.y = time * 0.05
    clouds.rotation.y = time * 0.07 
    moon.rotation.y = time * 0.1 
    moonPivot.rotation.y = time * 0.02 // slow orbit around planet
    
    surfaceMaterial.uniforms.uTime.value = time
    cloudMaterial.uniforms.uTime.value = time
    moonMaterial.uniforms.uTime.value = time * 1.5 // Moon surface changes slightly if procedural
  }
  
  const cleanup = () => {
    geometry.dispose()
    surfaceMaterial.dispose()
    atmosphereGeometry.dispose()
    atmosphereMaterial.dispose()
    cloudGeometry.dispose()
    cloudMaterial.dispose()
    moonGeometry.dispose()
    moonMaterial.dispose()
    scene.remove(planetGroup)
  }
  
  return {
    planetGroup,
    update,
    cleanup
  }
}
