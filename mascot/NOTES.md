# Mascot — behaviour + tech (concepts stage, not in app yet)
Sheet: `concepts.png` (source `concepts.html`, render `node render.mjs`). Hand-drawn SVG, no AI images. Mint #7DF5D8 only as glow/particles.

## Behaviour
- **Lives in a 48px lane** above the bottom nav. Idles (breathe, blink, look at the balance), wanders slowly left/right, sits on hairlines. Never covers numbers or buttons; hides during scrolling.
- **Reacts** to app state: balance up → little hop; scam blocked → stands in front of the button, shakes head; yield auto-exit → runs coins back to the wallet; balance hidden → covers its eyes.
- **Talk:** tap it (or hold to speak) → *listening* pose + chat bubble from its position. It answers in short lines ("Pay Tolu $50 from Base USDC, keep your SOL?").
- **Confirming actions:** it never executes on chat alone. It turns the request into the same Pay/Swap card the UI uses (route, fee, scam check) and the user confirms with hold-to-pay. Then *acting/carrying* pose: it carries the coin across the screen while the NEAR Intents status runs; it returns on success and shows a receipt.
- Reduced-motion setting → static idle, no wandering.

## Tech
- **Rive (recommended for the final):** one state machine (idle / wander / listen / think / carry / success / error) driven by app inputs, small runtime, smooth blending between states. Draw in Rive from these SVGs.
- **Lottie:** fine for linear loops, weak for interactive state, larger JSON; not recommended.
- **SVG + Motion (fastest for the hackathon):** these SVGs split into parts (eyes, legs, coin) animated with Motion springs/variants; wandering via animated x with random targets. Speck's dust can reuse the Home canvas particle code. Start here, move to Rive if time allows.
- Brain: the chat goes to the same intent parser (NEAR AI Cloud private inference) → returns a structured action → existing Pay/Swap confirmation.
