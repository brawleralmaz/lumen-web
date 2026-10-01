import type { Category } from "./types";
export const categories: Category[] = [
  {
    id: "biology",
    number: "01",
    name: "Biology",
    field: "THE LIVING WORLD",
    description: "Get closer to the structures that make us human.",
    specimen: "Human heart",
    asset: `${import.meta.env.BASE_URL}models/heart.glb`,
    credit: "Kristen Browne & Heidi Schlehlein · Human Reference Atlas",
    source: "https://humanatlas.io/3d-reference-library",
    license: "CC BY 4.0",
    simplified: false,
  },
  {
    id: "robotics",
    number: "02",
    name: "Robotics",
    field: "MECHANICS IN MOTION",
    description: "Understand how individual parts work together.",
    specimen: "Industrial robot arm",
    credit: "Lumen original educational specimen",
    simplified: true,
  },
  {
    id: "computer",
    number: "03",
    name: "Computer hardware",
    field: "INSIDE THE MACHINE",
    description: "Look beyond the screen. Discover what powers it.",
    specimen: "Motherboard & components",
    asset: `${import.meta.env.BASE_URL}models/motherboard.glb`,
    credit: "Daniel Cardona · MotherBoard + Components",
    source:
      "https://sketchfab.com/3d-models/motherboard-components-3bc94057328243d4b341a55f59160f8a",
    license: "CC BY 4.0",
    simplified: false,
  },
  {
    id: "interactive",
    number: "04",
    name: "Interactive learning",
    field: "LEARNING THROUGH PLAY",
    description: "Make discovery tangible for younger explorers.",
    specimen: "Fruit study",
    credit: "Lumen original educational specimen",
    simplified: true,
  },
];
export const byId = (id: string) => categories.find((c) => c.id === id);
export const info = (
  id: string,
  name: string,
  short: string,
  description = short,
) => ({ id, name, short, description });
