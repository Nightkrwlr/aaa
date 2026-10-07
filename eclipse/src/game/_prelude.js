// ───────────────────────────────────────────────────────────────────────────────
// Prelude generado en la migración: el juego original usaba nombres minificados de
// Three r160 (Ee = Color, U = Vector3, Ge = Mesh…). Estos alias los enlazan con el
// paquete oficial three@0.160.1, de modo que el resto del código es idéntico.
// ───────────────────────────────────────────────────────────────────────────────
import { AmbientLight as ad, AnimationMixer as ld, Box3 as _i, BoxGeometry as kn, BufferAttribute as St, BufferGeometry as $t, CanvasTexture as Xc, CapsuleGeometry as Qc, CircleGeometry as _s, Color as Ee, ConeGeometry as oo, CylinderGeometry as ni, DataArrayTexture as ba, DataTexture as cl, DirectionalLight as uo, DodecahedronGeometry as lo, Euler as va, Float32BufferAttribute as ft, Fog as Vc, Group as Ve, HemisphereLight as sd, IcosahedronGeometry as ya, InstancedBufferAttribute as Vs, InstancedMesh as ys, Material as ti, Matrix4 as at, Mesh as Ge, MeshBasicMaterial as vt, MeshDepthMaterial as sl, MeshLambertMaterial as td, MeshStandardMaterial as Xt, Object3D as tn, OctahedronGeometry as _a, OrthographicCamera as $i, PlaneGeometry as Pi, PointLight as $s, Points as ro, Quaternion as Bn, Scene as qc, ShaderChunk as ct, ShaderMaterial as wn, SkinnedMesh as so, SphereGeometry as rr, SpotLight as ho, TextureLoader as Sa, TorusGeometry as Yi, Vector2 as Se, Vector3 as U, Vector4 as Bt, WebGLRenderer as al } from 'three';
import { ShaderPass as po } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { EffectComposer as md } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass as gd } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass as mo } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass as xd } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries as Ld } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader as Id } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder as nx } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as ix } from 'three/examples/jsm/utils/SkeletonUtils.js';

// constantes numéricas/cadena de Three usadas por el juego (se copian por valor)
const Bu = 2,
  Hu = 6,
  Ju = 2201,
  Ku = 2200,
  Pt = "srgb",
  Qn = 1023,
  Qt = 1006,
  Qu = 3201,
  Wi = 1,
  Yu = 1028,
  bs = 1009,
  ei = 1e3,
  en = 2,
  gl = 4,
  hi = 1001,
  ji = 1008,
  lr = 35048,
  pn = 2,
  vi = "";
