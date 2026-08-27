// rollup.config.mjs
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import terser from "@rollup/plugin-terser";
import fs from "node:fs";
import path from "node:path";

// 复制手写的类型声明文件（src/types/*.d.ts）到 dist/types/，
// 因为 rollup-plugin-typescript2 只处理入口链上的 .ts 文件，不会复制独立 .d.ts。
// 否则 dist/core/*.d.ts 里 `import ... from "../types/ble"` 会悬空。
const copyTypesPlugin = {
  name: "copy-types",
  writeBundle() {
    const srcDir = path.resolve("src/types");
    const outDir = path.resolve("dist/types");
    fs.mkdirSync(outDir, { recursive: true });
    for (const file of fs.readdirSync(srcDir)) {
      if (file.endsWith(".d.ts")) {
        fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
      }
    }
  },
};

// 共享的压缩配置（每个产物单独创建 terser 实例，避免共享实例状态）
const terserOptions = {
  compress: {
    passes: 2, // 多轮压缩，进一步减小体积
  },
  mangle: true,
  format: {
    // 移除所有注释；如需保留 @license 之类的横幅注释，改为 /^!/
    comments: false,
  },
};

export default {
  input: "src/index.ts", // 打包入口
  output: [
    {
      file: "dist/index.cjs.js",
      format: "cjs", // CommonJS，适用于 require()
      sourcemap: false,
      plugins: [terser(terserOptions)],
    },
    {
      file: "dist/index.esm.js",
      format: "esm", // ESM，适用于 import
      sourcemap: false,
      plugins: [terser(terserOptions)],
    },
  ],
  // 注：wx 作为全局变量使用（非 import），无需 external 标记
  plugins: [
    resolve(),
    commonjs(),
    // 使用 tsconfig 的配置生成类型声明文件
    typescript({
      useTsconfigDeclarationDir: true,
    }),
    copyTypesPlugin,
  ],
};
