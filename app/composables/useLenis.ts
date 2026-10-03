import Lenis from 'lenis'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'
import { onMounted, onUnmounted, ref } from 'vue'

export const useLenis = () => {
  const lenis = ref<Lenis | null>(null)

  onMounted(() => {
    if (typeof window !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger)

      lenis.value = new Lenis({
        lerp: 0.05,
        smoothWheel: true,
      })

      lenis.value.on('scroll', ScrollTrigger.update)

      const ticker = gsap.ticker
      const updateLenis = (time: number) => {
        lenis.value?.raf(time * 1000)
      }
      
      ticker.add(updateLenis)
      gsap.ticker.lagSmoothing(0)

      onUnmounted(() => {
        ticker.remove(updateLenis)
        lenis.value?.destroy()
      })
    }
  })

  return { lenis }
}
