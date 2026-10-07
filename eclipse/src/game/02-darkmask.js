// 02-darkmask.js — Parche de ShaderChunk: máscara de oscuridad (interiores) y su textura

// ════════ [311] VariableDeclaration go,xg (71 bytes) ════════
var go = { uDarkMap: { value: null }, uDarkInfo: { value: new Bt(0, 0, 0, 0) } },
  xg = !1;


// ════════ [312] FunctionDeclaration bg (943 bytes) ════════
function bg() {
  if (xg) return;
  xg = !0;
  let n = ct;
  ((n.common += `
varying vec3 vDkW;
`),
    (n.project_vertex += `
#ifdef USE_INSTANCING
  vDkW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vDkW = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
`),
    (n.lights_pars_begin =
      `uniform sampler2D uDarkMap; uniform vec4 uDarkInfo;
` + n.lights_pars_begin));
  let e = n.lights_fragment_begin,
    t = "getDirectionalLightInfo( directionalLight, directLight );",
    i = "irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );";
  if (!e.includes(t) || !e.includes(i)) {
    console.warn("darkmask: chunks no reconocidos");
    return;
  }
  ((e = e
    .replace(t, t + " directLight.color *= dkF;")
    .replace(
      i,
      "irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal ) * (0.22 + 0.78 * dkF);",
    )),
    (n.lights_fragment_begin =
      `float dkF = 1.0 - uDarkInfo.z * texture2D(uDarkMap, vDkW.xz * uDarkInfo.xy).r;
` + e),
    (ti.prototype.onBeforeCompile = function (s) {
      xo(s);
    }));
}


// ════════ [313] FunctionDeclaration xo (81 bytes) ════════
function xo(n) {
  ((n.uniforms.uDarkMap = go.uDarkMap), (n.uniforms.uDarkInfo = go.uDarkInfo));
}


// ════════ [314] FunctionDeclaration cf (638 bytes) ════════
function cf(n, e = 0.94) {
  let t = n.w,
    i = n.h,
    s = n.dark,
    a = new Float32Array(t * i),
    r = new Uint8Array(t * i);
  for (let l = 0; l < i; l++)
    for (let c = 0; c < t; c++) {
      let d = 0,
        h = 0;
      for (let f = -1; f <= 1; f++) {
        let u = c + f;
        u >= 0 && u < t && ((d += s[l * t + u] ? 1 : 0), h++);
      }
      a[l * t + c] = d / h;
    }
  for (let l = 0; l < i; l++)
    for (let c = 0; c < t; c++) {
      let d = 0,
        h = 0;
      for (let u = -1; u <= 1; u++) {
        let p = l + u;
        p >= 0 && p < i && ((d += a[p * t + c]), h++);
      }
      let f = s[l * t + c] ? 1 : (d / h) * 0.7;
      r[l * t + c] = Math.round(Math.min(1, f) * 255);
    }
  go.uDarkMap.value && go.uDarkMap.value.dispose();
  let o = new cl(r, t, i, Yu, bs);
  ((o.unpackAlignment = 1),
    (o.magFilter = Qt),
    (o.minFilter = Qt),
    (o.generateMipmaps = !1),
    (o.wrapS = o.wrapT = hi),
    (o.needsUpdate = !0),
    (go.uDarkMap.value = o),
    go.uDarkInfo.value.set(1 / t, 1 / i, e, 0));
}


// ════════ [315] ExpressionStatement ExpressionStatement (5 bytes) ════════
bg();

