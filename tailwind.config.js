/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'fm-blue': '#009BE4',
        'fm-green': '#6CB516',
        'fm-orange': '#D97600',
        'fm-text': '#666666',
        'fm-border': '#D9D9D9',
        'fm-bg': '#F5F5F5',
        'fm-bg-light': '#FAFAFA',
      },
      fontFamily: {
        'arial': ['Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
