"""Report missing official requirements; this is not a game test suite."""

import json
import argparse
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', type=int, choices=[1, 2, 3, 4], default=1)
    phase = parser.parse_args().phase
    required = [
        "docs/requirements/PRD-0.md",
        "docs/requirements/TEST-CONTRACT.md",
    ]
    required += [f'docs/requirements/Ticket-{n:02d}.md' for n in range(2, phase + 1)]
    missing = [
        name
        for name in required
        if not (root / name).is_file()
        or not (root / name).read_text(encoding="utf-8-sig").strip()
    ]
    print(json.dumps({
        "scope": "assignment-inputs-only",
        "phase": phase,
        "status": "missing_requirements" if missing else "ready_for_manual_review",
        "missing": missing,
        "game_sources_present": (root / 'src/game.mjs').is_file(),
        "note": "File presence does not verify requirement content or product correctness.",
    }, ensure_ascii=False, indent=2))
    return 2 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
