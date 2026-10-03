import { snoise3 } from '../utils/glsl-noise'

export const planetVertexShader = `
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vPositionWorld;

void main() {
  vUv = uv;
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
varying vec3 vPositionWorld;

${snoise3}

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 sunDir = normalize(uSunDirection); // Assumed to be world space

  vec3 noisePos = normal * 3.5 + uTime * 0.02;
  float noiseVal = fbm(noisePos);
  
  // Add micro detail for close approach
  float microNoise = fbm(noisePos * 5.0);
  noiseVal += microNoise * 0.2;
  
  vec3 deepOcean = vec3(0.02, 0.05, 0.1);
  vec3 shallowOcean = vec3(0.05, 0.15, 0.25);
  vec3 landDark = vec3(0.1, 0.1, 0.12);
  vec3 landLight = vec3(0.2, 0.22, 0.25);
  
  vec3 color = vec3(0.0);
  
  if (noiseVal < 0.0) {
    float t = smoothstep(-1.0, 0.0, noiseVal);
    color = mix(deepOcean, shallowOcean, t);
  } else {
    float t = smoothstep(0.0, 1.0, noiseVal);
    color = mix(landDark, landLight, t);
  }

  float diffuse = max(dot(normal, sunDir), 0.0);
  float terminator = smoothstep(-0.2, 0.2, dot(normal, sunDir));
  
  vec3 ambient = color * 0.05;
  vec3 finalColor = color * diffuse * 1.5 + ambient;
  
  // Fake glowing cities
  if (noiseVal > 0.1 && terminator < 0.1) {
    float cityNoise = fbm(normal * 15.0);
    if (cityNoise > 0.4) {
      finalColor += vec3(1.0, 0.8, 0.4) * (1.0 - terminator) * (cityNoise - 0.4) * 2.0;
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
  
  // cameraPosition is built-in in threejs when using ShaderMaterial
  vec3 viewDir = normalize(cameraPosition - vPositionWorld);
  
  // Rim lighting using a sharper fresnel
  float fresnel = max(1.0 - dot(normal, viewDir), 0.0);
  float intensity = pow(fresnel, 5.0) * 0.9;
  
  float sunFacing = max(dot(normal, sunDir), 0.0);
  float terminator = smoothstep(-0.2, 0.4, dot(normal, sunDir));
  
  // Stronger near sun, subtle on terminator, almost none on dark side
  float atmosphereGlow = intensity * (sunFacing * 1.5 + terminator * 0.4 + 0.05); 
  
  gl_FragColor = vec4(uAtmosphereColor, atmosphereGlow);
}
`

export const cloudsVertexShader = `
varying vec2 vUv;
varying vec3 vNormalWorld;

void main() {
  vUv = uv;
  vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const cloudsFragmentShader = `
uniform vec3 uSunDirection;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalWorld;

${snoise3}

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 sunDir = normalize(uSunDirection);

  vec3 noisePos = normal * 4.0 + uTime * 0.01;
  float noiseVal = fbm(noisePos);
  
  float cloudDensity = smoothstep(0.2, 0.8, noiseVal);
  
  float diffuse = max(dot(normal, sunDir), 0.0);
  float terminator = smoothstep(-0.1, 0.2, dot(normal, sunDir));
  
  vec3 cloudColor = vec3(0.9, 0.95, 1.0) * diffuse * 1.5;
  cloudColor += vec3(0.05, 0.05, 0.1) * (1.0 - terminator);
  
  gl_FragColor = vec4(cloudColor, cloudDensity * 0.8);
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
