#!/usr/bin/env node
// Owner-operated only. No secret values belong in arguments, files or reports.
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { emitKeypressEvents } from 'node:readline';
import { pathToFileURL } from 'node:url';

export const PROJECT = 'ojcfrfpeftvngyluomex';
export const URL = `https://${PROJECT}.supabase.co`;
export const EMAILS = ['owner','manager','coach','other-coach','parent','other-parent'].map(x => `repformed-learning-${x}@example.test`);
// Nonsecret identities verified by the owner-signed-in browser, Oct29 01:59UTC.
// Reset authority is for THESE existing UUIDs, not newly created same-email users.
export const VERIFIED_USERS = [
  { id: '17054a51-d756-4b9e-8048-c82973fe0c55', email: EMAILS[0] },
  { id: '134e7d0b-e54d-488b-8848-8254db86757c', email: EMAILS[1] },
  { id: '7853c212-2c83-4b6a-ab95-0c8fa81c75af', email: EMAILS[2] },
  { id: '2d136c01-ce7d-4c4d-b814-5af860dd707c', email: EMAILS[3] },
  { id: 'dc6804e6-fc2f-4bb0-a7ca-de8514e09024', email: EMAILS[4] },
  { id: '2a566ee0-dd1f-4244-a16f-2c086bc1c6a2', email: EMAILS[5] },
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class SafeStop extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function allowlist(value) {
  if (!value || value.project_ref !== PROJECT || !Array.isArray(value.users) || value.users.length !== 6) throw new SafeStop('INVALID_ALLOWLIST');
  if (Object.keys(value).some(k => !['project_ref','users','verified_at','notification_observation'].includes(k))) throw new SafeStop('INVALID_ALLOWLIST');
  const rows = value.users.map(x => {
    if (!x || Object.keys(x).some(k => !['id','email'].includes(k)) || typeof x.id !== 'string' || !UUID.test(x.id) || !EMAILS.includes(x.email)) throw new SafeStop('INVALID_ALLOWLIST');
    return { id: x.id.toLowerCase(), email: x.email };
  });
  if (new Set(rows.map(x=>x.id)).size !== 6 || new Set(rows.map(x=>x.email)).size !== 6) throw new SafeStop('INVALID_ALLOWLIST');
  if (VERIFIED_USERS.some(expected => !rows.some(row => row.id === expected.id && row.email === expected.email))) throw new SafeStop('INVALID_ALLOWLIST');
  return EMAILS.map(email => rows.find(x => x.email === email));
}
export function adminKey(value) {
  if (typeof value !== 'string') throw new SafeStop('INVALID_TEST_ADMIN_KEY');
  const key = value.trim();
  if (/^sb_secret_[A-Za-z0-9_-]{16,}$/.test(key)) return key;
  try {
    const parts = key.split('.');
    if (parts.length === 3) {
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (claims.role === 'service_role' && claims.ref === PROJECT) return key;
    }
  } catch { /* Never include supplied text or parser errors. */ }
  throw new SafeStop('INVALID_TEST_ADMIN_KEY');
}
export function passwordValid(value) {
  return typeof value === 'string' && value.length >= 16 && value.length <= 64 && /^[\x21-\x7e]+$/.test(value) && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}
export function guardedFetch(rows, nativeFetch = fetch) {
  const ids = new Set(rows.map(x => x.id));
  return async (input, init) => {
    const target = new globalThis.URL(typeof input === 'string' ? input : input instanceof globalThis.URL ? input.href : input.url);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (target.origin !== URL || target.username || target.password || target.hash) throw new SafeStop('BLOCKED_REQUEST');
    const list = target.pathname === '/auth/v1/admin/users';
    const match = target.pathname.match(/^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/i);
    if (list) {
      if (method !== 'GET' || [...target.searchParams.keys()].some(k=> !['page','per_page'].includes(k)) || target.searchParams.get('page') !== '1' || target.searchParams.get('per_page') !== '7') throw new SafeStop('BLOCKED_REQUEST');
    } else {
      if (!match || !ids.has(match[1].toLowerCase()) || target.search || !['GET','PUT'].includes(method)) throw new SafeStop('BLOCKED_REQUEST');
      if (method === 'PUT') {
        let body;
        try { body = JSON.parse(init?.body); } catch { throw new SafeStop('BLOCKED_REQUEST'); }
        if (!body || Object.keys(body).length !== 1 || !passwordValid(body.password)) throw new SafeStop('BLOCKED_REQUEST');
      }
    }
    // Genuine server request, TLS verification preserved; never spoof a browser.
    return nativeFetch(input, { ...init, redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(20000) });
  };
}
function sameUser(actual, expected) {
  return actual?.id?.toLowerCase() === expected.id && actual.email === expected.email;
}
async function verifyUsers(client, rows) {
  const listed = await client.auth.admin.listUsers({ page: 1, perPage: 7 });
  // The SDK reports total=0 when pagination headers are absent. Asking for
  // seven and receiving exactly six exhausts this first page independently.
  if (listed.error || !Array.isArray(listed.data?.users) || listed.data.users.length !== 6 || (listed.data.total > 0 && listed.data.total !== 6) || rows.some(x => !listed.data.users.some(y => sameUser(y,x)))) throw new SafeStop('IDENTITY_PRECHECK_FAILED');
  for (const row of rows) {
    const response = await client.auth.admin.getUserById(row.id);
    if (response.error || !sameUser(response.data?.user, row)) throw new SafeStop('IDENTITY_PRECHECK_FAILED');
  }
}
export async function sdkClient(key, rows, nativeFetch = fetch) {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: guardedFetch(rows, nativeFetch) } });
}
// Injectable I/O/client factory permits safety tests without credentials/network.
export async function recover({ manifest, apply = false, io, makeClient = sdkClient }) {
  const rows = allowlist(manifest);
  let key = '', passwords = new Map();
  const completed = [];
  try {
    if (await io.ask(`Type the TEST project reference (${PROJECT}): `) !== PROJECT) throw new SafeStop('PROJECT_NOT_CONFIRMED');
    key = adminKey(await io.secret('Existing TEST admin key (hidden; never use a production key): '));
    const client = await makeClient(key, rows);
    await verifyUsers(client, rows);
    io.say('Verified the six exact existing fictional UUID/email pairs. No history or account was replaced.');
    for (const row of rows) io.say(`${row.email} | ${row.id}`);
    if (!apply) { io.say('VERIFY ONLY: no passwords requested or changed. Rerun with --apply only when ready.'); return { status: 'verified', changed: 0 }; }
    io.say('Save six NEW, unique temporary passwords in your own password manager first. Nothing will print or save them here.');
    for (const row of rows) {
      const value = await io.secret(`New temporary password for ${row.email} (hidden): `);
      if (!passwordValid(value)) throw new SafeStop('PASSWORD_POLICY');
      if (await io.secret('Confirm that same password (hidden): ') !== value) throw new SafeStop('PASSWORD_CONFIRMATION_FAILED');
      if ([...passwords.values()].includes(value)) throw new SafeStop('PASSWORDS_MUST_BE_UNIQUE');
      passwords.set(row.id, value);
    }
    // Only an operator/browser UI check is used. Do NOT fetch bulk Auth config:
    // that response can include SMTP/provider credentials.
    io.say('Immediately verify TEST Authentication > Email > Password changed security notification is OFF. Pause other settings/reset workers. If it is ON/unknown, cancel. Do not toggle settings in this helper.');
    if (await io.ask('Type PASSWORD_CHANGED_EMAILS_OFF only after that verification: ') !== 'PASSWORD_CHANGED_EMAILS_OFF') throw new SafeStop('NOTIFICATIONS_NOT_VERIFIED_OFF');
    if (await io.ask('Type RESET SIX FICTIONAL USERS to apply only the six pairs above: ') !== 'RESET SIX FICTIONAL USERS') throw new SafeStop('RESET_NOT_CONFIRMED');
    // Recheck exact identities immediately before the first mutation.
    await verifyUsers(client, rows);
    for (const row of rows) {
      let response;
      try {
        const check = await client.auth.admin.getUserById(row.id);
        if (check.error || !sameUser(check.data?.user, row)) throw new SafeStop('IDENTITY_CHANGED');
        response = await client.auth.admin.updateUserById(row.id, { password: passwords.get(row.id) });
      } catch (error) {
        if (error instanceof SafeStop && error.code === 'IDENTITY_CHANGED') throw error;
        io.say(`STOP: reset outcome NOT CONFIRMED for ${row.email} | ${row.id}. Do not retry blindly; test the saved replacement password through ordinary sign-in first.`);
        throw new SafeStop('RESET_OUTCOME_UNCERTAIN');
      }
      if (response.error || !sameUser(response.data?.user, row)) {
        io.say(`STOP: reset outcome NOT CONFIRMED for ${row.email} | ${row.id}. No automatic retry.`);
        throw new SafeStop('RESET_OUTCOME_UNCERTAIN');
      }
      completed.push(row.id); passwords.delete(row.id);
      io.say(`CONFIRMED password update: ${row.email} | ${row.id}`);
    }
    io.say('Six password updates confirmed. Existing UUIDs/history preserved by password-only API calls. No recovery/invitation endpoint, account deletion, database write or setting change was used.');
    io.say('Next: owner enters the saved passwords DIRECTLY into the test harness. Never send them to the agent.');
    return { status: 'updated', changed: completed.length };
  } catch (error) {
    io.say(`Stopped safely. Confirmed password updates this run: ${completed.length}.`);
    throw error instanceof SafeStop ? error : new SafeStop('OPERATION_NOT_CONFIRMED');
  } finally {
    passwords.clear(); key = '';
    // References are discarded on process exit; JavaScript cannot guarantee
    // cryptographic zeroization of immutable strings. No persistence is used.
  }
}
export function readHidden(label, input = process.stdin, output = process.stdout) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') return Promise.reject(new SafeStop('PRIVATE_TTY_REQUIRED'));
  output.write(label); emitKeypressEvents(input);
  const previousRaw = !!input.isRaw; input.setRawMode(true); input.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    function cleanup() { input.removeListener('keypress', keypress); input.setRawMode(previousRaw); input.pause(); output.write('\n'); }
    function keypress(text, key = {}) {
      if (key.ctrl && key.name === 'c') { value = ''; cleanup(); reject(new SafeStop('CANCELLED')); return; }
      if (key.name === 'return' || key.name === 'enter') { const result = value; value = ''; cleanup(); resolve(result); return; }
      if (key.name === 'backspace' || key.name === 'delete') { value = value.slice(0,-1); return; }
      if (key.ctrl || key.meta || key.sequence?.startsWith('\u001b')) return;
      if (typeof text === 'string' && !/[\x00-\x1f\x7f]/.test(text)) value += text;
      if (value.length > 8192) { value = ''; cleanup(); reject(new SafeStop('INPUT_TOO_LONG')); }
    }
    input.on('keypress', keypress);
  });
}
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Owner-only test recovery. node recover-test-users.mjs --allowlist users.json [--apply]\nDefault is verify-only. Uses hidden TTY prompts; no credentials in flags/environment/files. No new key/account/email/settings changes.'); return;
  }
  const index = args.indexOf('--allowlist');
  if (index < 0 || !args[index+1] || args.some((x,i)=>i!==index+1 && !['--allowlist','--apply'].includes(x)) || args.filter(x=>x==='--apply').length>1 || args.filter(x=>x==='--allowlist').length!==1) throw new SafeStop('USAGE');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new SafeStop('PRIVATE_TTY_REQUIRED');
  if (process.env.NODE_DEBUG || process.env.DEBUG || process.env.NODE_OPTIONS || process.env.SSLKEYLOGFILE || process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' || process.execArgv.length) throw new SafeStop('CLEAN_NONDEBUG_TERMINAL_REQUIRED');
  if (Number(process.versions.node.split('.')[0]) < 22) throw new SafeStop('NODE_22_OR_NEWER_REQUIRED');
  let manifest;
  try { manifest = JSON.parse(await readFile(args[index+1], 'utf8')); } catch { throw new SafeStop('INVALID_ALLOWLIST'); }
  allowlist(manifest);
  try { await import('@supabase/supabase-js'); } catch { throw new SafeStop('DEPENDENCY_NOT_INSTALLED'); }
  const io = {
    say: text => console.log(text),
    secret: label => readHidden(label),
    ask: async label => { const rl = createInterface({ input: process.stdin, output: process.stdout }); try { return (await rl.question(label)).trim(); } finally { rl.close(); } },
  };
  await recover({ manifest, apply: args.includes('--apply'), io });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const code = error instanceof SafeStop ? error.code : 'OPERATION_NOT_CONFIRMED';
    console.error(`Recovery stopped: ${code}. Raw errors/credentials are intentionally not printed. No automatic retry. Keep existing accounts and saved passwords; inspect confirmed/uncertain status before continuing.`);
    process.exitCode = 1;
  });
}
