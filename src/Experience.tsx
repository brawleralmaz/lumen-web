import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  Hand,
  HelpCircle,
  Monitor,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  VideoOff,
  X,
} from "lucide-react";
import { categories } from "./catalog";
import { Scene, type SceneApi } from "./Scene";
import { Interaction, Recognizer, cameraToViewport } from "./gestures";
import { useCamera } from "./useCamera";
import type {
  CategoryId,
  ComponentInfo,
  Hand as TrackedHand,
  ViewMode,
} from "./types";
const gestureLabel: Record<string, string> = {
  NONE: "Ready to explore",
  POINT: "Point · explore a part",
  PINCH: "Pinch · select a part",
  OPEN_PALM: "Open palm · moving",
  V_SIGN: "V sign · rotating",
  FIST: "Fist · stopping",
  TWO_HANDS: "Two hands · scaling",
};
export const tutorial = [
  ["Point", "Hover over a component"],
  ["Pinch & hold", "Select a component"],
  ["Open palm", "Move the specimen"],
  ["V sign", "Rotate the specimen"],
  ["Two hands", "Move hands apart to enlarge"],
  ["Fist", "Hold to pause; palm to resume"],
];
export function Experience({
  initial,
  onBack,
}: {
  initial: CategoryId;
  onBack: () => void;
}) {
  const [category, setCategory] = useState(initial),
    [view, setView] = useState<ViewMode>("camera"),
    [input, setInput] = useState<"hand" | "mouse">("hand"),
    [cameraOn, setCameraOn] = useState(true),
    [attempt, setAttempt] = useState(0),
    [help, setHelp] = useState(false),
    [parts, setParts] = useState<ComponentInfo[]>([]),
    [modelStatus, setModelStatus] = useState("Loading specimen"),
    [modelError, setModelError] = useState(""),
    [reload, setReload] = useState(0);
  const [status, setStatus] = useState({
    gesture: "NONE",
    selected: null as string | null,
    hovered: null as string | null,
    paused: false,
    scale: 1,
    progress: 0,
    pointer: null as [number, number] | null,
  });
  const video = useRef<HTMLVideoElement>(null),
    stage = useRef<HTMLDivElement>(null),
    api = useRef<SceneApi | null>(null),
    interaction = useRef(new Interaction()),
    recognizer = useRef(new Recognizer()),
    viewRef = useRef(view),
    helpRef = useRef(help),
    lastUI = useRef(0),
    pointer = useRef<[number, number] | null>(null);
  viewRef.current = view;
  helpRef.current = help;
  const publish = useCallback(() => {
    const i = interaction.current;
    setStatus({
      gesture: i.gesture,
      selected: i.selected,
      hovered: i.hovered,
      paused: i.paused,
      scale: i.transform.scale,
      progress: i.progress,
      pointer: pointer.current,
    });
  }, []);
  const lost = useCallback(() => {
    recognizer.current.reset();
    interaction.current.lost();
    pointer.current = null;
  }, []);
  const frame = useCallback(
    (hands: TrackedHand[], timestamp: number) => {
      if (document.hidden || helpRef.current) {
        lost();
        return;
      }
      const f = recognizer.current.update(hands, timestamp);
      let p = f.pointer;
      if (p && viewRef.current === "camera" && video.current && stage.current) {
        const rect = stage.current.getBoundingClientRect();
        p = cameraToViewport(
          [1 - p[0], p[1]],
          video.current.videoWidth,
          video.current.videoHeight,
          rect.width,
          rect.height,
        );
      }
      pointer.current = ["POINT", "PINCH"].includes(f.gesture) ? p : null;
      const hit = p ? api.current?.pick(p) : null;
      interaction.current.update(f, hit?.id ?? null);
    },
    [lost],
  );
  const { camera, tracking, error } = useCamera(
    video,
    cameraOn && input === "hand",
    attempt,
    frame,
    lost,
  );
  useEffect(() => {
    let raf = 0,
      last = performance.now();
    const tick = () => {
      const now = performance.now(),
        i = interaction.current;
      i.advance((now - last) / 1000);
      last = now;
      api.current?.transform(i.transform);
      api.current?.highlight(i.selected ?? i.hovered);
      if (now - lastUI.current > 80) {
        publish();
        lastUI.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [publish]);
  useLayoutEffect(() => {
    interaction.current = new Interaction();
    recognizer.current.reset();
    pointer.current = null;
    setParts([]);
    setModelStatus("Loading specimen");
    setModelError("");
    publish();
  }, [category, reload, publish]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHelp(false);
        return;
      }
      if ((e.target as HTMLElement).matches("input,select,textarea,button"))
        return;
      if (e.key.toLowerCase() === "r") interaction.current.reset();
      if (e.key === " ") {
        e.preventDefault();
        interaction.current.paused
          ? interaction.current.resume()
          : interaction.current.stop();
      }
      if (e.key === "Escape") setHelp(false);
      if (e.key.toLowerCase() === "h") setHelp((h) => !h);
      if (e.key.toLowerCase() === "x") interaction.current.selected = null;
      publish();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [publish]);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(".tutorial-modal")!;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const buttons = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button,a[href],select,input,[tabindex="0"]',
        ),
      ];
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [help]);
  const current = categories.find((c) => c.id === category)!,
    selected = parts.find((p) => p.id === (status.selected ?? status.hovered));
  const drag = useRef<{
    x: number;
    y: number;
    rx: number;
    ry: number;
    moved: boolean;
    shift: boolean;
    px: number;
    py: number;
  } | null>(null);
  const pos = (e: React.PointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as [
      number,
      number,
    ];
  };
  const mouseDown = (e: React.PointerEvent) => {
    if (input !== "mouse" || interaction.current.paused) return;
    stage.current?.setPointerCapture(e.pointerId);
    const i = interaction.current;
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      rx: i.target.rotation[0],
      ry: i.target.rotation[1],
      moved: false,
      shift: e.shiftKey,
      px: i.target.position[0],
      py: i.target.position[1],
    };
  };
  const mouseMove = (e: React.PointerEvent) => {
    if (input !== "mouse" || interaction.current.paused) return;
    const i = interaction.current,
      d = drag.current;
    i.hovered = api.current?.pick(pos(e))?.id ?? null;
    if (d) {
      const dx = (e.clientX - d.x) / stage.current!.clientWidth,
        dy = (e.clientY - d.y) / stage.current!.clientHeight;
      d.moved ||= Math.abs(dx) + Math.abs(dy) > 0.005;
      if (d.shift)
        i.target.position = [
          Math.max(-1.25, Math.min(1.25, d.px + dx * 2.25)),
          Math.max(-0.82, Math.min(0.82, d.py - dy * 2.25)),
          0,
        ];
      else i.target.rotation = [d.rx + dy * 210, d.ry + dx * 210, 0];
    }
  };
  const mouseUp = (e: React.PointerEvent) => {
    if (input !== "mouse") return;
    if (drag.current && !drag.current.moved && !interaction.current.paused)
      interaction.current.selected = api.current?.pick(pos(e))?.id ?? null;
    drag.current = null;
    publish();
  };
  const retry = () => {
    setInput("hand");
    setCameraOn(true);
    setAttempt((n) => n + 1);
  };
  return (
    <div className="experience">
      <header className="exp-header" inert={help}>
        <button className="back" onClick={onBack}>
          <ArrowLeft size={17} /> Back to Lumen
        </button>
        <a
          className="wordmark"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          lumen
          <span className="brand-dot" />
        </a>
        <span className="exp-header-label">THE EXPLORATION STUDIO</span>
      </header>
      <main className="exp-main" inert={help}>
        <div className="exp-title">
          <div>
            <p className="eyebrow">{current.field}</p>
            <h1>
              {current.name}
              <span>.</span>
            </h1>
          </div>
          <label className="category-select">
            <span className="sr-only">Category</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as CategoryId);
                history.replaceState(null, "", `#explore/${e.target.value}`);
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
        </div>
        <div className="workspace">
          <section
            className={`viewport ${view} ${camera === "Camera live" ? "live" : ""}`}
          >
            <div className="viewport-toolbar">
              <div className="mode-switch" aria-label="Viewing mode">
                <button
                  aria-pressed={view === "camera"}
                  onClick={() => setView("camera")}
                >
                  <Camera size={15} /> Camera
                </button>
                <button
                  aria-pressed={view === "studio"}
                  onClick={() => setView("studio")}
                >
                  <Monitor size={15} /> Studio
                </button>
              </div>
              <button
                className="icon-btn"
                aria-label="Gesture tutorial"
                onClick={() => setHelp(true)}
              >
                <HelpCircle size={19} />
              </button>
            </div>
            <div
              className="stage"
              ref={stage}
              onPointerDown={mouseDown}
              onPointerMove={mouseMove}
              onPointerUp={mouseUp}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onPointerLeave={() => {
                if (!drag.current) interaction.current.hovered = null;
              }}
              onWheel={(e) => {
                if (input === "mouse" && !interaction.current.paused)
                  interaction.current.target.scale = Math.max(
                    0.3,
                    Math.min(
                      3,
                      interaction.current.target.scale *
                        Math.exp(-e.deltaY * 0.001),
                    ),
                  );
              }}
            >
              <video
                ref={video}
                hidden={
                  input === "mouse" || !cameraOn || camera !== "Camera live"
                }
                muted
                playsInline
                className={`camera-video ${view}`}
                aria-label="Your mirrored camera feed"
              />
              <Scene
                key={reload}
                category={category}
                api={api}
                onLoad={(p) => {
                  setParts(p);
                  setModelStatus("Specimen ready");
                }}
                onError={(m) => {
                  setModelError(m);
                  setModelStatus("Specimen unavailable");
                }}
              />
              {status.pointer && (
                <div
                  className="hand-pointer"
                  style={{
                    left: `${status.pointer[0] * 100}%`,
                    top: `${status.pointer[1] * 100}%`,
                    background: status.progress ? "#244ad1" : undefined,
                  }}
                />
              )}
              {modelStatus === "Loading specimen" && (
                <div className="loading-pill">
                  <span className="spinner" /> Loading specimen
                </div>
              )}
              {modelError && (
                <div className="model-error" role="alert">
                  <p>{modelError}</p>
                  <button
                    className="small-btn"
                    onClick={() => setReload((n) => n + 1)}
                  >
                    Retry specimen
                  </button>
                </div>
              )}
              {status.paused && (
                <div className="pause-overlay">
                  <Pause size={24} />
                  <span>Interaction paused</span>
                  <button
                    onClick={() => {
                      interaction.current.resume();
                      publish();
                    }}
                  >
                    Resume exploration
                  </button>
                </div>
              )}
            </div>
            <div className="specimen-caption">
              <span>{current.specimen}</span>
              <span>
                {current.simplified
                  ? "SIMPLIFIED SPECIMEN"
                  : "3D STUDY SPECIMEN"}
              </span>
            </div>
            <div className="viewport-bottom">
              <span>
                <span
                  className={`status-dot ${camera === "Camera live" ? "active" : ""}`}
                />
                {input === "mouse" ? "Mouse control" : camera}
              </span>
              <span>{Math.round(status.scale * 100)}% scale</span>
              <div>
                <button
                  aria-label="Reset view"
                  onClick={() => {
                    interaction.current.reset();
                    publish();
                  }}
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  aria-label={
                    status.paused ? "Resume interaction" : "Pause interaction"
                  }
                  onClick={() => {
                    interaction.current.paused
                      ? interaction.current.resume()
                      : interaction.current.stop();
                    publish();
                  }}
                >
                  {status.paused ? <Play size={16} /> : <Pause size={16} />}
                </button>
              </div>
            </div>
          </section>
          <aside className="control-panel">
            <p className="eyebrow">YOUR HANDS ARE THE INTERFACE</p>
            <h2>Make a discovery.</h2>
            <p className="panel-intro">
              Move, turn, and explore. A familiar gesture is all it takes.
            </p>
            <div className="tracking-status" aria-live="polite">
              <Hand size={22} />
              <div>
                <strong>
                  {input === "mouse"
                    ? "Mouse controls active"
                    : status.paused
                      ? "Interaction paused"
                      : gestureLabel[status.gesture]}
                </strong>
                <span>
                  {input === "mouse"
                    ? "Drag to rotate · scroll to scale"
                    : tracking}
                </span>
              </div>
            </div>
            {error && input === "hand" && (
              <div className="camera-error" role="alert">
                <p>{error}</p>
                <button className="small-btn" onClick={retry}>
                  Retry camera
                </button>
                <button
                  className="text-btn"
                  onClick={() => {
                    lost();
                    setInput("mouse");
                  }}
                >
                  Use mouse controls <ArrowUpRight size={13} />
                </button>
              </div>
            )}
            <div className="component-detail">
              <p className="eyebrow">
                {status.selected ? "SELECTED COMPONENT" : "COMPONENT EXPLORER"}
              </p>
              <h3>{selected?.name ?? "Look a little closer."}</h3>
              <p>
                {selected?.description ??
                  "Point at the specimen to discover a part. Pinch and hold to learn more."}
              </p>
              {status.selected && (
                <button
                  className="text-btn"
                  onClick={() => {
                    interaction.current.selected = null;
                    publish();
                  }}
                >
                  Clear selection <X size={12} />
                </button>
              )}
            </div>
            <details className="parts-list">
              <summary>
                Explore components <span>{parts.length}</span>
              </summary>
              <div>
                {parts.map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={status.selected === p.id}
                    onClick={() => {
                      interaction.current.selected = p.id;
                      publish();
                    }}
                  >
                    {p.name}
                    {status.selected === p.id && <Check size={12} />}
                  </button>
                ))}
              </div>
            </details>
            <div className="input-options">
              <button
                className="small-btn"
                onClick={() => {
                  lost();
                  setInput(input === "hand" ? "mouse" : "hand");
                }}
              >
                {input === "hand" ? (
                  <MousePointer2 size={14} />
                ) : (
                  <Hand size={14} />
                )}{" "}
                {input === "hand" ? "Use mouse controls" : "Use hand gestures"}
              </button>
              {input === "hand" && (
                <button
                  className="icon-btn"
                  aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
                  onClick={() => {
                    setCameraOn((v) => !v);
                  }}
                >
                  {cameraOn ? <VideoOff size={17} /> : <Camera size={17} />}
                </button>
              )}
            </div>
            <p className="local-note">
              <span className="status-dot active" /> Your camera stays on your
              device.
            </p>
          </aside>
        </div>
        <div className="experience-footer">
          <p>
            {current.source ? (
              <a href={current.source} target="_blank" rel="noreferrer">
                {current.credit} ↗
              </a>
            ) : (
              current.credit
            )}
            {current.license && ` · ${current.license}`}
          </p>
          <p>
            {input === "mouse"
              ? "Drag to rotate · Shift-drag to move · Scroll to scale"
              : "Hold a fist to pause · Hold an open palm to resume"}{" "}
            · R to reset
          </p>
        </div>
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="tutorial-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="modal-close icon-btn"
              aria-label="Close tutorial"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <p className="eyebrow">A NEW WAY TO EXPLORE</p>
            <h2 id="tutorial-title">
              Six gestures.
              <br />
              Endless discovery.
            </h2>
            <p>Keep your hands visible, with a little space around you.</p>
            <div>
              {tutorial.map(([name, action], index) => (
                <article key={name}>
                  <span>0{index + 1}</span>
                  <strong>{name}</strong>
                  <p>{action}</p>
                </article>
              ))}
            </div>
            <button className="primary" onClick={() => setHelp(false)}>
              Ready to explore <ArrowUpRight size={17} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
