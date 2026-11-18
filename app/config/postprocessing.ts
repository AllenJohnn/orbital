export const POST_PROCESSING_CONFIG = {
  bloom: {
    intensity: 0.34,
    luminanceThreshold: 1.55,
    luminanceSmoothing: 0.16,
    radius: 0.62,
    levels: 5
  },
  grain: {
    amount: 0.025
  },
  vignette: {
    offset: 0.38,
    darkness: 0.18
  },
  aberration: {
    offset: 0.00035,
    modulationOffset: 0.2
  }
} as const
