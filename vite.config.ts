import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: '/',
    define: {
      // Map multiple possible environment variable names to the strict process.env.API_KEY required by the SDK.
      // This allows the user to set VITE_GEMINI_API_KEY or VITE_API_KEY in Vercel.
      'process.env.API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY || 
        env.VITE_API_KEY || 
        process.env.VITE_GEMINI_API_KEY || 
        process.env.VITE_API_KEY
      )
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  }
})