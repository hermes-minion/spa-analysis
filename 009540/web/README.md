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

- **Producción**: Worker `spa-analysis` con static assets → <https://spa-analysis.sergiovalle.workers.dev> (detalle en «Despliegue en Cloudflare»).
- Copia estable (requiere login del dashboard): `https://hermes.minion.dpdns.org/analyses/`.

**Retirado el 14-nov-2026** (decisión del usuario): `equity-coverage.service` (`python3 -m http.server` en `:9120`) y `equity-coverage-tunnel.service` (quick tunnel → `drama-dicke-easily-cbs.trycloudflare.com`). Ambos quedan `disabled`, sin ficheros en `~/.config/systemd/user/` y archivados en `~/.hermes/backup/units/`. El puerto 9120 está cerrado y esa URL responde **530**: ya no hay preview por túnel.

Para previsualizar en local sin servicio:

```bash
python3 -m http.server 9120 --bind 127.0.0.1 --directory ~/stocks/009540/web
```

El plan de fijar `analyses.minion.dpdns.org` sobre el túnel (y `cf_setup_subdomain.py`) queda **sin objeto**: el Worker ya tiene URL fija. `cf_setup_subdomain.py` sigue en el directorio como herramienta interna, fuera del sitio publicado por `.assetsignore`.

## Despliegue en Cloudflare

Este directorio es lo único versionado en `git@github.com:hermes-minion/spa-analysis.git`; el resto de `~/stocks` está excluido por `.gitignore` (1,8 GB de 10-Ks y cotizaciones). La clave SSH del servidor es `~/.ssh/spa_analysis_ed25519`.

En 2026 Cloudflare crea los sitios estáticos como **Worker con static assets** (Workers & Pages → Create application → GitHub), no como proyecto Pages clásico. El repo ya trae la configuración que hace falta: `wrangler.jsonc` en la raíz con `assets.directory = ./009540/web`, más `package.json` y `package-lock.json` para que el build resuelva dependencias sin ambigüedad.

**Ajustes al conectar el repo (Workers Builds):**

| Ajuste | Valor |
|---|---|
| Build command | *(vacío)* |
| Deploy command | `npx wrangler deploy` (el valor por defecto) |
| Root directory | *(vacío: la config está en la raíz del repo)* |

Resultado: **https://spa-analysis.sergiovalle.workers.dev** (desplegado 14-nov-2026; el Worker se llama `spa-analysis` y sirve `009540/web` como assets). Sin `wrangler.jsonc`, `wrangler deploy` dispara *autoconfig* y abre un PR en vez de desplegar.

Despliegue manual desde el servidor (necesita un token con **Workers Scripts: Edit**; con solo lectura la API devuelve 403 `No access to the specified resource`):

```bash
cd ~/stocks && CLOUDFLARE_API_TOKEN=*** CLOUDFLARE_ACCOUNT_ID=92cdc275ad658f9f2dd89c50d2296ebb \
  npx wrangler@latest deploy
```

Notas del Worker: `_headers` sí se respeta (el manifiesto va con `no-cache`); `.assetsignore` excluye `entries_generated.json` y `cf_setup_subdomain.py` del sitio publicado; y Cloudflare redirige `reporte.html` → `reporte` con un 307 (el navegador lo sigue solo, los enlaces de la SPA no cambian).

**Si en tu panel sigues en la pestaña Pages clásica:**

| Ajuste | Valor |
|---|---|
| Framework preset | None |
| Build command | *(vacío)* |
| Build output directory | `009540/web` |
| Root directory | *(vacío)* |

En ambos casos `_headers` desactiva la caché de `analyses.json` y cada `git push` a `main` redespliega.

Flujo de publicación: `python3 ~/stocks/_data/build_all.py` (o el `build_report.py` del ticker) → `./publish.sh` → `git add -A && git commit && git push`.
