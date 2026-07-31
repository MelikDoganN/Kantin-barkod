/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-active)',
          soft: 'var(--color-primary-soft)',
        },
        surface: {
          DEFAULT: 'var(--color-bg)',
          card: 'var(--color-card)',
        },
        ink: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
        },
        brand: {
          50: 'var(--color-primary-soft)',
          100: 'var(--color-primary-soft)',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: 'var(--color-primary)',
          600: 'var(--color-primary-active)',
          700: '#c2410c',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          soft: 'var(--color-success-soft)',
          50: 'var(--color-success-soft)',
          500: 'var(--color-success)',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
          50: 'var(--color-warning-soft)',
          500: 'var(--color-warning)',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          soft: 'var(--color-danger-soft)',
          50: 'var(--color-danger-soft)',
          500: 'var(--color-danger)',
          600: '#dc2626',
          700: '#b91c1c',
        },
        emerald: {
          50: 'var(--color-success-soft)',
          200: '#a7f3d0',
          500: 'var(--color-success)',
          600: '#059669',
          700: '#047857',
        },
        amber: {
          50: 'var(--color-warning-soft)',
          200: '#fde68a',
          500: 'var(--color-warning)',
          600: '#d97706',
          700: '#b45309',
        },
        red: {
          50: 'var(--color-danger-soft)',
          200: '#fecaca',
          500: 'var(--color-danger)',
          600: '#dc2626',
          700: '#b91c1c',
        },
        navy: {
          50: 'var(--color-muted-surface)',
          100: 'var(--color-border)',
          700: '#1a1a1a',
          800: '#1a1a1a',
          900: '#111111',
          950: '#0a0a0a',
        },
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        panel: 'var(--shadow-panel)',
      },
      spacing: {
        'sidebar-collapsed': 'var(--sidebar-collapsed)',
        'sidebar-expanded': 'var(--sidebar-expanded)',
      },
      transitionDuration: {
        sidebar: '280ms',
      },
    },
  },
  plugins: [],
}
