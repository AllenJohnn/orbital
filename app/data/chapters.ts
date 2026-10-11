import { getSystem, getPlanet } from './systems'
import type { Planet, System, PlanetVisual } from '~/types/atlas'

export interface ChapterKey {
  systemSlug: string
  planetId: string
}

export interface Chapter {
  index: number
  systemSlug: string
  planetId: string
  system: System
  planet: Planet
  visual: PlanetVisual
  heightVh: number
}

/**
 * Ordered sequence of survey chapters:
 * kepler-186/f (Mission 001) -> trappist-1/e (Mission 002)
 */
export const chapterOrder: readonly ChapterKey[] = [
  { systemSlug: 'kepler-186', planetId: 'f' },
  { systemSlug: 'trappist-1', planetId: 'e' }
] as const

/**
 * Derived chapter list from systems registry.
 * Guarantees every chapter planet has a PlanetVisual profile; skips planets without one.
 */
export const chapters: Chapter[] = chapterOrder
  .map((key, index) => {
    const system = getSystem(key.systemSlug)
    const planet = getPlanet(key.systemSlug, key.planetId)
    if (!system || !planet || !planet.visual) return null
    return {
      index,
      systemSlug: key.systemSlug,
      planetId: key.planetId,
      system,
      planet,
      visual: planet.visual,
      heightVh: 800
    }
  })
  .filter((c): c is Chapter => c !== null)

export const totalChaptersHeightVh = chapters.reduce((sum, ch) => sum + ch.heightVh, 0)

export const getChapter = (index: number): Chapter | undefined => chapters[index]

export const findChapterIndex = (systemSlug?: string, planetId?: string): number => {
  if (!systemSlug && !planetId) return 0
  const match = chapters.findIndex((c) => {
    if (systemSlug && planetId) return c.systemSlug === systemSlug && c.planetId === planetId
    if (systemSlug) return c.systemSlug === systemSlug
    if (planetId) return c.planetId === planetId
    return false
  })
  return match >= 0 ? match : 0
}
