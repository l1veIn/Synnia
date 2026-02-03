import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const appBinaryName = process.platform === 'win32' ? 'synnia.exe' : 'synnia';
const appPath = path.resolve(repoRoot, 'src-tauri', 'target', 'debug', appBinaryName);

const tauriDriverName = process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver';
const tauriDriverPath = process.env.TAURI_DRIVER || path.resolve(os.homedir(), '.cargo', 'bin', tauriDriverName);

let tauriDriverProcess = null;
let exit = false;

export const config = {
  specs: ['./test/specs/**/*.e2e.js'],
  maxInstances: 1,
  capabilities: [
    {
      'tauri:options': {
        application: appPath
      }
    }
  ],
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: [],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000
  },
  hostname: '127.0.0.1',
  port: 4444,
  path: '/',

  onPrepare: () => {
    // Ensure the app is built (debug, no bundle) before starting the driver.
    const buildResult = spawnSync(
      'pnpm',
      ['tauri', 'build', '--', '--debug', '--no-bundle'],
      { cwd: repoRoot, stdio: 'inherit', shell: true }
    );

    if (buildResult.status !== 0) {
      throw new Error('Tauri build failed. See logs above.');
    }
  },

  beforeSession: () => {
    tauriDriverProcess = spawn(tauriDriverPath, { stdio: 'inherit' });

    tauriDriverProcess.on('error', (error) => {
      console.error('tauri-driver error:', error);
      process.exit(1);
    });

    tauriDriverProcess.on('exit', (code) => {
      if (!exit) {
        console.error('tauri-driver exited with code:', code);
        process.exit(1);
      }
    });
  },

  afterSession: () => {
    closeTauriDriver();
  }
};

function closeTauriDriver() {
  exit = true;
  tauriDriverProcess?.kill();
  tauriDriverProcess = null;
}

function onShutdown(fn) {
  const cleanup = () => {
    try {
      fn();
    } finally {
      process.exit();
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGHUP', cleanup);
  process.on('SIGBREAK', cleanup);
}

onShutdown(() => {
  closeTauriDriver();
});
