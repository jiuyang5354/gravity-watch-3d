import * as THREE_NS from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { N8AOPass } from 'n8ao';
import {
  MeshBVH,
  MeshBVHUniformStruct,
  SAH,
  shaderStructs,
  shaderIntersectFunction
} from 'three-mesh-bvh';
import * as RAPIER_NS from './vendor/rapier.es.js?v=20261121_pristine_v16';

const ASSET_VER = '20261121_pristine_v16';

// Expose mutable Three r187 namespace + postprocessing/photoreal addons for classic UI modules
const mutableThree = Object.assign({}, THREE_NS);
mutableThree.HDRLoader = HDRLoader;
mutableThree.RGBELoader = HDRLoader;
window.THREE = mutableThree;
window.THREE_ADDONS = {
  EffectComposer,
  RenderPass,
  UnrealBloomPass,
  HDRLoader,
  GLTFLoader,
  N8AOPass,
  BVH: {
    MeshBVH,
    MeshBVHUniformStruct,
    SAH,
    shaderStructs,
    shaderIntersectFunction
  }
};

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${src}?v=${ASSET_VER}`;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(s);
  });
}

async function boot() {
  try {
    const rapier = RAPIER_NS.default || RAPIER_NS;
    if (rapier && typeof rapier.init === 'function') {
      await rapier.init();
    }
    window.RAPIER = rapier || null;
  } catch (err) {
    console.warn('[boot] Rapier3D WASM unavailable, falling back to analytic 3D solver:', err);
    window.RAPIER = null;
  }

  const orderedScripts = [
    'textures3d.js',
    'physics3d.js',
    'watchHardware3d.js',
    'scene3d.js',
    'app.js'
  ];

  for (const scriptPath of orderedScripts) {
    await loadClassicScript(scriptPath);
  }
}

boot().catch((err) => {
  console.error('[boot] Fatal bootstrap error:', err);
});
