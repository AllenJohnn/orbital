<template>
  <div class="h-[800vh] bg-black relative">
    <OrbitalScene ref="sceneComponent" class="sticky top-0 h-screen w-full" />
    <OrbitalIntro ref="introComponent" />
    
    <!-- We can add some UI for Phase 02 -->
    <div class="phase-02-ui fixed inset-0 z-10 pointer-events-none flex flex-col justify-end p-12 opacity-0">
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
import ScrollTrigger from 'gsap/ScrollTrigger'
import OrbitalScene from '~/components/orbital/OrbitalScene.vue'
import OrbitalIntro from '~/components/orbital/OrbitalIntro.vue'
import { useLenis } from '~/composables/useLenis'

const sceneComponent = ref<InstanceType<typeof OrbitalScene> | null>(null)
const introComponent = ref<InstanceType<typeof OrbitalIntro> | null>(null)

useLenis()

let ctx: gsap.Context

onMounted(() => {
  setTimeout(() => {
    ctx = gsap.context(() => {
      // 1. Initial State (Fade In from Black)
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

      // 2. Scroll Animation Timeline
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: 'body',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5,
        }
      })

      const camera = sceneComponent.value?.camera()
      const stars = sceneComponent.value?.starParticles()
      const planetGroup = sceneComponent.value?.planetGroup()

      // Phase 01: Leaving Intro (0% to 20%)
      tl.to('.intro-content', {
        y: -200,
        opacity: 0,
        ease: 'power1.inOut',
        duration: 2
      }, 0)

      tl.to('.scroll-indicator', {
        opacity: 0,
        duration: 0.5
      }, 0)

      // Phase 01: Camera moves forward through stars (0% to 100%)
      if (camera) {
        // Move from z=800 all the way to z=-1500 (near the planet which is at -2500)
        tl.to(camera.position, {
          z: -1600, 
          ease: 'power2.inOut',
          duration: 10
        }, 0)
        
        // Slight camera shake/drift for cinematic feel
        tl.to(camera.rotation, {
          x: 0.05,
          y: -0.05,
          z: 0.02,
          ease: 'power1.inOut',
          duration: 10
        }, 0)
      }

      if (stars) {
        tl.to(stars.rotation, {
          z: Math.PI / 4,
          ease: 'power1.inOut',
          duration: 10
        }, 0)
      }
      
      // Phase 02: Planet UI emerges (60% to 80%)
      tl.to('.phase-02-ui', {
        opacity: 1,
        duration: 2,
        ease: 'power2.out'
      }, 6)
      
      // Phase 02: Planet slowly rotates to face us more
      if (planetGroup) {
        tl.to(planetGroup.rotation, {
          y: Math.PI / 6,
          x: -Math.PI / 12,
          ease: 'power1.inOut',
          duration: 10
        }, 0)
      }
    })
  }, 100)
})

onBeforeUnmount(() => {
  if (ctx) ctx.revert()
})
</script>
