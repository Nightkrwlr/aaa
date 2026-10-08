# Publicar Operación Eclipse en Hostinger

Destino acordado con la persona propietaria: **`https://fr1day.es/operacion-eclipse-remaster/`** (carpeta `operacion-eclipse-remaster` dentro de
`public_html` del dominio `fr1day.es`, usuario de hosting `u342662079`). **No se toca ninguna otra carpeta** (`operacion-eclipse`, `-v2`, `-v3`,
`-beta`, `sunderchoir`…). Solo se permite sobrescribir ficheros de ESTA carpeta, que son los que publica este proyecto.

## Pasos
1. `cd eclipse && npm install` y `node tools/build.mjs --host --out dist/host/index.html --title "Operación Eclipse Remasterizada"`.
   Deja en `dist/host/`: `index.html` (≈13 MB), `version.json` (id de la build), `manifest.webmanifest`, iconos y `.htaccess`.
2. Con el conector de Hostinger: operación `hosting_files_generate-upload-url` con `{"username":"u342662079","domain":"fr1day.es"}`.
   Devuelve `url`, `auth_key` y `rest_auth_key` (caducan a las 6 h). Expórtalos como `HST_URL`, `HST_AUTH`, `HST_REST` (en un fichero fuera del
   repositorio con `umask 077`; **nunca los escribas en el repo** y bórralos al terminar).
3. Sube con `OVERRIDE=true tools/hst-upload.sh dist/host/<fichero> operacion-eclipse-remaster/<fichero>`: primero `index.html`, **al final**
   `version.json` (los clientes abiertos comparan este fichero y ofrecen «Actualizar»). El resto (`manifest.webmanifest`, iconos, `.htaccess`) solo si cambian.
4. Verifica: `curl` de `index.html` y `sha256sum` idéntico al local; `curl -s .../version.json` con el mismo `build`; y
   `node tools/live-check.mjs https://fr1day.es/operacion-eclipse-remaster/ /ruta/salida desktop` (y `pixel7`): debe cargar, empezar partida
   y no dar fallos de red (solo el aviso «Texture marked for update» ya conocido).

## Notas
- `.htaccess` fuerza `Cache-Control: no-cache` en el HTML y el tipo MIME del manifiesto.
- Si el conector no está disponible o devuelve 401/403, no hay forma alternativa de subir: avisar a la persona propietaria.
