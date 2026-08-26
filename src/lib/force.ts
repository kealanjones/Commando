/**
 * The layout engine behind the Web view.
 *
 * Three arrangements of the same dots, and the move between them is the
 * argument:
 *
 *   filed    — five piles, the way the register is organised
 *   web      — released, so shared people pull sections together
 *   pressure — a scatter: quiet across, loaded up. Top right is trouble.
 *
 * Deliberately framework-free and DOM-free so it can be stepped in a test
 * without a browser.
 */
export type Layout = 'filed' | 'web' | 'pressure';

export interface SimInput {
  id: string;
  stream: string;
  /** Dot radius in world units. */
  r: number;
  /** 0–1, how long since it was touched. Drives the pressure X axis. */
  quiet: number;
  /** Open items. Drives the pressure Y axis. */
  open: number;
}

export interface SimNode extends SimInput {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Dragged somewhere on purpose: physics stops arguing with you. */
  pinned: boolean;
}

export interface SimEdge {
  a: string;
  b: string;
  weight: number;
}

export interface Transform {
  k: number;
  tx: number;
  ty: number;
}

/**
 * Where each stream parks when filed. ISODP and the Directorate carry most
 * of the sections between them, so they get the room.
 */
const HOME: Record<string, { x: number; y: number; r: number }> = {
  isodp:  { x: 0.29, y: 0.38, r: 0.30 },
  dir:    { x: 0.73, y: 0.40, r: 0.25 },
  cttl:   { x: 0.27, y: 0.83, r: 0.17 },
  per:    { x: 0.60, y: 0.86, r: 0.11 },
  career: { x: 0.86, y: 0.83, r: 0.08 },
};
const FALLBACK_HOME = { x: 0.5, y: 0.5, r: 0.3 };

/** Margins of the pressure scatter, as fractions of the stage. */
export const PLOT = { left: 0.16, right: 0.94, top: 0.18, bottom: 0.78 };

export class WebSim {
  nodes: SimNode[] = [];
  edges: SimEdge[] = [];
  layout: Layout = 'filed';
  /** 0–1 blend of the current layout, so a change is a move rather than a jump. */
  blend = 1;
  w = 0;
  h = 0;

  /** Rectangles the dots keep out of — the zoom controls sit over the canvas. */
  avoid: { x0: number; y0: number; x1: number; y1: number }[] = [];

  private byId = new Map<string, SimNode>();
  private homeIndex = new Map<string, number>();
  private maxOpen = 1;

  /**
   * Reconcile with new data. Existing dots keep their positions — a task
   * ticked off must not throw the whole map in the air.
   */
  sync(input: SimInput[], edges: SimEdge[]) {
    const next: SimNode[] = [];
    const seen = new Map<string, SimNode>();
    for (const n of input) {
      const old = this.byId.get(n.id);
      const node: SimNode = old
        ? { ...old, ...n }
        : { ...n, x: 0, y: 0, vx: 0, vy: 0, pinned: false };
      next.push(node);
      seen.set(n.id, node);
    }
    const fresh = next.filter((n) => !this.byId.has(n.id));
    this.nodes = next;
    this.byId = seen;
    this.edges = edges.filter((e) => seen.has(e.a) && seen.has(e.b));
    this.maxOpen = Math.max(1, ...next.map((n) => n.open));

    // Stream piles are ordered so the same section lands in the same place
    // every time — a map you cannot learn is not a map.
    this.homeIndex.clear();
    const per = new Map<string, number>();
    for (const n of this.nodes) {
      const k = (per.get(n.stream) ?? 0) + 1;
      per.set(n.stream, k);
      this.homeIndex.set(n.id, k);
    }

    if (this.w > 0) for (const n of fresh) this.seed(n);
  }

  resize(w: number, h: number) {
    const first = this.w === 0;
    const sx = first ? 1 : w / this.w;
    const sy = first ? 1 : h / this.h;
    this.w = w;
    this.h = h;
    if (first) {
      for (const n of this.nodes) this.seed(n);
    } else {
      for (const n of this.nodes) { n.x *= sx; n.y *= sy; }
    }
  }

  setLayout(l: Layout, animate = true) {
    if (l === this.layout) return;
    this.layout = l;
    this.blend = animate ? 0 : 1;
    // A pin is a statement about one arrangement, not all three.
    for (const n of this.nodes) n.pinned = false;
  }

  get(id: string) { return this.byId.get(id); }

  /** Where this node belongs in the current layout, in world coordinates. */
  anchor(n: SimNode): { x: number; y: number } | null {
    if (this.layout === 'web') return null;
    if (this.layout === 'pressure') {
      const x = PLOT.left + (PLOT.right - PLOT.left) * n.quiet;
      // Square-rooted so one enormous section does not flatten the rest.
      const load = Math.sqrt(n.open / this.maxOpen);
      const y = PLOT.bottom - (PLOT.bottom - PLOT.top) * load;
      return { x: x * this.w, y: y * this.h };
    }
    const home = HOME[n.stream] ?? FALLBACK_HOME;
    const k = this.homeIndex.get(n.id) ?? 1;
    const a = k * 2.399963;                       // golden angle: an even pile
    const d = home.r * Math.min(this.w, this.h) * 0.62 * Math.sqrt(k / 6);
    return { x: home.x * this.w + Math.cos(a) * d, y: home.y * this.h + Math.sin(a) * d };
  }

  private seed(n: SimNode) {
    const filed = this.layout;
    this.layout = this.layout === 'web' ? 'filed' : this.layout;
    const a = this.anchor(n) ?? { x: this.w / 2, y: this.h / 2 };
    this.layout = filed;
    n.x = a.x;
    n.y = a.y;
    n.vx = 0;
    n.vy = 0;
  }

  /** One frame. Returns the remaining energy, so the caller can stop. */
  step(): number {
    const { w, h, nodes } = this;
    if (!w || !nodes.length) return 0;

    if (this.blend < 1) this.blend = Math.min(1, this.blend + 0.028);

    const S = Math.min(1, Math.min(w, h) / 560);
    const scatter = this.layout === 'pressure';
    // How strongly the current layout is imposed, eased in over the blend.
    const grip = this.layout === 'web' ? 0 : ease(this.blend);
    const spring = 0.019 * (1 - 0.92 * grip);
    const rep = (scatter ? 2600 : 8600) * S * S * (1 - 0.72 * grip);
    const pull = (scatter ? 0.075 : 0.055) * grip;
    const gravity = 0.0022 * (1 - grip);
    const cx = w / 2;
    const cy = h / 2;

    const fx = new Float64Array(nodes.length);
    const fy = new Float64Array(nodes.length);

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = ((i % 7) - 3) * 0.4; dy = ((j % 7) - 3) * 0.4; }
        const d = Math.sqrt(d2);
        const f = Math.min(rep / d2, 3.2);
        fx[i] -= (dx / d) * f; fy[i] -= (dy / d) * f;
        fx[j] += (dx / d) * f; fy[j] += (dy / d) * f;
      }
    }

    if (spring > 0.0005) {
      const index = new Map(nodes.map((n, i) => [n.id, i]));
      for (const e of this.edges) {
        const i = index.get(e.a)!;
        const j = index.get(e.b)!;
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.max(Math.hypot(dx, dy), 1);
        const rest = a.r + b.r + 64 * S - Math.min(40 * S, 14 * S * (e.weight - 1));
        const f = (d - rest) * spring * (0.7 + 0.3 * Math.min(e.weight, 4));
        fx[i] += (dx / d) * f; fy[i] += (dy / d) * f;
        fx[j] -= (dx / d) * f; fy[j] -= (dy / d) * f;
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (n.pinned) { n.vx = 0; n.vy = 0; continue; }

      if (pull > 0) {
        const a = this.anchor(n);
        if (a) { fx[i] += (a.x - n.x) * pull; fy[i] += (a.y - n.y) * pull; }
      }
      if (gravity > 0) {
        // Sections nobody else touches have nothing pulling them in.
        const g = gravity * (this.edges.some((e) => e.a === n.id || e.b === n.id) ? 1 : 2.4);
        fx[i] += (cx - n.x) * g;
        fy[i] += (cy - n.y) * g;
      }

      n.vx = (n.vx + fx[i]) * 0.82;
      n.vy = (n.vy + fy[i]) * 0.82;
      const sp = Math.hypot(n.vx, n.vy);
      if (sp > 9) { n.vx *= 9 / sp; n.vy *= 9 / sp; }
      n.x += n.vx;
      n.y += n.vy;
    }

    // Two relaxation passes keep the dots apart without the jitter a
    // stiffer collision force would produce.
    const gap = 7 * S;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.r + b.r + gap;
          const d = Math.hypot(dx, dy) || 0.01;
          if (d >= min) continue;
          const push = ((min - d) / d) * 0.5;
          if (!a.pinned) { a.x -= dx * push; a.y -= dy * push; }
          if (!b.pinned) { b.x += dx * push; b.y += dy * push; }
        }
      }
    }

    // In the scatter the dots stay inside the plot, so the axes and their
    // labels keep their margins.
    const pad = 10;
    const box = scatter
      ? { x0: PLOT.left * w, x1: PLOT.right * w, y0: PLOT.top * h, y1: PLOT.bottom * h }
      : { x0: pad, x1: w - pad, y0: pad, y1: h - pad };
    let energy = 0;
    for (const n of nodes) {
      n.x = Math.min(box.x1 - n.r, Math.max(box.x0 + n.r, n.x));
      n.y = Math.min(box.y1 - n.r, Math.max(box.y0 + n.r, n.y));
      for (const a of this.avoid) {
        if (n.x + n.r < a.x0 || n.x - n.r > a.x1 || n.y + n.r < a.y0 || n.y - n.r > a.y1) continue;
        // Out by whichever edge is nearest, so a dot slides rather than jumps.
        const left = n.x + n.r - a.x0;
        const up = n.y + n.r - a.y0;
        if (left < up) n.x = a.x0 - n.r; else n.y = a.y0 - n.r;
      }
      energy += Math.abs(n.vx) + Math.abs(n.vy);
    }
    return this.blend < 1 ? energy + 100 : energy;
  }

  /** Run to rest without painting — for reduced motion, and for tests. */
  settle(frames = 260) {
    this.blend = 1;
    for (let i = 0; i < frames; i++) this.step();
  }

  /** Topmost dot under a world-space point, if any. */
  hit(x: number, y: number, slack = 6): SimNode | null {
    let best: SimNode | null = null;
    let bd = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < n.r + slack && d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /** Nearest dot in a compass direction, for arrow-key navigation. */
  nearest(from: SimNode, dir: 'up' | 'down' | 'left' | 'right'): SimNode | null {
    const want = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
    let best: SimNode | null = null;
    let bs = Infinity;
    for (const n of this.nodes) {
      if (n === from) continue;
      const dx = n.x - from.x;
      const dy = n.y - from.y;
      const d = Math.hypot(dx, dy) || 1;
      const along = (dx / d) * want[0] + (dy / d) * want[1];
      if (along < 0.35) continue;                 // behind, or too far off the beam
      const score = d / (0.25 + along);
      if (score < bs) { bs = score; best = n; }
    }
    return best;
  }
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** A transform that brings every dot into view with a little air around it. */
export function fitTransform(nodes: SimNode[], w: number, h: number, pad = 26): Transform {
  if (!nodes.length || !w) return { k: 1, tx: 0, ty: 0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of nodes) {
    x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r);
    x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r);
  }
  const k = Math.min(3, Math.max(0.4, Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0))));
  return { k, tx: w / 2 - ((x0 + x1) / 2) * k, ty: h / 2 - ((y0 + y1) / 2) * k };
}

export const toWorld = (t: Transform, x: number, y: number) => ({
  x: (x - t.tx) / t.k,
  y: (y - t.ty) / t.k,
});

export const clampZoom = (k: number) => Math.min(4, Math.max(0.45, k));
