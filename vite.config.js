import { defineConfig } from 'vite'
import viteImagemin from 'vite-plugin-imagemin'
import glsl from 'vite-plugin-glsl'

let colors = []
let reserved = [...['_current_frame'], ...colors]

export default defineConfig({
  base: './',
  plugins: [glsl({ compress: true }), viteImagemin({
    optipng: { optimizationLevel: 7 }
  })],
  build: {
    assetsInlineLimit: 0,
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      mangle: {
        module: true,
        properties: {
          //debug: true,
          keep_quoted: 'strict',
          reserved
        }
      }
    },
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].min.js',
      }
    }
  }
})