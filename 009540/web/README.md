# Equity Coverage — índice de análisis

SPA estática (sin dependencias) que indexa los análisis de acciones. **63 fichas publicadas** (14-nov-2026), 0 en cola: todos los `analysis.md` de `~/stocks`, los informes principales de las carpetas sin `analysis.md` (AEM, BSX, DND.TO, FISV, HUMA, LTRN, MARA, MGY, NBIS, OBE, PROP, QTRX, SMR+OKLO, VKTX), las notas de IREN y KEEL, el estudio de régimen de PBR, y dos fichas curadas (009540, ADBE).

## Estructura

```
web/
  index.html          shell de la SPA (hash router)
  styles.css          tema
  app.js              render del índice y de la ficha
  analyses.json       manifiesto: análisis publicados + cola de cobertura
  reports/009540.html informe completo renderizado desde el markdown
build_report.py       markdown -> HTML del informe
publish.sh            build + copia al servidor del dashboard
```

## Pipeline masivo

Un comando renderiza **todos** los análisis y actualiza el manifiesto:

```bash
python3 ~/stocks/_data/build_all.py
```

- Recorre cada carpeta de `~/stocks` con `analysis.md` y añade los informes de `EXTRA` (carpetas sin `analysis.md`).
- Extrae del encabezado ticker, mercado, precio, veredicto, valor central, upside y fecha; lo que no está en el encabezado queda a `null` y la SPA pinta «—» (nunca se inventa).
- Escribe `reports/<TICKER>.html` y hace merge en `analyses.json` conservando las fichas curadas (ADBE, 009540) y la cola.
- Para añadir un informe nuevo: deja el `.md` en su carpeta o añádelo a `EXTRA`, y vuelve a ejecutar. Es idempotente.

### Marcas del índice

Dos etiquetas se pintan como chip en la tabla (y como tag en la ficha):

- **IA física** — `IA_FISICA` en `build_all.py` (15 nombres: INOD, AMBA, BKSY, BBAI, ON, OUST, CEVA, QCOM, AEVA, LSCC, CGNX, INDI, MBLY, VPG, NXPI).
- **Hugo** — `HUGO` en `build_all.py` (29 nombres del batch 2026-11-14). La ficha curada de ADBE lleva la marca en su entrada de `analyses.json`.

El resto de tags de una ficha (sector, tesis) se ven solo en el detalle, no en el índice.

## Añadir una compañía a mano

1. Copia el markdown del análisis a `HD_<TICKER>_informe.md` (o ajusta `build_report.py`).
2. Añade una entrada al array `analyses` de `web/analyses.json` con ticker, mercado, rating, precio, valor central, escenarios, score y `report`.
3. Genera el HTML: `python3 build_report.py`. Cada análisis mantiene su propio script junto al markdown (`stocks/009540/build_report.py`, `stocks/ADBE/build_report.py`), con `SRC` = su `analysis.md` y `OUT` = `web/reports/<TICKER>.html`.
4. Publica: `./publish.sh`.

La cola (`queue`) admite nombres sin informe; se muestran como *candidata* y no enlazan a nada. Campos opcionales por ficha: `scenario_note` (nota bajo los escenarios), `dividend_yield` (null → «—»), `score`/`score_max` (null → «—», para fichas de posición sin scorecard) y `prob` dentro de cada escenario (si falta, no se pinta la barra ni el porcentaje). `kind: "position"` marca los análisis de posición abierta en lugar de coberturas nuevas.

## Servido

- `equity-coverage.service` (systemd --user): `python3 -m http.server 9120 --bind 127.0.0.1` sobre `web/`.
- `equity-coverage-tunnel.service`: Cloudflare Quick Tunnel, **URL pública actual**: <https://drama-dicke-easily-cbs.trycloudflare.com>.
  La URL cambia si el túnel se reinicia: `grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' ~/.hermes/logs/equity-coverage-tunnel.log | tail -1`.
  Para que no cambie, `Restart=always` ya está puesto; si el proceso muere, la URL nueva aparece en ese log.
- Copia estable (requiere login del dashboard): `https://hermes.minion.dpdns.org/analyses/`.

### URL permanente — analyses.minion.dpdns.org

El túnel con nombre es **token-managed** (`cloudflared tunnel run --token-file`): su ingress vive en el panel, no en un `config.yml` local. Por eso el hostname se añade en Cloudflare, no aquí.

**Panel (2 minutos):**
1. Zero Trust → Networks → Tunnels → túnel `fbf64571-5d11-4246-926e-18f01c24fcb4` → *Public hostname* → **Add**.
2. Subdomain `analyses`, domain `minion.dpdns.org`, service `HTTP` → `127.0.0.1:9120`, path vacío. Guardar (crea el CNAME proxied solo).
3. Si la zona tiene una Access application con wildcard `*.minion.dpdns.org`, añadir una política **Bypass** para `analyses.minion.dpdns.org` o quedará detrás del login.

**API (un comando), si prefieres token:**
```bash
CLOUDFLARE_API_TOKEN=... python3 cf_setup_subdomain.py
```
El token necesita *Account → Cloudflare Tunnel: Edit* y *Zone → DNS: Edit* sobre `minion.dpdns.org`. El script lee account/tunnel del propio token de cloudflared, inserta la regla antes del catch-all (sin tocar las demás), crea o actualiza el CNAME a `fbf64571-5d11-4246-926e-18f01c24fcb4.cfargotunnel.com` y verifica `https://analyses.minion.dpdns.org/analyses.json`.

Estado (14-nov-2026): **aplazado por decisión del usuario** — se mantiene la quick tunnel como URL pública. `cf_setup_subdomain.py` queda listo para ejecutarlo el día que se quiera fijar el subdominio; no hay registro DNS creado.

Alternativa sin DNS propio: desplegar `web/` como Cloudflare Pages (`wrangler pages deploy web`), que da un `*.pages.dev` estable.

## Despliegue en Cloudflare Pages (GitHub)

Este directorio es lo único versionado en `git@github.com:hermes-minion/spa-analysis.git`; el resto de `~/stocks` está excluido por `.gitignore` (1,8 GB de 10-Ks y cotizaciones). La clave SSH del servidor es `~/.ssh/spa_analysis_ed25519` (deploy key con permiso de escritura).

Ajustes al conectar el repo en Pages:

| Ajuste | Valor |
|---|---|
| Framework preset | None |
| Build command | *(vacío)* |
| Build output directory | `/` |
| Root directory | `009540/web` |

Sin build: son ficheros estáticos y las rutas `#/` y `#/a/<TICKER>` funcionan tal cual. `_headers` evita que el CDN cachee `analyses.json`. Cada `git push` a `main` redespliega.

Flujo de publicación: `python3 ~/stocks/_data/build_all.py` (o el `build_report.py` del ticker) → `./publish.sh` → `git add -A && git commit && git push`.
