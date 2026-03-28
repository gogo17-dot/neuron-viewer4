/**
 * Neuron Anatomy — WebGL viewer (Three.js)
 *
 * Assets (place in /public next to this site):
 *   neuron.glb    — required main model
 *
 * Features: dark backdrop #020810, starfield, distant organic neural background, local cyan point halo around neuron,
 * OrbitControls (pan/zoom/rotate), PMREM lighting, pale-gold physical material,
 * part names on hover (mesh / material names from GLB). Serve over http (not file://).
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#scene");
const statusEl = document.querySelector("#status");
const partCaptionEl = document.querySelector("#part-caption");
const partNameEl = document.querySelector("#part-name");
const partDescEl = document.querySelector("#part-desc");

const pickableParts = [];
let hoveredMesh = null;
const _hoverColor = new THREE.Color();

let starField = null;
/** @type {{ group: THREE.Group; update: (tSec: number) => void } | null} */
let neuralNetBg = null;
/** @type {{ update: (tSec: number) => void } | null} */
let neuronAuraNet = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020810);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.08, 500);
camera.position.set(0, 1.2, 14);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
pmremGenerator.dispose();
scene.environmentIntensity = 0.22;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.35;
controls.maxDistance = 120;
controls.enablePan = true;

scene.add(new THREE.AmbientLight(0xb8c8e8, 0.28));

const keyLight = new THREE.DirectionalLight(0xffeedd, 2.2);
keyLight.position.set(8, 14, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 80;
keyLight.shadow.camera.left = -20;
keyLight.shadow.camera.right = 20;
keyLight.shadow.camera.top = 20;
keyLight.shadow.camera.bottom = -24;
keyLight.shadow.bias = -0.0002;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x88aaff, 1.1);
rimLight.position.set(-12, 6, -8);
rimLight.castShadow = false;
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xe8f0ff, 0.65);
fillLight.position.set(2, 2, 14);
fillLight.castShadow = false;
scene.add(fillLight);

function createStarField(count = 2200) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.acos(2 * Math.random() - 1);
    const r = 85 + Math.random() * 115;
    positions[i * 3] = r * Math.sin(v) * Math.cos(u);
    positions[i * 3 + 1] = r * Math.cos(v) * 0.75;
    positions[i * 3 + 2] = r * Math.sin(v) * Math.sin(u);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xc8dcff,
    size: 0.055,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = "star_field";
  pts.frustumCulled = false;
  return pts;
}

starField = createStarField();
scene.add(starField);

function createNeuralNetworkBackground3D() {
  const NODE_COUNT = 165;
  const SPHERE_R = 24;
  const CONNECT_DIST = 3.5;
  const DRIFT_AMP = 0.38;
  const DRIFT_SPEED = 0.28;

  const group = new THREE.Group();
  group.name = "neural_network_bg_3d";

  const bases = [];
  const phases = [];
  const meshes = [];

  const sphereGeo = new THREE.SphereGeometry(0.05, 10, 8);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });

  for (let i = 0; i < NODE_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = SPHERE_R * Math.cbrt(Math.random());
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    bases.push(new THREE.Vector3(x, y, z));
    phases.push([
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2,
      0.75 + Math.random() * 0.5,
      0.82 + Math.random() * 0.36,
      0.78 + Math.random() * 0.44,
    ]);
    const mesh = new THREE.Mesh(sphereGeo, sphereMat);
    mesh.position.copy(bases[i]);
    group.add(mesh);
    meshes.push(mesh);
  }

  const nodes = meshes;
  const positions = [];
  const edgePairs = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      const dist = nodes[i].position.distanceTo(nodes[j].position);
      if (dist < CONNECT_DIST) {
        edgePairs.push(i, j);
        positions.push(
          nodes[i].position.x,
          nodes[i].position.y,
          nodes[i].position.z,
          nodes[j].position.x,
          nodes[j].position.y,
          nodes[j].position.z
        );
      }
    }
  }

  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(positions);
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.03,
    depthWrite: false,
  });
  const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
  lineSegments.frustumCulled = false;
  group.add(lineSegments);

  function update(tSec) {
    for (let i = 0; i < NODE_COUNT; i++) {
      const m = meshes[i];
      const ph = phases[i];
      const sp = ph[3] * DRIFT_SPEED;
      m.position.x = bases[i].x + DRIFT_AMP * Math.sin(tSec * sp + ph[0]);
      m.position.y = bases[i].y + DRIFT_AMP * Math.sin(tSec * sp * ph[4] + ph[1]);
      m.position.z = bases[i].z + DRIFT_AMP * Math.sin(tSec * sp * ph[5] + ph[2]);
    }
    let p = 0;
    for (let e = 0; e < edgePairs.length; e += 2) {
      const ia = edgePairs[e];
      const jb = edgePairs[e + 1];
      const a = nodes[ia].position;
      const b = nodes[jb].position;
      linePos[p++] = a.x;
      linePos[p++] = a.y;
      linePos[p++] = a.z;
      linePos[p++] = b.x;
      linePos[p++] = b.y;
      linePos[p++] = b.z;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  return { group, update };
}

/**
 * Many cyan points in a noisy shell around the neuron (child of root, follows rotation). No links.
 */
function createOrganicNeuronAura(root) {
  const group = new THREE.Group();
  group.name = "organic_neuron_aura";
  group.renderOrder = -1;

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const halfMax = Math.max(size.x, size.y, size.z) * 0.5;
  const rInner = halfMax * 0.86;
  const rOuter = halfMax * 1.38;

  const NODE_COUNT = 260;
  const rnd = () => Math.random() * 2 - 1;

  const nodeGeo = new THREE.SphereGeometry(0.04, 7, 5);
  const nodeMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });

  for (let i = 0; i < NODE_COUNT; i++) {
    const dir = new THREE.Vector3(rnd(), rnd(), rnd()).normalize();
    const jitter = 0.82 + Math.random() * 0.45;
    const r = (rInner + Math.random() * (rOuter - rInner)) * jitter;
    const mesh = new THREE.Mesh(nodeGeo, nodeMat);
    mesh.position.copy(dir.multiplyScalar(r));
    group.add(mesh);
  }

  root.add(group);
  return { update: () => {} };
}

neuralNetBg = createNeuralNetworkBackground3D();
scene.add(neuralNetBg.group);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/** Stable keys for lookups; add matching copy in partDescriptions when you want hover text. */
const partDisplayNames = {
  soma: "Soma",
  dendrites: "Dendrites",
  axon: "Axon",
  axon_hillock: "Axon Hillock",
  myelin_sheath: "Myelin Sheath",
  axon_terminal: "Axon Terminal",
  node_ranvier: "Node of Ranvier",
};

/** Future: non-empty strings show under the part name on hover. */
const partDescriptions = {
  soma: "",
  dendrites: "",
  axon: "",
  axon_hillock: "",
  myelin_sheath: "",
  axon_terminal: "",
  node_ranvier: "",
};

function inferPartKeyFromName(str) {
  const n = (str || "").toLowerCase();
  if (!n) return null;
  if (/dendrit/.test(n)) return "dendrites";
  if (/soma|cell_body|perikaryon/.test(n)) return "soma";
  if (/hillock/.test(n)) return "axon_hillock";
  if (/myelin|sheath/.test(n)) return "myelin_sheath";
  if (/terminal|bouton|synap/.test(n)) return "axon_terminal";
  if (/ranvier|node_of/.test(n)) return "node_ranvier";
  if (/axon/.test(n)) return "axon";
  return null;
}

/** Run before applyNeuronPhysicalMaterials so GLTF material names are still readable. */
function capturePartMetadata(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.userData.partKeyFromMesh = inferPartKeyFromName(o.name);
    if (Array.isArray(o.material)) {
      o.userData.partKeyByMatIndex = o.material.map((m) => inferPartKeyFromName(m.name));
    } else {
      o.userData.partKeyByMatIndex = [inferPartKeyFromName(o.material.name)];
    }
  });
}

function hitForMesh(hits, mesh) {
  return hits.find((x) => x.object === mesh) ?? hits[0];
}

function partKeyForHit(mesh, hit) {
  if (!mesh || !hit) return null;
  const arr = mesh.userData.partKeyByMatIndex;
  const mi = hit.face?.materialIndex ?? 0;
  const matKey = arr && arr[mi];
  if (arr && arr.length > 1) {
    return matKey || mesh.userData.partKeyFromMesh || null;
  }
  return mesh.userData.partKeyFromMesh || matKey || null;
}

function updatePartCaption(mesh, hit) {
  if (!partCaptionEl || !partNameEl || !partDescEl) return;
  const key = mesh && hit ? partKeyForHit(mesh, hit) : null;
  const title = key ? partDisplayNames[key] : "";
  partNameEl.textContent = title;
  const desc = key && partDescriptions[key] ? String(partDescriptions[key]).trim() : "";
  if (desc) {
    partDescEl.textContent = desc;
    partDescEl.hidden = false;
  } else {
    partDescEl.textContent = "";
    partDescEl.hidden = true;
  }
  partCaptionEl.classList.toggle("is-visible", Boolean(title));
}

function setStatus(text) {
  statusEl.textContent = text;
}

function ensureMaterialEmissive(mat) {
  if (!mat.emissive) mat.emissive = new THREE.Color(0x000000);
  if (mat.emissiveIntensity === undefined) mat.emissiveIntensity = 0;
}

function registerPart(mesh) {
  if (!mesh.isMesh || !mesh.material) return;
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((m) => {
      const c = m.clone();
      ensureMaterialEmissive(c);
      return c;
    });
    mesh.userData.multiMat = true;
    mesh.userData.origEmissive = mesh.material.map((m) => m.emissive.getHex());
    mesh.userData.origEmissiveInt = mesh.material.map((m) => m.emissiveIntensity);
    mesh.userData.origOpacity = mesh.material.map((m) => m.opacity ?? 1);
  } else {
    mesh.material = mesh.material.clone();
    ensureMaterialEmissive(mesh.material);
    mesh.userData.multiMat = false;
    mesh.userData.origEmissive = mesh.material.emissive.getHex();
    mesh.userData.origEmissiveInt = mesh.material.emissiveIntensity;
    mesh.userData.origOpacity = mesh.material.opacity ?? 1;
  }
  pickableParts.push(mesh);
}

function clearHoverHighlight(mesh) {
  if (!mesh?.material) return;
  if (mesh.userData.multiMat) {
    mesh.material.forEach((m, i) => {
      m.emissive.setHex(mesh.userData.origEmissive[i]);
      m.emissiveIntensity = mesh.userData.origEmissiveInt[i];
    });
  } else {
    mesh.material.emissive.setHex(mesh.userData.origEmissive);
    mesh.material.emissiveIntensity = mesh.userData.origEmissiveInt;
  }
}

function applyHoverHighlight(mesh) {
  if (!mesh?.material) return;
  if (mesh.userData.multiMat) {
    mesh.material.forEach((m, i) => {
      _hoverColor.setHex(mesh.userData.origEmissive[i]);
      _hoverColor.lerp(new THREE.Color(0xffffff), 0.22);
      m.emissive.copy(_hoverColor);
      m.emissiveIntensity = mesh.userData.origEmissiveInt[i] + 0.28;
    });
  } else {
    _hoverColor.setHex(mesh.userData.origEmissive);
    _hoverColor.lerp(new THREE.Color(0xffffff), 0.22);
    mesh.material.emissive.copy(_hoverColor);
    mesh.material.emissiveIntensity = mesh.userData.origEmissiveInt + 0.28;
  }
}

function pickPreferredMesh(intersects) {
  if (!intersects.length) return null;
  const closestDist = new Map();
  for (const hit of intersects) {
    const d = closestDist.get(hit.object);
    if (d === undefined || hit.distance < d) closestDist.set(hit.object, hit.distance);
  }
  let best = null;
  let bestVol = Infinity;
  let bestDist = Infinity;
  const size = new THREE.Vector3();
  for (const mesh of closestDist.keys()) {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    box.getSize(size);
    const vol = size.x * size.y * size.z;
    const dist = closestDist.get(mesh);
    if (vol < bestVol || (vol === bestVol && dist < bestDist)) {
      bestVol = vol;
      bestDist = dist;
      best = mesh;
    }
  }
  return best;
}

const NEURON_PHYSICAL_MAT_PROPS = {
  color: 0xc9a43e,
  emissive: 0x5a3a10,
  emissiveIntensity: 0.22,
  roughness: 0.36,
  metalness: 0.55,
  clearcoat: 0.18,
  clearcoatRoughness: 0.4,
  side: THREE.DoubleSide,
};

function disposeMaterial(m) {
  if (m && typeof m.dispose === "function") m.dispose();
}

/** Replace GLB materials (handles multi-material meshes) without breaking registerPart. */
function applyNeuronPhysicalMaterials(object) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    const prev = child.material;
    if (Array.isArray(prev)) prev.forEach(disposeMaterial);
    else disposeMaterial(prev);
    child.material = new THREE.MeshPhysicalMaterial(NEURON_PHYSICAL_MAT_PROPS);
  });
}

function fitNeuronToView(object, targetSize = 10) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    console.warn("Neuron bounds empty — mesh may be missing or not yet expanded.");
    object.position.set(0, 0, 0);
    controls.target.set(0, 0, 0);
    camera.position.set(0, 1.2, 14);
    camera.near = 0.02;
    camera.far = 600;
    camera.updateProjectionMatrix();
    controls.update();
    return;
  }
  const size = box.getSize(new THREE.Vector3());
  const maxD = Math.max(size.x, size.y, size.z, 0.001);
  const s = targetSize / maxD;
  object.scale.setScalar(s);
  object.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(object);
  const c2 = box2.getCenter(new THREE.Vector3());
  object.position.sub(c2);
  controls.target.set(0, 0, 0);
  const dist = targetSize / (2 * Math.tan((Math.PI * camera.fov) / 360));
  camera.position.set(0, targetSize * 0.12, dist * 1.15);
  camera.near = 0.02;
  camera.far = 600;
  camera.updateProjectionMatrix();
  controls.update();
}

function registerGltfMeshes(root) {
  pickableParts.length = 0;
  root.traverse((o) => {
    if (!o.isMesh || o.visible === false) return;
    registerPart(o);
  });
}

const GLB_URL = "./public/neuron.glb";

setStatus("Loading neuron model…");

const loader = new GLTFLoader();

function finishNeuronSetup(root, statusExtra) {
  registerGltfMeshes(root);

  scene.add(root);

  root.traverse((o) => {
    if (o.isMesh && !o.userData.skipShadow) o.castShadow = true;
  });

  const bounds = new THREE.Box3().setFromObject(root);
  const sz = bounds.getSize(new THREE.Vector3());
  const floorR = Math.max(sz.x, sz.z) * 0.55 + 0.6;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(floorR, 64), new THREE.ShadowMaterial({ opacity: 0.22 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = bounds.min.y - 0.02;
  floor.receiveShadow = true;
  floor.name = "ground_shadow";
  scene.add(floor);

  setStatus(`Ready — drag to orbit, scroll to zoom. ${statusExtra}`);
}

loader.load(
  GLB_URL,
  (gltf) => {
    const root = gltf.scene;
    root.name = "neuron";

    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        console.log("MESH NAME:", child.name, "INDEX:", child.id);
      }
    });

    capturePartMetadata(root);
    applyNeuronPhysicalMaterials(root);

    fitNeuronToView(root, 10);
    root.scale.setScalar(4.0);
    root.updateMatrixWorld(true);
    {
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      root.position.sub(center);
      root.updateMatrixWorld(true);
    }
    finishNeuronSetup(root, "");
    neuronAuraNet = createOrganicNeuronAura(root);
  },
  undefined,
  (err) => {
    console.error(err);
    setStatus(`Could not load ${GLB_URL}. Add neuron.glb to the public folder and use a local server.`);
  }
);

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickableParts, false);
  const mesh = hits.length ? pickPreferredMesh(hits) : null;
  const hit = mesh && hits.length ? hitForMesh(hits, mesh) : null;

  if (mesh === hoveredMesh) {
    updatePartCaption(mesh, hit);
    canvas.style.cursor = mesh ? "pointer" : "default";
    return;
  }

  if (hoveredMesh) clearHoverHighlight(hoveredMesh);
  hoveredMesh = mesh;

  if (hoveredMesh) {
    applyHoverHighlight(hoveredMesh);
    updatePartCaption(hoveredMesh, hit);
  } else {
    updatePartCaption(null, null);
  }

  canvas.style.cursor = mesh ? "pointer" : "default";
}

function onPointerLeave() {
  if (hoveredMesh) clearHoverHighlight(hoveredMesh);
  hoveredMesh = null;
  updatePartCaption(null, null);
  canvas.style.cursor = "default";
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerleave", onPointerLeave);
window.addEventListener("resize", onResize);

function animate() {
  requestAnimationFrame(animate);
  const nowMs = performance.now();
  const tSec = nowMs * 0.001;

  controls.update();

  if (starField) {
    starField.rotation.y += 0.00012;
  }

  if (neuralNetBg) {
    neuralNetBg.update(tSec);
  }

  if (neuronAuraNet) {
    neuronAuraNet.update(tSec);
  }

  renderer.render(scene, camera);
}
animate();
