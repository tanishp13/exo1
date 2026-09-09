# ExoG8 — site

Single-page site for **ExoGait**, a bilateral wearable mechatronic sleeve that
gates knee-extension assistance on a pre-motion surface-EMG signal.

The page has one argument and everything on it serves that argument: a muscle's
electrical signal precedes its force by roughly 50 milliseconds, and ExoG8
spends that window taking up cable slack so torque arrives *before* the knee has
measurably moved. A device triggered by foot contact cannot — it is reacting to
something that already happened.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview    # serve dist/ at :4173
```

Node 20+ (CI uses 22). No other tooling required.

## What's here

```
index.html                  all markup; sections are semantic and readable without JS
public/models/*.glb         the assembly, served unhashed at a stable path
src/js/data.js              every fact on the page, with its source document noted
src/js/viewer.js            the WebGL scene, camera rig and bay framing
src/js/hotspots.js          markers, selection, projection, occlusion
src/js/sections.js          renders the content sections from data.js
src/js/{nav,form,reveal}.js header, intake form, scroll reveal
src/styles/tokens.css       the design system — start here before touching any CSS
src/assets/fonts/           self-hosted Blinker (OFL 1.1); see the README there
```

### Content

`src/js/data.js` is the single source of truth. Every number on the page is
traceable to the Form 2 complete specification or the pitch deck, marked `[PAT]`
and `[DECK]` in that file. Nothing there is invented. If a spec changes, change
it there and it changes everywhere it appears.

### The 3D viewer

One WebGL context serves the whole page. The canvas is fixed and full-bleed, but
the model is never centred in it — each frame the camera is offset so the
assembly lands inside whichever element carries `[data-model-bay]`, and the
render is scissored to that element's rect. The frame is therefore a real
window: zooming in on one housing does not throw the rest of the assembly across
the copy beside it. Because the framing comes from a live DOM rect, the 3D stays
registered to the layout at every breakpoint with no hard-coded positions.

Hotspots resolve **by node name** against the loaded glTF scene graph
(`R_ctrl_box_105`, `battery_hub_101`, …) and derive their anchor point and camera
distance from that node's bounding sphere. Rename a part in CAD and the marker
follows it; delete one and the page logs a warning and drops that marker rather
than breaking. To add a part, add an entry to `HOTSPOTS` in `src/js/data.js`:

```js
{
  ref: '109',
  name: 'Actuator',
  node: 'R_motor_109',        // must exist in the .glb
  layer: 'Actuation',
  lede: '…',
  specs: [['Reduction', '25 : 1']],
  view: { dir: [0.8, 0.15, 0.6], dist: 3.0 },  // dir: part -> camera
}
```

`dist` multiplies the part's own bounding radius, so a 9 mm IMU needs a much
larger multiplier than a 190 mm housing to end up equally framed. The result is
clamped so a focused view is never closer than the near plane nor as wide as the
full assembly.

The loop stops entirely once no bay is on screen, and on a hidden tab.

### The intake form

Transport is configured, not hard-coded. Copy `.env.example` to `.env.local`:

```
VITE_FORM_ENDPOINT=https://formspree.io/f/xxxxxxxx
VITE_CONTACT_EMAIL=you@yourdomain
```

Any endpoint accepting a JSON `{name, email, role, message}` POST works —
Formspree, EmailJS, or your own API route. **With no endpoint set the form still
works**: it composes the message and hands it to the visitor's mail client
rather than silently dropping it. Validation, error states, `aria-invalid`,
focus management and a honeypot field are all client-side and independent of
transport.

## Before this goes live

- [ ] **Replace the placeholder addresses.** `contact@exog8.in` and
      `research@exog8.in` in `index.html` are provisional — no such mailbox was
      supplied. Set real ones, and set `VITE_CONTACT_EMAIL` to match.
- [ ] Set `VITE_FORM_ENDPOINT`, or the form will keep falling back to `mailto:`.
- [ ] Point the LinkedIn link in the contact section at the real profile.

## Deploying

`.github/workflows/deploy.yml` builds on every push and PR, and publishes to
GitHub Pages from `main`. Enable Pages → Source: GitHub Actions in the repo
settings. The build uses a relative base, so it works from a repo subpath
(`/exo/`) as well as from a domain root; `dist/` is a plain static directory and
drops onto Netlify, Vercel or S3 unchanged.

## Design notes

Dark ground, hairlines instead of shadows, machined 3 px radii, Blinker for
everything with a system mono for numerals. Purple carries exactly one meaning —
the assist state, the moment torque is delivered — so it marks the active part,
the assist bar in the timing figure, and the primary action, and nothing else.
Section structure is drawn with rules and reference numerals borrowed from the
patent's own figures, which is where the annotated, drafting-table character
comes from.

Motion is decoration and never information: everything respects
`prefers-reduced-motion`, and the page is complete and readable with JavaScript
disabled or WebGL unavailable.
