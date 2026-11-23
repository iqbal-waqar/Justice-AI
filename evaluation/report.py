"""Builds the self-contained HTML report for one scored run (no external files)."""
import html
import json
from pathlib import Path

DESCRIPTIONS = {
    "faithfulness": "Share of the answer's statements that are supported by the passages it was written from. Low = the answer says things its sources don't (hallucination).",
    "answer_relevancy": "How directly the answer addresses the question that was asked.",
    "context_precision": "Whether the passages the search returned are on point, with the useful ones ranked first.",
    "context_recall": "Whether the search found everything the reference answer needs.",
    "factual_correctness": "How closely the answer's claims match the checked reference answer (F1 of matching claims).",
}


def band(v):
    if v is None:
        return "na"
    return "good" if v >= 0.8 else "fair" if v >= 0.6 else "weak"


def fmt(v):
    return "—" if v is None else f"{v:.2f}"


def esc(s):
    return html.escape(str(s or ""))


def previous_summary(run_dir: Path):
    runs = sorted(p for p in run_dir.parent.iterdir() if p.is_dir() and p.name < run_dir.name and (p / "summary.json").exists())
    return json.loads((runs[-1] / "summary.json").read_text(encoding="utf-8")) if runs else None


def history(run_dir: Path):
    out = []
    for p in sorted(run_dir.parent.iterdir()):
        f = p / "summary.json"
        if p.is_dir() and f.exists():
            out.append(json.loads(f.read_text(encoding="utf-8")))
    return out


def write_report(run_dir: Path, rows, summary, metrics) -> Path:
    prev = previous_summary(run_dir)
    cards = []
    for key, label in metrics:
        m = summary["metrics"][key]["mean"]
        delta = ""
        if prev and prev["metrics"].get(key, {}).get("mean") is not None and m is not None:
            d = m - prev["metrics"][key]["mean"]
            if abs(d) >= 0.005:
                delta = f'<span class="delta {"up" if d > 0 else "down"}">{"▲" if d > 0 else "▼"} {abs(d):.2f} vs previous run</span>'
        pct = 0 if m is None else round(m * 100)
        cards.append(f"""
        <div class="card">
          <div class="card-top"><span class="card-label">{esc(label)}</span><span class="pill {band(m)}">{band(m) if m is not None else "n/a"}</span></div>
          <div class="score">{fmt(m)}</div>
          <div class="bar"><span class="fill {band(m)}" style="width:{pct}%"></span></div>
          <p class="card-desc">{esc(DESCRIPTIONS[key])}</p>
          {delta}
        </div>""")

    head_cells = "".join(f"<th>{esc(label)}</th>" for _, label in metrics)
    table_rows, details = [], []
    for r in rows:
        cells = "".join(f'<td class="num"><span class="chip {band(r["scores"].get(k))}">{fmt(r["scores"].get(k))}</span></td>' for k, _ in metrics)
        if r.get("expect") == "not_covered":
            f = r["scores"].get("faithfulness")
            cells = (f'<td colspan="{len(metrics)}" class="nc">Not-covered check: '
                     f'{"✔" if r.get("not_covered_pass") else "✘"} {esc(r.get("not_covered_how", ""))}'
                     + (f' · faithfulness {fmt(f)}' if f is not None else '') + '</td>')
        rtl = ' dir="rtl" class="urdu"' if r.get("language") == "ur" else ""
        table_rows.append(f"""
        <tr>
          <td><a href="#q-{esc(r['id'])}" class="qid">{esc(r['id'])}</a><div class="cat">{esc(r.get('category'))}</div></td>
          <td><span{rtl}>{esc(r['question'])}</span></td>
          {cells}
          <td class="num muted">{esc(r.get('seconds', ''))}s</td>
        </tr>""")

        reasons = "".join(
            f"<li><b>{esc(label)}:</b> {esc(r['reasons'][k])}</li>" for k, label in metrics if r.get("reasons", {}).get(k))
        errors = "".join(f"<li><b>{esc(k)}:</b> {esc(v)}</li>" for k, v in r.get("errors", {}).items())
        passages = "".join(
            f'<details class="passage"><summary>Passage {i}: {esc(c.split(chr(10), 1)[0][:140])}</summary><pre>{esc(c)}</pre></details>'
            for i, c in enumerate(r.get("contexts", []), 1))
        sources = "".join(f"<li>{esc(s.get('title'))} <span class='muted'>{esc(s.get('court', ''))} {esc(s.get('year', ''))}</span></li>" for s in r.get("sources", []))
        details.append(f"""
        <section class="detail" id="q-{esc(r['id'])}">
          <h3><span class="qid">{esc(r['id'])}</span> <span{rtl}>{esc(r['question'])}</span></h3>
          <div class="score-row">{''.join(f'<span class="chip {band(r["scores"].get(k))}">{esc(label)} {fmt(r["scores"].get(k))}</span>' for k, label in metrics)}</div>
          <div class="cols">
            <div><h4>Justice AI's answer</h4><div class="answer"{rtl}>{esc(r.get('answer'))}</div></div>
            <div><h4>Reference answer</h4><div class="answer ref">{esc(r.get('reference'))}</div>
                 <p class="muted small">Based on: {esc(', '.join(r.get('reference_sources', [])))}{'' if r.get('reviewed') else ' · <b>not yet reviewed by a person</b>'}</p></div>
          </div>
          {f'<h4>Why the judge scored it this way</h4><ul class="reasons">{reasons}</ul>' if reasons else ''}
          {f'<h4>Errors</h4><ul class="reasons err">{errors}</ul>' if errors else ''}
          <h4>Sources shown to the user</h4><ul class="sources">{sources or '<li class="muted">none</li>'}</ul>
          <h4>Passages the answer was written from ({len(r.get('contexts', []))})</h4>{passages or '<p class="muted">none</p>'}
          <details class="passage"><summary>Agent steps</summary><pre>{esc(chr(10).join(r.get('trace', [])))}</pre></details>
        </section>""")

    runs = history(run_dir)
    hist_rows = "".join(
        f"<tr{' class=\"current\"' if h['run_id'] == run_dir.name else ''}><td>{esc(h['run_id'])}</td><td>{esc(h.get('label', ''))}</td><td class='num'>{h['questions']}</td>"
        + "".join(f"<td class='num'>{fmt(h['metrics'].get(k, {}).get('mean'))}</td>" for k, _ in metrics) + "</tr>"
        for h in runs)

    nc = summary.get("not_covered")
    nc_line = f"<span>Not-covered checks: <b>{nc['passed']}/{nc['total']}</b></span>" if nc else ""
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Justice AI Evaluation</title>
<style>
:root {{ --ink:#0f1f3d; --ink2:#1f3360; --gold:#b8892b; --bg:#f7f8fa; --card:#fff; --line:#e3e7ee; --muted:#64708a;
        --good:#15803d; --good-bg:#e7f6ec; --fair:#b45309; --fair-bg:#fdf3e2; --weak:#b91c1c; --weak-bg:#fdecec; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:#1d2433; font:15px/1.55 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }}
.wrap {{ max-width:1180px; margin:0 auto; padding:28px 16px 64px; }}
header {{ background:var(--ink); color:#fff; padding:28px 0; }}
header .wrap {{ padding-top:0; padding-bottom:0; }}
header h1 {{ margin:0 0 6px; font:600 28px/1.2 Georgia,"Source Serif 4",serif; }}
header h1 span {{ color:#e3c27a; }}
.meta {{ display:flex; flex-wrap:wrap; gap:6px 20px; color:#c9d2e6; font-size:13.5px; }}
.meta b {{ color:#fff; font-weight:600; }}
h2 {{ font:600 21px/1.3 Georgia,serif; color:var(--ink); margin:36px 0 14px; }}
h4 {{ margin:18px 0 6px; font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }}
.cards {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; }}
.card {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; }}
.card-top {{ display:flex; justify-content:space-between; align-items:center; }}
.card-label {{ font-weight:600; color:var(--ink); font-size:14px; }}
.score {{ font:600 34px/1.1 Georgia,serif; color:var(--ink); margin:10px 0 8px; }}
.bar {{ height:6px; background:#eef1f6; border-radius:4px; overflow:hidden; }}
.fill {{ display:block; height:100%; }}
.fill.good {{ background:var(--good); }} .fill.fair {{ background:var(--fair); }} .fill.weak {{ background:var(--weak); }}
.card-desc {{ font-size:12.5px; color:var(--muted); margin:10px 0 0; }}
.delta {{ display:inline-block; margin-top:8px; font-size:12px; font-weight:600; }}
.delta.up {{ color:var(--good); }} .delta.down {{ color:var(--weak); }}
.pill,.chip {{ display:inline-block; border-radius:999px; font-size:12px; font-weight:600; padding:2px 9px; }}
.good {{ color:var(--good); background:var(--good-bg); }} .fair {{ color:var(--fair); background:var(--fair-bg); }}
.weak {{ color:var(--weak); background:var(--weak-bg); }} .na {{ color:var(--muted); background:#eef1f6; }}
.legend {{ font-size:13px; color:var(--muted); margin-top:12px; }}
.tbl {{ background:var(--card); border:1px solid var(--line); border-radius:14px; overflow-x:auto; }}
table {{ width:100%; border-collapse:collapse; font-size:14px; }}
th {{ text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); background:#fafbfd; padding:10px 12px; border-bottom:1px solid var(--line); white-space:nowrap; }}
td {{ padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }}
tr:last-child td {{ border-bottom:0; }}
tr.current td {{ background:#fbf7ec; }}
.num {{ text-align:center; white-space:nowrap; }}
.qid {{ font-weight:600; color:var(--ink2); text-decoration:none; font-family:ui-monospace,Menlo,monospace; font-size:13px; }}
.cat {{ font-size:12px; color:var(--muted); }}
.nc {{ text-align:center; font-weight:600; color:var(--ink2); }}
.muted {{ color:var(--muted); }} .small {{ font-size:12.5px; }}
.urdu {{ font-family:"Noto Nastaliq Urdu","Jameel Noori Nastaleeq",serif; line-height:2; }}
.detail {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 20px; margin-bottom:16px; }}
.detail h3 {{ margin:0 0 10px; font-size:17px; color:var(--ink); }}
.score-row {{ display:flex; flex-wrap:wrap; gap:6px; }}
.cols {{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }}
@media (max-width:760px) {{ .cols {{ grid-template-columns:1fr; }} }}
.answer {{ white-space:pre-wrap; background:#fafbfd; border:1px solid var(--line); border-radius:10px; padding:12px; font-size:14px; max-height:420px; overflow:auto; }}
.answer.ref {{ background:#fffaf0; border-color:#f1e3c2; }}
.reasons {{ margin:0; padding-left:18px; font-size:13.5px; }} .reasons li {{ margin-bottom:6px; }}
.err {{ color:var(--weak); }}
.sources {{ margin:0; padding-left:18px; font-size:13.5px; }}
details.passage {{ border:1px solid var(--line); border-radius:10px; margin:6px 0; background:#fafbfd; }}
details.passage summary {{ cursor:pointer; padding:8px 12px; font-size:13px; color:var(--ink2); }}
pre {{ white-space:pre-wrap; margin:0; padding:10px 12px; font-size:12.5px; border-top:1px solid var(--line); max-height:360px; overflow:auto; }}
</style></head>
<body>
<header><div class="wrap">
  <h1>Justice AI <span>·</span> RAG evaluation</h1>
  <div class="meta">
    <span>Run <b>{esc(summary['run_id'])}</b></span>{f"<span>{esc(summary.get('label'))}</span>" if summary.get('label') else ''}
    <span>Questions <b>{summary['questions']}</b></span>
    <span>Judge <b>{esc(summary['judge_model'])}</b> (Ragas)</span>
    <span>Avg time per answer <b>{fmt(summary.get('avg_seconds')) if summary.get('avg_seconds') is None else str(summary['avg_seconds']) + 's'}</b></span>
    {nc_line}
  </div>
</div></header>
<div class="wrap">
  <h2>Average scores</h2>
  <div class="cards">{''.join(cards)}</div>
  <p class="legend">Scores run from 0 to 1. <span class="chip good">good</span> ≥ 0.80 &nbsp; <span class="chip fair">fair</span> 0.60–0.79 &nbsp; <span class="chip weak">weak</span> &lt; 0.60. Reference answers marked "not yet reviewed" should be checked by a person before the scores are relied on.</p>

  <h2>Per question</h2>
  <div class="tbl"><table>
    <thead><tr><th>ID</th><th>Question</th>{head_cells}<th>Time</th></tr></thead>
    <tbody>{''.join(table_rows)}</tbody>
  </table></div>

  <h2>All runs</h2>
  <div class="tbl"><table>
    <thead><tr><th>Run</th><th>Label</th><th>Questions</th>{head_cells}</tr></thead>
    <tbody>{hist_rows}</tbody>
  </table></div>

  <h2>Answer details</h2>
  {''.join(details)}
</div>
</body></html>"""
    out = run_dir / "report.html"
    out.write_text(page, encoding="utf-8")
    return out
