import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { compositeFragment, compositeVertex, inkUniforms, paletteUniforms } from './ink';
import { partDef } from './explode';
import { SECTION_PLANE } from './Part';
import { useStudio } from '../state';
import { drawing, type Rect } from '../drawing/layout';

/** Layer used for construction lines drawn on top of the ink composite. */
export const OVERLAY_LAYER = 1;

interface Pass {
  camera: THREE.Camera;
  /** CSS-pixel viewport, or null for the whole canvas. */
  rect: Rect | null;
  section: boolean;
  hidden: boolean;
}

function makeTarget(depth: boolean) {
  const t = new THREE.WebGLRenderTarget(1, 1, { samples: 0, type: THREE.UnsignedByteType });
  t.texture.minFilter = t.texture.magFilter = THREE.NearestFilter;
  if (depth) t.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
  return t;
}

/**
 * Takes over R3F's render loop: colour pass, normal/id pass, (in drawing
 * mode) two depth-peeled layers for hidden lines, the ink composite, then the
 * overlay layer (centre lines, explode guides, motion arcs). In drawing mode
 * every pass runs once per view, each in its own viewport.
 */
export function InkRenderer({ lineWidth = 1.15, hatch = 1 }: { lineWidth?: number; hatch?: number }) {
  const { gl, scene, camera, size } = useThree();
  const dpr = gl.getPixelRatio();

  const targets = useMemo(() => ({
    color: makeTarget(false),
    normal: makeTarget(true),
    hidden1: makeTarget(true),
    hidden2: makeTarget(true),
  }), []);

  const composite = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: compositeVertex,
      fragmentShader: compositeFragment,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      premultipliedAlpha: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        tColor: { value: targets.color.texture },
        tNormal: { value: targets.normal.texture },
        tDepth: { value: targets.normal.depthTexture },
        tHidden1N: { value: targets.hidden1.texture },
        tHidden1D: { value: targets.hidden1.depthTexture },
        tHidden2N: { value: targets.hidden2.texture },
        tHidden2D: { value: targets.hidden2.depthTexture },
        uHidden: { value: 0 },
        uDrawing: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uLine: { value: lineWidth },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uOrtho: { value: 0 },
        uInk: paletteUniforms.uInk,
        uFace: paletteUniforms.uFace,
        uHatch: { value: hatch },
        uSelId: { value: -1 },
        uAccent: paletteUniforms.uAccent,
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    const quadScene = new THREE.Scene();
    quadScene.add(quad);
    return { material, quadScene, quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [targets, lineWidth, hatch]);

  useEffect(() => {
    const w = Math.max(1, Math.floor(size.width * dpr));
    const h = Math.max(1, Math.floor(size.height * dpr));
    Object.values(targets).forEach((t) => t.setSize(w, h));
    composite.material.uniforms.uResolution.value.set(w, h);
    inkUniforms.uRes.value.set(w, h);
  }, [size, dpr, targets, composite]);

  useEffect(() => () => {
    Object.values(targets).forEach((t) => t.dispose());
    composite.material.dispose();
  }, [targets, composite]);

  useFrame(() => {
    const { selected, view, hiddenLines, section } = useStudio.getState();
    const layout = view === 'drawing' ? drawing.layout : null;
    const passes: Pass[] = layout
      // GB: hidden lines are normally left out of a sectioned view.
      ? layout.views.map((v) => ({ camera: v.camera, rect: v.rect, section: v.section, hidden: v.hidden && hiddenLines && !(v.section && section) }))
      : [{ camera, rect: null, section: true, hidden: false }];
    const anyHidden = passes.some((p) => p.hidden);

    const cam = passes[0].camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    const uniforms = composite.material.uniforms;
    uniforms.uNear.value = cam.near;
    uniforms.uFar.value = cam.far;
    uniforms.uOrtho.value = (cam as THREE.OrthographicCamera).isOrthographicCamera ? 1 : 0;
    uniforms.uSelId.value = selected ? (partDef(selected)?.index ?? -64) / 64 : -1;
    uniforms.uDrawing.value = layout ? 1 : 0;
    uniforms.uHidden.value = anyHidden ? 1 : 0;
    uniforms.uHatch.value = layout ? 0 : hatch;
    // Small screens (phones) get finer drawing lines so the views do not clog up.
    const drawingLine = layout ? THREE.MathUtils.clamp(Math.min(size.width, size.height * 1.7) / 1300, 0.7, 1.2) : 1;
    uniforms.uLine.value = lineWidth * Math.max(1, dpr * 0.85) * drawingLine;

    const background = scene.background;
    scene.background = null;
    gl.setClearColor(0x000000, 0);
    gl.autoClear = false;
    gl.localClippingEnabled = true;
    const sectionConstant = SECTION_PLANE.constant;
    const H = size.height;

    /** Render the scene once per pass into a target, each in its own viewport. */
    const renderInto = (target: THREE.WebGLRenderTarget, pass: number, filter: (p: Pass) => boolean) => {
      target.scissorTest = false;
      target.viewport.set(0, 0, target.width, target.height);
      gl.setRenderTarget(target);
      gl.clear();
      inkUniforms.uPass.value = pass;
      for (const p of passes) {
        if (!filter(p)) continue;
        if (p.rect) {
          const { x, y, w, h } = p.rect;
          target.viewport.set(x * dpr, (H - y - h) * dpr, w * dpr, h * dpr);
          target.scissor.copy(target.viewport);
          target.scissorTest = true;
        } else {
          target.viewport.set(0, 0, target.width, target.height);
          target.scissorTest = false;
        }
        gl.setRenderTarget(target);
        SECTION_PLANE.constant = p.section ? sectionConstant : 100;
        p.camera.layers.set(0);
        gl.render(scene, p.camera);
      }
      target.scissorTest = false;
      target.viewport.set(0, 0, target.width, target.height);
    };

    renderInto(targets.color, 0, () => true);
    renderInto(targets.normal, 1, () => true);
    if (anyHidden) {
      inkUniforms.uPeel.value = targets.normal.depthTexture;
      renderInto(targets.hidden1, 2, (p) => p.hidden);
      inkUniforms.uPeel.value = targets.hidden1.depthTexture;
      renderInto(targets.hidden2, 2, (p) => p.hidden);
      inkUniforms.uPeel.value = null;
    }
    inkUniforms.uPass.value = 0;
    SECTION_PLANE.constant = sectionConstant;

    gl.setRenderTarget(null);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.clear();
    gl.render(composite.quadScene, composite.quadCamera);

    for (const p of passes) {
      if (p.rect) {
        gl.setViewport(p.rect.x, H - p.rect.y - p.rect.h, p.rect.w, p.rect.h);
        gl.setScissor(p.rect.x, H - p.rect.y - p.rect.h, p.rect.w, p.rect.h);
        gl.setScissorTest(true);
      }
      p.camera.layers.set(OVERLAY_LAYER);
      gl.render(scene, p.camera);
      p.camera.layers.set(0);
    }
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    camera.layers.set(0);
    gl.autoClear = true;
    scene.background = background;
  }, 1);

  return null;
}
