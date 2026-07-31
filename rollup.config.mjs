// rollup.config.mjs
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

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
