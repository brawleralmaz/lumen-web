import { describe, it, expect } from "vitest";
import {
  Interaction,
  Recognizer,
  mirrorPoint,
  cameraToViewport,
} from "../src/gestures";
import type { Gesture, GestureFrame, Hand, Point } from "../src/types";
const f = (
  gesture: Gesture,
  timestamp: number,
  pointer: [number, number] | null = [0.5, 0.5],
  distance: number | null = null,
): GestureFrame => ({
  gesture,
  timestamp,
  pointer,
  palm: pointer,
  distance,
  pinch: gesture === "PINCH",
});
function hand(extended: boolean[], pinch = false): Hand {
  const l: Point[] = Array.from({ length: 21 }, () => ({
    x: 0.5,
    y: 0.75,
    z: 0,
  }));
  l[0] = { x: 0.5, y: 0.9, z: 0 };
  l[1] = { x: 0.43, y: 0.8, z: 0 };
  l[2] = { x: 0.39, y: 0.7, z: 0 };
  l[3] = { x: 0.35, y: 0.6, z: 0 };
  l[4] = { x: 0.3, y: 0.5, z: 0 };
  for (let i = 0; i < 4; i++) {
    const x = 0.42 + i * 0.07,
      m = 5 + i * 4;
    l[m] = { x, y: 0.7, z: 0 };
    l[m + 1] = { x, y: 0.55, z: 0 };
    l[m + 2] = { x, y: extended[i] ? 0.4 : 0.62, z: 0 };
    l[m + 3] = { x, y: extended[i] ? 0.25 : 0.72, z: 0 };
  }
  if (pinch) l[4] = { ...l[8], x: l[8].x + 0.035 };
  if (!extended.some(Boolean) && !pinch) l[4] = { x: 0.5, y: 0.74, z: 0 };
  return { landmarks: l, handedness: "Right", confidence: 0.95 };
}
const classify = (r: Recognizer, h: Hand[], start = 0) => {
  let result;
  for (const t of [0, 40, 90, 130]) result = r.update(h, start + t);
  return result!;
};
describe("camera coordinates", () => {
  it("mirrors once", () => expect(mirrorPoint([0.2, 0.7])).toEqual([0.8, 0.7]));
  it("accounts for object-fit cover cropping", () => {
    expect(cameraToViewport([0.5, 0.5], 640, 480, 1200, 500)).toEqual([
      0.5, 0.5,
    ]);
    expect(cameraToViewport([0, 0.5], 640, 480, 1200, 500)[0]).toBe(1);
    expect(cameraToViewport([0.5, 0], 640, 480, 1200, 500)[1]).toBeLessThan(0);
  });
});
describe("landmark recognizer", () => {
  it.each([
    [[true, false, false, false], "POINT"],
    [[true, true, false, false], "V_SIGN"],
    [[true, true, true, true], "OPEN_PALM"],
    [[false, false, false, false], "FIST"],
  ] as [boolean[], Gesture][])(
    "classifies pose %s as %s",
    (extended, gesture) =>
      expect(classify(new Recognizer(), [hand(extended)]).gesture).toBe(
        gesture,
      ),
  );
  it("debounces before committing a gesture", () => {
    const r = new Recognizer();
    expect(r.update([hand([true, true, true, true])], 0).gesture).toBe("NONE");
    expect(r.update([hand([true, true, true, true])], 40).gesture).toBe("NONE");
    expect(r.update([hand([true, true, true, true])], 90).gesture).toBe(
      "OPEN_PALM",
    );
  });
  it("classifies pinch and prioritizes fist over two hands", () => {
    expect(
      classify(new Recognizer(), [hand([true, false, false, false], true)])
        .gesture,
    ).toBe("PINCH");
    const left = { ...hand([true, true, true, true]), handedness: "Left" };
    expect(
      classify(new Recognizer(), [hand([false, false, false, false]), left])
        .gesture,
    ).toBe("FIST");
  });
  it("detects two hands and rejects invalid input", () => {
    expect(
      classify(new Recognizer(), [
        hand([true, true, true, true]),
        { ...hand([true, true, true, true]), handedness: "Left" },
      ]).gesture,
    ).toBe("TWO_HANDS");
    const h = hand([true, false, false, false]);
    h.landmarks[8].x = NaN;
    expect(classify(new Recognizer(), [h]).pointer).toBe(null);
  });
  it("clears the previous pose on tracking loss", () => {
    const r = new Recognizer();
    classify(r, [hand([true, true, true, true])]);
    expect(r.update([], 160).gesture).toBe("NONE");
    expect(r.update([hand([true, true, true, true])], 200).gesture).toBe(
      "NONE",
    );
  });
});
describe("gesture interaction", () => {
  it("moves from an anchor, respects limits and smooths", () => {
    const i = new Interaction();
    i.update(f("OPEN_PALM", 0), null);
    i.update(f("OPEN_PALM", 100, [1.5, -1]), null);
    expect(i.target.position).toEqual([1.25, 0.82, 0]);
    i.advance(0.016);
    expect(i.transform.position[0]).toBeGreaterThan(0);
    expect(i.transform.position[0]).toBeLessThan(1.25);
  });
  it("rotates using the V sign", () => {
    const i = new Interaction();
    i.update(f("V_SIGN", 0), null);
    i.update(f("V_SIGN", 100, [0.8, 0.7]), null);
    expect(i.target.rotation[1]).toBeGreaterThan(60);
  });
  it("scales with two hands and clamps both limits", () => {
    const i = new Interaction();
    i.update(f("TWO_HANDS", 0, [0.5, 0.5], 0.2), null);
    i.update(f("TWO_HANDS", 100, [0.5, 0.5], 1), null);
    expect(i.target.scale).toBe(3);
    i.update(f("TWO_HANDS", 200, [0.5, 0.5], 0.001), null);
    expect(i.target.scale).toBe(0.3);
  });
  it("selects after dwell and requires release to select again", () => {
    const i = new Interaction();
    i.update(f("PINCH", 0), "a");
    i.update(f("PINCH", 200), "a");
    expect(i.selected).toBe(null);
    i.update(f("PINCH", 300), "a");
    expect(i.selected).toBe("a");
    i.update(f("PINCH", 700), "b");
    expect(i.selected).toBe("a");
    i.update(f("NONE", 710), null);
    i.update(f("PINCH", 720), null);
    i.update(f("PINCH", 900), null);
    i.update(f("PINCH", 1020), null);
    expect(i.selected).toBe(null);
  });
  it("stabilizes hover and clears it after a grace period", () => {
    const i = new Interaction();
    i.update(f("POINT", 0), "a");
    i.update(f("POINT", 130), "a");
    expect(i.hovered).toBe("a");
    i.update(f("POINT", 150), null);
    expect(i.hovered).toBe("a");
    i.update(f("POINT", 260), null);
    expect(i.hovered).toBe(null);
  });
  it("holds fist to stop and palm to resume", () => {
    const i = new Interaction();
    for (const t of [0, 150, 300, 460]) i.update(f("FIST", t), null);
    expect(i.paused).toBe(true);
    i.update(f("OPEN_PALM", 500), null);
    i.update(f("OPEN_PALM", 800), null);
    expect(i.paused).toBe(true);
    i.update(f("OPEN_PALM", 960), null);
    expect(i.paused).toBe(false);
  });
  it("tracking loss cancels anchors and dwell without changing selection", () => {
    const i = new Interaction();
    i.selected = "a";
    i.update(f("OPEN_PALM", 0), null);
    i.update(f("OPEN_PALM", 100, [0.8, 0.5]), null);
    i.advance(0.016);
    i.lost();
    expect(i.target).toEqual(i.transform);
    expect(i.selected).toBe("a");
    i.update(f("OPEN_PALM", 200, [0.2, 0.5]), null);
    expect(i.target).toEqual(i.transform);
  });
});
describe("tracking stability and safety", () => {
  it("keeps an established pinch through the hysteresis band", () => {
    const r = new Recognizer();
    classify(r, [hand([true, false, false, false], true)]);
    const h = hand([true, false, false, false], true);
    h.landmarks[4].x = h.landmarks[8].x + 0.1;
    expect(classify(r, [h], 180).gesture).toBe("PINCH");
    const release = hand([true, false, false, false]);
    release.landmarks[4] = {
      ...release.landmarks[8],
      x: release.landmarks[8].x + 0.18,
    };
    for (let t = 340; t <= 1000; t += 40) r.update([release], t);
    expect(r.update([release], 1040).gesture).toBe("POINT");
  });
  it("accepts coherent whole-hand jumps rather than freezing forever", () => {
    const r = new Recognizer(),
      h = hand([true, false, false, false]);
    classify(r, [h]);
    const moved = {
      ...h,
      landmarks: h.landmarks.map((p) => ({ ...p, x: p.x + 0.3 })),
    };
    const frame = classify(r, [moved], 180);
    expect(frame.pointer?.[0]).toBeCloseTo(1 - h.landmarks[8].x - 0.3);
  });
  it("holds an isolated landmark spike", () => {
    const r = new Recognizer(),
      h = hand([true, false, false, false]);
    const previous = classify(r, [h]);
    const spike = structuredClone(h);
    spike.landmarks[8].x += 0.4;
    expect(r.update([spike], 180).pointer).toEqual(previous.pointer);
  });
  it("rejects hands below the confidence threshold", () => {
    const h = hand([true, false, false, false]);
    h.confidence = 0.59;
    expect(classify(new Recognizer(), [h]).gesture).toBe("NONE");
  });
  it("requires multiple frames as well as selection dwell", () => {
    const i = new Interaction();
    i.update(f("PINCH", 0), "a");
    i.update(f("PINCH", 1000), "a");
    expect(i.selected).toBe(null);
    i.update(f("PINCH", 1040), "a");
    expect(i.selected).toBe("a");
  });
  it("keeps a paused transform frozen even when reset is requested", () => {
    const i = new Interaction();
    i.transform.position = [0.5, 0.2, 0];
    i.stop();
    i.reset();
    i.advance(0.1);
    expect(i.transform.position).toEqual([0.5, 0.2, 0]);
  });
});
