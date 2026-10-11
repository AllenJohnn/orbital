import Lenis from 'lenis'
import gsap from 'gsap'
import { onMounted, onUnmounted, ref } from 'vue'

export const useLenis = () => {
  const lenis = ref<Lenis | null>(null)

  const resize = () => {
    lenis.value?.resize()
  }

  onMounted(() => {
    if (typeof window === 'undefined') return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const instance = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      autoRaf: true,
      syncTouch: false
    })
    lenis.value = instance

    // Ensure dimensions are accurately measured once DOM settles
    window.requestAnimationFrame(() => {
      instance.resize()
    })
  })

  onUnmounted(() => {
    lenis.value?.destroy()
    lenis.value = null
  })

  return { lenis, resize }
}
