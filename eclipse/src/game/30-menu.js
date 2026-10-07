// 30-menu.js — Menú principal

// ════════ [714] VariableDeclaration bi (36 bytes) ════════
var bi = (n) => document.querySelector(n);


// ════════ [715] FunctionDeclaration kb (3838 bytes) ════════
function kb({ save: n, cloud: e, onContinue: t, onNew: i }) {
  let s = bi("#menu");
  s.hidden = !1;
  let a = "soldado",
    r = !1,
    o = "Astronaut_FinnTheFrog",
    l = [
      ["Astronaut_FinnTheFrog", "Finn"],
      ["Astronaut_RaeTheRedPanda", "Rae"],
      ["Astronaut_BarbaraTheBee", "Barbara"],
      ["Astronaut_FernandoTheFlamingo", "Fernando"],
    ],
    c = (d = "main") => {
      if (d === "main") {
        s.innerHTML = `<div class="mbox"><svg class="emblem" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="emblemCorona" cx="50%" cy="50%" r="50%"><stop offset="58%" stop-color="#ffb347" stop-opacity="0"/><stop offset="76%" stop-color="#ffb347" stop-opacity=".85"/><stop offset="100%" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="60" r="58" fill="url(#emblemCorona)"/><circle cx="60" cy="60" r="38" fill="#ffe2b0"/><circle cx="66" cy="55" r="37" fill="#070a14"/></svg><div class="logo"><span>Operaci\xF3n</span>Eclipse</div>
      <div class="tagline">El Enjambre cay\xF3 del cielo hace tres meses. Basti\xF3n es la \xFAltima posici\xF3n en pie. Eres el operador de fuerzas especiales que tiene que recuperar el continente, regi\xF3n a regi\xF3n.</div>
      <div class="mbtns">
        ${n ? `<button class="btn pri" id="mCont">Continuar \xB7 ${ke(n.name)} \xB7 ${vo(n.lvl)} nivel ${n.lvl}</button>` : ""}
        <button class="btn ${n ? "" : "pri"}" id="mNew">Nueva partida</button>
        <button class="btn" id="mHelp">Controles</button>
      </div>
      <div class="fine">${e ? "Tu progreso se guarda autom\xE1ticamente en tu cuenta." : "Tu progreso se guarda autom\xE1ticamente en este navegador. Desde Pausa \u203A Partida puedes exportarlo."} Recomendado: teclado y rat\xF3n. Tambi\xE9n funciona con pantalla t\xE1ctil.</div></div>`;
        let h = bi("#mCont");
        (h &&
          (h.onclick = () => {
            (ae.init(), t());
          }),
          (bi("#mNew").onclick = () => {
            (ae.init(), c("new"));
          }),
          (bi("#mHelp").onclick = () => c("help")));
      } else
        d === "new"
          ? ((s.innerHTML = `<div class="mbox"><div class="logo" style="font-size:clamp(30px,5vw,48px)"><span>Nuevo</span>Operador</div>
      <label class="disp muted" for="mName" style="font-size:13px;letter-spacing:.14em">INDICATIVO</label>
      <input type="text" id="mName" maxlength="18" value="Espectro" autocomplete="off">
      <div class="disp muted" style="font-size:13px;letter-spacing:.14em">OPERADOR</div>
      <div class="diffs" style="grid-template-columns:repeat(4,minmax(0,1fr))">${l.map(([h, f]) => `<button class="diff ${h === o ? "on" : ""}" data-c="${h}"><b>${f}</b></button>`).join("")}</div>
      <div class="disp muted" style="font-size:13px;letter-spacing:.14em">DIFICULTAD</div>
      <div class="diffs">${Object.entries(Di)
        .map(
          ([h, f]) =>
            `<button class="diff ${h === a ? "on" : ""}" data-d="${h}"><b>${f.n}</b><span>${f.desc}</span></button>`,
        )
        .join("")}</div>
      <div class="mbtns"><button class="btn pri" id="mGo">${n && r ? "Confirmar: se borrar\xE1 tu partida actual" : "Desplegar"}</button><button class="btn" id="mBack">Volver</button></div></div>`),
            s.querySelectorAll("[data-c]").forEach(
              (h) =>
                (h.onclick = () => {
                  o = h.dataset.c;
                  let f = bi("#mName").value;
                  (c("new"), (bi("#mName").value = f));
                }),
            ),
            s.querySelectorAll("[data-d]").forEach(
              (h) =>
                (h.onclick = () => {
                  a = h.dataset.d;
                  let f = bi("#mName").value;
                  (c("new"), (bi("#mName").value = f));
                }),
            ),
            (bi("#mGo").onclick = () => {
              if (n && !r) {
                r = !0;
                let h = bi("#mName").value;
                (c("new"), (bi("#mName").value = h));
                return;
              }
              i(bi("#mName").value.trim() || "Espectro", a, o);
            }),
            (bi("#mBack").onclick = () => {
              ((r = !1), c("main"));
            }))
          : ((s.innerHTML = `<div class="mbox" style="width:min(560px,100%)"><div class="logo" style="font-size:36px">Controles</div>
      <div class="stats" style="font-size:15px"><span>Moverse</span><span class="v">WASD</span><span>Disparo</span><span class="v">Autom\xE1tico</span><span>Esprint</span><span class="v">Espacio</span><span>Interactuar</span><span class="v">E</span><span>Cambiar arma</span><span class="v">Q</span><span>Granada</span><span class="v">G</span><span>Botiqu\xEDn / Estimulante</span><span class="v">1 / 2</span><span>Linterna</span><span class="v">F</span><span>Inventario \xB7 Mapa \xB7 Misiones \xB7 Archivo</span><span class="v">I \xB7 M \xB7 J \xB7 L</span><span>Pausa</span><span class="v">Esc</span></div>
      <p class="muted">En pantallas t\xE1ctiles: arrastra en la mitad izquierda para moverte y usa los botones de la derecha.</p><div class="mbtns"><button class="btn" id="mBack">Volver</button></div></div>`),
            (bi("#mBack").onclick = () => c("main")));
    };
  c("main");
}


// ════════ [716] FunctionDeclaration zb (59 bytes) ════════
function zb() {
  let n = bi("#menu");
  ((n.hidden = !0), (n.innerHTML = ""));
}

