"""Helpers: fit native gradients to image regions and turn masks into smooth SVG paths."""
import numpy as np
from scipy import ndimage as ndi
from skimage import measure

def fit_linear(img, mask, nbins=8):
    """Linear gradient fitted to the pixels in `mask`: returns (p0, p1, stops, rmse) in image px."""
    ys, xs = np.nonzero(mask)
    C = img[ys, xs].astype(float)
    L = C @ [0.299, 0.587, 0.114]
    A = np.c_[np.ones_like(xs), xs, ys].astype(float)
    coef = np.linalg.lstsq(A, L, rcond=None)[0]
    d = coef[1:]
    if np.hypot(*d) < 1e-6:
        d = np.array([0.0, 1.0])
    d = d / np.hypot(*d)
    t = xs * d[0] + ys * d[1]
    t0, t1 = np.percentile(t, 1), np.percentile(t, 99)
    if t1 - t0 < 1:
        t1 = t0 + 1
    edges = np.linspace(t0, t1, nbins + 1)
    stops, pos = [], []
    for i in range(nbins):
        sel = (t >= edges[i]) & (t <= edges[i + 1])
        if sel.sum() < 3:
            continue
        stops.append(np.median(C[sel], 0))
        pos.append((i + 0.5) / nbins)
    pos = np.array(pos); stops = np.array(stops)
    tn = np.clip((t - t0) / (t1 - t0), 0, 1)
    pred = np.stack([np.interp(tn, pos, stops[:, c]) for c in range(3)], 1)
    rmse = float(np.sqrt(((pred - C) ** 2).mean()))
    cx = (xs.mean(), ys.mean())
    base = np.array(cx) - d * ((cx[0] * d[0] + cx[1] * d[1]) - t0)
    p0 = base
    p1 = base + d * (t1 - t0)
    return p0, p1, list(zip(pos.tolist(), stops.tolist())), rmse

def mask_paths(mask, tol=0.9, sig=1.0, minlen=12):
    """Smooth closed contours of a binary mask as lists of (x, y) points (image px)."""
    f = ndi.gaussian_filter(mask.astype(float), sig)
    out = []
    for c in measure.find_contours(np.pad(f, 1), 0.5):
        if len(c) < minlen:
            continue
        p = measure.approximate_polygon(c, tol)[:-1]
        if len(p) >= 4:
            out.append([(x - 1, y - 1) for y, x in p])
    return out

def catmull_d(polys, tx):
    """Closed Catmull-Rom curves -> SVG path data, points mapped through tx(x, y)."""
    parts = []
    for pts in polys:
        P = [tx(x, y) for x, y in pts]
        n = len(P)
        d = 'M %.1f %.1f ' % P[0]
        for i in range(n):
            p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % n], P[(i + 2) % n]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            d += 'C %.1f %.1f %.1f %.1f %.1f %.1f ' % (c1 + c2 + p2)
        parts.append(d + 'Z')
    return ' '.join(parts)

def hexc(c):
    c = np.clip(np.round(c), 0, 255).astype(int)
    return '#%02X%02X%02X' % tuple(c)

def _ramp(xs, ys, ang, vals, nbins=8):
    d = np.array([np.cos(ang), np.sin(ang)])
    t = xs * d[0] + ys * d[1]
    t0, t1 = np.percentile(t, 1), np.percentile(t, 99)
    if t1 - t0 < 1:
        t1 = t0 + 1
    tn = np.clip((t - t0) / (t1 - t0), 0, 1)
    edges = np.linspace(0, 1, nbins + 1)
    pos, a = [], []
    for i in range(nbins):
        sel = (tn >= edges[i]) & (tn <= edges[i + 1])
        if sel.sum() < 3:
            continue
        pos.append((i + 0.5) / nbins)
        a.append(float(np.median(vals[sel])))
    pos, a = np.array(pos), np.clip(np.array(a), 0, 1)
    pred = np.interp(tn, pos, a)
    cx, cy = xs.mean(), ys.mean()
    base = np.array([cx, cy]) - d * ((cx * d[0] + cy * d[1]) - t0)
    return pred, (base, base + d * (t1 - t0), list(zip(pos.tolist(), a.tolist())))

def fit_overlays(img, mask, base_pred, rounds=2):
    """Greedy dark/light alpha overlays on top of a base prediction.
    Returns list of overlays (kind, p0, p1, [(pos, alpha)]) and final prediction."""
    ys, xs = np.nonzero(mask)
    C = img[ys, xs].astype(float)
    pred = base_pred.copy()
    overlays = []
    for _ in range(rounds):
        for kind in ('dark', 'light'):
            Lr = C @ [0.299, 0.587, 0.114]
            Lp = pred @ [0.299, 0.587, 0.114]
            if kind == 'dark':
                need = np.where(Lr < Lp, 1 - Lr / np.maximum(Lp, 1), 0)
            else:
                need = np.where(Lr > Lp, (Lr - Lp) / np.maximum(255 - Lp, 1), 0)
            best = None
            for ang in np.deg2rad(np.arange(0, 360, 15)):
                a, spec = _ramp(xs, ys, ang, need)
                if kind == 'dark':
                    newp = pred * (1 - a[:, None])
                else:
                    newp = pred + (255 - pred) * a[:, None]
                err = ((newp - C) ** 2).mean()
                if best is None or err < best[0]:
                    best = (err, newp, spec)
            base_err = ((pred - C) ** 2).mean()
            if best[0] < base_err * 0.93:
                pred = best[1]
                overlays.append((kind,) + best[2])
    return overlays, pred, float(np.sqrt(((pred - C) ** 2).mean()))

def linear_pred(xs, ys, p0, p1, stops):
    d = np.array(p1) - np.array(p0)
    L2 = (d ** 2).sum()
    tn = np.clip(((xs - p0[0]) * d[0] + (ys - p0[1]) * d[1]) / L2, 0, 1)
    pos = np.array([p for p, _ in stops]); col = np.array([c for _, c in stops])
    return np.stack([np.interp(tn, pos, col[:, c]) for c in range(3)], 1)

def _radial(xs, ys, cx, cy, r, vals, nbins=8):
    dist = np.clip(np.hypot(xs - cx, ys - cy) / r, 0, 1)
    edges = np.linspace(0, 1, nbins + 1)
    pos, a = [], []
    for i in range(nbins):
        sel = (dist >= edges[i]) & (dist <= edges[i + 1])
        if sel.sum() < 3:
            continue
        pos.append((i + 0.5) / nbins); a.append(float(np.median(vals[sel])))
    if not pos:
        return None, None
    pos, a = np.array(pos), np.clip(np.array(a), 0, 1)
    # beyond the last sampled ring the overlay must fade to its last value
    return np.interp(dist, pos, a), (cx, cy, r, list(zip(pos.tolist(), a.tolist())))

def fit_overlays2(img, mask, base_pred, steps=4):
    """Greedy overlays choosing, each step, the best of linear/radial x dark/light."""
    ys, xs = np.nonzero(mask)
    C = img[ys, xs].astype(float)
    pred = base_pred.copy(); out = []
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    diag = np.hypot(x1 - x0, y1 - y0)
    cxs = np.linspace(x0 - 0.2 * (x1 - x0), x1 + 0.2 * (x1 - x0), 7)
    cys = np.linspace(y0 - 0.2 * (y1 - y0), y1 + 0.2 * (y1 - y0), 7)
    for _ in range(steps):
        Lr = C @ [0.299, 0.587, 0.114]; Lp = pred @ [0.299, 0.587, 0.114]
        needs = {'dark': np.where(Lr < Lp, 1 - Lr / np.maximum(Lp, 1), 0),
                 'light': np.where(Lr > Lp, (Lr - Lp) / np.maximum(255 - Lp, 1), 0)}
        best = None
        for kind, need in needs.items():
            def apply(a):
                return pred * (1 - a[:, None]) if kind == 'dark' else pred + (255 - pred) * a[:, None]
            for ang in np.deg2rad(np.arange(0, 360, 15)):
                a, spec = _ramp(xs, ys, ang, need)
                e = ((apply(a) - C) ** 2).mean()
                if best is None or e < best[0]:
                    best = (e, apply(a), (kind, 'linear') + spec)
            for cx in cxs:
                for cy in cys:
                    for rf in (0.35, 0.6, 0.9, 1.3):
                        a, spec = _radial(xs, ys, cx, cy, rf * diag, need)
                        if a is None:
                            continue
                        e = ((apply(a) - C) ** 2).mean()
                        if e < best[0]:
                            best = (e, apply(a), (kind, 'radial') + spec)
        if best[0] < ((pred - C) ** 2).mean() * 0.95:
            pred = best[1]; out.append(best[2])
        else:
            break
    return out, pred, float(np.sqrt(((pred - C) ** 2).mean()))
