// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // 全局忽略：构建产物、依赖、文档归档等不参与 lint
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'rollup/**',
      'out/**',
      'build/**',
      'change-log/**',
      'doc/**',
      'skills/**',
      '.workbuddy/**',
    ],
  },
  // JS / MJS 配置文件（Rollup 构建、ESLint 自身）
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // TypeScript 源码
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      // 项目自定义规则按需补充在这里
    },
  },
  // 关闭与 Prettier 冲突的格式化类规则（必须放在最后）
  eslintConfigPrettier,
);
