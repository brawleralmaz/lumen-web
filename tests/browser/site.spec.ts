import { test, expect, chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
const output = "/home/almazych/Desktop/projects/web/lumen/front/test-artifacts";
test.beforeAll(() => mkdirSync(output, { recursive: true }));
async function readyPreviews(page: import("@playwright/test").Page) {
  await expect(page.locator(".hero-model .scene")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  for (const id of ["biology", "robotics", "computer", "interactive"]) {
    const card = page.locator(".category-card." + id);
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator(".scene")).toHaveAttribute("aria-busy", "false");
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
async function denyCamera(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        throw new DOMException("Permission denied", "NotAllowedError");
      },
    });
  });
}
test("introduction, category navigation and mobile layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await denyCamera(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Knowledge, within reach." }),
  ).toBeVisible();
  await expect(page.locator(".hero-model canvas")).toBeVisible();
  await page.waitForFunction(
    () => document.querySelector(".hero-model canvas") !== null,
  );
  await readyPreviews(page);
  await page.screenshot({ path: output + "/hero.png" });
  await page.screenshot({ path: output + "/introduction.png", fullPage: true });
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  for (const [name, id] of [
    ["Biology", "biology"],
    ["Robotics", "robotics"],
    ["Computer hardware", "computer"],
    ["Interactive learning", "interactive"],
  ]) {
    await page
      .getByRole("button", { name: `Explore ${name}`, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: name + ".", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".parts-list summary span")).not.toHaveText("0");
    await expect(
      page.getByText("Camera permission was denied.", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back to Lumen" }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Close menu" }).click();
  await readyPreviews(page);
  await page.screenshot({ path: output + "/mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("selection survives view switch; mouse, reset, pause and tutorial controls work", async ({
  page,
}) => {
  await denyCamera(page);
  await page.goto("/#explore/robotics");
  await expect(page.locator(".parts-list summary span")).toHaveText("6");
  await page
    .getByRole("button", { name: "Use mouse controls", exact: true })
    .first()
    .click();
  await page.locator("summary").click();
  await page
    .getByRole("button", { name: "Shoulder joint", exact: true })
    .click();
  await expect(page.locator(".component-detail h3")).toHaveText(
    "Shoulder joint",
  );
  await page.getByRole("button", { name: "Studio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Studio", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".component-detail h3")).toHaveText(
    "Shoulder joint",
  );
  const stage = await page.locator(".stage").boundingBox();
  if (!stage) throw Error("No viewport");
  await page.mouse.move(
    stage.x + stage.width * 0.5,
    stage.y + stage.height * 0.5,
  );
  await page.mouse.wheel(0, -400);
  await expect(page.locator(".viewport-bottom")).not.toContainText(
    "100% scale",
  );
  await page.mouse.down();
  await page.mouse.move(
    stage.x + stage.width * 0.7,
    stage.y + stage.height * 0.55,
    { steps: 10 },
  );
  await page.mouse.up();
  await page.getByRole("button", { name: "Pause interaction" }).click();
  await expect(
    page.getByText("Interaction paused", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume exploration" }).click();
  await expect(
    page.getByRole("button", { name: "Pause interaction" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset view" }).click();
  await expect(page.locator(".viewport-bottom")).toContainText("100% scale");
  await page.getByRole("button", { name: "Gesture tutorial" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(
    a11y.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({ path: output + "/studio.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: output + "/mobile-studio.png",
    fullPage: true,
  });
});
test("model errors offer recovery", async ({ page }) => {
  await denyCamera(page);
  await page.route("**/models/heart.glb", (r) => r.abort());
  await page.goto("/#explore/biology");
  await expect(
    page.getByRole("button", { name: "Retry specimen" }),
  ).toBeVisible();
  await page.unroute("**/models/heart.glb");
  await page.getByRole("button", { name: "Retry specimen" }).click();
  await expect(page.locator(".parts-list summary span")).toHaveText("10");
});
test("actual worker processes synthetic camera locally and releases tracks", async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROME_PATH ?? "/usr/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({ permissions: ["camera"] });
  const page = await context.newPage();
  const outgoing: string[] = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://localhost:5173") &&
      !r.url().startsWith("blob:")
    )
      outgoing.push(r.url());
  });
  await page.addInitScript(() => {
    (window as unknown as { trackingResults: number }).trackingResults = 0;
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", (e) => {
          if (e.data.type === "result")
            (window as unknown as { trackingResults: number })
              .trackingResults++;
        });
      }
    };
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    (window as unknown as { testStreams: MediaStream[] }).testStreams = [];
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await original(c);
      (window as unknown as { testStreams: MediaStream[] }).testStreams.push(s);
      return s;
    };
  });
  try {
    await page.goto("http://localhost:5173/#explore/robotics");
    await expect(page.getByText("Camera live", { exact: true })).toBeVisible();
    await expect(page.locator(".tracking-status span")).toHaveText(
      /Show your hands|hand.*detected/,
      { timeout: 30000 },
    );
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              (window as unknown as { trackingResults: number })
                .trackingResults,
          ),
        { timeout: 30000 },
      )
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Studio", exact: true }).click();
    await expect(page.getByText("Camera live", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Turn camera off" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as { testStreams: MediaStream[] }
          ).testStreams.every((s) =>
            s.getTracks().every((t) => t.readyState === "ended"),
          ),
        ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Turn camera on" }).click();
    await expect(page.getByText("Camera live", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back to Lumen" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as { testStreams: MediaStream[] }
          ).testStreams.every((s) =>
            s.getTracks().every((t) => t.readyState === "ended"),
          ),
        ),
      )
      .toBe(true);
    expect(outgoing).toEqual([]);
  } finally {
    await browser.close();
  }
});
test("WebGL failure remains actionable instead of showing endless loading", async ({
  page,
}) => {
  await denyCamera(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return (original as (...args: unknown[]) => unknown).call(
        this,
        type,
        ...args,
      );
    } as typeof original;
  });
  await page.goto("/#explore/robotics");
  await expect(
    page.getByText("3D rendering is unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry specimen" }),
  ).toBeVisible();
  await expect(page.getByText("Loading specimen", { exact: true })).toHaveCount(
    0,
  );
});
