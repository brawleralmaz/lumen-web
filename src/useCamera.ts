import { useEffect, useState } from "react";
import type { Hand, TrackingMessage } from "./types";
export function useCamera(
  video: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  attempt: number,
  onFrame: (hands: Hand[], timestamp: number) => void,
  onLost: () => void,
) {
  const [camera, setCamera] = useState("Camera is off"),
    [tracking, setTracking] = useState("Tracking is off"),
    [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) {
      setCamera("Camera is off");
      setTracking("Tracking is off");
      onLost();
      return;
    }
    let alive = true,
      stream: MediaStream | undefined,
      worker: Worker | undefined,
      raf = 0,
      busy = false,
      ready = false,
      lastSubmit = 0,
      lastResult = 0,
      lastVideoTime = -1,
      initTimer: ReturnType<typeof setTimeout> | undefined;
    setCamera("Requesting camera");
    setTracking("Preparing hand tracking");
    setError("");
    const fail = (message: string) => {
      if (!alive) return;
      setError(message);
      setTracking("Tracking unavailable");
      onLost();
    };
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera access needs HTTPS or localhost and a supported browser.",
          );
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
            facingMode: "user",
          },
        });
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = video.current;
        if (!v) throw new Error("Camera view is unavailable.");
        v.srcObject = s;
        await v.play();
        if (!alive) return;
        setCamera("Camera live");
        s.getVideoTracks().forEach((t) =>
          t.addEventListener("ended", () => {
            if (alive) {
              setCamera("Camera disconnected");
              fail("The camera disconnected. Reconnect it and retry.");
            }
          }),
        );
        worker = new Worker(new URL("./tracking.worker.ts", import.meta.url), {
          type: "module",
        });
        initTimer = setTimeout(() => {
          if (alive && !ready) {
            worker?.terminate();
            fail(
              "Hand tracking took too long to start. Retry or use mouse controls.",
            );
          }
        }, 12000);
        worker.onerror = (event) => {
          console.error("Lumen tracking worker:", event.message);
          ready = false;
          fail("Hand tracking could not start. Retry or use mouse controls.");
        };
        worker.onmessage = (e: MessageEvent<TrackingMessage>) => {
          if (!alive) return;
          const m = e.data;
          if (m.type === "ready") {
            clearTimeout(initTimer);
            ready = true;
            setTracking("Show your hands");
          } else if (m.type === "error") {
            console.error("Lumen hand tracking:", m.message);
            busy = false;
            ready = false;
            fail("Hand tracking failed. Retry or use mouse controls.");
          } else {
            busy = false;
            lastResult = performance.now();
            setTracking(
              m.hands.length
                ? `${m.hands.length} hand${m.hands.length === 1 ? "" : "s"} detected`
                : "Show your hands",
            );
            onFrame(m.hands, m.timestamp);
          }
        };
        worker.postMessage({ type: "init", base: location.origin });
        const tick = () => {
          if (!alive) return;
          const now = performance.now();
          if (lastResult && now - lastResult > 350) onLost();
          if (busy && now - lastSubmit > 3000) {
            ready = false;
            busy = false;
            worker?.terminate();
            fail("Hand tracking stopped responding. Retry to restart it.");
          }
          if (
            ready &&
            !busy &&
            now - lastSubmit >= 1000 / 30 &&
            v.readyState >= 2 &&
            v.currentTime !== lastVideoTime
          ) {
            busy = true;
            lastSubmit = now;
            lastVideoTime = v.currentTime;
            createImageBitmap(v, {
              resizeWidth: 640,
              resizeHeight: Math.round((640 * v.videoHeight) / v.videoWidth),
            })
              .then((bitmap) => {
                if (!alive || !worker || !ready) {
                  bitmap.close();
                  busy = false;
                  return;
                }
                worker.postMessage({ type: "frame", bitmap, timestamp: now }, [
                  bitmap,
                ]);
              })
              .catch(() => {
                busy = false;
                ready = false;
                fail(
                  "Camera frames could not be processed. Try another browser or mouse controls.",
                );
              });
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) {
        if (!alive) return;
        stream?.getTracks().forEach((t) => t.stop());
        setCamera("Camera unavailable");
        const name = e instanceof Error ? e.name : "";
        fail(
          name === "NotAllowedError"
            ? "Camera permission was denied. Allow it in your browser settings and retry, or use mouse controls."
            : name === "NotFoundError"
              ? "No camera was found. Connect a webcam and retry, or use mouse controls."
              : e instanceof Error
                ? e.message
                : "Camera could not start. Retry or use mouse controls.",
        );
      }
    };
    void start();
    const visible = () => {
      if (document.hidden) onLost();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      clearTimeout(initTimer);
      cancelAnimationFrame(raf);
      worker?.terminate();
      stream?.getTracks().forEach((t) => t.stop());
      if (video.current) video.current.srcObject = null;
      document.removeEventListener("visibilitychange", visible);
      onLost();
    };
  }, [enabled, attempt, video, onFrame, onLost]);
  return { camera, tracking, error };
}
