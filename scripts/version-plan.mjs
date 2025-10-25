#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const packages = process.argv.slice(2).filter(Boolean);
console.error(`[version-plan] input packages: ${packages.join(', ')}`);

if (packages.length === 0) {
  console.log('BUMP=');
  console.log('PUBLISH=');
  console.log('VERSIONS=');
  process.exit(0);
}

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

const repoRoot = run('git rev-parse --show-toplevel');
const workspaceList = JSON.parse(run('pnpm ls --depth=-1 --recursive --json'));
const workspaceMap = new Map(workspaceList.map((entry) => [entry.name, entry.path]));

function getPackagePath(name) {
  const path = workspaceMap.get(name);
  if (!path) {
    throw new Error(`Package ${name} not found in workspace list`);
  }
  return path;
}

function readPackageJson(path) {
  return JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
}

function listTags(name) {
  const pattern = `${name}@*`;
  try {
    const raw = run(`git tag --list "${pattern}"`);
    return raw
      .split(/\r?\n/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function compareVersions(a, b) {
  if (a === b) {
    return 0;
  }
  const parse = (version) => {
    const [base, prerelease = ''] = version.split('-', 2);
    const parts = base.split('.').map((part) => Number.parseInt(part, 10));
    return { parts, prerelease };
  };

  const va = parse(a);
  const vb = parse(b);

  for (let index = 0; index < 3; index += 1) {
    const diff = (va.parts[index] ?? 0) - (vb.parts[index] ?? 0);
    if (diff !== 0) {
      return diff > 0 ? 1 : -1;
    }
  }

  if (va.prerelease === vb.prerelease) {
    return 0;
  }

  if (!va.prerelease) {
    return 1;
  }
  if (!vb.prerelease) {
    return -1;
  }
  return va.prerelease > vb.prerelease ? 1 : -1;
}

const bump = [];
const publish = [];
const versions = [];

for (const name of packages) {
  try {
    const path = getPackagePath(name);
    const pkgJson = readPackageJson(path);
    const currentVersion = pkgJson.version;
    publish.push(name);
    versions.push(`${name}::${currentVersion}`);

    const tags = listTags(name);
    const highestTag = tags.reduce((highest, tag) => {
      const version = tag.slice(tag.lastIndexOf('@') + 1);
      if (!highest) {
        return version;
      }
      return compareVersions(version, highest) > 0 ? version : highest;
    }, null);

    console.error(
      `[version-plan] ${name}: current=${currentVersion}, highestTag=${highestTag ?? 'none'}`,
    );

    if (!highestTag || compareVersions(currentVersion, highestTag) > 0) {
      console.error(`[version-plan] ${name}: skipping bump (already ahead)`);
    } else {
      bump.push(name);
      console.error(`[version-plan] ${name}: will bump version`);
    }
  } catch (error) {
    console.error(
      `[version-plan] ${name}: error ${error instanceof Error ? error.message : String(error)}`,
    );
    publish.push(name);
  }
}

console.log(`BUMP=${bump.join(' ')}`);
console.log(`PUBLISH=${publish.join(' ')}`);
console.log(`VERSIONS=${versions.join(' ')}`);
