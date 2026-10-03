<template>
  <div ref="mainContainer" class="h-[800vh] bg-black relative">
    <OrbitalScene ref="sceneComponent" :scroll-progress="scrollProgress" class="sticky top-0 h-screen w-full" />
    <OrbitalIntro ref="introComponent" :style="{ opacity: Math.max(0, 1 - scrollProgress * 5), transform: `translateY(${-scrollProgress * 1000}px)` }" />
    
    <!-- Debug UI -->
    <div class="fixed top-4 left-4 z-50 bg-black/80 text-white font-mono text-xs p-4 rounded leading-relaxed border border-white/20 pointer-events-none">
      <div class="text-white/50 mb-2 border-b border-white/20 pb-1">ORBITAL TELEMETRY</div>
      <div>SCROLL: {{ scrollProgress.toFixed(3) }}</div>
      <div>CAMERA DISTANCE: {{ cameraDistance.toFixed(1) }}</div>
      <div>PLANET RADIUS: 400</div>
      <div>APPARENT DIAMETER: {{ ((800 / cameraDistance) * 100).toFixed(1) }}%</div>
      <div>PLANET ROTATION: {{ planetRotation.toFixed(1) }}°</div>
      <div>CLOUD ROTATION: {{ (planetRotation * 1.1).toFixed(1) }}°</div>
      <div>FOV: {{ cameraFov.toFixed(1) }}</div>
    </div>

    <!-- Phase 02 UI -->
    <div class="phase-02-ui fixed inset-0 z-10 pointer-events-none flex flex-col justify-end p-12 transition-opacity duration-300"
         :style="{ opacity: scrollProgress > 0.7 ? (scrollProgress - 0.7) * 3.33 : 0 }">
      <div class="text-white">
        <div class="text-xs tracking-[0.4em] opacity-50 uppercase mb-2">Target Acquired</div>
        <div class="font-light tracking-[0.2em] text-xl opacity-90">KEPLER-186F</div>
        <div class="text-xs tracking-widest opacity-40 mt-1">APPROACH VECTOR SECURED</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'
import OrbitalScene from '~/components/orbital/OrbitalScene.vue'
import OrbitalIntro from '~/components/orbital/OrbitalIntro.vue'
import { useLenis } from '~/composables/useLenis'

const sceneComponent = ref<InstanceType<typeof OrbitalScene> | null>(null)
const introComponent = ref<InstanceType<typeof OrbitalIntro> | null>(null)
const scrollProgress = ref(0)

// For telemetry
const cameraDistance = ref(6000)
const cameraFov = ref(45)
const planetRotation = ref(0)
const mainContainer = ref<HTMLElement | null>(null)

const { lenis } = useLenis()

// We'll update the telemetry variables in a fast interval or RAF
let telemetryRaf: number
let ctx: gsap.Context

const updateTelemetry = () => {
  telemetryRaf = requestAnimationFrame(updateTelemetry)
  
  if (sceneComponent.value && sceneComponent.value.orbital) {
    const cam = sceneComponent.value.orbital.camera
    if (cam) {
      cameraDistance.value = cam.position.z // Since planet is at 0, Z is distance
      cameraFov.value = cam.fov
    }
    planetRotation.value = sceneComponent.value.orbital.surfaceRotation * (180 / Math.PI)
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

onMounted(() => {
  // Handle browser scroll restoration on refresh
  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }
  window.scrollTo(0, 0)
  scrollProgress.value = 0
  
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
})

onBeforeUnmount(() => {
  if (ctx) ctx.revert()
  if (lenis.value) {
    lenis.value.off('scroll', onScroll)
  } else {
    window.removeEventListener('scroll', onScroll)
  }
  cancelAnimationFrame(telemetryRaf)
})
</script>
