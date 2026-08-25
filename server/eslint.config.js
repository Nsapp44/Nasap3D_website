// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Malformed/unescaped quotes inside a string literal are a syntax
      // error the parser already rejects before this rule ever runs — this
      // just forces one consistent quote style so Prettier and ESLint never
      // fight each other over it.
      quotes: ["error", "double", { avoidEscape: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
