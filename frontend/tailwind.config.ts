import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '"IBM Plex Sans Arabic"',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
      colors: {
        navy: {
          DEFAULT: '#0F2137',
          light: '#102438',
          surface: '#152C45',
          elevated: '#1B3654',
          deep: '#0A1626',
        },
        canvas: '#F1F5F9',
        brand: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#0891B2',
          600: '#0E7490',
          700: '#155E75',
          800: '#164E63',
          900: '#083344',
          950: '#05222E',
        },
      },
      boxShadow: {
        'card-subtle': '0 1px 2px rgba(15, 33, 55, 0.04), 0 6px 20px -12px rgba(15, 33, 55, 0.08)',
        'card-hover': '0 4px 14px -4px rgba(14, 116, 144, 0.12), 0 2px 6px rgba(15, 33, 55, 0.04)',
        'executive': '0 24px 54px -20px rgba(15, 33, 55, 0.22), 0 4px 16px -4px rgba(15, 33, 55, 0.06)',
        'petrol-glow': '0 8px 20px -6px rgba(14, 116, 144, 0.42)',
      },
    },
  },
  plugins: [],
};

export default config;
