/** Stable material and relief defaults for Kepler-186f's illustrative surface. */
export const PLANET_SURFACE_CONFIG = {
  seed: 186,
  reliefStrength: 26,
  oceanLevel: 0.55,
  oceanColors: {
    deep: '#030b18',
    shallow: '#09283a',
    shelf: '#174356',
    foam: '#b7c9c4'
  },
  iceAmount: 0.35,
  cloudCover: 0.55,
  foamStrength: 0.58,
  glintStrength: 0.76,
  cloudShadowStrength: {
    low: 0,
    medium: 0.22,
    high: 0.38
  },
  cloudLayerSeparation: 5.5,
  moonReliefStrength: 0.018
} as const
