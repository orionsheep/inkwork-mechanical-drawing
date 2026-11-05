import * as THREE from 'three';

/**
 * Line-art rendering.
 *
 * Every mesh uses one shared ShaderMaterial family that can write two things:
 * pass 0 a quiet paper wash (soft light, rust for cut/inner faces, accent for
 * the selected part) and pass 1 view-space normals + a part id. A fullscreen
 * composite then finds silhouettes, creases and part boundaries from the
 * normal/id/depth buffers and draws them as ink on paper.
 */

export const inkUniforms = {
  /** 0 colour, 1 normal + id, 2 normal + id of the layer behind uPeel (depth peeling). */
  uPass: { value: 0 },
  uPeel: { value: null as THREE.Texture | null },
  uRes: { value: new THREE.Vector2(1, 1) },
};

export function rgb(hex: string): THREE.Vector3 {
  const value = parseInt(hex.replace('#', ''), 16);
  return new THREE.Vector3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

export interface Palette {
  /** Sheet background. */
  paper: string;
  /** Lit and shaded faces. */
  face: string;
  shade: string;
  /** Lines. */
  ink: string;
  /** Accent: selection, callouts, guides. */
  rust: string;
  /** Section (cut) faces. */
  cut: string;
}

export type Theme = 'paper' | 'blueprint';

export const PALETTES: Record<Theme, Palette> = {
  paper: { paper: '#f4f0e7', face: '#fbf9f4', shade: '#d9d5cc', ink: '#24221f', rust: '#a8432f', cut: '#e7c3b3' },
  // Cyanotype: pale lines on Prussian blue, amber for what is picked out.
  blueprint: { paper: '#173b63', face: '#1e4672', shade: '#163758', ink: '#e8f0f9', rust: '#ffc35c', cut: '#2f5f90' },
};

/** The palette in use. setPalette changes it in place, so readers always see the current one. */
export const PALETTE: Palette = { ...PALETTES.paper };

/** Colour uniforms shared by every ink material and the composite pass. */
export const paletteUniforms = {
  uFace: { value: rgb(PALETTE.face) },
  uShade: { value: rgb(PALETTE.shade) },
  uCut: { value: rgb(PALETTE.cut) },
  uInk: { value: rgb(PALETTE.ink) },
  uAccent: { value: rgb(PALETTE.rust) },
};

/** Plain three.js line materials drawn in the ink or accent colour, recoloured with the palette. */
const tinted = new Set<{ material: THREE.LineBasicMaterial; tone: 'ink' | 'rust' }>();

export function tint<T extends THREE.LineBasicMaterial>(material: T, tone: 'ink' | 'rust'): T {
  material.color.set(PALETTE[tone]);
  const entry = { material, tone };
  tinted.add(entry);
  material.addEventListener('dispose', () => tinted.delete(entry));
  return material;
}

export function setPalette(next: Palette) {
  Object.assign(PALETTE, next);
  const u = paletteUniforms;
  u.uFace.value.copy(rgb(next.face));
  u.uShade.value.copy(rgb(next.shade));
  u.uCut.value.copy(rgb(next.cut));
  u.uInk.value.copy(rgb(next.ink));
  u.uAccent.value.copy(rgb(next.rust));
  for (const { material, tone } of tinted) material.color.set(next[tone]);
}

const vertexShader = /* glsl */ `
  #include <common>
  #include <clipping_planes_pars_vertex>
  varying vec3 vNormalV;
  varying vec3 vWorldNormal;
  void main() {
    #include <begin_vertex>
    #include <project_vertex>
    #include <clipping_planes_vertex>
    vNormalV = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <clipping_planes_pars_fragment>
  uniform int uPass;
  uniform sampler2D uPeel;
  uniform vec2 uRes;
  uniform float uPartId;
  uniform float uTone;
  uniform float uSelected;
  uniform float uHover;
  uniform vec3 uFace;
  uniform vec3 uShade;
  uniform vec3 uCut;
  uniform vec3 uAccent;
  varying vec3 vNormalV;
  varying vec3 vWorldNormal;
  void main() {
    #include <clipping_planes_fragment>
    bool inner = !gl_FrontFacing;
    vec3 n = normalize(vNormalV);
    if (inner) n = -n;
    if (uPass == 2) {
      // Depth peeling: keep only what lies behind the previous layer, so its
      // outlines become the hidden (dashed) lines of an engineering drawing.
      float front = texture2D(uPeel, gl_FragCoord.xy / uRes).x;
      if (gl_FragCoord.z <= front + 0.00002) discard;
    }
    if (uPass >= 1) {
      // Inner faces get their own id so the section cut draws a crisp outline.
      float id = inner ? fract(uPartId + 0.5) : uPartId;
      gl_FragColor = vec4(n * 0.5 + 0.5, id);
      return;
    }
    vec3 wn = normalize(vWorldNormal) * (inner ? -1.0 : 1.0);
    float key = max(dot(wn, normalize(vec3(-0.45, 0.8, 0.55))), 0.0);
    float fill = max(dot(wn, normalize(vec3(0.6, 0.2, -0.4))), 0.0);
    float light = clamp(0.38 + 0.62 * key + 0.18 * fill, 0.0, 1.0);
    light = mix(light, 1.0, 1.0 - uTone);
    vec3 col = mix(uShade, uFace, light);
    if (inner) col = mix(uCut, uFace, 0.25 + 0.35 * light);
    col = mix(col, mix(uAccent, uFace, 0.72), uSelected * 0.85);
    col = mix(col, mix(uShade, uFace, 0.5), uHover * 0.5);
    // Alpha is the "shade" signal the composite uses for graphite hatching.
    gl_FragColor = vec4(col, 1.0 - light);
  }
`;

export interface InkMaterialOptions {
  partId: number;
  /** 0 = flat paper, 1 = full soft shading. */
  tone?: number;
  clip?: THREE.Plane[];
}

export function createInkMaterial({ partId, tone = 1, clip }: InkMaterialOptions) {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    clipping: true,
    uniforms: {
      uPass: inkUniforms.uPass,
      uPeel: inkUniforms.uPeel,
      uRes: inkUniforms.uRes,
      uPartId: { value: partId },
      uTone: { value: tone },
      uSelected: { value: 0 },
      uHover: { value: 0 },
      uFace: paletteUniforms.uFace,
      uShade: paletteUniforms.uShade,
      uCut: paletteUniforms.uCut,
      uAccent: paletteUniforms.uAccent,
    },
  });
  material.clippingPlanes = clip ?? null;
  return material;
}

export const compositeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const compositeFragment = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tNormal;
  uniform sampler2D tDepth;
  /** Two peeled layers behind the visible surface (engineering-drawing mode). */
  uniform sampler2D tHidden1N;
  uniform sampler2D tHidden1D;
  uniform sampler2D tHidden2N;
  uniform sampler2D tHidden2D;
  uniform float uHidden;
  /** 0 = illustrated plate, 1 = engineering drawing (flat paper, section hatching, heavy outlines). */
  uniform float uDrawing;
  uniform vec2 uResolution;
  uniform float uLine;
  uniform float uNear;
  uniform float uFar;
  uniform float uOrtho;
  uniform vec3 uInk;
  uniform vec3 uFace;
  uniform float uHatch;
  uniform float uSelId;
  uniform vec3 uAccent;
  varying vec2 vUv;

  float linearDepth(vec2 uv) {
    float z = texture2D(tDepth, uv).x;
    if (uOrtho > 0.5) return uNear + z * (uFar - uNear);
    float ndc = z * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
  }

  bool isSel(float id) {
    return uSelId > 0.0 && (abs(id - uSelId) < 0.004 || abs(id - fract(uSelId + 0.5)) < 0.004);
  }

  // x: outline (silhouette, depth step, part boundary), y: crease, z: touches selected part
  vec3 edgeAt(vec2 uv, vec2 o, vec3 n0, float id0, float d0, bool bg0) {
    vec2 uv1 = uv + o;
    bool bg1 = texture2D(tDepth, uv1).x >= 0.99999;
    vec4 s = texture2D(tNormal, uv1);
    float sel = (!bg1 && isSel(s.a)) ? 1.0 : 0.0;
    if (bg0 != bg1) return vec3(1.0, 0.0, sel);
    if (bg0) return vec3(0.0);
    if (abs(s.a - id0) > 0.002) return vec3(1.0, 0.0, sel);
    vec3 n1 = s.rgb * 2.0 - 1.0;
    float nEdge = smoothstep(0.18, 0.45, 1.0 - dot(n0, n1));
    float d1 = linearDepth(uv1);
    // Surfaces seen edge-on change depth quickly per pixel; raise the bar there.
    float graze = 1.0 - clamp(abs(n0.z), 0.0, 1.0);
    float t = 0.01 + 0.12 * graze * graze;
    // Orthographic cameras sit far away, so compare depth steps in scene units.
    float rel = uOrtho > 0.5 ? abs(d1 - d0) / 5.0 : abs(d1 - d0) / d0;
    float dEdge = smoothstep(t, t * 2.2, rel);
    return vec3(dEdge, nEdge, sel);
  }

  /** Outline strength inside one peeled layer (orthographic depth only). */
  float layerEdge(sampler2D tn, sampler2D td, vec2 uv, vec2 o) {
    float z0 = texture2D(td, uv).x;
    bool b0 = z0 >= 0.99999;
    vec4 s0 = texture2D(tn, uv);
    vec3 n0 = s0.rgb * 2.0 - 1.0;
    float e = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 d = i == 0 ? vec2(o.x, 0.0) : i == 1 ? vec2(-o.x, 0.0) : i == 2 ? vec2(0.0, o.y) : vec2(0.0, -o.y);
      float z1 = texture2D(td, uv + d).x;
      bool b1 = z1 >= 0.99999;
      if (b0 != b1) { e = 1.0; continue; }
      if (b0) continue;
      vec4 s1 = texture2D(tn, uv + d);
      if (abs(s1.a - s0.a) > 0.002) { e = 1.0; continue; }
      float nEdge = smoothstep(0.18, 0.45, 1.0 - dot(n0, s1.rgb * 2.0 - 1.0));
      float dEdge = smoothstep(0.02, 0.05, abs(z1 - z0) * (uFar - uNear));
      e = max(e, max(nEdge, dEdge));
    }
    return e;
  }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  /** Thin straight hatch lines; dir 1 = 45°, -1 = 135°. */
  float hatchLines(vec2 p, float dir, float spacing) {
    float t = (p.x - dir * p.y) * 0.7071;
    float dist = abs(fract(t / spacing) - 0.5) * spacing;
    return 1.0 - smoothstep(0.45, 1.25, dist);
  }

  void main() {
    vec2 px = 1.0 / uResolution;
    bool bg = texture2D(tDepth, vUv).x >= 0.99999;
    vec4 c = texture2D(tColor, vUv);
    vec4 s = texture2D(tNormal, vUv);
    vec3 n0 = s.rgb * 2.0 - 1.0;
    float d0 = bg ? 1.0 : linearDepth(vUv);

    vec2 o = px * uLine;
    vec3 e = vec3(0.0);
    vec2 dirs[8];
    dirs[0] = vec2(1.0, 0.0); dirs[1] = vec2(-1.0, 0.0); dirs[2] = vec2(0.0, 1.0); dirs[3] = vec2(0.0, -1.0);
    dirs[4] = vec2(0.7, 0.7); dirs[5] = vec2(-0.7, -0.7); dirs[6] = vec2(0.7, -0.7); dirs[7] = vec2(-0.7, 0.7);
    for (int i = 0; i < 8; i++) {
      float w = i < 4 ? 1.0 : 0.6;
      vec3 r = edgeAt(vUv, dirs[i] * o, n0, s.a, d0, bg);
      e = max(e, vec3(r.xy * w, r.z * step(0.01, r.x)));
    }
    // Outlines get a second, wider ring so silhouettes read heavier than creases.
    for (int i = 0; i < 4; i++) {
      vec3 r = edgeAt(vUv, dirs[i] * o * 1.45, n0, s.a, d0, bg);
      e.x = max(e.x, r.x * 0.45);
      e.z = max(e.z, r.z * step(0.01, r.x));
    }
    float selHere = (!bg && isSel(s.a)) ? 1.0 : 0.0;

    vec3 col = c.rgb;
    float alpha = bg ? 0.0 : 1.0;
    bool cut = !bg && s.a > 0.5;

    if (uDrawing > 0.5 && !bg) {
      // Engineering drawing: flat paper faces, the selected part lightly tinted,
      // and 45° section lining on cut faces, alternating direction by part.
      col = mix(uFace, mix(uAccent, uFace, 0.8), selHere);
      if (cut) {
        float index = floor(fract(s.a + 0.5) * 64.0 + 0.5);
        float dir = mod(index, 2.0) < 0.5 ? 1.0 : -1.0;
        float spacing = (6.0 + mod(index, 3.0)) * max(1.0, uLine * 0.8);
        float h = hatchLines(gl_FragCoord.xy, dir, spacing);
        col = mix(col, mix(uInk, uAccent, selHere * 0.9), h * 0.85);
      }
    } else if (!bg && uHatch > 0.0) {
      // Graphite: diagonal hatching on faces turned from the light, plus faint grain.
      vec2 p = gl_FragCoord.xy / max(1.0, uLine * 0.9);
      float shade = c.a;
      float line1 = 1.0 - smoothstep(0.0, 1.0, abs(fract((p.x + p.y) / 6.0) - 0.5) * 2.0 / 0.22);
      float line2 = 1.0 - smoothstep(0.0, 1.0, abs(fract((p.x - p.y) / 6.0) - 0.5) * 2.0 / 0.22);
      float h = line1 * smoothstep(0.3, 0.5, shade) + line2 * smoothstep(0.5, 0.7, shade);
      col = mix(col, uInk, clamp(h, 0.0, 1.0) * 0.13 * uHatch);
      col *= 1.0 - 0.03 * hash(floor(gl_FragCoord.xy)) * uHatch;
    }

    float outline = clamp(e.x, 0.0, 1.0) * 0.94;
    float crease = clamp(e.y, 0.0, 1.0) * mix(0.55, 0.94, uDrawing);
    float ink = max(outline, crease);
    float selected = max(e.z, selHere * step(0.01, outline));
    vec3 inkCol = mix(uInk, uAccent, selected * 0.9);

    if (uHidden > 0.5 && !bg) {
      // Hidden outlines: edges of the peeled layers, wherever no visible line
      // is drawn, as a thin dashed line.
      vec2 ho = px * max(1.0, uLine * 0.7);
      float h = max(layerEdge(tHidden1N, tHidden1D, vUv, ho), layerEdge(tHidden2N, tHidden2D, vUv, ho));
      float dashLen = 9.0 * max(1.0, uLine * 0.8);
      float dash = step(fract((gl_FragCoord.x + gl_FragCoord.y) / dashLen), 0.62);
      float hidden = h * dash * (1.0 - smoothstep(0.15, 0.4, ink)) * 0.7;
      col = mix(col, uInk, hidden);
    }

    col = bg ? inkCol : mix(col, inkCol, ink);
    alpha = max(alpha, ink);
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;
