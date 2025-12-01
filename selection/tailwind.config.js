/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // 确保扫描 src 目录下的所有 React 文件
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}