"""Step 1 of the evaluation: ask Justice AI every test question and save what it did.

Runs in the APP's environment (it imports the real agent), so the answers come
from exactly the pipeline the chat uses — minus the answer cache.

    python evaluation/collect.py                 # all questions
    python evaluation/collect.py --limit 5       # first 5
    python evaluation/collect.py --ids crim-01 stat-01

Writes evaluation/results/<run>/answers.jsonl and prints the run folder; score
it with evaluation/score.py (Ragas environment).
"""
import argparse
import json
import sys
import time
import warnings
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
warnings.filterwarnings("ignore")

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from backend.services.agent import agent_service  # noqa: E402
from backend.services.graph import graph_service  # noqa: E402

EVAL_DIR = Path(__file__).resolve().parent


def ask(question: str) -> dict:
    agent = graph_service.get_agent()
    state = agent_service._initial_state(question, [], None, "auto")
    started = time.time()
    final = agent.invoke(state)
    seconds = time.time() - started
    return {
        "answer": final.get("final_answer", ""),
        "contexts": final.get("answer_contexts") or [],
        "sources": agent_service._extract_sources(final, question),
        "intent": final.get("query_intent", ""),
        "answerable": final.get("answerable", True),
        "gate_verdict": final.get("assessment_verdict", ""),
        "trace": final.get("agent_trace", []),
        "seconds": round(seconds, 2),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--questions", default=str(EVAL_DIR / "questions.json"))
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--ids", nargs="*", default=None)
    ap.add_argument("--label", default="", help="Short note stored with the run, e.g. 'after prompt change'")
    args = ap.parse_args()

    questions = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    if args.ids:
        questions = [q for q in questions if q["id"] in set(args.ids)]
    if args.limit:
        questions = questions[: args.limit]
    if not questions:
        sys.exit("No questions selected.")

    run_id = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    out_dir = EVAL_DIR / "results" / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "run.json").write_text(json.dumps({
        "run_id": run_id, "label": args.label, "question_count": len(questions),
        "started": datetime.now().isoformat(timespec="seconds"),
    }, indent=2), encoding="utf-8")

    graph_service.get_agent()
    with open(out_dir / "answers.jsonl", "w", encoding="utf-8") as fh:
        for i, q in enumerate(questions, 1):
            print(f"[{i}/{len(questions)}] {q['id']}: {q['question'][:70]}", flush=True)
            try:
                result = ask(q["question"])
            except Exception as exc:  # keep going; the report shows the failure
                result = {"answer": "", "contexts": [], "sources": [], "error": f"{exc.__class__.__name__}: {exc}"}
            print(f"      {result.get('seconds', '?')}s, {len(result['contexts'])} passages, "
                  f"{len(result['answer'])} chars" + (f"  ERROR {result['error']}" if result.get("error") else ""), flush=True)
            fh.write(json.dumps({**q, **result}, ensure_ascii=False) + "\n")
            fh.flush()

    print(f"\nSaved answers to {out_dir}")
    print(f"Next: evaluation/.venv/bin/python evaluation/score.py {out_dir}")


if __name__ == "__main__":
    main()
