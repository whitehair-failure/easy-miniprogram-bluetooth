// rollup.config.mjs
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';

export default {
  input: 'src/index.ts',     // 打包入口
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs', // CommonJS，适用于 require()
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm', // ESM，适用于 import
      sourcemap: true,
    }
  ],
  plugins: [
    resolve(),
    commonjs(),
    // Use tsconfig's declarationDir/outDir so .d.ts files land in ./dist
    typescript({ useTsconfigDeclarationDir: true })
  ]
};
