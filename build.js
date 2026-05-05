import fs from 'fs';
import path from 'path';
import esbuild from 'esbuild';
import { execSync } from 'child_process';

const root = path.resolve('./');
const outDir = path.join(root, 'dist');
const entryPoint = path.join(root, 'js', 'main.js');
const cssEntryPoint = path.join(root, 'css', 'styles.css');
const outScriptFile = path.join(outDir, 'main.js');
const outCssFile = path.join(outDir, 'styles.css');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function build() {
  // Build CSS with Tailwind
  console.log('Building CSS with Tailwind...');
  execSync('npx tailwindcss -i css/styles.css -o dist/styles.css --minify', {
    stdio: 'inherit',
  });

  // Build JavaScript with esbuild
  await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    minify: true,
    sourcemap: false,
    target: ['es2020'],
    outfile: outScriptFile,
  });

  // Run 11ty to generate HTML from src/
  console.log('Building HTML with 11ty...');
  execSync('npx @11ty/eleventy --input=src --output=dist', {
    stdio: 'inherit',
  });

  // Copy assets
  const assetsDir = path.join(root, 'assets');
  const outAssetsDir = path.join(outDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    fs.cpSync(assetsDir, outAssetsDir, { recursive: true, force: true });
  }

  console.log(`Built ReviewRadar into ${outDir}`);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
