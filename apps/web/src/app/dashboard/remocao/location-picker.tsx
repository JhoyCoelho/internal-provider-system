'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props = { value: string; onChange: (value: string) => void; onDeviceLocation?: (value: string) => void };

const removalPin = L.divIcon({
  className: 'remocao-marker-wrapper',
  html: '<div class="remocao-map-pin"><span></span></div>',
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

export function LocationPicker({ value, onChange, onDeviceLocation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const baseLayersRef = useRef<{ standard: L.TileLayer; satellite: L.TileLayer } | null>(null);
  const [layer, setLayer] = useState<'standard' | 'satellite'>('standard');
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const initial = value.split(',').map(Number);
    const fallback: L.LatLngExpression = [-5.7945, -35.211];
    const selected: L.LatLngExpression | null = initial.length === 2 && initial.every(Number.isFinite) ? [initial[0], initial[1]] : null;
    let disposed = false;

    function createMap() {
      if (!containerRef.current || disposed || mapRef.current) return;
      const map = L.map(containerRef.current).setView(selected ?? fallback, selected ? 16 : 12);
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

    createMap();

    return () => { disposed = true; markerRef.current?.remove(); mapRef.current?.remove(); mapRef.current = null; baseLayersRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const coordinates = value.split(',').map(Number);
    if (!map || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) return;
    const position: L.LatLngExpression = [coordinates[0], coordinates[1]];
    map.setView(position, 16);
    if (markerRef.current) markerRef.current.setLatLng(position);
    else markerRef.current = L.marker(position, { icon: removalPin }).addTo(map);
  }, [value]);

  function locateDevice() {
    setLocationMessage(null);
    if (!window.isSecureContext) {
      setLocationMessage('A localização exige HTTPS. Abra o sistema pelo endereço seguro da plataforma.');
      return;
    }
    if (!navigator.geolocation) {
      setLocationMessage('Este navegador não disponibiliza localização. Você pode marcar o ponto diretamente no mapa.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
        mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 16);
        onDeviceLocation?.(coordinates);
        setLocationMessage('Localização obtida. Você pode ajustar o ponto no mapa.');
        setLocating(false);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'A permissão foi negada ou bloqueada. Autorize a localização nas permissões do site ou marque o ponto no mapa.'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'O dispositivo não conseguiu determinar a localização. Tente novamente ou marque o ponto no mapa.'
            : 'A localização demorou para responder. Tente novamente ou marque o ponto no mapa.';
        setLocationMessage(message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  function changeLayer(nextLayer: 'standard' | 'satellite') {
    const map = mapRef.current;
    const baseLayers = baseLayersRef.current;
    if (!map || !baseLayers || nextLayer === layer) return;
    baseLayers[layer].removeFrom(map);
    baseLayers[nextLayer].addTo(map);
    setLayer(nextLayer);
  }

  return <div><div className="mb-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => changeLayer('standard')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${layer === 'standard' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Mapa</button><button type="button" onClick={() => changeLayer('satellite')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${layer === 'satellite' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Satélite</button><button type="button" onClick={locateDevice} disabled={locating} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50">{locating ? 'Localizando...' : 'Centralizar na minha localização'}</button></div><p className="mb-2 text-xs text-slate-500">Ao solicitar a localização, o navegador pedirá sua autorização. {onDeviceLocation ? 'Ela será usada como origem da rota; você também pode escolher o ponto no mapa.' : 'Ela apenas centraliza o mapa; marque manualmente a localização do cliente.'}</p><div ref={containerRef} className="h-64 w-full overflow-hidden rounded-lg border border-slate-300" />{locationMessage && <p role="status" className="mt-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-700">{locationMessage}</p>}{value && <p className="mt-1 text-xs font-medium text-emerald-700">Localização selecionada: {value}</p>}</div>;
}
