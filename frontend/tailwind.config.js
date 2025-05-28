/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-nunito)',
          'Nunito',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'SF Pro Display',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        rounded: [
          'var(--font-nunito)',
          'Nunito',
          'SF Pro Rounded',
          'ui-rounded',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0em' }],
        'sm': ['0.875rem', { lineHeight: '1.6', letterSpacing: '0em' }],
        'base': ['1rem', { lineHeight: '1.6', letterSpacing: '-0.005em' }],
        'lg': ['1.125rem', { lineHeight: '1.5', letterSpacing: '-0.01em' }],
        'xl': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        '2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.015em' }],
        '3xl': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        '4xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        '5xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        '6xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
    },
  },
  plugins: [],
} 