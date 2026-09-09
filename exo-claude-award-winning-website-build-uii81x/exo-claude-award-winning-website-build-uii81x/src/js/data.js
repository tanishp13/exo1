/**
 * Single source of truth for every fact printed on the page.
 *
 * Everything here is traceable to one of two documents:
 *   [PAT]  Form 2 complete specification, "Bilateral Wearable Mechatronic Sleeve
 *          for Proactive Lower Limb Augmentation and Knee Joint Offloading..."
 *   [DECK] EXOG8 pitch deck.
 * ...or to the node names inside public/models/exogait_assembly.glb.
 *
 * Nothing in this file is invented. If a number is not in a source, it is not here.
 */

/**
 * Parts of the assembly a visitor can inspect, keyed by the patent's reference
 * numerals.
 *
 * `view.dir` points from the part towards the camera; `view.dist` multiplies the
 * part's own bounding radius to decide how much surrounding context to keep in
 * frame. A 9 mm IMU therefore carries a much larger multiplier than a 190 mm
 * housing to end up looking equally well framed.
 */
export const HOTSPOTS = [
  {
    ref: '101',
    name: 'Power & reaction structure',
    // Nodes resolved by name against the loaded glTF scene graph.
    node: 'battery_hub_101',
    group: 'shared_subsystems',
    layer: 'Structure',
    lede:
      'A 6S2P lithium-ion hub rides on the pelvic belt (108), which is the primary reaction ' +
      'structure: every newton the system pulls is reacted into the skeletal pelvis, not into soft tissue.',
    specs: [
      ['Cell pack', '6S2P · 18650'],
      ['Protection', 'BMS 6S / 20 A'],
      ['Isolation', 'XT60 master cut-off'],
      ['Load path', 'Pelvis, not soft tissue'],
    ],
    view: { dir: [0.35, 0.3, 1], dist: 1.9 },
  },
  {
    ref: '103',
    name: 'Inertial sensing unit',
    node: 'R_imu_103',
    group: 'R_ctrl_box_105',
    layer: 'Sensing',
    lede:
      'One IMU per limb, mounted proximally at the housing. Thigh orientation is fused into a ' +
      'drift-corrected knee-angle estimate, so the shank and the foot carry no added mass at all.',
    specs: [
      ['Count', '1 per limb'],
      ['Placement', 'Proximal — thigh'],
      ['Distal mass added', '0 g'],
      ['Ground-contact sensors', 'None'],
    ],
    view: { dir: [0.8, 0.18, 0.7], dist: 6.5 },
  },
  {
    ref: '104',
    name: 'Myoelectric precursor sensing',
    node: 'R_semg_104_electrode_vl',
    group: 'R_semg_assembly_104',
    layer: 'Sensing',
    lede:
      'A self-adhesive differential pair sits over the knee-extensor muscle belly. Surface EMG ' +
      'onset precedes measurable force by around 50 ms — that gap is the window the whole device lives in.',
    specs: [
      ['Signal', 'Surface EMG envelope'],
      ['Site', 'Vastus lateralis / rectus femoris'],
      ['Reference', 'Quiescent bony landmark'],
      ['Lead on force', '≈ 50 ms'],
    ],
    view: { dir: [0.6, 0.1, 0.9], dist: 4.2 },
  },
  {
    ref: '105',
    name: 'Proximal housing & drive train',
    node: 'R_ctrl_box_105',
    group: 'R_R_leg_module',
    layer: 'Actuation',
    lede:
      'Controller, drive stage and actuator (109) in one hip-height box. A bevel pair (110) turns the ' +
      'motor axis through 90° so the housing lies flat against the thigh instead of standing off it.',
    specs: [
      ['Controller', 'ESP32-S3 · on-device inference'],
      ['Drive stage', 'BTS7960 H-bridge'],
      ['Reduction', '25 : 1 gearbox'],
      ['Angular transfer', 'Bevel pair (110)'],
    ],
    view: { dir: [0.85, 0.15, 0.55], dist: 1.55 },
  },
  {
    ref: '106',
    name: 'Bowden transmission across the knee',
    node: 'R_knee_sheave_40mm',
    group: 'R_R_leg_module',
    layer: 'Actuation',
    lede:
      'The spool (111) winds an inner tension member inside a sheath. It crosses the knee anterior to the ' +
      'flexion axis, so tension becomes an extension moment — with no rigid linkage spanning the joint.',
    specs: [
      ['Sheave', 'Ø 40 mm'],
      ['Path', 'Antero-lateral, anterior offset'],
      ['Efficiency', '≈ 94 % at 90° wrap'],
      ['Axis alignment required', 'None'],
    ],
    view: { dir: [0.5, 0.05, 1], dist: 4.0 },
  },
  {
    ref: 'SAF01',
    name: 'Distal anchor & mechanical breakaway',
    node: 'R_breakaway_anchor_SAF01_700N',
    group: 'R_R_leg_module',
    layer: 'Safety',
    lede:
      'The cable terminates on a tibial cuff (107) through an inline load cell and a calibrated ' +
      'frangible link. It releases on force alone — no firmware, no power, no permission required.',
    specs: [
      ['Release', '700 N calibrated'],
      ['Depends on software', 'No'],
      ['Instrumentation', 'Inline load cell'],
      ['Independent safety layers', '7'],
    ],
    view: { dir: [0.55, -0.05, 1], dist: 3.6 },
  },
];

/** [DECK] slide 8 — "How It Works". */
export const STEPS = [
  {
    n: '01',
    title: 'Wear & calibrate',
    body:
      'Belt, housing, electrode, tibial cuff. The app records a resting baseline and a peak contraction ' +
      'and sets the activation threshold inside that range — raw EMG voltage is meaningless between bodies.',
    meta: 'Per wearer, per session',
  },
  {
    n: '02',
    title: 'Sense',
    body:
      'The electrode (104) streams a muscle-activation envelope while the IMU (103) supplies a knee-angle ' +
      'estimate. Two independent channels, both read proximally, both above the knee.',
    meta: 'sEMG envelope + joint angle',
  },
  {
    n: '03',
    title: 'Predict',
    body:
      'An on-device model gates assistance on two conditions at once: the precursor signal has crossed ' +
      'threshold, and the joint angle sits inside the admissible window. Both, or nothing moves.',
    meta: 'Dual gate · no cloud',
  },
  {
    n: '04',
    title: 'Assist',
    body:
      'The motor (109) winds the spool (111) and the cable pulls anterior to the knee axis. Torque arrives ' +
      'inside the electromechanical latency window — before the joint has measurably moved.',
    meta: 'Pre-motion delivery',
  },
];

/**
 * [PAT] The latency argument, as a timing strip.
 * Values are milliseconds from myoelectric onset (t = 0).
 */
export const TIMING = {
  window: 200,
  emgToForce: 50,
  motionOnset: [40, 96],
  footContactLag: [80, 200],
  rows: [
    {
      key: 'exog8',
      label: 'EXOG8 — sEMG gated',
      start: 0,
      end: 50,
      note: 'Torque commanded inside the latency window',
      active: true,
    },
    {
      key: 'motion',
      label: 'Measurable knee motion',
      start: 40,
      end: 96,
      note: 'Where a motion-triggered system could first act',
    },
    {
      key: 'foot',
      label: 'Foot-contact triggered devices',
      start: 80,
      end: 200,
      note: 'Assistance follows a ground event that has already happened',
    },
  ],
};

/** [PAT] §8 safety architecture — seven mutually independent layers. */
export const SAFETY = [
  ['a', 'Supervisory electronics', 'Anomaly, fall signature or overcurrent inhibits the drive in hardware.'],
  ['b', 'Angular exclusion', 'No myoelectric input can produce torque outside the admissible angle window.'],
  ['c', 'Mechanical release', 'Calibrated frangible link at 700 N. Contingent on nothing electronic.'],
  ['d', 'Watchdog', 'A stalled control loop resets the controller; the drive defaults to inhibited.'],
  ['e', 'Energy protection', 'Cell-level over-charge, over-discharge, imbalance and thermal cut-outs.'],
  ['f', 'Stroke limit', 'Spool travel is bounded, so the transmission cannot pull past intended range.'],
  ['g', 'Torque & rate limit', 'Capped in software and, separately, by current limiting in the drive stage.'],
];

/** [DECK] slides 3 & 9, [PAT] background. */
export const CLAIMS = [
  {
    figure: '2.6–3.5×',
    unit: 'body weight',
    body:
      'Peak tibiofemoral contact force measured in vivo during level walking, stair ascent and stair ' +
      'descent. Much of it is muscular, not gravitational.',
  },
  {
    figure: '≈ 50',
    unit: 'milliseconds',
    body:
      'Reported delay between quadriceps sEMG onset and force onset. ExoG8 spends this interval taking ' +
      'up transmission slack instead of waiting.',
  },
  {
    figure: '0',
    unit: 'ground-contact sensors',
    body:
      'Nothing in a shoe, nothing on the shank. The device is independent of footwear and of the surface ' +
      'being walked on.',
  },
];

/** [DECK] slide 10 — roadmap, plus the filing the specification itself evidences. */
export const MILESTONES = [
  {
    tag: 'Q2',
    title: 'Ideation',
    state: 'done',
    body: 'Product architecture and core design defined: proximal actuation, Bowden transmission, dual-gate control.',
    facets: ['Architecture', 'Concept of operation'],
  },
  {
    tag: 'IP',
    title: 'Complete specification filed',
    state: 'done',
    body:
      'Form 2 filed under the Patents Act 1970 with VNR VJIET as applicant, covering pre-motion sEMG gating ' +
      'and Bowden-cable knee offloading.',
    facets: ['Form 2', 'Claims 1–113 refs'],
  },
  {
    tag: 'Q3',
    title: 'Prototype',
    state: 'active',
    body: 'Building and integrating the functional bilateral prototype — housing, drive train, sensing chain, harness.',
    facets: ['Bilateral build', 'Bench characterisation'],
  },
  {
    tag: 'Q4',
    title: 'Validation',
    state: 'next',
    body: 'Test, evaluate and refine on wearers: gating accuracy, assist timing, comfort and endurance over a working shift.',
    facets: ['Wearer trials', 'Refinement'],
  },
];

/** [DECK] slide 7. */
export const AUDIENCE = [
  'People who stand for long hours',
  'People with physically demanding work routines',
  'Anyone reducing muscle fatigue and knee joint loading',
];

/** [DECK] slide 9 — competitive landscape, condensed to the axes that differ. */
export const LANDSCAPE = {
  columns: ['EXOG8', 'Foot-triggered exos', 'Passive orthoses', 'Rigid clinical exos'],
  rows: [
    ['Trigger', 'Pre-motion sEMG', 'Foot lag 80–200 ms', 'None — passive', 'Preset, non-adaptive'],
    ['Motor placement', 'Hip / proximal thigh', 'Leg or waist mounted', 'No actuator', 'Heavy clinical frame'],
    ['Control', 'Dual gate, on-device', 'Closed box', 'No active control', 'Non-adaptive'],
    ['Safety layers', '7 independent', 'Single layer', 'No active safety', 'Single layer'],
  ],
};
