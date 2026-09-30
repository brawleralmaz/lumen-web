import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { categories, info } from "./catalog";
import type { CategoryId, ComponentInfo } from "./types";
export const heartParts: Record<string, ComponentInfo> = {
  VH_M_mitral_valve: info(
    "mitral",
    "Mitral valve",
    "Controls flow from the left atrium to the left ventricle.",
  ),
  VH_M_tricuspid_valve: info(
    "tricuspid",
    "Tricuspid valve",
    "Controls flow from the right atrium to the right ventricle.",
  ),
  VH_M_aortic_valve: info(
    "aortic",
    "Aortic valve",
    "Allows blood to leave the left ventricle into the aorta.",
  ),
  VH_M_pulmonary_valve: info(
    "pulmonary",
    "Pulmonary valve",
    "Allows blood to leave the right ventricle toward the lungs.",
  ),
  VH_M_left_cardiac_atrium: info(
    "left-atrium",
    "Left atrium",
    "Receives oxygen-rich blood returning from the lungs.",
  ),
  VH_M_right_cardiac_atrium: info(
    "right-atrium",
    "Right atrium",
    "Receives blood returning from the body.",
  ),
  VH_M_heart_right_ventricle: info(
    "right-ventricle",
    "Right ventricle",
    "Pumps blood toward the lungs.",
  ),
  VH_M_heart_left_ventricle: info(
    "left-ventricle",
    "Left ventricle",
    "Pumps oxygen-rich blood to the body.",
  ),
  VH_M_interventricular_septum: info(
    "septum",
    "Interventricular septum",
    "Separates the left and right ventricles.",
  ),
};
const boardParts: Record<string, ComponentInfo> = {
  BatteryM: info(
    "battery",
    "CMOS battery",
    "Provides backup power for the real-time clock and firmware settings.",
  ),
  CPUBracketM: info(
    "cpu-bracket",
    "CPU retention bracket",
    "Secures the processor in its socket.",
  ),
  CPULatch: info(
    "cpu-latch",
    "CPU retention latch",
    "Locks the processor retention mechanism.",
  ),
  Capacitor1M: info(
    "capacitor",
    "Capacitor",
    "Stores charge and helps smooth changes in electrical supply.",
  ),
  CapacitorsM: info(
    "capacitor",
    "Capacitor",
    "Stores charge and helps smooth changes in electrical supply.",
  ),
  USBMetalM: info(
    "usb-housing",
    "USB connector housing",
    "The metal shell protects and supports a USB connection.",
  ),
  I_O_Cover: info(
    "io-cover",
    "I/O cover",
    "Covers the motherboard’s external connection area.",
  ),
};
export function disposeModel(root: T.Object3D) {
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const v of Object.values(m))
          if (v instanceof T.Texture) v.dispose();
        m.dispose();
      }
    }
  });
}
function mesh(
  g: T.BufferGeometry,
  color: string,
  component: ComponentInfo,
  root: T.Group,
  pos: [number, number, number],
  rotation?: [number, number, number],
) {
  const m = new T.Mesh(
    g,
    new T.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.14 }),
  );
  m.position.set(...pos);
  if (rotation) m.rotation.set(...rotation);
  m.userData.component = component;
  root.add(m);
  return m;
}
export function procedural(id: CategoryId) {
  const root = new T.Group();
  if (id === "robotics") {
    const base = info(
        "base",
        "Base",
        "Anchors the robot arm and supports the rotating assembly.",
      ),
      shoulder = info(
        "shoulder",
        "Shoulder joint",
        "Connects the base to the upper arm.",
      ),
      upper = info(
        "upper",
        "Upper arm",
        "Links the shoulder and elbow joints.",
      ),
      elbow = info(
        "elbow",
        "Elbow joint",
        "Allows the forearm to change its angle.",
      ),
      fore = info(
        "forearm",
        "Forearm",
        "Positions the wrist and end effector.",
      ),
      grip = info(
        "gripper",
        "Gripper",
        "Holds objects at the end of the robot arm.",
      );
    mesh(
      new T.CylinderGeometry(0.55, 0.65, 0.18, 48),
      "#263b48",
      base,
      root,
      [0, -1, 0],
    );
    mesh(
      new T.CylinderGeometry(0.26, 0.3, 0.36, 48),
      "#c9cdcd",
      base,
      root,
      [0, -0.74, 0],
    );
    mesh(
      new T.CylinderGeometry(0.25, 0.25, 0.42, 48),
      "#2352aa",
      shoulder,
      root,
      [0, -0.47, 0],
      [Math.PI / 2, 0, 0],
    );
    mesh(
      new T.BoxGeometry(0.27, 0.98, 0.27),
      "#e6e2d7",
      upper,
      root,
      [0.24, -0.02, 0],
      [0, 0, -0.5],
    );
    mesh(
      new T.CylinderGeometry(0.22, 0.22, 0.4, 48),
      "#2352aa",
      elbow,
      root,
      [0.48, 0.41, 0],
      [Math.PI / 2, 0, 0],
    );
    mesh(
      new T.BoxGeometry(0.26, 0.91, 0.26),
      "#e6e2d7",
      fore,
      root,
      [0.14, 0.74, 0],
      [0, 0, 0.83],
    );
    mesh(
      new T.CylinderGeometry(0.17, 0.17, 0.3, 32),
      "#263b48",
      grip,
      root,
      [-0.19, 1.06, 0],
      [0, 0, 0.83],
    );
    mesh(
      new T.BoxGeometry(0.09, 0.32, 0.13),
      "#b7bfc1",
      grip,
      root,
      [-0.38, 1.28, -0.14],
      [0, 0, 0.83],
    );
    mesh(
      new T.BoxGeometry(0.09, 0.32, 0.13),
      "#b7bfc1",
      grip,
      root,
      [-0.38, 1.28, 0.14],
      [0, 0, 0.83],
    );
  } else if (id === "interactive") {
    const apple = info(
        "apple",
        "Apple",
        "An apple is a pome fruit: the fleshy fruit surrounds a core.",
      ),
      pear = info(
        "pear",
        "Pear",
        "Pears are pome fruits with a characteristic taper toward the stem.",
      ),
      orange = info(
        "orange",
        "Orange",
        "An orange is a citrus fruit with a peel and segmented flesh.",
      );
    const a = mesh(
      new T.SphereGeometry(0.46, 48, 32),
      "#b84737",
      apple,
      root,
      [-0.7, -0.12, 0.1],
    );
    a.scale.set(1, 1.08, 1);
    mesh(
      new T.CylinderGeometry(0.025, 0.04, 0.18, 12),
      "#625132",
      apple,
      root,
      [-0.7, 0.41, 0.1],
      [0, 0, -0.2],
    );
    const p = mesh(
      new T.SphereGeometry(0.46, 48, 32),
      "#b3b75f",
      pear,
      root,
      [0.45, -0.2, -0.08],
    );
    p.scale.set(1, 1.05, 1);
    const neck = mesh(
      new T.SphereGeometry(0.25, 32, 24),
      "#b3b75f",
      pear,
      root,
      [0.45, 0.25, -0.08],
    );
    neck.scale.set(0.85, 1.4, 0.85);
    mesh(
      new T.CylinderGeometry(0.025, 0.035, 0.19, 12),
      "#625132",
      pear,
      root,
      [0.45, 0.62, -0.08],
      [0, 0, 0.15],
    );
    mesh(
      new T.SphereGeometry(0.38, 48, 32),
      "#dc8b39",
      orange,
      root,
      [0, -0.26, 0.62],
    );
  } else {
    mesh(
      new T.SphereGeometry(0.7, 48, 32),
      "#9c4b4b",
      info(
        "heart",
        "Heart",
        "The heart pumps blood through the circulatory system.",
      ),
      root,
      [0, 0, 0],
    );
  }
  return root;
}
export async function loadModel(id: CategoryId) {
  const category = categories.find((c) => c.id === id)!;
  if (!category.asset) return procedural(id);
  const gltf = await new GLTFLoader().loadAsync(category.asset),
    root = gltf.scene;
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      const original = Array.isArray(o.material) ? o.material[0] : o.material;
      const component =
        id === "biology"
          ? (heartParts[o.name] ??
            (o.name.startsWith("VH_M_papillary_muscle")
              ? info(
                  "papillary",
                  "Papillary muscle",
                  "Helps prevent the atrioventricular valves from inverting during contraction.",
                )
              : undefined))
          : boardParts[original.name];
      if (component) o.userData.component = component;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
    }
  });
  return root;
}
export function normalizeModel(root: T.Object3D, id: CategoryId) {
  if (id === "computer") {
    root.rotation.x = -0.12;
    root.rotation.z = -0.25;
  }
  root.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(root),
    size = b.getSize(new T.Vector3()),
    center = b.getCenter(new T.Vector3());
  const wrapper = new T.Group();
  wrapper.add(root);
  root.position.sub(center);
  const scale = 2.3 / Math.max(size.x, size.y, size.z);
  wrapper.scale.setScalar(scale);
  return wrapper;
}
