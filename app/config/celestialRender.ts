export type RenderQualityTier = 'high' | 'medium' | 'low'

export const CELESTIAL_RENDER_CONFIG = {
  atmosphere: {
    planetRadius: 400,
    height: 32,
    rayleighCoefficients: [0.12, 0.2, 0.32] as const,
    mieCoefficients: [0.055, 0.032, 0.018] as const,
    rayleighScaleHeight: 0.24,
    mieScaleHeight: 0.08,
    mieAnisotropy: 0.68,
    steps: {
      medium: 10,
      high: 16
    },
    twilightStrength: 0.18
  },
  aurora: {
    strength: 0.045,
    curtainScale: 13,
    motionRate: 0.055
  },
  star: {
    coronaStrength: {
      high: 0.32,
      medium: 0.23,
      low: 0.12
    },
    granulationStrength: 0.08,
    flareStrength: 0.12
  },
  milkyWay: {
    opacity: {
      high: 0.08,
      medium: 0.055,
      low: 0.025
    }
  }
} as const
