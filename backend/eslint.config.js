import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["coverage", "dist"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      globals: { ...globals.node },
      parserOptions: { sourceType: "module" },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];
