import { parseWKTPoint, queryEndpoint, type SparqlBinding } from "./util/query";

export type SensorData = {
  sensor: string;
  lat: number;
  lon: number;
  observations: SparqlBinding[];
  // observations: SparqlBinding[];
};

type SensorsState = Record<string, SensorData>;

self.onmessage = async (e) => {
    const { endpoint } = e.data;
    for await (const state of runQueryIterator(endpoint)) {
        self.postMessage(state)
    }
};

async function* runQueryIterator(endpoint: string) {

    let workerState: SensorsState = {}
    const limit = 3000;
    let offset = limit;

    for await (const batch of queryEndpoint(endpoint)) {
        const next: SensorsState = { ...workerState };
        for (const { sensor, observation } of batch) {
            const e = next[sensor]
            if (e) {
                next[sensor] = { ...e, observations: [...e.observations, observation] };
            } else {
                const point = parseWKTPoint(observation.wkt.value) 
                const lat = point?.lat as number
                const lon = point?.lon as number
                next[sensor] = { sensor, observations: [ observation ], lat, lon };
            }
        }
        yield { state: next, message: `Loading results ${offset} to ${offset + limit}.`};
        offset += limit;

        workerState = next;
    }
}