#!/usr/bin/env python3
"""Build rhul/data/* for RHUL Campus Drive.

Inputs (rhul/tools/source/, extracted verbatim from rhul.html at commit d6fa7fd):
  MAP.json            traced campus map: outline, building outlines, trees, affine T (map px -> old metres)
  ROUTES.json         A30 centreline, original tour loop, main gate and inner drive point (old metres)
  F.json              street furniture placed from the campus video (old metres)
  landcover_traced.png class raster traced from the campus map (half resolution of the map image)

Outputs (rhul/data/):
  campus.json         everything in the new scene frame, plus the coordinate reference and evidence notes
  landcover.png       cleaned class raster (same pixel grid as the traced one)

Scene frame (documented in rhul/README.md):
  x = Easting  - 499900   (metres, OSGB36 / British National Grid, EPSG:27700)
  z = 170500 - Northing   (metres; +z points to grid south, so grid north is -z)
  y = up (metres). Terrain is flat (no elevation evidence was available).

The old frame was tied to the map through four buildings. Surveyed grid references from the
National Heritage List for England (statues in the two quads and the 1893 swimming pool) show it
was about 11-12% too small; a least-squares similarity transform fixes this.

Requires: numpy, opencv-python, scikit-image, shapely, pyproj.
"""
import json, math, os, sys
import numpy as np
import cv2
from skimage.morphology import skeletonize
from shapely.geometry import Polygon, Point
from shapely.validation import make_valid
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'source')
OUT = os.path.join(HERE, '..', 'data')
E0, N0 = 499900.0, 170500.0

MAP = json.load(open(os.path.join(SRC, 'MAP.json')))
ROUTES = json.load(open(os.path.join(SRC, 'ROUTES.json')))
F = json.load(open(os.path.join(SRC, 'F.json')))
CLS = cv2.imread(os.path.join(SRC, 'landcover_traced.png'), cv2.IMREAD_UNCHANGED)
assert CLS.ndim == 2, 'class raster must be single channel'
GH, GW = CLS.shape
to_wgs = Transformer.from_crs(27700, 4326, always_xy=True)

# Places in the original project (old metres), written by the project author after driving the campus.
OLD_PLACES = [
    ("founders", "Founder's Building", -186, 83.5, 95), ("chapel", "Chapel & Picture Gallery", -235, 20, 45),
    ("library", "Davison Building", -64, 20, 55), ("academic", "Academic quarter", 0, -90, 60),
    ("north", "Boilerhouse & George Eliot", -60, -215, 60), ("union", "Students' Union", 85, -250, 75),
    ("science", "Wolfson & Shilling", 150, -50, 60), ("hub", "The Hub", 182, 83, 50),
    ("sports", "Sports Centre", 300, 250, 85), ("woodland", "Woodland & Meadow", -30, 225, 75)]


# ---------------------------------------------------------------- geometry helpers
def ring_area(o):
    return 0.5 * sum(o[i][0] * o[(i + 1) % len(o)][1] - o[(i + 1) % len(o)][0] * o[i][1] for i in range(len(o)))


def ring_centroid(o):
    a = cx = cz = 0.0
    for i in range(len(o)):
        x0, z0 = o[i]; x1, z1 = o[(i + 1) % len(o)]; c = x0 * z1 - x1 * z0
        a += c; cx += (x0 + x1) * c; cz += (z0 + z1) * c
    a /= 2
    return cx / (6 * a), cz / (6 * a)


def old_grid_to_old_m(gx, gy):
    T = MAP['T']
    px, py = 2 * gx, 2 * gy + 312
    return px * T[0][0] + py * T[1][0] + T[2][0], px * T[0][1] + py * T[1][1] + T[2][1]


# ---------------------------------------------------------------- 1. coordinate fit
b25 = MAP['buildings'][25]
hole_c = [ring_centroid(h) for h in b25['h']]
# the north quad is the hole nearer the entrance (north-west); the south quad the other
north_hole = min(hole_c, key=lambda c: c[0] + c[1])
south_hole = max(hole_c, key=lambda c: c[0] + c[1])
ANCHORS = [
    dict(id='statue_north', name="Queen Victoria statue, North Quad", nhle=1189442, ngr='SU 99725 70529', E=499725, N=170529,
         old=north_hole, how='centroid of the north-west courtyard of the traced Founder\'s Building', use='fit'),
    dict(id='statue_south', name="Thomas and Jane Holloway statue, South Quad", nhle=1028947, ngr='SU 99772 70480', E=499772, N=170480,
         old=south_hole, how='centroid of the south-east courtyard of the traced Founder\'s Building', use='fit'),
    dict(id='swimming_pool', name='Royal Holloway College swimming pool (1893)', nhle=1378057, ngr='SU 99864 70373', E=499864, N=170373,
         old=ring_centroid(MAP['buildings'][28]['o']), how='centroid of traced building B28 (found where the statue-only fit predicted the pool)', use='fit'),
    dict(id='gates_lodge', name='Entrance gates and lodge', nhle=1294234, ngr='SU 99644 70594', E=499644, N=170594,
         old=tuple(ROUTES['gate']), how='the main gate on Egham Hill in the original project', use='check'),
    dict(id='founders', name="Royal Holloway College (Founder's Building)", nhle=1028946, ngr='SU 99748 70506', E=499748, N=170506,
         old=None, how='listing point; lies midway between the two statues', use='check'),
]


def fit_similarity(src, dst):
    src, dst = np.asarray(src, float), np.asarray(dst, float)
    ms, md = src.mean(0), dst.mean(0); A, B = src - ms, dst - md
    U, S, Vt = np.linalg.svd(A.T @ B); R = Vt.T @ U.T
    if np.linalg.det(R) < 0:
        Vt[1] *= -1; R = Vt.T @ U.T
    s = S.sum() / (A ** 2).sum(); t = md - s * R @ ms
    return s, R, t


# fit in a right-handed (east, north) frame: old (x, z) -> (x, -z)
fit_pts = [a for a in ANCHORS if a['use'] == 'fit']
s, R, t = fit_similarity([(a['old'][0], -a['old'][1]) for a in fit_pts], [(a['E'], a['N']) for a in fit_pts])
ROT_DEG = math.degrees(math.atan2(R[1, 0], R[0, 0]))


def old_to_bng(x, z):
    e, n = s * R @ np.array([x, -z]) + t
    return float(e), float(n)


def old_to_new(x, z):
    e, n = old_to_bng(x, z)
    return e - E0, N0 - n


def P(x, z, nd=2):
    nx, nz = old_to_new(x, z)
    return [round(nx, nd), round(nz, nd)]


def ang_new(a_old):
    """Rotate a heading/angle defined in old xz space (atan2(dx, dz) convention) into the new frame."""
    # A heading h means direction (sin h, cos h) in (x, z). Transform that direction vector.
    dx, dz = math.sin(a_old), math.cos(a_old)
    e, n = R @ np.array([dx, -dz])
    return math.atan2(e, -n)


fit_report = []
for a in ANCHORS:
    lon, lat = to_wgs.transform(a['E'], a['N'])
    rec = dict(id=a['id'], name=a['name'], nhle=a['nhle'], ngr=a['ngr'], easting=a['E'], northing=a['N'],
               lat=round(lat, 6), lon=round(lon, 6), scene=[round(a['E'] - E0, 1), round(N0 - a['N'], 1)], used_for=a['use'], how=a['how'])
    if a['old'] is not None:
        e, n = old_to_bng(*a['old'])
        rec['residual_m'] = round(math.hypot(e - a['E'], n - a['N']), 1)
    fit_report.append(rec)
print('fit: scale %.4f rotation %.2f deg' % (s, ROT_DEG))
for r in fit_report:
    print('  %-14s residual %s m' % (r['id'], r.get('residual_m')))

# ---------------------------------------------------------------- 2. class raster: clean + affine
# grid cell (gx, gy) -> new scene metres, as an affine: x = a*gx + b*gy + c ; z = d*gx + e*gy + f
o00 = old_to_new(*old_grid_to_old_m(0, 0)); o10 = old_to_new(*old_grid_to_old_m(1, 0)); o01 = old_to_new(*old_grid_to_old_m(0, 1))
GRID = dict(w=GW, h=GH, a=o10[0] - o00[0], b=o01[0] - o00[0], c=o00[0], d=o10[1] - o00[1], e=o01[1] - o00[1], f=o00[1])
Ainv = np.linalg.inv(np.array([[GRID['a'], GRID['b']], [GRID['d'], GRID['e']]]))
CELL_M = math.sqrt(abs(GRID['a'] * GRID['e'] - GRID['b'] * GRID['d']))
print('grid cell size %.3f m' % CELL_M)


def new_to_grid(x, z):
    v = Ainv @ np.array([x - GRID['c'], z - GRID['f']])
    return float(v[0]), float(v[1])


def grid_to_new(gx, gy):
    return GRID['a'] * gx + GRID['b'] * gy + GRID['c'], GRID['d'] * gx + GRID['e'] * gy + GRID['f']


# Class codes in the traced raster: 0 outside, 1 lawn, 2 woodland, 3 road, 4 building, 7 footpath.
# Output codes: 0 outside, 1 lawn, 2 woodland, 3 road, 5 paved/hardstanding, 7 footpath.
# (Buildings are modelled as geometry, so building-class ground becomes paving under/around them.)
cls = CLS.copy()
# map symbols traced as buildings: building-class blobs that no traced building outline covers
cover = np.zeros_like(cls)
OLD_BUILDINGS = MAP['buildings']
for b in OLD_BUILDINGS:
    pts = np.array([new_to_grid(*old_to_new(x, z)) for x, z in b['o']])
    cv2.fillPoly(cover, [pts.round().astype(np.int32)], 1)
orphan = ((cls == 4) & (cover == 0)).astype(np.uint8)
n, lab, stats, cent = cv2.connectedComponentsWithStats(orphan, 8)
removed_symbols = []
for i in range(1, n):
    if stats[i, 4] > 30:
        cx, cz = (lambda g: (g[0], g[1]))(cent[i])
        x = GRID['a'] * cx + GRID['b'] * cz + GRID['c']; zz = GRID['d'] * cx + GRID['e'] * cz + GRID['f']
        removed_symbols.append([round(x, 1), round(zz, 1)])
# replace orphan pixels (all sizes) with the nearest non-orphan, non-building class
keep = ~((cls == 4) & (cover == 0))
from scipy import ndimage
_, (iy, ix) = ndimage.distance_transform_edt(~keep, return_indices=True)
symbol_px = np.isin(lab, [i for i in range(1, n) if stats[i, 4] > 30])
cls = cls[iy, ix]
# the larger symbols mostly sit inside road loops (turning heads): leave a grass island there
cls[symbol_px] = 1
cls[cls == 4] = 5

# ---------------------------------------------------------------- 3. footprints
def dominant_angle(coords):
    sx = sy = 0.0
    for i in range(len(coords) - 1):
        (x0, z0), (x1, z1) = coords[i], coords[i + 1]
        L = math.hypot(x1 - x0, z1 - z0)
        if L < 1e-6: continue
        a = math.atan2(z1 - z0, x1 - x0)
        sx += L * math.cos(4 * a); sy += L * math.sin(4 * a)
    return math.atan2(sy, sx) / 4


def snap_ring(coords, theta, tol_deg=13.0):
    """Snap near-orthogonal edges of a closed ring to the dominant orientation and re-intersect them."""
    pts = coords[:-1] if coords[0] == coords[-1] else coords[:]
    m = len(pts)
    if m < 3: return None
    lines = []  # (point, direction, length)
    for i in range(m):
        p0, p1 = np.array(pts[i]), np.array(pts[(i + 1) % m])
        d = p1 - p0; L = np.linalg.norm(d)
        if L < 1e-6: continue
        a = math.atan2(d[1], d[0]); rel = (a - theta + math.pi / 4) % (math.pi / 2) - math.pi / 4
        if abs(math.degrees(rel)) < tol_deg:
            a -= rel
        lines.append([(p0 + p1) / 2, np.array([math.cos(a), math.sin(a)]), L])
    # merge consecutive parallel lines (same snapped direction), weighting the offset by length
    merged = True
    while merged and len(lines) > 3:
        merged = False
        for i in range(len(lines)):
            j = (i + 1) % len(lines)
            a, b = lines[i], lines[j]
            if abs(a[1][0] * b[1][1] - a[1][1] * b[1][0]) < 0.02 and a[1] @ b[1] > 0:
                nrm = np.array([-a[1][1], a[1][0]])
                off = (nrm @ a[0] * a[2] + nrm @ b[0] * b[2]) / (a[2] + b[2])
                along = (a[1] @ a[0] * a[2] + a[1] @ b[0] * b[2]) / (a[2] + b[2])
                lines[i] = [nrm * off + a[1] * along, a[1], a[2] + b[2]]
                del lines[j]; merged = True; break
    out = []
    for i in range(len(lines)):
        a, b = lines[i - 1], lines[i]
        cr = a[1][0] * b[1][1] - a[1][1] * b[1][0]
        if abs(cr) < 0.05: return None
        tpar = ((b[0] - a[0])[0] * b[1][1] - (b[0] - a[0])[1] * b[1][0]) / cr
        out.append((a[0] + a[1] * tpar).tolist())
    return out


def regularise(outer, holes):
    raw = make_valid(Polygon(outer, holes))
    if raw.geom_type != 'Polygon':
        raw = max(getattr(raw, 'geoms', [raw]), key=lambda g: g.area)
    simp = raw.simplify(0.9, preserve_topology=True)
    theta = dominant_angle(list(simp.exterior.coords))
    ext = snap_ring(list(simp.exterior.coords), theta)
    hs = [snap_ring(list(h.coords), theta) for h in simp.interiors]
    method = 'snapped'
    cand = None
    if ext:
        try:
            cand = Polygon(ext, [h for h in hs if h and len(h) >= 3])
        except Exception:
            cand = None
    ok = cand is not None and cand.is_valid and 0.88 < cand.area / raw.area < 1.12 and cand.hausdorff_distance(raw) < 3.0
    if not ok:
        cand, method = simp, 'simplified'
        if not cand.is_valid or cand.geom_type != 'Polygon':
            cand, method = raw, 'raw'
    ccw = lambda r: r if ring_area(r) > 0 else r[::-1]
    ext_pts = [[round(x, 2), round(z, 2)] for x, z in list(cand.exterior.coords)[:-1]]
    hole_pts = [[[round(x, 2), round(z, 2)] for x, z in list(h.coords)[:-1]] for h in cand.interiors]
    return ccw(ext_pts), [ccw(h)[::-1] for h in hole_pts], method, math.degrees(theta)


def obb(o):
    best = None
    for k in range(len(o)):
        (ax, az), (bx, bz) = o[k], o[(k + 1) % len(o)]
        L = math.hypot(bx - ax, bz - az)
        if L < 0.3: continue
        ux, uz = (bx - ax) / L, (bz - az) / L
        pp = [x * ux + z * uz for x, z in o]; qq = [-x * uz + z * ux for x, z in o]
        area = (max(pp) - min(pp)) * (max(qq) - min(qq))
        if best is None or area < best[0]:
            best = (area, max(pp) - min(pp), max(qq) - min(qq), ux, uz)
    _, L, W, ux, uz = best
    return (L, W) if L >= W else (W, L)


def circularity(o):
    per = sum(math.hypot(o[(i + 1) % len(o)][0] - o[i][0], o[(i + 1) % len(o)][1] - o[i][1]) for i in range(len(o)))
    return 4 * math.pi * abs(ring_area(o)) / (per * per)


# archetypes, following the styles the original project assigned from the campus video
def archetype_for(i, b, old_c):
    x, z = old_c; a = b['a']
    near = lambda px, pz, r: math.hypot(x - px, z - pz) < r
    gate = ROUTES['gate']
    if i == 25: return dict(arch='founders')
    if i == 28: return dict(arch='victorian_pool', storeys=1)
    if a < 400 and math.hypot(x - gate[0], z - gate[1]) < 32: return dict(arch='lodge', storeys=1)
    if a < 40: return dict(arch='kiosk', storeys=1)
    if a < 120: return dict(arch='brick_small', storeys=1)
    if b['c'] == 4:
        if near(85, -250, 45) and a > 1000: return dict(arch='brick_banded', storeys=3)
        if b['z'] < -170 or b['x'] < -250: return dict(arch='brick_flat', storeys=3 if a > 900 else 2)
        if near(155, -66, 22): return dict(arch='shilling', storeys=3)
        if a < 420: return dict(arch='brick_timber', storeys=2)
        if b['x'] > 150 or near(-127, -27, 20): return dict(arch='brick_timber', storeys=3)
        return dict(arch='panel_block', storeys=3 if a > 3000 else 2)
    if near(140, 233, 70): return dict(arch='gowar', storeys=4, pilotis=3.2)
    east = b['x'] > 90 and -95 < b['z'] < 160
    if east and a > 1500: return dict(arch='clad_hall', storeys=5)
    return dict(arch='buff_hall', storeys=3)


# Evidence register for named buildings (see README for sources). Anything not listed here is an
# unnamed traced footprint: its position comes from the campus map trace, its name is not verified.
NAMED = {
    25: dict(name="Founder's Building", conf='verified', function="Historic hall of residence, Picture Gallery, Chapel, dining hall, lecture theatre and offices",
             evidence='Historic England list entry 1028946 (Grade I); statue grid references for both quads; position of the traced outline.'),
    28: dict(name='Victorian swimming pool (1893)', conf='verified-position', function='Listed 1893 indoor swimming pool; present-day use not confirmed',
             evidence='Historic England list entry 1378057 grid reference falls within 2 m of this traced footprint after the fit.'),
    48: dict(name='Emily Wilding Davison Building', conf='probable', function='Library, Student Services Centre, Careers and Enterprise Hub, exhibition space',
             evidence="Official 'How to find us': the Visitors' Centre in Founder's central entrance is opposite the Emily Wilding Davison Building; Founder's Square links the two (official places-of-interest page). This is the building directly across from Founder's north-east front; the original project also placed the library here."),
    20: dict(name='Shilling Building', conf='project', function='Academic building (name as on the August 2025 campus map)',
             evidence='Identified by the original project from the campus drive video (distinctive diagonal-band cladding). Not independently verified here.'),
    4: dict(name="Students' Union (probable)", conf='project', function="Students' Union (two floors, per AccessAble)",
            evidence="The original project's Students' Union stop and banded red-brick styling. Not independently verified here."),
    64: dict(name='Gowar & Wedderburn halls (part)', conf='project', function='Self-catered halls: Gowar 217 rooms, Wedderburn 353 rooms (official virtual tour)',
             evidence="Official virtual tour places Gowar & Wedderburn at the southern end of campus; the original project identified these blocks."),
    66: dict(name='Gowar & Wedderburn halls (part)', conf='project', function='Self-catered halls: Gowar 217 rooms, Wedderburn 353 rooms (official virtual tour)',
             evidence="Official virtual tour places Gowar & Wedderburn at the southern end of campus; the original project identified these blocks."),
}

buildings_out = []
for i, b in enumerate(OLD_BUILDINGS):
    outer = [old_to_new(x, z) for x, z in b['o']]
    holes = [[old_to_new(x, z) for x, z in h] for h in b['h']]
    if ring_area(outer) < 0: outer = outer[::-1]
    raw_area = abs(Polygon(outer, holes).area)
    if i == 25:
        ext, hs, method, theta = [[round(x, 2), round(z, 2)] for x, z in outer], [], 'replaced', 0  # Founder's is modelled separately
    else:
        ext, hs, method, theta = regularise(outer, holes)
    cx, cz = ring_centroid(ext)
    L, W = obb(ext)
    rec = dict(id='B%02d' % i, o=ext, h=hs, area=round(abs(ring_area(ext)) - sum(abs(ring_area(h)) for h in hs), 1),
               traced_area=round(raw_area, 1), c=[round(cx, 2), round(cz, 2)], obb=[round(L, 1), round(W, 1)],
               map_class='academic' if b['c'] == 4 else 'residential/other', outline=method,
               round=circularity(ext) > 0.78)
    rec.update(archetype_for(i, b, (b['x'], b['z'])))
    e, nn = cx + E0, N0 - cz
    lon, lat = to_wgs.transform(e, nn)
    rec['lat'], rec['lon'] = round(lat, 6), round(lon, 6)
    if i in NAMED: rec.update(NAMED[i])
    buildings_out.append(rec)

# ---------------------------------------------------------------- 4. Founder's Building frame
# centre: midway between the two statues (equals the listing point to within 2 m);
# long axis: through both statues (quads lie north-west / south-east of each other)
sn, ss = [a for a in ANCHORS if a['id'] == 'statue_north'][0], [a for a in ANCHORS if a['id'] == 'statue_south'][0]
fc = [((sn['E'] + ss['E']) / 2) - E0, N0 - (sn['N'] + ss['N']) / 2]
ax_e, ax_n = ss['E'] - sn['E'], ss['N'] - sn['N']
quad_spacing = math.hypot(ax_e, ax_n)
axis = [ax_e / quad_spacing, -ax_n / quad_spacing]  # unit vector north-quad -> south-quad in scene (x, z)
# Model dimensions (estimates). The building, including its corner bays (~4.8 m beyond the main walls), is kept inside
# the traced outline: the trace reaches 85.5/86.4 m either side of the centre along the axis and 66.5 m to the
# south-west (its north-east edge, at 82 m, takes in adjoining hard landscaping and is not used).
FOUNDERS = dict(centre=[round(fc[0], 2), round(fc[1], 2)], axis=[round(axis[0], 5), round(axis[1], 5)],
                quad_spacing=round(quad_spacing, 2), bearing_deg=round(math.degrees(math.atan2(ax_e, ax_n)) % 360, 1),
                dims=dict(L=158.0, W=120.0, Q=48.0, WQ=78.0, bays=4.8,
                          note='Overall length and width are estimates constrained by the traced outline; quad centres are surveyed (statue grid references).'))
print('founders', FOUNDERS)

# reclassify the old Founder's blob: paving towards the entrance (NW) and Founder's Square (NE), lawn elsewhere
fpoly = np.array([new_to_grid(*p) for p in buildings_out[25]['o']]).round().astype(np.int32)
fmask = np.zeros_like(cls); cv2.fillPoly(fmask, [fpoly], 1)
for hh in OLD_BUILDINGS[25]['h']:
    hp = np.array([new_to_grid(*old_to_new(x, z)) for x, z in hh]).round().astype(np.int32)
    cv2.fillPoly(fmask, [hp], 1)
ys, xs = np.nonzero(fmask)
for gy, gx in zip(ys, xs):
    x = GRID['a'] * gx + GRID['b'] * gy + GRID['c'] - fc[0]; zz = GRID['d'] * gx + GRID['e'] * gy + GRID['f'] - fc[1]
    along = x * axis[0] + zz * axis[1]          # + towards the SE front
    across = -x * axis[1] + zz * axis[0]        # + towards the SW side
    cls[gy, gx] = 5 if (along < -60 or across < -48) else 1
# nothing drivable under the modelled building (its outline plus 2 m): roads that ran into the traced outline become paving
D_ = FOUNDERS['dims']
ys2, xs2 = np.nonzero(cls == 3)
for gy, gx in zip(ys2, xs2):
    x = GRID['a'] * gx + GRID['b'] * gy + GRID['c'] - fc[0]; zz = GRID['d'] * gx + GRID['e'] * gy + GRID['f'] - fc[1]
    along = x * axis[0] + zz * axis[1]; across = -x * axis[1] + zz * axis[0]
    if abs(along) < D_['L'] / 2 + D_['bays'] + 1.0 and abs(across) < D_['W'] / 2 + D_['bays'] + 1.0:
        cls[gy, gx] = 5

# Founder's Square: official pages describe "an open courtyard ... bordered by the Founder's Building and the
# Emily Wilding Davison Building" with paved areas and benches. The traced map shows that ground as road/hard surface,
# so road cells there become paving (pedestrian). Extent between the two buildings is an estimate.
SQUARE = dict(across=(67.0, 112.0), along=(-26.0, 26.0))
sq_cells = 0
gy_idx, gx_idx = np.nonzero(cls == 3)
for gy, gx in zip(gy_idx, gx_idx):
    x = GRID['a'] * gx + GRID['b'] * gy + GRID['c'] - fc[0]; zz = GRID['d'] * gx + GRID['e'] * gy + GRID['f'] - fc[1]
    along = x * axis[0] + zz * axis[1]; across = -(-x * axis[1] + zz * axis[0])   # + towards the NE side
    if SQUARE['across'][0] < across < SQUARE['across'][1] and SQUARE['along'][0] < along < SQUARE['along'][1]:
        cls[gy, gx] = 5; sq_cells += 1
print("Founder's Square: %d road cells made pedestrian paving" % sq_cells)

# Footprints regularised from a hand-drawn map can reach over road edges; trim them back so that a building never
# stands on the carriageway (kerb margin 0.4 m). Skipped when it would remove more than 15% of a footprint.
from shapely.ops import unary_union
rm8 = (cls == 3).astype(np.uint8)
cs_, hier_ = cv2.findContours(rm8, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
road_polys = []
for i, c in enumerate(cs_):
    if hier_[0][i][3] != -1 or len(c) < 3: continue
    outer = [grid_to_new(float(x), float(y)) for x, y in c[:, 0, :]]
    holes = [[grid_to_new(float(x), float(y)) for x, y in cs_[j][:, 0, :]] for j in range(len(cs_)) if hier_[0][j][3] == i and len(cs_[j]) >= 3]
    pg = make_valid(Polygon(outer, holes))
    road_polys.append(pg)
ROADS = unary_union(road_polys).buffer(0.4)
trimmed = []
for b in buildings_out:
    if b['arch'] == 'founders': continue
    pg = make_valid(Polygon(b['o'], b['h']))
    if not pg.intersects(ROADS): continue
    cut = pg.difference(ROADS)
    if cut.is_empty: continue
    if cut.geom_type != 'Polygon': cut = max(getattr(cut, 'geoms', [cut]), key=lambda g: g.area)
    if cut.area < 0.85 * pg.area or cut.area < 8: continue
    cut = cut.simplify(0.3, preserve_topology=True)
    ccw = lambda r: r if ring_area(r) > 0 else r[::-1]
    b['o'] = ccw([[round(x, 2), round(z, 2)] for x, z in list(cut.exterior.coords)[:-1]])
    b['h'] = [ccw([[round(x, 2), round(z, 2)] for x, z in list(h.coords)[:-1]])[::-1] for h in cut.interiors]
    b['area'] = round(cut.area, 1); trimmed.append((b['id'], round(100 * (1 - cut.area / pg.area), 1)))
print('footprints trimmed back from roads (id, % area):', trimmed)

# Small traced structures (< 60 m2, e.g. shelters or kiosks) that overlap a road are an artefact of the map trace:
# move each one straight away from the road until it stands clear (at most 8 m). Recorded in the output.
road_m = (cls == 3).astype(np.uint8)
dist_out = ndimage.distance_transform_edt(1 - road_m) * CELL_M
gy_g, gx_g = np.gradient(ndimage.gaussian_filter(dist_out, 2.0))
moved = []
def overlaps_road(ring):
    pts = np.array([new_to_grid(x, z) for x, z in ring]).round().astype(np.int32)
    m = np.zeros_like(cls); cv2.fillPoly(m, [pts], 1); return bool((m & road_m).any())
for b in buildings_out:
    if b['area'] >= 60 or b['arch'] == 'founders': continue
    if not overlaps_road(b['o']): continue
    gx_c, gy_c = new_to_grid(*b['c']); ix, iy = int(round(gx_c)), int(round(gy_c))
    vx, vy = gx_g[iy, ix], gy_g[iy, ix]  # gradient in grid space (towards larger distance from road)
    ex = GRID['a'] * vx + GRID['b'] * vy; ez = GRID['d'] * vx + GRID['e'] * vy; L = math.hypot(ex, ez) or 1
    ex, ez = ex / L, ez / L
    for step in np.arange(0.5, 8.01, 0.5):
        ring = [[x + ex * step, z + ez * step] for x, z in b['o']]
        if not overlaps_road(ring):
            b['o'] = [[round(x, 2), round(z, 2)] for x, z in ring]; b['c'] = [round(b['c'][0] + ex * step, 2), round(b['c'][1] + ez * step, 2)]
            b['adjusted'] = 'moved %.1f m off the road (trace artefact)' % step; moved.append((b['id'], round(float(step), 1)))
            break
print('small structures moved off roads:', moved)

# ---------------------------------------------------------------- 5. road and footpath graphs from the raster
def raster_graph(mask, spur_m, simplify_m):
    mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    sk = skeletonize(mask > 0)
    dist = ndimage.distance_transform_edt(mask)
    H, W = sk.shape
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    pix = set(zip(*np.nonzero(sk)))
    deg = {p: sum((p[0] + dy, p[1] + dx) in pix for dy, dx in nb) for p in pix}
    nodepix = {p for p, d in deg.items() if d != 2}
    # cluster adjacent node pixels into nodes
    node_of, nodes = {}, []
    for p in nodepix:
        if p in node_of: continue
        stack, comp = [p], []
        node_of[p] = len(nodes)
        while stack:
            q = stack.pop(); comp.append(q)
            for dy, dx in nb:
                r = (q[0] + dy, q[1] + dx)
                if r in nodepix and r not in node_of:
                    node_of[r] = len(nodes); stack.append(r)
        nodes.append(comp)
    edges, seen = [], set()
    for ni, comp in enumerate(nodes):
        for p in comp:
            for dy, dx in nb:
                q = (p[0] + dy, p[1] + dx)
                if q not in pix or q in nodepix or (p, q) in seen: continue
                path, prev, cur = [p, q], p, q
                while cur not in nodepix:
                    nxt = [(cur[0] + a, cur[1] + b) for a, b in nb if (cur[0] + a, cur[1] + b) in pix and (cur[0] + a, cur[1] + b) != prev]
                    nxt = [r for r in nxt if r not in path[-3:]]
                    if not nxt: break
                    nxt.sort(key=lambda r: (r not in nodepix, abs(r[0] - cur[0]) + abs(r[1] - cur[1])))
                    prev, cur = cur, nxt[0]; path.append(cur)
                    if len(path) > 20000: break
                if cur in nodepix:
                    seen.add((cur, path[-2])); seen.add((p, q))
                    edges.append([ni, node_of[cur], path])
    # to scene coordinates
    def to_xy(path):
        return [grid_to_new(c, r) for r, c in path]
    nodes_xy = [np.mean([grid_to_new(c, r) for r, c in comp], axis=0).tolist() for comp in nodes]
    E = []
    for a, bb, path in edges:
        if a == bb and len(path) < 6: continue
        pts = to_xy(path)
        L = sum(math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) for k in range(len(pts) - 1))
        wd = float(np.median([dist[r, c] for r, c in path])) * 2 * CELL_M
        E.append(dict(a=a, b=bb, L=L, pts=pts, w=wd))
    # prune short dead-end spurs (twice)
    for _ in range(3):
        degc = {}
        for e in E:
            degc[e['a']] = degc.get(e['a'], 0) + 1; degc[e['b']] = degc.get(e['b'], 0) + 1
        E = [e for e in E if not ((degc[e['a']] == 1 or degc[e['b']] == 1) and e['L'] < spur_m)]
    # remove duplicate parallel edges between the same nodes, keep the shortest
    best = {}
    for e in E:
        k = (min(e['a'], e['b']), max(e['a'], e['b']))
        if e['a'] == e['b']: k = (e['a'], e['a'], round(e['L']))
        if k not in best or e['L'] < best[k]['L']: best[k] = e
    E = list(best.values())
    used = sorted({e['a'] for e in E} | {e['b'] for e in E})
    remap = {o: n for n, o in enumerate(used)}
    out_nodes = [[round(nodes_xy[o][0], 2), round(nodes_xy[o][1], 2)] for o in used]
    out_edges = []
    for e in E:
        from shapely.geometry import LineString
        ls = LineString(e['pts']).simplify(simplify_m)
        pts = [[round(x, 2), round(z, 2)] for x, z in ls.coords]
        pts[0] = out_nodes[remap[e['a']]][:]; pts[-1] = out_nodes[remap[e['b']]][:]
        out_edges.append([remap[e['a']], remap[e['b']], round(e['L'], 1), round(e['w'], 1), pts])
    return dict(nodes=out_nodes, edges=out_edges)


def edge_lines(mask, eps_m=0.35, min_len_m=6.0, up=4):
    """Smooth boundary polylines of a class mask, oriented with the class on the LEFT (x, z frame).
    The mask is blurred like the ground shader's splat (sigma ~1 cell) and contoured at 0.5 on a 4x grid."""
    m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.0)
    big = cv2.resize(m, (m.shape[1] * up, m.shape[0] * up), interpolation=cv2.INTER_LINEAR)
    bw = (big > 0.5).astype(np.uint8)
    cs, hier = cv2.findContours(bw, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    Hh, Ww = bw.shape
    for i, c in enumerate(cs):
        c = c[:, 0, :].astype(float)
        if len(c) < 8: continue
        is_hole = hier[0][i][3] != -1
        pts = [grid_to_new((x + 0.5) / up - 0.5, (y + 0.5) / up - 0.5) for x, y in c]
        area = ring_area(pts)
        if (not is_hole and area < 0) or (is_hole and area > 0): pts = pts[::-1]; c = c[::-1]
        # split where the contour runs along the raster border (the road continues off the map there)
        near = [(x < 3 or y < 3 or x > Ww - 4 or y > Hh - 4) for x, y in c]
        runs, cur = [], []
        for p, nb in zip(pts, near):
            if nb:
                if len(cur) > 1: runs.append(cur)
                cur = []
            else: cur.append(p)
        if len(cur) > 1:
            if runs and not near[0] and not near[-1]: runs[0] = cur + runs[0]
            else: runs.append(cur)
        if not any(near): runs = [pts + [pts[0]]]
        from shapely.geometry import LineString
        for r in runs:
            ls = LineString(r)
            if ls.length < min_len_m: continue
            ls = ls.simplify(eps_m)
            out.append([[round(x, 2), round(z, 2)] for x, z in ls.coords])
    return out


roads = raster_graph(cls == 3, spur_m=9, simplify_m=0.7)
road_edges = edge_lines(cls == 3)
print('road edge polylines: %d, %.1f km' % (len(road_edges), sum(sum(math.hypot(l[k + 1][0] - l[k][0], l[k + 1][1] - l[k][1]) for k in range(len(l) - 1)) for l in road_edges) / 1000))
paths = raster_graph(cls == 7, spur_m=4, simplify_m=0.5)
print('road graph: %d nodes %d edges; footpaths: %d nodes %d edges' % (len(roads['nodes']), len(roads['edges']), len(paths['nodes']), len(paths['edges'])))

# ---------------------------------------------------------------- 6. everything else
outline = [P(x, z, 1) for x, z in MAP['outline']]
trees = [[*P(x, z, 1), round(sz * 1.05, 2)] for x, z, sz in MAP['trees']]
routes = dict(A30=[P(x, z, 1) for x, z in ROUTES['A30']], loop=[P(x, z, 1) for x, z in ROUTES['TOUR']],
              gate=P(*ROUTES['gate']), inner=P(*ROUTES['inner']))
pts2 = lambda arr: [P(x, z, 1) for x, z in arr]
furn = dict(
    lamps=pts2(F['lamps']), bollards=pts2(F['bollards']),
    zebras=[[*P(x, z, 1), round(ang_new(a), 4)] for x, z, a in F['zebras']],
    dashes=[[*P(x, z, 2), round(ang_new(a), 4)] for x, z, a in F['dashes']],
    yellow=[[c for k in range(0, len(l) - 1, 2) for c in P(l[k], l[k + 1], 2)] for l in F['yellow']],
    barriers=[[*P(b[0], b[1], 1), round(ang_new(b[2]), 4), round(b[3] * s, 2)] for b in F['barriers']],
    gazebos=pts2([g[:2] for g in F['gazebos']]),
    a30wall=[pts2(run) for run in F['a30wall']],
    rounds=[[*P(x, z, 1), round(r * s, 1)] for x, z, r in F['rounds']])
# features hand-placed in the original project from the campus video (old metres, heading in radians)
extras = dict(lodge2=[*P(-432, 144, 1), round(ang_new(0.614), 4)], tennis=[*P(-322, 172, 1), round(ang_new(0.1), 4)],
              note='Second lodge and tennis courts as placed in the original project from the campus video; not independently verified.')
places = []
for pid, name, x, z, r in OLD_PLACES:
    nx, nz = old_to_new(x, z)
    places.append(dict(id=pid, name=name, x=round(nx, 1), z=round(nz, 1), r=round(r * s, 1)))

campus = dict(
    version=2, generated_by='rhul/tools/build_data.py',
    crs=dict(scene='x = Easting - %d, z = %d - Northing, y up; metres; OSGB36 British National Grid (EPSG:27700)' % (E0, N0),
             origin_bng=[E0, N0], origin_wgs84=[round(v, 6) for v in to_wgs.transform(E0, N0)[::-1]],
             fit=dict(method='least-squares similarity, old project frame -> BNG', scale=round(s, 5), rotation_deg=round(ROT_DEG, 3),
                      anchors=fit_report),
             note='Grid north is -z. True north differs from grid north by about 1.1 degrees here; the difference is ignored.'),
    grid=dict(GRID, cell_m=round(CELL_M, 4), classes={'0': 'outside campus', '1': 'lawn', '2': 'woodland', '3': 'road/car park',
                                                     '5': 'paving/hardstanding', '7': 'footpath'}),
    removed_map_symbols=removed_symbols,
    founders=dict(FOUNDERS, square=SQUARE), outline=outline, buildings=buildings_out, trees=trees, routes=routes, furniture=furn,
    places=places, roads=roads, paths=paths, road_edges=road_edges, extras=extras)
os.makedirs(OUT, exist_ok=True)
json.dump(campus, open(os.path.join(OUT, 'campus.json'), 'w'), separators=(',', ':'))
cv2.imwrite(os.path.join(OUT, 'landcover.png'), cls)
print('wrote campus.json (%.0f KB) and landcover.png' % (os.path.getsize(os.path.join(OUT, 'campus.json')) / 1024))
print('outline methods:', {m: sum(1 for b in buildings_out if b['outline'] == m) for m in {b['outline'] for b in buildings_out}})
print('removed map symbols at', removed_symbols)
