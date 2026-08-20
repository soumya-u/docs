#!/usr/bin/env node
/**
 * Verifies the gating invariants that Mintlify cannot enforce itself.
 *
 * The important one is GATED_DIRS. Unlike `public`, the `groups` field has no
 * group-level equivalent in docs.json - it must appear in every page's
 * frontmatter. A new page in a restricted directory without it is silently
 * readable by every logged-in user, with no error and no failed build.
 *
 * Usage: node scripts/check-gating.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Directories whose every page must carry a specific group. */
const GATED_DIRS = {
  'internal': 'internal',
  'early-access': 'beta',
};

/**
 * Directories that rely on the site-wide default - a login, but no group.
 * Nothing in these pages records the intended tier, so the directory has to.
 */
const LOGIN_ONLY_DIRS = ['platform'];

/**
 * Every directory that must stay out of a `public: true` group. A gated
 * directory is never public by definition, so it is derived rather than
 * duplicated - one list cannot drift out of step with the other.
 *
 * Directories rather than page lists throughout: a list of pages has to be
 * updated by hand whenever someone adds a file, and stays silent when they
 * forget, which is the exact failure this script exists to catch.
 */
const NEVER_PUBLIC_DIRS = new Set([...LOGIN_ONLY_DIRS, ...Object.keys(GATED_DIRS)]);

const root = process.cwd();
const errors = [];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === 'scripts') return [];
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.mdx') ? [full] : [];
  });
}

function frontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fm = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    fm[key] = raw.trim().startsWith('[')
      ? raw.trim().slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
      : raw.trim().replace(/^["']|["']$/g, '');
  }
  return fm;
}

/** Page slugs that sit inside a group marked `public: true` in docs.json. */
function publicSlugs(node, inPublic = false, found = new Set()) {
  if (typeof node === 'string') {
    if (inPublic) found.add(node);
  } else if (Array.isArray(node)) {
    node.forEach((n) => publicSlugs(n, inPublic, found));
  } else if (node && typeof node === 'object') {
    const nowPublic = inPublic || node.public === true;
    Object.entries(node).forEach(([k, v]) => {
      if (k !== 'public') publicSlugs(v, nowPublic, found);
    });
  }
  return found;
}

/** Every page slug referenced anywhere in docs.json navigation. */
function navSlugs(node, found = new Set()) {
  if (typeof node === 'string') found.add(node);
  else if (Array.isArray(node)) node.forEach((n) => navSlugs(n, found));
  else if (node && typeof node === 'object') Object.values(node).forEach((v) => navSlugs(v, found));
  return found;
}

const slugOf = (rel) => rel.replace(/\.mdx$/, '');

const pages = walk(root);
const config = JSON.parse(readFileSync(join(root, 'docs.json'), 'utf8'));
const slugs = navSlugs(config.navigation);
const publics = publicSlugs(config.navigation);

for (const file of pages) {
  const rel = relative(root, file);
  const fm = frontmatter(file);
  if (!fm) {
    errors.push(`${rel}: no frontmatter block`);
    continue;
  }

  // 1. Pages in a gated directory must declare the expected group.
  const dir = rel.split('/')[0];
  const required = GATED_DIRS[dir];
  if (required) {
    const groups = Array.isArray(fm.groups) ? fm.groups : [];
    if (!groups.includes(required)) {
      errors.push(`${rel}: in ${dir}/ but missing groups: ["${required}"] - visible to every logged-in user`);
    }
  }

  // 2. `public: true` only grants open access when there is no `groups` field.
  if (fm.public === 'true' && Array.isArray(fm.groups) && fm.groups.length) {
    errors.push(`${rel}: has both public: true and groups - ambiguous, pick one`);
  }

  // 3. A group-gated page must not also sit in a `public: true` group.
  //    Same conflict as rule 2, but declared in docs.json rather than frontmatter.
  if (Array.isArray(fm.groups) && fm.groups.length && publics.has(slugOf(rel))) {
    errors.push(`${rel}: has groups but sits in a public group in docs.json - ambiguous, pick one`);
  }

  // 4. Pages in a non-public directory must stay out of public groups.
  if (NEVER_PUBLIC_DIRS.has(dir) && publics.has(slugOf(rel))) {
    errors.push(`${rel}: in ${dir}/, which must stay behind a login, but sits in a public group in docs.json - readable by anyone`);
  }

  // 5. Orphans are reachable by URL but invisible in navigation.
  const slug = slugOf(rel);
  if (!slugs.has(slug)) {
    errors.push(`${rel}: not referenced in docs.json navigation`);
  }
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} gating problem${errors.length > 1 ? 's' : ''}:\n`);
  errors.forEach((e) => console.error(`  ${e}`));
  console.error('');
  process.exit(1);
}

console.log(`✓ gating checks passed (${pages.length} pages)`);
