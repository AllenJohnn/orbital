import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { onMounted, onUnmounted, ref } from 'vue'

gsap.registerPlugin(ScrollTrigger)

export const useLenis = () => {
  const lenis = ref<Lenis | null>(null)
  let tickLenis: ((time: number) => void) | undefined

  let resizeTimer: ReturnType<typeof setTimeout> | undefined

  const resize = () => {
    lenis.value?.resize()
    ScrollTrigger.refresh()
  }

  const onResize = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resize, 80)
  }

  onMounted(() => {
    if (typeof window === 'undefined') return

    window.addEventListener('resize', onResize, { passive: true })
    window.visualViewport?.addEventListener('resize', onResize, { passive: true })
    resizeTimer = setTimeout(resize, 80)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const instance = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      autoRaf: false,
      syncTouch: false
    })
    lenis.value = instance

    gsap.ticker.lagSmoothing(0)
    tickLenis = (time: number) => instance.raf(time * 1000)
    gsap.ticker.add(tickLenis)
    instance.on('scroll', ScrollTrigger.update)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onResize)
    window.visualViewport?.removeEventListener('resize', onResize)
    if (resizeTimer) clearTimeout(resizeTimer)
    const instance = lenis.value
    if (instance) {
      instance.off('scroll', ScrollTrigger.update)
      if (tickLenis) gsap.ticker.remove(tickLenis)
      instance.destroy()
    }
    tickLenis = undefined
    lenis.value = null
  })

  return { lenis, resize }
}
