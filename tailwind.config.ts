import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-plus-jakarta)',
          'var(--font-ibm-plex-arabic)',
          '"IBM Plex Sans Arabic"',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      colors: {
        navy: '#090E1A',
        obsidian: '#0B1120',
        alabaster: '#F6F7F9',
        brand: {
          50: '#EFF4FF',
          100: '#DBE7FE',
          200: '#BFDBFE',
          300: '#93B9FD',
          400: '#5B8DF9',
          500: '#3568F0',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
        },
      },
    },
  },
  plugins: [],
};

export default config;
