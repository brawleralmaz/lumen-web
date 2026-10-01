import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
let detector: HandLandmarker | null = null;
self.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const files = await FilesetResolver.forVisionTasks(
        m.base + "tracking/wasm",
        true,
      );
      detector = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: m.base + "tracking/hand_landmarker.task",
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", message: String(error) });
    }
    return;
  }
  if (m.type === "frame") {
    try {
      if (!detector) throw new Error("Tracking is not initialized");
      const r = detector.detectForVideo(m.bitmap, m.timestamp);
      self.postMessage({
        type: "result",
        timestamp: m.timestamp,
        hands: r.landmarks.map((landmarks, i) => ({
          landmarks,
          handedness: r.handedness[i]?.[0]?.categoryName ?? "Unknown",
          confidence: r.handedness[i]?.[0]?.score ?? 0,
        })),
      });
    } catch (error) {
      self.postMessage({ type: "error", message: String(error) });
    } finally {
      m.bitmap.close();
    }
  }
};
