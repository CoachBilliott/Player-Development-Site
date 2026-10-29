// Mock-only safety tests. No real credential, network, account or password reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { allowlist, adminKey, passwordValid, guardedFetch, recover, readHidden, sdkClient, PROJECT, URL, EMAILS, VERIFIED_USERS } from './recover-test-users.mjs';
const manifest = () => ({ project_ref: PROJECT, users: structuredClone(VERIFIED_USERS) });
const fakePassword = () => 'Aa1!' + randomUUID().replaceAll('-','');
// Runtime-only mock value, not a published credential-shaped literal.
const fakeKey = () => ['sb','secret','MOCK','ONLY',randomUUID().replaceAll('-','')].join('_');
function fixture(options = {}) {
  const logs = [], updates = [], secrets = Array.from({length:6},fakePassword);
  const key = fakeKey();
  let index=0,last='',factoryCalls=0, secretCalls=0;
  const io = {
    say: x => logs.push(x),
    ask: async label => label.startsWith('Type the TEST') ? options.project ?? PROJECT : label.startsWith('Type PASSWORD') ? options.notifications ?? 'PASSWORD_CHANGED_EMAILS_OFF' : options.confirm ?? 'RESET SIX FICTIONAL USERS',
    secret: async label => {
      secretCalls++;
      if (label.startsWith('Existing TEST')) return key;
      if (label.startsWith('Confirm')) return options.mismatch ? 'not-the-same' : last;
      last = options.duplicate ? secrets[0] : secrets[index++]; return last;
    },
  };
  const remote = options.remote ?? structuredClone(VERIFIED_USERS);
  const client = { auth:{admin:{
    listUsers: async () => ({data:{users:remote,total:remote.length},error:null}),
    getUserById: async id => ({data:{user:remote.find(x=>x.id===id)},error:null}),
    updateUserById: async (id,body) => {
      updates.push({id,body});
      if (options.failAt === updates.length) {
        if (options.throwError) throw Error(key+' '+secrets[0]);
        return {data:{user:null},error:{message:key+' '+secrets[0]}};
      }
      return {data:{user:remote.find(x=>x.id===id)},error:null};
    },
  }}};
  const makeClient = async supplied => { factoryCalls++; assert.equal(supplied,key); return client; };
  return { logs,updates,secrets,key,io,makeClient, stats:()=>({factoryCalls,secretCalls}) };
}
test('exact immutable UUID/email pairs only; no wrong project, seventh user or credential in allowlist',()=>{
  assert.deepEqual(allowlist(manifest()),VERIFIED_USERS);
  const cases=[{...manifest(),project_ref:'iilbulpqbuknhdpmtrvm'},{...manifest(),password:'DO_NOT_STORE'}, {...manifest(),users:[...VERIFIED_USERS,VERIFIED_USERS[0]]}];
  const changed=manifest();changed.users[0].id=randomUUID();cases.push(changed);
  const secret=manifest();secret.users[0].password='DO_NOT_STORE';cases.push(secret);
  const swapped=manifest();swapped.users[0].email=EMAILS[1];cases.push(swapped);
  for(const value of cases)assert.throws(()=>allowlist(value),{code:'INVALID_ALLOWLIST'});
});
test('public/user/production credentials refused; secret-type recognition is not server validation',()=>{
  const jwt=(role,ref=PROJECT)=>'header.'+Buffer.from(JSON.stringify({role,ref})).toString('base64url')+'.signature';
  const mock = fakeKey();assert.equal(adminKey(mock),mock);
  assert.equal(adminKey(jwt('service_role')),jwt('service_role'));
  for(const value of ['sb_publishable_MOCK_ONLY_key',jwt('authenticated'),jwt('service_role','iilbulpqbuknhdpmtrvm'),'bad'])assert.throws(()=>adminKey(value),{code:'INVALID_TEST_ADMIN_KEY'});
});
test('transport confines host, UUIDs, methods, password-only payload and rejects redirects',async()=>{
  const calls=[];const request=guardedFetch(VERIFIED_USERS,async(...args)=>{calls.push(args);return new Response('{}');});
  const id=VERIFIED_USERS[0].id;
  const invalid=[
    ['https://iilbulpqbuknhdpmtrvm.supabase.co/auth/v1/admin/users/'+id,{method:'PUT',body:JSON.stringify({password:fakePassword()})}],
    [URL+'/auth/v1/admin/users/'+randomUUID(),{method:'PUT',body:JSON.stringify({password:fakePassword()})}],
    [URL+'/auth/v1/admin/users/'+id,{method:'DELETE'}],
    [URL+'/auth/v1/admin/users/'+id,{method:'PUT',body:JSON.stringify({password:fakePassword(),email:'other@example.test'})}],
    [URL+'/auth/v1/recover',{method:'POST'}],
    [URL+'/rest/v1/account_roles',{method:'PATCH'}],
    [URL+'/auth/v1/admin/users?page=1&per_page=1000',{}],
  ];
  for(const [url,init]of invalid)await assert.rejects(request(url,init),{code:'BLOCKED_REQUEST'});
  assert.equal(calls.length,0);
  await request(URL+'/auth/v1/admin/users?page=1&per_page=7');
  await request(URL+'/auth/v1/admin/users/'+id,{method:'PUT',body:JSON.stringify({password:fakePassword()})});
  assert.equal(calls.length,2);assert.equal(calls[1][1].redirect,'error');assert.equal(calls[1][1].credentials,'omit');
});
test('default verification performs no mutation and never asks replacement passwords',async()=>{
  const f=fixture();const result=await recover({manifest:manifest(),io:f.io,makeClient:f.makeClient});
  assert.deepEqual(result,{status:'verified',changed:0});assert.equal(f.updates.length,0);assert.equal(f.stats().secretCalls,1);
  assert.ok(!f.logs.join('\n').includes(f.key));
});
test('missing notification-off attestation or final confirmation aborts before every mutation',async()=>{
  for(const options of [{notifications:''},{notifications:'unknown'},{confirm:'cancel'}]){
    const f=fixture(options);await assert.rejects(recover({manifest:manifest(),apply:true,io:f.io,makeClient:f.makeClient}));assert.equal(f.updates.length,0);
  }
});
test('wrong project stops before secret input and wrong provider identities stop before reset',async()=>{
  const f=fixture({project:'production'});await assert.rejects(recover({manifest:manifest(),apply:true,io:f.io,makeClient:f.makeClient}),{code:'PROJECT_NOT_CONFIRMED'});assert.equal(f.stats().secretCalls,0);assert.equal(f.stats().factoryCalls,0);
  for(const remote of [[...VERIFIED_USERS,{id:randomUUID(),email:'unapproved@example.test'}],VERIFIED_USERS.slice(1)]){
    const x=fixture({remote});await assert.rejects(recover({manifest:manifest(),apply:true,io:x.io,makeClient:x.makeClient}),{code:'IDENTITY_PRECHECK_FAILED'});assert.equal(x.updates.length,0);
  }
});
test('six exact password-only updates preserve ID pairs and never print keys/passwords',async()=>{
  const f=fixture();const before=structuredClone(VERIFIED_USERS);const result=await recover({manifest:manifest(),apply:true,io:f.io,makeClient:f.makeClient});
  assert.deepEqual(result,{status:'updated',changed:6});assert.deepEqual(f.updates.map(x=>x.id),VERIFIED_USERS.map(x=>x.id));
  assert.ok(f.updates.every(x=>Object.keys(x.body).join(',')==='password'&&passwordValid(x.body.password)));
  assert.deepEqual(VERIFIED_USERS,before);
  const log=f.logs.join('\n');assert.ok(!log.includes(f.key));for(const password of f.secrets)assert.ok(!log.includes(password));
});
test('uncertain provider result stops without retry, logs no raw provider error or secret',async()=>{
  for(const throwError of [false,true]){
    const f=fixture({failAt:3,throwError});await assert.rejects(recover({manifest:manifest(),apply:true,io:f.io,makeClient:f.makeClient}),{code:'RESET_OUTCOME_UNCERTAIN'});
    assert.equal(f.updates.length,3);const log=f.logs.join('\n');assert.ok(log.includes('NOT CONFIRMED'));assert.ok(log.includes('Confirmed password updates this run: 2'));assert.ok(!log.includes(f.key));for(const password of f.secrets)assert.ok(!log.includes(password));
  }
});
test('password mismatch, duplicate or cancellation before apply cannot reset anyone',async()=>{
  for(const options of [{mismatch:true},{duplicate:true}]){
    const f=fixture(options);await assert.rejects(recover({manifest:manifest(),apply:true,io:f.io,makeClient:f.makeClient}));assert.equal(f.updates.length,0);
  }
  const f=fixture();f.io.secret=async()=>{throw Error('mock cancellation');};await assert.rejects(recover({manifest:manifest(),apply:true,io:f.io,makeClient:f.makeClient}),{code:'OPERATION_NOT_CONFIRMED'});assert.equal(f.updates.length,0);
});
test('private input is non-echo, restores raw mode, and Ctrl-C does not return buffered text',async()=>{
  function tty(){const input=new PassThrough();input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};const output=new PassThrough();output.isTTY=true;let printed='';output.on('data',b=>{printed+=b.toString();});return{input,output,printed:()=>printed};}
  const t=tty();const value='mock-hidden-text';const pending=readHidden('Hidden: ',t.input,t.output);for(const char of value)t.input.emit('keypress',char,{name:char});t.input.emit('keypress','',{name:'return'});assert.equal(await pending,value);assert.equal(t.printed(),'Hidden: \n');assert.equal(t.input.isRaw,false);assert.equal(t.input.listenerCount('keypress'),0);
  const cancelled=tty();const stopped=readHidden('Hidden: ',cancelled.input,cancelled.output);cancelled.input.emit('keypress','x',{name:'x'});cancelled.input.emit('keypress','',{ctrl:true,name:'c'});await assert.rejects(stopped,{code:'CANCELLED'});assert.equal(cancelled.printed(),'Hidden: \n');assert.equal(cancelled.input.isRaw,false);
  const unavailable=tty();unavailable.output.isTTY=false;await assert.rejects(readHidden('Hidden: ',unavailable.input,unavailable.output),{code:'PRIVATE_TTY_REQUIRED'});
});
test('pinned real SDK uses only permitted wire requests; absent pagination headers and update failure are safe',async()=>{
  for(const fail of [false,true]){
    const f=fixture();const calls=[];
    const makeClient=(key,rows)=>sdkClient(key,rows,async(url,init)=>{
      const target=new globalThis.URL(url);calls.push({path:target.pathname,method:init.method});
      if(target.pathname.endsWith('/admin/users'))return Response.json({users:VERIFIED_USERS});
      const user=VERIFIED_USERS.find(x=>target.pathname.endsWith(x.id));assert.ok(user);
      if(init.method==='PUT'){
        assert.deepEqual(Object.keys(JSON.parse(init.body)),['password']);
        if(fail)return Response.json({msg:'mock provider error'},{status:503});
      }
      return Response.json(user);
    });
    if(fail)await assert.rejects(recover({manifest:manifest(),apply:true,io:f.io,makeClient}),{code:'RESET_OUTCOME_UNCERTAIN'});
    else assert.equal((await recover({manifest:manifest(),apply:true,io:f.io,makeClient})).changed,6);
    assert.equal(calls.filter(x=>x.method==='PUT').length,fail?1:6);
    assert.ok(calls.every(x=>['GET','PUT'].includes(x.method)));
    assert.ok(!f.logs.join('\n').includes(f.key));
  }
});
