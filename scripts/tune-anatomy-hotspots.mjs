// One-off tuner (results baked into registry.ts by hand): for every organ,
// snap each hotspot anchor to the mesh front surface via raycast so pins
// sit ON the organ instead of floating in space. Prints JSON per organ.
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const dir = new URL("../public/models/", import.meta.url);

// organ file -> hotspot key -> [fx, fy] fractions of the organ bounding box
const ANCHORS = {
  "bladder.glb": { wall: [0, 0] },
  "brain.glb": { cortex: [0, 0.3] },
  "heart.glb": { ventricle: [-0.1, -0.3], artery: [0.1, 0.4], circulation: [0, 0.1] },
  "intestine.glb": { "large-intestine": [0.3, 0] },
  "kidney.glb": { cortex: [0, 0.35], nephron: [0, 0], pelvis: [0, -0.35] },
  "liver.glb": { "right-lobe": [0.3, 0] },
  "lung.glb": { "lower-lobe": [-0.25, -0.35], bronchi: [0, 0.25] },
  "pancreas.glb": { body: [0, 0], islets: [-0.3, 0] },
  "spleen.glb": { body: [0, 0] },
};

function loadGlb(path) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const bytes = readFileSync(path);
    loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "", resolve, reject);
  });
}

const raycaster = new THREE.Raycaster();
for (const [file, anchors] of Object.entries(ANCHORS)) {
  const gltf = await loadGlb(new URL(file, dir));
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const out = {};
  for (const [key, [fx, fy]] of Object.entries(anchors)) {
    const ax = center.x + fx * size.x;
    const ay = center.y + fy * size.y;
    const origin = new THREE.Vector3(ax, ay, box.max.z + Math.max(size.z, 0.05));
    raycaster.set(origin, new THREE.Vector3(0, 0, -1));
    raycaster.far = size.z + Math.max(size.z, 0.05) + 0.5;
    const hits = raycaster.intersectObject(scene, true);
    let p;
    if (hits.length > 0) {
      p = hits[0].point.clone();
      p.z += 0.015; // sit just proud of the surface
    } else {
      p = new THREE.Vector3(ax, ay, box.max.z + 0.015); // silhouette fallback
    }
    out[key] = [Number(p.x.toFixed(3)), Number(p.y.toFixed(3)), Number(p.z.toFixed(3))];
  }
  console.log(`${file} size=${size.toArray().map((n) => n.toFixed(3))} center=${center.toArray().map((n) => n.toFixed(3))}`);
  console.log(`  ${JSON.stringify(out)}`);
}
