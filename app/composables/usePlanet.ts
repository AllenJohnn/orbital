import * as THREE from 'three'
import { planetVertexShader, planetFragmentShader, atmosphereVertexShader, atmosphereFragmentShader, cloudsVertexShader, cloudsFragmentShader } from '../shaders/planetShaders'

export const usePlanet = (scene: THREE.Scene) => {
  const planetGroup = new THREE.Group()
  
  // Place planet far away initially
  planetGroup.position.set(0, 0, -2500)
  
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
      uAtmosphereColor: { value: new THREE.Color(0x4a8eff) } // Blueish atmosphere
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
  
  scene.add(planetGroup)
  
  const update = (time: number) => {
    // Transform sun direction to view space if we want atmosphere to react correctly,
    // but in our shader we used it simply.
    // For rotation, we just rotate the planet meshes slowly.
    surface.rotation.y = time * 0.05
    clouds.rotation.y = time * 0.07 // clouds move slightly faster
    
    // Update shader uniforms
    surfaceMaterial.uniforms.uTime.value = time
    cloudMaterial.uniforms.uTime.value = time
  }
  
  const cleanup = () => {
    geometry.dispose()
    surfaceMaterial.dispose()
    atmosphereGeometry.dispose()
    atmosphereMaterial.dispose()
    cloudGeometry.dispose()
    cloudMaterial.dispose()
    scene.remove(planetGroup)
  }
  
  return {
    planetGroup,
    update,
    cleanup
  }
}
