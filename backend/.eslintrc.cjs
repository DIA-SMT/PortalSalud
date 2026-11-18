module.exports = {
  root: true,
  env: { node: true, es2023: true },
  extends: ["eslint:recommended"],
  parserOptions: { ecmaVersion: "latest", sourceType: "script" },
  ignorePatterns: ["datos/", "node_modules/"],
  overrides: [
    {
      files: ["test/**/*.mjs", "vitest.config.mjs"],
      parserOptions: { sourceType: "module" },
    },
  ],
  rules: {
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
};
