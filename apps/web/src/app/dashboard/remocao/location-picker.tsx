'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props = { value: string; onChange: (value: string) => void };

const removalPin = L.divIcon({
  className: 'remocao-marker-wrapper',
  html: '<div class="remocao-map-pin"><span></span></div>',
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

export function LocationPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const baseLayersRef = useRef<{ standard: L.TileLayer; satellite: L.TileLayer } | null>(null);
  const [layer, setLayer] = useState<'standard' | 'satellite'>('standard');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initial = value.split(',').map(Number);
    const fallback: L.LatLngExpression = [-5.7945, -35.211];
    const selected: L.LatLngExpression | null = initial.length === 2 && initial.every(Number.isFinite) ? [initial[0], initial[1]] : null;
    let disposed = false;

    function createMap(deviceCenter?: GeolocationPosition) {
      if (!containerRef.current || disposed || mapRef.current) return;
      const center = selected ?? (deviceCenter ? [deviceCenter.coords.latitude, deviceCenter.coords.longitude] as L.LatLngExpression : fallback);
      const map = L.map(containerRef.current).setView(center, selected || deviceCenter ? 16 : 12);
      const standard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' });
      const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
      standard.addTo(map);
      baseLayersRef.current = { standard, satellite };
      map.on('click', (event) => {
        const coordinates = `${event.latlng.lat.toFixed(6)},${event.latlng.lng.toFixed(6)}`;
        markerRef.current?.remove();
        markerRef.current = L.marker(event.latlng, { icon: removalPin }).addTo(map);
        onChange(coordinates);
      });
      if (selected) markerRef.current = L.marker(selected, { icon: removalPin }).addTo(map);
      mapRef.current = map;
    }

    if (selected || !navigator.geolocation) {
      createMap();
    } else {
      navigator.geolocation.getCurrentPosition(createMap, () => createMap(), { enableHighAccuracy: true, timeout: 8000 });
    }

    return () => { disposed = true; markerRef.current?.remove(); mapRef.current?.remove(); mapRef.current = null; baseLayersRef.current = null; };
  }, []);

  function changeLayer(nextLayer: 'standard' | 'satellite') {
    const map = mapRef.current;
    const baseLayers = baseLayersRef.current;
    if (!map || !baseLayers || nextLayer === layer) return;
    baseLayers[layer].removeFrom(map);
    baseLayers[nextLayer].addTo(map);
    setLayer(nextLayer);
  }

  return <div><div className="mb-2 flex gap-2"><button type="button" onClick={() => changeLayer('standard')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${layer === 'standard' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Mapa</button><button type="button" onClick={() => changeLayer('satellite')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${layer === 'satellite' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Satélite</button></div><div ref={containerRef} className="h-64 w-full overflow-hidden rounded-lg border border-slate-300" /><p className="mt-1 text-xs text-slate-500">O mapa começa na localização do dispositivo. Clique para marcar o cliente.</p>{value && <p className="mt-1 text-xs font-medium text-emerald-700">Localização selecionada: {value}</p>}</div>;
}
