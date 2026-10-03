import { snoise3 } from '../utils/glsl-noise'

export const planetVertexShader = `
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vNormalLocal;
varying vec3 vPositionWorld;

void main() {
  vUv = uv;
  vNormalLocal = normalize(normal);
  vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vPositionWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPositionWorld, 1.0);
}
`

export const planetFragmentShader = `
uniform vec3 uSunDirection;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vNormalLocal;
varying vec3 vPositionWorld;

${snoise3}

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 localNormal = normalize(vNormalLocal);
  vec3 sunDir = normalize(uSunDirection); // World space

  // Base continental structure (low frequency)
  float continentNoise = fbm(localNormal * 1.5);
  // Medium frequency for coastlines and terrain
  float terrainNoise = fbm(localNormal * 4.0);
  // High frequency for mountains/details
  float detailNoise = fbm(localNormal * 12.0);
  
  // Combine for final elevation map
  // Domain warping to make coastlines look organic
  vec3 warp = vec3(fbm(localNormal * 3.0), fbm(localNormal * 3.0 + vec3(5.2, 1.3, -2.1)), 0.0);
  float elevation = fbm(localNormal * 2.0 + warp * 0.5);
  elevation += terrainNoise * 0.3;
  elevation += detailNoise * 0.1;

  // Biome Colors
  vec3 deepOcean = vec3(0.01, 0.02, 0.05);
  vec3 shallowOcean = vec3(0.04, 0.09, 0.15);
  vec3 coastline = vec3(0.08, 0.12, 0.14);
  vec3 lowland = vec3(0.12, 0.14, 0.11);
  vec3 highland = vec3(0.15, 0.13, 0.11);
  vec3 mountainDark = vec3(0.18, 0.18, 0.18);
  vec3 mountainSnow = vec3(0.35, 0.35, 0.37);
  
  vec3 albedo = vec3(0.0);
  float roughness = 1.0;
  float isLand = 0.0;
  
  // Sea level threshold
  float seaLevel = 0.15;
  
  if (elevation < seaLevel) {
    // Ocean
    float depth = smoothstep(seaLevel - 0.2, seaLevel, elevation);
    albedo = mix(deepOcean, shallowOcean, depth);
    roughness = 0.1; // Oceans are smooth/specular
  } else {
    // Land
    isLand = 1.0;
    roughness = 0.8;
    float h = smoothstep(seaLevel, seaLevel + 0.5, elevation);
    
    if (h < 0.1) {
      albedo = mix(coastline, lowland, smoothstep(0.0, 0.1, h));
    } else if (h < 0.5) {
      albedo = mix(lowland, highland, smoothstep(0.1, 0.5, h));
    } else if (h < 0.8) {
      albedo = mix(highland, mountainDark, smoothstep(0.5, 0.8, h));
    } else {
      albedo = mix(mountainDark, mountainSnow, smoothstep(0.8, 1.0, h));
    }
  }

  // Lighting
  float diffuse = max(dot(normal, sunDir), 0.0);
  float terminator = smoothstep(-0.2, 0.1, dot(normal, sunDir)); // Soft transition
  
  // Specular for ocean
  vec3 viewDir = normalize(cameraPosition - vPositionWorld);
  vec3 halfVector = normalize(sunDir + viewDir);
  float specular = 0.0;
  if (isLand < 0.5 && diffuse > 0.0) {
    float specAngle = max(dot(normal, halfVector), 0.0);
    specular = pow(specAngle, 128.0) * 0.8; // Ocean glint
  }
  
  vec3 ambient = albedo * 0.02;
  vec3 finalColor = albedo * diffuse * 1.5 + vec3(specular) + ambient;
  
  // Night-side City Lights
  // Only on land, primarily in lowlands/coastlines, and on the dark side
  float cityVisibility = smoothstep(0.1, -0.1, terminator);
  if (isLand > 0.5 && cityVisibility > 0.0) {
    // Generate city clusters using high frequency noise
    float cityCluster = fbm(localNormal * 8.0);
    float cityDetail = fbm(localNormal * 35.0);
    
    // Cities prefer lower elevations
    float popDensity = smoothstep(seaLevel + 0.3, seaLevel, elevation);
    
    if (cityCluster > 0.4 && cityDetail > 0.5 && popDensity > 0.1) {
      // Warm tungsten/sodium light colors
      vec3 lightColor = mix(vec3(1.0, 0.8, 0.5), vec3(0.8, 0.9, 1.0), fbm(localNormal * 50.0));
      float lightIntensity = (cityDetail - 0.5) * 3.0 * popDensity * cityVisibility;
      finalColor += lightColor * lightIntensity;
    }
  }

  gl_FragColor = vec4(finalColor, 1.0);
}
`

export const atmosphereVertexShader = `
varying vec3 vNormalWorld;
varying vec3 vPositionWorld;

void main() {
  vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vPositionWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPositionWorld, 1.0);
}
`

export const atmosphereFragmentShader = `
uniform vec3 uSunDirection;
uniform vec3 uAtmosphereColor;
varying vec3 vNormalWorld;
varying vec3 vPositionWorld;

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 sunDir = normalize(uSunDirection);
  vec3 viewDir = normalize(cameraPosition - vPositionWorld);
  
  // Fresnel for rim calculation
  float fresnel = max(1.0 - dot(normal, viewDir), 0.0);
  
  // 1. Core Rim (very tight to the edge)
  float rim = pow(fresnel, 12.0) * 1.2;
  
  // 2. Broad Scatter (extremely subtle)
  float scatter = pow(fresnel, 4.0) * 0.2;
  
  float intensity = rim + scatter;
  
  // Modulate by sun lighting
  float sunFacing = max(dot(normal, sunDir), 0.0);
  float terminator = dot(normal, sunDir);
  
  // Sunset scattering tint at the terminator (Rayleigh scattering effect)
  vec3 sunsetColor = vec3(1.0, 0.4, 0.15); // Deep orange/red
  vec3 scatterColor = mix(sunsetColor, uAtmosphereColor, smoothstep(-0.2, 0.4, terminator));
  
  // Final glow strength
  // Night side is almost completely dark, just a whisper of a rim
  float atmosphereGlow = intensity * (sunFacing * 1.8 + 0.015); 
  
  gl_FragColor = vec4(scatterColor, atmosphereGlow);
}
`

export const cloudsVertexShader = `
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vNormalLocal;

void main() {
  vUv = uv;
  vNormalLocal = normalize(normal);
  vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const cloudsFragmentShader = `
uniform vec3 uSunDirection;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vNormalLocal;

${snoise3}

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 localNormal = normalize(vNormalLocal);
  vec3 sunDir = normalize(uSunDirection);

  // Evolve clouds very slowly over time
  vec3 noisePos = localNormal * 3.0 + uTime * 0.005;
  
  // Layered noise for cloud formations
  float largeClouds = fbm(noisePos);
  float mediumClouds = fbm(noisePos * 4.0 + vec3(1.2, -0.5, 2.1));
  float wispyClouds = fbm(noisePos * 12.0);
  
  // Domain warping for swirling hurricane-like shapes
  vec3 warp = vec3(fbm(noisePos * 2.0), fbm(noisePos * 2.0 + vec3(5.1)), 0.0);
  float cloudBase = fbm(noisePos + warp * 0.8);
  
  // Combine layers
  float density = cloudBase * 0.6 + largeClouds * 0.3 + mediumClouds * 0.2 - wispyClouds * 0.1;
  
  // Soft thresholds for natural edge transparency
  float coverage = smoothstep(0.4, 0.7, density);
  float thickClouds = smoothstep(0.6, 0.9, density);
  
  // Lighting
  float diffuse = max(dot(normal, sunDir), 0.0);
  float terminator = smoothstep(-0.2, 0.2, dot(normal, sunDir));
  
  // Color formulation
  vec3 cloudLit = vec3(0.95, 0.98, 1.0);
  // Give clouds on the terminator a sunset/orange scatter tint
  vec3 cloudSunset = vec3(1.0, 0.7, 0.6);
  vec3 cloudDark = vec3(0.05, 0.08, 0.15); // Night side
  
  vec3 baseColor = mix(cloudSunset, cloudLit, smoothstep(0.0, 0.3, terminator));
  vec3 cloudColor = baseColor * diffuse * 1.2;
  cloudColor += cloudDark * (1.0 - terminator) * 0.2; // Subtle ambient on night side
  
  // Self-shadowing: thicker clouds are slightly darker at their core when lit directly
  cloudColor -= thickClouds * diffuse * 0.2;
  
  gl_FragColor = vec4(cloudColor, coverage * 0.85); // Never 100% opaque to maintain atmospheric feel
}
`

export const moonFragmentShader = `
uniform vec3 uSunDirection;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalWorld;

${snoise3}

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 sunDir = normalize(uSunDirection);

  vec3 noisePos = normal * 5.0 + uTime * 0.005;
  float noiseVal = fbm(noisePos);
  
  // Crater/barren rock colors
  vec3 rockDark = vec3(0.15, 0.15, 0.15);
  vec3 rockLight = vec3(0.3, 0.3, 0.3);
  
  float t = smoothstep(0.0, 1.0, noiseVal);
  vec3 color = mix(rockDark, rockLight, t);

  float diffuse = max(dot(normal, sunDir), 0.0);
  
  vec3 ambient = color * 0.02;
  vec3 finalColor = color * diffuse * 1.5 + ambient;

  gl_FragColor = vec4(finalColor, 1.0);
}
`
