import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Hand,
  Menu,
  Move,
  Rotate3D,
  Scan,
  ShieldCheck,
  X,
  ZoomIn,
} from "lucide-react";
import { categories, byId } from "./catalog";
import { Scene } from "./Scene";
const Experience = lazy(() =>
  import("./Experience").then((m) => ({ default: m.Experience })),
);
import type { CategoryId } from "./types";
function Preview({ category }: { category: CategoryId }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    obs.observe(host.current!);
    return () => obs.disconnect();
  }, []);
  return (
    <div className="category-preview" ref={host}>
      {visible && <Scene category={category} hero />}
    </div>
  );
}
function readCategory() {
  return byId(location.hash.replace("#explore/", ""))?.id ?? null;
}
export default function App() {
  const [active, setActive] = useState<CategoryId | null>(readCategory),
    [menu, setMenu] = useState(false),
    [heroError, setHeroError] = useState(false);
  useEffect(() => {
    const change = () => {
      const next = readCategory();
      setActive(next);
      if (next || !location.hash) window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const launch = (id: CategoryId) => {
    location.hash = `explore/${id}`;
    setActive(id);
    window.scrollTo(0, 0);
  };
  if (active)
    return (
      <Suspense
        fallback={<div className="app-loading">Opening the Lumen studio…</div>}
      >
        <Experience
          key={active}
          initial={active}
          onBack={() => {
            location.hash = "";
            setActive(null);
            window.scrollTo(0, 0);
          }}
        />
      </Suspense>
    );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Lumen home">
          lumen
          <span className="brand-dot" />
        </a>
        <nav className={menu ? "open" : ""} aria-label="Main navigation">
          <a href="#subjects" onClick={() => setMenu(false)}>
            The platform
          </a>
          <a href="#how" onClick={() => setMenu(false)}>
            How it works
          </a>
          <a href="#principles" onClick={() => setMenu(false)}>
            Our approach
          </a>
        </nav>
        <button className="header-cta" onClick={() => launch("biology")}>
          Enter the studio <ArrowUpRight size={16} />
        </button>
        <button
          className="menu-toggle icon-btn"
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          onClick={() => setMenu((v) => !v)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="tiny-line" /> LEARNING, IN A NEW DIMENSION
            </p>
            <h1>
              Knowledge,
              <br />
              within <em>reach.</em>
            </h1>
            <p className="hero-description">
              Some things make more sense
              <br className="desktop-break" /> when you can hold them.
            </p>
            <p className="hero-body">
              Meet Lumen. An interactive 3D learning platform that turns your
              hands into a way to understand the world.
            </p>
            <button
              className="primary"
              onClick={() =>
                document
                  .getElementById("subjects")
                  ?.scrollIntoView({
                    behavior: window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches
                      ? "instant"
                      : "smooth",
                  })
              }
            >
              Explore Lumen <ArrowUpRight size={19} />
            </button>
            <div className="hero-facts">
              <span>
                <Scan size={14} /> A webcam is all you need
              </span>
              <span>No headset. No installation.</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="specimen-orbit orbit-one" />
            <div className="specimen-orbit orbit-two" />
            <span className="visual-cross top-cross">+</span>
            <span className="visual-cross bottom-cross">+</span>
            <div className="hero-model">
              {!heroError ? (
                <Scene
                  category="biology"
                  hero
                  onError={() => setHeroError(true)}
                />
              ) : (
                <div className="hero-fallback">
                  <span>01</span>
                  <p>The anatomy of discovery.</p>
                </div>
              )}
            </div>
            <div className="specimen-label">
              <span className="label-dot" />
              <div>
                <span>HUMAN HEART</span>
                <small>Biology / specimen 001</small>
              </div>
              <span className="label-rule" />
            </div>
            <div className="gesture-tag">
              <Hand size={23} strokeWidth={1.3} />
              <div>
                <strong>A gesture. A discovery.</strong>
                <span>Real objects. A new perspective.</span>
              </div>
            </div>
            <span className="visual-index">FIG. 01 — THE HUMAN HEART</span>
            <span className="visual-side">EXPLORE EVERY DIMENSION</span>
          </div>
          <a className="scroll-note" href="#subjects">
            <ArrowDown size={14} /> A world worth exploring
          </a>
        </section>
        <div className="intro-strip">
          <span>A MORE HUMAN WAY TO LEARN</span>
          <p>
            From the parts of a machine
            <br />
            to the wonders of the human body.
          </p>
          <span className="strip-mark">
            L<span>↗</span>
          </span>
        </div>
        <section className="subjects section-wrap" id="subjects">
          <div className="section-heading">
            <div>
              <p className="eyebrow">FOUR PATHS. ONE PLATFORM.</p>
              <h2>Follow your curiosity.</h2>
            </div>
            <p>
              Choose a subject. Open your camera.
              <br />
              Make the complex a little more tangible.
            </p>
          </div>
          <div className="category-grid">
            {categories.map((c) => (
              <button
                className={`category-card ${c.id}`}
                key={c.id}
                onClick={() => launch(c.id)}
                aria-label={`Explore ${c.name}`}
              >
                <div className="category-top">
                  <span>{c.number}</span>
                  <ArrowUpRight size={19} />
                </div>
                <Preview category={c.id} />
                <div className="category-bottom">
                  <p className="eyebrow">{c.field}</p>
                  <h3>{c.name}</h3>
                  <p>{c.description}</p>
                  <span className="card-link">
                    Explore subject <ArrowRight size={14} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
        <section className="how section-wrap" id="how">
          <div className="how-title">
            <p className="eyebrow">LESS BETWEEN YOU AND DISCOVERY</p>
            <h2>
              Not another screen.
              <br />
              <em>A different connection.</em>
            </h2>
            <p>
              Your camera sees your hands.
              <br />
              Lumen brings your gestures to life.
            </p>
            <button className="text-btn" onClick={() => launch("biology")}>
              Try it for yourself <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="steps">
            <article>
              <span className="step-number">01</span>
              <div>
                <h3>Find your field.</h3>
                <p>
                  Start with a subject that sparks your curiosity. A 3D specimen
                  is ready to explore.
                </p>
              </div>
            </article>
            <article>
              <span className="step-number">02</span>
              <div>
                <h3>Bring your hands.</h3>
                <p>
                  Allow camera access. With local hand tracking, your movements
                  become the controls.
                </p>
              </div>
            </article>
            <article>
              <span className="step-number">03</span>
              <div>
                <h3>See it differently.</h3>
                <p>
                  Move, rotate, scale, and inspect a part. Switch between your
                  camera and a quiet studio view.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="gesture-section section-wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">INSTINCTIVE BY DESIGN</p>
              <h2>You already know the interface.</h2>
            </div>
            <span className="gesture-caption">YOUR HANDS.</span>
          </div>
          <div className="gesture-grid">
            {[
              [Move, "Open palm", "Move it"],
              [Rotate3D, "V sign", "Turn it"],
              [ZoomIn, "Two hands", "Scale it"],
              [Hand, "Pinch & hold", "Understand it"],
            ].map(([Icon, name, action]) => {
              const I = Icon as typeof Hand;
              return (
                <article key={String(name)}>
                  <I size={34} strokeWidth={1.2} />
                  <p>{String(name)}</p>
                  <h3>
                    {String(action)}
                    <span>.</span>
                  </h3>
                </article>
              );
            })}
          </div>
        </section>
        <section className="principles section-wrap" id="principles">
          <div className="principles-copy">
            <p className="eyebrow">BUILT AROUND THE LEARNER</p>
            <h2>
              Big possibilities.
              <br />
              <em>A small footprint.</em>
            </h2>
          </div>
          <div className="principle-list">
            <article>
              <ShieldCheck size={22} strokeWidth={1.3} />
              <div>
                <h3>Your space stays yours.</h3>
                <p>
                  Camera frames are processed on your device. Your video is
                  never uploaded.
                </p>
              </div>
            </article>
            <article>
              <Scan size={22} strokeWidth={1.3} />
              <div>
                <h3>Start with what you have.</h3>
                <p>
                  A browser, a webcam, and a little curiosity. No specialist
                  hardware required.
                </p>
              </div>
            </article>
            <article>
              <Hand size={22} strokeWidth={1.3} />
              <div>
                <h3>More than one way in.</h3>
                <p>
                  Camera and Studio views, with mouse controls available
                  whenever you need them.
                </p>
              </div>
            </article>
          </div>
        </section>
        <section className="closing section-wrap">
          <p className="eyebrow">THE NEXT DISCOVERY IS YOURS.</p>
          <h2>Get a little closer.</h2>
          <button className="primary" onClick={() => launch("biology")}>
            Enter the Lumen studio <ArrowUpRight size={19} />
          </button>
          <p>No account needed. Just start exploring.</p>
          <span className="closing-symbol">✳</span>
        </section>
      </main>
      <footer className="site-footer">
        <a className="wordmark" href="#">
          lumen
          <span className="brand-dot" />
        </a>
        <span>Knowledge, within reach.</span>
        <div>
          <a href="/credits.html" target="_blank" rel="noreferrer">
            Model credits ↗
          </a>
          <span>© {new Date().getFullYear()} Lumen</span>
        </div>
      </footer>
    </>
  );
}
