/**
 * The assembly viewer.
 *
 * One WebGL context serves the whole page. The canvas is fixed and full-bleed,
 * but the model is never centred in it: the camera is offset each frame so the
 * assembly lands inside whichever DOM element carries [data-model-bay]. That
 * keeps the 3D registered to the layout at every breakpoint without a single
 * hard-coded position, and lets the hero frame and the explorer frame share one
 * continuous camera move instead of two separate scenes.
 */

import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Group,
  MathUtils,
  PMREMGenerator,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Sphere,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Served straight out of public/ so the asset keeps a stable, inspectable path.
const MODEL_URL = `${import.meta.env.BASE_URL}models/exogait_assembly.glb`;

const IDLE_SPEED = 0.055;        // rad/s of drift when nothing is selected
const DAMP = 4.2;                // higher = snappier camera
const MIN_PHI = 0.55;
const MAX_PHI = 2.35;

/** dir (target -> camera) to spherical angles. */
function dirToAngles([x, y, z]) {
  const len = Math.hypot(x, y, z) || 1;
  return { theta: Math.atan2(x, z), phi: Math.acos(MathUtils.clamp(y / len, -1, 1)) };
}

/** Frame-rate independent lerp factor. */
function damp(current, goal, lambda, dt) {
  return MathUtils.lerp(current, goal, 1 - Math.exp(-lambda * dt));
}

/** Shortest signed angular difference, so orbiting never takes the long way round. */
function shortestAngle(from, to) {
  return from + ((((to - from) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}

export function createViewer({ canvas, dragSurface, onProgress, onReady, onError }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    onError?.(err);
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.9));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  // Clears are issued by hand: the render is scissored to the bay, and an
  // automatic clear would only wipe inside that box, smearing the frame behind
  // the model as the bay travels up the page.
  renderer.autoClear = false;

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.05, 60);

  // Indoor probe for believable metal without shipping an HDR file.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;

  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(2.4, 3.2, 2.8);
  scene.add(key);

  // A cold rim in the accent hue: reads as edge light, not as a purple wash.
  const rim = new DirectionalLight(0x8f68ff, 1.5);
  rim.position.set(-2.6, 1.1, -2.2);
  scene.add(rim);

  const fill = new DirectionalLight(0x6d7180, 0.75);
  fill.position.set(-1.2, -1.8, 1.6);
  scene.add(fill);

  const root = new Group();
  scene.add(root);

  // --- Camera rig --------------------------------------------------------
  const rig = {
    theta: 0.46,
    phi: 1.44,
    radius: 1,
    target: new Vector3(),
    ndc: new Vector2(0, 0),
  };
  const goal = {
    theta: 0.46,
    phi: 1.44,
    radius: 1,
    target: new Vector3(),
    ndc: new Vector2(0, 0),
  };

  let model = null;
  const modelSphere = new Sphere(new Vector3(), 1);
  /** Half-extents used for framing: vertical, and the worst-case horizontal
   *  radius so the assembly never clips as the camera orbits. */
  const modelExtent = { y: 1, xz: 1 };
  let focus = null;                 // active hotspot descriptor, or null
  let dragging = false;
  let running = false;
  let visible = false;
  let lastTime = 0;
  let frame = 0;

  const raycaster = new Raycaster();
  const meshes = [];
  const tmpVec = new Vector3();
  const tmpOffset = new Vector3();
  const camRight = new Vector3();
  const camUp = new Vector3();

  /** Callbacks run immediately after each render, in frame order. */
  const frameHooks = [];

  // --- Sizing ------------------------------------------------------------

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /**
   * Distance at which an object fits inside the given viewport-relative box.
   *
   * Fitting on the bounding-sphere radius would leave a tall, narrow assembly
   * looking undersized in its frame — the sphere is sized by the diagonal, not
   * by what the camera actually has to clear. Height and width are solved
   * separately instead, and the tighter of the two wins.
   */
  function distanceToFit(extent, box, margin = 1.08) {
    const tan = Math.tan(MathUtils.degToRad(camera.fov) / 2);
    const fracH = Math.max(0.12, box.h / window.innerHeight);
    const fracW = Math.max(0.12, (box.w / window.innerWidth) * camera.aspect);
    return Math.max(extent.y / (tan * fracH), extent.xz / (tan * fracW)) * margin;
  }

  // --- Bay registration --------------------------------------------------

  let bays = [];
  /** Viewport-space rect the model is currently rendered into. */
  let bayRect = null;

  function collectBays() {
    bays = [...document.querySelectorAll('[data-model-bay]')].map((el) => ({
      el,
      name: el.dataset.modelBay,
    }));
  }

  /**
   * The bay nearest the centre of the viewport wins.
   *
   * The rect is clipped to the viewport before use: a bay that is half below
   * the fold should frame the model in the half you can actually see, not
   * centre it on a midpoint somewhere off screen.
   */
  function activeBay() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mid = vh / 2;
    let best = null;
    let bestDist = Infinity;

    for (const bay of bays) {
      const r = bay.el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;

      const top = Math.max(r.top, 0);
      const bottom = Math.min(r.bottom, vh);
      const left = Math.max(r.left, 0);
      const right = Math.min(r.right, vw);
      const h = bottom - top;
      const w = right - left;
      if (h <= 0 || w <= 0) continue;

      const d = Math.abs((top + bottom) / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = { name: bay.name, x: (left + right) / 2, y: (top + bottom) / 2, w, h, left, top };
      }
    }
    return best;
  }

  // --- Goal computation --------------------------------------------------

  function updateGoal() {
    if (!model) return;
    const bay = activeBay();
    if (!bay) return;
    bayRect = bay;

    goal.ndc.set((bay.x / window.innerWidth) * 2 - 1, -((bay.y / window.innerHeight) * 2 - 1));

    if (focus) {
      goal.target.copy(focus.center);
      const a = dirToAngles(focus.view.dir);
      goal.theta = shortestAngle(rig.theta, a.theta);
      goal.phi = MathUtils.clamp(a.phi, MIN_PHI, MAX_PHI);
      // Clamped at both ends: never so close that the near plane bites, never so
      // far that "focused" looks the same as the full assembly.
      const r = MathUtils.clamp(
        focus.radius * focus.view.dist,
        0.05,
        modelExtent.y * 0.7,
      );
      goal.radius = distanceToFit({ y: r, xz: r }, bay, 1.0);
    } else {
      goal.target.copy(modelSphere.center);
      goal.radius = distanceToFit(modelExtent, bay, bay.name === 'hero' ? 1.1 : 1.02);
    }
  }

  // --- Frame -------------------------------------------------------------

  function step(now) {
    if (!running) return;
    requestAnimationFrame(step);

    const dt = Math.min((now - lastTime) / 1000 || 0.016, 0.05);
    lastTime = now;
    frame += 1;

    if (!visible) return;

    updateGoal();

    if (!focus && !dragging) goal.theta += IDLE_SPEED * dt;

    rig.theta = damp(rig.theta, goal.theta, DAMP, dt);
    rig.phi = damp(rig.phi, goal.phi, DAMP, dt);
    rig.radius = damp(rig.radius, goal.radius, DAMP, dt);
    rig.target.lerp(goal.target, 1 - Math.exp(-DAMP * dt));
    rig.ndc.x = damp(rig.ndc.x, goal.ndc.x, DAMP * 1.4, dt);
    rig.ndc.y = damp(rig.ndc.y, goal.ndc.y, DAMP * 1.4, dt);

    // Place the camera on its orbit, then slide camera and target together so
    // the model projects at the bay's screen position rather than dead centre.
    const sinPhi = Math.sin(rig.phi);
    camera.position.set(
      rig.target.x + rig.radius * sinPhi * Math.sin(rig.theta),
      rig.target.y + rig.radius * Math.cos(rig.phi),
      rig.target.z + rig.radius * sinPhi * Math.cos(rig.theta),
    );
    camera.lookAt(rig.target);

    const halfH = rig.radius * Math.tan(MathUtils.degToRad(camera.fov) / 2);
    const halfW = halfH * camera.aspect;
    camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    tmpOffset
      .copy(camRight).multiplyScalar(-rig.ndc.x * halfW)
      .addScaledVector(camUp, -rig.ndc.y * halfH);
    camera.position.add(tmpOffset);
    camera.lookAt(tmpVec.copy(rig.target).add(tmpOffset));

    // Render only inside the bay. Without this, zooming in on a 120 mm housing
    // throws the rest of the assembly across the copy beside it — the frame has
    // to be a real window, not a decorative rectangle.
    renderer.setScissorTest(false);
    renderer.clear();
    if (bayRect) {
      const dpr = renderer.getPixelRatio();
      renderer.setScissorTest(true);
      renderer.setScissor(
        Math.floor(bayRect.left * dpr),
        Math.floor((window.innerHeight - bayRect.top - bayRect.h) * dpr),
        Math.ceil(bayRect.w * dpr),
        Math.ceil(bayRect.h * dpr),
      );
    }
    renderer.render(scene, camera);
    renderer.setScissorTest(false);

    for (const hook of frameHooks) hook(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(step);
  }

  function stop() {
    running = false;
  }

  // --- Public projection helper -----------------------------------------

  /** World point -> viewport pixels, plus whether it is behind the camera. */
  function project(point, out) {
    tmpVec.copy(point).project(camera);
    out.x = (tmpVec.x * 0.5 + 0.5) * window.innerWidth;
    out.y = (-tmpVec.y * 0.5 + 0.5) * window.innerHeight;
    return tmpVec.z < 1;
  }

  /** True when geometry sits between the camera and `point`. */
  function isOccluded(point) {
    tmpVec.copy(point).sub(camera.position);
    const dist = tmpVec.length();
    raycaster.set(camera.position, tmpVec.normalize());
    raycaster.far = dist - 0.006;
    const hit = raycaster.intersectObjects(meshes, false);
    return hit.length > 0;
  }

  // --- Interaction -------------------------------------------------------

  let pointerId = null;
  let last = { x: 0, y: 0 };
  let moved = 0;

  if (dragSurface) {
    dragSurface.addEventListener('pointerdown', (e) => {
      pointerId = e.pointerId;
      dragSurface.setPointerCapture(pointerId);
      dragging = true;
      moved = 0;
      last = { x: e.clientX, y: e.clientY };
      dragSurface.classList.add('is-dragging');
    });

    dragSurface.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      last = { x: e.clientX, y: e.clientY };
      goal.theta -= dx * 0.006;
      goal.phi = MathUtils.clamp(goal.phi - dy * 0.005, MIN_PHI, MAX_PHI);
      rig.theta = goal.theta;
      rig.phi = goal.phi;
    });

    const endDrag = (e) => {
      if (e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      dragSurface.classList.remove('is-dragging');
      // A press that did not travel is a click on empty space, not an orbit.
      if (moved < 6) api.onBackgroundClick?.();
    };

    dragSurface.addEventListener('pointerup', endDrag);
    dragSurface.addEventListener('pointercancel', endDrag);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('resize', collectBays, { passive: true });
  resize();
  collectBays();

  // --- Load --------------------------------------------------------------

  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      model = gltf.scene;

      model.traverse((o) => {
        if (!o.isMesh) return;
        meshes.push(o);
        const m = o.material;
        if (!m) return;
        // The source model marks highlight parts with an amber material. Retint
        // it to the accent so "this is the part that does the work" reads in the
        // page's own colour language.
        if (m.name === 'accent_amber') {
          m.color = new Color('#6d3bf5');
          m.emissive = new Color('#2a1266');
          m.emissiveIntensity = 0.9;
          m.metalness = 0.25;
          m.roughness = 0.35;
        }
        if (m.name === 'textile_slate') {
          m.color = new Color('#33343c');
          m.roughness = 0.96;
          m.metalness = 0.02;
        }
        if (m.name === 'petg_cf_charcoal') {
          m.color = new Color('#2b2c33');
          m.roughness = 0.66;
          m.metalness = 0.1;
        }
        if (m.name === 'alu_6061') {
          m.color = new Color('#9aa0aa');
          m.roughness = 0.3;
          m.metalness = 0.95;
        }
        if (m.name === 'steel_hardened') { m.roughness = 0.24; m.metalness = 1; }
        if (m.name === 'pcb_olive') { m.color = new Color('#2c3a2a'); m.roughness = 0.7; }
        m.envMapIntensity = 0.85;
      });

      // Recentre on the origin so orbit maths stays simple.
      const box = new Box3().setFromObject(model);
      const centre = box.getCenter(new Vector3());
      model.position.sub(centre);
      root.add(model);

      const world = new Box3().setFromObject(root);
      world.getBoundingSphere(modelSphere);
      const size = world.getSize(new Vector3());
      modelExtent.y = size.y / 2;
      modelExtent.xz = Math.hypot(size.x, size.z) / 2;

      rig.target.copy(modelSphere.center);
      goal.target.copy(modelSphere.center);
      // Start pulled back, so the first frames read as a dolly in rather than a pop.
      rig.radius = distanceToFit(modelExtent, { w: window.innerWidth * 0.4, h: window.innerHeight * 0.7 }, 1.9);
      goal.radius = rig.radius;

      onReady?.(api);
      start();
    },
    (evt) => {
      if (evt.lengthComputable) onProgress?.(evt.loaded / evt.total);
      else onProgress?.(null);
    },
    (err) => onError?.(err),
  );

  // --- API ---------------------------------------------------------------

  const api = {
    scene,
    camera,
    root,
    project,
    isOccluded,
    start,
    stop,
    onBackgroundClick: null,

    setVisible(v) {
      visible = v;
      if (v) start();
    },

    /** Resolve a named node from the glTF graph to a focusable descriptor. */
    resolve(nodeName, view) {
      if (!model) return null;
      const node = model.getObjectByName(nodeName);
      if (!node) return null;
      const sphere = new Box3().setFromObject(node).getBoundingSphere(new Sphere());
      return { node, center: sphere.center.clone(), radius: Math.max(sphere.radius, 0.012), view };
    },

    focusOn(descriptor) {
      focus = descriptor;
    },

    clearFocus() {
      focus = null;
    },

    get hasFocus() {
      return focus !== null;
    },

    onFrame(fn) {
      frameHooks.push(fn);
    },

    /** Current render window in viewport pixels, or null before first frame. */
    get bayRect() {
      return bayRect;
    },

    refreshBays: collectBays,
  };

  return api;
}
