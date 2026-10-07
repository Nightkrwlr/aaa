/**
 * Clima y atmósfera viva de Eclipse (portado/adaptado de WeatherFx y AmbientFx de SUNDERCHOIR, three r160, cámara ORTOGRÁFICA).
 *
 *  - WeatherFx: seis sistemas de partículas que se animan por completo en el vertex shader (cero coste de CPU por partícula):
 *      rain (rayas + salpicaduras en el suelo) · dust (rachas con el viento) · snow (con destellos) · embers (ascienden, brillan)
 *      ash (cae, vuelca) · spores (luminosas, sobre todo de noche).  Cada tipo tiene su propia intensidad y se mezcla con suavidad
 *      al cruzar de región. Las partículas viven en una caja alineada con la CÁMARA (ancho × fondo × alto) que envuelve en torno al
 *      objetivo, de modo que casi todas caen dentro de la pantalla y siguen ancladas al mundo, no a la pantalla.
 *  - GroundMist: un banco de niebla de suelo (un solo plano con ruido en shader) para la calidad alta.
 *  - FlashCone: el cono visible de la linterna del jugador (malla aditiva con borde difuso y polvo en suspensión).
 *  - installWetness(): parchea los chunks de iluminación para que el suelo mojado (lluvia) oscurezca y brille sin tocar material por
 *    material; la intensidad viaja en uDarkInfo.w, el cuarto componente libre del uniforme de la máscara de oscuridad del juego.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, InstancedBufferGeometry, LineSegments,
  Mesh, NormalBlending, PlaneGeometry, Points, ShaderChunk, ShaderMaterial, Vector2, Vector3, Vector4, ConeGeometry,
} from 'three';

/** nombre de clima → comportamiento; `h` = alto de la caja de partículas (m), `n` = partículas en calidad alta */
export const WEATHER = {
  rain:   { h: 17, n: 2600 },
  dust:   { h: 7,  n: 900 },
  snow:   { h: 14, n: 1400 },
  embers: { h: 12, n: 520 },
  ash:    { h: 13, n: 900 },
  spores: { h: 6,  n: 520 },
};
const KEYS = Object.keys(WEATHER);

// ejes de la cámara isométrica del juego (rumbo fijo): derecha y «adelante» sobre el suelo
const CAM_EL = 0.68; // seno de la elevación de la cámara (≈ 43°): cuánto se proyecta el fondo del suelo en vertical

/** cabecera GLSL común: caja alineada con la cámara que envuelve en torno al objetivo (partículas ancladas al mundo) */
const BOX_GLSL = /* glsl */ `
uniform float uTime; uniform vec3 uFocus; uniform vec4 uBox; uniform vec2 uWind; uniform float uPx;
const vec2 CR = vec2( 0.70711, -0.70711 );
const vec2 CF = vec2( -0.70711, -0.70711 );
vec3 boxPos( vec3 s, vec2 drift, float y, out float edge ) {
  float fu = dot( uFocus.xz, CR ), fv = dot( uFocus.xz, CF );
  float u = mod( s.x * uBox.x + dot( drift, CR ) - fu + uBox.x * 0.5, uBox.x ) - uBox.x * 0.5;
  float v = mod( s.y * uBox.y + dot( drift, CF ) - fv + uBox.y * 0.5, uBox.y ) - uBox.y * 0.5;
  edge = ( 1.0 - smoothstep( 0.36, 0.5, abs( u ) / uBox.x ) ) * ( 1.0 - smoothstep( 0.36, 0.5, abs( v ) / uBox.y ) );
  vec2 xz = uFocus.xz + CR * u + CF * v;
  return vec3( xz.x, y, xz.y );
}
float hash1( float p ) { p = fract( p * 0.1031 ); p *= p + 33.33; p *= p + p; return fract( p ); }`;

// ───────────────────────────────────────────────────────────────────────────────── lluvia
const RAIN_VERT = /* glsl */ `
attribute float aRank; attribute float aEnd; varying float vA;
${BOX_GLSL}
void main() {
  vec3 s = position;
  if ( aRank > uBox.w ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); vA = 0.0; return; }
  float sp = 22.0 + 10.0 * fract( s.x * 91.7 );
  float fall = s.z * uBox.z + uTime * sp;
  float y = uBox.z - mod( fall, uBox.z );
  vec2 slant = uWind * 0.1;
  float edge;
  vec3 w = boxPos( s, slant * fall, y, edge );
  vec3 vel = vec3( slant.x * sp, - sp, slant.y * sp );
  w -= normalize( vel ) * ( 0.8 + 0.7 * fract( s.y * 57.3 ) ) * aEnd;
  vA = ( 1.0 - aEnd * 0.9 ) * edge * smoothstep( 0.0, 0.05, y / uBox.z ) * smoothstep( 1.0, 0.92, y / uBox.z );
  gl_Position = projectionMatrix * viewMatrix * vec4( w, 1.0 );
}`;
const RAIN_FRAG = 'varying float vA; uniform vec3 uColor; uniform float uAmt; void main(){ gl_FragColor = vec4( uColor, vA * uAmt * 0.5 ); }';

/** salpicaduras: anillos y gota que nacen en el suelo (un quad por instancia, posición por ciclo) */
const SPLASH_VERT = /* glsl */ `
attribute vec4 aSeed; varying vec2 vUv; varying float vPh; varying float vA;
${BOX_GLSL}
void main() {
  vec4 s = aSeed;
  vUv = uv; vPh = 0.0; vA = 0.0;
  if ( s.w > uBox.w ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); return; }
  float per = 0.42 + 0.5 * s.z;
  float t = uTime / per + s.x * 7.0;
  float cyc = floor( t ); float ph = fract( t );
  vec2 r = vec2( fract( sin( dot( s.xy + cyc * 0.173, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ), fract( sin( dot( s.yx + cyc * 0.311, vec2( 39.346, 11.135 ) ) ) * 24634.6345 ) );
  float edge;
  vec3 c = boxPos( vec3( r, 0.0 ), vec2( 0.0 ), 0.06, edge );
  float rad = ( 0.07 + 0.36 * ph ) * ( 0.7 + 0.6 * s.z );
  vec3 w = c + vec3( position.x, 0.0, position.z ) * 2.0 * rad;
  vPh = ph; vA = edge;
  gl_Position = projectionMatrix * viewMatrix * vec4( w, 1.0 );
}`;
const SPLASH_FRAG = /* glsl */ `
varying vec2 vUv; varying float vPh; varying float vA; uniform vec3 uColor; uniform float uAmt;
void main() {
  vec2 p = vUv * 2.0 - 1.0; float d = length( p );
  if ( d > 1.0 ) discard;
  float ring = smoothstep( 0.2, 0.0, abs( d - 0.8 ) ) * ( 1.0 - vPh );
  float core = ( 1.0 - smoothstep( 0.0, 0.4, d ) ) * ( 1.0 - smoothstep( 0.0, 0.3, vPh ) );
  gl_FragColor = vec4( uColor, ( ring * 0.55 + core * 0.6 ) * vA * uAmt * 0.5 );
}`;

// ───────────────────────────────────────────────────────────────────────────────── partículas «motas» (polvo, nieve, ceniza, brasas, esporas)
const MOTE_VERT = /* glsl */ `
attribute vec4 aSeed; varying float vA; varying vec3 vCol;
uniform float uDrift; uniform float uGust; uniform float uBlob; uniform vec2 uWindDir; uniform float uNight; uniform vec3 uColor;
${BOX_GLSL}
void main() {
  vec4 s = aSeed;
  if ( s.w > uBox.w ) { gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 ); gl_PointSize = 0.0; vA = 0.0; vCol = vec3( 0.0 ); return; }
  float edge, y, size, alpha = 1.0; vec2 drift; vec3 col = uColor;
#if defined( M_DUST )
  // rachas: uDrift integra la velocidad del viento (que sube con la ráfaga), así el polvo acelera de verdad
  float blob = step( 1.0 - uBlob, fract( s.w * 37.1 ) ); // uBlob: fracción de bloques difusos (pocos al aire libre, ninguno en interiores)
  drift = uWindDir * uDrift * ( 0.55 + s.z * 0.9 ) + vec2( sin( uTime * 0.7 + s.x * 30.0 ), cos( uTime * 0.6 + s.y * 25.0 ) ) * 0.9;
  y = 0.1 + pow( s.z, 1.7 ) * uBox.z + sin( uTime * 0.9 + s.x * 40.0 ) * 0.25;
  size = mix( 0.06 + 0.07 * s.x, 1.3 + 2.4 * s.y, blob );
  alpha = mix( 0.5, 0.11, blob ) * ( 0.35 + 0.9 * uGust );
  col *= 0.8 + 0.4 * s.x;
#elif defined( M_SNOW )
  float sp = 1.1 + 1.3 * s.x;
  y = uBox.z - mod( s.z * uBox.z + uTime * sp, uBox.z );
  drift = uWind * uTime * 0.18 * ( 0.5 + s.y ) + vec2( sin( uTime * 0.8 + s.y * 30.0 ), cos( uTime * 0.7 + s.x * 20.0 ) ) * 0.7;
  size = 0.09 + 0.11 * s.y;
  float k = fract( s.w * 13.37 );
  float tw = step( 0.84, k ) * pow( max( 0.0, sin( uTime * ( 1.3 + k * 2.5 ) + k * 90.0 ) ), 14.0 );
  alpha = 0.55 + tw * 4.0; size *= 1.0 + tw * 2.2;
#elif defined( M_ASH )
  float sp = 0.55 + 0.75 * s.x;
  y = uBox.z - mod( s.z * uBox.z + uTime * sp, uBox.z );
  drift = uWind * uTime * 0.3 * ( 0.4 + s.y ) + vec2( sin( uTime * 0.6 + s.y * 33.0 ), cos( uTime * 0.5 + s.x * 21.0 ) ) * 1.3;
  size = 0.1 + 0.2 * s.x;
  alpha = ( 0.45 + 0.55 * abs( sin( uTime * ( 1.4 + 3.0 * s.y ) + s.x * 50.0 ) ) ) * 0.95;
  col *= mix( 0.35, 1.25, s.y );
#elif defined( M_EMBER )
  float life = fract( s.z + uTime * ( 0.07 + 0.09 * s.x ) );
  y = life * uBox.z;
  drift = uWind * uTime * 0.2 + vec2( sin( uTime * 1.3 + s.y * 40.0 + y * 0.6 ), cos( uTime * 1.1 + s.x * 33.0 + y * 0.5 ) ) * ( 0.35 + 1.1 * life );
  size = ( 0.08 + 0.1 * s.y ) * ( 1.0 - 0.45 * life );
  float flick = 0.65 + 0.35 * sin( uTime * ( 6.0 + 9.0 * s.x ) + s.y * 90.0 );
  alpha = smoothstep( 0.0, 0.06, life ) * ( 1.0 - smoothstep( 0.55, 1.0, life ) ) * flick;
  col = mix( vec3( 1.0, 0.72, 0.24 ) * 2.1, vec3( 0.95, 0.16, 0.03 ) * 1.1, smoothstep( 0.05, 0.85, life ) );
#else
  // esporas: flotan casi quietas y laten; de día apenas se notan, de noche son el foco de luz del bioma
  y = 0.3 + mod( s.z * uBox.z + uTime * ( 0.12 + 0.22 * s.x ), uBox.z );
  drift = uWind * uTime * 0.05 + vec2( sin( uTime * 0.45 + s.y * 30.0 ), cos( uTime * 0.38 + s.x * 20.0 ) ) * 1.1;
  size = 0.22 + 0.3 * s.y;
  float pulse = 0.5 + 0.5 * sin( uTime * ( 0.8 + 1.6 * s.x ) + s.y * 60.0 );
  alpha = ( 0.12 + 0.88 * uNight ) * ( 0.25 + 0.75 * pulse );
  col *= 0.5 + 0.7 * uNight * pulse;
#endif
  vec3 w = boxPos( s.xyz, drift, y, edge );
  vA = edge * alpha;
  vCol = col;
  gl_PointSize = clamp( size * uPx, 1.6, 96.0 );
  gl_Position = projectionMatrix * viewMatrix * vec4( w, 1.0 );
}`;
const MOTE_FRAG = /* glsl */ `
varying float vA; varying vec3 vCol; uniform float uAmt;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length( c ) * 2.0;
  if ( d > 1.0 ) discard;
  float a = 1.0 - d * d; a *= a; // núcleo suave: a pocos píxeles se lee como un destello redondo, no como un cuadrado
#if defined( M_SPORE )
  // por debajo del umbral del bloom: un destello HDR diminuto sale cuadrado en las mips bajas del bloom, así que la esporas son discos suaves
  gl_FragColor = vec4( vCol * 0.8, a * vA * uAmt );
#elif defined( M_EMBER ) || defined( M_SNOW )
  gl_FragColor = vec4( vCol * ( 0.6 + 0.6 * a ), a * vA * uAmt );
#else
  gl_FragColor = vec4( vCol, a * vA * uAmt );
#endif
}`;

// ───────────────────────────────────────────────────────────────────────────────── niebla de suelo
const MIST_FRAG = /* glsl */ `
varying vec3 vW; uniform vec3 uColor; uniform float uAmt, uTime; uniform vec3 uFocus; uniform vec2 uWind;
float h2( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( h2( i ), h2( i + vec2( 1, 0 ) ), f.x ), mix( h2( i + vec2( 0, 1 ) ), h2( i + vec2( 1, 1 ) ), f.x ), f.y ); }
void main() {
  vec2 p = vW.xz * 0.045 + uWind * uTime * 0.012;
  float n = vn( p ) * 0.55 + vn( p * 2.3 - uTime * 0.01 ) * 0.3 + vn( p * 5.1 + 7.0 ) * 0.15;
  float r = length( vW.xz - uFocus.xz ) / 46.0;
  float a = smoothstep( 0.42, 0.8, n ) * ( 1.0 - smoothstep( 0.55, 1.0, r ) ) * uAmt;
  if ( a < 0.002 ) discard;
  gl_FragColor = vec4( uColor, a );
}`;

// ───────────────────────────────────────────────────────────────────────────────── cono de la linterna
const CONE_FRAG = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vL; uniform vec3 uColor; uniform float uAmt, uTime;
float h3( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
void main() {
  float f = pow( abs( dot( normalize( vN ), normalize( vV ) ) ), 1.6 );    // borde difuso: más denso por el eje
  float z = vL.z;                                                          // 0 en la lente … 1 al final del haz
  float along = smoothstep( 0.0, 0.07, z ) * pow( 1.0 - z, 1.15 );
  float dust = 0.78 + 0.22 * sin( z * 17.0 - uTime * 1.4 + h3( floor( vL * 6.0 ) ) * 6.28 );
  gl_FragColor = vec4( uColor * f * along * dust * uAmt, 1.0 );
}`;

/** parchea los chunks de luz: suelo mojado (oscurece, satura y pule) en todo material con luces, regulado por uDarkInfo.w */
let wetInstalled = false;
export function installWetness() {
  if (wetInstalled) return;
  const S = ShaderChunk;
  // exige el parche de la máscara de oscuridad (declara uDarkInfo y vDkW); si no está, no se instala nada
  if (!S.lights_pars_begin.includes('uDarkInfo') || !S.common.includes('vDkW')) return;
  wetInstalled = true;
  S.lights_pars_begin += /* glsl */ `
float wetHash( vec2 p ) { p = fract( p * vec2( 123.34, 456.21 ) ); p += dot( p, p + 45.32 ); return fract( p.x * p.y ); }
float wetNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( wetHash( i ), wetHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( wetHash( i + vec2( 0.0, 1.0 ) ), wetHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y ); }
float wetMask( vec3 worldN ) { return smoothstep( 0.5, 0.92, worldN.y ); }
float wetPuddle( vec2 p ) { return smoothstep( 0.3, 0.85, wetNoise( p * 0.27 ) * 0.7 + wetNoise( p * 0.9 + 3.0 ) * 0.3 ); }
`;
  S.lights_physical_fragment += /* glsl */ `
{
  float wetK = uDarkInfo.w;
  if ( wetK > 0.002 ) {
    float wm = wetK * wetMask( inverseTransformDirection( normal, viewMatrix ) );
    float pd = wetPuddle( vDkW.xz );
    material.diffuseColor *= 1.0 - wm * ( 0.2 + 0.26 * pd );
    material.roughness = clamp( mix( material.roughness, 0.1 + 0.3 * ( 1.0 - pd ), wm * ( 0.55 + 0.45 * pd ) ), 0.05, 1.0 );
  }
}
`;
  S.lights_lambert_fragment += /* glsl */ `
{
  float wetK = uDarkInfo.w;
  if ( wetK > 0.002 ) {
    float wm = wetK * wetMask( inverseTransformDirection( normal, viewMatrix ) );
    material.diffuseColor *= 1.0 - wm * ( 0.2 + 0.26 * wetPuddle( vDkW.xz ) );
  }
}
`;
}

function seedBuffer(n, stride = 4) {
  const a = new Float32Array(n * stride);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < stride; k++) a[i * stride + k] = Math.random();
    a[i * stride + stride - 1] = (i + 0.5) / n; // rango ordenado: la densidad recorta sin huecos visibles
  }
  return a;
}

export class WeatherFx {
  /**
   * @param scene  escena de three donde se añaden las mallas (nunca se modifica el resto)
   * @param opts   { getFog:()=>Color } (color de niebla para teñir las partículas)
   */
  constructor(scene) {
    this.scene = scene; this.quality = 'high';
    this.time = 0; this.drift = 0; this.gust = 0; this.windAng = 0.7;
    this.amt = {}; this.tgt = {}; for (const k of KEYS) { this.amt[k] = 0; this.tgt[k] = 0; }
    this.cap = 1; // tope de densidad por calidad
    this.focus = new Vector3();
    this.uni = {
      uTime: { value: 0 }, uFocus: { value: this.focus }, uWind: { value: new Vector2() }, uPx: { value: 20 },
    };
    this.mats = {}; this.objs = {};
    // salidas que el renderer aplica a la luz/niebla: 0..1
    this.out = { rain: 0, dust: 0, snow: 0, embers: 0, ash: 0, spores: 0, wet: 0, fogMul: 1, tint: new Color(), tintAmt: 0, sunMul: 1, warm: 0 };
    this._tint = new Color();
    this.splash = null; this.mist = null;
    this.boltT = 0; this.boltNext = 8; this.bolt = 0;
  }

  setQuality(q) {
    this.quality = q;
    this.cap = q === 'high' ? 1 : q === 'medium' ? 0.62 : 0.34;
  }

  /** región / tema → clima objetivo: nombre (k = intensidad máxima 0..1), o mapa {tipo: k} para varios a la vez; null apaga todo */
  setTarget(name, k = 1, instant = false) {
    for (const t of KEYS) this.tgt[t] = (name && typeof name === 'object' ? name[t] : t === name ? k : 0) || 0;
    if (instant) for (const t of KEYS) this.amt[t] = this.tgt[t];
  }

  #make(type) {
    const cfg = WEATHER[type], n = cfg.n;
    const common = { ...this.uni, uBox: { value: new Vector4(40, 50, cfg.h, 1) }, uColor: { value: new Color(1, 1, 1) }, uAmt: { value: 1 } };
    let obj;
    if (type === 'rain') {
      const pos = new Float32Array(n * 6), rank = new Float32Array(n * 2), end = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        const x = Math.random(), y = Math.random(), z = Math.random();
        pos.set([x, y, z, x, y, z], i * 6); rank[i * 2] = rank[i * 2 + 1] = (i + 0.5) / n; end[i * 2 + 1] = 1;
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(pos, 3)); g.setAttribute('aRank', new BufferAttribute(rank, 1)); g.setAttribute('aEnd', new BufferAttribute(end, 1));
      const m = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: common, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG });
      obj = new LineSegments(g, m); this.mats[type] = m;
      // salpicaduras
      const ns = 520, pg = new PlaneGeometry(1, 1); pg.rotateX(-Math.PI / 2);
      const ig = new InstancedBufferGeometry(); ig.index = pg.index; ig.setAttribute('position', pg.getAttribute('position')); ig.setAttribute('uv', pg.getAttribute('uv'));
      ig.setAttribute('aSeed', new InstancedBufferAttribute(seedBuffer(ns), 4)); ig.instanceCount = ns;
      const sm = new ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { ...common, uBox: { value: new Vector4(40, 50, 1, 1) }, uColor: { value: new Color(1, 1, 1) }, uAmt: { value: 1 } }, vertexShader: SPLASH_VERT, fragmentShader: SPLASH_FRAG });
      this.splash = new Mesh(ig, sm); this.splash.frustumCulled = false; this.splash.renderOrder = 19; this.splash.visible = false; this.splash.name = 'RainSplash';
      this.scene.add(this.splash);
    } else {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aSeed', new BufferAttribute(seedBuffer(n), 4));
      const def = { dust: 'M_DUST', snow: 'M_SNOW', ash: 'M_ASH', embers: 'M_EMBER', spores: 'M_SPORE' }[type];
      const additive = type === 'embers' || type === 'spores' || type === 'snow';
      const m = new ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, blending: additive ? AdditiveBlending : NormalBlending, defines: { [def]: '' },
        uniforms: { ...common, uDrift: { value: 0 }, uGust: { value: 1 }, uWindDir: { value: new Vector2(0.8, 0.6) }, uNight: { value: 0 }, uBlob: { value: 0.3 } },
        vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
      });
      obj = new Points(g, m); this.mats[type] = m;
    }
    obj.frustumCulled = false; obj.renderOrder = type === 'rain' ? 20 : 18; obj.visible = false; obj.name = 'Weather_' + type;
    this.scene.add(obj); this.objs[type] = obj;
    return obj;
  }

  /**
   * @param dt     segundos (muy pequeño con el juego en pausa: el reloj apenas avanza)
   * @param ctx    { x, z (objetivo), camera, pxPerUnit (px de dispositivo por m), night, dark, fog:Color, sun:Color, light (0..1 luz ambiente) }
   */
  update(dt, ctx) {
    this.time = (this.time + dt) % 3600;
    this.focus.set(ctx.x, 0, ctx.z);
    const cam = ctx.camera, viewH = cam.top - cam.bottom, viewW = cam.right - cam.left;
    // viento: rumbo que deriva despacio + ráfagas (suma de senos de periodos incomensurables)
    this.windAng = 0.7 + Math.sin(this.time * 0.021) * 0.5;
    const g = 0.5 + 0.5 * Math.sin(this.time * 0.31) * Math.sin(this.time * 0.113 + 1.3);
    this.gust += (g * g * (3 - 2 * g) - this.gust) * Math.min(1, dt * 1.5);
    const windK = 0.7 + this.gust * 1.5;
    this.uni.uWind.value.set(Math.cos(this.windAng) * windK, Math.sin(this.windAng) * windK);
    this.drift += dt * (1.4 + this.gust * 9.0);
    this.uni.uTime.value = this.time; this.uni.uPx.value = ctx.pxPerUnit;
    const o = this.out, fogC = ctx.fog, k = Math.min(1, dt * 0.55);
    let fogMul = 1, tintAmt = 0, sunMul = 1, wet = 0, warm = 0;
    this._tint.setRGB(0, 0, 0);
    // el tinte lo pone el clima más intenso (varios climas a la vez en una región)
    const tint = (amt, r, g, b, m) => { if (amt > tintAmt) { tintAmt = amt; this._tint.setRGB(r, g, b).multiplyScalar(m); } };
    for (const t of KEYS) {
      const a = (this.amt[t] += (this.tgt[t] - this.amt[t]) * k);
      if (this.tgt[t] === 0 && this.amt[t] < 0.004) this.amt[t] = 0;
      o[t] = a;
      let obj = this.objs[t];
      if (a <= 0.004) { if (obj) obj.visible = false; if (t === 'rain' && this.splash) this.splash.visible = false; continue; }
      obj ??= this.#make(t);
      obj.visible = true;
      const cfg = WEATHER[t], H = cfg.h;
      const m = this.mats[t], u = m.uniforms;
      const dens = Math.min(1, a * this.cap * (t === 'dust' ? 0.35 + 0.65 * this.gust : 1));
      u.uBox.value.set(viewW + 8, (viewH + H * 0.73) / CAM_EL + 8, H, dens);
      // el rango ordenado permite recortar también los vértices que procesa la GPU (los móviles lo agradecen)
      obj.geometry.setDrawRange(0, Math.ceil(cfg.n * dens) * (t === 'rain' ? 2 : 1));
      const L = ctx.light, night = ctx.night;
      switch (t) {
        case 'rain': {
          u.uColor.value.setRGB(0.62, 0.7, 0.8).multiplyScalar(0.25 + 0.75 * L).lerp(fogC, 0.25); u.uAmt.value = 1;
          const sp = this.splash; sp.visible = this.quality !== 'low' || a > 0.5;
          if (sp.visible) {
            const su = sp.material.uniforms;
            const sd = Math.min(1, a * this.cap * (this.quality === 'low' ? 0.5 : 1));
            su.uBox.value.set(viewW + 8, (viewH) / CAM_EL + 8, 1, sd);
            sp.geometry.instanceCount = Math.max(1, Math.ceil(520 * sd));
            su.uColor.value.copy(u.uColor.value).multiplyScalar(1.3); su.uAmt.value = 1;
          }
          fogMul += a * 0.3; tint(a * 0.2, 0.56, 0.62, 0.7, 0.3 + 0.7 * L);
          sunMul *= 1 - 0.38 * a; wet = Math.max(wet, a);
          break;
        }
        case 'dust': {
          u.uColor.value.setRGB(0.85, 0.68, 0.45).multiplyScalar(0.3 + 0.9 * L).lerp(ctx.sun, 0.15); u.uAmt.value = 1;
          if (ctx.indoor) { u.uColor.value.multiplyScalar(0.55).lerp(fogC, 0.35); u.uAmt.value = 0.8; }
          u.uBlob.value = ctx.indoor ? 0.05 : 0.3;
          u.uDrift.value = this.drift; u.uGust.value = this.gust; u.uWindDir.value.set(Math.cos(this.windAng), Math.sin(this.windAng));
          const gk = a * (0.25 + 0.75 * this.gust);
          fogMul += gk * 0.95; tint(gk * 0.34, 0.82, 0.64, 0.4, 0.25 + 0.75 * L); sunMul *= 1 - 0.25 * gk;
          break;
        }
        case 'snow': {
          u.uColor.value.setRGB(0.88, 0.94, 1.0).multiplyScalar(0.55 + 0.7 * L); u.uAmt.value = 0.9;
          fogMul += a * 0.45; tint(a * 0.3, 0.8, 0.88, 1.0, 0.3 + 0.7 * L);
          break;
        }
        case 'ash': {
          u.uColor.value.setRGB(0.62, 0.58, 0.55).multiplyScalar(0.4 + 0.6 * L).lerp(fogC, 0.4); u.uAmt.value = 0.9;
          fogMul += a * 0.5; tint(a * 0.3, 0.55, 0.5, 0.46, 0.3 + 0.7 * L);
          break;
        }
        case 'embers': {
          u.uColor.value.setRGB(1, 1, 1); u.uAmt.value = 0.95; warm = a;
          fogMul += a * 0.25; tint(a * 0.18, 0.6, 0.26, 0.1, 0.4 + 0.6 * L);
          break;
        }
        case 'spores': {
          const col = ctx.sporeColor ?? this._sporeDefault;
          u.uColor.value.copy(col); u.uAmt.value = 1; u.uNight.value = Math.max(night, ctx.dark * 0.8);
          fogMul += a * 0.25;
          break;
        }
      }
    }
    o.fogMul = fogMul; o.tintAmt = tintAmt; o.tint.copy(this._tint); o.sunMul = sunMul; o.wet = wet; o.warm = warm;

    // relámpagos: raros, suaves y solo con lluvia fuerte al aire libre
    if (o.rain > 0.6 && ctx.dark < 0.2 && this.quality !== 'low') {
      this.boltNext -= dt;
      if (this.boltNext <= 0) { this.boltT = 0.5; this.boltNext = 18 + Math.random() * 30; }
    }
    if (this.boltT > 0) {
      this.boltT -= dt;
      const b = Math.max(0, this.boltT);
      this.bolt = Math.max(0, Math.sin(b * 26) * Math.min(1, b * 3.2));
    } else this.bolt = 0;
  }
}
WeatherFx.prototype._sporeDefault = new Color(0.4, 1.0, 0.75);

/** banco de niebla de suelo: un plano grande a media altura de los arbustos, con ruido de valor en el shader (calidad alta) */
export class GroundMist {
  constructor(scene) {
    const g = new PlaneGeometry(130, 130); g.rotateX(-Math.PI / 2);
    this.material = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uColor: { value: new Color(0.8, 0.85, 0.9) }, uAmt: { value: 0 }, uTime: { value: 0 }, uFocus: { value: new Vector3() }, uWind: { value: new Vector2(0.8, 0.5) } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4( position, 1.0 ); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: MIST_FRAG,
    });
    this.mesh = new Mesh(g, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.visible = false; this.mesh.name = 'GroundMist';
    scene.add(this.mesh);
  }
  update(time, x, z, amt, color, wind) {
    const u = this.material.uniforms;
    this.mesh.visible = amt > 0.004;
    if (!this.mesh.visible) return;
    this.mesh.position.set(x, 0.55, z);
    u.uAmt.value = amt; u.uTime.value = time; u.uFocus.value.set(x, 0, z); u.uColor.value.copy(color); u.uWind.value.copy(wind);
  }
}

/** cono visible de la linterna: apunta de la lente al punto iluminado; solo se dibuja cuando la luz está encendida */
export class FlashCone {
  constructor(scene) {
    const g = new ConeGeometry(1, 1, 28, 1, true); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2); // vértice en el origen, eje +Z, base en z = 1
    this.material = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, fog: false,
      uniforms: { uColor: { value: new Color(1.0, 0.92, 0.74) }, uAmt: { value: 0 }, uTime: { value: 0 } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vL; void main(){ vL = position; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vN = normalize( normalMatrix * normal ); vV = normalize( - mv.xyz ); gl_Position = projectionMatrix * mv; }',
      fragmentShader: CONE_FRAG,
    });
    this.mesh = new Mesh(g, this.material); this.mesh.frustumCulled = false; this.mesh.renderOrder = 17; this.mesh.visible = false; this.mesh.name = 'FlashCone';
    scene.add(this.mesh);
    this.k = 0;
  }
  /** from/to: lente y punto de mira; on: linterna encendida; strength 0..1: cuánto se nota (de noche / en zonas oscuras) */
  update(dt, time, from, to, on, strength, length) {
    this.k += ((on ? 1 : 0) - this.k) * Math.min(1, dt * 9);
    const vis = this.k > 0.01;
    this.mesh.visible = vis;
    if (!vis) return;
    const L = Math.max(1, Math.min(length, from.distanceTo(to) * 1.05));
    this.mesh.position.copy(from);
    this.mesh.lookAt(to);
    this.mesh.scale.set(L * 0.5, L * 0.5, L);
    this.material.uniforms.uAmt.value = this.k * (0.06 + 0.22 * strength);
    this.material.uniforms.uTime.value = time;
  }
}
