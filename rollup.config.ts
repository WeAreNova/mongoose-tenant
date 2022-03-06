import typescriptPlugin from "@rollup/plugin-typescript";
import { defineConfig } from "rollup";
import copyPlugin from "rollup-plugin-copy";
import packageJSON from "./lib/package.json";

const EXTERNALS = Object.keys(packageJSON.peerDependencies);

export default defineConfig({
  input: "lib/index.ts",
  external: EXTERNALS,
  output: {
    dir: "build/",
    format: "cjs",
    exports: "named",
    sourcemap: true,
  },
  plugins: [
    typescriptPlugin({ tsconfig: "lib/tsconfig.json", outDir: "build" }),
    copyPlugin({
      targets: [
        { src: "lib/package.json", dest: "build" },
        { src: "lib/mongoose.d.ts", dest: "build" },
        { src: "README.md", dest: "build" },
        { src: "LICENSE", dest: "build" },
      ],
    }),
  ],
});
