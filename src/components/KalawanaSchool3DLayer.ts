import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';

// ── Anchor & Scale Constants ───────────────────────────────────
// Wikipedia / Wikidata WGS84 coordinates for Kalawana National School
export const KALAWANA_ANCHOR_LAT = 6.535472;
export const KALAWANA_ANCHOR_LNG = 80.401000;

export const SCALE = 0.16;
export const OX = 384;
export const OY = 270;

export interface CalibrationConfig {
  scaleMultiplier: number;  // 1.0 = default (0.16)
  rotationAngle: number;    // degrees (-180 to +180)
  latOffsetMeters: number;  // meters North (+)/South (-)
  lngOffsetMeters: number;  // meters East (+)/West (-)
  altitudeMeters: number;   // meters Up (+)/Down (-)
}

export const DEFAULT_CALIBRATION: CalibrationConfig = {
  scaleMultiplier: 1.0,
  rotationAngle: 0,
  latOffsetMeters: 0,
  lngOffsetMeters: 0,
  altitudeMeters: 0,
};

const STORAGE_KEY = 'kalawana_3d_calibration_config';

export function getSavedCalibration(): CalibrationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CALIBRATION, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Failed to load saved 3D calibration:', e);
  }
  return { ...DEFAULT_CALIBRATION };
}

export function saveCalibration(config: CalibrationConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save 3D calibration:', e);
  }
}

export interface BuildingData {
  corners: [number, number][];
  cat: 'main' | 'road' | 'out';
  height?: number;
  roof?: 'hip' | 'flat';
}

// ── Digitized Footprints (39 Buildings extracted from map image) ──
export const BUILDINGS_DATA: BuildingData[] = [
  // roadside buildings
  { corners: [[207.8, 57.6], [199.2, 40.4], [213.2, 33.4], [221.8, 50.6]], cat: 'road', height: 3.35, roof: 'hip' },
  { corners: [[281.0, 97.0], [263.0, 97.0], [263.0, 83.0], [281.0, 83.0]], cat: 'road', height: 3.24, roof: 'hip' },
  { corners: [[278.0, 124.0], [272.8, 103.1], [310.9, 93.5], [316.1, 114.5]], cat: 'road', height: 4.25, roof: 'hip' },
  { corners: [[208.6, 146.2], [186.6, 102.2], [201.8, 94.6], [223.8, 138.6]], cat: 'road', height: 4.44, roof: 'hip' },
  { corners: [[263.4, 141.0], [257.9, 127.2], [272.9, 121.2], [278.4, 135.0]], cat: 'road', height: 3.21, roof: 'hip' },
  { corners: [[247.0, 144.0], [230.0, 144.0], [230.0, 128.0], [247.0, 128.0]], cat: 'road', height: 3.29, roof: 'hip' },
  { corners: [[540.7, 170.9], [525.8, 112.4], [545.3, 107.4], [560.3, 165.9]], cat: 'road', height: 4.6, roof: 'hip' },
  { corners: [[113.5, 165.5], [107.5, 123.5], [131.2, 120.1], [137.2, 162.1]], cat: 'road', height: 4.6, roof: 'hip' },
  { corners: [[84.8, 166.8], [71.2, 129.7], [90.2, 122.7], [103.8, 159.8]], cat: 'road', height: 4.4, roof: 'hip' },
  { corners: [[1.2, 180.4], [-3.0, 172.0], [12.2, 164.4], [16.4, 172.8]], cat: 'road', height: 3.0, roof: 'hip' },
  { corners: [[32.8, 192.6], [24.2, 175.4], [42.2, 166.4], [50.8, 183.6]], cat: 'road', height: 3.52, roof: 'hip' },
  { corners: [[9.1, 211.5], [-3.0, 188.5], [19.0, 176.9], [31.1, 200.0]], cat: 'road', height: 3.97, roof: 'hip' },
  // main school complex
  { corners: [[483.9, 247.0], [472.6, 216.9], [491.9, 209.7], [503.2, 239.8]], cat: 'main', height: 4.57, roof: 'hip' },
  { corners: [[461.4, 256.2], [447.7, 217.4], [462.1, 212.2], [475.9, 251.1]], cat: 'main', height: 4.49, roof: 'hip' },
  { corners: [[423.0, 251.1], [416.8, 234.6], [445.9, 223.7], [452.1, 240.2]], cat: 'main', height: 4.35, roof: 'hip' },
  // outbuildings
  { corners: [[525.8, 260.9], [522.2, 234.1], [540.3, 231.7], [543.9, 258.5]], cat: 'out', height: 3.6, roof: 'hip' },
  // main school complex
  { corners: [[376.6, 271.2], [369.6, 257.2], [398.4, 242.8], [405.4, 256.8]], cat: 'main', height: 4.27, roof: 'hip' },
  { corners: [[429.7, 274.1], [423.6, 255.8], [453.0, 246.0], [459.1, 264.3]], cat: 'main', height: 4.48, roof: 'hip' },
  // outbuildings
  { corners: [[195.5, 294.6], [193.5, 256.0], [222.5, 254.5], [224.5, 293.1]], cat: 'out', height: 4.5, roof: 'hip' },
  // main school complex
  { corners: [[471.0, 301.9], [458.6, 272.1], [468.6, 267.9], [481.1, 297.7]], cat: 'main', height: 3.94, roof: 'hip' },
  { corners: [[418.4, 328.7], [391.9, 266.9], [410.3, 259.0], [436.8, 320.8]], cat: 'main', height: 5.1, roof: 'hip' },
  { corners: [[362.1, 326.9], [355.0, 307.4], [396.1, 292.4], [403.2, 311.9]], cat: 'main', height: 5.09, roof: 'hip' },
  { corners: [[485.2, 335.4], [475.3, 314.2], [486.6, 308.9], [496.5, 330.1]], cat: 'main', height: 3.82, roof: 'hip' },
  { corners: [[278.3, 348.9], [271.6, 332.0], [331.6, 308.0], [338.3, 324.9]], cat: 'main', height: 5.1, roof: 'hip' },
  { corners: [[376.0, 350.1], [370.6, 329.4], [399.0, 321.9], [404.4, 342.6]], cat: 'main', height: 4.51, roof: 'hip' },
  { corners: [[463.5, 354.6], [453.6, 333.1], [470.8, 325.2], [480.8, 346.6]], cat: 'main', height: 4.13, roof: 'hip' },
  { corners: [[324.9, 362.0], [319.6, 345.0], [359.6, 332.6], [364.9, 349.5]], cat: 'main', height: 4.72, roof: 'hip' },
  { corners: [[428.3, 366.6], [423.3, 355.0], [451.5, 342.9], [456.5, 354.5]], cat: 'main', height: 4.02, roof: 'hip' },
  { corners: [[254.5, 363.5], [251.2, 353.6], [258.4, 351.2], [261.7, 361.1]], cat: 'main', height: 3.37, roof: 'hip' },
  { corners: [[297.5, 401.7], [288.7, 382.5], [338.9, 359.4], [347.7, 378.5]], cat: 'main', height: 5.1, roof: 'hip' },
  { corners: [[501.0, 418.0], [481.8, 360.4], [500.7, 354.1], [519.9, 411.7]], cat: 'main', height: 5.1, roof: 'hip' },
  { corners: [[283.1, 413.5], [263.0, 365.6], [276.8, 359.8], [297.0, 407.6]], cat: 'main', height: 4.85, roof: 'hip' },
  { corners: [[403.5, 409.4], [396.3, 393.4], [443.8, 372.0], [451.0, 388.0]], cat: 'main', height: 5.09, roof: 'hip' },
  { corners: [[474.9, 427.3], [453.3, 366.5], [469.7, 360.7], [491.2, 421.5]], cat: 'main', height: 5.1, roof: 'hip' },
  { corners: [[395.3, 433.7], [388.6, 418.2], [441.1, 395.7], [447.8, 411.2]], cat: 'main', height: 5.1, roof: 'hip' },
  { corners: [[303.6, 443.0], [294.1, 427.5], [350.1, 393.2], [359.6, 408.6]], cat: 'main', height: 5.1, roof: 'hip' },
  { corners: [[439.8, 437.7], [432.6, 422.1], [462.0, 408.6], [469.2, 424.3]], cat: 'main', height: 4.36, roof: 'hip' },
  // outbuildings
  { corners: [[349.2, 501.6], [336.2, 484.3], [362.8, 464.4], [375.8, 481.7]], cat: 'out', height: 4.1, roof: 'hip' },
  { corners: [[9.0, 544.0], [1.0, 544.0], [1.0, 524.0], [9.0, 524.0]], cat: 'out', height: 2.89, roof: 'hip' },
];

export const TREE_SPOTS: [number, number][] = [
  [40, 235], [60, 290], [80, 340], [30, 390], [10, 290], [680, 250], [700, 290],
  [690, 390], [670, 440], [600, 460], [170, 500], [130, 460], [90, 480],
  [700, 150], [715, 195], [730, 240], [230, 460], [560, 300], [580, 350],
];

export const ROAD_STRIPS: { points: [number, number][]; width: number }[] = [
  { points: [[-30, 205], [0, 197], [100, 178], [250, 112], [400, 85], [560, 70], [700, 50], [768, 8]], width: 5.5 },
  { points: [[700, 50], [740, -10]], width: 4.5 },
  { points: [[622, 8], [615, 120], [625, 260], [648, 400], [660, 555]], width: 3.2 },
  { points: [[0, 465], [40, 505], [90, 535], [140, 552], [200, 555]], width: 2.4 },
];

// ── Palette by Building Category ───────────────────────────────
export const PALETTE = {
  main: { wall: 0xc9b28a, roof: 0xb0503a, edge: 0x8a6a4b },
  road: { wall: 0xaeb9d6, roof: 0x5f6f95, edge: 0x76839f },
  out: { wall: 0x93a0bd, roof: 0x475269, edge: 0x60708e },
};

// ── Helper: Pixel space → Local ENU Meters ─────────────────────
export function toWorld(px: number, py: number) {
  return { x: (px - OX) * SCALE, z: (py - OY) * SCALE };
}

// ── Helper: THREE.Shape from Footprint ─────────────────────────
function shapeFromWorldPts(pts: { x: number; z: number }[]) {
  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x, -p.z);
    else shape.lineTo(p.x, -p.z);
  });
  shape.closePath();
  return shape;
}

// ── Helper: Extrude Footprint Polygon ──────────────────────────
function extrudeFootprint(pts: { x: number; z: number }[], height: number) {
  const shape = shapeFromWorldPts(pts);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export interface KalawanaCustomLayerInterface extends maplibregl.CustomLayerInterface {
  setCalibration(config: Partial<CalibrationConfig>): void;
  getCalibration(): CalibrationConfig;
}

// ── MapLibre CustomLayerInterface Factory ──────────────────────
export function createKalawanaSchool3DLayer(
  id = 'kalawana-school-3d',
  initialCalibration?: CalibrationConfig
): KalawanaCustomLayerInterface {
  let camera: THREE.Camera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer;
  let mapInstance: maplibregl.Map;

  let currentCalibration: CalibrationConfig = {
    ...getSavedCalibration(),
    ...(initialCalibration || {}),
  };

  const layer: KalawanaCustomLayerInterface = {
    id,
    type: 'custom',
    renderingMode: '3d',

    setCalibration(config: Partial<CalibrationConfig>) {
      currentCalibration = { ...currentCalibration, ...config };
      saveCalibration(currentCalibration);
      mapInstance?.triggerRepaint();
    },

    getCalibration() {
      return { ...currentCalibration };
    },

    onAdd(map: maplibregl.Map, gl: WebGLRenderingContext) {
      mapInstance = map;
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Lighting Setup matching prototype
      const hemi = new THREE.HemisphereLight(0x9db8e8, 0x1a2a1a, 1.2);
      scene.add(hemi);

      const sun = new THREE.DirectionalLight(0xfff3df, 1.5);
      sun.position.set(-60, 90, 40);
      scene.add(sun);

      const fill = new THREE.DirectionalLight(0x88a4ff, 0.4);
      fill.position.set(60, 40, -60);
      scene.add(fill);

      // Build 39 Buildings
      BUILDINGS_DATA.forEach((b) => {
        const worldPts = b.corners.map(([px, py]) => toWorld(px, py));
        const wallH = b.height ?? 3.4;
        const colors = PALETTE[b.cat] || PALETTE.out;

        // Walls — extruded directly from real footprint polygon
        const wallGeo = extrudeFootprint(worldPts, wallH);
        const wallMat = new THREE.MeshStandardMaterial({
          color: colors.wall,
          roughness: 0.85,
          metalness: 0.02,
          side: THREE.DoubleSide,
        });
        const wall = new THREE.Mesh(wallGeo, wallMat);
        scene.add(wall);

        // Base plinth — short footprint extrusion underneath
        const plinthGeo = extrudeFootprint(worldPts, 0.3);
        const plinthMat = new THREE.MeshStandardMaterial({ color: colors.edge, roughness: 1, side: THREE.DoubleSide });
        const plinth = new THREE.Mesh(plinthGeo, plinthMat);
        plinth.position.y = -0.02;
        scene.add(plinth);

        // Centroid & edge orientation derived from exact corner points
        const cx = worldPts.reduce((s, p) => s + p.x, 0) / worldPts.length;
        const cz = worldPts.reduce((s, p) => s + p.z, 0) / worldPts.length;
        const v1 = { x: worldPts[1].x - worldPts[0].x, z: worldPts[1].z - worldPts[0].z };
        const v2 = { x: worldPts[2].x - worldPts[1].x, z: worldPts[2].z - worldPts[1].z };
        const wLen = Math.hypot(v1.x, v1.z);
        const dLen = Math.hypot(v2.x, v2.z);
        const theta = Math.atan2(-v1.z, v1.x);

        if ((b.roof ?? 'hip') === 'hip') {
          const roofH = Math.min(wLen, dLen) * 0.35;
          // 4-sided pyramid cone: rotate geometry 45 deg before scaling to prevent distortion
          const roofGeo = new THREE.ConeGeometry(1, roofH, 4, 1);
          roofGeo.rotateY(Math.PI / 4);
          const roofMat = new THREE.MeshStandardMaterial({ color: colors.roof, roughness: 0.7, side: THREE.DoubleSide });
          const roof = new THREE.Mesh(roofGeo, roofMat);
          const overhang = 1.1;
          roof.scale.set((wLen * overhang) / Math.SQRT2, 1, (dLen * overhang) / Math.SQRT2);
          roof.rotation.y = theta;
          roof.position.set(cx, wallH + roofH / 2 - 0.02, cz);
          scene.add(roof);
        } else {
          const roofGeo = new THREE.BoxGeometry(wLen + 0.2, 0.25, dLen + 0.2);
          const roofMat = new THREE.MeshStandardMaterial({ color: colors.roof, roughness: 0.7, side: THREE.DoubleSide });
          const roof = new THREE.Mesh(roofGeo, roofMat);
          roof.rotation.y = theta;
          roof.position.set(cx, wallH + 0.15, cz);
          scene.add(roof);
        }
      });

      // Add Trees
      TREE_SPOTS.forEach(([px, py]) => {
        const s = 0.8 + Math.random() * 0.6;
        const { x, z } = toWorld(px, py);
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12 * s, 0.16 * s, 1.2 * s, 6),
          new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 })
        );
        trunk.position.y = 0.6 * s;
        const foliage = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1.1 * s, 0),
          new THREE.MeshStandardMaterial({ color: 0x2f5334, roughness: 1 })
        );
        foliage.position.y = 1.7 * s;
        g.add(trunk, foliage);
        g.position.set(x, 0, z);
        scene.add(g);
      });

      // Road strips removed per request

      // Initialize WebGLRenderer sharing MapLibre context
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },

    render(_gl: WebGLRenderingContext | CanvasRenderingContext2D, options: maplibregl.CustomRenderMethodInput | any) {
      const matrixObj =
        options?.defaultProjectionData?.mainMatrix ||
        options?.modelViewProjectionMatrix ||
        options?.matrix ||
        (options && ArrayBuffer.isView(options) ? options : null);

      if (!matrixObj) return;

      const matrixArr = Array.from(matrixObj as number[]);
      if (matrixArr.length < 16) return;

      // Convert lat/lng offsets in meters to degree deltas
      const dLat = (currentCalibration.latOffsetMeters || 0) / 111320;
      const dLng = (currentCalibration.lngOffsetMeters || 0) / (111320 * Math.cos((KALAWANA_ANCHOR_LAT * Math.PI) / 180));

      const anchorLat = KALAWANA_ANCHOR_LAT + dLat;
      const anchorLng = KALAWANA_ANCHOR_LNG + dLng;

      const anchorMerc = maplibregl.MercatorCoordinate.fromLngLat(
        [anchorLng, anchorLat],
        currentCalibration.altitudeMeters || 0
      );

      const baseScale = anchorMerc.meterInMercatorCoordinateUnits();
      const effectiveScale = baseScale * (currentCalibration.scaleMultiplier || 1.0);

      // Official Mapbox / MapLibre GL Three.js custom layer matrix transformation with scale & rotation calibration
      const rotationX = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(1, 0, 0),
        Math.PI / 2
      );

      const rotationZ = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(0, 0, 1),
        ((currentCalibration.rotationAngle || 0) * Math.PI) / 180
      );

      const l = new THREE.Matrix4()
        .makeTranslation(anchorMerc.x, anchorMerc.y, anchorMerc.z)
        .scale(new THREE.Vector3(effectiveScale, -effectiveScale, effectiveScale))
        .multiply(rotationX)
        .multiply(rotationZ);

      const m = new THREE.Matrix4().fromArray(matrixArr);
      camera.projectionMatrix = m.multiply(l);

      renderer.resetState();
      renderer.render(scene, camera);
      mapInstance.triggerRepaint();
    },
  };

  return layer;
}
