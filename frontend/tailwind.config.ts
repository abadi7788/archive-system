import type { Config } from 'tailwindcss';
const config: Config = { content: ['./app/**/*.{js,ts,jsx,tsx}'], theme: { extend: { colors: { navy: '#0F172A', sky: { 500: '#0EA5E9', 400: '#38BDF8' } } } }, plugins: [] };
export default config;
