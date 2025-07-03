/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#d94123',
          100: '#d94123',
          200: '#d94123',
          300: '#d94123',
          400: '#d94123',
          500: '#d94123',
          600: '#d94123',
          700: '#1d4ed8',
          800: '#d94123',
          900: '#d94123'
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 