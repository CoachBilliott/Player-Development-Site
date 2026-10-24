// Runs inside the actual iPhone WKWebView, with isolated fictional data only.
const store = window.Capacitor.Plugins.SecureStoragePlugin;
if (!store || !window.Capacitor.isNativePlatform()) throw new Error('Native bridge is unavailable');
const image = document.querySelector('.app-start-photo img');
await image.decode();
await document.fonts.ready;
if (image.naturalWidth !== 1440) throw new Error('Bundled welcome photo did not load');
if (!document.fonts.check('700 16px "Barlow Condensed"')) throw new Error('Bundled display font did not load');
if (typeof crypto.randomUUID !== 'function') throw new Error('Native secure UUID support is unavailable');

let stored = false;
try {
  stored = (await store.set({ key, value: 'fictional-native-fixture' })).value;
  if (!stored) throw new Error('Keychain write failed');
  if ((await store.get({ key })).value !== 'fictional-native-fixture') throw new Error('Keychain read did not match');
} finally {
  if (stored) await store.remove({ key });
}

const tick = () => new Promise(resolve => setTimeout(resolve, 50));
const wait = async (find, name) => {
  for (let i = 0; i < 100; i++) {
    const found = find();
    if (found) return found;
    await tick();
  }
  throw new Error('Native training screen did not show ' + name);
};
const button = name => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === name && !b.disabled);
const click = async name => { (await wait(() => button(name), name)).click(); await tick(); };
const acknowledge = async () => {
  (await wait(() => document.querySelector('dialog[open] input[type=checkbox]:not(:disabled)'), 'practice acknowledgement')).click();
  await tick();
};
const history = () => JSON.parse(localStorage.getItem('pd-family-demo-v1') || '{"workouts":[]}').workouts;
const before = history().length;
location.hash = 'demo';
await click('Solo athlete');
await click('Start sample workout');
await acknowledge();
await click('Begin sample practice');
let submitted = false;
for (let drill = 0; drill < 12; drill++) {
  await click('Show workout steps');
  await acknowledge();
  const submit = button('Submit reported workout');
  if (submit) {
    submit.click();
    submitted = true;
    break;
  }
  await click('Next workout drill');
}
if (!submitted) throw new Error('Native practice did not reach submission');
await wait(() => history().length === before + 1, 'persisted practice report');
await wait(() => document.body.textContent.includes('Self-reported practice'), 'honest practice history');
location.hash = 'app';
return true;
