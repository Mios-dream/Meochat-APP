// tailwind.config.js
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FFCAD4',
        secondary: '#F7B8B8',
        accent: '#C7CEEA',
        dark: '#5A5A5A',
        light: '#FFFAFA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 4px 20px rgba(0, 0, 0, 0.05)',
        hover: '0 8px 30px rgba(0, 0, 0, 0.1)',
        elevated: '0 10px 30px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
