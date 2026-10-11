import Lenis from 'lenis'
import gsap from 'gsap'
import { onMounted, onUnmounted, ref } from 'vue'

export const useLenis = () => {
  const lenis = ref<Lenis | null>(null)
  let updateLenis: ((time: number) => void) | null = null

  onMounted(() => {
    if (typeof window === 'undefined') return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const instance = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
    })
    lenis.value = instance

    updateLenis = (time: number) => {
      instance.raf(time * 1000)
    }

    gsap.ticker.add(updateLenis)
    gsap.ticker.lagSmoothing(0)
  })

  onUnmounted(() => {
    if (updateLenis) gsap.ticker.remove(updateLenis)
    updateLenis = null
    lenis.value?.destroy()
    lenis.value = null
    gsap.ticker.lagSmoothing(500, 33)
  })

  return { lenis }
}
