/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.njk', './src/**/*.html', './js/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        'space-mono': ['"Space Mono"', 'monospace'],
        'dm-sans': ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        ink: {
          DEFAULT: 'var(--ink)',
          light: 'var(--ink-light)',
          mid: 'var(--ink-mid)',
        },
        cyan: {
          DEFAULT: 'var(--cyan)',
          dim: 'var(--cyan-dim)',
          mid: 'var(--cyan-mid)',
          glow: 'var(--cyan-glow)',
        },
        green: 'var(--green)',
        amber: 'var(--amber)',
        red: 'var(--red)',
        white: 'var(--white)',
        muted: {
          DEFAULT: 'var(--muted)',
          dim: 'var(--muted-dim)',
        },
        'border-subtle': 'var(--border-subtle)',
        'border-faint': 'var(--border-faint)',
        surface: 'var(--surface)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out both',
        'fade-up-delay-1': 'fadeUp 0.6s 0.1s ease-out both',
        'fade-up-delay-2': 'fadeUp 0.6s 0.2s ease-out both',
        'fade-up-delay-3': 'fadeUp 0.6s 0.3s ease-out both',
        'fade-up-delay-4': 'fadeUp 0.6s 0.4s ease-out both',
        'fade-up-delay-5': 'fadeUp 0.6s 0.5s ease-out both',
        'fade-up-slow': 'fadeUp 0.7s 0.3s ease-out both',
        'spin-loader': 'spin 0.7s linear infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-opacity': 'pulseOpacity 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        spin: {
          to: { transform: 'rotate(360deg)' },
        },
        slideIn: {
          from: { transform: 'translateX(400px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        pulseOpacity: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
    },
  },
  plugins: [typography],
};
