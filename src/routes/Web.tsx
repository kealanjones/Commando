/**
 * The Web — the register drawn as a shape rather than a list.
 *
 * Two questions a list is bad at. What is actually connected to what: the
 * filing says Australia is Commonwealth business, the web says its nearest
 * neighbours are the Office and OrganOx, because the same two people are in
 * all of it. And what has gone quiet: sections fade as they go untouched,
 * so neglect is something you see rather than something you audit.
 *
 * Optional by design. Nothing else in the app depends on it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePeople, useSections, useStreams, useTasks } from '@/data/store';
import { useTaskPeople } from '@/data/review';
import { useThreadLinks, useThreads } from '@/data/threads';
import { buildGraph, QUIET_FULL_DAYS, type WebNode } from '@/lib/web';
import { clampZoom, fitTransform, toWorld, WebSim, type Layout, type Transform } from '@/lib/force';
import { paint, readPalette, type PaintEdge, type PaintNode, type Palette } from '@/lib/webPaint';
import type { StreamId, Task } from '@/lib/types';

type Focus = { kind: 'person' | 'thread'; id: string } | null;

const LAYOUTS: { id: Layout; label: string }[] = [
  { id: 'filed', label: 'As filed' },
  { id: 'web', label: 'As connected' },
  { id: 'pressure', label: 'Under pressure' },
];

const radiusOf = (total: number, scale: number) => (9 + 3.7 * Math.sqrt(total)) * (0.72 + 0.28 * scale);

export function Web({ onOpenTask }: { onOpenTask: (task: Task) => void }) {
  const { data: tasks = [] } = useTasks();
  const { data: sections = [] } = useSections();
  const { data: streams = [] } = useStreams();
  const { data: people = [] } = usePeople();
  const { data: taskPeople = [] } = useTaskPeople();
  const { data: threads = [] } = useThreads();
  const { data: threadLinks = [] } = useThreadLinks();

  const whole = useMemo(
    () => buildGraph({ tasks, sections, streams, people, taskPeople, threads, threadLinks }),
    [tasks, sections, streams, people, taskPeople, threads, threadLinks],
  );

  const [layout, setLayoutState] = useState<Layout>(() => remembered() ?? 'filed');
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Focus>(null);
  const [onlyStream, setOnlyStream] = useState<StreamId | null>(null);
  /** Highlighting a stream shows how it reaches out; soloing removes the rest. */
  const [solo, setSolo] = useState(false);
  const [zoom, setZoom] = useState(1);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<WebSim>();
  if (!simRef.current) simRef.current = new WebSim();
  const sim = simRef.current;

  const viewRef = useRef<Transform>({ k: 1, tx: 0, ty: 0 });
  const hoverRef = useRef<string | null>(null);
  const paletteRef = useRef<Palette | null>(null);
  const rafRef = useRef<number | null>(null);
  const calmRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  const reduced = usePrefersReducedMotion();

  // Soloing rebuilds the graph from that stream's sections alone, so the
  // connectors, the counts and the layout are all about the stream rather
  // than about the stream's corner of everything.
  const graph = useMemo(() => {
    if (!solo || !onlyStream) return whole;
    const mine = sections.filter((s) => s.stream_id === onlyStream);
    const ids = new Set(mine.map((s) => s.id));
    return buildGraph({
      tasks: tasks.filter((t) => ids.has(t.section_id)),
      sections: mine,
      streams: streams.filter((s) => s.id === onlyStream),
      people, taskPeople, threads, threadLinks,
    });
  }, [whole, solo, onlyStream, tasks, sections, streams, people, taskPeople, threads, threadLinks]);

  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const streamById = useMemo(() => new Map(streams.map((s) => [s.id, s])), [streams]);
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const threadById = useMemo(() => new Map(graph.threads.map((t) => [t.id, t])), [graph]);

  // What stays lit under the current filter. null means everything.
  const lit = useMemo(() => {
    if (focus) {
      const src = focus.kind === 'person'
        ? graph.connectors.find((c) => c.id === focus.id)?.sections
        : graph.threads.find((t) => t.id === focus.id)?.sections;
      const nodes = new Set(src ?? []);
      const edges = new Set(
        graph.edges
          .filter((e) => (focus.kind === 'person' ? e.people : e.threads).includes(focus.id))
          .map((e) => (e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`)),
      );
      return { nodes, edges };
    }
    if (onlyStream && !solo) {
      const nodes = new Set(graph.nodes.filter((n) => n.stream === onlyStream).map((n) => n.id));
      const edges = new Set(
        graph.edges
          .filter((e) => nodes.has(e.a) && nodes.has(e.b))
          .map((e) => (e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`)),
      );
      return { nodes, edges };
    }
    return null;
  }, [focus, onlyStream, solo, graph]);

  const linkedIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of graph.edges) { set.add(e.a); set.add(e.b); }
    return set;
  }, [graph]);

  const paintEdges: PaintEdge[] = useMemo(
    () => graph.edges.map((e) => ({
      a: e.a, b: e.b, people: e.people.length, threads: e.threads.length, weight: e.weight,
    })),
    [graph],
  );

  // ── drawing ───────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    if (!paletteRef.current) paletteRef.current = readPalette();
    const { w, h } = sizeRef.current;
    if (!w || !h) return;

    const nodes = new Map<string, PaintNode>();
    for (const n of sim.nodes) {
      const d = nodeById.get(n.id);
      if (!d) continue;
      nodes.set(n.id, {
        ...n,
        label: shortLabel(d.title),
        monitor: d.monitor,
        watch: d.watch,
        linked: linkedIds.has(n.id),
        progress: d.progress,
        pressing: d.pressing,
        quietDays: d.daysQuiet,
      });
    }

    paint({
      ctx,
      sim,
      view: viewRef.current,
      nodes,
      edges: paintEdges,
      state: {
        hover: hoverRef.current,
        selected,
        litNodes: lit?.nodes ?? null,
        litEdges: lit?.edges ?? null,
        labelAll: false,
      },
      palette: paletteRef.current,
      layout,
      width: w,
      height: h,
      quietScaleDays: QUIET_FULL_DAYS,
    });
  }, [sim, nodeById, linkedIds, paintEdges, selected, lit, layout]);

  // The running animation chain must always call the current painter: a
  // frame scheduled before a layout change would otherwise keep drawing the
  // old one until the simulation came to rest.
  const renderRef = useRef(render);
  renderRef.current = render;

  const loop = useCallback(() => {
    rafRef.current = null;
    const energy = sim.step();
    renderRef.current();
    calmRef.current = energy < 0.6 ? calmRef.current + 1 : 0;
    if (calmRef.current < 26) rafRef.current = requestAnimationFrame(loop);
  }, [sim]);

  const run = useCallback(() => {
    if (reduced) { sim.settle(220); renderRef.current(); return; }
    calmRef.current = 0;
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(loop);
  }, [reduced, sim, loop]);

  // ── sizing ────────────────────────────────────────────────────────
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const measure = () => {
      const r = stage.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (!w || !h) return;
      sizeRef.current = { w, h };
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sim.resize(w, h);
      // The zoom buttons float over the bottom-right corner.
      sim.avoid = [{ x0: w - 150, y0: h - 52, x1: w, y1: h }];
      run();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [sim, run]);

  // ── data into the simulation ──────────────────────────────────────
  useEffect(() => {
    const { w, h } = sizeRef.current;
    const scale = w && h ? Math.min(1, Math.min(w, h) / 560) : 1;
    sim.sync(
      graph.nodes.map((n) => ({
        id: n.id,
        stream: n.stream,
        r: radiusOf(n.total, scale),
        quiet: n.daysQuiet === null ? 0 : Math.min(1, n.daysQuiet / QUIET_FULL_DAYS),
        open: n.open,
      })),
      graph.edges.map((e) => ({ a: e.a, b: e.b, weight: e.weight })),
    );
    run();
  }, [graph, sim, run]);

  // A state change with no physics behind it still needs a frame.
  useEffect(() => { render(); }, [render]);

  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  const setLayout = useCallback((next: Layout) => {
    sim.setLayout(next, !reduced);
    viewRef.current = { k: 1, tx: 0, ty: 0 };
    setZoom(1);
    setLayoutState(next);
    remember(next);
    run();
  }, [sim, reduced, run]);

  // First ever visit: hold the filed arrangement for a beat, then let go.
  // Watching Australia leave the Commonwealth pile is the whole argument,
  // and it only needs making once.
  useEffect(() => {
    if (remembered()) return;
    if (reduced) { setLayout('web'); return; }
    const t = window.setTimeout(() => setLayout('web'), 1500);
    return () => window.clearTimeout(t);
    // Deliberately once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── pointer ───────────────────────────────────────────────────────
  const dragRef = useRef<{
    id: string | null; x: number; y: number; moved: number;
    startTx: number; startTy: number;
  } | null>(null);
  const pinchRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ d: number; k: number } | null>(null);

  const localPoint = (e: React.PointerEvent | React.MouseEvent | React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = localPoint(e);
    pinchRef.current.set(e.pointerId, p);
    if (pinchRef.current.size === 2) {
      const [a, b] = [...pinchRef.current.values()];
      pinchStart.current = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: viewRef.current.k };
      dragRef.current = null;
      return;
    }
    const world = toWorld(viewRef.current, p.x, p.y);
    const hit = sim.hit(world.x, world.y, 8 / viewRef.current.k);
    dragRef.current = {
      id: hit?.id ?? null,
      x: p.x, y: p.y, moved: 0,
      startTx: viewRef.current.tx, startTy: viewRef.current.ty,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = localPoint(e);
    if (pinchRef.current.has(e.pointerId)) pinchRef.current.set(e.pointerId, p);

    if (pinchRef.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pinchRef.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomAbout(clampZoom(pinchStart.current.k * (d / pinchStart.current.d)), mid);
      return;
    }

    const drag = dragRef.current;
    if (!drag) {
      const world = toWorld(viewRef.current, p.x, p.y);
      const hit = sim.hit(world.x, world.y, 8 / viewRef.current.k);
      const id = hit?.id ?? null;
      if (id !== hoverRef.current) {
        hoverRef.current = id;
        if (canvasRef.current) canvasRef.current.style.cursor = id ? 'pointer' : 'grab';
        render();
      }
      return;
    }

    drag.moved += Math.abs(p.x - drag.x) + Math.abs(p.y - drag.y);
    if (drag.id) {
      const node = sim.get(drag.id);
      if (node) {
        const world = toWorld(viewRef.current, p.x, p.y);
        node.x = world.x;
        node.y = world.y;
        node.vx = 0;
        node.vy = 0;
        node.pinned = true;
        run();
      }
    } else {
      viewRef.current = {
        ...viewRef.current,
        tx: drag.startTx + (p.x - drag.x),
        ty: drag.startTy + (p.y - drag.y),
      };
      render();
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pinchRef.current.delete(e.pointerId);
    if (pinchRef.current.size < 2) pinchStart.current = null;
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.moved > 6) return;
    setSelected(drag.id);
    if (drag.id) canvasRef.current?.focus();
  };

  const zoomAbout = (k: number, at: { x: number; y: number }) => {
    const v = viewRef.current;
    const wx = (at.x - v.tx) / v.k;
    const wy = (at.y - v.ty) / v.k;
    viewRef.current = { k, tx: at.x - wx * k, ty: at.y - wy * k };
    setZoom(k);
    render();
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const k = clampZoom(viewRef.current.k * Math.pow(0.999, e.deltaY));
    zoomAbout(k, localPoint(e));
  };

  // React attaches wheel passively, which cannot preventDefault, so the
  // page would scroll out from under the zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    canvas.addEventListener('wheel', stop, { passive: false });
    return () => canvas.removeEventListener('wheel', stop);
  }, []);

  const nudgeZoom = (factor: number) => {
    const { w, h } = sizeRef.current;
    zoomAbout(clampZoom(viewRef.current.k * factor), { x: w / 2, y: h / 2 });
  };

  const fit = () => {
    const { w, h } = sizeRef.current;
    viewRef.current = fitTransform(sim.nodes, w, h);
    setZoom(viewRef.current.k);
    render();
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = localPoint(e);
    const world = toWorld(viewRef.current, p.x, p.y);
    const hit = sim.hit(world.x, world.y, 8 / viewRef.current.k);
    if (hit) { hit.pinned = false; run(); }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const dirs: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    };
    if (e.key === 'Escape') {
      setSelected(null);
      setFocus(null);
      setOnlyStream(null);
      return;
    }
    const dir = dirs[e.key];
    if (!dir) return;
    e.preventDefault();
    const from = selected ? sim.get(selected) : null;
    if (!from) {
      const first = [...sim.nodes].sort((a, b) => b.r - a.r)[0];
      if (first) setSelected(first.id);
      return;
    }
    const next = sim.nearest(from, dir);
    if (next) setSelected(next.id);
  };

  // ── selection ─────────────────────────────────────────────────────
  const chosen = selected ? nodeById.get(selected) ?? null : null;
  const chosenTasks = useMemo(() => {
    if (!chosen) return [];
    const ids = new Set(chosen.taskIds);
    return tasks.filter((t) => ids.has(t.id) && t.kind === 'task' && !t.done);
  }, [chosen, tasks]);

  const clearFilters = () => { setFocus(null); setOnlyStream(null); };

  const caption = describe({ layout, focus, onlyStream, solo, graph, personById, threadById, streamById });

  return (
    <section aria-labelledby="web-head" className="web">
      <div className="shead">
        <h2 id="web-head">The web</h2>
        <span className="shead__meta">
          {graph.totals.sections} sections · {graph.totals.links} links
        </span>
      </div>

      <div className="web__controls">
        <div className="seg" role="group" aria-label="Arrangement">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={layout === l.id}
              onClick={() => setLayout(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="web__keys">
          {streams.map((s) => (
            <button
              key={s.id}
              type="button"
              className="chip"
              data-stream={s.id}
              aria-pressed={onlyStream === s.id}
              onClick={() => {
              setFocus(null);
              const next = onlyStream === s.id ? null : s.id;
              setOnlyStream(next);
              if (!next) setSolo(false);
              setSelected(null);
            }}
            >
              <span className="chip__dot" />
              {s.short}
              <span className="chip__n">{whole.nodes.filter((n) => n.stream === s.id).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="web__captionrow">
        <p className="web__caption">{caption}</p>
        {onlyStream && (
          <button
            type="button"
            className="chip web__solo"
            data-stream={onlyStream}
            aria-pressed={solo}
            onClick={() => { setSolo((v) => !v); setSelected(null); }}
          >
            {solo ? 'Show it in context' : 'Only this stream'}
          </button>
        )}
      </div>

      {graph.nodes.length === 0 && (
        <div className="empty">
          <h3>Nothing to draw yet</h3>
          <p>The web is made of your sections. Add some work and it will appear here.</p>
        </div>
      )}

      <div className="web__board" hidden={graph.nodes.length === 0}>
        <div className="web__stagewrap">
          <div className="web__stage" ref={stageRef}>
            <canvas
              ref={canvasRef}
              className="web__canvas"
              tabIndex={0}
              role="img"
              aria-label={`${graph.totals.sections} sections drawn as a map, linked where they share a person or a thread. Arrow keys move between them.`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={onDoubleClick}
              onWheel={onWheel}
              onKeyDown={onKeyDown}
            />
            <div className="web__zoom">
              <button type="button" onClick={() => nudgeZoom(1.3)} aria-label="Zoom in">+</button>
              <button type="button" onClick={() => nudgeZoom(1 / 1.3)} aria-label="Zoom out">−</button>
              <button type="button" onClick={fit} aria-label="Fit everything on screen">Fit</button>
            </div>
            {zoom !== 1 && <span className="web__zoomlevel">{Math.round(zoom * 100)}%</span>}
          </div>

          <details className="web__key">
            <summary>What the drawing means</summary>
            <ul>
              <li><b>Size</b> — open items, plus what you are keeping tabs on.</li>
              <li><b>Colour</b> — the stream it is filed under.</li>
              <li><b>Fading</b> — days since you last touched it. Full colour today, white at {QUIET_FULL_DAYS} days.</li>
              <li><b>The arc on the ring</b> — how much of that section is finished.</li>
              <li><b>A red dot</b> — items that are pressing: flagged, or a date already gone.</li>
              <li><b>A dashed line</b> — the same person is named in both sections.</li>
              <li><b>A solid line</b> — you put them in the same thread.</li>
              <li><b>A dashed ring</b> — a section you are only monitoring.</li>
            </ul>
            <p>Drag a dot to park it. Double-click to let it go again.</p>
          </details>
        </div>

        <div className="web__side">
          {chosen ? (
            <SectionCard
              node={chosen}
              streamTitle={streamById.get(chosen.stream)?.title ?? chosen.stream}
              tasks={chosenTasks}
              people={chosen.people.map((id) => personById.get(id)).filter(Boolean).map((p) => p!)}
              threads={chosen.threads.map((id) => threadById.get(id)).filter(Boolean).map((t) => t!)}
              onClose={() => setSelected(null)}
              onOpenTask={onOpenTask}
              onFocusPerson={(id) => { setOnlyStream(null); setFocus({ kind: 'person', id }); }}
              onFocusThread={(id) => { setOnlyStream(null); setFocus({ kind: 'thread', id }); }}
            />
          ) : null}

          <aside className="web__rail">
            <h3>Connectors</h3>
            <p className="web__hint">
              {graph.connectors.length
                ? 'People in more than one section — the only ones holding anything together.'
                : 'Nobody appears in more than one section yet.'}
            </p>
            <div className="web__people">
              {graph.connectors.slice(0, 14).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="web__person"
                  aria-pressed={focus?.kind === 'person' && focus.id === c.id}
                  onClick={() => {
                    setOnlyStream(null);
                    setFocus(focus?.kind === 'person' && focus.id === c.id ? null : { kind: 'person', id: c.id });
                  }}
                >
                  <span className="web__personname">
                    <span className="web__spread" aria-hidden="true">
                      {c.streams.map((s) => <i key={s} data-stream={s} />)}
                    </span>
                    <span>{c.name}</span>
                  </span>
                  <span className="web__reach">{c.sections.length}</span>
                </button>
              ))}
            </div>
            {graph.soloPeople > 0 && (
              <p className="web__tail">
                {graph.soloPeople} more {graph.soloPeople === 1 ? 'person appears' : 'people appear'} in
                one section only, so they hold nothing together.
              </p>
            )}

            {graph.threads.length > 0 && (
              <>
                <h3 className="web__railhead">Threads</h3>
                <div className="web__people">
                  {graph.threads.slice(0, 8).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="web__person"
                      aria-pressed={focus?.kind === 'thread' && focus.id === t.id}
                      onClick={() => {
                        setOnlyStream(null);
                        setFocus(focus?.kind === 'thread' && focus.id === t.id ? null : { kind: 'thread', id: t.id });
                      }}
                    >
                      <span className="web__personname">
                        <span className="web__spread" aria-hidden="true">
                          {t.streams.map((s) => <i key={s} data-stream={s} />)}
                        </span>
                        <span>{t.title}</span>
                      </span>
                      <span className="web__reach">{t.sections.length}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {(focus || onlyStream) && (
              <button type="button" className="btn btn--ghost web__clear" onClick={clearFilters}>
                Show everything
              </button>
            )}
          </aside>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {chosen
          ? `${chosen.title}. ${chosen.open} open, ${chosen.watch} to keep tabs on, ${chosen.people.length} people.`
          : ''}
      </p>
    </section>
  );
}

// ── the panel ───────────────────────────────────────────────────────
function SectionCard({
  node, streamTitle, tasks, people, threads, onClose, onOpenTask, onFocusPerson, onFocusThread,
}: {
  node: WebNode;
  streamTitle: string;
  tasks: Task[];
  people: { id: string; name: string; role: string | null }[];
  threads: { id: string; title: string }[];
  onClose: () => void;
  onOpenTask: (t: Task) => void;
  onFocusPerson: (id: string) => void;
  onFocusThread: (id: string) => void;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? tasks : tasks.slice(0, 5);

  return (
    <div className="web__detail" data-stream={node.stream}>
      <button type="button" className="web__dismiss" onClick={onClose} aria-label="Close">×</button>
      <p className="web__streamname">
        {streamTitle}{node.groupTitle && <> › {node.groupTitle}</>}
      </p>
      <h3>{node.title}</h3>

      <div className="web__counts">
        <div><span className="web__n">{node.open}</span><span className="web__k">to do</span></div>
        <div><span className="web__n">{node.watch}</span><span className="web__k">keep tabs</span></div>
        <div><span className="web__n">{node.done}</span><span className="web__k">done</span></div>
      </div>

      <p className="web__quiet">
        {node.daysQuiet === null
          ? 'Not touched since it was seeded.'
          : node.daysQuiet === 0
            ? 'Touched today.'
            : `Last touched ${node.daysQuiet} ${node.daysQuiet === 1 ? 'day' : 'days'} ago.`}
        {node.pressing > 0 && ` ${node.pressing} pressing.`}
      </p>

      {(people.length > 0 || threads.length > 0) && (
        <div className="web__chips">
          {threads.map((t) => (
            <button key={t.id} type="button" className="web__tag web__tag--thread" onClick={() => onFocusThread(t.id)}>
              {t.title}
            </button>
          ))}
          {people.map((p) => (
            <button key={p.id} type="button" className="web__tag" onClick={() => onFocusPerson(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <ul className="web__items">
          {shown.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => onOpenTask(t)}>
                {t.do_now && <i className="web__flag" aria-hidden="true" />}
                <span>{t.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {tasks.length > shown.length && (
        <button type="button" className="web__more" onClick={() => setAll(true)}>
          Show the other {tasks.length - shown.length}
        </button>
      )}
      {tasks.length === 0 && node.watch > 0 && (
        <p className="web__quiet">Nothing to do here — {node.watch} to keep tabs on.</p>
      )}
    </div>
  );
}

// ── words ───────────────────────────────────────────────────────────
function describe({
  layout, focus, onlyStream, solo, graph, personById, threadById, streamById,
}: {
  layout: Layout;
  focus: Focus;
  onlyStream: StreamId | null;
  solo: boolean;
  graph: ReturnType<typeof buildGraph>;
  personById: Map<string, { name: string; role: string | null }>;
  threadById: Map<string, { title: string; sections: string[]; items: number; streams: StreamId[] }>;
  streamById: Map<string, { title: string; short: string }>;
}) {
  if (focus?.kind === 'person') {
    const c = graph.connectors.find((x) => x.id === focus.id);
    const p = personById.get(focus.id);
    if (c && p) {
      const where = c.streams.map((s) => streamById.get(s)?.short ?? s).join(', ');
      return `${p.name}${p.role ? ` · ${p.role}` : ''}. ${c.items} open ${c.items === 1 ? 'item' : 'items'} in ${c.sections.length} sections across ${where}.`;
    }
  }
  if (focus?.kind === 'thread') {
    const t = threadById.get(focus.id);
    if (t) {
      const where = t.streams.map((s) => streamById.get(s)?.short ?? s).join(', ');
      return `${t.title}. ${t.items} items across ${t.sections.length} sections — ${where}.`;
    }
  }
  if (onlyStream && solo) {
    const s = streamById.get(onlyStream);
    const mine = graph.nodes;
    return `${s?.title ?? onlyStream} on its own. ${mine.length} sections, `
      + `${mine.reduce((a, n) => a + n.open, 0)} to do, `
      + `${graph.totals.links} ${graph.totals.links === 1 ? 'link' : 'links'} between them.`;
  }
  if (onlyStream) {
    const s = streamById.get(onlyStream);
    const mine = graph.nodes.filter((n) => n.stream === onlyStream);
    const out = graph.edges.filter(
      (e) => (mine.some((n) => n.id === e.a) ? 1 : 0) + (mine.some((n) => n.id === e.b) ? 1 : 0) === 1,
    ).length;
    return `${s?.title ?? onlyStream}. ${mine.length} sections, ${mine.reduce((a, n) => a + n.open, 0)} to do. ` +
      (out ? `${out} of its links run outside the stream.` : 'Nothing here links outside the stream.');
  }
  if (layout === 'filed') {
    return `${graph.totals.sections} sections in the streams you keep them in. Colour fades where nothing has been touched.`;
  }
  if (layout === 'pressure') {
    return 'Quiet across, loaded up. Anything drifting to the top right is going quiet with work still in it.';
  }
  if (graph.totals.links === 0) {
    return 'Nothing is linked yet: no name appears in two sections, and no thread spans two.';
  }
  const alone = `${graph.totals.isolated} ${graph.totals.isolated === 1 ? 'section touches' : 'sections touch'} nobody but you.`;
  return graph.spine
    ? `${graph.spine.links} of the ${graph.totals.links} links are ${graph.spine.name}. ${alone}`
    : `Every line is something shared. ${alone}`;
}

const LAYOUT_KEY = 'commando.web.layout';

function remembered(): Layout | null {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    return v === 'filed' || v === 'web' || v === 'pressure' ? v : null;
  } catch {
    return null;
  }
}

function remember(l: Layout) {
  try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* private mode: not worth a word */ }
}

/** "Sponsorship — OrganOx" reads as "OrganOx" once you are inside the stream. */
function shortLabel(title: string) {
  const parts = title.split(/\s+—\s+/);
  const tail = parts.length > 1 ? parts[parts.length - 1] : title;
  let text = tail;
  if (text.length > 22) {
    const cut = text.slice(0, 22);
    const space = cut.lastIndexOf(' ');
    text = `${(space > 8 ? cut.slice(0, space) : cut).replace(/[,;:]$/, '')}…`;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}
