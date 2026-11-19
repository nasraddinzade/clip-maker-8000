// Types of the devices and the camera (the projection itself lives in flatgeo.ts).
export type DevId = "phone" | "tablet";
export type Spec = {
  id: DevId; dir: string; dsf: number; sw: number; sh: number; // screen in CSS px of the captured window
  bez: [number, number, number, number]; // bezel top, right, bottom, left (screen CSS px)
  radius: number; // corner radius as a share of body width
  depth: number; // thickness as a share of body width
  header: number; // sticky site header height, CSS px
  base: number; // world px per screen CSS px
  world: [number, number, number];
};
export type CamW = { x: number; y: number; z: number; pitch?: number };
