import fs from 'fs-extra';
import fetch from 'node-fetch';
import path from 'path';
import sass from 'sass';
import less from 'less';
import cssnano from 'cssnano';
import { rollup } from 'rollup';
import virtual from '@rollup/plugin-virtual';
import _ from 'lodash';
import themes from './themes';

const pkg = require('./package.json');

const sassHandler = (input) => {
  const result = sass.renderSync({ data: input });
  return result.css.toString();
};

const lessHandler = async (input) => {
  const { css } = await less.render(input);
  return css;
};

const handlerMap = {
  css: (input) => input,
  sass: sassHandler,
  scss: sassHandler,
  less: lessHandler,
};

(async function main() {
  const result = {};

  fs.ensureDirSync(path.resolve(__dirname, 'dist'));

  for (let [key, p] of Object.entries(themes)) {
    const code = await fetch(
      `https://raw.githubusercontent.com/${p.owner}/${p.repo}/${p.ref}/${p.path}`
    ).then((res) => res.text());

    const ext = path.extname(p.path).slice(1);
    const css = await handlerMap[ext](code);

    const { css: minifedCss } = await cssnano.process(css);

    // write css
    fs.writeFileSync(path.resolve(__dirname, 'dist', key + '.css'), minifedCss);

    result[key] = {
      style: minifedCss,
      highlight: p.highlight,
    };
  }

  // write json
  fs.writeJsonSync(path.resolve(__dirname, 'dist/index.json'), result);

  // write js
  const res = await rollup({
    input: pkg.name,
    plugins: [
      virtual({
        [pkg.name]: 'export default ' + JSON.stringify(result, null, 2),
      }),
    ],
  });
  const output = await res.write({
    format: 'umd',
    name: _.camelCase(pkg.name),
    file: path.resolve(__dirname, 'dist/index.js'),
  });

  // gallery
  fs.writeFileSync(
    path.resolve(__dirname, 'gallery/themes.js'),
    'window.themes=' + JSON.stringify(result)
  );
})();

process.on('unhandledRejection', (error) => {
  console.error('unhandledRejection', error);
  process.exit(1);
});
