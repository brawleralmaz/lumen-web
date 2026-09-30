import { useEffect, useRef, useState } from "react";
import * as T from "three";
import { loadModel, normalizeModel, disposeModel } from "./models";
import type { CategoryId, ComponentInfo, Transform } from "./types";
export type SceneApi = {
  pick: (point: [number, number]) => ComponentInfo | null;
  transform: (t: Transform) => void;
  highlight: (id: string | null) => void;
};
export function Scene({
  category,
  hero = false,
  api,
  onLoad,
  onError,
}: {
  category: CategoryId;
  hero?: boolean;
  api?: React.RefObject<SceneApi | null>;
  onLoad?: (parts: ComponentInfo[]) => void;
  onError?: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const callbacks = useRef({ onLoad, onError });
  callbacks.current = { onLoad, onError };
  useEffect(() => {
    const el = host.current!;
    setLoaded(false);
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      callbacks.current.onError?.(
        "3D rendering is unavailable. Enable WebGL or try another browser.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    el.appendChild(renderer.domElement);
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(43, 1, 0.01, 100);
    camera.position.set(0, 0, 4.4);
    scene.add(new T.HemisphereLight(0xffffff, 0x8a8b99, 2.4));
    const key = new T.DirectionalLight(0xffffff, 3.5);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new T.DirectionalLight(0xe5eeff, 1.5);
    fill.position.set(-3, 0, 2);
    scene.add(fill);
    const stage = new T.Group();
    scene.add(stage);
    let wrapper: T.Group | undefined;
    let alive = true;
    let raf = 0;
    let highlight: string | null = null;
    const materials: {
      material: T.MeshStandardMaterial;
      component: string | undefined;
      baseEmissive: T.Color;
      baseIntensity: number;
    }[] = [];
    let visible = true;
    const ray = new T.Raycaster();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const started = performance.now();
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    const sceneApi: SceneApi = {
      pick: (p) => {
        if (!wrapper || p.some((n) => n < 0 || n > 1)) return null;
        ray.setFromCamera(new T.Vector2(p[0] * 2 - 1, 1 - p[1] * 2), camera);
        const hit = ray.intersectObject(wrapper, true)[0];
        return hit?.object.userData.component ?? null;
      },
      transform: (t) => {
        stage.position.set(...t.position);
        stage.rotation.set(
          ...(t.rotation.map((d) => (d * Math.PI) / 180) as [
            number,
            number,
            number,
          ]),
        );
        stage.scale.setScalar(t.scale);
      },
      highlight: (id) => {
        if (id === highlight) return;
        highlight = id;
        for (const entry of materials) {
          const active = entry.component === id && id !== null;
          entry.material.emissive.copy(entry.baseEmissive);
          if (active) entry.material.emissive.lerp(new T.Color(0x235ee8), 0.28);
          entry.material.emissiveIntensity = entry.baseIntensity;
        }
      },
    };
    if (api) api.current = sceneApi;
    loadModel(category)
      .then((root) => {
        if (!alive) {
          disposeModel(root);
          return;
        }
        wrapper = normalizeModel(root, category);
        stage.add(wrapper);
        const parts = new Map<string, ComponentInfo>();
        root.traverse((o) => {
          if (o.userData.component)
            parts.set(o.userData.component.id, o.userData.component);
          if (o instanceof T.Mesh)
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              if (m instanceof T.MeshStandardMaterial)
                materials.push({
                  material: m,
                  component: o.userData.component?.id,
                  baseEmissive: m.emissive.clone(),
                  baseIntensity: m.emissiveIntensity,
                });
        });
        renderer.render(scene, camera);
        setLoaded(true);
        callbacks.current.onLoad?.([...parts.values()]);
      })
      .catch(() =>
        callbacks.current.onError?.(
          "The specimen could not load. Check your connection and retry.",
        ),
      );
    const render = () => {
      if (!alive) return;
      if (!visible || document.hidden) {
        raf = requestAnimationFrame(render);
        return;
      }
      if (hero) {
        stage.rotation.y =
          -0.35 +
          (reduced ? 0 : Math.sin((performance.now() - started) / 9000) * 0.15);
        stage.rotation.z = -0.12;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    visibility.observe(el);
    const contextLost = (e: Event) => {
      e.preventDefault();
      callbacks.current.onError?.(
        "The graphics context was lost. Retry the specimen to continue.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      visibility.disconnect();
      if (api) api.current = null;
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      if (wrapper) disposeModel(wrapper);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [category, hero, api]);
  return (
    <div
      className="scene"
      ref={host}
      role="img"
      aria-busy={!loaded}
      aria-label={`${category} interactive 3D specimen`}
    />
  );
}
