/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html", // Important: Scans your main HTML file
      "./src/**/*.{js,ts,jsx,tsx}", // Scans all JS, TS, JSX, TSX files in the src folder
    ],
    theme: {
      extend: {
        // You can extend the default Tailwind theme here
        // For example, adding custom colors, fonts, etc.
        // colors: {
        //   'custom-blue': '#243c5a',
        // },
        fontFamily: {
          sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        },
      },
    },
    plugins: [
      require('@tailwindcss/typography'), // Useful for styling markdown-like content (e.g., from an AI)
      // Add other Tailwind plugins here if needed
    ],
  }
  