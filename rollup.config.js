import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default {
  input: "build/main.js",
  output: {
    file: "htdocs/main.js",
    format: "iife",
  },
  plugins: [commonjs(), resolve()],
};
