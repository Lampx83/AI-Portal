#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline');
const tar = require('tar');

const TEMPLATE_URL = 'https://github.com/Lampx83/AI-Portal/archive/refs/heads/main.tar.gz';
const TEMPLATE_ROOT_FOLDER = 'AI-Portal-main';

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

function ask(question, defaultAnswer = 'n') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const def = defaultAnswer === 'y' ? 'Y/n' : 'y/N';
  return new Promise((resolve) => {
    rl.question(`${question} (${def}) `, (answer) => {
      rl.close();
      const a = (answer || defaultAnswer).trim().toLowerCase();
      resolve(a === 'y' || a === 'yes');
    });
  });
}

function askFolderName(question, defaultName = 'ai-portal-app') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (${defaultName}) `, (answer) => {
      rl.close();
      const name = (answer || defaultName).trim() || defaultName;
      resolve(name.replace(/[/\\]/g, '')); // strip path separators
    });
  });
}

async function main() {
  let projectName = process.argv[2];
  if (projectName === undefined || projectName === '') {
    console.log('\n  create-ai-portal\n');
    projectName = await askFolderName('  What is the project folder name?', 'ai-portal-app');
    if (!projectName) {
      console.error('  Error: Folder name cannot be empty.');
      process.exit(1);
    }
  } else {
    console.log('\n  create-ai-portal\n');
  }
  const targetDir = path.resolve(process.cwd(), projectName);
  console.log('  Creating a new AI-Portal project in:', targetDir);
  console.log('');

  if (fs.existsSync(targetDir)) {
    console.error(`Error: Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  const tmpDir = path.join(process.cwd(), `.create-ai-portal-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    process.stdout.write('  Downloading AI-Portal template... ');
    const buf = await download(TEMPLATE_URL);
    const tarball = path.join(tmpDir, 'template.tar.gz');
    fs.writeFileSync(tarball, buf);
    console.log('done.');

    process.stdout.write('  Extracting... ');
    await tar.x({ file: tarball, cwd: tmpDir });
    const extracted = path.join(tmpDir, TEMPLATE_ROOT_FOLDER);
    if (!fs.existsSync(extracted)) {
      throw new Error(`Expected folder "${TEMPLATE_ROOT_FOLDER}" not found after extract.`);
    }
    fs.mkdirSync(targetDir, { recursive: true });
    copyRecursive(extracted, targetDir);
    console.log('done.');

    // No .env: configure via /setup (app name, icon, DB name) and /admin (rest)

    // Remove create-ai-portal from the scaffold (user doesn't need it in their project)
    const scaffoldCli = path.join(targetDir, 'create-ai-portal');
    if (fs.existsSync(scaffoldCli)) {
      fs.rmSync(scaffoldCli, { recursive: true });
    }
  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  }

  console.log('');
  console.log('  Success! AI-Portal project created.');
  console.log('');

  const runDocker = await ask('  Start with Docker now?', 'y');
  if (runDocker) {
    const docker = spawnSync('docker', ['compose', 'up', '-d'], {
      cwd: targetDir,
      stdio: 'inherit',
      shell: true,
    });
    if (docker.status !== 0) {
      console.log('\n  Docker Compose failed or not installed. Run manually:');
      console.log(`    cd ${projectName} && docker compose up -d`);
    } else {
      console.log('\n  Frontend: http://localhost:3000');
      console.log('  Backend:  http://localhost:3001');
    }
  } else {
    console.log('  Next steps:');
    console.log(`    cd ${projectName}`);
    console.log('    docker compose up -d');
    console.log('');
    console.log('  Then open http://localhost:3000 → /setup (app name, icon, DB name) → /admin for the rest.');
  }
  console.log('');
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === '.git') continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

main().catch((err) => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
