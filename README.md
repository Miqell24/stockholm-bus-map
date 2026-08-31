# Stockholm Public Transport — interactive map

Interactive, poster-grade map of the public transport network of **Stockholm
and its kommuner**: SL's buses, the six lokalbanor — Spårväg City,
Nockebybanan, Lidingöbanan, Saltsjöbanan, Roslagsbanan and Tvärbanan — the
seven tunnelbana lines in their own colours and the pendeltåg, drawn along the
real street and track geometry.

## Live

Local build on port 8164 (`npm run serve`).

Everything comes from ONE feed — **Trafiklab's GTFS Regional SL**, the detailed
one with shapes and platform-level stops. Trafiklab serves it only behind a
free API key, which a build script cannot carry, so the download takes the
**Mobility Database's** open daily mirror of the same file
(`files.mobilitydatabase.org/mdb-3237/latest.zip`) — the route São Paulo's
SPTrans feed takes in this family.

The feed covers the whole of Stockholm County, 555 bus lines reaching Norrtälje
and Nynäshamn, so the map's scope is a precomputed allowlist
(`pipeline/scope.mjs` → `data/scope.json`):

| mode | route_type | scope | graph |
|---|---|---|---|
| buses | 700 | ≥50% of stops within 25 km of T-Centralen, no stop past 50 km | OSM roadways |
| lokalbanor | 900 | same radius, 55 km cap so Roslagsbanan reaches Kårsta whole | `tram` + `light_rail` + `narrow_gauge` + non-main `rail` |
| tunnelbana | 401 | all seven lines, SL's own colours | `railway=subway` |
| pendeltåg | 100 | all five, SL's pink, drawn with the trunk treatment | `railway=rail` |

Two of the lokalbanor do not ride tram track at all, and both needed the graph
widened: **Roslagsbanan** is an 891 mm network OSM tags `railway=narrow_gauge`
(which the shared `RAIL_OK` set did not know, so lines 27, 28 and 29 came out
empty), and **Saltsjöbanan** is standard-gauge heavy rail tagged
`railway=rail`, like the mainline beside it. The discriminator is OSM's own
`usage` tag: Saltsjöbanan is `usage=branch` while Västra stambanan and
Citybanan are `usage=main`, so the mainline stays out and Tvärbanan cannot snap
onto the pendeltåg tracks it runs beside.

Line 40 ends in Uppsala, 68 km out, and that stretches the frame north.
Cutting it would have been a lie: SL sells tickets for it and draws it on its
own map.

Cut deliberately: the **ferries** (1000 — SL's own pendelbåtar and the whole
Waxholmsbolaget archipelago fleet; no water graph, and the boats run 90 km out
to sea), the thirteen **Ersättningsbussar** (the feed labels them in
`route_desc` and names them after the rail line they stand in for — Budapest's
*pótló* rule) and **Närtrafiken**, SL's dial-a-ride, which has numbers but no
fixed run. With the replacement buses gone, no number repeats across modes, so
nothing here needs a disambiguating key.

## Pipeline

`npm run download` fetches the SL feed, computes the scope, and cuts the OSM
extracts. **The OSM data comes from Geofabrik, not Overpass** — Sweden has no
sub-regions there, so `pipeline/pbf-tiles.py` (needs `pip3 install --user
osmium`) reads the 815 MB country file and clips a 4 × 4 road grid plus the
rail layer out of it, writing exactly the JSON shape Overpass would have
returned, node ids included. `goteborg-bus-map` hard-links the same file rather
than fetching a second copy.

`npm run build` map-matches every line (HMM/Viterbi on the OSM graphs) and
writes GeoJSON to `data/out/`; `npm run lines` adds the line-by-line view.
`npm run serve` hosts the map at <http://localhost:8164>.

Data: Trafiklab / SL (CC0) ·
base map © OpenFreeMap / OpenMapTiles / OpenStreetMap contributors.
