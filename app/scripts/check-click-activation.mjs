// Static checks: Hey ORI is click-only (no mic / wake word) and no unsupported private-AI claims.
import { readFileSync } from 'node:fs'
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const screens = readFileSync(new URL('../src/Screens.tsx', import.meta.url), 'utf8')
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('PASS', m) } else { fail++; console.log('FAIL', m) } }
const fn = (name) => (app.match(new RegExp(`const ${name} = \\(\\) => ([^\\n]+)`)) || [])[1] || ''
const micApi = /requestMicrophoneAccess|startListening|getUserMedia|SpeechRecognition|toggleMic|handleHeard/
ok(!micApi.test(app), 'App.tsx references no microphone / speech-recognition / wake APIs')
ok(!micApi.test(screens), 'Screens.tsx references no microphone / speech-recognition / wake APIs')
const hey = fn('heyOri'); ok(hey.trim() === 'openChat()', 'heyOri only opens the chat')
const open = fn('openChat'); ok(open.length > 0 && !micApi.test(open), 'openChat does not touch the microphone')
const btns = [...app.matchAll(/<button className="mic[^"]*" onClick=\{(\w+)\}/g)].map(m => m[1])
ok(btns.length === 2 && btns.every(b => b === 'heyOri'), 'both Hey ORI buttons call heyOri (found ' + btns.length + ')')
ok(!/wake word/i.test(app + screens.replace(/No microphone or wake word is used/, '')), 'no wake-word copy left')
ok(!/Attestation verifiable|runs in NEAR AI Cloud/.test(app), 'no unsupported NEAR AI Cloud / attestation claim')
ok(/Not connected yet, planned/.test(app), 'private AI marked as not connected / planned')
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0)
