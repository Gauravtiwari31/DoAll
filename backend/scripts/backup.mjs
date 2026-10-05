#!/usr/bin/env node
/**
 * Copies every collection of the DoAll database to a folder of files, one
 * JSON line per document (Extended JSON, so dates and ObjectIds survive).
 * MongoDB Atlas's free tier keeps no backups; .github/workflows/backup.yml
 * runs this every night and keeps the result, encrypted.
 *
 *   MONGODB_URI=mongodb+srv://... node scripts/backup.mjs [folder]
 *
 * The folder defaults to backup-<timestamp>. Restore with scripts/restore.mjs.
 * Uses the MongoDB driver that comes with Mongoose: nothing else to install.
 */
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { once } from 'node:events';
import mongoose from 'mongoose';

const { MongoClient, BSON } = mongoose.mongo;

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Set MONGODB_URI to the database to back up.');
  process.exit(1);
}
const folder =
  process.argv[2] ?? `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db();
  mkdirSync(folder, { recursive: true });
  const manifest = { database: db.databaseName, createdAt: new Date().toISOString(), collections: {} };

  for (const { name } of await db.listCollections({ type: 'collection' }).toArray()) {
    if (name.startsWith('system.')) continue;
    const out = createWriteStream(join(folder, `${name}.jsonl`));
    let count = 0;
    for await (const doc of db.collection(name).find()) {
      if (!out.write(`${BSON.EJSON.stringify(doc, { relaxed: false })}\n`)) {
        await once(out, 'drain');
      }
      count++;
    }
    out.end();
    await once(out, 'finish');
    const indexes = await db.collection(name).indexes();
    manifest.collections[name] = { documents: count, indexes };
    console.log(`${name}: ${count} document(s)`);
  }

  writeFileSync(join(folder, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Backup written to ${folder}`);
} finally {
  await client.close();
}
