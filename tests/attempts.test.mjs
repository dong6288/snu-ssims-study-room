import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { blockingAttempts, claim, interval, openJournal, parseKst, settle } from '../skills/snu-ssims-study-room/scripts/attempts.mjs';

const start = '2099-11-27T16:00+09:00';
const end = '2099-11-27T18:00+09:00';
const slot = interval(start, end);

function sandbox(testContext) {
  const directory = mkdtempSync(join(process.env.SNU_TEST_TEMP || tmpdir(), 'ssims-check-'));
  const path = join(directory, 'attempts.sqlite');
  testContext.after(() => {
    for (const suffix of ['', '-journal', '-shm', '-wal']) rmSync(path + suffix, { force: true });
    rmdirSync(directory);
  });
  return path;
}

test('rejects missing journals, invalid dates and non-KST input', (t) => {
  assert.throws(() => openJournal(sandbox(t)), /Missing journal/);
  assert.throws(() => parseKst('2099-02-29T16:00+09:00'), /Invalid/);
  assert.throws(() => interval(end, start), /after/);
  assert.throws(() => parseKst('2099-11-27T16:00Z'), /KST/);
});

test('an unresolved attempt still blocks a new chat after reopening the database', (t) => {
  const path = sandbox(t);
  const first = openJournal(path, { initialize: true });
  const pending = claim(first, slot, '관악 43-2동 104');
  first.close();
  const resumed = openJournal(path);
  try {
    assert.equal(pending.status, 'claimed');
    assert.equal(blockingAttempts(resumed, slot)[0].id, pending.id);
    assert.equal(claim(resumed, slot, '관악 300동 403').status, 'blocked');
  } finally {
    resumed.close();
  }
});

test('distinct times proceed and verified nonreceipt releases the interval', (t) => {
  const db = openJournal(sandbox(t), { initialize: true });
  try {
    const pending = claim(db, slot, '관악 43-2동 104');
    assert.equal(claim(db, interval(end, '2099-11-27T19:00+09:00'), '관악 300동 403').status, 'claimed');
    assert.throws(() => settle(db, pending.id, 'cancelled'), /incompatible/);
    assert.equal(settle(db, pending.id, 'not-received').status, 'not-received');
    assert.equal(claim(db, slot, '관악 44-1동 401-1').status, 'claimed');
  } finally {
    db.close();
  }
});

test('a received attempt stays blocked until verified cancellation', (t) => {
  const db = openJournal(sandbox(t), { initialize: true });
  try {
    const pending = claim(db, slot, '관악 43-2동 104');
    settle(db, pending.id, 'received');
    assert.equal(blockingAttempts(db, slot)[0].state, 'received');
    assert.throws(() => settle(db, pending.id, 'not-received'), /incompatible/);
    settle(db, pending.id, 'cancelled');
    assert.deepEqual(blockingAttempts(db, slot), []);
  } finally {
    db.close();
  }
});

test('a definitive post-receipt denial releases the interval', (t) => {
  const db = openJournal(sandbox(t), { initialize: true });
  try {
    const pending = claim(db, slot, '관악 300동 403');
    settle(db, pending.id, 'received');
    assert.equal(claim(db, slot, '관악 43-2동 104').status, 'blocked');
    assert.equal(settle(db, pending.id, 'denied').status, 'denied');
    assert.equal(claim(db, slot, '관악 43-2동 104').status, 'claimed');
  } finally {
    db.close();
  }
});

test('preserves the original ledger on repeated initialization', (t) => {
  const path = sandbox(t);
  const original = openJournal(path, { initialize: true });
  const pending = claim(original, slot, '관악 43-2동 104');
  original.close();
  const reopened = openJournal(path, { initialize: true });
  try {
    assert.equal(blockingAttempts(reopened, slot)[0].id, pending.id);
  } finally {
    reopened.close();
  }
});

test('upgrades an existing journal in place and preserves pending and received attempts', (t) => {
  const path = sandbox(t);
  const older = new DatabaseSync(path);
  const adjacent = interval(end, '2099-11-27T19:00+09:00');
  older.exec(`
    CREATE TABLE attempts (
      id TEXT PRIMARY KEY NOT NULL,
      room TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL CHECK(ends_at > starts_at),
      created_at INTEGER NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending', 'received', 'not-received', 'cancelled'))
    ) STRICT;
    CREATE INDEX blocking_intervals ON attempts (starts_at, ends_at)
      WHERE state IN ('pending', 'received');
    PRAGMA application_id = 1397642578;
    PRAGMA user_version = 1;
  `);
  const insert = older.prepare('INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?)');
  insert.run('old-pending', '관악 44-1동 401-1', slot.starts, slot.ends, 1, 'pending');
  insert.run('old-received', '관악 300동 403', adjacent.starts, adjacent.ends, 2, 'received');
  older.close();
  assert.throws(() => openJournal(path), /upgrade this existing journal/);
  const upgraded = openJournal(path, { initialize: true });
  try {
    assert.equal(claim(upgraded, slot, '관악 43-2동 104').status, 'blocked');
    assert.equal(blockingAttempts(upgraded, slot)[0].id, 'old-pending');
    assert.equal(blockingAttempts(upgraded, adjacent)[0].id, 'old-received');
    assert.equal(settle(upgraded, 'old-received', 'denied').status, 'denied');
    assert.equal(claim(upgraded, adjacent, '관악 43-2동 104').status, 'claimed');
  } finally {
    upgraded.close();
  }
});

function runClaimCommand(path, roomToken) {
  const scriptUrl = new URL('../skills/snu-ssims-study-room/scripts/attempts.mjs', import.meta.url).href;
  const program = `import {run} from ${JSON.stringify(scriptUrl)};
    console.log(JSON.stringify(run(['claim', ...process.argv.slice(2)], process.argv[1])));`;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '--eval', program, path, start, end, roomToken]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr));
        return;
      }
      try { resolve(JSON.parse(stdout)); }
      catch (error) { reject(error); }
    });
  });
}

test('the command path preserves a literal label with quotes and shell punctuation', async (t) => {
  const path = sandbox(t);
  const db = openJournal(path, { initialize: true });
  const label = "관악 O'Brien & Co. <104> $(text); `literal` | room";
  const encoded = Buffer.from(label, 'utf8').toString('base64url');
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  try {
    await assert.rejects(runClaimCommand(path, label), /base64url argument/);
    const result = await runClaimCommand(path, encoded);
    assert.equal(result.status, 'claimed');
    assert.equal(blockingAttempts(db, slot)[0].room, label);
  } finally {
    db.close();
  }
});

test('two Chrome chats cannot both claim an overlapping interval', async (t) => {
  const path = sandbox(t);
  openJournal(path, { initialize: true }).close();
  const tokens = ['관악 43-2동 104', '관악 300동 403'].map((room) => Buffer.from(room).toString('base64url'));
  const outcomes = await Promise.all(tokens.map((token) => runClaimCommand(path, token)));
  assert.deepEqual(outcomes.map((result) => result.status).sort(), ['blocked', 'claimed']);
});
