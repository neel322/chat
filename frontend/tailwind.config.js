/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-base': '#090d16',
        'surface-rail': '#060910',
        'surface-card': '#0e1320',
        'surface-hover': '#161e30',
        'surface-input': '#111726',
        'cyan-neon': '#00f0ff',
      },
      fontFamily: {
        headline: ['Space Grotesk', 'sans-serif'],
        body: ['Geist', 'sans-serif'],
        code: ['Geist', 'monospace']
      }
    }
  },
  plugins: []
};