// Headless anatomy audit: parses each vendored GLB with the production
// three.js loader stack (incl. meshopt) and reports world bounds, center,
// and per-child outliers — used to tune viewer framing and hotspot scale.
import { readFileSync, readdirSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const dir = new URL("../public/models/", import.meta.url);

function loadGlb(path) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const bytes = readFileSync(path);
    loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "", resolve, reject);
  });
}

const files = readdirSync(dir).filter((f) => f.endsWith(".glb")).sort();
for (const file of files) {
  try {
    const gltf = await loadGlb(new URL(file, dir));
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const whole = new THREE.Box3().setFromObject(scene);
    const size = whole.getSize(new THREE.Vector3());
    const center = whole.getCenter(new THREE.Vector3());
    let meshes = 0;
    let verts = 0;
    const strays = [];
    for (const child of scene.children) {
      const box = new THREE.Box3().setFromObject(child);
      if (box.isEmpty()) continue;
      const cSize = box.getSize(new THREE.Vector3());
      const cCenter = box.getCenter(new THREE.Vector3());
      let cMeshes = 0;
      child.traverse((o) => {
        if (o.isMesh) {
          cMeshes += 1;
          const p = o.geometry.getAttribute("position");
          if (p) verts += p.count;
        }
      });
      meshes += cMeshes;
      const volRatio = (cSize.x * cSize.y * cSize.z) / Math.max(size.x * size.y * size.z, 1e-9);
      const offCenter = cCenter.distanceTo(center);
      if (volRatio < 0.02 || offCenter > Math.max(size.x, size.y, size.z)) {
        strays.push(`${child.name || child.type} size=${cSize.toArray().map((n) => n.toFixed(2))} center=${cCenter.toArray().map((n) => n.toFixed(2))} meshes=${cMeshes}`);
      }
    }
    console.log(
      `${file} size=${size.toArray().map((n) => n.toFixed(2))} center=${center.toArray().map((n) => n.toFixed(2))} meshes=${meshes} verts=${verts}`,
    );
    for (const s of strays) console.log(`   STRAY ${s}`);
  } catch (error) {
    console.log(`${file} FAILED: ${error instanceof Error ? error.message : error}`);
  }
}
