<template>
  <div class="fixed inset-0 w-full h-full bg-black z-0" ref="sceneContainer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useOrbitalScene } from '~/composables/useOrbitalScene'

const sceneContainer = ref<HTMLElement | null>(null)

// useOrbitalScene will handle the three.js initialisation
const { init, cleanup, scene, camera, starParticles, planetGroup } = useOrbitalScene(sceneContainer)

onMounted(() => {
  init()
})

onBeforeUnmount(() => {
  cleanup()
})

defineExpose({
  scene: () => scene,
  camera: () => camera,
  starParticles: () => starParticles,
  planetGroup: () => planetGroup
})
</script>
