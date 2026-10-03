<template>
  <div ref="mainContainer" class="h-[800vh] bg-black relative">
    <OrbitalScene ref="sceneComponent" class="sticky top-0 h-screen w-full" />
    <OrbitalIntro ref="introComponent" />
    
    <!-- Debug UI -->
    <div class="fixed top-4 left-4 z-50 bg-black/80 text-white font-mono text-xs p-2 rounded">
      SCROLL PROGRESS: {{ scrollProgress.toFixed(3) }}
    </div>

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
const scrollProgress = ref(0)
const mainContainer = ref<HTMLElement | null>(null)

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
          trigger: mainContainer.value,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5,
          onUpdate: (self) => {
            scrollProgress.value = self.progress
          }
        }
      })

      const camera = sceneComponent.value?.camera()
      const stars = sceneComponent.value?.starParticles()
      const planetGroup = sceneComponent.value?.planetGroup()

      // Set base duration for the whole scrub sequence to 1.0 (representing 100% of scroll)
      
      // Phase 01: Leaving Intro (0% to 20%)
      tl.to('.intro-content', {
        y: -200,
        opacity: 0,
        ease: 'power1.inOut',
        duration: 0.2
      }, 0)

      tl.to('.scroll-indicator', {
        opacity: 0,
        duration: 0.1
      }, 0)

      if (camera) {
        // Deep space to Upper Atmosphere (0% to 100%)
        // Starts at Z=6000, ends at Z=550 (Planet is at Z=0, radius=400)
        tl.to(camera.position, {
          z: 550, 
          ease: 'power1.inOut', 
          duration: 1.0
        }, 0)
        
        // Slight lateral drift for a cinematic approach vector
        tl.to(camera.position, {
          x: 40,
          y: -15,
          ease: 'power1.inOut',
          duration: 1.0
        }, 0)
        
        // Dynamic FOV: Start 45, push to 65 for dramatic perspective when close
        tl.to(camera, {
          fov: 65,
          ease: 'power2.in',
          duration: 1.0,
          onUpdate: () => {
            camera.updateProjectionMatrix()
          }
        }, 0)
        
        // Subtle camera banking
        tl.to(camera.rotation, {
          x: 0.05,
          y: -0.05,
          z: 0.03, // Slight roll
          ease: 'power1.inOut',
          duration: 1.0
        }, 0)
      }

      if (stars) {
        // Stars show some parallax as we move
        tl.to(stars.rotation, {
          z: Math.PI / 8,
          x: Math.PI / 16,
          ease: 'power1.inOut',
          duration: 1.0
        }, 0)
        
        // Stars become less visually dominant as we get very close to the planet
        if (stars.material) {
          tl.to((stars.material as THREE.ShaderMaterial).uniforms.uColor.value, {
            r: 0.3,
            g: 0.3,
            b: 0.3,
            ease: 'power2.in',
            duration: 1.0
          }, 0)
        }
      }
      
      if (planetGroup) {
        // Planet slowly rotates into view
        tl.to(planetGroup.rotation, {
          y: Math.PI / 6,
          x: -Math.PI / 24,
          ease: 'power1.inOut',
          duration: 1.0
        }, 0)
      }
      
      // Phase 02: Planet UI emerges (70% to 80%)
      tl.to('.phase-02-ui', {
        opacity: 1,
        duration: 0.1,
        ease: 'power2.out'
      }, 0.7)
      
      // Ensure ScrollTrigger recalculates height
      setTimeout(() => {
        ScrollTrigger.refresh()
      }, 200)
    })
  }, 100)
})

onBeforeUnmount(() => {
  if (ctx) ctx.revert()
})
</script>
