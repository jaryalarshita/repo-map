/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neon-cyan': '#00f5ff',
        'neon-green': '#39ff14',
        'neon-orange': '#ff6b00',
        'glass-bg': 'rgba(255,255,255,0.05)',
        'dark-base': '#0a0e1a',
        'dark-surface': '#111827',
        'node-frontend': '#4A90E2',
        'node-backend': '#FF6B6B',
        'node-folder': '#FFC857',
        'node-file': '#2ECC71',
        'node-config': '#9B59B6',
        'node-external': '#7F8C8D',
        'link-import': '#74B9FF',
        'link-dep': '#BDC3C7',
      },
    },
  },
  plugins: [],
};
