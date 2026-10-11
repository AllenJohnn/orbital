<template>
  <div
    ref="mainContainer"
    class="bg-black relative select-none"
    :style="{ height: `${totalChaptersHeightVh}vh` }"
  >
    <!-- Sticky 3D WebGL Scene -->
    <OrbitalScene
      v-if="sceneRequested"
      ref="sceneComponent"
      :scroll-progress="localProgress"
      :planet-visual="activeVisual"
      :star-color="activeSystem.starColor"
      :system="activeSystem"
      class="sticky top-0 h-screen w-full"
    />

    <!-- Chapter 0 Intro Screen -->
    <OrbitalIntro
      v-if="activeChapterIndex === 0 && localProgress < 0.25"
      ref="introComponent"
      :style="prefersReducedMotion ? undefined : { opacity: Math.max(0, 1 - localProgress * 4), transform: `translateY(${-localProgress * 800}px)` }"
    />

    <!-- Blackout Overlay during Warp Out and Approach Entrance -->
    <div
      class="fixed inset-0 bg-black pointer-events-none z-30 transition-opacity duration-150"
      :style="{ opacity: blackoutOpacity }"
    />

    <!-- Inter-System Title Card during Deep-Space Warp Frame -->
    <div
      v-if="interSystemTitleCard"
      class="fixed inset-0 z-40 flex items-center justify-center pointer-events-none transition-opacity duration-300"
      :style="{ opacity: interSystemTitleCard ? 1 : 0 }"
    >
      <div class="text-center font-sans tracking-[0.25em] text-white">
        <div class="text-xs uppercase text-amber-200/70 mb-3 tracking-[0.35em]">
          MISSION 00{{ interSystemTitleCard.missionNo }}
        </div>
        <div class="text-3xl md:text-5xl font-light tracking-[0.2em] uppercase font-serif text-white/95">
          {{ interSystemTitleCard.name }}
        </div>
        <div class="text-[0.65rem] tracking-[0.3em] uppercase text-white/40 mt-3 font-mono">
          ENTERING STELLAR SYSTEM
        </div>
      </div>
    </div>

    <!-- Field Survey Complete Card per Planet -->
    <div
      class="fixed inset-0 z-10 pointer-events-none flex items-end p-8 md:p-12"
      :aria-hidden="surveyOutroOpacity < 0.02"
      :style="{ opacity: surveyOutroOpacity, visibility: surveyOutroOpacity < 0.02 ? 'hidden' : 'visible' }"
    >
      <div class="text-white">
        <div class="text-xs tracking-[0.4em] opacity-60 uppercase mb-3">Field Survey Complete</div>
        <div class="font-light tracking-[0.16em] text-2xl md:text-3xl opacity-95">
          {{ activePlanet.name.toUpperCase() }}
        </div>
        <div class="text-xs tracking-[0.24em] opacity-50 mt-3">SYSTEM OVERVIEW AHEAD</div>
      </div>
    </div>

    <!-- Artist Impression Watermark -->
    <div
      v-if="localProgress > 0.22 && localProgress < TIMELINE.systemReveal"
      class="fixed bottom-5 right-6 z-10 text-[0.55rem] tracking-[0.18em] text-white/40 uppercase md:bottom-8 md:right-10"
      aria-label="Procedural artist’s impression. Surface conditions are unknown."
    >
      Procedural artist’s impression · surface conditions unknown
    </div>

    <!-- Redesigned Cinematic System Map -->
    <SystemMap
      :system="activeSystem"
      :progress="systemMapProgress"
      :initial-world-id="activePlanet.id"
      :is-chapter-chain="true"
      :is-final-chapter="activeChapterIndex === chapters.length - 1"
      @return-to-planet="returnToCurrentPlanet"
      @return-to-kepler="returnToCurrentPlanet"
      @return-to-start="returnToStart"
      @next-system="handleNextSystem"
    />

    <!-- Telemetry Debug UI -->
    <div
      v-if="isDevelopment && localProgress < 0.6"
      class="fixed top-4 left-4 z-50 bg-black/80 text-white font-mono text-xs p-4 rounded leading-relaxed border border-white/20 pointer-events-none transition-opacity duration-300"
      :style="{ opacity: localProgress > 0.75 ? Math.max(0, 1 - (localProgress - 0.75) * 5) : 1 }"
    >
      <div class="text-white/50 mb-2 border-b border-white/20 pb-1">ORBITAL TELEMETRY</div>
      <div>CHAPTER: {{ activeChapterIndex + 1 }} / {{ chapters.length }} ({{ activeChapter.systemSlug }}/{{ activeChapter.planetId }})</div>
      <div>PLANET: {{ activePlanet.name.toUpperCase() }}</div>
      <div>GLOBAL SCROLL: {{ scrollProgress.toFixed(3) }}</div>
      <div>LOCAL PROGRESS: {{ localProgress.toFixed(3) }}</div>
      <div>CAMERA DISTANCE: {{ cameraDistance.toFixed(1) }}</div>
      <div>PLANET ROTATION: {{ planetRotation.toFixed(1) }}°</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import gsap from 'gsap'
import OrbitalIntro from '~/components/orbital/OrbitalIntro.vue'
import SystemMap from '~/components/orbital/SystemMap.vue'
import { useLenis } from '~/composables/useLenis'
import { TIMELINE, mapGlobalScrollToChapter, getGlobalScrollForChapter } from '~/config/timeline'
import { chapters, totalChaptersHeightVh, findChapterIndex } from '~/data/chapters'

const OrbitalScene = defineAsyncComponent(() => import('~/components/orbital/OrbitalScene.vue'))

const route = useRoute()
const chapterHeights = chapters.map((c) => c.heightVh)

const mainContainer = ref<HTMLElement | null>(null)
const sceneComponent = ref<InstanceType<typeof OrbitalScene> | null>(null)
const introComponent = ref<InstanceType<typeof OrbitalIntro> | null>(null)
const scrollProgress = ref(0)
const sceneRequested = ref(false)
const isDevelopment = import.meta.dev
const prefersReducedMotion = ref(false)

const cameraDistance = ref(6000)
const cameraFov = ref(45)
const planetRotation = ref(0)

const { lenis, resize: resizeLenis } = useLenis()

// Map global scroll to { chapterIndex, localProgress }
const chapterState = computed(() => mapGlobalScrollToChapter(scrollProgress.value, chapterHeights))
const activeChapterIndex = computed(() => chapterState.value.chapterIndex)
const localProgress = computed(() => chapterState.value.localProgress)
const activeChapter = computed(() => chapters[activeChapterIndex.value] ?? chapters[0]!)
const activeVisual = computed(() => activeChapter.value.visual)
const activeSystem = computed(() => activeChapter.value.system)
const activePlanet = computed(() => activeChapter.value.planet)

// Blackout Opacity for Warp Transitions
const blackoutOpacity = computed(() => {
  const p = localProgress.value
  const isLast = activeChapterIndex.value === chapters.length - 1

  // End of chapter warp fade out
  if (!isLast && p >= (prefersReducedMotion.value ? 0.90 : 0.93)) {
    const start = prefersReducedMotion.value ? 0.90 : 0.93
    return Math.min(1, Math.max(0, (p - start) / (1 - start)))
  }

  // Beginning of next chapter fade in
  if (activeChapterIndex.value > 0 && p <= 0.07) {
    return Math.min(1, Math.max(0, 1 - p / 0.07))
  }

  return 0
})

// Inter-system title card during deep-space warp frame between different systems
const interSystemTitleCard = computed(() => {
  if (activeChapterIndex.value === 0 && localProgress.value >= 0.94) {
    return chapters[1]?.system ?? null
  }
  if (activeChapterIndex.value === 1 && localProgress.value <= 0.06) {
    return chapters[1]?.system ?? null
  }
  return null
})

// Milestone opacities per chapter
const surveyOutroOpacity = computed(() => {
  const p = localProgress.value
  if (prefersReducedMotion.value) {
    return p >= TIMELINE.outroStart && p < TIMELINE.systemReveal ? 1 : 0
  }
  const enter = Math.max(0, Math.min(1, (p - TIMELINE.outroStart) / 0.05))
  const leave = 1 - Math.max(0, Math.min(1, (p - TIMELINE.outroEnd) / 0.03))
  return Math.min(enter, leave)
})

const systemMapProgress = computed(() => {
  const p = localProgress.value
  const isLast = activeChapterIndex.value === chapters.length - 1
  if (p < TIMELINE.systemReveal) return 0
  if (isLast) {
    return Math.min(1, (p - TIMELINE.systemReveal) / (1 - TIMELINE.systemReveal))
  }
  if (p < TIMELINE.warpOutStart) {
    return Math.min(1, (p - TIMELINE.systemReveal) / (TIMELINE.warpOutStart - TIMELINE.systemReveal))
  }
  return Math.max(0, 1 - (p - TIMELINE.warpOutStart) / 0.03)
})

// URL Sync with history.replaceState
let lastUrlQuery = ''
const syncUrl = () => {
  if (typeof window === 'undefined') return
  const ch = activeChapter.value
  let query = ''
  if (ch.systemSlug === 'kepler-186') {
    query = `?planet=${ch.planetId}`
  } else {
    query = `?system=${ch.systemSlug}&planet=${ch.planetId}`
  }
  if (query !== lastUrlQuery) {
    lastUrlQuery = query
    window.history.replaceState(null, '', window.location.pathname + query)
  }
}

watch(activeChapterIndex, () => {
  syncUrl()
})

// Navigation Actions
const scrollToChapterIndex = (idx: number, immediate = false) => {
  const targetProgress = getGlobalScrollForChapter(idx, 0, chapterHeights)
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  const targetY = targetProgress * maxScroll
  scrollProgress.value = targetProgress
  if (lenis.value) {
    lenis.value.scrollTo(targetY, { immediate })
  } else {
    if (immediate) {
      window.scrollTo(0, targetY)
    } else {
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }
}

const handleNextSystem = () => {
  const nextIdx = (activeChapterIndex.value + 1) % chapters.length
  scrollToChapterIndex(nextIdx, false)
}

const returnToCurrentPlanet = () => {
  const targetProgress = getGlobalScrollForChapter(
    activeChapterIndex.value,
    TIMELINE.returnToPlanet,
    chapterHeights
  )
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  const targetY = targetProgress * maxScroll
  if (lenis.value) {
    lenis.value.scrollTo(targetY, { immediate: false })
  } else {
    window.scrollTo({ top: targetY, behavior: 'smooth' })
  }
}

const returnToStart = () => {
  if (lenis.value) {
    lenis.value.scrollTo(0, { immediate: false })
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Telemetry updater
let telemetryInterval: ReturnType<typeof setInterval> | undefined
let sceneLoadTimer: ReturnType<typeof setTimeout> | undefined
let ctx: gsap.Context

const updateTelemetry = () => {
  if (sceneComponent.value && sceneComponent.value.orbital) {
    const orbital = sceneComponent.value.orbital
    const cam = orbital.camera
    if (cam) {
      cameraDistance.value = cam.position.length()
      cameraFov.value = cam.fov
    }
    planetRotation.value = orbital.surfaceRotation * (180 / Math.PI)
  }
}

const onScroll = () => {
  let progress = 0
  const scrollY = window.scrollY
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  if (lenis.value && lenis.value.limit > 0) {
    progress = lenis.value.progress
  } else if (maxScroll > 0) {
    progress = scrollY / maxScroll
  }
  scrollProgress.value = Math.max(0, Math.min(1, progress))
}

useSeoMeta({
  title: 'ORBITAL — A Journey Beyond The Known',
  description: 'A cinematic, interactive field survey of exoplanetary worlds across distant stellar systems.',
  ogTitle: 'ORBITAL — A Journey Beyond The Known',
  ogDescription: 'A cinematic, continuous field survey of exoplanetary worlds.',
  ogType: 'website',
  ogUrl: 'https://orbital0.vercel.app/',
  ogImage: 'https://orbital0.vercel.app/orbital-poster.svg',
  twitterCard: 'summary_large_image',
  twitterTitle: 'ORBITAL — A Journey Beyond The Known',
  twitterDescription: 'A cinematic, continuous field survey of exoplanetary worlds.',
  twitterImage: 'https://orbital0.vercel.app/orbital-poster.svg'
})
useHead({ htmlAttrs: { lang: 'en' }, link: [{ rel: 'canonical', href: 'https://orbital0.vercel.app/' }] })

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }

  // Always bind window scroll as reliable fallback and sync
  window.addEventListener('scroll', onScroll, { passive: true })
  if (lenis.value) {
    lenis.value.on('scroll', onScroll)
  }

  // Handle Initial Route Query (?system=...&planet=...)
  const setupInitialScroll = () => {
    resizeLenis()
    const querySystem = route.query.system as string | undefined
    const queryPlanet = route.query.planet as string | undefined
    const initialIdx = findChapterIndex(querySystem, queryPlanet)

    if (initialIdx > 0) {
      scrollToChapterIndex(initialIdx, true)
    } else {
      window.scrollTo(0, 0)
      if (lenis.value) {
        lenis.value.scrollTo(0, { immediate: true })
      }
      scrollProgress.value = 0
    }
  }

  // Execute scroll positioning after DOM layout settles
  window.requestAnimationFrame(() => {
    setupInitialScroll()
  })

  // Watch for route query changes from client-side navigation
  watch(
    () => [route.query.system, route.query.planet],
    ([sys, pl]) => {
      const targetIdx = findChapterIndex(sys as string | undefined, pl as string | undefined)
      if (targetIdx !== activeChapterIndex.value) {
        scrollToChapterIndex(targetIdx, false)
      }
    }
  )

  sceneLoadTimer = window.setTimeout(() => {
    sceneRequested.value = true
  }, 120)

  if (!prefersReducedMotion.value) {
    ctx = gsap.context(() => {
      gsap.from('.intro-content', {
        opacity: 0,
        y: 30,
        duration: 2,
        ease: 'power2.out'
      })
      gsap.from('.scroll-indicator', {
        opacity: 0,
        duration: 2,
        delay: 1,
        ease: 'power2.out'
      })
      gsap.to('.arrow', {
        y: 5,
        repeat: -1,
        yoyo: true,
        duration: 1.5,
        ease: 'sine.inOut'
      })
    })
  }

  if (isDevelopment) {
    updateTelemetry()
    telemetryInterval = window.setInterval(updateTelemetry, 200)
  }
})

onBeforeUnmount(() => {
  if (ctx) ctx.revert()
  window.removeEventListener('scroll', onScroll)
  if (lenis.value) {
    lenis.value.off('scroll', onScroll)
  }
  if (telemetryInterval) window.clearInterval(telemetryInterval)
  if (sceneLoadTimer) window.clearTimeout(sceneLoadTimer)
})
</script>
