/**
 * Atmósfera de Eclipse — la «mirada» de cada bioma como datos + la niebla de altura global.
 *
 *  - installWorldFog(): sustituye UNA vez los chunks de niebla de Three, de modo que todo material con niebla (terreno, props
 *    instanciados, personajes, FX con malla) recibe niebla exponencial de ALTURA (más densa a ras de suelo, se diluye hacia
 *    arriba) y un velo cálido hacia el sol, sin tocar material por material. Los valores viajan en los uniformes de niebla
 *    estándar: fogColor, fogNear (= densidad base) y fogFar (= caída con la altura).
 *  - REGION_LOOK: densidad de niebla, grade y bloom por región. Se mezclan con los colores que el juego ya definía por región.
 */
import { Color, ShaderChunk, Vector3 } from 'three';

/** objeto de niebla comprendido por los chunks parcheados (Three lo ve como una Fog lineal: isFog, color, near, far) */
export class WorldFog {
  constructor(color = 0xb8c4cf, density = 0.012, falloff = 0.05) {
    this.isFog = true; this.name = 'WorldFog';
    this.color = new Color(color); this.near = density; this.far = falloff;
  }
  get density() { return this.near; } set density(v) { this.near = v; }
  get falloff() { return this.far; } set falloff(v) { this.far = v; }
  clone() { return new WorldFog(this.color, this.near, this.far); }
}

/** dirección (hacia el sol) del velo cálido de la niebla; la cámara tiene el rumbo fijo, así que una constante se lee bien */
export const FOG_SUN = new Vector3(-0.6, 0.34, -0.72).normalize();

let installed = false;
export function installWorldFog() {
  if (installed) return;
  installed = true;
  const S = ShaderChunk;
  S.fog_pars_vertex = /* glsl */ `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWP;
#endif`;
  S.fog_vertex = /* glsl */ `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	vFogWP = cameraPosition + transpose( mat3( viewMatrix ) ) * mvPosition.xyz;
#endif`;
  S.fog_pars_fragment = /* glsl */ `
#ifdef USE_FOG
	uniform vec3 fogColor;
	uniform float fogNear;
	uniform float fogFar;
	varying float vFogDepth;
	varying vec3 vFogWP;
	const vec3 FOG_SUN_DIR = vec3( ${FOG_SUN.x.toFixed(4)}, ${FOG_SUN.y.toFixed(4)}, ${FOG_SUN.z.toFixed(4)} );
#endif`;
  S.fog_fragment = /* glsl */ `
#ifdef USE_FOG
	vec3 fogRay = vFogWP - cameraPosition;
	float fogLen = length( fogRay );
	float fogK = max( fogFar, 0.0 );
	float fogKdy = fogK * fogRay.y;
	float fogAvg = exp( - fogK * cameraPosition.y ) * ( abs( fogKdy ) < 0.001 ? 1.0 : ( 1.0 - exp( - fogKdy ) ) / fogKdy );
	float fogOD = fogNear * fogLen * min( fogAvg, 6.0 );
	float fogFactor = 1.0 - exp( - fogOD * fogOD );
	float fogSun = pow( clamp( dot( fogRay / max( fogLen, 1e-3 ), FOG_SUN_DIR ), 0.0, 1.0 ), 3.0 );
	vec3 fogCol = fogColor * ( 1.0 + fogSun * min( fogFar * 9.0, 1.0 ) * vec3( 0.50, 0.34, 0.14 ) );
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, clamp( fogFactor, 0.0, 1.0 ) );
#endif`;
}

/**
 * Mirada por región. Todos los campos son opcionales; lo que falta lo pone DEFAULT_LOOK.
 *   density/falloff  niebla de altura (densidad base, caída por metro)
 *   bloom            [fuerza, radio, umbral] de UnrealBloomPass
 *   sat/contrast     grade global      shadow/high   tinte de sombras / luces (multiplicativo)
 *   exposure         ganancia previa al mapeo tonal   vig   viñeta base   tone  0 = Neutral (fiel al albedo) … 1 = ACES (más contraste)
 */
export const DEFAULT_LOOK = {
  density: 0.008, falloff: 0.05, bloom: [0.7, 0.55, 0.85], sat: 1.06, contrast: 1.14, exposure: 1.0, vig: 0.36, lift: 0.008, tone: 0.88,
  shadow: [0.95, 0.98, 1.05], high: [1.04, 1.01, 0.95],
};
// Afinado en el laboratorio de grade (tools/scenarios/grade-lab.mjs): más contraste y sombras menos «lavadas» que el primer intento.
export const REGION_LOOK = {
  valle:    { density: 0.007, sat: 1.08, shadow: [0.93, 0.99, 1.06], high: [1.05, 1.02, 0.93], bloom: [0.6, 0.55, 0.88] },
  ciudad:   { density: 0.015, falloff: 0.055, sat: 0.94, contrast: 1.16, exposure: 0.98, shadow: [0.92, 0.99, 1.05], high: [1.0, 1.03, 0.98], bloom: [0.7, 0.6, 0.8], vig: 0.42 },
  desierto: { density: 0.010, sat: 1.06, contrast: 1.1, exposure: 0.97, shadow: [0.97, 0.96, 1.0], high: [1.12, 1.0, 0.84], bloom: [0.55, 0.6, 0.92] },
  marisma:  { density: 0.018, falloff: 0.06, sat: 1.02, shadow: [0.88, 1.0, 1.06], high: [0.98, 1.06, 0.94], bloom: [0.7, 0.65, 0.8], vig: 0.42 },
  tundra:   { density: 0.011, sat: 1.0, contrast: 1.12, shadow: [0.86, 0.96, 1.16], high: [0.98, 1.02, 1.08], bloom: [0.55, 0.6, 0.9] },
  complejo: { density: 0.013, sat: 0.96, contrast: 1.16, shadow: [0.88, 0.98, 1.12], high: [1.0, 1.02, 1.04], bloom: [0.8, 0.55, 0.78], vig: 0.42 },
  caldera:  { density: 0.015, sat: 1.14, contrast: 1.18, shadow: [0.95, 0.9, 1.04], high: [1.16, 0.96, 0.78], bloom: [1.0, 0.6, 0.7], vig: 0.42 },
  yermo:    { density: 0.011, sat: 0.92, contrast: 1.12, shadow: [0.96, 0.97, 1.03], high: [1.06, 1.02, 0.92], bloom: [0.6, 0.6, 0.88] },
  colmena:  { density: 0.016, falloff: 0.06, sat: 1.12, contrast: 1.14, shadow: [0.94, 0.88, 1.18], high: [1.04, 0.98, 1.06], bloom: [0.9, 0.7, 0.72], vig: 0.44 },
};

/** copia profunda: el renderer mezcla estos números en sitio al cruzar de bioma, así que no deben compartir arrays con las constantes */
export function lookFor(key) {
  const l = { ...DEFAULT_LOOK, ...(REGION_LOOK[key] ?? {}) };
  l.bloom = [...l.bloom]; l.shadow = [...l.shadow]; l.high = [...l.high];
  return l;
}
