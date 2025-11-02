// util/query.ts — SPARQL request + grouping + sanitization

export type BindingTerm = {
  type: string;
  value: string;
  datatype?: string;
  "xml:lang"?: string;
};

export type SparqlBinding = Record<string, BindingTerm>;

/** Parsed/sanitized observation record for charting */
export type SanitizedObservation = {
  start: Date;
  startMs: number;
  durationSec: number; // sanitized (0 if unknown)
  end: Date;           // start + durationSec
  count: number;
  vehicleType: string; // short label or "unknown"
  raw: SparqlBinding;
};

export type SensorObject = {
  id: string,
  lon: number,
  lat: number, 
  observations: SparqlBinding[]
}

const SPARQL_QUERY = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX sosa: <http://www.w3.org/ns/sosa/>
PREFIX impl: <https://implementatie.data.vlaanderen.be/ns/vsds-verkeersmetingen#>
PREFIX verkeer: <https://data.vlaanderen.be/ns/verkeersmetingen#>
PREFIX prov: <http://www.w3.org/ns/prov#>
PREFIX sf: <http://www.opengis.net/ont/sf#>
PREFIX time: <http://www.w3.org/2006/time#>
PREFIX geosparql: <http://www.opengis.net/ont/geosparql#>
PREFIX iso19156-sp: <http://def.isotc211.org/iso19156/2011/SamplingPoint#>
PREFIX iso19156-ob: <http://def.isotc211.org/iso19156/2011/Observation#>

SELECT ?obs ?startTime ?duration ?count ?wkt ?sensor WHERE {
  
?obs a impl:Verkeerstelling ;
     impl:Verkeerstelling.tellingresultaat ?count ;
     verkeer:geobserveerdObject ?object ;
     iso19156-ob:OM_Observation.phenomenonTime  ?phenomenonTime;
     sosa:madeBySensor ?sensor.
    
?phenomenonTime a time:TemporalEntity;
        time:hasBeginning    ?startTimeObject;
        time:hasXSDDuration  ?duration .

?startTimeObject a time:Instant;
        time:inXSDDateTimeStamp ?startTime .

?object a verkeer:Verkeersmeetpunt ;
        iso19156-sp:SF_SamplingPoint.shape  ?location .

?location a sf:Point;
        geosparql:asWKT  ?wkt .
  
} 
ORDER BY ?sensor ?startTime
`;

/** Execute the OSLO/VSDS SPARQL query and return raw bindings */
export async function* queryEndpoint(endpoint: string): AsyncGenerator<{ sensor: string, observation: SparqlBinding }[], void, unknown> {
  console.log(`Querying SPARQL endpoint at ${endpoint}.`)

  let offset = 0;
  const limit = 3000;

  let bindings = await sendQuery(endpoint, limit, offset);

  while (bindings.length > 0) {
    console.log(`Resolved SPARQL Query for indices ${offset} to ${offset + limit}`)
    // yield the existing bindings
    yield bindings as { sensor: string, observation: SparqlBinding }[];

    // fetch the next iteration
    offset += limit;
    bindings = await sendQuery(endpoint, limit, offset);
  }
}

async function sendQuery(endpoint: string, limit: number, offset: number) {

  const queryBody = SPARQL_QUERY + `\n LIMIT ${limit} OFFSET ${offset}`
  
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/sparql-query",
      Accept: "application/sparql-results+json",
    },
    body: queryBody,
  });

  if (!res.ok) {
    const text = await safeText(res);
    throw new Error(`SPARQL HTTP ${res.status}: ${text || res.statusText}`);
  }

  const json = await res.json();
  const bindings: SparqlBinding[] = json?.results?.bindings || [];
  const sensorBasedBindings = bindings.map(bindings => { return({ sensor: getSensorId(bindings), observation: bindings }) })
  return sensorBasedBindings
}

/** Async generator: groups bindings by sensor, sorts by time, and yields per sensor with location */
export function getSensorId(bindings: SparqlBinding) {
  if (bindings.sensor && bindings.sensor.type !== "bnode") {
    return bindings.sensor.value
  } else if (bindings.wkt?.value) {
    return `http://example.org/sensor/location/${bindings.wkt?.value}`
  } else {
    return undefined
  }
}

/** Sanitize raw observation bindings for charting (duration guessing + normalization) */
export function sanitizeObservations(bindings: SparqlBinding[]): SanitizedObservation[] {
  // Map to provisional records
  const provisional = bindings
    .map((b) => {
      const start = parseDate(b.startTime?.value);
      if (!start) return undefined;
      const durationSecRaw = parseISODurationToSeconds(b.duration?.value);
      const count = toNumber(b.count?.value);
      if (count == null) return undefined;
      const vt = shortLabel(b.vehicleType?.value || "unknown");
      return { start, durationSec: durationSecRaw ?? 0, count, vehicleType: vt, raw: b };
    })
    .filter(Boolean) as Array<{ start: Date; durationSec: number; count: number; vehicleType: string; raw: SparqlBinding }>;

  // Sort by start
  provisional.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Determine typical duration from non-zero durations (mode), else from median start deltas
  let typical: number | undefined = mostCommon(provisional.map((o) => o.durationSec).filter((s) => s > 0));
  if (!typical) {
    const deltas: number[] = [];
    for (let i = 1; i < provisional.length; i++) {
      const d = (provisional[i].start.getTime() - provisional[i - 1].start.getTime()) / 1000;
      if (d > 0) deltas.push(Math.round(d));
    }
    if (deltas.length) typical = median(deltas);
  }

  console.log('Median deltas', typical, provisional.map((o) => o.durationSec))

  // Fill zero durations only if they align with the next observation's start (validation rule)
  const tolSec = 2; // tolerance window
  for (let i = 0; i < provisional.length; i++) {
    const cur = provisional[i];
    if (cur.durationSec > 0) continue;
    if (!typical) continue;
    const next = provisional[i + 1];
    if (!next) continue;
    const shouldEnd = cur.start.getTime() + typical * 1000;
    const delta = Math.abs(shouldEnd - next.start.getTime());
    if (delta <= tolSec * 1000) {
      cur.durationSec = typical; // accept the guess
    }
  }

  // Build final sanitized observations
  return provisional.map((o) => {
    const durationSec = Math.max(0, Math.round(o.durationSec));
    const startMs = o.start.getTime();
    const end = new Date(startMs + durationSec * 1000);
    return {
      start: o.start,
      startMs,
      durationSec,
      end,
      count: o.count,
      vehicleType: o.vehicleType,
      raw: o.raw,
    } as SanitizedObservation;
  });
}

/********************** helper utils **********************/
function shortLabel(v?: string): string {
  if (!v) return "unknown";
  const i = Math.max(v.lastIndexOf("/"), v.lastIndexOf("#"));
  return i >= 0 ? v.slice(i + 1) || v : v;
}

function toNumber(v?: string): number | undefined {
  if (v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

export function parseISODurationToSeconds(iso?: string): number | undefined {
  if (!iso) return undefined;
  const m = iso.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?/);
  if (!m) return undefined;
  const days = Number(m[1] || 0);
  const hours = Number(m[2] || 0);
  const mins = Number(m[3] || 0);
  const secs = Number(m[4] || 0);
  return days * 86400 + hours * 3600 + mins * 60 + secs;
}

export function parseWKTPoint(wkt?: string): { lat: number; lon: number } | undefined {
  if (!wkt) return undefined;
  const t = wkt.trim().replace(/^SRID=\d+;\s*/i, "");
  const m = t.match(/POINT(?:\s+Z)?\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)(?:\s+[+-]?\d+(?:\.\d+)?)?\s*\)/i);
  if (!m) return undefined;
  let lon = parseFloat(m[1]);
  let lat = parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) [lat, lon] = [lon, lat];
  return { lat, lon };
}

function mostCommon(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best: [number, number] | undefined;
  for (const [v, c] of counts) if (!best || c > best[1]) best = [v, c];
  return best?.[0];
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const arr = [...values].sort((a, b) => a - b);
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : Math.round((arr[mid - 1] + arr[mid]) / 2);
}

async function safeText(r: Response): Promise<string | undefined> {
  try { return await r.text(); } catch { return undefined; }
}
