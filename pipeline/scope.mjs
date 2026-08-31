// Wyznacza zakres mapy Sztokholmu z feedu SL obejmującego CAŁE Sztokholmskie
// Län (555 linii autobusowych od Norrtälje po Nynäshamn) i zapisuje listy
// route_id do data/scope.json:
//
//  autobusy (route_type 700):
//   - linia należy do mapy, gdy >=50% jej przystanków leży w promieniu 25 km
//     od T-Centralen — to zasięg zwartej aglomeracji: Täby, Sollentuna,
//     Upplands Väsby, Vallentuna, Huddinge, Botkyrka, Tyresö i Haninge
//     wchodzą, Norrtälje (70 km) i Nynäshamn (58 km) już nie;
//   - odpada linia z przystankiem dalej niż 50 km, żeby jeden kurs w głąb
//     archipelagu nie rozciągał kadru na pół länu.
//  lokalbanor (900): ta sama reguła promienia, ale z limitem 55 km — trzy
//   gałęzie Roslagsbanan sięgają Kårsty (42 km) i muszą wejść w całości.
//   Wchodzą: Spårväg City (7), Nockebybanan (12), Lidingöbanan (21),
//   Saltsjöbanan (25, 25B, 26), Roslagsbanan (27, 27S, 27V, 28, 28S, 28V, 29)
//   i Tvärbanan (30, 31).
//  metro (401): wszystkie siedem linii, bez reguły promienia — to szkielet.
//  pendeltåg (100): wszystkie, bez reguły promienia. Linia 40 kończy się w
//   Uppsali (68 km od centrum) i to rozciąga kadr na północ, ale ucięcie jej
//   byłoby kłamstwem: SL sprzedaje na nią bilety i rysuje ją na swojej mapie.
//  poza mapą: promy (1000) — pendelbåtar SL i cała flota Waxholmsbolaget;
//   silnik nie ma grafu wodnego, a łodzie archipelagu sięgają 90 km w morze.
//
// Uruchamiane przez download.sh po pobraniu GTFS; build.mjs wymaga wyniku.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { iterCsv, readCsv } from './lib/csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GD = join(ROOT, 'data/gtfs');

const CX = 18.0596, CY = 59.3312;          // T-Centralen
const BUS_CORE_KM = 25, CORE_SHARE = 0.5, BUS_CAP_KM = 50;
const TRAM_CAP_KM = 55;

const t0 = Date.now();
const log = (m) => console.log(`[scope ${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

const candidates = new Map();   // route_id → 'bus' | 'tram'
const metro = [], pendel = [];
for (const r of await readCsv(join(GD, 'routes.txt'))) {
  const t = r.route_type;
  if (t === '700') candidates.set(r.route_id, 'bus');
  else if (t === '900') candidates.set(r.route_id, 'tram');
  else if (t === '401') metro.push(r.route_id);
  else if (t === '100') pendel.push(r.route_id);
}
log(`kandydatów: ${[...candidates.values()].filter((v) => v === 'bus').length} bus, `
  + `${[...candidates.values()].filter((v) => v === 'tram').length} lokalbanor; `
  + `metro ${metro.length}, pendeltåg ${pendel.length}`);

const mx = 111320 * Math.cos(CY * Math.PI / 180), my = 111132;
const stopKm = new Map();
for await (const s of iterCsv(join(GD, 'stops.txt'))) {
  const lat = Number(s.stop_lat), lon = Number(s.stop_lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    stopKm.set(s.stop_id, Math.hypot((lon - CX) * mx, (lat - CY) * my) / 1000);
  }
}
const t2r = new Map();
for await (const t of iterCsv(join(GD, 'trips.txt'))) {
  if (candidates.has(t.route_id)) t2r.set(t.trip_id, t.route_id);
}
log(`kursów do zmierzenia: ${t2r.size}`);

const rStops = new Map();
for await (const st of iterCsv(join(GD, 'stop_times.txt'))) {
  const rid = t2r.get(st.trip_id);
  if (!rid) continue;
  let s = rStops.get(rid);
  if (!s) rStops.set(rid, (s = new Set()));
  s.add(st.stop_id);
}
log(`tras z przystankami: ${rStops.size}`);

const out = { bus: [], tram: [], metro: metro.sort(), pendel: pendel.sort() };
const cut = { bus: 0, tram: 0 };
for (const [rid, stops] of rStops) {
  const kind = candidates.get(rid);
  const cap = kind === 'tram' ? TRAM_CAP_KM : BUS_CAP_KM;
  let n = 0, inside = 0, max = 0;
  for (const sid of stops) {
    const d = stopKm.get(sid);
    if (d === undefined) continue;
    n++; if (d <= BUS_CORE_KM) inside++; if (d > max) max = d;
  }
  if (!n) continue;
  if (inside / n < CORE_SHARE) continue;
  if (max > cap) { cut[kind]++; continue; }
  out[kind].push(rid);
}
out.bus.sort(); out.tram.sort();
log(`wybrano: bus ${out.bus.length} (odrzucone limitem: ${cut.bus}), `
  + `lokalbanor ${out.tram.length} (${cut.tram}), metro ${out.metro.length}, `
  + `pendeltåg ${out.pendel.length}`);
writeFileSync(join(ROOT, 'data/scope.json'), JSON.stringify(out, null, 0));
log('zapisano data/scope.json');
