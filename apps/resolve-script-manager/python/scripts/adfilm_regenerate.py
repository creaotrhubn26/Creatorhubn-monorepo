#!/usr/bin/env python3
"""adfilm_regenerate — regenerer ETT enkelt storyboard-shot med en fix-prompt.

Broen bak «Forbedre shot»-UI-en (StoryboardRefineDialog). Kalles av Rust-
kommandoen `ad_film_regenerate_shot` med --spec/--shot/--fix. Bruker motorens
`_gen_one_still` (som selv legger på GROUNDED_ + SCREEN_PLATE-direktivene for
ui_key), skriver et nytt attempt-nummerert bilde og printer JSON på stdout:

    {"image_path": "/abs/sti.jpg", "attempt": 2}

Rører ALDRI de andre shotsene — kun det ene bildet regenereres.
"""
import argparse, glob, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cinematic_adfilm_engine import AdFilmSpec, _gen_one_still  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True, help="sti til <navn>.spec.json")
    ap.add_argument("--shot", required=True, help="shot-id, f.eks. s03")
    ap.add_argument("--fix", default="", help="samlet fix-prompt fra tilbakemelding")
    args = ap.parse_args()

    spec = AdFilmSpec.load(args.spec)

    # Resolver ref_still relativt til workdir hvis det ikke er absolutt.
    ref = spec.character.get("ref_still")
    if ref and not os.path.isabs(ref):
        spec.character = {**spec.character, "ref_still": spec.p(ref)}

    shot = next((s for s in spec.shots if s.get("id") == args.shot), None)
    if shot is None:
        print(json.dumps({"error": f"ukjent shot-id: {args.shot}"}))
        return 2

    stills_dir = spec.p("stills")
    os.makedirs(stills_dir, exist_ok=True)
    attempt = len(glob.glob(os.path.join(stills_dir, f"{args.shot}_refine_*.jpg"))) + 1
    dst = os.path.join(stills_dir, f"{args.shot}_refine_{attempt}.jpg")

    _gen_one_still(spec, shot, args.fix, dst)

    print(json.dumps({"image_path": dst, "attempt": attempt}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
