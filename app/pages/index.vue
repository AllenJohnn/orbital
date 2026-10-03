<template>
  <div class="h-[400vh] bg-black">
    <OrbitalScene ref="sceneComponent" />
    <OrbitalIntro ref="introComponent" />
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

// Ensure lenis is running
useLenis()

let ctx: gsap.Context

onMounted(() => {
  // Give a small delay to ensure Three.js is initialized
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
      
      // Floating animation for the arrow
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
          scrub: 1.5, // Smooth scrubbing
        }
      })

      const camera = sceneComponent.value?.camera()
      const stars = sceneComponent.value?.starParticles()

      // Title & Scroll Indicator Animations
      tl.to('.intro-content', {
        y: -150,
        opacity: 0,
        ease: 'power1.inOut',
        duration: 2
      }, 0)

      tl.to('.scroll-indicator', {
        opacity: 0,
        duration: 0.5
      }, 0)

      // Camera & Space Animations
      if (camera) {
        // Camera moves forward into the star field
        tl.to(camera.position, {
          z: 100, // Move from 800 to 100
          ease: 'power2.inOut',
          duration: 10
        }, 0)
      }

      if (stars) {
        // Increase parallax/movement effect
        tl.to(stars.rotation, {
          z: Math.PI / 4,
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
