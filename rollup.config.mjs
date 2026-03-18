import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';

export default {
  input: 'src/readyled.ts',
  output: {
    file: 'dist/readyled.js',
    format: 'esm',
    sourcemap: false,
  },
  plugins: [
    nodeResolve({
      extensions: ['.js', '.ts'],
    }),
    typescript(),
    copy({
      targets: [
        { src: 'styles/readyled.css', dest: 'dist' },
      ],
      hook: 'writeBundle',
    }),
  ].filter(Boolean),
};
