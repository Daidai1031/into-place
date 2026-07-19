"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { GlobeMethods } from "react-globe.gl";
import type { PlaceSummary } from "@/lib/types";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

// Natural Earth 110m admin-0 countries (public domain), vendored from
// three-globe's own example data — see public/world/README (none needed,
// noted in CLAUDE.md known-limitations).
const COUNTRIES_URL = "/world/ne-110m-countries.geojson";

const OCEAN_COLOR = "#b8c8cf"; // faded blue-gray old paper — matches --color-sky
const LAND_TONES = ["#efe6d0", "#e7dcc4", "#e3d4b0", "#ddcfa8"];
const INK_STROKE = "rgba(91, 83, 72, 0.55)";
const INK_SIDE = "rgba(91, 83, 72, 0.1)";

type CountryFeature = {
  type: "Feature";
  properties?: { NAME?: string; ADM0_A3?: string };
  geometry: { type: string; coordinates: unknown };
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function landColor(feature: CountryFeature): string {
  const key = feature.properties?.ADM0_A3 ?? feature.properties?.NAME ?? "";
  return LAND_TONES[hashString(key) % LAND_TONES.length];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ width: Math.round(box.width), height: Math.round(box.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function buildMarkerEl(place: PlaceSummary, focusPlace: (p: PlaceSummary, el: HTMLElement) => void) {
  const wrap = document.createElement("div");
  wrap.className = "globe-marker";

  const pin = document.createElement("div");
  if (place.status === "seeded") {
    pin.className = "globe-marker-pin globe-marker-pin--lit";
    pin.innerHTML = '<span class="globe-marker-ping"></span><span class="globe-marker-dot"></span>';
  } else {
    pin.className = "globe-marker-pin globe-marker-pin--empty";
    pin.textContent = "?";
  }
  wrap.appendChild(pin);

  const tag = document.createElement("div");
  tag.className = "globe-marker-tag";
  tag.innerHTML = `<p class="globe-marker-tag-name">${escapeHtml(place.name.toUpperCase())}</p><p class="globe-marker-tag-region">${escapeHtml(place.region)}</p>`;
  wrap.appendChild(tag);

  if (place.status === "seeded") {
    wrap.classList.add("globe-marker--live");
    const cta = document.createElement("a");
    cta.className = "globe-marker-cta";
    cta.href = `/p/${place.slug}/archive`;
    cta.textContent = "Explore the hidden history →";
    wrap.appendChild(cta);

    wrap.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest(".globe-marker-cta")) return; // let the link navigate
      e.preventDefault();
      focusPlace(place, wrap);
    });
  }

  return wrap;
}

export function PaperGlobe({
  places,
  onPlaceFocus,
}: {
  places: PlaceSummary[];
  onPlaceFocus?: (slug: string) => void;
}) {
  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const onPlaceFocusRef = useRef(onPlaceFocus);
  onPlaceFocusRef.current = onPlaceFocus;
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRIES_URL)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCountries(data.features ?? []);
      })
      .catch(() => {
        /* paper globe still renders as a plain ocean sphere without land */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const oceanMaterial = useMemo(
    () => new THREE.MeshLambertMaterial({ color: OCEAN_COLOR }),
    [],
  );

  const focusPlace = useCallback((place: PlaceSummary, el: HTMLElement) => {
    const controls = globeRef.current?.controls();
    if (controls) controls.autoRotate = false;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    globeRef.current?.pointOfView(
      { lat: place.coordinates.lat, lng: place.coordinates.lng, altitude: 0.55 },
      1800,
    );
    document
      .querySelectorAll(".globe-marker.is-focused")
      .forEach((n) => n.classList.remove("is-focused", "is-revealed"));
    el.classList.add("is-focused");
    onPlaceFocusRef.current?.(place.slug);
    window.setTimeout(() => el.classList.add("is-revealed"), 1500);
  }, []);

  const htmlElement = useCallback(
    (d: object) => buildMarkerEl(d as PlaceSummary, focusPlace),
    [focusPlace],
  );

  const handleGlobeReady = useCallback(() => {
    const controls = globeRef.current?.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enableZoom = false;
      controls.addEventListener("start", () => {
        controls.autoRotate = false;
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
      });
      controls.addEventListener("end", () => {
        resumeTimer.current = setTimeout(() => {
          controls.autoRotate = true;
        }, 4000);
      });
    }
    globeRef.current?.pointOfView({ lat: 18, lng: -35, altitude: 1.85 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto aspect-square w-full max-w-[720px]"
    >
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={null}
          globeMaterial={oceanMaterial}
          showAtmosphere={false}
          showGraticules
          polygonsData={countries}
          polygonGeoJsonGeometry={(d) => (d as CountryFeature).geometry as any}
          polygonCapColor={(d) => landColor(d as CountryFeature)}
          polygonSideColor={() => INK_SIDE}
          polygonStrokeColor={() => INK_STROKE}
          polygonAltitude={0.006}
          htmlElementsData={places}
          htmlLat={(d) => (d as PlaceSummary).coordinates.lat}
          htmlLng={(d) => (d as PlaceSummary).coordinates.lng}
          htmlAltitude={0.02}
          htmlElement={htmlElement}
          onGlobeReady={handleGlobeReady}
        />
      )}
    </div>
  );
}
