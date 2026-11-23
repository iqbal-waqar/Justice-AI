"""Step 2 of the evaluation: score a collected run with Ragas and build the report.

Runs in the separate Ragas environment (evaluation/.venv), so Ragas's packages
never touch the app's.

    evaluation/.venv/bin/python evaluation/score.py evaluation/results/<run>
    evaluation/.venv/bin/python evaluation/score.py --latest

Writes scores.json, scores.csv, summary.json and report.html into the run folder.
"""
import argparse
import asyncio
import csv
import json
import os
import re
import sys
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore")

EVAL_DIR = Path(__file__).resolve().parent
ROOT = EVAL_DIR.parent


def load_env():
    """Read OPENAI_API_KEY from the project's .env without needing python-dotenv."""
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
            if m and m.group(1) not in os.environ:
                os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")


load_env()

from openai import AsyncOpenAI  # noqa: E402
from ragas.cache import DiskCacheBackend  # noqa: E402
from ragas.embeddings import embedding_factory  # noqa: E402
from ragas.llms import llm_factory  # noqa: E402
from ragas.metrics.collections import (  # noqa: E402
    AnswerRelevancy,
    ContextPrecision,
    ContextRecall,
    Faithfulness,
    FactualCorrectness,
)

from report import write_report  # noqa: E402

JUDGE_MODEL = os.getenv("EVAL_JUDGE_MODEL", "gpt-4.1-mini")
EMBED_MODEL = os.getenv("EVAL_EMBED_MODEL", "text-embedding-3-small")

# Order = column order in the report.
METRICS = [
    ("faithfulness", "Faithfulness"),
    ("answer_relevancy", "Answer relevancy"),
    ("context_precision", "Context precision"),
    ("context_recall", "Context recall"),
    ("factual_correctness", "Factual correctness"),
]


def clean_answer(text: str) -> str:
    text = re.sub(r"<img[^>]*>", "", text or "")
    return text.replace("*(unverified)*", "").strip()


def clean_context(block: str) -> str:
    """Drop the search engine's bookkeeping (score, PDF link) from a passage header."""
    lines = block.split("\n")
    if lines and lines[0].startswith("[Doc"):
        head = re.sub(r"\[Doc \d+ of \d+\]\s*", "", lines[0])
        head = re.sub(r"\|\s*(score|pdf_url|judge_name)=[^|]*", "", head)
        lines[0] = head.strip(" |")
    return "\n".join(lines).strip()


def build_metrics():
    client = AsyncOpenAI()
    cache = DiskCacheBackend(cache_dir=str(EVAL_DIR / ".ragas_cache"))
    llm = llm_factory(JUDGE_MODEL, client=client, cache=cache, temperature=0, max_tokens=4096)
    embeddings = embedding_factory("openai", model=EMBED_MODEL, client=client)
    return {
        "faithfulness": Faithfulness(llm=llm),
        "answer_relevancy": AnswerRelevancy(llm=llm, embeddings=embeddings),
        "context_precision": ContextPrecision(llm=llm),
        "context_recall": ContextRecall(llm=llm),
        "factual_correctness": FactualCorrectness(llm=llm),
    }


async def score_one(item: dict, metrics: dict, sem: asyncio.Semaphore) -> dict:
    q, answer = item["question"], clean_answer(item.get("answer", ""))
    contexts = [clean_context(c) for c in item.get("contexts", []) if c.strip()]
    ref = item.get("reference", "")
    out = {"scores": {}, "reasons": {}, "errors": {}}

    if item.get("error") or not answer:
        out["errors"]["run"] = item.get("error") or "no answer"
        return out
    if item.get("expect") == "not_covered":
        # Correct behaviour is to decline, or — when the relevance check finds only
        # general material — to say the point is not directly covered (verdict
        # "partial", which forces that sentence). Answering as if covered fails.
        if not item.get("answerable", True):
            out["not_covered_pass"], out["not_covered_how"] = True, "declined: not covered"
        elif item.get("gate_verdict") == "partial":
            out["not_covered_pass"], out["not_covered_how"] = True, "said the point is not directly covered"
        else:
            out["not_covered_pass"], out["not_covered_how"] = False, "answered as if covered"
        if not item.get("answerable", True) or not contexts:
            return out
        # It did write an answer: still check nothing in it was invented.
        try:
            res = await metrics["faithfulness"].ascore(user_input=q, response=answer, retrieved_contexts=contexts)
            out["scores"]["faithfulness"] = round(float(res.value), 4)
        except Exception as exc:
            out["errors"]["faithfulness"] = f"{exc.__class__.__name__}: {str(exc)[:300]}"
        return out

    calls = {
        "faithfulness": lambda: metrics["faithfulness"].ascore(user_input=q, response=answer, retrieved_contexts=contexts),
        # Relevancy compares meanings with an English embedding model, so an Urdu question
        # against an Urdu answer scores falsely low; Urdu items carry a human-written
        # English version of the question for this one metric.
        "answer_relevancy": lambda: metrics["answer_relevancy"].ascore(user_input=item.get("question_en") or q, response=answer),
        "context_precision": lambda: metrics["context_precision"].ascore(user_input=q, reference=ref, retrieved_contexts=contexts),
        "context_recall": lambda: metrics["context_recall"].ascore(user_input=q, retrieved_contexts=contexts, reference=ref),
        "factual_correctness": lambda: metrics["factual_correctness"].ascore(response=answer, reference=ref),
    }
    if not contexts:
        for k in ("faithfulness", "context_precision", "context_recall"):
            calls.pop(k)
            out["errors"][k] = "no passages were retrieved"

    async def run(name, fn):
        async with sem:
            try:
                res = await fn()
                val = getattr(res, "value", res)
                out["scores"][name] = None if val is None else round(float(val), 4)
                reason = getattr(res, "reason", None)
                if reason:
                    out["reasons"][name] = str(reason)[:1500]
            except Exception as exc:
                out["errors"][name] = f"{exc.__class__.__name__}: {str(exc)[:300]}"

    await asyncio.gather(*(run(n, f) for n, f in calls.items()))
    return out


async def score_run(run_dir: Path) -> None:
    answers_file = run_dir / "answers.jsonl"
    items = [json.loads(l) for l in answers_file.read_text(encoding="utf-8").splitlines() if l.strip()]
    if not items:
        sys.exit(f"No answers in {answers_file}")
    print(f"Scoring {len(items)} answers from {run_dir.name} with {JUDGE_MODEL}…", flush=True)

    metrics = build_metrics()
    sem = asyncio.Semaphore(int(os.getenv("EVAL_CONCURRENCY", "6")))
    results = await asyncio.gather(*(score_one(it, metrics, sem) for it in items))

    rows = []
    for it, res in zip(items, results):
        rows.append({**it, **res})
        s = res["scores"]
        shown = "  ".join(f"{k[:12]}={s[k]:.2f}" for k, _ in METRICS if s.get(k) is not None)
        print(f"  {it['id']:<10} {shown}" + (f"  errors: {list(res['errors'])}" if res["errors"] else ""), flush=True)

    summary = {"run_id": run_dir.name, "judge_model": JUDGE_MODEL, "embedding_model": EMBED_MODEL,
               "scored_at": datetime.now().isoformat(timespec="seconds"), "questions": len(rows), "metrics": {}}
    run_meta = run_dir / "run.json"
    if run_meta.exists():
        summary["label"] = json.loads(run_meta.read_text(encoding="utf-8")).get("label", "")
    for key, _ in METRICS:
        vals = [r["scores"][key] for r in rows
                if r["scores"].get(key) is not None and r.get("expect") != "not_covered"]
        summary["metrics"][key] = {"mean": round(sum(vals) / len(vals), 4) if vals else None, "n": len(vals)}
    nc = [r for r in rows if r.get("expect") == "not_covered"]
    if nc:
        summary["not_covered"] = {"passed": sum(1 for r in nc if r.get("not_covered_pass")), "total": len(nc)}
    secs = [r["seconds"] for r in rows if r.get("seconds")]
    summary["avg_seconds"] = round(sum(secs) / len(secs), 2) if secs else None

    (run_dir / "scores.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    (run_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    with open(run_dir / "scores.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "category", "language", "question"] + [label for _, label in METRICS] + ["seconds", "passages", "errors"])
        for r in rows:
            w.writerow([r["id"], r.get("category", ""), r.get("language", ""), r["question"]]
                       + [r["scores"].get(k, "") for k, _ in METRICS]
                       + [r.get("seconds", ""), len(r.get("contexts", [])), "; ".join(f"{k}: {v}" for k, v in r["errors"].items())])

    report = write_report(run_dir, rows, summary, METRICS)
    print("\nAverages:")
    for key, label in METRICS:
        m = summary["metrics"][key]["mean"]
        print(f"  {label:<20} {'—' if m is None else f'{m:.2f}'}")
    print(f"\nReport: {report}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("run_dir", nargs="?")
    ap.add_argument("--latest", action="store_true", help="Score the most recent run")
    args = ap.parse_args()
    if args.latest or not args.run_dir:
        runs = sorted(p for p in (EVAL_DIR / "results").iterdir() if (p / "answers.jsonl").exists())
        if not runs:
            sys.exit("No runs found — collect one first with evaluation/collect.py")
        run_dir = runs[-1]
    else:
        run_dir = Path(args.run_dir).resolve()
    if not os.getenv("OPENAI_API_KEY"):
        sys.exit("OPENAI_API_KEY is not set (looked in the environment and .env).")
    asyncio.run(score_run(run_dir))


if __name__ == "__main__":
    main()
