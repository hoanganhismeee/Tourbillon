import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        playfair: ['var(--font-playfair-display)', 'serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
      },
      transitionProperty: {
        'opacity': 'opacity',
        'spacing': 'margin, padding',
      },
    },
  },
  plugins: [],  
};
export default config; 