"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { Bounds, MapPerson } from "./types";

type Props = {
  bounds: Bounds;
  me: { lat: number; lng: number; precise: boolean } | null;
  people: MapPerson[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  // Increment to fly back to your own spot.
  recenter: number;
};

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ROUGH_RADIUS_M = 70;

// Pins are built with DOM methods, never HTML strings, so names can't inject markup.
function pin(person: MapPerson, selected: boolean): L.DivIcon {
  const el = document.createElement("span");
  el.className = `knot-pin${selected ? " knot-pin--on" : ""}${person.connected ? " knot-pin--friend" : ""}`;
  if (person.avatar) {
    const img = document.createElement("img");
    img.src = person.avatar;
    img.alt = "";
    img.draggable = false;
    el.appendChild(img);
  } else {
    el.textContent = (person.name.trim()[0] ?? "?").toUpperCase();
  }
  return L.divIcon({ html: el, className: "knot-pin-wrap", iconSize: [48, 48], iconAnchor: [24, 24] });
}

function meIcon(): L.DivIcon {
  const el = document.createElement("span");
  el.className = "knot-me";
  return L.divIcon({ html: el, className: "knot-pin-wrap", iconSize: [26, 26], iconAnchor: [13, 13] });
}

export default function CampusMap({ bounds, me, people, selected, onSelect, recenter }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const meLayer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!box.current || map.current) return;
    const centre = L.latLng(bounds.center_lat, bounds.center_lng);
    const area = bounds.radius_m ? centre.toBounds(bounds.radius_m * 2) : L.latLngBounds([bounds.south, bounds.west], [bounds.north, bounds.east]);
    const m = L.map(box.current, {
      center: [bounds.center_lat, bounds.center_lng],
      zoom: 16,
      minZoom: 15,
      maxZoom: 19,
      zoomControl: false,
      maxBounds: area.pad(0.25),
      maxBoundsViscosity: 0.9,
      attributionControl: false,
    });
    L.control.attribution({ prefix: false, position: "topright" }).addAttribution("© OpenStreetMap").addTo(m);
    L.tileLayer(TILE_URL, { maxZoom: 19, detectRetina: true }).addTo(m);
    // The area where sharing works.
    const outline = { color: "#5A3DF0", weight: 1.5, dashArray: "6 6", fill: true, fillOpacity: 0.03, interactive: false };
    if (bounds.radius_m) L.circle(centre, { ...outline, radius: bounds.radius_m }).addTo(m);
    else if (bounds.polygon && bounds.polygon.length >= 3) L.polygon(bounds.polygon, outline).addTo(m);
    else L.rectangle(area, outline).addTo(m);
    m.on("click", () => onSelectRef.current(null));
    layer.current = L.layerGroup().addTo(m);
    meLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, [bounds]);

  // Other students.
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const p of people) {
      const on = p.id === selected;
      if (!p.precise) {
        L.circle([p.lat, p.lng], {
          radius: ROUGH_RADIUS_M,
          color: p.connected ? "#5A3DF0" : "#17142B",
          weight: 1,
          opacity: 0.35,
          fillOpacity: on ? 0.16 : 0.08,
          interactive: false,
        }).addTo(g);
      }
      L.marker([p.lat, p.lng], { icon: pin(p, on), keyboard: true, title: p.name, alt: p.name, zIndexOffset: on ? 1000 : 0, riseOnHover: true })
        .on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectRef.current(p.id);
        })
        .addTo(g);
    }
  }, [people, selected]);

  // You.
  useEffect(() => {
    const g = meLayer.current;
    if (!g) return;
    g.clearLayers();
    if (!me) return;
    L.marker([me.lat, me.lng], { icon: meIcon(), interactive: false, zIndexOffset: 2000 }).addTo(g);
  }, [me]);

  useEffect(() => {
    if (recenter > 0 && me && map.current) map.current.flyTo([me.lat, me.lng], Math.max(map.current.getZoom(), 17), { duration: 0.6 });
    // Only when asked, not on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenter]);

  return <div ref={box} className="h-full w-full bg-[#e8e4da]" role="region" aria-label="Campus map" />;
}
