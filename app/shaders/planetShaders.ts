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

// --------------------------------------------------------
// NOISE & GEOMETRY UTILITIES
// --------------------------------------------------------
vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
}

// Returns: x = dist, y = cell hash, z = vec.x, w = vec.y
vec4 voronoiCrater(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    float res = 8.0;
    float cellHash = 0.0;
    vec3 closestR = vec3(0.0);
    
    for(int k=-1; k<=1; k++)
    for(int j=-1; j<=1; j++)
    for(int i=-1; i<=1; i++) {
        vec3 b = vec3(float(i), float(j), float(k));
        vec3 h = hash33(p + b);
        vec3 r = vec3(b) - f + h;
        float d = dot(r, r);
        if(d < res) {
            res = d;
            cellHash = h.x;
            closestR = r;
        }
    }
    return vec4(sqrt(res), cellHash, closestR.x, closestR.y);
}

// Returns: x = F1, y = F2, z = cellHash
vec3 voronoiTectonic(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    float res1 = 8.0;
    float res2 = 8.0;
    float hash1 = 0.0;
    
    for(int k=-1; k<=1; k++)
    for(int j=-1; j<=1; j++)
    for(int i=-1; i<=1; i++) {
        vec3 b = vec3(float(i), float(j), float(k));
        vec3 h = hash33(p + b);
        vec3 r = vec3(b) - f + h;
        float d = dot(r, r);
        if(d < res1) {
            res2 = res1;
            res1 = d;
            hash1 = h.x;
        } else if(d < res2) {
            res2 = d;
        }
    }
    return vec3(sqrt(res1), sqrt(res2), hash1);
}

float ridgedNoise(vec3 p) {
  return 1.0 - abs(snoise(p));
}
float ridgedFBM(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  vec3 shift = vec3(100.0);
  for (int i = 0; i < 5; ++i) {
    v += a * ridgedNoise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// --------------------------------------------------------
// GEOLOGICAL FORMATIONS
// --------------------------------------------------------

float getImpactBasin(vec3 p, float scale, float probability, float depthMult) {
    // Warp the input position slightly to make craters asymmetrical and organic
    vec3 warpedP = p * scale + vec3(fbm(p * scale * 3.0), fbm(p * scale * 3.0 + 1.5), 0.0) * 0.15;
    vec4 v = voronoiCrater(warpedP);
    float dist = v.x;
    float hash = v.y;
    
    float elevation = 0.0;
    if (hash > 1.0 - probability) {
        float radius = mix(0.15, 0.45, (hash - (1.0 - probability)) / probability);
        float normalizedDist = dist / radius;
        
        if (normalizedDist < 2.5) {
            // Raised Rim with fractured edges (noise)
            float rimNoise = 1.0 + fbm(p * scale * 8.0) * 0.4;
            float rim = smoothstep(0.6, 1.0, normalizedDist) * smoothstep(1.5 * rimNoise, 1.0, normalizedDist);
            
            // Deep Floor
            float floor = smoothstep(0.1, 0.9, normalizedDist);
            
            // Central Peak (rebound) - varies by hash
            float peak = smoothstep(0.25, 0.0, normalizedDist) * mix(0.1, 0.6, fract(hash * 13.0));
            
            // Radial Ejecta & Secondary impacts (ejecta blanket)
            float angle = atan(v.w, v.z);
            float rays = max(0.0, sin(angle * 12.0 + fbm(p * scale * 5.0) * 2.0));
            float ejectaBlanket = rays * smoothstep(2.5, 1.0, normalizedDist) * 0.15;
            
            elevation = rim * 0.8 * rimNoise - (1.0 - floor) * depthMult + peak + ejectaBlanket;
        }
    }
    return elevation;
}

float getImpactHistory(vec3 p) {
    // 4-Tier Hierarchy: Mega, Large, Medium, Small
    float basins = getImpactBasin(p, 1.2, 0.08, 1.5);    // Mega basins (very rare, huge impact, deep)
    basins += getImpactBasin(p, 3.5, 0.15, 0.8) * 0.6;   // Large basins
    basins += getImpactBasin(p, 8.0, 0.25, 0.5) * 0.25;  // Medium craters
    basins += getImpactBasin(p, 20.0, 0.35, 0.3) * 0.1;  // Small crater fields
    return basins;
}

// Master Elevation Function (Distance-Aware LOD)
float getElevation(vec3 p, float distToCam) {
  // Domain warping for organic shapes
  vec3 warp = vec3(fbm(p * 1.2), fbm(p * 1.2 + vec3(5.2)), fbm(p * 1.2 + vec3(1.3)));
  
  // 1. MACRO: Continental Plates & Oceans (Low Frequency, High Amplitude)
  float continents = snoise(p * 0.8 + warp * 0.5); // -1 to 1
  float baseTerrain = continents * 0.5 + 0.5; // 0 to 1
  
  // 2. REGIONAL: Tectonics, Mountain Belts, and Canyons
  float tectonicElevation = 0.0;
  float mountainMask = 0.0;
  
  // Optimize: Only evaluate complex tectonics and ridged FBM if closer than far orbit
  if (distToCam < 4000.0) {
      vec3 tec = voronoiTectonic(p * 1.4 + warp * 0.2);
      float boundaryDist = tec.y - tec.x; 
      float faultType = tec.z;
      
      float faultLine = 1.0 - smoothstep(0.0, 0.2, boundaryDist); // Wider fault zone
      
      if (faultType > 0.4) {
          // Convergent: Mountain Range along the tectonic plate
          mountainMask = faultLine * smoothstep(0.1, 0.9, fbm(p * 2.5)); 
          // Fade higher frequencies at distance to prevent aliased noise
          float peakFade = smoothstep(4000.0, 1500.0, distToCam);
          float peaks = ridgedFBM(p * 4.0) * 0.6 + ridgedFBM(p * 8.0) * 0.4 * peakFade;
          tectonicElevation += mountainMask * peaks * 0.4;
      } else {
          // Divergent: Rift Valley
          float canyonMask = faultLine * smoothstep(0.2, 0.8, fbm(p * 3.0));
          tectonicElevation -= canyonMask * 0.25;
      }
  }
  
  // 3. IMPACT HISTORY (Macro & Regional)
  float basins = getImpactHistory(p); // Internal hierarchy naturally handles visual scale
  
  // Combine Macro & Regional
  float elevation = baseTerrain * 0.35 + 0.4; // Base height mapping
  elevation += tectonicElevation;
  elevation += basins * 0.25;
  
  // 4. LOCAL DETAIL (Evaluated only when moderately close)
  if (distToCam < 1500.0) {
      float localDetailMask = smoothstep(0.4, 0.8, continents) + mountainMask * 0.5;
      localDetailMask = clamp(localDetailMask, 0.1, 1.0);
      float localDetail = fbm(p * 12.0) * 0.03;
      if (distToCam < 500.0) {
          localDetail += fbm(p * 24.0) * 0.015 * smoothstep(500.0, 100.0, distToCam);
      }
      elevation += localDetail * localDetailMask * smoothstep(1500.0, 300.0, distToCam);
  }
  
  // 5. MICRO DETAIL (Evaluated only at very close atmospheric entry)
  if (distToCam < 100.0) {
      float microDetail = (snoise(p * 80.0) + snoise(p * 150.0) * 0.5) * 0.003;
      elevation += microDetail * smoothstep(100.0, 10.0, distToCam);
  }
  
  return elevation;
}

// Surface Elevation Function (Handles Water Level & Waves)
float getSurfaceElevation(vec3 p, float distToCam) {
  float e = getElevation(p, distToCam);
  float seaLevel = 0.42;
  if (e < seaLevel) {
    // Water surface: low-frequency swell + high-frequency micro ripples
    float swell = snoise(p * 25.0 + uTime * 0.01) * 0.0015;
    float ripples = 0.0;
    if (distToCam < 200.0) {
       ripples = fbm(p * 150.0 + uTime * 0.03) * 0.0005 * smoothstep(200.0, 30.0, distToCam);
    }
    return seaLevel + swell + ripples;
  }
  return e;
}

void main() {
  vec3 localNormal = normalize(vNormalLocal);
  vec3 sunDir = normalize(uSunDirection);
  
  vec3 viewOffset = cameraPosition - vPositionWorld;
  float distToCam = length(viewOffset);
  vec3 viewDir = normalize(viewOffset);

  // Evaluate terrain elevation for biome logic
  float terrainElevation = getElevation(localNormal, distToCam);
  // Evaluate actual surface elevation for bump mapping
  float surfaceElevation = getSurfaceElevation(localNormal, distToCam);
  
  // --------------------------------------------------------
  // GEOLOGICAL BUMP MAPPING (Normal Perturbation)
  // --------------------------------------------------------
  // Dynamic EPS scales with distance. Close = high res normals, Far = macro normals (anti-aliasing)
  float eps = mix(0.0005, 0.02, smoothstep(10.0, 3000.0, distToCam)); 
  
  vec3 worldNormal = normalize(vNormalWorld);
  // Construct tangent basis in world space
  vec3 wt1 = normalize(cross(worldNormal, vec3(0.0, 1.0, 0.0)));
  if (length(wt1) < 0.1) wt1 = normalize(cross(worldNormal, vec3(1.0, 0.0, 0.0)));
  vec3 wt2 = normalize(cross(worldNormal, wt1));
  
  // Sample neighbors in local space to find the gradient
  vec3 lt1 = normalize(cross(localNormal, vec3(0.0, 1.0, 0.0)));
  if (length(lt1) < 0.1) lt1 = normalize(cross(localNormal, vec3(1.0, 0.0, 0.0)));
  vec3 lt2 = normalize(cross(localNormal, lt1));
  
  float e1 = getSurfaceElevation(normalize(localNormal + lt1 * eps), distToCam);
  float e2 = getSurfaceElevation(normalize(localNormal + lt2 * eps), distToCam);
  
  // Bump strength slightly reduces at distance to prevent harsh terminator shadows on a planetary scale
  float bumpStrength = mix(5.0, 1.5, smoothstep(100.0, 4000.0, distToCam)); 
  vec3 finalNormal = normalize(worldNormal - wt1 * (e1 - surfaceElevation) / eps * bumpStrength 
                                           - wt2 * (e2 - surfaceElevation) / eps * bumpStrength);

  // --------------------------------------------------------
  // MACRO BIOME DISTRIBUTION (The Planetary DNA)
  // --------------------------------------------------------
  // Optimized warp (1 FBM call instead of 2)
  float globalWarp = fbm(localNormal * 0.6);
  vec3 biomeWarp = vec3(globalWarp, globalWarp * 1.2, 0.0);
  
  // MARS: Iron/Arid World
  float mineralMask = smoothstep(0.2, 0.7, snoise(localNormal * 0.8 + biomeWarp + vec3(14.5)));
  // SATURN: Pale Golden Geology
  float goldenMask = smoothstep(0.3, 0.8, snoise(localNormal * 0.9 - biomeWarp + vec3(5.5)));
  // ICE CAPS (Use simple snoise instead of FBM to save instructions)
  float coldMask = smoothstep(0.65, 0.95, abs(localNormal.y) + snoise(localNormal * 3.0) * 0.15);
  
  float seaLevel = 0.42;
  vec3 albedo = vec3(0.0);
  float isLand = 0.0;
  float specular = 0.0;
  float diffuse = max(dot(finalNormal, sunDir), 0.0);
  
  if (terrainElevation < seaLevel) {
    // --------------------------------------------------------
    // EARTH: Deep Oceans & Shallow Coastlines
    // --------------------------------------------------------
    float depth = smoothstep(seaLevel - 0.15, seaLevel, terrainElevation);
    float shoreLine = smoothstep(seaLevel - 0.02, seaLevel, terrainElevation); // 0 in deep, 1 at shore
    
    // Darker, more cinematic alien ocean colors
    vec3 waterDeep = vec3(0.002, 0.015, 0.04);
    vec3 waterShallow = vec3(0.01, 0.08, 0.12);
    vec3 waterCoastal = vec3(0.08, 0.22, 0.28); // Sediment/turquoise transition
    
    // Massive atmospheric/chemical bands in the deep ocean
    float band = snoise(vec3(localNormal.y * 5.0, localNormal.x * 2.5, 0.0)) * 0.04;
    waterDeep += band;
    
    vec3 waterBase = mix(waterDeep, waterShallow, depth);
    albedo = mix(waterBase, waterCoastal, shoreLine);
    
    // Fresnel response (Water reflects the sky at grazing angles)
    float waterFresnel = max(1.0 - dot(finalNormal, viewDir), 0.0);
    waterFresnel = pow(waterFresnel, 4.0);
    vec3 skyReflection = vec3(0.3, 0.5, 0.8) * diffuse; // Reflecting the lit atmosphere
    albedo = mix(albedo, skyReflection, waterFresnel * 0.7);
    
    // Crisp ocean specular glint
    vec3 halfVector = normalize(sunDir + viewDir);
    float specAngle = max(dot(finalNormal, halfVector), 0.0);
    // Dynamic roughness based on depth (coastlines are rougher/frothy, deep ocean is smoother)
    float specPower = mix(150.0, 50.0, depth);
    specular = pow(specAngle, specPower) * mix(1.8, 0.8, depth);
  } else {
    // --------------------------------------------------------
    // LAND GEOLOGY
    // --------------------------------------------------------
    isLand = 1.0;
    float h = smoothstep(seaLevel, 1.0, terrainElevation);
    
    // Biome 1: Mars (Iron / Rust / Basalt)
    vec3 marsLow = vec3(0.45, 0.18, 0.10);
    vec3 marsHigh = vec3(0.25, 0.08, 0.04);
    vec3 marsCol = mix(marsLow, marsHigh, h);
    
    // Biome 2: Pale Mineral Highlands (Gold / Cream)
    vec3 goldLow = vec3(0.60, 0.50, 0.35);
    vec3 goldHigh = vec3(0.75, 0.65, 0.50);
    vec3 goldCol = mix(goldLow, goldHigh, h);
    
    // Biome 3: Dark Alien Rock (Charcoal / Deep Brown)
    vec3 alienLow = vec3(0.10, 0.09, 0.08);
    vec3 alienHigh = vec3(0.18, 0.16, 0.15);
    vec3 alienCol = mix(alienLow, alienHigh, h);
    
    float landSpec = 0.0;
    
    // Combine Biomes
    albedo = alienCol;
    landSpec = 0.05; 
    
    albedo = mix(albedo, goldCol, goldenMask);
    landSpec = mix(landSpec, 0.15, goldenMask); // Pale minerals are slightly more reflective
    
    albedo = mix(albedo, marsCol, mineralMask); // Mars overrides Gold
    landSpec = mix(landSpec, 0.01, mineralMask); // Iron desert is very matte
    
    // Coastal sand/sediment
    vec3 coastLine = mix(vec3(0.25, 0.22, 0.18), vec3(0.1, 0.05, 0.02), mineralMask);
    float isCoast = smoothstep(seaLevel + 0.04, seaLevel, terrainElevation);
    albedo = mix(albedo, coastLine, isCoast);
    landSpec = mix(landSpec, 0.1, isCoast); // Wet sand is slightly specular
    
    // Polar Ice
    vec3 ice = vec3(0.82, 0.88, 0.95);
    float isIce = coldMask * smoothstep(seaLevel + 0.02, seaLevel + 0.2, terrainElevation);
    albedo = mix(albedo, ice, isIce);
    landSpec = mix(landSpec, 0.8, isIce); // Ice is highly reflective
    
    // Calculate land specular
    vec3 halfVector = normalize(sunDir + viewDir);
    float specAngle = max(dot(finalNormal, halfVector), 0.0);
    // Ice has sharper highlights (higher power), rock is broad
    float specPower = mix(15.0, 60.0, isIce);
    specular = pow(specAngle, specPower) * landSpec;
  }

  // --------------------------------------------------------
  // LIGHTING & ATMOSPHERIC SCATTERING ON SURFACE
  // --------------------------------------------------------
  // Base diffuse and ambient
  vec3 ambient = albedo * 0.02; // Very subtle base ambient
  vec3 finalColor = albedo * diffuse * 1.5 + vec3(specular) + ambient;
  
  // Calculate view-dependent fresnel for atmospheric scattering on the surface
  float fresnel = max(1.0 - dot(worldNormal, viewDir), 0.0);
  float terminator = dot(worldNormal, sunDir);
  
  // Warm / Red / Orange illumination on the sun-facing limb
  vec3 warmScatter = vec3(1.0, 0.45, 0.15); // Deep orange/red
  // Broader, stronger scattering on the daylight side to restore the physical warm glaze
  float warmMask = pow(fresnel, 2.5) * smoothstep(-0.2, 0.6, terminator);
  finalColor += warmScatter * warmMask * 0.8;
  
  // Cool / Blue atmospheric scattering on the grazing angles near the terminator / night
  vec3 coolScatter = vec3(0.15, 0.4, 0.9);
  float coolMask = pow(fresnel, 4.0) * smoothstep(0.2, -0.6, terminator);
  finalColor += coolScatter * coolMask * 0.4;
  
  // Subtle night-side environmental fill (so dark side isn't pure black, preserving terrain readability)
  vec3 nightAmbient = albedo * vec3(0.04, 0.06, 0.1); 
  finalColor += nightAmbient * (1.0 - max(terminator, 0.0)) * 0.5;
  
  // --------------------------------------------------------
  // ANCIENT CITY LIGHTS (Points of Interest Foundation)
  // --------------------------------------------------------
  float cityVisibility = smoothstep(0.1, -0.1, terminator);
  
  if (isLand > 0.5 && cityVisibility > 0.0 && coldMask < 0.2) {
    float cityCluster = fbm(localNormal * 8.0);
    float cityDetail = fbm(localNormal * 35.0);
    
    float popDensity = smoothstep(seaLevel + 0.3, seaLevel, terrainElevation);
    popDensity *= (1.0 - mineralMask * 0.7); 
    
    if (cityCluster > 0.45 && cityDetail > 0.5 && popDensity > 0.1) {
      vec3 lightColor = mix(vec3(0.4, 0.8, 1.0), vec3(0.9, 0.6, 0.2), fbm(localNormal * 50.0));
      float lightIntensity = (cityDetail - 0.5) * 3.5 * popDensity * cityVisibility;
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
  
  vec3 viewOffset = cameraPosition - vPositionWorld;
  float distToCam = length(viewOffset);
  vec3 viewDir = normalize(viewOffset);
  
  // Ensure normal always faces camera to support DoubleSide rendering when inside the atmosphere
  vec3 faceNormal = dot(normal, viewDir) > 0.0 ? normal : -normal;
  
  // Fresnel for rim calculation
  float fresnel = max(1.0 - dot(faceNormal, viewDir), 0.0);
  
  // 1. Core Rim (very tight to the edge)
  float rim = pow(fresnel, 12.0) * 1.2;
  
  // 2. Broad Scatter (subtle haze, stronger when inside the atmosphere)
  float insideFactor = 1.0 - smoothstep(100.0, 600.0, distToCam);
  float scatter = pow(fresnel, mix(4.0, 1.5, insideFactor)) * mix(0.2, 0.4, insideFactor);
  
  float intensity = rim + scatter;
  
  // Lighting Angles
  float sunFacing = max(dot(normal, sunDir), 0.0);
  float terminator = dot(normal, sunDir); // 1.0 at noon, 0.0 at sunset, -1.0 at midnight
  
  // Separate warm day-side scattering from cool night-side scattering
  vec3 sunsetColor = vec3(1.0, 0.45, 0.15); // Deep orange/red
  vec3 dayHaze = vec3(1.0, 0.9, 0.8);       // Warm, transparent haze for direct sun
  vec3 nightBlue = uAtmosphereColor;        // Deep space blue
  
  vec3 scatterColor;
  if (terminator > 0.1) {
      // Day side: Sunset orange near terminator fading to subtle warm haze at noon
      scatterColor = mix(sunsetColor, dayHaze, smoothstep(0.1, 0.8, terminator));
  } else {
      // Night side: Deep blue fading to sunset orange at the terminator
      scatterColor = mix(nightBlue, sunsetColor, smoothstep(-0.4, 0.1, terminator));
  }
  
  // Reduce additive glow intensity on the direct day side so the terrain's physical warmth is not washed out
  float dayOpacity = mix(1.0, 0.2, smoothstep(0.2, 1.0, terminator));
  float dayGlow = intensity * (sunFacing * 1.5 + 0.02) * dayOpacity; 
  
  // Eclipse / Forward scattering (Backlight from sun through atmosphere)
  float backscatter = max(dot(viewDir, -sunDir), 0.0);
  float eclipseGlow = intensity * pow(backscatter, 12.0) * 4.0;
  
  float atmosphereGlow = dayGlow + eclipseGlow;
  
  gl_FragColor = vec4(scatterColor, atmosphereGlow);
}
`

export const cloudsVertexShader = `
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vNormalLocal;
varying vec3 vPositionWorld;

void main() {
  vUv = uv;
  vNormalLocal = normalize(normal);
  vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vPositionWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const cloudsFragmentShader = `
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
  vec3 sunDir = normalize(uSunDirection);

  // Evolve clouds very slowly over time
  // Domain warping for swirling hurricane-like shapes and directional flow
  vec3 baseWarp = vec3(fbm(localNormal * 2.0 + uTime * 0.003), fbm(localNormal * 2.0 - uTime * 0.002), 0.0);
  vec3 noisePos = localNormal * 3.5 + baseWarp * 0.5 + uTime * 0.002;
  
  // Layered noise for cloud formations
  float largeClouds = fbm(noisePos);
  float mediumClouds = fbm(noisePos * 5.0 + vec3(1.2, -0.5, 2.1));
  float wispyClouds = fbm(noisePos * 15.0);
  float microClouds = snoise(noisePos * 30.0);
  
  // Combine layers (multi-scale hierarchy for clouds)
  float density = largeClouds * 0.55 + mediumClouds * 0.3 + wispyClouds * 0.1 - microClouds * 0.05;
  
  // Soft thresholds for natural edge transparency
  float coverage = smoothstep(0.45, 0.75, density);
  float thickClouds = smoothstep(0.65, 0.95, density);
  
  // Altitude fade: hide shell boundaries by fading density at the top and bottom of the volume
  float altitude = length(vPositionWorld) - 400.0; // Cloud layer is roughly 406 to 414
  // Normalize altitude (approx 0 to 1 across the shell volume)
  float normAlt = clamp((altitude - 6.0) / 8.0, 0.0, 1.0);
  // Parabola: 0 at edges, 1 in the middle of the volume
  float altitudeFade = smoothstep(0.0, 0.3, normAlt) * smoothstep(1.0, 0.7, normAlt);
  
  coverage *= altitudeFade;
  
  // Lighting
  float diffuse = max(dot(normal, sunDir), 0.0);
  float terminator = smoothstep(-0.2, 0.2, dot(normal, sunDir));
  
  // Color formulation
  vec3 cloudLit = vec3(0.95, 0.98, 1.0);
  // Give clouds on the terminator a sunset/orange scatter tint
  vec3 cloudSunset = vec3(1.0, 0.65, 0.5);
  vec3 cloudDark = vec3(0.08, 0.12, 0.2); // Night side ambient
  
  vec3 baseColor = mix(cloudSunset, cloudLit, smoothstep(0.0, 0.35, terminator));
  vec3 cloudColor = baseColor * diffuse * 1.1;
  cloudColor += cloudDark * (1.0 - terminator) * 0.25; 
  
  // Self-shadowing: thicker clouds are slightly darker at their core when lit directly
  cloudColor -= thickClouds * diffuse * 0.25;
  
  // Camera proximity fade to smoothly penetrate volumetric shells
  float distToCam = length(cameraPosition - vPositionWorld);
  float proximityFade = smoothstep(2.0, 15.0, distToCam);
  
  // Divide base coverage opacity since we use 5 overlapping volumetric shells
  float finalAlpha = coverage * 0.4 * proximityFade;
  
  gl_FragColor = vec4(cloudColor, finalAlpha);
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
