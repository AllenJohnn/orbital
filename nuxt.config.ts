// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/fonts'],
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: ['400', '500', '600', '700'], preload: true },
      { name: 'Cinzel', provider: 'google', weights: ['400', '500', '600', '700'], preload: true }
    ]
  },
  css: ['~/assets/css/main.css']
})
