#!/usr/bin/env node
/**
 * Loads a folder written by scripts/backup.mjs into a database: documents
 * and indexes. Collections that already exist there are replaced, so it
 * asks for --yes, and it's best pointed at a new, empty database first to
 * check the backup.
 *
 *   MONGODB_URI=mongodb+srv://.../doall_restored node scripts/restore.mjs <folder> --yes
 */
import { createReadStream, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import mongoose from 'mongoose';

const { MongoClient, BSON } = mongoose.mongo;
const BATCH = 500;

const uri = process.env.MONGODB_URI;
const folder = process.argv[2];
if (!uri || !folder || folder.startsWith('--')) {
  console.error('Usage: MONGODB_URI=... node scripts/restore.mjs <backup folder> --yes');
  process.exit(1);
}
if (!process.argv.includes('--yes')) {
  console.error(
    `This replaces the collections in the database at MONGODB_URI with the backup in ${folder}. Add --yes to go ahead.`,
  );
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(folder, 'manifest.json'), 'utf8'));
const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db();
  for (const [name, { documents, indexes }] of Object.entries(manifest.collections)) {
    const collection = db.collection(name);
    await collection.drop().catch(() => undefined); // fine if it didn't exist

    let batch = [];
    let count = 0;
    const lines = createInterface({ input: createReadStream(join(folder, `${name}.jsonl`)) });
    for await (const line of lines) {
      if (!line.trim()) continue;
      batch.push(BSON.EJSON.parse(line, { relaxed: false }));
      if (batch.length === BATCH) {
        await collection.insertMany(batch, { ordered: true });
        count += batch.length;
        batch = [];
      }
    }
    if (batch.length > 0) {
      await collection.insertMany(batch, { ordered: true });
      count += batch.length;
    }

    for (const { key, name: indexName, v: _v, ns: _ns, ...options } of indexes) {
      if (indexName === '_id_') continue;
      await collection.createIndex(key, { name: indexName, ...options });
    }
    const check = count === documents ? 'ok' : `MISMATCH: backup says ${documents}`;
    console.log(`${name}: ${count} document(s), ${indexes.length} index(es) (${check})`);
    if (count !== documents) process.exitCode = 1;
  }
} finally {
  await client.close();
}
