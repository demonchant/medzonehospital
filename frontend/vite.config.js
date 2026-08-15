import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    clearMocks: true,
    environment: "jsdom",
    include: ["test/**/*.component.test.jsx"],
    setupFiles: ["./test/setup.js"],
  },
});
