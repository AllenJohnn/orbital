export const solarVertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const solarFragmentShader = `
uniform vec3 uStarColor;
uniform float uTime;
uniform float uCoronaStrength;
uniform float uGranulationStrength;
uniform float uFlareStrength;
varying vec2 vUv;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float radius = length(p);
  if (radius > 1.0) discard;

  float angle = atan(p.y, p.x);
  float photosphere = 1.0 - smoothstep(0.29, 0.315, radius);
  float granulation = valueNoise(p * 58.0 + vec2(uTime * 0.07, -uTime * 0.04)) - 0.5;
  granulation += (valueNoise(p * 131.0 - uTime * 0.025) - 0.5) * 0.35;
  float limbDarkening = 1.0 - smoothstep(0.04, 0.31, radius) * 0.36;
  vec3 stellarDisk = uStarColor * photosphere * limbDarkening *
    (0.94 + granulation * uGranulationStrength);

  float coronaBand = smoothstep(0.25, 0.34, radius) * exp(-max(radius - 0.3, 0.0) * 4.8);
  float coronaPulse = 0.82 + 0.18 * sin(uTime * 0.42);
  float rayShape = pow(max(cos(angle * 7.0 + sin(angle * 3.0 + uTime * 0.08) * 0.3), 0.0), 22.0);
  float flarePulse = pow(max(sin(uTime * 0.115 + 1.1), 0.0), 18.0) * uFlareStrength;
  float softFlare = rayShape * flarePulse * exp(-max(radius - 0.29, 0.0) * 3.2);

  vec3 coronaColor = mix(uStarColor, vec3(1.0, 0.76, 0.46), 0.42);
  vec3 corona = coronaColor * coronaBand * coronaPulse * uCoronaStrength;
  corona += vec3(1.0, 0.72, 0.4) * softFlare * uCoronaStrength;
  vec3 color = stellarDisk + corona;
  float alpha = clamp(max(photosphere, max(coronaBand * uCoronaStrength, softFlare * uCoronaStrength)), 0.0, 1.0);
  gl_FragColor = vec4(color, alpha);
}
`

export const milkyWayVertexShader = `
varying vec3 vSkyDirection;

void main() {
  vSkyDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const milkyWayFragmentShader = `
uniform float uOpacity;
varying vec3 vSkyDirection;

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
  float z0 = mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y);
  float z1 = mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y);
  return mix(z0, z1, f.z);
}

float tpdfDither(vec2 pixel) {
  vec2 p = floor(pixel);
  float a = fract(sin(dot(p + vec2(19.19, 73.17), vec2(12.9898, 78.233))) * 43758.5453);
  float b = fract(sin(dot(p + vec2(47.11, 11.73), vec2(39.3468, 11.135))) * 24634.6345);
  return (a - b) * (1.0 / 255.0);
}

void main() {
  vec3 direction = normalize(vSkyDirection);
  vec3 bandNormal = normalize(vec3(0.27, 0.88, -0.39));
  float latitude = abs(dot(direction, bandNormal));
  float band = exp(-pow(latitude / 0.19, 2.0));
  float largeClouds = valueNoise3(direction * vec3(7.0, 24.0, 7.0) + 4.1);

#ifdef MILKYWAY_LOW_QUALITY
  float density = band * (0.5 + largeClouds * 0.42);
#else
  float wisps = valueNoise3(direction * vec3(19.0, 62.0, 19.0) - 2.8);
  float dustLane = smoothstep(0.47, 0.78,
    valueNoise3(direction * vec3(5.0, 39.0, 5.0) + vec3(4.0, 1.0, -3.0)));
  float density = band * (0.32 + largeClouds * 0.46 + wisps * 0.22) * (1.0 - dustLane * 0.56);
#endif

  float warmDust = smoothstep(-0.25, 0.65, direction.x - direction.z * 0.4);
  vec3 nebulaColor = mix(vec3(0.2, 0.31, 0.48), vec3(0.48, 0.31, 0.23), warmDust);
  nebulaColor += vec3(tpdfDither(gl_FragCoord.xy));
  float alpha = clamp(density * uOpacity, 0.0, 0.24);
  gl_FragColor = vec4(nebulaColor * alpha, alpha);
}
`
