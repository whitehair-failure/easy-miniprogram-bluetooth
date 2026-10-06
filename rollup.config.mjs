// rollup.config.mjs
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
import dts from "rollup-plugin-dts";
import terser from "@rollup/plugin-terser";

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

// 共享的 JS 编译插件链
const jsPlugins = [resolve(), commonjs(), typescript()];

export default [
  // 1) JS 产物：CJS（Node / 旧打包器）+ ESM（微信小程序入口）
  {
    input: "src/index.ts", // 打包入口
    output: [
      {
        file: "dist/index.cjs.js",
        format: "cjs", // CommonJS，适用于 require()
        sourcemap: false,
        plugins: [terser(terserOptions)],
      },
      {
        // 微信小程序 npm 入口：包名根目录下必须有 index.js，
        // 否则开发者工具「构建 npm」后 require("包名") 找不到入口。
        // 参见 package.json 的 miniprogram / module / exports 配置。
        file: "dist/index.js",
        format: "esm", // ESM，适用于 import（小程序原生支持 ESM 语法）
        sourcemap: false,
        plugins: [terser(terserOptions)],
      },
    ],
    // 注：wx 作为全局变量使用（非 import），无需 external 标记
    plugins: jsPlugins,
  },

  // 2) 类型声明：把整棵类型依赖树合并为单个 dist/index.d.ts
  //    输入直接取 src 入口，由插件自己从源码生成声明并合并，
  //    因此不再需要 copyTypesPlugin 去补 dist/types/ —— 内容会被内联。
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.d.ts",
      format: "es",
    },
    plugins: [dts()],
  },
];
