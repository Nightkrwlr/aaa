#!/bin/sh
# Sube un fichero a Hostinger por TUS en trozos reanudables (ver docs/DEPLOY.md).
#   HST_URL, HST_AUTH, HST_REST: variables de entorno (salen de la operación hosting_files_generate-upload-url del conector)
#   OVERRIDE=true  permite sobrescribir un fichero existente (por defecto NO sobrescribe)
# uso: tools/hst-upload.sh <fichero local> <ruta remota bajo public_html> [MiB por trozo, por defecto 4]
set -u
F="$1"; R="$2"; CH="${3:-4}"
[ -n "${HST_URL:-}" ] && [ -n "${HST_AUTH:-}" ] && [ -n "${HST_REST:-}" ] || { echo "faltan HST_URL / HST_AUTH / HST_REST"; exit 2; }
SIZE=$(stat -c%s "$F"); CHB=$((CH*1048576))
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$HST_URL/$R?override=${OVERRIDE:-false}" -H "X-Auth: $HST_AUTH" -H "X-Auth-Rest: $HST_REST" -H "Tus-Resumable: 1.0.0" -H "Upload-Length: $SIZE" -H "Upload-Offset: 0")
echo "create $R ($SIZE B) -> $CODE"
[ "$CODE" = "201" ] || exit 1
TMP=$(mktemp); OFF=0; FAILS=0
while [ "$OFF" -lt "$SIZE" ]; do
  dd if="$F" of="$TMP" bs=1M iflag=skip_bytes,count_bytes skip=$OFF count=$CHB 2>/dev/null
  N=$(stat -c%s "$TMP")
  NEW=$(curl -s -D - -o /dev/null -X PATCH "$HST_URL/$R" -H "X-Auth: $HST_AUTH" -H "X-Auth-Rest: $HST_REST" -H "Tus-Resumable: 1.0.0" -H "Content-Type: application/offset+octet-stream" -H "Upload-Offset: $OFF" --data-binary "@$TMP" | tr -d '\r' | awk 'tolower($1)=="upload-offset:"{print $2}')
  if [ "$NEW" = "$((OFF+N))" ]; then OFF=$NEW; FAILS=0; echo "  $OFF / $SIZE"; continue; fi
  FAILS=$((FAILS+1)); echo "  trozo en $OFF falló (respuesta '$NEW'), reintento $FAILS"
  [ "$FAILS" -ge 4 ] && { echo "abortado"; rm -f "$TMP"; exit 2; }
  CUR=$(curl -s -I "$HST_URL/$R" -H "X-Auth: $HST_AUTH" -H "X-Auth-Rest: $HST_REST" -H "Tus-Resumable: 1.0.0" | tr -d '\r' | awk 'tolower($1)=="upload-offset:"{print $2}')
  [ -n "$CUR" ] && OFF=$CUR
  sleep 2
done
rm -f "$TMP"; echo "ok $R ($OFF B)"
