// Static checks: Hey ORI is tap-to-talk (user-initiated only, no always-on wake word)
// and no unsupported private-AI claims.
import { readFileSync } from 'node:fs'
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const screens = readFileSync(new URL('../src/Screens.tsx', import.meta.url), 'utf8')
const listen = read('src/listen.ts')
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('PASS', m) } else { fail++; console.log('FAIL', m) } }
const fn = (name) => (app.match(new RegExp(`const ${name} = \\(\\) => ([^\\n]+)`)) || [])[1] || ''
const getUserMedia = /getUserMedia|requestMicrophoneAccess/
ok(!getUserMedia.test(app + screens + listen), 'no getUserMedia / requestMicrophoneAccess (the OS prompt may appear after a tap)')
ok(!/toggleMic|handleHeard|startListening/.test(app), 'removed always-on wake helpers from App')
ok(/startTapToTalk/.test(app) && /beginTalk/.test(app), 'App.tsx starts speech only through tap-to-talk helpers')
const hey = fn('heyOri')
ok(/openChat\(\)/.test(hey) && /beginTalk\(\)/.test(hey), 'heyOri opens chat and starts or stops tap-to-talk')
ok(/listenSt === 'listening'/.test(hey) && /haltTalk\(\)/.test(hey), 'a second Hey ORI tap stops listening')
const open = fn('openChat')
ok(open.length > 0 && !/startTapToTalk|beginTalk|SpeechRecognition|getUserMedia/.test(open), 'openChat does not start the microphone')
ok(/const ask = \(q\?: string\) => \{ openChat\(\); if \(q\) command\(q\) \}/.test(app), 'Ask Ori (type) does not start the microphone')
const btns = [...app.matchAll(/<button className="mic[^"]*" onClick=\{(\w+)\}/g)].map(m => m[1])
ok(btns.length === 2 && btns.every(b => b === 'heyOri'), 'both Hey ORI buttons call heyOri (found ' + btns.length + ')')
ok(!/always listening|listens for .hey|wake phrase/i.test((app + screens).replace(/not always listening/gi, '')), 'does not advertise always-on listening')
ok(/no always-on wake word/i.test(screens), 'Settings says there is no always-on wake word')
ok(!/Attestation verifiable|runs in NEAR AI Cloud/.test(app), 'no unsupported NEAR AI Cloud / attestation claim')
ok(/Not connected yet, planned/.test(app), 'private AI marked as not connected / planned')
const voice = read('src/voice.ts'), settings = read('src/settings.ts'), brain = read('src/brain.ts'), mock = read('src/mock.ts'), demo = read('demo.mjs')
ok(!/SpeechRecognition|webkitSpeechRecognition|getUserMedia|startTapToTalk|startListening/.test(voice) && /export function speak/.test(voice), 'voice.ts has no microphone/recognition code and keeps opt-in speak')
ok(/continuous\s*=\s*false/.test(listen) && !/continuous\s*=\s*true/.test(listen), 'recognition is not continuous')
ok(!/onend\s*=\s*[^{]*\{[^}]*rec\.start/.test(listen), 'onend does not restart recognition')
ok(!/WAKE\s*=/.test(listen), 'listen.ts has no wake-word detector')
ok(/if \(!chat\) \{ haltTalk/.test(app), 'closing chat aborts recognition')
ok(/useEffect\(\(\) => \{ haltTalk\(\) \}, \[screen\]\)/.test(app), 'changing screens aborts recognition')
ok(/useEffect\(\(\) => \(\) => \{ haltTalk\(\) \}, \[\]\)/.test(app), 'unmount aborts recognition')
ok(!/onFinal:[^}]*command\(/.test(app), 'a recognized transcript does not auto-submit or spend')
ok(!/\bwake\b/.test(settings), 'obsolete wake setting removed')
ok(!/__ori|\.hear\(/.test(demo) && /button\.mic/.test(demo), 'demo script uses the click UI, not simulated hearing')
const ui = app + screens + brain + mock
const claims = [/derived separately/i, /no public link between them/i, /never reuse an address/i, /use fresh addresses/i, /confidential compute/i, /\(derived\)/, /DEFAULT ON/, /That’s how ORI can hold/]
claims.forEach(c => ok(!c.test(ui), 'no unsupported claim ' + c))
ok((app.match(/Not implemented yet, planned/g) || []).length === 2, 'per-chain and fresh-address rows marked planned')
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
