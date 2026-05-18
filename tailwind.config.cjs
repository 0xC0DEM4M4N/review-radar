/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ["'Space Mono'", 'monospace'],
        'dm-sans': ['DM Sans', 'system-ui', 'sans-serif'],
        'space-mono': ["'Space Mono'", 'monospace'],
      },
      colors: {
        cyan: 'var(--cyan)',
        'cyan-dim': 'var(--cyan-dim)',
        'cyan-mid': 'var(--cyan-mid)',
        'cyan-glow': 'var(--cyan-glow)',
        ink: 'var(--ink)',
        'ink-light': 'var(--ink-light)',
        'ink-mid': 'var(--ink-mid)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        muted: 'var(--muted)',
        'muted-dim': 'var(--muted-dim)',
        green: 'var(--green)',
        red: 'var(--red)',
        amber: 'var(--amber)',
        purple: 'var(--purple)',
        'purple-dim': 'var(--purple-dim)',
        'purple-mid': 'var(--purple-mid)',
        white: 'var(--white)',
        'border-faint': 'var(--border-faint)',
        'border-subtle': 'var(--border-subtle)',
        surface: 'var(--surface)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
