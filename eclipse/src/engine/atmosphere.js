/**
 * Atmósfera de Eclipse — la «mirada» de cada bioma como datos + la niebla de altura global.
 *
 *  - installWorldFog(): sustituye UNA vez los chunks de niebla de Three, de modo que todo material con niebla (terreno, props
 *    instanciados, personajes, FX con malla) recibe niebla exponencial de ALTURA (más densa a ras de suelo, se diluye hacia
 *    arriba) y un velo cálido hacia el sol, sin tocar material por material. Los valores viajan en los uniformes de niebla
 *    estándar: fogColor, fogNear (= densidad base) y fogFar (= caída con la altura).
 *  - REGION_LOOK: densidad de niebla, grade y bloom por región. Se mezclan con los colores que el juego ya definía por región.
 */
import { Color, Mesh, PlaneGeometry, ShaderChunk, ShaderMaterial, Vector3 } from 'three';

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
  density: 0.008, falloff: 0.05, bloom: [0.7, 0.55, 0.85], sat: 1.06, contrast: 1.14, exposure: 1.0, vig: 0.36, lift: 0.008, tone: 0.88, mist: 0,
  shadow: [0.95, 0.98, 1.05], high: [1.04, 1.01, 0.95],
};
// Afinado en el laboratorio de grade (tools/scenarios/grade-lab.mjs): más contraste y sombras menos «lavadas» que el primer intento.
export const REGION_LOOK = {
  valle:    { density: 0.007, sat: 1.08, shadow: [0.93, 0.99, 1.06], high: [1.05, 1.02, 0.93], bloom: [0.6, 0.55, 0.88] },
  ciudad:   { density: 0.015, falloff: 0.055, sat: 0.94, contrast: 1.16, exposure: 0.98, shadow: [0.92, 0.99, 1.05], high: [1.0, 1.03, 0.98], bloom: [0.7, 0.6, 0.8], vig: 0.42 },
  desierto: { density: 0.0085, sat: 1.04, contrast: 1.15, exposure: 0.95, shadow: [0.97, 0.96, 1.0], high: [1.12, 1.0, 0.84], bloom: [0.55, 0.6, 0.92] },
  marisma:  { density: 0.018, falloff: 0.06, sat: 1.02, shadow: [0.88, 1.0, 1.06], high: [0.98, 1.06, 0.94], bloom: [0.7, 0.65, 0.8], vig: 0.42 },
  tundra:   { density: 0.011, sat: 1.0, contrast: 1.12, shadow: [0.86, 0.96, 1.16], high: [0.98, 1.02, 1.08], bloom: [0.55, 0.6, 0.9] },
  complejo: { density: 0.013, sat: 0.96, contrast: 1.16, shadow: [0.88, 0.98, 1.12], high: [1.0, 1.02, 1.04], bloom: [0.8, 0.55, 0.78], vig: 0.42 },
  caldera:  { density: 0.015, sat: 1.14, contrast: 1.18, shadow: [0.95, 0.9, 1.04], high: [1.16, 0.96, 0.78], bloom: [1.0, 0.6, 0.7], vig: 0.42 },
  yermo:    { density: 0.011, sat: 0.7, contrast: 1.15, shadow: [0.93, 0.96, 1.05], high: [1.03, 1.0, 0.95], bloom: [0.6, 0.6, 0.88] },
  colmena:  { density: 0.016, falloff: 0.06, sat: 1.08, contrast: 1.16, exposure: 0.94, shadow: [0.94, 0.9, 1.14], high: [1.04, 0.99, 1.04], bloom: [0.62, 0.66, 0.82], vig: 0.44 },
};

/** copia profunda: el renderer mezcla estos números en sitio al cruzar de bioma, así que no deben compartir arrays con las constantes */
export function lookFor(key) {
  const l = { ...DEFAULT_LOOK, ...(REGION_LOOK[key] ?? {}) };
  l.bloom = [...l.bloom]; l.shadow = [...l.shadow]; l.high = [...l.high];
  return l;
}

/** «mirada» de las operaciones (interiores) por tema: se mezcla sobre DEFAULT_LOOK; la luz ambiente (hemisferio) sale del color de cielo/niebla del tema */
export const THEME_LOOK = {
  ruinas:       { density: 0.016, sat: 0.92, contrast: 1.14, shadow: [0.92, 0.97, 1.06], high: [1.04, 1.01, 0.94], bloom: [0.65, 0.6, 0.85] },
  bunker:       { density: 0.020, sat: 0.9, contrast: 1.18, shadow: [0.88, 1.02, 1.0], high: [0.98, 1.04, 0.96], bloom: [0.8, 0.5, 0.8], vig: 0.5 },
  laboratorio:  { density: 0.012, sat: 0.9, contrast: 1.1, shadow: [0.9, 1.0, 1.12], high: [0.98, 1.03, 1.06], bloom: [0.95, 0.55, 0.72], vig: 0.42 },
  fabrica:      { density: 0.019, sat: 0.98, contrast: 1.16, shadow: [0.98, 0.94, 0.98], high: [1.1, 1.0, 0.86], bloom: [0.8, 0.55, 0.78], vig: 0.48 },
  caverna:      { density: 0.017, sat: 1.0, contrast: 1.14, shadow: [0.84, 0.96, 1.2], high: [0.96, 1.03, 1.1], bloom: [0.9, 0.6, 0.75], vig: 0.46 },
  magma:        { density: 0.018, sat: 1.14, contrast: 1.2, shadow: [0.98, 0.88, 1.0], high: [1.16, 0.94, 0.78], bloom: [1.1, 0.6, 0.65], vig: 0.48 },
  sotano:       { density: 0.020, sat: 0.9, contrast: 1.16, shadow: [0.9, 0.98, 1.06], high: [1.02, 1.0, 0.92], bloom: [0.7, 0.55, 0.8], vig: 0.5 },
  planta:       { density: 0.014, sat: 0.94, contrast: 1.12, shadow: [0.93, 0.99, 1.06], high: [1.04, 1.02, 0.96], bloom: [0.7, 0.55, 0.82], vig: 0.42 },
  alcantarilla: { density: 0.022, falloff: 0.06, sat: 0.96, contrast: 1.16, shadow: [0.88, 1.04, 0.98], high: [0.98, 1.06, 0.88], bloom: [0.7, 0.6, 0.8], vig: 0.5 },
  gruta:        { density: 0.020, falloff: 0.06, sat: 1.04, contrast: 1.14, shadow: [0.86, 1.02, 1.1], high: [0.96, 1.08, 1.02], bloom: [0.9, 0.65, 0.74], vig: 0.48 },
  colmena:      { density: 0.021, falloff: 0.06, sat: 1.14, contrast: 1.16, shadow: [0.94, 0.86, 1.2], high: [1.06, 0.96, 1.08], bloom: [1.0, 0.7, 0.7], vig: 0.5 },
};
/**
 * Clima por región cuando el dato `De[i].weather` se queda corto para la dirección de arte: el mapa {tipo: intensidad} sustituye al dato.
 * caldera = brasas + ceniza (volcán), yermo = ceniza + polvo fino, complejo = chispas + polvo industrial.
 */
export const REGION_WEATHER = {
  caldera: { embers: 1, ash: 0.5 }, yermo: { ash: 0.85, dust: 0.3 }, complejo: { embers: 0.5, dust: 0.3 },
};
/** clima de interior por tema (la intensidad la limita WeatherFx): partículas suaves que dan vida a las operaciones */
export const THEME_WEATHER = {
  ruinas: ['dust', 0.5], bunker: ['dust', 0.35], fabrica: ['dust', 0.5], caverna: ['snow', 0.45], magma: ['embers', 0.7],
  alcantarilla: ['spores', 0.3], gruta: ['spores', 0.7], colmena: ['spores', 0.85], laboratorio: ['dust', 0.2],
};
export function lookForTheme(theme) {
  const l = { ...DEFAULT_LOOK, ...(THEME_LOOK[theme] ?? {}) };
  l.bloom = [...l.bloom]; l.shadow = [...l.shadow]; l.high = [...l.high];
  return l;
}

/**
 * Ciclo día/noche como función pura del reloj del juego (0..1; la noche del juego es 0,6‥0,97, con rampas 0,6‥0,66 y 0,92‥0,97).
 * El «horizonte» del sol cae en mitad de cada rampa, así que el atardecer coincide con el encendido de las farolas.
 *   el   elevación del sol (seno): 1 mediodía … 0 horizonte … -1 medianoche (la luna)
 *   twi  luz rasante/arrebol: 1 con el sol en el horizonte, se apaga en ~30 s de juego a cada lado
 *   u    recorrido del sol por el cielo 0..1 (mañana → tarde); q recorrido de la luna 0..1
 */
const SUN_RISE = 0.945, SUN_SET = 0.63;
const DAY_LEN = (SUN_SET - SUN_RISE + 1) % 1;
export function dayState(t, out = {}) {
  const p = (((t - SUN_RISE) % 1) + 1) % 1;
  if (p < DAY_LEN) { const u = p / DAY_LEN; out.el = Math.sin(Math.PI * u); out.u = u; out.q = 0; }
  else { const q = (p - DAY_LEN) / (1 - DAY_LEN); out.el = -Math.sin(Math.PI * q); out.u = 1; out.q = q; }
  const k = out.el / 0.34;
  out.twi = Math.exp(-k * k);
  return out;
}

/**
 * Fondo degradado a pantalla completa (una sola malla, sin textura): horizonte de niebla abajo, cielo arriba, resplandor del sol bajo,
 * estrellas y luna de noche. Solo se ve donde no hay terreno (bordes del mapa, vacío de las mazmorras); se dibuja el primero y sin profundidad.
 */
export class SkyBackdrop {
  constructor() {
    this.material = new ShaderMaterial({
      depthTest: false, depthWrite: false, fog: false,
      uniforms: {
        uFog: { value: new Color() }, uTop: { value: new Color() }, uGlowCol: { value: new Color(1, 0.5, 0.2) },
        uGlow: { value: 0 }, uStar: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1.78 }, uMoonCol: { value: new Color(0.62, 0.74, 1.0) },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4( position.xy, 1.0, 1.0 ); }',
      fragmentShader: /* glsl */ `
varying vec2 vUv; uniform vec3 uFog, uTop, uGlowCol, uMoonCol; uniform float uGlow, uStar, uTime, uAspect;
float h21( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
void main() {
  float y = vUv.y;
  vec3 c = mix( uFog, uTop, smoothstep( 0.0, 1.0, y ) * 0.9 );
  // resplandor del sol bajo: el sol queda detrás y a la izquierda de la cámara isométrica
  vec2 dg = ( vUv - vec2( 0.26, 0.86 ) ) * vec2( uAspect, 1.0 );
  c += uGlowCol * uGlow * ( exp( - dot( dg, dg ) * 2.6 ) + 0.35 * exp( - abs( y - 0.55 ) * 5.0 ) );
  if ( uStar > 0.01 ) {
    vec2 g = vUv * vec2( uAspect, 1.0 ) * 64.0; vec2 id = floor( g );
    float r = h21( id ); vec2 o = ( vec2( h21( id + 7.1 ), h21( id + 3.3 ) ) - 0.5 ) * 0.6;
    float st = step( 0.982, r ) * smoothstep( 0.32, 0.0, length( fract( g ) - 0.5 - o ) );
    st *= 0.55 + 0.45 * sin( uTime * ( 0.8 + r * 3.0 ) + r * 80.0 );
    c += vec3( 0.75, 0.88, 1.0 ) * st * 1.6 * uStar * smoothstep( 0.1, 0.7, y );
    vec2 md = ( vUv - vec2( 0.76, 0.82 ) ) * vec2( uAspect, 1.0 ); float mr = length( md );
    float shade = smoothstep( 0.05, 0.046, mr ) * ( 0.85 + 0.15 * h21( floor( md * 90.0 ) ) );
    c += uMoonCol * ( shade * 1.7 + exp( - mr * mr * 520.0 ) * 0.5 + exp( - mr * mr * 60.0 ) * 0.14 ) * uStar;
  }
  gl_FragColor = vec4( c, 1.0 );
}`,
    });
    this.mesh = new Mesh(new PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -1000; this.mesh.name = 'SkyBackdrop';
  }
}
