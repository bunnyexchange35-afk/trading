/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05070d',
          900: '#080b13',
          850: '#0b0f1a',
          800: '#0e1320',
          700: '#141b2d',
          600: '#1c253a',
          500: '#26314d',
        },
        neon: {
          green: '#22ff9a',
          cyan: '#00e5ff',
          purple: '#a855f7',
          pink: '#ff4d8d',
          amber: '#ffb020',
          red: '#ff4d5e',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(34, 255, 154, 0.18)',
        'glow-cyan': '0 0 24px rgba(0, 229, 255, 0.18)',
        'glow-purple': '0 0 24px rgba(168, 85, 247, 0.22)',
        card: '0 10px 40px -12px rgba(0, 0, 0, 0.6)',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.25' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-dot': 'pulseDot 1.2s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        scan: 'scan 3s linear infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};
