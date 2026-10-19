# RHUL Campus Drive: reconstruction notes

`rhul.html` is a drivable 3D model of Royal Holloway's Egham campus. This folder holds its code, data and the
pipeline that builds the data. The page before this rebuild is kept unchanged as
[`rhul-classic.html`](../rhul-classic.html), so the previous version can still be opened and restored.

This is an unofficial tribute by Alex Philip (MSc Information Security, 2022–2024). It is not affiliated with or
endorsed by Royal Holloway, University of London.

---

## 1. Running it

The site is static. It needs no build step, no API keys and no server code.

```bash
# from the repository root
python3 -m http.server 8000
# open http://localhost:8000/rhul.html
```

GitHub Pages serves the same files. All paths are relative (`rhul/js/main.js` resolves `../data/` from its own
URL). The only external dependency is three.js r128, loaded from cdnjs as before. The original page used the same
version, so no new library was added. Fonts come from Google Fonts, also as before.

Regenerating the data (only needed after editing the pipeline):

```bash
pip install numpy opencv-python-headless scikit-image shapely pyproj
python3 rhul/tools/build_data.py      # writes rhul/data/campus.json and rhul/data/landcover.png
```

The pipeline is deterministic: running it again produces a byte-identical `campus.json`.

## 2. Controls

| Input | Action |
|---|---|
| ↑ / W, ↓ / S | Accelerate; brake, then reverse |
| ← / A, → / D | Steer |
| Space | Handbrake |
| C, or 1–4 | Camera: chase, driver (first person), drone (free-look: arrows/WASD, Q/E down/up, Shift faster), orbit |
| Drag, scroll, pinch | Look around and zoom (orbit and drone) |
| Tap or click a building | Information panel with sources, *Focus camera* and *Drive there* |
| M | Campus map with search |
| T, P, N | Start or stop the guided tour, pause, skip to the next stop. Any driving key takes over. |
| F | Roads only / free roam (footpaths and lawns at walking pace) |
| R | Move the car back to the nearest road |
| H or ? | Help |
| Esc | Close the map, panel or help |

On touch screens the page shows on-screen pedals and steering. The toolbar folds the less-used buttons into a ⋯ menu.

## 3. Code layout

| File | Purpose |
|---|---|
| `rhul.html` | Page shell, HUD, map panel, help dialog and loading screen. Keeps the original page's metadata, colours and fonts. |
| `js/main.js` | Start-up, renderer, sky and lighting, scene assembly, collision fill, HUD wiring, picking, keyboard and touch input, frame loop. Exposes `window.__rhul` for automated tests. |
| `js/founders.js` | Parametric Founder's Building (section 6). |
| `js/buildings.js` | All other buildings, extruded from surveyed footprints and dressed by architectural archetype. |
| `js/materials.js` | Procedurally painted PBR textures (brick, stone, roof tiles, lead, asphalt, paving, grass and others). Colour, normal and roughness maps. |
| `js/ground.js` | Land-cover raster, splat-shaded ground, kerbs, road markings. |
| `js/landscape.js` | Trees (five species, level of detail), lamps, bollards, barriers, benches, boundary walls, entrance gates, lodges, footbridge, tennis courts. |
| `js/collision.js` | 0.5 m occupancy grid: hard and soft obstacles, building heights and owners. Used for collisions, camera avoidance and picking. |
| `js/vehicle.js` | Car model and kinematic driving model. |
| `js/cameras.js` | Chase, driver, drone, orbit and cinematic cameras with smooth blending and building avoidance. |
| `js/router.js` | Road-graph routing (Dijkstra) with path smoothing and a path follower (speed profile, multi-point turns, recovery). |
| `js/tour.js` | Guided tour and *Drive there*. |
| `js/map.js` | Vector minimap and full campus map: search, legend, zoom and pan, selection, route line, north arrow, scale bar. |
| `js/info.js` | Information-panel text with confidence levels and source links. |
| `js/traffic.js` | A30 buses and cars, and pedestrians on the footpath network. |
| `tools/build_data.py` | Data pipeline (section 5). |
| `tools/source/` | The original project's traced map data, extracted unchanged from the original page. |

## 4. Coordinate system and geographic anchoring

Scene units are metres. `x = Easting − 499900` and `z = 170500 − Northing` on the Ordnance Survey National Grid
(OSGB36, EPSG:27700), with y up, so grid north is −z. The scene origin is at WGS84 51.424715, −0.564547.

The original project's layout was traced from the campus map in an arbitrary pixel frame. The pipeline fits a
least-squares similarity transform (scale, rotation and translation) from that frame to the National Grid. The
control points are Historic England list-entry grid references for features that can be found unambiguously in
the trace:

| Anchor | List entry | Grid reference | Matched in the trace by | Use | Residual |
|---|---|---|---|---|---|
| Queen Victoria statue, North Quad | 1189442 | SU 99725 70529 | Centroid of the north-west courtyard of Founder's | fit | 0.3 m |
| Thomas and Jane Holloway statue, South Quad | 1028947 | SU 99772 70480 | Centroid of the south-east courtyard | fit | 0.4 m |
| Swimming pool, 1893 | 1378057 | SU 99864 70373 | Traced building B28, found where a statues-only fit predicted the pool | fit | 0.1 m |
| Entrance gates and lodge | 1294234 | SU 99644 70594 | The main gate in the original project | check | 13.9 m |
| Founder's Building | 1028946 | SU 99748 70506 | Listing point, midway between the statues | check | (consistent) |

The fitted scale is **1.110** and the rotation **0.02°**. In other words, the original project was about 11% too
small but correctly oriented. The 13.9 m check residual at the gates is most likely because the listing point
marks the lodge beside the gateway rather than the gateway itself. This has not been verified.

After rescaling, the campus outline encloses 143.9 acres. The university describes the campus as about 135 acres.
The 6.6% difference probably comes from the traced boundary, which includes verges and woodland edges, and has not
been resolved.

## 5. Data pipeline (`tools/build_data.py`)

Input is the original project's traced data (`tools/source/`). Each correction below is applied in code, and each
one is reported in the pipeline's output.

* **Map symbols removed.** Ten small "buildings" in the trace were map symbols (markers, icons) and not structures.
  The original page turned them into invisible collision discs on the roads. They are now removed. Their positions
  are listed in `campus.json → removed_map_symbols`.
* **Footprints regularised.** Each outline is simplified (Douglas–Peucker) and its edges snapped to the building's
  dominant angle, so walls are straight and corners square: 56 snapped, 10 simplified only, and Founder's replaced
  by the parametric model.
* **Founder's Building** is reclassified out of the generic building list. Its footprint becomes the parametric
  model's footprint, and traced roads that ran under the model's larger, rescaled outline are removed.
* **Founder's Square is pedestrianised.** The trace marked it as road. 2,098 raster cells are changed to paving
  (roughly 45 m × 52 m north-east of Founder's), and the road graph no longer crosses it.
* **Footprints trimmed back from roads.** Wherever a traced footprint overlapped a traced carriageway, the footprint
  is cut back 0.4 m clear of the road, losing at most 15% of its area. Most buildings lose under 3%. The largest
  trims are B35 (8.9%), B31 (8.7%), B53 (8.7%) and B38 (5.3%). These four are where the trace is least reliable.
* **One small structure moved.** B34 (under 60 m²) sat on a carriageway. It was moved 5.5 m to the roadside.
* **Graphs and edges.** The road and footpath rasters are skeletonised into graphs: 278 road nodes and 297 edges,
  plus 535 footpath nodes and 269 edges. Kerb lines are traced from the road mask, totalling 19.2 km of edges.
* **Land cover** is written as a palette PNG with these classes: lawn, woodland, road and car park, paving, and
  footpath.

## 6. Founder's Building

Founder's Building is the highest-priority structure. It is built in code (`founders.js`) from the Historic England
list description (entry **1028946**, Grade I) and fitted to the surveyed positions of the two quad statues.

### What the model takes from the listing (verified)

* Red brick with stone bands and dressings; tiled roofs.
* Four storeys plus an attic, built round two courtyards: the North Quad and the South Quad.
* **North-west entrance front**: a central archway in a three-storey centre section with a clock face. The tower over
  it is modelled as the Clock Tower.
* **North-east and south-west long fronts**, each with:
  * primary pavilions at the ends and centre, with semicircular bays, conical roofs, lucarnes (dormer windows), and
    domed roofs carrying lead bell turrets;
  * a centre bay that is flat, three windows wide, and one storey taller;
  * secondary flat pavilions with paired columns;
  * tertiary splayed bays.
* **South-east front**: a central pavilion with four circular turrets and a louvred bell turret, modelled as the
  Dragon Tower.
* **Middle range** between the courts: the dining hall under an octagonal turret (the Lantern Tower), with the chapel
  to the east of the entrance and the picture gallery to the west.
* Colonnades in the courtyards, and statues in both quads.

### Measured, estimated and approximated

| Quantity | Value | Status |
|---|---|---|
| Quad centres (statues) | see section 4 | **Measured** (grid references; 0.3–0.4 m fit residual) |
| Long-axis bearing (North Quad to South Quad) | 136.2° | **Measured** from the two statues |
| Quad centre spacing | 67.9 m | **Measured** |
| Overall length × width | 158 m × 120 m | **Estimated**, constrained by the rescaled trace (traced extents: 66.5 m from the centre line to the south-west edge, 85.5–86.4 m either way along the axis) |
| Courtyard size | 48 m × 78 m | **Estimated** |
| Floor heights, eaves 17.6 m, roof pitch | | **Estimated** from typical proportions; no drawings or measured heights were accessible |
| Clock Tower height 30 m, Lantern Tower, Dragon Tower turrets | | **Estimated** |
| Window spacing on the long fronts | about 2.4 m | **Approximated**: chosen with the listing's figure of 65 windows per floor in mind, but not matched window for window |
| Roof colour (grey slate), brick and stone colours | | **Estimated** |
| Interiors (chapel, picture gallery, dining hall) | | **Not modelled**: exterior only |

## 7. Other buildings

There are 66 more footprints, each extruded at its surveyed position, with its traced shape and holes. Each is
dressed by an archetype: Victorian red brick, flat or banded brick, panel block, buff-brick hall, clad hall, the
Shilling Building, the library-type building, and so on. The archetype gives a painted façade bay texture, parapet
and coping, and a flat, pitched or hipped roof. The archetype assignments, storey counts and heights come from the
original project, which based them on its campus video. They are **not measurements**.

### Named buildings and confidence

A building is named only where the name could be tied to a footprint. Everything else is labelled
"Building Bxx" and described as unidentified.

| Footprint | Name | Confidence | Basis |
|---|---|---|---|
| B25 | Founder's Building | **Verified** | Listing grid reference and statues |
| B28 | Victorian swimming pool (1893) | **Verified position** | Listing grid reference; 0.1 m fit residual |
| B48 | Emily Wilding Davison Building | Probable | Size, position on Founder's Square, roof terrace described in the official virtual tour |
| B23 | Windsor Building | Unconfirmed | Described officially as just off Founder's Square; the map panel shows it as "Windsor Building?" |
| B20 | Shilling Building | From the original project | Not independently verified |
| B04 | Students' Union | From the original project | Not independently verified |
| B64, B66 | Gowar & Wedderburn halls | From the original project | Not independently verified |

The guided tour also includes broad areas (academic quarter, the Hub, sports grounds, woodland and meadow). Their
info panels say they are approximate areas, not buildings.

## 8. Driving, collisions, cameras, map, tour and info panels

* **Driving.** The car uses a kinematic bicycle model about the rear axle, sub-stepped at 1/120 s so it behaves the
  same at any frame rate. Collisions are tested at 12 points round the car against the occupancy grid, and the car
  slides along walls instead of sticking.
  * In *roads only* mode the car keeps to roads and car parks, with a 0.75 m inset from the kerb.
  * *Free roam* allows lawns and footpaths at walking pace.
  * Speed limits are illustrative: A30 40 mph, campus 20 mph.
* **Collisions.** Buildings, walls and Founder's ranges are hard obstacles. Trees, lamp posts and bollards are soft
  obstacles. Only objects that are actually drawn are collidable; the original's invisible discs are gone.
* **Cameras.** Five modes: chase, driver (right-hand drive), drone (free look), orbit and the tour's cinematic
  camera. All of them avoid entering buildings.
* **Map.** The map is vector-drawn from the same data: roads and footpaths in different styles, buildings coloured by
  category, labels with collision avoidance, a north arrow and a scale bar. Search covers named entries and every
  "Building Bxx". The map supports zoom and pan (wheel, buttons, pinch), *Find me*, *Whole campus*, selection, and a
  route line while driving.
* **Guided tour.** The tour has 17 stops. Between stops the car drives real routes along the road graph, with a speed
  profile that slows for bends and multi-point turns where needed. It never teleports. Pedestrian-only places (the
  quads, Founder's Square) are shown by a camera move while the car waits on the nearest road. Pause, resume, skip
  and stop are available, and any driving key takes over.
* **Info panels** show a confidence badge, the function, a short history and source links.
  * Facts used include: Founder's opened by Queen Victoria in 1886 (designed by William Henry Crossland and
    modelled on Chambord); the Shilling Building opened in 2018 (Electronic Engineering, with a 268-seat
    auditorium and a rooftop field laboratory with solar panels and a wind turbine); the world's first MSc in Information Security, run by the ISG from October 1992;
    and the Emily Wilding Davison Building opened in 2017 (£57m).
  * Where sources disagree, the fact is left out. For example, the date of the EWD building's formal opening by the
    Princess Royal varies between sources, so it is omitted.

## 9. Sources

Consulted and used:

* Historic England list entries
  [1028946](https://historicengland.org.uk/listing/the-list/list-entry/1028946) (Founder's Building),
  1189442 and 1028947 (statues), 1378057 (swimming pool) and 1294234 (gates and lodge). Grid references were read
  via [British Listed Buildings](https://britishlistedbuildings.co.uk/).
* Royal Holloway: history of the college, *Our campus*, *How to find us*, the campus map (August 2025 PDF), news
  about the Emily Wilding Davison Building, the Shilling Building page, the ISG history PDF, and the virtual-tour
  pages.
* AccessAble guides for the Students' Union and Bedford buildings; Wikipedia; the Victorian Web page on Royal
  Holloway College.
* The original RHUL Campus Drive project (`rhul-classic.html`), for the traced layout and archetypes.

Not accessible from the build environment (stated plainly so nothing is over-claimed):

* **OpenStreetMap, Overpass and Nominatim.** The fetch tool was refused by these sites' robots rules, and the build
  machine's network does not reach them. No OSM geometry was used.
* **Images.** The campus-map PDF could only be read as text. Its drawing, photographs and the virtual-tour imagery
  could not be viewed or analysed, so façade details for modern buildings (EWD, Shilling, halls) follow the original
  project's archetypes, not photographs.
* **Terrain.** No elevation data (OS Terrain 50 or LIDAR) was available, so the ground is flat.

## 10. Testing performed

Testing used headless Chromium (Playwright) with SwiftShader software WebGL, at 1366×768 desktop and at 390×844
with touch emulation. The test scripts live outside the repository. They drive the app through `window.__rhul`.
**No testing was done on a real phone or a real GPU**, so frame rates on real devices are not known.

Latest run on the committed code. There were no console errors, page errors or failed requests.

| Test | Result |
|---|---|
| Load | 7.7 s under software rendering; desktop start view 347 draw calls and 1.20M triangles (including the shadow pass); touch layout 255 calls and 0.87M triangles |
| Drive in from the gate (12 s full throttle) | Moves 40 m; top speed 19.2 mph (campus limit); 0 collisions |
| Full throttle into Founder's north-west wall | 0 penetration samples; stops at the wall |
| Frame-rate independence (3 s at 20 fps vs 144 fps) | 12.86 m vs 12.51 m |
| Free roam on lawn | Limited to 8.9 mph |
| Reset to road | Car lands on a road cell, not blocked |
| **Full guided tour, simulated end to end** | Finished all 17 stops in 18.2 simulated minutes. No position jumps (no teleporting); longest stop-start 2.1 s. During one multi-point turn the car's corner briefly overlapped a soft obstacle cell (5 samples, 0.17 s, no buildings). |
| *Drive there* to the Davison Building | Arrived in 133 s by road |
| Cameras (chase, driver, drone, orbit) | All stay above ground and outside buildings |
| Map search "Founder" | 8 results; selecting one opens the panel with 4 sources and highlights B25 |
| Typing in the search box | Does not drive the car; the same key outside the box does |
| Tap-to-select in the 3D view | Selects the Davison Building and opens its panel |
| UI screenshots | Map, search, info panel, tour bar and help on desktop; start, map and info panel on mobile; reviewed by eye |

A bug found during this testing has been fixed. Tap selection was discarded if the frame after the tap took longer
than 400 ms. Taps are now read immediately.

## 11. Stage 1 audit of the original page (before this rebuild)

* **Working:** driving with chase and orbit-drag cameras, raster minimap and campus map, info cards, a looping tour,
  sound, A30 traffic, walkers, touch pads, and the detailed entrance (gates, lodges, footbridge), tennis courts and
  street furniture.
* **Broken or incomplete:**
  * leftover code from the London drive page;
  * a texture warning in the console;
  * the tour could not be paused or skipped;
  * only two camera modes;
  * the minimap was a raster with no search;
  * invisible collision discs on roads, left by map symbols;
  * a voxel render pass that worked against a realistic look.
* **Geographic:** the whole layout was about 11% too small (section 4). Founder's Square was drawn as road.
* **Architectural:** most buildings, including Founder's, were extruded outlines with painted façades.

## 12. Discrepancy report (known differences from the real campus)

1. **Building identities.** Only 3 buildings are verified or probable (Founder's, the swimming pool, EWD). The
   Windsor Building is a candidate, 4 names come from the original project, and the rest are unidentified.
2. **Heights and façades** of buildings other than Founder's are archetype estimates, not measurements or photo
   matches. EWD and the Shilling Building are recognisable in massing but generic in detail.
3. **Founder's Building** overall dimensions, tower heights and window counts are estimates (section 6). Statues are
   simplified, and interiors are not modelled.
4. **Terrain is flat.** The real campus stands on rising ground above Egham Hill.
5. **Campus outline** is 143.9 acres against the official 135 acres. Footprints B31, B35, B38 and B53 were trimmed
   5–9% where they met traced roads, and B34 was moved 5.5 m.
6. **Gate check point** differs by 13.9 m from the listing point (probably the lodge; see section 4).
7. **Trees.** 9,302 trees are planted from the original map's tree symbols (21 skipped where they would stand on
   roads or Founder's). Species are assigned by heuristic, not surveyed.
8. **Roads.** Widths come from the trace. Speed limits and the positions of markings, lamps and bollards follow the
   original project and are illustrative.
9. **Sports Centre** is not modelled as a building. The sports grounds are an area marker.
10. **Founder's Square** paving extent is estimated (about 45 m × 52 m).
11. **Traffic and pedestrians** are decorative.

## 13. Next implementation task

**Name the unidentified buildings.** This needs someone who can look at the official campus map image, or a
building-number overlay supplied by the owner:

1. Match each map number to a footprint `Bxx`.
2. Add the name, confidence and evidence to `NAMED` in `tools/build_data.py`.
3. Add an info entry with sources to `ENTRIES` in `js/info.js`.
4. Re-run the pipeline and the tests.

After that, the next improvements would be ground elevation from OS Terrain 50 (open data) as a heightmap in the
pipeline, and photo-referenced façades for EWD, the Shilling Building and the Students' Union.
