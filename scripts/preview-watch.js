import { spawn } from 'child_process';
import { watch } from 'fs';

let building = false;
let pending = false;
let serveProc = null;

function build() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  console.log('\n[preview-watch] Building...\n');

  const proc = spawn('npx', ['next', 'build'], {
    stdio: 'inherit',
    shell: true,
  });

  proc.on('close', (code) => {
    building = false;
    if (code !== 0) {
      console.log('\n[preview-watch] Build failed. Fix errors and save to retry.\n');
    } else {
      console.log('\n[preview-watch] Build complete.\n');
    }
    if (pending) {
      pending = false;
      build();
    }
  });
}

function startServe() {
  serveProc = spawn('npx', ['serve', 'dist', '-l', '3000'], {
    stdio: 'inherit',
    shell: true,
  });
}

function stopServe() {
  if (serveProc) {
    serveProc.kill();
    serveProc = null;
  }
}

// Initial build, then start serving
const initialBuild = spawn('npx', ['next', 'build'], {
  stdio: 'inherit',
  shell: true,
});

initialBuild.on('close', () => {
  startServe();
});

// Watch source directories
const dirs = ['app', 'components', 'lib', 'public'];
const watchers = [];

dirs.forEach((dir) => {
  const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.includes('node_modules')) return;
    if (filename && filename.startsWith('.')) return;
    build();
  });
  watchers.push(watcher);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n[preview-watch] Shutting down...');
  stopServe();
  watchers.forEach((w) => w.close());
  process.exit(0);
});
