"use client";

import { Component, Suspense, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { Canvas, useLoader } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Activity } from "lucide-react";
import CaptionBlock from "./CaptionBlock";
import OrganRedFlags from "./OrganRedFlags";
import {
  ORGAN_DISPLAY_NAMES,
  VISUALIZATION_COPY,
  type OrganModelEntry,
  type VisualizationSuggestion,
} from "@/lib/anatomy/types";
import { resolveHotspot, shouldRenderMesh } from "@/lib/anatomy/viewer";

export type OrganCompareProps = {
  entry: OrganModelEntry;
  suggestion: Pick<VisualizationSuggestion, "subRegion" | "relatedTo" | "confidence" | "evidence">;
  /** Plain-language caption, e.g. derived from the report summary. */
  caption: string;
  /**
   * User hand-picked this organ (not system-suggested): the badge reads
   * "Manual choice" instead of a relevance percentage, which would be
   * meaningless and easy to misread as a probability.
   */
  manual?: boolean;
  /** Show the English/Hindi caption toggle (dialog only; off on public shares). */
  allowTranslate?: boolean;
};

function hasWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function NormalizedModel({ url }: { url: string }) {
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
  // Clone per canvas: useLoader caches one scene per URL, but a three.js
  // Object3D can have only one parent — sharing it would let the second
  // canvas steal the mesh from the first and render an empty panel.
  // clone(true) shares geometry/material (cheap) with a distinct hierarchy.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);
  const transform = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    return { offset: center.multiplyScalar(-1), scale: 2.2 / maxDim };
  }, [scene]);
  return (
    <group position={transform.offset} scale={transform.scale}>
      <primitive object={scene} />
    </group>
  );
}

function LesionMarker({
  position,
  label,
  opacity,
}: {
  position: [number, number, number];
  label: string;
  opacity: number;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.24, 24, 24]} />
        <meshStandardMaterial
          color="#e11d48"
          emissive="#e11d48"
          emissiveIntensity={0.85}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
      <Html center distanceFactor={7} zIndexRange={[20, 0]}>
        <span className="whitespace-nowrap rounded-full border border-rose-200 bg-white/95 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-700 shadow-sm">
          {label}
        </span>
      </Html>
    </group>
  );
}

function CanvasLoader() {
  return (
    <Html center>
      <span className="animate-pulse rounded-full bg-white/90 px-3 py-1 font-mono text-[11px] text-slate-500 shadow-sm">
        Loading 3D…
      </span>
    </Html>
  );
}

function OrganCanvas({
  url,
  camera,
  autoRotate,
  affected,
  hotspot,
  lesionOpacity,
}: {
  url: string;
  camera: OrganModelEntry["camera"];
  autoRotate: boolean;
  affected: boolean;
  hotspot: { label: string; position: [number, number, number] };
  lesionOpacity: number;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: camera.position, fov: camera.fov }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.4} />
      <directionalLight position={[-3, -1, -2]} intensity={0.35} />
      <Suspense fallback={<CanvasLoader />}>
        <NormalizedModel url={url} />
        {affected ? (
          <LesionMarker position={hotspot.position} label={hotspot.label} opacity={lesionOpacity} />
        ) : null}
      </Suspense>
      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={1.1}
        enablePan={false}
        minDistance={1.6}
        maxDistance={9}
      />
    </Canvas>
  );
}

/**
 * Error boundary around one canvas: a failed GLB load remounts the canvas
 * on the next source (CDN -> local fallback -> error card) instead of
 * crashing the dialog.
 */
class CanvasErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function PlaceholderCard({ entry, suggestion, caption, allowTranslate = false }: OrganCompareProps) {
  const hotspots = Object.values(entry.hotspots);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-teal-50">
          <Activity className="h-5 w-5 text-teal-700" aria-hidden="true" />
        </span>
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">
            Educational illustration
          </p>
          <h3 className="text-lg font-semibold">{ORGAN_DISPLAY_NAMES[entry.organId]}</h3>
        </div>
      </div>
      <CaptionBlock text={caption} allowTranslate={allowTranslate} />
      {suggestion.relatedTo ? (
        <p className="mt-3 text-sm">
          <span className="font-semibold">{VISUALIZATION_COPY.relatedPrefix}:</span>{" "}
          {suggestion.relatedTo}
        </p>
      ) : null}
      {hotspots.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {hotspots.map((hotspot) => (
            <li key={hotspot.label} className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
              {hotspot.label}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 font-mono text-[11px] text-slate-500">
        3D model for this organ is being added — same explanation, no 3D yet.
      </p>
      <div className="mt-4">
        <OrganRedFlags organId={entry.organId} />
      </div>
      <DisclaimerFooter entry={entry} />
    </div>
  );
}

function DisclaimerFooter({ entry }: { entry: OrganModelEntry }) {
  return (
    <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">
      <p className="text-xs font-semibold text-slate-700">{VISUALIZATION_COPY.disclaimer}</p>
      <p className="text-[11px] text-slate-500">
        Illustrative reference geometry, not your scan. Source: {entry.attribution} ({entry.license}).
      </p>
    </div>
  );
}

function LoadErrorCard({ entry, suggestion, caption, allowTranslate = false, onRetry }: OrganCompareProps & { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
      <h3 className="font-semibold text-amber-950">3D model could not be loaded</h3>
      <p className="mt-2 text-sm text-amber-900">
        Showing the explanation without 3D — check your connection and retry.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
      >
        Retry 3D
      </button>
      <div className="mt-4 rounded-xl bg-white p-4">
        <PlaceholderCard entry={entry} suggestion={suggestion} caption={caption} allowTranslate={allowTranslate} />
      </div>
    </div>
  );
}

export default function OrganCompare(props: OrganCompareProps) {
  const { entry, suggestion, caption, manual = false, allowTranslate = false } = props;
  const [autoRotate, setAutoRotate] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [lesionOpacity, setLesionOpacity] = useState(0.85);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [webgl] = useState(hasWebGL);

  const hotspot = useMemo(
    () => resolveHotspot(entry, suggestion.subRegion ?? null),
    [entry, suggestion.subRegion],
  );
  const confidence = Math.round(suggestion.confidence * 100);

  if (!shouldRenderMesh(entry) || !webgl) {
    return <PlaceholderCard {...props} allowTranslate={allowTranslate} />;
  }
  if (failed) {
    return (
      <LoadErrorCard
        {...props}
        allowTranslate={allowTranslate}
        onRetry={() => {
          setSourceIndex(0);
          setFailed(false);
        }}
      />
    );
  }

  const sources = [entry.glb, entry.fallbackGlb];
  const url = sources[Math.min(sourceIndex, sources.length - 1)];
  const advanceSource = () => {
    if (sourceIndex < sources.length - 1) setSourceIndex(sourceIndex + 1);
    else setFailed(true);
  };

  const canvases = (affected: boolean, title: string, titleClass: string, borderClass: string) => (
    <figure className={`overflow-hidden rounded-2xl border bg-slate-50 ${borderClass}`}>
      <figcaption className={`border-b bg-white px-4 py-2 font-mono text-[11px] uppercase tracking-widest ${titleClass}`}>
        {title}
      </figcaption>
      <div className="h-72">
        <CanvasErrorBoundary key={`${url}-${affected ? "affected" : "healthy"}`} onError={advanceSource}>
          <OrganCanvas
            url={url}
            camera={entry.camera}
            autoRotate={autoRotate}
            affected={affected}
            hotspot={hotspot}
            lesionOpacity={lesionOpacity}
          />
        </CanvasErrorBoundary>
      </div>
    </figure>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">{ORGAN_DISPLAY_NAMES[entry.organId]}</h3>
        <span
          className="rounded-full bg-teal-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-teal-700"
          title={
            manual
              ? "You chose this organ yourself to explore — not a system suggestion"
              : "How closely the report text matched this illustration topic — not a diagnosis probability"
          }
        >
          {manual ? "Manual choice" : `Illustration relevance ${confidence}%`}
        </span>
        {suggestion.relatedTo ? (
          <span className="text-sm text-slate-600">
            {VISUALIZATION_COPY.relatedPrefix}: {suggestion.relatedTo}
          </span>
        ) : null}
      </div>

      <p className="sr-only">
        3D illustration of {ORGAN_DISPLAY_NAMES[entry.organId]} for education: {hotspot.label} highlighted.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {canvases(false, "Healthy reference", "text-slate-500 border-slate-200", "border-slate-200")}
        {canvases(true, "Illustrative affected area", "text-rose-700 border-rose-200", "border-rose-200")}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(event) => setAutoRotate(event.target.checked)}
            className="size-4 accent-teal-700"
          />
          Auto-rotate
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Highlight
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={lesionOpacity}
            onChange={(event) => setLesionOpacity(Number(event.target.value))}
            aria-label="Highlight intensity"
          />
        </label>
      </div>

      <CaptionBlock text={caption} allowTranslate={allowTranslate} />
      {suggestion.evidence.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {suggestion.evidence.map((line) => (
            <li
              key={line}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      <OrganRedFlags organId={entry.organId} />
      <DisclaimerFooter entry={entry} />
    </div>
  );
}
