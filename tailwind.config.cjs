/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './constants.tsx',
    './types.ts',
    './utils/**/*.{ts,tsx}',
  ],
  safelist: [
    'bg-slate-100',
    'bg-slate-200',
    'text-slate-700',
    'text-slate-300',
    'hover:bg-slate-200',
    'dark:bg-slate-900/30',
    'dark:text-slate-300',
  ],
  theme: {
    extend: {
      colors: {
        teamColor: 'var(--team-color)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
};
