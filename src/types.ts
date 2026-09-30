export type CategoryId = "biology" | "robotics" | "computer" | "interactive";
export type ViewMode = "camera" | "studio";
export type Gesture =
  "NONE" | "POINT" | "PINCH" | "OPEN_PALM" | "V_SIGN" | "FIST" | "TWO_HANDS";
export type Point = { x: number; y: number; z: number };
export type Hand = {
  landmarks: Point[];
  handedness: string;
  confidence: number;
};
export type GestureFrame = {
  gesture: Gesture;
  pointer: [number, number] | null;
  palm: [number, number] | null;
  distance: number | null;
  pinch: boolean;
  timestamp: number;
};
export type Transform = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
};
export type ComponentInfo = {
  id: string;
  name: string;
  short: string;
  description: string;
};
export type Category = {
  id: CategoryId;
  number: string;
  name: string;
  field: string;
  description: string;
  specimen: string;
  asset?: string;
  credit: string;
  source?: string;
  license?: string;
  simplified: boolean;
};
export type TrackingMessage =
  | { type: "ready" }
  | { type: "error"; message: string }
  | { type: "result"; hands: Hand[]; timestamp: number };
