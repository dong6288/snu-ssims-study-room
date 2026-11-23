import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const schemaVersion = 2;
const applicationId = 0x534e5552;
const nineHours = 9 * 60 * 60 * 1000;
const outcomes = new Map([
  ['received', 'pending'],
  ['not-received', 'pending'],
  ['cancelled', 'received'],
  ['denied', 'received'],
]);

export function statePath() {
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA;
    if (!base || !isAbsolute(base)) throw new Error('LOCALAPPDATA is unavailable');
    return join(base, 'SnuSsimsStudyRoom', 'attempts.sqlite');
  }
  return join(homedir(), '.snu-ssims-study-room', 'attempts.sqlite');
}

function inWriteTransaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

function schemaIdentity(db) {
  return {
    version: db.prepare('PRAGMA user_version').get().user_version,
    application: db.prepare('PRAGMA application_id').get().application_id,
  };
}

function createAttemptsTable(db) {
  db.exec(`
    CREATE TABLE attempts (
      id TEXT PRIMARY KEY NOT NULL,
      room TEXT NOT NULL,
      starts_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL CHECK(ends_at > starts_at),
      created_at INTEGER NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('pending', 'received', 'not-received', 'cancelled', 'denied'))
    ) STRICT;
    CREATE INDEX blocking_intervals ON attempts (starts_at, ends_at)
      WHERE state IN ('pending', 'received');
  `);
}

function initializeSchema(db) {
  const { version, application } = schemaIdentity(db);
  if (version === schemaVersion && application === applicationId) return;
  if (version === 1 && application === applicationId) {
    db.exec('ALTER TABLE attempts RENAME TO attempts_v1; DROP INDEX IF EXISTS blocking_intervals');
    createAttemptsTable(db);
    db.exec(`
      INSERT INTO attempts (id, room, starts_at, ends_at, created_at, state)
      SELECT id, room, starts_at, ends_at, created_at, state FROM attempts_v1;
      DROP TABLE attempts_v1;
    `);
  } else {
    const previous = db.prepare('SELECT name FROM sqlite_schema LIMIT 1').get();
    if (version || application || previous) throw new Error('Unrecognized journal database');
    createAttemptsTable(db);
    db.exec(`PRAGMA application_id = ${applicationId}`);
  }
  db.exec(`PRAGMA user_version = ${schemaVersion}`);
}

export function openJournal(path, { initialize = false } = {}) {
  if (!initialize && !existsSync(path)) throw new Error('Missing journal. Verify its history before initializing');
  if (initialize) mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout = 4000; PRAGMA synchronous = FULL');
    if (initialize) inWriteTransaction(db, () => initializeSchema(db));
    const { version, application } = schemaIdentity(db);
    if (version === 1 && application === applicationId) {
      throw new Error('Run init to upgrade this existing journal in place');
    }
    if (version !== schemaVersion || application !== applicationId) {
      throw new Error('Unrecognized journal database');
    }
    db.prepare('SELECT id, room, starts_at, ends_at, created_at, state FROM attempts LIMIT 0').all();
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function parseKst(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\+09:00$/.test(value)) {
    throw new Error('Use an exact KST timestamp such as 2026-11-27T16:00+09:00');
  }
  const instant = Date.parse(value);
  if (!Number.isFinite(instant) || new Date(instant + nineHours).toISOString().slice(0, 16) !== value.slice(0, 16)) {
    throw new Error('Invalid KST date or time');
  }
  return instant;
}

export function interval(start, end) {
  const starts = parseKst(start);
  const ends = parseKst(end);
  if (ends <= starts) throw new Error('End must be after start');
  return { starts, ends };
}

function formatAttempt(row) {
  return {
    id: row.id,
    room: row.room,
    startUtc: new Date(row.starts_at).toISOString(),
    endUtc: new Date(row.ends_at).toISOString(),
    createdUtc: new Date(row.created_at).toISOString(),
    state: row.state,
  };
}

export function blockingAttempts(db, slot) {
  return db.prepare(`
    SELECT id, room, starts_at, ends_at, created_at, state FROM attempts
    WHERE state IN ('pending', 'received') AND starts_at < ? AND ends_at > ?
    ORDER BY created_at, id
  `).all(slot.ends, slot.starts).map(formatAttempt);
}

export function claim(db, slot, room, now = Date.now()) {
  if (typeof room !== 'string' || !room.trim() || room.length > 120 || /[\u0000-\u001f\u007f]/.test(room)) {
    throw new Error('Supply only the official campus, building and room label');
  }
  if (slot.starts < now) throw new Error('The requested start is already in the past');
  return inWriteTransaction(db, () => {
    const conflicts = blockingAttempts(db, slot);
    if (conflicts.length) return { status: 'blocked', conflicts };
    const id = randomUUID();
    db.prepare(`INSERT INTO attempts (id, room, starts_at, ends_at, created_at, state)
                VALUES (?, ?, ?, ?, ?, 'pending')`).run(id, room.trim(), slot.starts, slot.ends, now);
    return { status: 'claimed', id };
  });
}

function decodeRoomLabel(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{1,700}$/.test(token)) {
    throw new Error('Supply the official room label as a base64url argument');
  }
  const room = Buffer.from(token, 'base64url').toString('utf8');
  if (Buffer.from(room, 'utf8').toString('base64url') !== token) throw new Error('Invalid base64url room label');
  return room;
}

export function settle(db, id, outcome) {
  const requiredState = outcomes.get(outcome);
  if (!requiredState) throw new Error('Unknown outcome');
  return inWriteTransaction(db, () => {
    const attempt = db.prepare('SELECT state FROM attempts WHERE id = ?').get(id);
    if (!attempt) throw new Error('Unknown attempt');
    if (attempt.state === outcome) return { status: outcome, id };
    if (attempt.state !== requiredState) throw new Error('The outcome is incompatible with this attempt state');
    db.prepare('UPDATE attempts SET state = ? WHERE id = ?').run(outcome, id);
    return { status: outcome, id };
  });
}

export function run(args, journalPath = statePath()) {
  const [command, ...fields] = args;
  const fieldCounts = new Map([['init', 0], ['check', 2], ['claim', 3], ['settle', 2]]);
  if (fields.length !== fieldCounts.get(command)) {
    throw new Error('Use init | check START END | claim START END ROOM_BASE64URL | settle ID OUTCOME');
  }
  const db = openJournal(journalPath, { initialize: command === 'init' });
  try {
    if (command === 'init') return { status: 'ready' };
    if (command === 'settle') return settle(db, ...fields);
    const slot = interval(fields[0], fields[1]);
    if (command === 'claim') return claim(db, slot, decodeRoomLabel(fields[2]));
    const conflicts = blockingAttempts(db, slot);
    return { status: conflicts.length ? 'blocked' : 'clear', conflicts };
  } finally {
    db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = run(process.argv.slice(2));
    console.log(JSON.stringify(result));
    if (result.status === 'blocked') process.exitCode = 2;
  } catch (error) {
    console.log(JSON.stringify({ status: 'error', message: error.message }));
    process.exitCode = 1;
  }
}
