import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const [skillArgument, chromeArgument] = process.argv.slice(2);
if (!skillArgument) throw new Error('Usage: node tests/mock-booking.mjs <installed-skill-path> [chrome-executable]');
const skillPath = resolve(skillArgument);
const chrome = chromeArgument || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const skill = await readFile(join(skillPath, 'SKILL.md'), 'utf8');
assert.match(skill, /^name: snu-ssims-study-room$/m);
const { run } = await import(pathToFileURL(join(skillPath, 'scripts/attempts.mjs')).href);
const fixture = await readFile(new URL('./fixtures/ssims-mock.html', import.meta.url), 'utf8');
const base = await realpath(process.env.SNU_MOCK_TEMP || tmpdir());
const scratch = await mkdtemp(join(base, 'ssims-mock-'));
const journalPath = join(scratch, 'attempts.sqlite');

async function browserCase(name, input) {
  const html = join(scratch, `${name}.html`);
  await writeFile(html, fixture.replace('__INPUT__', () => JSON.stringify(input).replaceAll('<', '\\u003c')), 'utf8');
  const { stdout } = await exec(chrome, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--dump-dom', `--user-data-dir=${join(scratch, name)}`,
    pathToFileURL(html).href,
  ], { windowsHide: true, timeout: 30000, encoding: 'utf8' });
  const result = stdout.match(/<pre id="result">([^<]+)<\/pre>/)?.[1];
  if (!result) throw new Error(`The mock browser produced no result for ${name}`);
  return JSON.parse(result);
}

const initial = { start: '2099-11-27T16:00+09:00', end: '2099-11-27T18:00+09:00', count: 4 };
try {
  assert.equal(run(['init'], journalPath).status, 'ready');
  const lookup = await browserCase('lookup', { ...initial, mode: 'lookup' });
  assert.equal(lookup.signedIn, true);
  assert.equal(lookup.firstConflict, true);
  assert.deepEqual(lookup.pages, [1, 2]);
  assert.equal(lookup.candidate, '관악 43-2동 104');
  assert.equal(lookup.preview, null);
  assert.equal(lookup.mockPosts, 0);
  assert.deepEqual(run(['status'], journalPath), { status: 'ready' });
  const prepared = await browserCase('prepare', { ...initial, mode: 'prepare' });
  assert.equal(prepared.preview.room, lookup.candidate);
  assert.equal(prepared.preview.count, 4);
  assert.equal(prepared.mockPosts, 0);
  const firstClaim = run(['claim', initial.start, initial.end, lookup.roomToken], journalPath);
  assert.equal(firstClaim.status, 'claimed');
  const booked = await browserCase('approved', {
    ...initial, mode: 'submit', approval: prepared.preview, attemptId: firstClaim.id, response: 'instant',
  });
  assert.equal(booked.verified, true);
  assert.equal(booked.mockPosts, 1);
  assert.deepEqual(booked.receipt, {
    id: 'MOCK-001', state: '예약 확정', room: lookup.candidate, start: initial.start, end: initial.end,
  });
  assert.equal(run(['settle', firstClaim.id, 'received'], journalPath).status, 'received');
  assert.equal(run(['claim', initial.start, initial.end, lookup.roomToken], journalPath).status, 'blocked');

  const changed = await browserCase('changed', { ...initial, mode: 'submit', approval: prepared.preview, attemptId: firstClaim.id, changeTitle: true });
  assert.equal(changed.verified, false);
  assert.equal(changed.mockPosts, 0);

  const later = { ...initial, start: initial.end, end: '2099-11-27T20:00+09:00' };
  const laterApproval = { ...prepared.preview, start: later.start, end: later.end };
  const pending = run(['claim', later.start, later.end, lookup.roomToken], journalPath);
  assert.equal(pending.status, 'claimed');
  const delayed = await browserCase('delayed', { ...later, mode: 'submit', approval: laterApproval, attemptId: pending.id, response: 'timeout' });
  assert.equal(delayed.mockPosts, 1);
  assert.equal(delayed.historyCount, 0);
  assert.equal(delayed.receipt, null);
  assert.deepEqual(run(['check', later.start, later.end], journalPath), { status: 'blocked' });
  assert.deepEqual(run(['claim', later.start, later.end, lookup.roomToken], journalPath), { status: 'blocked' });

  const manual = { ...initial, start: later.end, end: '2099-11-27T22:00+09:00' };
  assert.deepEqual(run(['check', manual.start, manual.end], journalPath), { status: 'clear' });
  const studentClick = await browserCase('student-click', { ...manual, mode: 'student-submit', response: 'timeout' });
  assert.equal(studentClick.verified, false);
  assert.equal(studentClick.mockPosts, 1);
  assert.equal(studentClick.historyCount, 0);
  assert.equal(studentClick.receipt, null);
  assert.equal(run(['hold', manual.start, manual.end, studentClick.roomToken], journalPath).status, 'held');
  assert.deepEqual(run(['check', manual.start, manual.end], journalPath), { status: 'blocked' });
  assert.deepEqual(run(['claim', manual.start, manual.end, studentClick.roomToken], journalPath), { status: 'blocked' });
  console.log('PASS: installed skill, mock sign-in, complete two-page lookup, journal readiness, form approval, one submit, confirmed receipt, changed preview rejected, both timeout replays blocked');
} finally {
  const target = await realpath(scratch);
  if (dirname(target) !== base || !basename(target).startsWith('ssims-mock-')) {
    throw new Error('Unexpected mock profile location');
  }
  await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
