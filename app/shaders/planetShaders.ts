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
uniform float uCityLights;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform vec3 uPalette3;
uniform float uOceanLevel;
uniform float uIceAmount;
uniform vec3 uAtmosphereColor;
uniform float uAtmosphereThickness;
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

float getImpactHistory(vec3 p, float distToCam) {
    // 4-Tier Hierarchy: Mega, Large, Medium, Small
    float basins = getImpactBasin(p, 1.2, 0.08, 1.5);    // Mega basins (very rare, huge impact, deep)
    
    // Large basins (Fade out from far orbit)
    if (distToCam < 3000.0) {
        float fade = smoothstep(3000.0, 1500.0, distToCam);
        basins += getImpactBasin(p, 3.5, 0.15, 0.8) * 0.6 * fade;
    }
    
    // Medium craters
    if (distToCam < 1000.0) {
        float fade = smoothstep(1000.0, 500.0, distToCam);
        basins += getImpactBasin(p, 8.0, 0.25, 0.5) * 0.25 * fade;
    }
    
    // Small crater fields
    if (distToCam < 180.0) {
        float fade = smoothstep(180.0, 45.0, distToCam);
        basins += getImpactBasin(p, 20.0, 0.35, 0.3) * 0.1 * fade;
    }
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
  
  // Keep broad plate boundaries visible from the opening orbit. Fine peaks fade
  // in as the camera approaches so the silhouette stays stable at distance.
  if (distToCam < 6500.0) {
      vec3 tec = voronoiTectonic(p * 1.4 + warp * 0.2);
      float boundaryDist = tec.y - tec.x; 
      float faultType = tec.z;
      
      float faultLine = 1.0 - smoothstep(0.0, 0.2, boundaryDist); // Wider fault zone
      
      // DE-CLUTTER: Only 15% of faults generate mountain ranges (was 60%)
      if (faultType > 0.85) {
          // Convergent: Mountain Range along the tectonic plate
          mountainMask = faultLine * smoothstep(0.1, 0.9, fbm(p * 2.5)); 
          float peakFade = smoothstep(5800.0, 4000.0, distToCam);
          float peaks = 0.12;
          if (distToCam < 5800.0) {
              peaks = mix(0.12, ridgedFBM(p * 4.0), peakFade);
              if (distToCam < 4000.0) {
                  peaks = mix(peaks, ridgedFBM(p * 4.0) * 0.6 + ridgedFBM(p * 8.0) * 0.4, smoothstep(4000.0, 1500.0, distToCam));
              }
          }
          tectonicElevation += mountainMask * peaks * 0.4;
      } else if (faultType < 0.1) {
          // Divergent: Rift Valley (Only 10% of faults)
          float canyonMask = faultLine * smoothstep(0.2, 0.8, fbm(p * 3.0));
          tectonicElevation -= canyonMask * 0.25;
      }
  }
  
  // 3. IMPACT HISTORY (Macro & Regional)
  // DE-CLUTTER: Limit craters mostly to ancient highlands, keeping oceans and new plains quiet
  float basinMask = smoothstep(-0.2, 0.6, continents); 
  float basins = 0.0;
  if (basinMask > 0.01) {
    basins = getImpactHistory(p, distToCam) * basinMask;
  }
  
  // Combine Macro & Regional
  float elevation = baseTerrain * 0.35 + 0.4; // Base height mapping
  elevation += tectonicElevation;
  elevation += basins * 0.25;
  
  // 4. LOCAL DETAIL (Evaluated only when moderately close)
  if (distToCam < 1500.0) {
      // DE-CLUTTER: Drop detail to 0.0 on flat plains/continents. Only apply to mountains/highlands.
      float localDetailMask = smoothstep(0.4, 0.9, continents) + mountainMask;
      localDetailMask = clamp(localDetailMask, 0.0, 1.0);
      
      if (localDetailMask > 0.01) {
          float localDetail = fbm(p * 15.0) * 0.034;
          if (distToCam < 500.0) {
              localDetail += ridgedFBM(p * 35.0) * 0.022 * (1.0 - smoothstep(100.0, 500.0, distToCam));
          }
          elevation += localDetail * localDetailMask * smoothstep(1500.0, 300.0, distToCam);
      }
  }
  
  // 5. MICRO DETAIL (Evaluated only at very close atmospheric entry)
  if (distToCam < 150.0) {
      float microMask = smoothstep(-0.2, 0.3, continents) + mountainMask;
      microMask = clamp(microMask, 0.0, 1.0);
      
      // High frequency structural noise for close approach (rocks, fine ridges)
      float microDetail = snoise(p * 150.0) * 0.0028;
      
      // Ultra-high frequency for extreme close-up (prevents "blobby" look)
      if (distToCam < 30.0) {
          float ultraFade = smoothstep(30.0, 2.0, distToCam);
          microDetail += snoise(p * 450.0) * 0.001 * ultraFade;
          microDetail += snoise(p * 900.0) * 0.00035 * ultraFade;
      }
      
      elevation += microDetail * microMask * smoothstep(150.0, 10.0, distToCam);
  }
  
  return elevation;
}

// Surface Elevation Function (Handles Water Level & Waves)
float getSurfaceElevationFromTerrain(vec3 p, float e, float distToCam) {
  float seaLevel = uOceanLevel;
  if (uOceanLevel > 0.001 && e < seaLevel) {
    // Water surface: low-frequency swell + high-frequency micro ripples
    float swell = snoise(p * 12.0 + vec3(0.0, uTime * 0.008, 0.0)) * 0.0018;
    float ripples = 0.0;
    if (distToCam < 700.0) {
       float nearFade = 1.0 - smoothstep(80.0, 700.0, distToCam);
       float waveA = sin(dot(p, normalize(vec3(1.0, 0.0, 0.42))) * 155.0 + uTime * 0.08);
       float waveB = sin(dot(p, normalize(vec3(-0.36, 0.82, 1.0))) * 218.0 - uTime * 0.055);
       ripples = (waveA + waveB) * 0.00011 * nearFade;
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

  // Evaluate the expensive terrain field once for biome and water shading.
  float terrainElevation = getElevation(localNormal, distToCam);
  float surfaceElevation = getSurfaceElevationFromTerrain(localNormal, terrainElevation, distToCam);
  float shorelineGrain = snoise(localNormal * 34.0 + vec3(4.7));
  float texturedElevation = terrainElevation + shorelineGrain * 0.008;
  float surfaceGrain = snoise(localNormal * 46.0 + vec3(12.3));
  float strataGrain = snoise(localNormal * 17.0 + vec3(2.8));
  
  // --------------------------------------------------------
  // GEOLOGICAL BUMP MAPPING (Normal Perturbation)
  // --------------------------------------------------------
  vec3 worldNormal = normalize(vNormalWorld);
  vec3 finalNormal = worldNormal;

  // A restrained bump response keeps the fully compiled opening view from
  // reading as a flat color sphere, then gains strength during the approach.
  if (distToCam < 6200.0) {
    // Dynamic EPS captures fine detail close up while avoiding noisy distant normals.
    float eps = mix(0.00005, 0.015, smoothstep(5.0, 2000.0, distToCam));

    vec3 wt1 = normalize(cross(worldNormal, vec3(0.0, 1.0, 0.0)));
    if (length(wt1) < 0.1) wt1 = normalize(cross(worldNormal, vec3(1.0, 0.0, 0.0)));
    vec3 wt2 = normalize(cross(worldNormal, wt1));

    vec3 lt1 = normalize(cross(localNormal, vec3(0.0, 1.0, 0.0)));
    if (length(lt1) < 0.1) lt1 = normalize(cross(localNormal, vec3(1.0, 0.0, 0.0)));
    vec3 lt2 = normalize(cross(localNormal, lt1));

    vec3 sample1 = normalize(localNormal + lt1 * eps);
    vec3 sample2 = normalize(localNormal + lt2 * eps);
    float e1 = getSurfaceElevationFromTerrain(sample1, getElevation(sample1, distToCam), distToCam);
    float e2 = getSurfaceElevationFromTerrain(sample2, getElevation(sample2, distToCam), distToCam);

    float bumpStrength = mix(8.0, 0.75, smoothstep(50.0, 5000.0, distToCam));
    finalNormal = normalize(worldNormal - wt1 * (e1 - surfaceElevation) / eps * bumpStrength
                                         - wt2 * (e2 - surfaceElevation) / eps * bumpStrength);
  }

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
  float iceThreshold = 1.0 - uIceAmount;
  float coldMask = uIceAmount > 0.001
    ? smoothstep(iceThreshold, iceThreshold + 0.3, abs(localNormal.y) + snoise(localNormal * 3.0) * 0.15)
    : 0.0;
  
  float seaLevel = uOceanLevel;
  vec3 albedo = vec3(0.0);
  float isLand = 0.0;
  float specular = 0.0;
  float diffuse = max(dot(finalNormal, sunDir), 0.0);
  
  if (uOceanLevel > 0.001 && texturedElevation < seaLevel) {
    // --------------------------------------------------------
    // EARTH: Deep Oceans & Shallow Coastlines
    // --------------------------------------------------------
    float depth = smoothstep(seaLevel - 0.18, seaLevel, texturedElevation);
    float shoreLine = smoothstep(seaLevel - 0.035, seaLevel + 0.006, texturedElevation); // 0 in deep, 1 at shore
    
    // Darker, more cinematic alien ocean colors
    vec3 waterDeep = vec3(0.002, 0.015, 0.04);
    vec3 waterShallow = vec3(0.01, 0.08, 0.12);
    vec3 waterCoastal = vec3(0.08, 0.22, 0.28); // Sediment/turquoise transition
    
    // Massive atmospheric/chemical bands in the deep ocean
    float currentBands = sin((localNormal.x * 1.1 + localNormal.z * 0.7 + shorelineGrain * 0.12) * 34.0 + uTime * 0.012);
    waterDeep += vec3(0.001, 0.009, 0.018) * (currentBands * 0.45 + surfaceGrain * 0.22);
    
    vec3 waterBase = mix(waterDeep, waterShallow, depth);
    albedo = mix(waterBase, waterCoastal, shoreLine);
    
    // Fresnel response (Water reflects the sky at grazing angles)
    float waterFresnel = max(1.0 - dot(finalNormal, viewDir), 0.0);
    waterFresnel = pow(waterFresnel, 4.0);
    vec3 skyReflection = mix(vec3(0.3, 0.5, 0.8), uAtmosphereColor * 0.8, 0.25) * diffuse * uAtmosphereThickness;
    albedo = mix(albedo, skyReflection, waterFresnel * 0.7);
    
    // Crisp ocean specular glint
    vec3 halfVector = normalize(sunDir + viewDir);
    float specAngle = max(dot(finalNormal, halfVector), 0.0);
    // Dynamic roughness based on depth (coastlines are rougher/frothy, deep ocean is smoother)
    float specPower = mix(170.0, 52.0, depth);
    float waveRoughness = 0.88 + surfaceGrain * 0.12;
    float sunGlint = pow(specAngle, 170.0) * 0.45;
    specular = pow(specAngle, specPower) * mix(1.45, 0.68, depth) * waveRoughness + sunGlint;
  } else {
    // --------------------------------------------------------
    // LAND GEOLOGY
    // --------------------------------------------------------
    isLand = 1.0;
    float h = smoothstep(seaLevel, 1.0, texturedElevation);
    
    // Biome 1: Mars (Iron / Rust / Basalt)
    vec3 marsLow = uPalette3;
    vec3 marsHigh = uPalette3 * vec3(0.55, 0.44, 0.40);
    vec3 marsCol = mix(marsLow, marsHigh, h);
    
    // Biome 2: Pale Mineral Highlands (Gold / Cream)
    vec3 goldLow = uPalette2;
    vec3 goldHigh = uPalette2 * vec3(1.25, 1.30, 1.42);
    vec3 goldCol = mix(goldLow, goldHigh, h);
    
    // Biome 3: Dark Alien Rock (Charcoal / Deep Brown)
    vec3 alienLow = uPalette1;
    vec3 alienHigh = uPalette1 * vec3(1.8, 1.77, 1.87);
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
    float isCoast = uOceanLevel > 0.001 ? 1.0 - smoothstep(seaLevel - 0.018, seaLevel + 0.048, texturedElevation) : 0.0;
    albedo = mix(albedo, coastLine, isCoast);
    landSpec = mix(landSpec, 0.1, isCoast); // Wet sand is slightly specular
    
    // Polar Ice
    vec3 ice = vec3(0.82, 0.88, 0.95);
    float polarIce = coldMask * (uOceanLevel > 0.001 ? smoothstep(seaLevel + 0.02, seaLevel + 0.2, texturedElevation) : 1.0);
    float highlandSnow = smoothstep(0.78, 0.96, texturedElevation) * (1.0 - mineralMask * 0.6);
    float isIce = max(polarIce, highlandSnow * 0.72);
    albedo = mix(albedo, ice, isIce);
    landSpec = mix(landSpec, 0.8, isIce); // Ice is highly reflective

    // Fine mineral grain and exposed strata give plains and uplands distinct texture.
    float mineralVein = smoothstep(0.64, 0.82, 1.0 - abs(strataGrain + surfaceGrain * 0.24));
    float landTexture = 1.0 + surfaceGrain * 0.085 + strataGrain * 0.035;
    albedo *= landTexture;
    albedo = mix(albedo, mix(uPalette2, uPalette3, mineralMask), mineralVein * 0.12 * (1.0 - isIce));
    
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
  finalColor += warmScatter * warmMask * 0.8 * uAtmosphereThickness;
  
  // Cool / Blue atmospheric scattering on the grazing angles near the terminator / night
  vec3 coolScatter = uAtmosphereColor * vec3(0.36, 0.65, 0.90);
  float coolMask = pow(fresnel, 4.0) * smoothstep(0.2, -0.6, terminator);
  finalColor += coolScatter * coolMask * 0.4 * uAtmosphereThickness;
  
  // Subtle night-side environmental fill (so dark side isn't pure black, preserving terrain readability)
  vec3 nightAmbient = albedo * vec3(0.04, 0.06, 0.1); 
  finalColor += nightAmbient * (1.0 - max(terminator, 0.0)) * 0.5;
  
  // --------------------------------------------------------
  // ANCIENT CITY LIGHTS (Points of Interest Foundation)
  // --------------------------------------------------------
  float cityVisibility = smoothstep(0.1, -0.1, terminator);
  
  if (uCityLights > 0.5 && isLand > 0.5 && cityVisibility > 0.0 && coldMask < 0.2) {
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
uniform float uAtmosphereThickness;
uniform float uViewSunAlignment;
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
  float horizonRim = pow(fresnel, 24.0); 
  // 2. Broader, softer atmospheric falloff
  float atmosphereHaze = pow(fresnel, 6.0) * 0.25; 
  
  // Lighting factors
  float sunFacing = dot(normal, sunDir);
  
  // 1. WARM LIMB (Sunrise / Sunset Glaze)
  // Highly asymmetric, strongly biased toward the sun
  float warmLimbMask = horizonRim * smoothstep(-0.2, 0.9, sunFacing);
  float warmHazeMask = atmosphereHaze * smoothstep(0.0, 0.8, sunFacing);
  
  vec3 warmColor = vec3(1.0, 0.4, 0.1); // Deep amber/orange
  vec3 goldColor = vec3(1.0, 0.75, 0.3); // Bright gold edge
  vec3 limbGlowColor = mix(warmColor, goldColor, horizonRim);
  
  // 2. COOL ATMOSPHERE (Shadow / Non-Sun Limb)
  // Exists on the dark side, wrapping slightly into the light
  float coolLimbMask = horizonRim * smoothstep(0.3, -0.8, sunFacing);
  float coolHazeMask = atmosphereHaze * smoothstep(0.5, -0.8, sunFacing);
  
  vec3 coolColor = uAtmosphereColor; // Deep space blue
  
  // 3. COMBINE
  vec3 finalScatterColor = limbGlowColor * (warmLimbMask * 3.0 + warmHazeMask * 1.5) + 
                           coolColor * (coolLimbMask * 1.0 + coolHazeMask * 0.8);

  // Camera-facing gold/orange veiling scatter, independent of the cool blue rim.
  // It hugs only the sunlit horizon and fades completely when the view turns away.
  float solarHorizon = pow(fresnel, 8.0) * smoothstep(-0.25, 0.35, sunFacing);
  finalScatterColor += vec3(1.0, 0.62, 0.28) * solarHorizon * uViewSunAlignment * 2.2;
                           
  // Eclipse forward scatter (when star is behind planet)
  float backscatter = max(dot(viewDir, -sunDir), 0.0);
  float eclipseGlow = horizonRim * pow(backscatter, 16.0) * 5.0;
  finalScatterColor += vec3(1.0, 0.6, 0.2) * eclipseGlow;
  
  // Star bloom/glare across the horizon
  // When the camera is looking near the sun over the horizon, boost the glow significantly
  float starGlare = pow(max(dot(reflect(-viewDir, normal), sunDir), 0.0), 30.0) * horizonRim;
  finalScatterColor += vec3(1.0, 0.85, 0.7) * starGlare * 4.0;
  
  // Modulate intensity slightly based on camera distance (thicker atmosphere when far away)
  float distFactor = smoothstep(150.0, 2000.0, distToCam);
  finalScatterColor *= mix(0.5, 1.0, distFactor) * uAtmosphereThickness;
  
  // Output additive RGB
  gl_FragColor = vec4(finalScatterColor, 1.0);
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
uniform float uCloudCover;
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vNormalLocal;
varying vec3 vPositionWorld;

${snoise3}

void main() {
  vec3 normal = normalize(vNormalWorld);
  vec3 localNormal = normalize(vNormalLocal);
  vec3 sunDir = normalize(uSunDirection);

  // A single cloud shell carries broad weather systems, broken edges, and fine wisps.
  vec3 drift = vec3(uTime * 0.002, -uTime * 0.0013, uTime * 0.0016);
  vec3 baseWarp = vec3(
    fbm(localNormal * 2.1 + drift),
    fbm(localNormal * 2.1 - drift + vec3(4.2)),
    fbm(localNormal * 2.1 + vec3(8.1, 2.3, -3.7))
  );
  vec3 noisePos = localNormal * 3.8 + baseWarp * 0.72 + drift;
  float broadBanks = fbm(noisePos);
  float billowDetail = fbm(noisePos * 3.2 + vec3(1.2, -0.5, 2.1));
  float wisps = snoise(noisePos * 13.0 + vec3(5.3));
  float erosion = snoise(noisePos * 29.0 - drift * 2.0);
  float density = broadBanks * 0.64 + billowDetail * 0.27 + wisps * 0.075 + erosion * 0.035;

  float coverageEdge = mix(0.64, 0.08, clamp(uCloudCover, 0.0, 1.0));
  float coverage = smoothstep(coverageEdge - 0.11, coverageEdge + 0.13, density);
  float thickClouds = smoothstep(coverageEdge + 0.08, coverageEdge + 0.34, density);
  
  // Altitude fade: hide shell boundaries by fading density at the top and bottom of the volume
  float altitude = length(vPositionWorld) - 400.0; // Cloud layer is roughly 406 to 414
  // Fade gently across the thin cloud shell to avoid visible sphere edges.
  float normAlt = clamp((altitude - 6.0) / 8.0, 0.0, 1.0);
  // Parabola: 0 at edges, 1 in the middle of the volume
  float altitudeFade = smoothstep(0.0, 0.3, normAlt) * smoothstep(1.0, 0.7, normAlt);
  
  coverage *= altitudeFade;
  
  // Lighting
  float diffuse = max(dot(normal, sunDir), 0.0);
  float terminator = smoothstep(-0.2, 0.2, dot(normal, sunDir));
  
  // Color formulation
  vec3 cloudLit = vec3(0.9, 0.94, 0.97);
  vec3 cloudSunset = vec3(1.0, 0.58, 0.36);
  vec3 cloudDark = vec3(0.035, 0.055, 0.09);
  vec3 baseColor = mix(cloudSunset, cloudLit, smoothstep(-0.08, 0.46, dot(normal, sunDir)));
  vec3 cloudColor = baseColor * (0.22 + diffuse * 1.06);
  cloudColor = mix(cloudColor, cloudDark, (1.0 - terminator) * 0.72);
  cloudColor *= 1.0 - thickClouds * 0.2;

  // Thin cloud edges catch the star and separate layered forms from the surface.
  vec3 viewDir = normalize(cameraPosition - vPositionWorld);
  vec3 halfVector = normalize(viewDir + sunDir);
  float silverEdge = pow(max(dot(normal, halfVector), 0.0), 18.0) * (1.0 - thickClouds);
  cloudColor += vec3(1.0, 0.78, 0.54) * silverEdge * diffuse * 0.32;
  
  // Camera proximity fade to smoothly penetrate volumetric shells
  float distToCam = length(cameraPosition - vPositionWorld);
  float proximityFade = smoothstep(2.0, 15.0, distToCam);
  
  float finalAlpha = coverage * 0.72 * proximityFade;
  
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
