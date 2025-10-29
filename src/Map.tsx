import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  type SparqlBinding,
  parseWKTPoint,
  queryEndpoint,
} from "./util/query";

import SensorPopup from "./SensorPopup";

// const worker = new Worker("./WebWorker.ts", { type: "module" });
const worker = new Worker(new URL("./WebWorker.ts", import.meta.url), {
  type: "module",
});


// Ensure default marker icons load
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type SensorData = {
  sensor: string;
  lat: number;
  lon: number;
  observations: SparqlBinding[];
  // observations: SparqlBinding[];
};

type SensorsState = Record<string, SensorData>;

export default function MapView(props: { setState: (state:string) => void }) {
  const [sensors, setSensors] = useState<SensorsState>({});
  const endpoint = 'http://localhost:7878/query'




    useEffect(() => {

        // Receive streamed results
        worker.onmessage = (event) => {
          setSensors(event.data.state)
          // weird naming I know
          props.setState(event.data.message)
          // 👉 Add to your map incrementally here
        };

        // Start the worker
        worker.postMessage({
          endpoint: "http://localhost:7878/query", // your Oxigraph endpoint
        });

    
      return () => {
        
      };
    }, []);



  const entries = Object.values(sensors); // SensorEntry[]
  
  console.log(`Showing markers for: \n${entries.map(e => e.sensor).join('\n')}`)

  return (
    <MapContainer
      center={[50.85, 4.35]}
      zoom={12}
      scrollWheelZoom
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {entries.map((s: SensorData) => (
        <Marker key={s.sensor} position={[s.lat, s.lon]}>
          <SensorPopup {...s} />
        </Marker>
      ))}
    </MapContainer>
  );
}
