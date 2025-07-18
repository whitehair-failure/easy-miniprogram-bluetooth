// rollup.config.mjs
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/index.ts',     // 打包入口
  output: [
    {
      file: 'rollup/index.js',
      format: 'cjs' // CommonJS，适用于 require()
    },
    {
      file: 'rollup/index.esm.js',
      format: 'esm' // ESM，适用于 import
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({ useTsconfigDeclarationDir: false })
  ]
};
