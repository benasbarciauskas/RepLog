/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0c0d0f',
        surface: '#151617',
        'surface-elevated': '#1e1f20',
        foreground: '#f4f5f6',
        'muted-foreground': '#9d9ea2',
        border: 'rgba(255,255,255,0.09)',
        highlight: '#a2eb3c',
        'highlight-foreground': '#141609',
        'highlight-muted': 'rgba(162,235,60,0.12)',
      },
    },
  },
  plugins: [],
};