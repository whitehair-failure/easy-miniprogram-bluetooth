// rollup.config.mjs
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/index.ts',     // 打包入口
  output: [
    /* {
      file: 'dist/index.cjs.js',
      format: 'cjs', // CommonJS，适用于 require()
      sourcemap: false, // 微信小程序生产环境不需要 .map 文件
    }, */
    {
      file: 'dist/index.js',
      format: 'esm', // ESM，适用于 import
      sourcemap: false,
      plugins: [
        // 代码压缩：减小最终输出体积（只作用于 JS 产物，不影响 .d.ts 生成）
        terser({
          compress: {
            passes: 2, // 多轮压缩，进一步减小体积
          },
          mangle: true,
          format: {
            // 移除所有注释；如需保留 @license 之类的横幅注释，改为 /^!/
            comments: false,
          },
        }),
      ],
    }
  ],
  // 将微信小程序全局对象标记为外部依赖，不打包
  external: ['wx'],
  plugins: [
    resolve(),
    commonjs(),
    // 使用 tsconfig 的配置生成类型声明文件
    typescript({
      useTsconfigDeclarationDir: true
    })
  ]
};
