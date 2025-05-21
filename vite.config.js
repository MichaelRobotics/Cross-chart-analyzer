import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Optional: If your index.html is not in the root, or you have other specific needs,
  // you might add more configurations here. For a standard setup, this is often enough.
  // server: {
  //   port: 3000, // Example: change development server port
  // },
  // build: {
  //   outDir: 'dist', // Default output directory
  // }
})
