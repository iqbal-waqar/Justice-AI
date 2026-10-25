/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#1e293b',
          900: '#0f172a',
          950: '#030712',
        },
        accent: '#bf953f',
        gold: {
          300: '#e8c986',
          400: '#d4a853',
          500: '#bf953f',
          600: '#a67c2e',
          700: '#845f1f',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 0 1px rgba(212,168,83,0.2), 0 8px 40px -8px rgba(191,149,63,0.45)',
        'glow-indigo': '0 0 0 1px rgba(129,140,248,0.2), 0 8px 40px -8px rgba(99,102,241,0.45)',
        'card': '0 1px 2px rgba(0,0,0,0.3), 0 12px 40px -12px rgba(0,0,0,0.5)',
        'inner-top': 'inset 0 1px 0 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #e8c986 0%, #d4a853 40%, #bf953f 100%)',
        'aurora': 'radial-gradient(60% 60% at 20% 10%, rgba(99,102,241,0.12) 0%, transparent 60%), radial-gradient(50% 50% at 85% 20%, rgba(191,149,63,0.10) 0%, transparent 60%), radial-gradient(50% 60% at 50% 100%, rgba(139,92,246,0.10) 0%, transparent 60%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'gradient-x': 'gradientX 6s ease infinite',
        'glow-pulse': 'glowPulse 3.5s ease-in-out infinite',
        'float-slow': 'floatSlow 7s ease-in-out infinite',
        'aurora-shift': 'auroraShift 18s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInLeft: { '0%': { opacity: '0', transform: 'translateX(-16px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        gradientX: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        glowPulse: { '0%,100%': { opacity: '0.4' }, '50%': { opacity: '0.85' } },
        floatSlow: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        auroraShift: { '0%': { transform: 'translate3d(0,0,0) scale(1)' }, '100%': { transform: 'translate3d(0,-3%,0) scale(1.08)' } },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
