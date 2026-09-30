/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // Arc design tokens are exposed as CSS variables in index.css.
      // Reference them in Tailwind with arbitrary values: text-[var(--ink)], etc.
    },
  },
  plugins: [],
}


