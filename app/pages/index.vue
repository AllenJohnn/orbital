<template>
  <div ref="mainContainer" class="h-[800vh] bg-black relative">
    <OrbitalScene
      v-if="sceneRequested"
      ref="sceneComponent"
      :scroll-progress="scrollProgress"
      class="sticky top-0 h-screen w-full"
    />
    <OrbitalIntro ref="introComponent" :style="prefersReducedMotion ? undefined : { opacity: Math.max(0, 1 - scrollProgress * 5), transform: `translateY(${-scrollProgress * 1000}px)` }" />

    <div
      class="fixed inset-0 z-10 pointer-events-none flex items-end p-8 md:p-12"
      :aria-hidden="keplerOutroOpacity < 0.02"
      :style="{ opacity: keplerOutroOpacity, visibility: keplerOutroOpacity < 0.02 ? 'hidden' : 'visible' }"
    >
      <div class="text-white">
        <div class="text-xs tracking-[0.4em] opacity-60 uppercase mb-3">Field Survey Complete</div>
        <div class="font-light tracking-[0.16em] text-2xl md:text-3xl opacity-95">KEPLER-186F</div>
        <div class="text-xs tracking-[0.24em] opacity-50 mt-3">SYSTEM OVERVIEW AHEAD</div>
      </div>
    </div>

    <div
      v-if="scrollProgress > 0.22 && scrollProgress < TIMELINE.systemReveal"
      class="fixed bottom-5 right-6 z-10 text-[0.55rem] tracking-[0.18em] text-white/40 uppercase md:bottom-8 md:right-10"
      aria-label="Procedural artist’s impression. Surface conditions are unknown."
    >Procedural artist’s impression · surface conditions unknown</div>

    <KeplerSystemMap :progress="systemMapProgress" @return-to-kepler="returnToKepler" />
    
    <!-- Debug UI -->
    <div v-if="isDevelopment && scrollProgress < 0.6" class="fixed top-4 left-4 z-50 bg-black/80 text-white font-mono text-xs p-4 rounded leading-relaxed border border-white/20 pointer-events-none transition-opacity duration-300"
         :style="{ opacity: scrollProgress > 0.75 ? Math.max(0, 1 - (scrollProgress - 0.75) * 5) : 1 }">
      <div class="text-white/50 mb-2 border-b border-white/20 pb-1">ORBITAL TELEMETRY</div>
      <div>SCROLL: {{ scrollProgress.toFixed(3) }}</div>
      <div>CAMERA DISTANCE: {{ cameraDistance.toFixed(1) }}</div>
      <div>PLANET RADIUS: 400</div>
      <div>APPARENT DIAMETER: {{ ((800 / cameraDistance) * 100).toFixed(1) }}%</div>
      <div>PLANET ROTATION: {{ planetRotation.toFixed(1) }}°</div>
      <div>CLOUD ROTATION: {{ (planetRotation * 1.1).toFixed(1) }}°</div>
      <div>FOV: {{ cameraFov.toFixed(1) }}</div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import OrbitalIntro from '~/components/orbital/OrbitalIntro.vue'
import KeplerSystemMap from '~/components/orbital/KeplerSystemMap.vue'
import { useLenis } from '~/composables/useLenis'
import { TIMELINE } from '~/config/timeline'

const OrbitalScene = defineAsyncComponent(() => import('~/components/orbital/OrbitalScene.vue'))

const sceneComponent = ref<InstanceType<typeof OrbitalScene> | null>(null)
const introComponent = ref<InstanceType<typeof OrbitalIntro> | null>(null)
const scrollProgress = ref(0)
const sceneRequested = ref(false)
const isDevelopment = import.meta.dev
const prefersReducedMotion = ref(false)
const systemMapProgress = computed(() => {
  if (prefersReducedMotion.value) return scrollProgress.value > TIMELINE.systemReveal ? 1 : 0
  return Math.max(0, Math.min(1, (scrollProgress.value - TIMELINE.systemReveal) / (1 - TIMELINE.systemReveal)))
})
const keplerOutroOpacity = computed(() => {
  if (prefersReducedMotion.value) {
    return scrollProgress.value >= TIMELINE.outroStart && scrollProgress.value < TIMELINE.systemReveal ? 1 : 0
  }
  const enter = Math.max(0, Math.min(1, (scrollProgress.value - TIMELINE.outroStart) / 0.06))
  const leave = 1 - Math.max(0, Math.min(1, (scrollProgress.value - TIMELINE.outroEnd) / 0.04))
  return Math.min(enter, leave)
})

// For telemetry
const cameraDistance = ref(6000)
const cameraFov = ref(45)
const planetRotation = ref(0)
const mainContainer = ref<HTMLElement | null>(null)

const { lenis } = useLenis()

useSeoMeta({
  title: 'ORBITAL — A Journey Beyond The Known',
  description: 'A cinematic, interactive field survey of Kepler-186f and its planetary system. Explore a procedural artist’s impression of a distant world.',
  ogTitle: 'ORBITAL — A Journey Beyond The Known',
  ogDescription: 'A cinematic field survey of the Kepler-186 system.',
  ogType: 'website',
  ogUrl: 'https://orbital0.vercel.app/',
  ogImage: 'https://orbital0.vercel.app/orbital-poster.svg',
  twitterCard: 'summary_large_image',
  twitterTitle: 'ORBITAL — A Journey Beyond The Known',
  twitterDescription: 'A cinematic field survey of the Kepler-186 system.',
  twitterImage: 'https://orbital0.vercel.app/orbital-poster.svg'
})
useHead({ htmlAttrs: { lang: 'en' }, link: [{ rel: 'canonical', href: 'https://orbital0.vercel.app/' }] })

// We'll update the telemetry variables in a fast interval or RAF
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
  // Use Lenis if available, otherwise native scroll fallback
  let progress = 0
  if (lenis.value) {
    progress = lenis.value.progress
  } else {
    const scrollY = window.scrollY
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    progress = maxScroll > 0 ? scrollY / maxScroll : 0
  }
  // Clamp
  scrollProgress.value = Math.max(0, Math.min(1, progress))
}

const returnToKepler = () => {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  const target = maxScroll * TIMELINE.returnToPlanet
  if (lenis.value) {
    lenis.value.scrollTo(target, { immediate: true })
  } else {
    window.scrollTo({ top: target, behavior: 'smooth' })
  }
}

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Handle browser scroll restoration on refresh
  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }
  window.scrollTo(0, 0)
  scrollProgress.value = 0
  sceneLoadTimer = window.setTimeout(() => {
    sceneRequested.value = true
  }, 120)
  
  if (!prefersReducedMotion.value) ctx = gsap.context(() => {
    // Initial State (Fade In from Black)
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

  if (lenis.value) {
    lenis.value.on('scroll', onScroll)
  } else {
    window.addEventListener('scroll', onScroll)
  }
  
  if (isDevelopment) {
    updateTelemetry()
    telemetryInterval = window.setInterval(updateTelemetry, 200)
  }
})

onBeforeUnmount(() => {
  if (ctx) ctx.revert()
  if (lenis.value) {
    lenis.value.off('scroll', onScroll)
  } else {
    window.removeEventListener('scroll', onScroll)
  }
  if (telemetryInterval) window.clearInterval(telemetryInterval)
  if (sceneLoadTimer) window.clearTimeout(sceneLoadTimer)
})
</script>
