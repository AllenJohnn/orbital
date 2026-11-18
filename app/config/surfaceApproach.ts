/** Tunables for the illustrative final approach; values are world units unless noted. */
export const SURFACE_APPROACH_CONFIG = {
  activationAltitude: 420,
  fullDetailAltitude: 62,
  retreatStartProgress: 0.72,
  patchAngularRadius: 0.48,
  patchEdgeFade: 0.065,
  patchLift: 0.16,
  patchSegments: {
    low: { radial: 32, angular: 64 },
    medium: { radial: 64, angular: 128 },
    high: { radial: 112, angular: 224 }
  },
  scatterCount: {
    low: 48,
    medium: 144,
    high: 288
  },
  fog: {
    color: '#8d8c86',
    near: 55,
    far: 290,
    strength: 0.26
  },
  dust: {
    count: 220,
    radius: 118,
    height: 16,
    opacity: 0.11,
    driftRate: 0.018
  },
  camera: {
    drift: 0.34,
    driftRate: 0.42,
    fovSettle: 1.25,
    fovSettleAltitude: 90
  },
  rockColor: '#8b7963',
  detailStrength: 0.12
} as const
