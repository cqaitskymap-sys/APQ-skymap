import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('app');

const VARIANT_TEMPLATES = {
  dashboard: `import { RouteLoadingFallback } from '@/components/loading/route-fallback';\n\nexport default function Loading() {\n  return <RouteLoadingFallback variant="dashboard" />;\n}\n`,
  table: `import { RouteLoadingFallback } from '@/components/loading/route-fallback';\n\nexport default function Loading() {\n  return <RouteLoadingFallback variant="table" />;\n}\n`,
  form: `import { RouteLoadingFallback } from '@/components/loading/route-fallback';\n\nexport default function Loading() {\n  return <RouteLoadingFallback variant="form" />;\n}\n`,
  list: `import { RouteLoadingFallback } from '@/components/loading/route-fallback';\n\nexport default function Loading() {\n  return <RouteLoadingFallback variant="list" />;\n}\n`,
  auth: `import { RouteLoadingFallback } from '@/components/loading/route-fallback';\n\nexport default function Loading() {\n  return <RouteLoadingFallback variant="auth" />;\n}\n`,
};

function resolveVariant(dir) {
  const rel = path.relative(ROOT, dir).replace(/\\/g, '/');
  const top = rel.split('/')[0] ?? '';
  if (top === 'auth') return 'auth';
  if (rel.includes('create') || rel.includes('edit')) return 'form';
  if (rel.includes('reports') || rel.includes('audit-trail')) return 'table';
  if (top === 'notifications') return 'list';
  return 'dashboard';
}

function shouldHaveLoader(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const hasLayout = entries.some((e) => e.isFile() && e.name === 'layout.tsx');
  if (hasLayout) return true;

  const rel = path.relative(ROOT, dir).replace(/\\/g, '/');
  const depth = rel.split('/').length;
  const hasPage = entries.some((e) => e.isFile() && e.name === 'page.tsx');
  // Top-level modules and dynamic segment parents only (avoid leaf page loaders)
  if (!hasPage) return false;
  if (depth <= 2) return true;
  if (depth === 3 && entries.some((e) => e.isDirectory() && e.name.startsWith('['))) return true;
  return false;
}

function walk(dir, created, removed) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const loadingPath = path.join(dir, 'loading.tsx');
  const hasLoading = entries.some((e) => e.isFile() && e.name === 'loading.tsx');

  if (shouldHaveLoader(dir)) {
    const variant = resolveVariant(dir);
    const content = VARIANT_TEMPLATES[variant] ?? VARIANT_TEMPLATES.dashboard;
    fs.writeFileSync(loadingPath, content, 'utf8');
    created.push(path.relative(process.cwd(), loadingPath).replace(/\\/g, '/'));
  } else if (hasLoading && dir !== ROOT) {
    fs.unlinkSync(loadingPath);
    removed.push(path.relative(process.cwd(), loadingPath).replace(/\\/g, '/'));
  }

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'api') {
      walk(path.join(dir, entry.name), created, removed);
    }
  }
}

const created = [];
const removed = [];
walk(ROOT, created, removed);

fs.writeFileSync(
  path.join(ROOT, 'loading.tsx'),
  `import { RouteLoadingFallback } from '@/components/loading/route-fallback';\n\nexport default function Loading() {\n  return <RouteLoadingFallback variant="full" />;\n}\n`,
  'utf8'
);

console.log(`Updated ${created.length} route loaders, removed ${removed.length} leaf loaders.`);
