/* Equity Coverage SPA — no dependencies, hash routing. */
(function () {
  "use strict";

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const nf = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  const pct = (x) => (x == null ? "—" : (x >= 0 ? "+" : "") + nf1.format(x * 100) + "%");
  const money = (x) => {
    if (x == null) return "—";
    const abs = Math.abs(x);
    const opts =
      abs < 10
        ? { minimumFractionDigits: 2, maximumFractionDigits: 3 }
        : abs < 1000
        ? { maximumFractionDigits: 2 }
        : { maximumFractionDigits: 0 };
    return new Intl.NumberFormat("en-US", opts).format(x);
  };
  const tagChips = (x) => (x.tags || []).filter((t) => /ia f|hugo/i.test(t)).map((t) => {
    const k = /ia f/i.test(t) ? "ia" : /hugo/i.test(t) ? "hugo" : "";
    return `<span class="minitag ${k}">${esc(t)}</span>`;
  }).join("");
  const scoreTxt = (x) =>
    x.score == null ? "—" : esc(x.score) + "/" + esc(x.score_max);
  const expectedTxt = (x) =>
    x.expected == null ? "—" : esc(x.currency) + " " + money(x.expected);

  let DATA = null;

  function ratingClass(r) {
    const s = String(r || "").toLowerCase();
    if (s.includes("compra")) return "buy";
    if (s.includes("infravalor")) return "buy";
    if (s.includes("bullish") || s.includes("alcista")) return "buy";
    if (s.includes("notas")) return "notes";
    if (s.includes("revisión") || s.includes("revision") || s.includes("auditoría")) return "review";
    if (s.includes("régimen") || s.includes("regimen")) return "regime";
    if (s.includes("especul")) return "spec";
    if (s.includes("bajista") || s.includes("venta") || s.includes("bearish") ||
        s.includes("sobrevalor") || s.includes("sell")) return "sell";
    return "hold";
  }

  function renderIndex() {
    const a = DATA.analyses || [];
    const q = DATA.queue || [];
    const rows = a.map((x) => `
      <tr data-ticker="${esc(x.ticker)}">
        <td><span class="tick">${esc(x.ticker)}</span><div class="sub">${esc(x.exchange)}</div></td>
        <td><span class="co">${esc(x.name)}</span><div class="sub">${[x.sector, x.country].filter((v) => v && v !== "—").join(" · ")}</div>${tagChips(x)}</td>
        <td><span class="badge ${ratingClass(x.rating)}">${esc(x.rating)}</span></td>
        <td class="num">${esc(x.date)}</td>
        <td class="num">${esc(x.currency)} ${money(x.price)}</td>
        <td class="num">${esc(x.currency)} ${money(x.central)}</td>
        <td class="num ${x.upside >= 0 ? "pos" : "neg"}">${pct(x.upside)}</td>
        <td class="num">${scoreTxt(x)}</td>
      </tr>`).join("");

    $("#app").innerHTML = `
      <section class="hero">
        <div>
          <div class="kicker">Coverage index</div>
          <h1>Un índice, todas las tesis.</h1>
          <p class="lede">Cada ficha resume la valoración, los escenarios y el seguimiento de una compañía. El informe completo se abre desde la ficha y se actualiza cuando cambian los datos.</p>
        </div>
        <div class="kpis">
          <div class="kpi"><b>${a.length}</b><span>Publicado${a.length === 1 ? "" : "s"}</span></div>
          <div class="kpi"><b>${q.length}</b><span>En cola</span></div>
          <div class="kpi"><b>${new Set(a.map((x) => x.country)).size}</b><span>Mercado${new Set(a.map((x) => x.country)).size === 1 ? "" : "s"}</span></div>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Análisis publicados</h2>
          <span class="hint">Pulsa una fila para abrir la ficha</span>
        </div>
        <div class="table-wrap">
          ${a.length ? `<table><thead><tr>
            <th>Ticker</th><th>Compañía</th><th>Rating</th><th>Fecha</th>
            <th class="num">Precio</th><th class="num">Valor central</th><th class="num">Upside</th><th class="num">Score</th>
          </tr></thead><tbody>${rows}</tbody></table>` : `<div class="empty">Todavía no hay análisis publicados.</div>`}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Cola de cobertura</h2>
          <span class="hint">Se amplía añadiendo entradas al manifiesto</span>
        </div>
        <div class="table-wrap">
          ${q.length ? `<table><thead><tr><th>Ticker</th><th>Compañía</th><th>Estado</th><th>Nota</th></tr></thead><tbody>
            ${q.map((x) => `<tr><td class="tick">${esc(x.ticker)}</td><td>${esc(x.name || "—")}</td><td><span class="badge hold">${esc(x.status || "en cola")}</span></td><td class="sub">${esc(x.note || "")}</td></tr>`).join("")}
          </tbody></table>` : `<div class="empty">No hay nombres confirmados en cola. El índice está diseñado para crecer: cada análisis nuevo es una entrada más en <code class="mono">analyses.json</code>.</div>`}
        </div>
      </section>

      <section class="section">
        <div class="section-head"><h2>Cómo se añade una compañía</h2></div>
        <div class="panel">
          <p>El índice es data-driven: la página lee <code class="mono">analyses.json</code> y pinta la tabla, la ficha y la cola. Para incorporar una compañía basta añadir un objeto al array <code class="mono">analyses</code> con ticker, mercado, rating, precio, valor central, escenarios y la ruta del informe; no hay que tocar el HTML.</p>
          <pre>{
  "ticker": "XXXXX", "exchange": "KRX", "name": "…",
  "date": "2026-11-14", "rating": "Compra especulativa",
  "price": 0, "central": 0, "upside": 0,
  "score": 0, "score_max": 120, "report": "reports/XXXXX.html"
}</pre>
          <p class="note">El informe completo se genera desde el markdown del análisis y se guarda en <code class="mono">reports/&lt;ticker&gt;.html</code>.</p>
        </div>
      </section>`;

    document.querySelectorAll("tbody tr[data-ticker]").forEach((tr) => {
      tr.addEventListener("click", () => { location.hash = "#/a/" + tr.dataset.ticker; });
    });
  }

  function renderDetail(ticker) {
    const x = (DATA.analyses || []).find((y) => y.ticker === ticker);
    if (!x) { location.hash = "#/"; return; }
    const sc = x.scenarios || [];
    $("#app").innerHTML = `
      <a class="back" href="#/">← Volver al índice</a>
      <div class="dhead">
        <div>
          <div class="kicker">${esc(x.exchange)}${x.sector && x.sector !== "—" ? " · " + esc(x.sector) : ""}</div>
          <h1>${esc(x.name)}</h1>
          <div class="tagrow">
            <span class="badge ${ratingClass(x.rating)}">${esc(x.rating)}</span>
            ${(x.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
          </div>
        </div>
        <div class="pricebox">
          <div class="p">${esc(x.currency)} ${money(x.price)}</div>
          <div class="s">cierre ${esc(x.date)}</div>
          <div class="${x.upside >= 0 ? "pos" : "neg"}" style="font-family:var(--mono);margin-top:6px">
            ${pct(x.upside)} hasta ${esc(x.currency)} ${money(x.central)}
          </div>
        </div>
      </div>

      <div class="grid">
        <div class="cell"><span>Valor central</span><b>${esc(x.currency)} ${money(x.central)}</b></div>
        <div class="cell"><span>Valor esperado</span><b>${expectedTxt(x)}</b></div>
        <div class="cell"><span>Dividendo bruto</span><b>${pct(x.dividend_yield)}</b></div>
        <div class="cell"><span>Score</span><b>${scoreTxt(x)}</b></div>
      </div>

      <div class="panel">
        <h3>Escenarios</h3>
        <div class="scen">
          ${sc.map((s) => `
            <div class="sc">
              <small>${s.prob == null ? esc(s.name) : esc(s.name) + " · prob. " + Math.round(s.prob * 100) + "%"}</small>
              <b>${esc(x.currency)} ${money(s.value)}</b>
              <i>${pct(s.ret)} vs precio</i>
              ${s.prob == null ? "" : `<div class="bar"><i style="width:${Math.max(4, Math.min(100, s.prob * 100))}%"></i></div>`}
            </div>`).join("")}
        </div>
        <p class="note" style="margin-top:12px">${esc(x.scenario_note || "Probabilidades subjetivas.")}</p>
      </div>

      <div class="panel">
        <h3>La tesis en cuatro líneas</h3>
        <ul>${(x.thesis || []).map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
      </div>

      <div class="panel">
        <h3>Métricas clave</h3>
        <div class="grid" style="margin:0">
          ${(x.metrics || []).map((m) => `<div class="cell"><span>${esc(m.label)}</span><b>${esc(m.value)}</b></div>`).join("")}
        </div>
      </div>

      <div class="panel">
        <h3>Informe completo</h3>
        ${x.summary ? `<p>${esc(x.summary)}</p>` : ""}
        <a class="cta" href="${esc(x.report)}" target="_blank" rel="noopener">Abrir el informe →</a>
      </div>`;
    document.querySelectorAll("#app .panel").forEach((p) => {
      if (!p.querySelector("li, .sc, .cell, a.cta")) p.remove();
    });
  }

  function route() {
    const h = location.hash.replace(/^#/, "");
    const m = h.match(/^\/a\/([A-Za-z0-9._-]+)$/);
    if (m) renderDetail(m[1]); else renderIndex();
    window.scrollTo(0, 0);
  }

  function boot() {
    fetch("analyses.json", { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((d) => {
        DATA = d;
        $("#updated").textContent = "Actualizado " + (d.updated || "—");
        $("#footer-meta").textContent = (d.analyses || []).length + " análisis · " + (d.base_note || "");
        window.addEventListener("hashchange", route);
        route();
      })
      .catch((e) => {
        $("#app").innerHTML = `<div class="empty">No se ha podido cargar <code class="mono">analyses.json</code> (${esc(e.message)}).</div>`;
      });
  }

  boot();
})();
