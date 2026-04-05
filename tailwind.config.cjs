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
    'bg-teamColor',
    'text-teamColor',
    'border-teamColor',
    'ring-teamColor',
    'shadow-teamColor',
  ],
  theme: {
    extend: {
      colors: {
        teamColor: ({ opacityVariable, opacityValue }) => {
          if (opacityValue !== undefined) {
            return `rgba(var(--team-color-rgb), ${opacityValue})`;
          }
          if (opacityVariable !== undefined) {
            return `rgba(var(--team-color-rgb), var(${opacityVariable}, 1))`;
          }
          return `rgb(var(--team-color-rgb))`;
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
};
