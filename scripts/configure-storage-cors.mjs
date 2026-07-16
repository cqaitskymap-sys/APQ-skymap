#!/usr/bin/env node
/**
 * Apply CORS rules to the Firebase Storage bucket (usually only needed once per project).
 * Requires: gcloud CLI authenticated, Firebase Storage enabled, bucket exists.
 *
 * Usage:
 *   npm run configure:storage-cors
 *   STORAGE_BUCKET=apq-skymap.firebasestorage.app npm run configure:storage-cors
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const corsFile = join(__dirname, 'storage-cors.json');

function normalizeBucket(value) {
  return (value ?? '').trim().replace(/^["']|["']$/g, '');
}

const bucket = normalizeBucket(
  process.env.STORAGE_BUCKET
  || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  || 'apq-skymap.firebasestorage.app',
);

const gsBucket = bucket.startsWith('gs://') ? bucket : `gs://${bucket}`;

console.log(`Applying CORS from ${corsFile} to ${gsBucket} ...`);
readFileSync(corsFile, 'utf8'); // fail fast if missing

const result = spawnSync(
  'gcloud',
  ['storage', 'buckets', 'update', gsBucket, `--cors-file=${corsFile}`],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

if (result.status !== 0) {
  console.error(`
Failed to update bucket CORS. Common fixes:
  1. Enable Firebase Storage: Firebase Console → Build → Storage → Get started
  2. Confirm bucket name matches NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET (${bucket})
  3. Install and auth gcloud: https://cloud.google.com/sdk/docs/install
  4. Deploy storage rules: npm run deploy:storage
`);
  process.exit(result.status ?? 1);
}

console.log('Storage CORS updated successfully.');
