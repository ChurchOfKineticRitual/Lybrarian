/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Mobile-first minimum tap target sizes
      minHeight: {
        'tap': '44px',
      },
      minWidth: {
        'tap': '44px',
      }
    },
  },
  plugins: [],
}
