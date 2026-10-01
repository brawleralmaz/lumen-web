# Lumen browser experience

Investor introduction and working webcam-controlled 3D explorer. Built with React, TypeScript, Vite, Three.js, and MediaPipe. The adjacent Python desktop application is unchanged.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Choose Biology, Robotics, Computer hardware, or Interactive learning to enter the studio and request camera permission. HTTPS or localhost is required for camera access. Browser support also requires WebGL, WebAssembly, Web Workers, and ImageBitmap. Chromium desktop browsers are the primary verified target; mobile layouts and mouse controls are provided.

```bash
npm run build
npm run preview
```

The GitHub Pages workflow builds and deploys `dist/` on pushes to `master`. It detects the Pages base path, so project pages and custom domains both work. To build locally for a project path, set `PAGES_BASE_PATH` (for example, `/lumen-web`) before `npm run build`; without it, the build targets the origin root. No API keys, backend, accounts, or server camera processing are needed. All runtime assets, including tracking model and WASM binaries, are bundled locally. Camera frames are neither stored nor uploaded. Camera tracks stop on exit, when switched off, and on entry to mouse mode.

## Explore

- **Camera:** model over the mirrored live webcam.
- **Studio:** model on a clean background with a live webcam inset.
- Point to hover, pinch and hold to select, and pinch empty space to clear.
- Open palm to move; V sign to rotate; distance between two index fingers to scale.
- Hold a fist for 0.45 seconds to pause; hold an open palm for 0.45 seconds to resume.
- Mouse mode: drag to rotate, Shift-drag to move, scroll to scale, click to select.
- R resets the view, X clears selection, Space pauses/resumes, H opens the tutorial. Escape closes it.

The tutorial also provides on-screen gesture guidance. Mouse mode explicitly releases the webcam. Switching viewing modes retains transforms and selection. Category changes reset the specimen. Tracking loss releases active gesture anchors to avoid jumps when a hand returns.

## Assets and labels

See `public/credits.html` for licenses and source citations. Biology uses the Human Reference Atlas male heart v1.2 (CC BY 4.0), downloaded from https://raw.githubusercontent.com/hubmapconsortium/ccf-releases/main/v1.2/models/VH_M_Heart.glb. Source labels identify its valves, chambers, septum, and papillary muscles. The downloaded GLB is unchanged.

Computer hardware uses Daniel Cardona’s **MotherBoard + Components** GLB from the desktop assets. The adjacent desktop JSON describes a different board and is intentionally not reused. Selection is limited to semantically identifiable authored materials such as the battery, capacitors, processor bracket/latch, USB housing, and I/O cover. Unlabeled geometry remains visible and blocks raycasts. Robotics and Interactive learning use original simplified specimens, clearly identified in the viewer.

Robot joint demonstrations, matching games, and Jeremy voice assistance are not implemented in this release.

## Architecture

- `src/catalog.ts` and `src/types.ts`: typed categories, provenance, tracking, gestures, transforms, and educational components.
- `src/models.ts` and `src/Scene.tsx`: model loading, verified component mapping, rendering, raycasts, highlights, and disposal. Offscreen scenes skip rendering.
- `src/gestures.ts`: landmark pose recognition, One Euro smoothing, outlier handling, debouncing, pinch hysteresis, stable hover, interaction dwell, and bounded transforms.
- `src/tracking.worker.ts`: actual MediaPipe inference, isolated from rendering. Uses MediaPipe's module WASM loader, required for module workers.
- `src/useCamera.ts`: camera lifecycle and one-frame-at-a-time worker submission at up to 30 FPS.
- `src/Experience.tsx`: both viewing modes, camera/error states, accessible controls, tutorial, and mouse fallback.

## Verification

```bash
npm test
npm run build
npm run test:e2e
```

Browser tests use the installed Google Chrome at `/usr/bin/google-chrome`. Set `PLAYWRIGHT_CHROME_PATH` to another Chrome executable if needed; on a machine without system Chrome, run `npx playwright install chromium` and unset the executable override in the configuration. Start the dev server before running the browser suite.

Unit tests use deterministic synthetic landmark fixtures. Browser integration tests use Chromium synthetic camera input and the real MediaPipe worker, check local-only requests and camera release, and cover navigation, both views, selection, failure recovery, mobile overflow, and accessibility. Screenshots are saved under `test-artifacts/`.

There is no physical webcam in the implementation environment. Actual human-hand accuracy and performance on physical cameras still require a real-device check; synthetic camera and landmark tests do not establish those results.

The standalone browser app was selected after comparing it with server rendering, a Python bridge, desktop streaming, and a hybrid. The static build, real GLB loading, and actual worker inference provide feasibility evidence for the selected approach without adding a backend.
