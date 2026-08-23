/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        anvil: {
          bg: '#0b0d12',
          panel: '#11141c',
          panelHover: '#181b27',
          border: '#1f2433',
          text: '#e6e9f0',
          muted: '#8b92a8',
          accent: '#3b82f6',
          success: '#22c55e',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
      },
    },
  },
  plugins: [],
};
