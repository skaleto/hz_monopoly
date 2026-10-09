import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const FACE_NORMALS = [
  { value: 1, normal: new THREE.Vector3(0, 1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1) },
  { value: 6, normal: new THREE.Vector3(0, -1, 0), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, 1) },
  { value: 2, normal: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(0, 1, 0) },
  { value: 5, normal: new THREE.Vector3(1, 0, 0), u: new THREE.Vector3(0, 0, -1), v: new THREE.Vector3(0, 1, 0) },
  { value: 3, normal: new THREE.Vector3(0, 0, 1), u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) },
  { value: 4, normal: new THREE.Vector3(0, 0, -1), u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3(0, 1, 0) }
];
const PIP_LAYOUTS = {
  1: [[0, 0]], 2: [[-.38, -.38], [.38, .38]], 3: [[-.4, -.4], [0, 0], [.4, .4]],
  4: [[-.38, -.38], [.38, -.38], [-.38, .38], [.38, .38]],
  5: [[-.4, -.4], [.4, -.4], [0, 0], [-.4, .4], [.4, .4]],
  6: [[-.38, -.43], [-.38, 0], [-.38, .43], [.38, -.43], [.38, 0], [.38, .43]]
};
const UP = new THREE.Vector3(0, 1, 0);
const CAMERA_DIRECTION = new THREE.Vector3(5.6, 5.1, 8.4).normalize();
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

function create(canvas) {
  if (!canvas) throw new Error("DICE_CANVAS_REQUIRED");
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, 1, 30);
  camera.position.set(5.6, 5.1, 8.4);
  camera.lookAt(0, 0, 0);

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(environment, .03).texture;
  environment.dispose();
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xfff6df, 0x315f72, .88));
  const key = new THREE.DirectionalLight(0xfff2d0, 2.8);
  key.position.set(-5, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.near = .1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -.0008;
  key.shadow.radius = 4;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x83c9e5, .34);
  fill.position.set(6, 2, -4);
  scene.add(fill);
  const rim = new THREE.PointLight(0xff8f7b, 2.4, 18, 2);
  rim.position.set(-5, 1, -5);
  scene.add(rim);

  const die = new THREE.Group();
  die.position.y = -.02;
  scene.add(die);
  const model = new THREE.Group();
  model.scale.setScalar(.43);
  const bodyGeometry = new RoundedBoxGeometry(2, 2, 2, 8, .28);
  const outline = new THREE.Mesh(bodyGeometry, new THREE.MeshBasicMaterial({ color: 0x12385e, side: THREE.BackSide }));
  outline.scale.setScalar(1.045);
  outline.renderOrder = -1;
  model.add(outline);
  const body = new THREE.Mesh(bodyGeometry, new THREE.MeshPhysicalMaterial({ color: 0xfff2d6, roughness: .62, metalness: 0, clearcoat: .22, clearcoatRoughness: .42 }));
  body.castShadow = true;
  model.add(body);
  const seam = 1 - .28 + .28 / Math.sqrt(2), flat = 1 - .28, seamPoints = [];
  for (const first of [-1, 1]) for (const second of [-1, 1]) {
    seamPoints.push(-flat, first * seam, second * seam, flat, first * seam, second * seam);
    seamPoints.push(first * seam, -flat, second * seam, first * seam, flat, second * seam);
    seamPoints.push(first * seam, second * seam, -flat, first * seam, second * seam, flat);
  }
  const corner = 1 - .28 + .28 / Math.sqrt(3);
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    seamPoints.push(x * flat, y * seam, z * seam, x * corner, y * corner, z * corner);
    seamPoints.push(x * seam, y * flat, z * seam, x * corner, y * corner, z * corner);
    seamPoints.push(x * seam, y * seam, z * flat, x * corner, y * corner, z * corner);
  }
  const seamGeometry = new THREE.BufferGeometry();
  seamGeometry.setAttribute("position", new THREE.Float32BufferAttribute(seamPoints, 3));
  const seams = new THREE.LineSegments(seamGeometry, new THREE.LineBasicMaterial({ color: 0x12385e, transparent: true, opacity: .48 }));
  seams.scale.setScalar(1.004);
  seams.renderOrder = 1;
  model.add(seams);
  const navyPip = new THREE.MeshStandardMaterial({ color: 0x12365a, roughness: .58, metalness: 0 });
  const coralPip = new THREE.MeshStandardMaterial({ color: 0xff735f, roughness: .5, metalness: 0 });
  const pipGeometry = new THREE.CircleGeometry(.15, 32);
  const ringGeometry = new THREE.RingGeometry(.154, .205, 32);
  for (const face of FACE_NORMALS) {
    for (const [x, y] of PIP_LAYOUTS[face.value]) {
      const isAccent = face.value === 1;
      const pip = new THREE.Mesh(pipGeometry, isAccent ? coralPip : navyPip);
      pip.position.copy(face.normal).multiplyScalar(1.012).addScaledVector(face.u, x).addScaledVector(face.v, y);
      pip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);
      pip.renderOrder = 2;
      model.add(pip);
      if (isAccent) {
        const ring = new THREE.Mesh(ringGeometry, navyPip);
        ring.position.copy(face.normal).multiplyScalar(1.009).addScaledVector(face.u, x).addScaledVector(face.v, y);
        ring.quaternion.copy(pip.quaternion);
        ring.renderOrder = 1;
        model.add(ring);
      }
    }
  }
  die.add(model);
  const shadowMaterial = new THREE.ShadowMaterial({ color: 0x15334a, opacity: .24, transparent: true });
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), shadowMaterial);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -1.08;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  let width = 1, height = 1, dpr = 1, busy = false, warmed = false, prewarmPromise = null;
  let currentQ = targetFor(1);

  die.quaternion.copy(currentQ);

  function resize() {
    const box = canvas.getBoundingClientRect();
    const board = canvas.closest?.(".game-board")?.getBoundingClientRect();
    const nextWidth = Math.max(1, box.width || board?.width || 1);
    const nextHeight = Math.max(1, box.height || board?.height || 1);
    const nextDpr = Math.min(1.5, globalThis.devicePixelRatio || 1);
    const changed = width !== nextWidth || height !== nextHeight || dpr !== nextDpr;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width <= 520 ? 28 : 31;
    camera.updateProjectionMatrix();
    if (changed) warmed = false;
    renderFrame(currentQ);
  }

  function targetFor(result) {
    const face = FACE_NORMALS.find(item => item.value === result) || FACE_NORMALS[0];
    const align = new THREE.Quaternion().setFromUnitVectors(face.normal, UP);
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, -.2);
    return yaw.multiply(align).normalize();
  }

  function spinAt(value, start) {
    const eased = value * (2 - value);
    const z = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * 3.4 * eased);
    const x = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI * 5.3 * eased);
    const y = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI * 4.2 * eased);
    return z.multiply(x).multiply(y).multiply(start).normalize();
  }

  function visibleValues(q) {
    return FACE_NORMALS.filter(face => face.normal.clone().applyQuaternion(q).dot(CAMERA_DIRECTION) > .02).map(face => face.value);
  }

  function topValue(q) {
    return FACE_NORMALS.map(face => ({ value: face.value, y: face.normal.clone().applyQuaternion(q).dot(UP) })).sort((a, b) => b.y - a.y)[0].value;
  }

  function renderFrame(q, heightPx = 0, impact = 0, squash = 0) {
    const heightWorld = heightPx / 68;
    die.quaternion.copy(q);
    die.position.y = -.02 + heightWorld;
    die.scale.set(1 + squash * .065, 1 - squash * .095, 1 + squash * .065);
    const altitude = clamp(heightPx / 145);
    shadowMaterial.opacity = .25 * (1 - altitude * .68) + impact * .07;
    shadowPlane.scale.setScalar(.9 + altitude * .28 + impact * .08);
    renderer.render(scene, camera);
    return visibleValues(q);
  }

  async function prewarm() {
    resize();
    if (warmed) return 0;
    if (prewarmPromise) return prewarmPromise;
    prewarmPromise = (async () => {
      resize();
      await renderer.compileAsync(scene, camera);
      const startedAt = performance.now();
      const poses = [currentQ, spinAt(.28, currentQ), spinAt(.61, currentQ), targetFor(6), currentQ];
      poses.forEach((pose, index) => renderFrame(pose, index === 1 ? 24 : 0, index === 3 ? .35 : 0));
      renderer.getContext().finish();
      currentQ = poses.at(-1);
      warmed = true;
      return performance.now() - startedAt;
    })();
    try { return await prewarmPromise; } finally { prewarmPromise = null; }
  }

  async function roll(rawResult, options = {}) {
    if (busy) return null;
    busy = true;
    try {
      const prewarmDuration = await prewarm();
      const result = Math.max(1, Math.min(6, Number(rawResult) || 1));
      const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const duration = reduced ? 520 : 1380;
      const arc = Math.min(142, height * .24);
      const startedAt = performance.now();
      const startQ = currentQ.clone();
      const target = targetFor(result);
      const trace = { result, startedAt, visualStyle: "reference-rounded-mesh-v1", modelAsset: "rounded-box-mesh", prewarmed: true, prewarmDuration, samples: [], visibleChanges: 0, topAtEnd: null, frameDeltas: [], renderCosts: [] };
      let previousVisible = "", lastSample = 0, previousFrameAt = null, impacted = false;
      await new Promise(resolve => {
        function frame(now) {
          if (previousFrameAt !== null) trace.frameDeltas.push(now - previousFrameAt);
          previousFrameAt = now;
          const progress = clamp((now - startedAt) / duration);
          const air = clamp((progress - .07) / .62);
          const airborne = progress >= .07 && progress <= .69;
          let heightPx = 0, impact = 0, squash = 0, q;
          const spun = spinAt(clamp(air), startQ);
          const settle = smooth((progress - .52) / .18);
          q = spun.slerp(target, settle);
          if (progress < .07) squash = Math.sin(progress / .07 * Math.PI) * .38;
          else if (airborne) heightPx = Math.sin(air * Math.PI) * arc;
          else {
            const bounce = clamp((progress - .69) / .25);
            heightPx = Math.max(0, Math.sin(bounce * Math.PI) * Math.min(24, height * .04) * (1 - bounce));
            impact = clamp((progress - .69) / .11);
            impact = impact < 1 ? impact : Math.max(0, 1 - (progress - .80) / .12);
            squash = Math.max(0, 1 - Math.abs((progress - .70) / .055));
            const wobble = (1 - clamp((progress - .69) / .27)) * Math.sin((progress - .69) * Math.PI * 13) * .12;
            q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, .5).normalize(), wobble).multiply(target);
            if (!impacted && progress >= .69) { impacted = true; options.onImpact?.(); }
          }
          const renderStarted = performance.now();
          const visible = renderFrame(q, heightPx, impact, squash);
          trace.renderCosts.push(performance.now() - renderStarted);
          const key = `${visible.slice().sort().join("-")}:${topValue(q)}`;
          if (key !== previousVisible) { if (previousVisible) trace.visibleChanges += 1; previousVisible = key; }
          if (now - lastSample > 85) { trace.samples.push({ at: now, visible: visible.slice(), top: topValue(q), heightPx }); lastSample = now; }
          currentQ = q.clone();
          if (progress < 1) return requestAnimationFrame(frame);
          currentQ = target.clone();
          renderFrame(target);
          trace.finishedAt = performance.now();
          trace.topAtEnd = topValue(target);
          trace.duration = trace.finishedAt - startedAt;
          const ordered = trace.frameDeltas.slice().sort((a, b) => a - b);
          const rendered = trace.renderCosts.slice().sort((a, b) => a - b);
          trace.frameCount = trace.frameDeltas.length + 1;
          trace.frameP50 = ordered[Math.floor((ordered.length - 1) * .5)] || 0;
          trace.frameP95 = ordered[Math.floor((ordered.length - 1) * .95)] || 0;
          trace.frameMax = ordered.at(-1) || 0;
          trace.longFrames = ordered.filter(value => value > 34).length;
          trace.renderCostP50 = rendered[Math.floor((rendered.length - 1) * .5)] || 0;
          trace.renderCostP95 = rendered[Math.floor((rendered.length - 1) * .95)] || 0;
          trace.renderCostMax = rendered.at(-1) || 0;
          trace.canvas = { cssWidth: width, cssHeight: height, dpr, backingWidth: canvas.width, backingHeight: canvas.height };
          delete trace.frameDeltas;
          delete trace.renderCosts;
          resolve();
        }
        requestAnimationFrame(frame);
      });
      return trace;
    } finally {
      busy = false;
    }
  }

  resize();
  return { roll, resize, prewarm, draw: async () => { resize(); return renderFrame(currentQ); }, isBusy: () => busy };
}

globalThis.HangzhouDiceRenderer = { create };
