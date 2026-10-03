<template>
  <div ref="mainContainer" class="h-[800vh] bg-black relative">
    <OrbitalScene
      v-if="sceneRequested"
      ref="sceneComponent"
      :scroll-progress="scrollProgress"
      class="sticky top-0 h-screen w-full"
    />
    <OrbitalIntro ref="introComponent" :style="{ opacity: Math.max(0, 1 - scrollProgress * 5), transform: `translateY(${-scrollProgress * 1000}px)` }" />

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

const OrbitalScene = defineAsyncComponent(() => import('~/components/orbital/OrbitalScene.vue'))

const sceneComponent = ref<InstanceType<typeof OrbitalScene> | null>(null)
const introComponent = ref<InstanceType<typeof OrbitalIntro> | null>(null)
const scrollProgress = ref(0)
const sceneRequested = ref(false)
const isDevelopment = import.meta.dev
const systemMapProgress = computed(() => Math.max(0, Math.min(1, (scrollProgress.value - 0.68) / 0.32)))
const keplerOutroOpacity = computed(() => {
  const enter = Math.max(0, Math.min(1, (scrollProgress.value - 0.53) / 0.06))
  const leave = 1 - Math.max(0, Math.min(1, (scrollProgress.value - 0.64) / 0.04))
  return Math.min(enter, leave)
})

// For telemetry
const cameraDistance = ref(6000)
const cameraFov = ref(45)
const planetRotation = ref(0)
const mainContainer = ref<HTMLElement | null>(null)

const { lenis } = useLenis()

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
  const target = maxScroll * 0.48
  if (lenis.value) {
    lenis.value.scrollTo(target, { immediate: true })
  } else {
    window.scrollTo({ top: target, behavior: 'smooth' })
  }
}

onMounted(() => {
  // Handle browser scroll restoration on refresh
  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }
  window.scrollTo(0, 0)
  scrollProgress.value = 0
  sceneLoadTimer = window.setTimeout(() => {
    sceneRequested.value = true
  }, 120)
  
  ctx = gsap.context(() => {
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
  
  updateTelemetry()
  telemetryInterval = window.setInterval(updateTelemetry, 200)
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
