<template>
  <div
    class="orbital-page relative select-none"
    :style="{ height: `${totalScrollHeightVh}vh` }"
  >
    <!-- Sticky 3D WebGL Scene -->
    <OrbitalScene
      v-if="sceneRequested"
      :scroll-progress="localProgress"
      class="sticky top-0 h-screen w-full"
    />

    <!-- Mission Intro -->
    <OrbitalIntro
      v-if="localProgress < 0.25"
      ref="introComponent"
      :style="prefersReducedMotion ? undefined : { opacity: Math.max(0, 1 - localProgress * 4), transform: `translateY(${-localProgress * 800}px)` }"
    />

    <!-- Quiet survey marker while the camera completes its pullback -->
    <div
      class="survey-marker fixed inset-0 z-10 pointer-events-none flex items-end p-8 md:p-12"
      :aria-hidden="surveyOutroOpacity < 0.02"
      :style="{ opacity: surveyOutroOpacity, visibility: surveyOutroOpacity < 0.02 ? 'hidden' : 'visible' }"
    >
      <div>
        <div class="survey-marker-label">Field survey complete</div>
        <div class="survey-marker-title">{{ activePlanet.name }}</div>
        <div class="survey-marker-note">Surface conditions remain unknown</div>
      </div>
    </div>

    <!-- Artist Impression Watermark -->
    <div
      v-if="localProgress > 0.22 && localProgress < TIMELINE.systemReveal"
      class="impression-watermark fixed bottom-5 right-6 z-10 md:bottom-8 md:right-10"
      aria-label="Procedural artist’s impression. Surface conditions are unknown."
    >
      ARTIST’S IMPRESSION <span>／</span> SURFACE UNKNOWN
    </div>

    <!-- Field record, focused on the surveyed planet -->
    <SurveyComplete
      :planet="activePlanet"
      :progress="systemMapProgress"
      @return-to-planet="returnToCurrentPlanet"
      @return-to-start="returnToStart"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import gsap from 'gsap'
import OrbitalIntro from '~/components/orbital/OrbitalIntro.vue'
import SurveyComplete from '~/components/orbital/SurveyComplete.vue'
import { useLenis } from '~/composables/useLenis'
import { TIMELINE } from '~/config/timeline'
import { kepler186 } from '~/data/systems/kepler-186'

const OrbitalScene = defineAsyncComponent(() => import('~/components/orbital/OrbitalScene.vue'))

const route = useRoute()
const router = useRouter()
const activePlanet = kepler186.planets[0]!
const totalScrollHeightVh = 900

const scrollProgress = ref(0)
const sceneRequested = ref(false)
const prefersReducedMotion = ref(false)

const { lenis, resize: resizeLenis } = useLenis()

const localProgress = scrollProgress

// Mission milestone opacities
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
  if (p < TIMELINE.systemReveal) return 0
  return Math.min(1, (p - TIMELINE.systemReveal) / (1 - TIMELINE.systemReveal))
})

const returnToCurrentPlanet = () => {
  const targetProgress = TIMELINE.returnToPlanet
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

// Scroll progress is the single source of truth for the camera and overlays.
let ctx: gsap.Context

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
  description: 'A cinematic field survey of Kepler-186f, a distant world orbiting a red dwarf star.',
  ogTitle: 'ORBITAL — A Journey Beyond The Known',
  ogDescription: 'A cinematic field survey of Kepler-186f.',
  ogType: 'website',
  ogUrl: 'https://orbital0.vercel.app/',
  ogImage: 'https://orbital0.vercel.app/orbital-poster.svg',
  twitterCard: 'summary_large_image',
  twitterTitle: 'ORBITAL — A Journey Beyond The Known',
  twitterDescription: 'A cinematic field survey of Kepler-186f.',
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

  // Keep old links focused on the single Kepler-186f survey.
  const setupInitialScroll = () => {
    resizeLenis()
    if (route.query.system || (route.query.planet && route.query.planet !== 'f')) {
      void router.replace({ path: '/', query: { planet: 'f' } })
    }
    window.scrollTo(0, 0)
    if (lenis.value) lenis.value.scrollTo(0, { immediate: true })
    scrollProgress.value = 0
  }

  // Execute scroll positioning after DOM layout settles
  window.requestAnimationFrame(() => {
    setupInitialScroll()
  })

  sceneRequested.value = true

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

})

onBeforeUnmount(() => {
  if (ctx) ctx.revert()
  window.removeEventListener('scroll', onScroll)
  if (lenis.value) {
    lenis.value.off('scroll', onScroll)
  }
})
</script>

<style scoped>
.survey-marker {
  align-items: flex-end;
  padding-bottom: clamp(2rem, 8vh, 5.5rem);
}

.survey-marker-label,
.survey-marker-note {
  color: rgb(231 233 233 / 72%);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.orbital-page {
  background: var(--orbital-void);
}

.survey-marker-title {
  margin-top: 0.45rem;
  color: var(--orbital-ivory);
  font-family: var(--font-display);
  font-size: clamp(2.4rem, 4vw, 4rem);
  letter-spacing: 0.04em;
}

.survey-marker-note {
  margin-top: 0.4rem;
  color: rgb(231 233 233 / 58%);
}

.impression-watermark {
  color: rgb(231 233 233 / 72%);
  font-family: var(--font-body);
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.11em;
  text-shadow: 0 1px 12px rgb(0 0 0 / 80%);
}

.impression-watermark span {
  color: var(--orbital-amber);
}
</style>
