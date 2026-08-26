/**
 * Painting the Web.
 *
 * Everything on screen carries a reading:
 *
 *   size    open items plus what you are keeping tabs on
 *   colour  the stream it is filed under
 *   fade    days since you last touched it — the register goes pale
 *           exactly where you have stopped looking
 *   arc     how much of it is finished
 *   dot     items that are pressing: flagged, or a date already gone
 *   line    dashed = a person named in both; solid = a thread you drew
 *
 * Colours are read from tokens.css at runtime so this file never becomes a
 * second, drifting copy of the palette.
 */
import type { SimNode, WebSim, Transform, Layout } from './force';
import { PLOT } from './force';

export interface PaintNode extends SimNode {
  label: string;
  monitor: boolean;
  /** Items being kept tabs on — counted in the dot's number, not its size. */
  watch: number;
  /** Whether anything joins it to another section. */
  linked: boolean;
  progress: number;
  pressing: number;
  quietDays: number | null;
}

interface Box {
  id: string;
  x0: number; y0: number; x1: number; y1: number;
  lx: number; ly: number;
  text?: boolean;
}

export interface PaintEdge {
  a: string;
  b: string;
  people: number;
  threads: number;
  weight: number;
}

export interface PaintState {
  hover: string | null;
  selected: string | null;
  /** Section ids to keep lit; everything else is ghosted. null = no filter. */
  litNodes: Set<string> | null;
  /** Edge keys ("a|b") to keep lit under a filter. */
  litEdges: Set<string> | null;
  labelAll: boolean;
}

export interface Palette {
  ink: string;
  ink2: string;
  ink3: string;
  hair: string;
  card: string;
  danger: string;
  stream: Record<string, { base: string; tint: string; deep: string }>;
}

const STREAM_IDS = ['cttl', 'isodp', 'dir', 'career', 'per'];

export function readPalette(root: HTMLElement = document.documentElement): Palette {
  const cs = getComputedStyle(root);
  const v = (name: string, fallback: string) => (cs.getPropertyValue(name).trim() || fallback);
  const stream: Palette['stream'] = {};
  for (const id of STREAM_IDS) {
    stream[id] = {
      base: v(`--${id}`, '#9AA0B0'),
      tint: v(`--${id}-tint`, '#EDEFF6'),
      deep: v(`--${id}-deep`, '#5E6473'),
    };
  }
  return {
    ink: v('--ink', '#16181F'),
    ink2: v('--ink-2', '#5E6473'),
    ink3: v('--ink-3', '#9AA0B0'),
    hair: v('--hair', '#E4E7F0'),
    card: v('--card', '#FFFFFF'),
    danger: v('--danger', '#D6455F'),
    stream,
  };
}

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full || '888888', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Toward white by t. Used for the fade that marks a section going quiet. */
const pale = (hex: string, t: number) => {
  const [r, g, b] = rgb(hex);
  const m = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
};

const alpha = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface PaintArgs {
  ctx: CanvasRenderingContext2D;
  sim: WebSim;
  view: Transform;
  nodes: Map<string, PaintNode>;
  edges: PaintEdge[];
  state: PaintState;
  palette: Palette;
  layout: Layout;
  width: number;
  height: number;
  /** 0–1 how far the last quiet band reaches, for the pressure backdrop. */
  quietScaleDays: number;
}

export function paint(args: PaintArgs) {
  const { ctx, sim, view, nodes, edges, state, palette: P, layout, width, height } = args;

  // The caller leaves the device-pixel-ratio transform in place, so this
  // whole function works in CSS pixels.
  ctx.clearRect(0, 0, width, height);

  const reserved = layout === 'pressure' ? backdrop(args) : [];

  ctx.save();
  ctx.translate(view.tx, view.ty);
  ctx.scale(view.k, view.k);

  // ── links ───────────────────────────────────────────────────────
  // Not in the scatter: there the position carries the meaning, and the
  // lines only get in its way.
  ctx.lineCap = 'round';
  for (const e of layout === 'pressure' ? [] : edges) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) continue;

    const key = edgeKey(e.a, e.b);
    const touching = state.hover
      ? e.a === state.hover || e.b === state.hover
      : state.selected
        ? e.a === state.selected || e.b === state.selected
        : null;
    const filtered = state.litEdges ? state.litEdges.has(key) : null;
    const lit = filtered === null ? touching : filtered && touching !== false;
    const on = lit === true;
    const off = lit === false;

    ctx.globalAlpha = on ? 0.95 : off ? 0.05 : 0.32;
    ctx.lineWidth = (on ? 2.2 : 1.2) / view.k * Math.min(2, view.k) * (e.weight > 2 ? 1.4 : 1);

    if (e.threads > 0) {
      // You drew this one. Solid, and in ink rather than a stream colour.
      ctx.setLineDash([]);
      ctx.strokeStyle = on ? P.ink : alpha(P.ink, 0.5);
      ctx.lineWidth *= 1.35;
    } else {
      ctx.setLineDash([5 / view.k, 5 / view.k]);
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, P.stream[a.stream]?.base ?? P.ink3);
      g.addColorStop(1, P.stream[b.stream]?.base ?? P.ink3);
      ctx.strokeStyle = on ? g : alpha(P.ink3, 0.85);
    }

    // A shallow bow stops parallel links stacking into one thick smudge.
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx + (nx / len) * 12, my + (ny / len) * 12, b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // ── dots ────────────────────────────────────────────────────────
  const labels: { n: PaintNode; live: boolean }[] = [];
  for (const n of sim.nodes) {
    const d = nodes.get(n.id);
    if (!d) continue;
    const c = P.stream[n.stream] ?? { base: P.ink3, tint: P.hair, deep: P.ink2 };
    const ghost = state.litNodes ? !state.litNodes.has(n.id) : false;
    const live = n.id === state.hover || n.id === state.selected
      || (state.litNodes?.has(n.id) ?? false);

    ctx.globalAlpha = ghost ? 0.18 : 1;

    if (live && !ghost) {
      ctx.save();
      ctx.shadowColor = alpha(P.ink, 0.22);
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 5;
    }
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    // The fade: full tint when touched today, white after three weeks.
    ctx.fillStyle = d.monitor ? P.card : pale(c.tint, quietFade(d.quietDays, args.quietScaleDays));
    ctx.fill();
    if (live && !ghost) ctx.restore();

    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.strokeStyle = pale(c.base, quietFade(d.quietDays, args.quietScaleDays) * 0.55);
    ctx.lineWidth = live ? 3.4 : 2;
    ctx.setLineDash(d.monitor ? [4, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    // Progress rides the ring: a section closing out fills up clockwise.
    if (d.progress > 0.001) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * d.progress);
      ctx.strokeStyle = c.deep;
      ctx.lineWidth = live ? 3.6 : 2.6;
      ctx.stroke();
    }

    if (d.pressing > 0 && !ghost) {
      const a = -Math.PI / 4;
      ctx.beginPath();
      ctx.arc(n.x + Math.cos(a) * n.r, n.y + Math.sin(a) * n.r, Math.min(5.5, 3 + n.r * 0.1), 0, Math.PI * 2);
      ctx.fillStyle = P.danger;
      ctx.fill();
      ctx.strokeStyle = P.card;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    if (n.pinned && !ghost) {
      ctx.beginPath();
      ctx.arc(n.x - n.r * 0.72, n.y - n.r * 0.72, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = P.ink;
      ctx.fill();
    }

    if (n.r * view.k >= 19 && !ghost) {
      ctx.fillStyle = c.deep;
      ctx.font = `500 ${Math.round(n.r * 0.62)}px "DM Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(d.open + d.watch), n.x, n.y + 0.5);
    }

    ctx.globalAlpha = 1;
    if (!ghost) labels.push({ n: d, live });
  }
  ctx.restore();

  drawLabels(args, labels, reserved);
}

/** 0 = touched today, 1 = silent past the scale. */
const quietFade = (days: number | null, scale: number) =>
  days === null ? 0 : Math.min(1, days / scale) * 0.86;

// ── labels, drawn unscaled so they stay readable at any zoom ───────
function drawLabels(args: PaintArgs, labels: { n: PaintNode; live: boolean }[], reserved: Box[]) {
  const { ctx, view, state, palette: P, width: W, height: H } = args;

  // A phone-sized stage cannot carry as many names as a desktop one, so the
  // bar for earning a label is higher until you zoom in.
  const narrow = W < 520;
  const threshold = state.labelAll || view.k >= 1.7
    ? -1
    : view.k >= 1.05 ? (narrow ? 8 : 5) : (narrow ? 13 : 8);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  labels.sort((a, b) => Number(b.live) - Number(a.live) || b.n.open + b.n.r - (a.n.open + a.n.r));

  
  // The zoom buttons and the zoom readout sit over the canvas; a name
  // sliding under them is a name you cannot read.
  const taken: Box[] = [
    ...reserved,
    { id: '', text: true, x0: W - 152, y0: H - 54, x1: W, y1: H, lx: 0, ly: 0 },
    { id: '', text: true, x0: 0, y0: H - 40, x1: 96, y1: H, lx: 0, ly: 0 },
  ];
  taken.push(...labels.map(({ n }) => {
    const r = n.r * view.k;
    const x = n.x * view.k + view.tx;
    const y = n.y * view.k + view.ty;
    return { id: n.id, x0: x - r, y0: y - r, x1: x + r, y1: y + r, lx: x, ly: y };
  }));
  const overlaps = (a: Box, b: Box) =>
    b.id !== a.id && a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

  for (const { n, live } of labels) {
    // A section with no links is the point of the connected view, so it is
    // named even when it is too small to earn a label on size.
    const worthNaming = live
      || (args.layout === 'web' && !n.linked && (!narrow || n.open + n.watch >= 6))
      || n.open + n.watch >= threshold;
    if (!worthNaming) continue;
    ctx.font = live
      ? '500 12.5px "DM Mono", ui-monospace, monospace'
      : '400 11.5px "DM Mono", ui-monospace, monospace';
    const text = n.label;
    const w = ctx.measureText(text).width;
    const h = live ? 15 : 14;
    const r = n.r * view.k;
    const cx = n.x * view.k + view.tx;
    const cy = n.y * view.k + view.ty;

    const spots: [number, number][] = [
      [cx, cy + r + 6],
      [cx, cy - r - h - 5],
      [cx + r + 7 + w / 2, cy - h / 2],
      [cx - r - 7 - w / 2, cy - h / 2],
    ];

    let box: Box | null = null;
    for (const pass of live ? [0, 1] : [0]) {
      for (const [lx, ly] of spots) {
        const b: Box = { id: n.id, text: true, x0: lx - w / 2 - 3, y0: ly - 2, x1: lx + w / 2 + 3, y1: ly + h, lx, ly };
        if (b.x0 < 2 || b.x1 > W - 2 || b.y0 < 2 || b.y1 > H - 2) continue;
        // Second pass, for a highlighted dot only: a name may sit over a
        // circle, but never over another name.
        const blocked = taken.some((t) => (pass === 1 ? t.text === true : true) && overlaps(b, t));
        if (!blocked) { box = b; break; }
      }
      if (box) break;
    }
    if (!box) {
      if (!live) continue;
      box = { id: n.id, text: true, x0: cx - w / 2, y0: cy + r + 4, x1: cx + w / 2, y1: cy + r + 18, lx: cx, ly: cy + r + 6 };
    }
    taken.push(box);

    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = alpha(P.card, 0.94);
    ctx.strokeText(text, box.lx, box.ly);
    ctx.fillStyle = live ? P.ink : P.ink2;
    ctx.fillText(text, box.lx, box.ly);
  }
}

// ── the pressure backdrop ──────────────────────────────────────────
function backdrop({ ctx, palette: P, width: W, height: H }: PaintArgs): Box[] {
  const x0 = PLOT.left * W;
  const x1 = PLOT.right * W;
  const y0 = PLOT.top * H;
  const y1 = PLOT.bottom * H;
  const pad = 16;

  // Quiet and loaded: the corner to look at first.
  const gx = x0 + (x1 - x0) * 0.5;
  ctx.fillStyle = alpha(P.danger, 0.05);
  ctx.fillRect(gx, y0 - pad, x1 - gx + pad, (y1 - y0) * 0.55 + pad);

  ctx.strokeStyle = P.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0 - pad, y1 + pad);
  ctx.lineTo(x1 + pad, y1 + pad);
  ctx.moveTo(x0 - pad, y0 - pad);
  ctx.lineTo(x0 - pad, y1 + pad);
  ctx.stroke();

  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = alpha(P.ink3, 0.45);
  ctx.beginPath();
  ctx.moveTo(gx, y0 - pad);
  ctx.lineTo(gx, y1 + pad);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textBaseline = 'alphabetic';
  ctx.font = '400 10.5px "DM Mono", ui-monospace, monospace';
  ctx.fillStyle = P.ink3;

  const boxes: Box[] = [];
  const write = (text: string, x: number, y: number, align: 'left' | 'right') => {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    const w = ctx.measureText(text).width;
    boxes.push({
      id: '', text: true,
      x0: align === 'left' ? x - 4 : x - w - 4, y0: y - 13,
      x1: align === 'left' ? x + w + 4 : x + 4, y1: y + 5,
      lx: 0, ly: 0,
    });
  };

  write('open items ↑', x0 - pad, y0 - pad - 9, 'left');
  write('touched today', x0 - pad, y1 + pad + 18, 'left');
  write('three weeks quiet →', x1 + pad, y1 + pad + 18, 'right');

  ctx.font = '500 11px "DM Mono", ui-monospace, monospace';
  ctx.fillStyle = alpha(P.danger, 0.85);
  write('quiet and loaded', x1 + pad, y0 - pad - 9, 'right');

  return boxes;
}
