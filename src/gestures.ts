import type { Hand, Gesture, GestureFrame, Point, Transform } from "./types";
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function mirrorPoint(p: [number, number]): [number, number] {
  return [1 - p[0], p[1]];
}
export function cameraToViewport(
  p: [number, number],
  vw: number,
  vh: number,
  cw: number,
  ch: number,
): [number, number] {
  const s = Math.max(cw / vw, ch / vh),
    ox = (vw * s - cw) / 2,
    oy = (vh * s - ch) / 2;
  return [((1 - p[0]) * vw * s - ox) / cw, (p[1] * vh * s - oy) / ch];
}
export function pose(hand: Hand) {
  const l = hand.landmarks,
    w = Math.max(dist(l[5], l[17]), 0.0001);
  const extended = (m: number, p: number, t: number) => {
    const a = l[m],
      b = l[p],
      c = l[t];
    const dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
    return (
      dist(c, l[0]) > dist(b, l[0]) * 1.07 &&
      dot / Math.max(dist(a, b) * dist(c, b), 1e-8) < -0.48
    );
  };
  const f = [
    extended(5, 6, 8),
    extended(9, 10, 12),
    extended(13, 14, 16),
    extended(17, 18, 20),
  ];
  const palm = { x: 0, y: 0, z: 0 };
  for (const i of [0, 5, 9, 13, 17]) {
    palm.x += l[i].x / 5;
    palm.y += l[i].y / 5;
  }
  const fist =
    dist(l[4], palm) < w * 0.9 &&
    [
      [6, 8],
      [10, 12],
      [14, 16],
      [18, 20],
    ].every(([p, t]) => dist(l[t], l[0]) <= dist(l[p], l[0]) * 1.12);
  return {
    fist,
    palm,
    pinch: dist(l[4], l[8]) / w,
    open: f.every(Boolean),
    v: f[0] && f[1] && !f[2] && !f[3],
    point: f[0] && !f[1] && !f[2] && !f[3],
  };
}
class LandmarkFilter {
  raw: Point[] | null = null;
  filtered: Point[] | null = null;
  derivative: Point[] = [];
  time = 0;
  update(points: Point[], timestamp: number) {
    if (this.raw) {
      const jumps = points.map((p, i) => dist(p, this.raw![i]));
      const outliers = jumps.filter((j) => j > 0.25).length;
      if (outliers > 0 && outliers <= 4)
        points = points.map((p, i) => (jumps[i] > 0.25 ? this.raw![i] : p));
      else if ([...jumps].sort((a, b) => a - b)[10] > 0.25) {
        this.raw = null;
        this.filtered = null;
      }
    }
    if (!this.raw) {
      this.raw = points.map((p) => ({ ...p }));
      this.filtered = points.map((p) => ({ ...p }));
      this.derivative = points.map(() => ({ x: 0, y: 0, z: 0 }));
      this.time = timestamp;
      return this.filtered;
    }
    const dt = Math.max((timestamp - this.time) / 1000, 0.0001),
      alpha = (cutoff: number) =>
        1 / (1 + 1 / (2 * Math.PI * Math.max(cutoff, 0.000001) * dt)),
      da = alpha(1);
    const filtered = points.map((p, i) => {
      const result = { x: 0, y: 0, z: 0 };
      for (const axis of ["x", "y", "z"] as const) {
        const d = (p[axis] - this.raw![i][axis]) / dt;
        this.derivative[i][axis] = da * d + (1 - da) * this.derivative[i][axis];
        const a = alpha(1.35 + 0.045 * Math.abs(this.derivative[i][axis]));
        result[axis] = a * p[axis] + (1 - a) * this.filtered![i][axis];
      }
      return result;
    });
    this.raw = points.map((p) => ({ ...p }));
    this.filtered = filtered;
    this.time = timestamp;
    return filtered;
  }
}
export class Recognizer {
  private stable: Gesture = "NONE";
  private candidate: Gesture = "NONE";
  private since = 0;
  private count = 0;
  private pinched = false;
  private filters = new Map<string, LandmarkFilter>();
  private last = 0;
  reset() {
    this.stable = "NONE";
    this.candidate = "NONE";
    this.count = 0;
    this.pinched = false;
    this.filters.clear();
  }
  update(raw: Hand[], timestamp: number): GestureFrame {
    if (timestamp - this.last > 350) this.reset();
    this.last = timestamp;
    const hands = raw
      .filter(
        (h) =>
          h.confidence >= 0.6 &&
          h.landmarks.length === 21 &&
          h.landmarks.every((p) => Number.isFinite(p.x + p.y + p.z)),
      )
      .map((h) => {
        const filter = this.filters.get(h.handedness) ?? new LandmarkFilter();
        this.filters.set(h.handedness, filter);
        return { ...h, landmarks: filter.update(h.landmarks, timestamp) };
      });
    for (const key of this.filters.keys())
      if (!hands.some((h) => h.handedness === key)) this.filters.delete(key);
    if (!hands.length) {
      this.reset();
      return {
        gesture: "NONE",
        pointer: null,
        palm: null,
        distance: null,
        pinch: false,
        timestamp,
      };
    }
    const hand = hands.find((h) => h.handedness === "Right") ?? hands[0],
      p = pose(hand);
    let rawGesture: Gesture = "NONE",
      distance: number | null = null;
    if (hands.some((h) => pose(h).fist)) {
      rawGesture = "FIST";
      this.pinched = false;
    } else if (hands.length >= 2) {
      rawGesture = "TWO_HANDS";
      distance = dist(hands[0].landmarks[8], hands[1].landmarks[8]);
      this.pinched = false;
    } else {
      this.pinched = p.pinch < (this.pinched ? 0.56 : 0.4);
      rawGesture = this.pinched
        ? "PINCH"
        : p.open
          ? "OPEN_PALM"
          : p.v
            ? "V_SIGN"
            : p.point
              ? "POINT"
              : "NONE";
    }
    if (rawGesture !== this.candidate) {
      this.candidate = rawGesture;
      this.since = timestamp;
      this.count = 1;
    } else this.count++;
    if (this.count >= 3 && timestamp - this.since >= 80)
      this.stable = rawGesture;
    return {
      gesture: this.stable,
      pointer: mirrorPoint([hand.landmarks[8].x, hand.landmarks[8].y]),
      palm: mirrorPoint([p.palm.x, p.palm.y]),
      distance,
      pinch: this.pinched && this.stable === "PINCH",
      timestamp,
    };
  }
}
export class Interaction {
  transform: Transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
  target: Transform = structuredClone(this.transform);
  paused = false;
  selected: string | null = null;
  hovered: string | null = null;
  progress = 0;
  gesture: Gesture = "NONE";
  private operation: Gesture = "NONE";
  private anchor: [number, number] | number | null = null;
  private start: Transform = structuredClone(this.transform);
  private pinchSince: number | null = null;
  private pinchFrames = 0;
  private pinchTarget: string | null = null;
  private consumed = false;
  private stopSince: number | null = null;
  private stopFrames = 0;
  private resumeSince: number | null = null;
  private hoverCandidate: string | null = null;
  private hoverSince = 0;
  private hoverFrames = 0;
  reset() {
    if (this.paused) return;
    this.transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 };
    this.target = structuredClone(this.transform);
    this.anchor = null;
    this.operation = "NONE";
    this.selected = null;
    this.hovered = null;
    this.progress = 0;
  }
  freeze() {
    this.target = structuredClone(this.transform);
    this.anchor = null;
    this.operation = "NONE";
  }
  stop() {
    this.paused = true;
    this.freeze();
    this.hovered = null;
    this.pinchSince = null;
    this.progress = 0;
  }
  resume() {
    this.paused = false;
    this.freeze();
    this.resumeSince = null;
  }
  lost() {
    this.freeze();
    this.hovered = null;
    this.hoverCandidate = null;
    this.pinchSince = null;
    this.stopSince = null;
    this.resumeSince = null;
    this.consumed = false;
    this.progress = 0;
    this.gesture = "NONE";
  }
  update(f: GestureFrame, hit: string | null) {
    const t = f.timestamp;
    this.gesture = f.gesture;
    if (!f.pointer) {
      this.lost();
      return;
    }
    if (f.gesture === "FIST") {
      this.freeze();
      if (this.stopSince === null) {
        this.stopSince = t;
        this.stopFrames = 0;
      }
      this.stopFrames++;
      if (t - this.stopSince >= 450 && this.stopFrames >= 4) this.stop();
    } else {
      this.stopSince = null;
      this.stopFrames = 0;
    }
    if (this.paused) {
      if (f.gesture === "OPEN_PALM") {
        if (this.resumeSince === null) this.resumeSince = t;
        else if (t - this.resumeSince >= 450) this.resume();
      } else this.resumeSince = null;
      return;
    }
    const candidate = ["POINT", "PINCH"].includes(f.gesture) ? hit : null;
    if (candidate !== this.hoverCandidate) {
      this.hoverCandidate = candidate;
      this.hoverSince = t;
      this.hoverFrames = 1;
    } else this.hoverFrames++;
    if (
      this.hoverFrames >= 2 &&
      t - this.hoverSince >= (candidate ? (this.hovered ? 140 : 120) : 100)
    )
      this.hovered = candidate;
    if (f.pinch) {
      this.freeze();
      if (this.consumed) return;
      if (this.pinchSince === null || this.pinchTarget !== hit) {
        this.pinchSince = t;
        this.pinchTarget = hit;
        this.pinchFrames = 0;
      }
      this.pinchFrames++;
      this.progress = clamp((t - this.pinchSince) / 280, 0, 1);
      if (this.progress === 1 && this.pinchFrames >= 3) {
        this.selected = hit;
        this.consumed = true;
      }
      return;
    }
    this.pinchSince = null;
    this.consumed = false;
    this.progress = 0;
    const g = f.gesture;
    if (!["OPEN_PALM", "V_SIGN", "TWO_HANDS"].includes(g)) {
      this.freeze();
      return;
    }
    const value =
      g === "TWO_HANDS" ? f.distance : g === "OPEN_PALM" ? f.palm : f.pointer;
    if (value === null) return;
    if (this.operation !== g || this.anchor === null) {
      this.operation = g;
      this.anchor = value;
      this.start = structuredClone(this.target);
      return;
    }
    const dead = (n: number, d: number) =>
      Math.sign(n) * Math.max(Math.abs(n) - d, 0);
    if (g === "TWO_HANDS") {
      this.target.scale = clamp(
        this.start.scale *
          (1 +
            dead(
              (value as number) / Math.max(this.anchor as number, 0.0001) - 1,
              0.015,
            )),
        0.3,
        3,
      );
    } else {
      const a = this.anchor as [number, number],
        v = value as [number, number],
        dx = dead(v[0] - a[0], g === "OPEN_PALM" ? 0.008 : 0.003),
        dy = dead(v[1] - a[1], g === "OPEN_PALM" ? 0.008 : 0.003);
      if (g === "OPEN_PALM") {
        this.target.position = [
          clamp(this.start.position[0] + dx * 2.25, -1.25, 1.25),
          clamp(this.start.position[1] - dy * 2.25, -0.82, 0.82),
          0,
        ];
      } else
        this.target.rotation = [
          this.start.rotation[0] + dy * 230,
          this.start.rotation[1] + dx * 230,
          0,
        ];
    }
  }
  advance(dt: number) {
    if (this.paused) return;
    const a = (r: number) => 1 - Math.exp(-Math.min(dt, 0.05) / r);
    for (let i = 0; i < 3; i++) {
      this.transform.position[i] +=
        (this.target.position[i] - this.transform.position[i]) * a(0.075);
      this.transform.rotation[i] +=
        (this.target.rotation[i] - this.transform.rotation[i]) * a(0.06);
    }
    this.transform.scale +=
      (this.target.scale - this.transform.scale) * a(0.075);
  }
}
