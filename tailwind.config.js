/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: { navy: '#102d49', teal: '#087f78' },
      fontFamily: { sans: ['Arial', 'Helvetica', 'sans-serif'] },
    },
  },
  plugins: [],
};
