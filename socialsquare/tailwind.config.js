/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        pacifico: ['Pacifico', 'cursive'],
        nosifer: ['Nosifer', 'serif'],
        poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
        themeStart: '#667eea',
        themeEnd: '#764ba2',
        themeAccent: '#808bf5',
      },
      boxShadow: {
        bordershadow: 'rgba(100, 100, 111, 0.2) 0px 7px 29px 0px',
      },
    },
  },
  plugins: [],
}

