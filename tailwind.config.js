/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e0f7fa',
          100: '#b2ebf2',
          200: '#80deea',
          300: '#4dd0e1',
          400: '#26c6da',
          500: '#00bcd4',
          600: '#00acc1',
          700: '#0097a7',
          800: '#00838f',
          900: '#006064',
        },
        secondary: {
          50: '#e0f2f1',
          100: '#b2dfdb',
          200: '#80cbc4',
          300: '#4db6ac',
          400: '#26a69a',
          500: '#009688',
          600: '#00897b',
          700: '#00796b',
          800: '#00695c',
          900: '#004d40',
        },
        accent: {
          cyan: '#00e5ff',
          'cyan-dim': '#00b8d4',
          teal: '#00bfa5',
          'teal-dim': '#009688',
          'accent': '#18ffff'
        },
        bg: {
          DEFAULT: '#040d12',
          card: '#071520',
          panel: '#0a1e2c',
        },
        border: {
          DEFAULT: '#0e3347',
          hi: '#0e5f7a',
        },
        text: {
          pri: '#e0f7fa',
          sec: '#80cbc4',
          mute: '#37626e',
        },
        status: {
          active: '#00e676',
          inactive: '#ff5252',
          maintenance: '#ffd740',
          stock: '#ff9100',
        }
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      }
    },
  },
  plugins: [],
}