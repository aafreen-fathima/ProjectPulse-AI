import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rag: { green: "#22c55e", amber: "#f59e0b", red: "#ef4444" },
        brand: { 50: "#eff6ff", 500: "#7c3aed", 600: "#6d28d9", 900: "#1e1b4b" },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui"] },
    },
  },
  plugins: [],
};
export default config;
