#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , baseRef = 'origin/trunk', headRef = 'HEAD'] = process.argv;
console.error(`[changed-packages] baseRef=${baseRef} headRef=${headRef}`);

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function getChangedFiles(base, head) {
  try {
    const diff = run(`git diff --name-only ${base} ${head}`);
    const files = diff.split(/\r?\n/).filter(Boolean);
    console.error(`[changed-packages] changed files (${files.length}):`, files);
    return files;
  } catch (error) {
    console.error(`Failed to compute changed files between ${base} and ${head}`);
    throw error;
  }
}

function getWorkspacePackages() {
  const json = run('pnpm ls --depth=-1 --recursive --json');
  const list = JSON.parse(json).map((entry) => ({ name: entry.name, path: entry.path }));
  console.error(
    `[changed-packages] discovered ${list.length} workspace entries:`,
    list.map((pkg) => pkg.name),
  );
  return list;
}

const repoRoot = run('git rev-parse --show-toplevel');
const changedFiles = getChangedFiles(baseRef, headRef);
if (changedFiles.length === 0) {
  console.error('[changed-packages] no changed files detected');
  process.stdout.write('\n');
  process.exit(0);
}

const packages = getWorkspacePackages();
const changedPackages = new Set();

for (const pkg of packages) {
  if (!pkg.path) {
    continue;
  }
  const pkgJsonPath = join(pkg.path, 'package.json');
  let isPrivate = false;
  try {
    const contents = readFileSync(pkgJsonPath, 'utf8');
    const parsed = JSON.parse(contents);
    isPrivate = parsed.private === true;
  } catch (error) {
    // ignore packages without package.json or invalid json
  }
  if (isPrivate) {
    console.error(`[changed-packages] skipping private package ${pkg.name}`);
    continue;
  }

  const relative = pkg.path.startsWith(repoRoot)
    ? pkg.path.slice(repoRoot.length + 1)
    : pkg.path;
  const dir = `${relative}/`;
  if (changedFiles.some((file) => file.startsWith(dir))) {
    console.error(`[changed-packages] detected changes for ${pkg.name}`);
    changedPackages.add(pkg.name);
  }
}

console.error(
  `[changed-packages] final package list (${changedPackages.size}):`,
  Array.from(changedPackages),
);
process.stdout.write(`${Array.from(changedPackages).join(' ')}\n`);
