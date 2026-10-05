/**
 * A receipt drawn onto a canvas, for sharing as a picture. Browser only.
 */
import { code39, code39Width, type Receipt } from './receipt';

const W = 360;
const PAD = 22;
const FONT = "'Courier Prime', 'Geist Mono', ui-monospace, Menlo, monospace";

/** Breaks `text` into lines no wider than `max` pixels. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= max || !line) line = next;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out.slice(0, 2);
}

export function drawReceipt(r: Receipt, label: string): HTMLCanvasElement {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  // Measure first on a scratch context, then draw at the right height.
  const scratch = document.createElement('canvas').getContext('2d')!;
  scratch.font = `13px ${FONT}`;
  const body = W - PAD * 2;
  const rows: { h: number; draw: (ctx: CanvasRenderingContext2D, y: number) => void }[] = [];
  const text = (t: string, opts: { size?: number; bold?: boolean; align?: CanvasTextAlign; color?: string; italic?: boolean; gap?: number } = {}) => {
    const size = opts.size ?? 13;
    rows.push({
      h: size * 1.45 + (opts.gap ?? 0),
      draw: (ctx, y) => {
        ctx.font = `${opts.italic ? 'italic ' : ''}${opts.bold ? 'bold ' : ''}${size}px ${FONT}`;
        ctx.fillStyle = opts.color ?? '#1a1a1a';
        ctx.textAlign = opts.align ?? 'left';
        const x = opts.align === 'center' ? W / 2 : opts.align === 'right' ? W - PAD : PAD;
        ctx.fillText(t, x, y + size);
      },
    });
  };
  const rule = () => rows.push({
    h: 18,
    draw: (ctx, y) => {
      ctx.strokeStyle = '#9a9a9a'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(PAD, y + 9); ctx.lineTo(W - PAD, y + 9); ctx.stroke(); ctx.setLineDash([]);
    },
  });
  const pair = (k: string, v: string, bold = false) => rows.push({
    h: 20,
    draw: (ctx, y) => {
      ctx.font = `${bold ? 'bold 15px' : '13px'} ${FONT}`; ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'left'; ctx.fillText(k, PAD, y + 14);
      ctx.textAlign = 'right'; ctx.fillText(v, W - PAD, y + 14);
    },
  });

  rows.push({ h: 26, draw: () => {} });
  text('CHECK-OUT', { size: 16, bold: true, align: 'center' });
  text(label, { size: 11, align: 'center', color: '#555' });
  rule();
  if (!r.lines.length) text('No items.', { align: 'center', color: '#666' });
  for (const l of r.lines) {
    const title = l.kind === 'done' ? l.title : `${l.kind === 'void' ? 'VOID' : 'RETURNED'}  ${l.title}`;
    const lines = wrap(scratch, title, body - 42 - 50);
    rows.push({
      h: lines.length * 17 + 4,
      draw: (ctx, y) => {
        ctx.font = `11.5px ${FONT}`; ctx.fillStyle = '#666'; ctx.textAlign = 'left';
        ctx.fillText(l.time, PAD, y + 13);
        ctx.font = `${l.kind === 'done' ? '' : 'bold '}13px ${FONT}`; ctx.fillStyle = l.kind === 'done' ? '#1a1a1a' : '#8a1d17';
        lines.forEach((t, i) => ctx.fillText(t, PAD + 42, y + 13 + i * 17));
        ctx.font = `10.5px ${FONT}`; ctx.fillStyle = '#666'; ctx.textAlign = 'right';
        ctx.fillText(l.minutes ? `${l.code} ${l.minutes}m` : l.code, W - PAD, y + 13);
      },
    });
  }
  rule();
  pair('TOTAL DONE', String(r.total), true);
  if (r.minutes) pair('Time with things', `${r.minutes} min`);
  if (r.returned) pair('Returned', String(r.returned));
  if (r.voided) pair('Void', String(r.voided));
  if (r.first) pair('First tick', r.first);
  if (r.busiest) pair('Busiest hour', r.busiest);
  for (const s of r.subtotals) pair(`  ${s.code}`, String(s.n));
  text(r.verdict, { align: 'center', italic: true, gap: 10 });
  // Barcode of the day.
  rows.push({
    h: 56,
    draw: (ctx, y) => {
      const bars = code39(r.day);
      const unit = (W - PAD * 2 - 40) / code39Width(r.day);
      ctx.fillStyle = '#1a1a1a';
      for (const b of bars) ctx.fillRect(PAD + 20 + b.x * unit, y + 10, b.w * unit, 34);
    },
  });
  text(r.day, { size: 10, align: 'center', color: '#666' });
  text('THANK YOU. COME AGAIN TOMORROW.', { size: 10.5, align: 'center', color: '#666', gap: 8 });
  rows.push({ h: 22, draw: () => {} });

  const H = rows.reduce((h, r) => h + r.h, 0);
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  // Paper with a torn bottom edge.
  ctx.fillStyle = '#FBFAF6';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, H - 8);
  for (let x = W; x > 0; x -= 12) { ctx.lineTo(x - 6, H); ctx.lineTo(x - 12, H - 8); }
  ctx.closePath(); ctx.fill();
  ctx.textBaseline = 'alphabetic';
  let y = 0;
  for (const row of rows) { row.draw(ctx, y); y += row.h; }
  return canvas;
}

/** Hands the picture to the share sheet where there is one, else downloads it. */
export async function shareReceipt(canvas: HTMLCanvasElement, name: string): Promise<'shared' | 'saved' | 'cancelled' | 'failed'> {
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return 'failed';
  const file = new File([blob], `${name}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title: name }); return 'shared'; }
    catch (e) { return (e as Error).name === 'AbortError' ? 'cancelled' : 'failed'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.png`; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
