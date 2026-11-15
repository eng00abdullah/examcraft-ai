/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Vermilion Brand
        vermilion: {
          DEFAULT: '#E64B3C',
          primary: '#E64B3C',
          hover: '#CC3E31',
          pressed: '#B73529',
          light: '#FFF0EC',
          border: '#F4C1B8',
          50: '#FFF0EC',
          100: '#FFE0D8',
          200: '#F4C1B8',
          300: '#E99B8E',
          400: '#EC7163',
          500: '#E64B3C',
          600: '#CC3E31',
          700: '#B73529',
          800: '#942B21',
          900: '#7A241B',
        },
        // Dark Foundation
        graphite: {
          page: '#17191A',
          DEFAULT: '#17191A',
          surface: '#1E2224',
          elevated: '#292D2F',
          border: '#373C3E',
          text: '#F5F2EC',
          muted: '#B9BEBC',
        },
        // Warm Light Foundation
        paper: {
          page: '#F5F2EC',
          DEFAULT: '#F5F2EC',
          elevated: '#FAF8F4',
          card: '#FFFFFF',
          border: '#E7E2DA',
          stone: '#D6DCD5',
          ink: '#202426',
          muted: '#667078',
        },
        // Semantic Status
        status: {
          success: '#168A65',
          'success-bg': '#E8F5EE',
          warning: '#B7791F',
          'warning-bg': '#FFF4D8',
          error: '#C94444',
          'error-bg': '#FCEAEA',
          info: '#467B87',
          'info-bg': '#EAF3F4',
        },
        // Backward-compatible aliases remapped to Vermilion Edition palette
        darklab: {
          bg: '#17191A',       // Deep Graphite
          panel: '#1E2224',    // Charcoal Surface
          elevated: '#292D2F', // Graphite Elevated
          border: '#373C3E',   // Dark Divider
          highlight: '#E64B3C',// Vermilion Primary
          cyan: '#E64B3C',
        },
        lightdash: {
          bg: '#F5F2EC',       // Warm Paper
          card: '#FFFFFF',     // Pure White
          elevated: '#FAF8F4', // Paper Elevated
          border: '#E7E2DA',   // Warm Border
          text: '#202426',     // Deep Ink
          muted: '#667078',    // Muted Ink
        },
      },
      fontFamily: {
        display: ['Manrope', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '10px',
        'xl': '12px',
        '2xl': '16px',
        '3xl': '22px',
        'hero': '26px',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.06)',
        'card': '0 2px 4px rgba(0, 0, 0, 0.03), 0 4px 12px rgba(0, 0, 0, 0.05)',
        'elevated': '0 4px 6px rgba(0, 0, 0, 0.04), 0 10px 24px rgba(0, 0, 0, 0.08)',
        'vermilion': '0 4px 14px 0 rgba(230, 75, 60, 0.28)',
        'vermilion-lg': '0 8px 24px 0 rgba(230, 75, 60, 0.35)',
        'dark-card': '0 4px 20px rgba(0, 0, 0, 0.35)',
      },
      transitionDuration: {
        'micro': '150ms',
        'base': '220ms',
        'panel': '320ms',
        'enter': '520ms',
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
