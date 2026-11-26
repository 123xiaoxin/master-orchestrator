#!/usr/bin/env python3
"""Export governed Master prompt and optionally write SkillOpt skill_init.

Usage:
  python -B -X utf8 evals/skillopt/scripts/prepare_initial_skill.py
  python -B -X utf8 evals/skillopt/scripts/prepare_initial_skill.py \\
    --output /path/to/SkillOpt/skillopt/envs/master_orchestrator/skills/initial.md
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_EXPORT = ROOT / ".local" / "skillopt-baseline"
MASTER_SKILL = ROOT / "scripts" / "master_skill.py"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-dir", type=Path, default=DEFAULT_EXPORT)
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional path for SkillOpt skills/initial.md",
    )
    parser.add_argument("--modules", nargs="*", default=["06"])
    args = parser.parse_args(argv)

    if args.export_dir.exists():
        shutil.rmtree(args.export_dir)
    cmd = [
        sys.executable,
        str(MASTER_SKILL),
        "export",
        "--modules",
        *args.modules,
        "--output",
        str(args.export_dir),
    ]
    subprocess.run(cmd, check=True, cwd=str(ROOT))

    prompt = args.export_dir / "master-prompt.md"
    lock = args.export_dir / "source-lock.json"
    if not prompt.is_file() or not lock.is_file():
        print("export missing master-prompt.md or source-lock.json", file=sys.stderr)
        return 2

    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(prompt, args.output)
        print(f"wrote {args.output}")
    print(f"export={args.export_dir}")
    print(f"prompt={prompt}")
    print(f"lock={lock}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
