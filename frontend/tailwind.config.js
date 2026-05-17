/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zammsa: {
          // Modernized primary palette (teal/cyan) while preserving existing utility names.
          green: '#0f766e',
          'green-dark': '#115e59',
          'green-light': '#14b8a6',
          // Modernized secondary accent (amber).
          orange: '#f59e0b',
          'orange-dark': '#d97706',
          'orange-light': '#fbbf24',
          black: '#000000',
          gray: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
