export const TIMELINE = {
  returnToPlanet: 0.48,
  outroStart: 0.53,
  outroEnd: 0.64,
  systemReveal: 0.68,
  warpOutStart: 0.92,
  warpOutEnd: 1.00
} as const

export interface ChapterProgressState {
  chapterIndex: number
  localProgress: number
}

/**
 * Maps global scroll progress [0, 1] across continuous chapters
 * to { chapterIndex, localProgress [0, 1] }.
 */
export function mapGlobalScrollToChapter(
  globalProgress: number,
  chapterHeights: number[] = [800, 500, 500, 500]
): ChapterProgressState {
  const total = chapterHeights.reduce((sum, h) => sum + h, 0)
  if (total === 0 || chapterHeights.length === 0) {
    return { chapterIndex: 0, localProgress: globalProgress }
  }

  const clamped = Math.max(0, Math.min(1, globalProgress))
  let accumulated = 0

  for (let i = 0; i < chapterHeights.length; i++) {
    const segment = chapterHeights[i]! / total
    const start = accumulated
    const end = accumulated + segment

    if (clamped <= end || i === chapterHeights.length - 1) {
      const local = (clamped - start) / segment
      return {
        chapterIndex: i,
        localProgress: Math.max(0, Math.min(1, local))
      }
    }
    accumulated = end
  }

  return {
    chapterIndex: chapterHeights.length - 1,
    localProgress: 1
  }
}

/**
 * Computes global scroll progress [0, 1] for a given chapter and local progress.
 */
export function getGlobalScrollForChapter(
  chapterIndex: number,
  localProgress = 0,
  chapterHeights: number[] = [800, 500, 500, 500]
): number {
  const total = chapterHeights.reduce((sum, h) => sum + h, 0)
  if (total === 0 || chapterHeights.length === 0) return 0
  const validIndex = Math.max(0, Math.min(chapterHeights.length - 1, chapterIndex))

  let accumulated = 0
  for (let i = 0; i < validIndex; i++) {
    accumulated += chapterHeights[i]! / total
  }

  const segment = chapterHeights[validIndex]! / total
  return Math.max(0, Math.min(1, accumulated + localProgress * segment))
}
