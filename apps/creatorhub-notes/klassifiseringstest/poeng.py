"""Scorer en klassifiseringskjøring mot fasiten i items.jsonl.

    python3 poeng.py svar-haiku.txt svar-sonnet.txt

Måler det som avgjør: falsk byggerate — hvor ofte modellen bygger på noe
brukeren ikke hadde bestemt seg for. Alt annet er sekundært.
"""
import json
import pathlib
import sys

HER = pathlib.Path(__file__).parent
TERSKEL = 0.10


def les_fasit():
    rader = [json.loads(l) for l in (HER / "items.jsonl").read_text().splitlines() if l.strip()]
    return {r["id"]: r for r in rader}


def les_svar(sti):
    ut = {}
    for linje in pathlib.Path(sti).read_text().splitlines():
        linje = linje.strip()
        if not linje or "|" not in linje:
            continue
        deler = [d.strip() for d in linje.split("|")]
        if len(deler) < 3 or not deler[0].rstrip(".").isdigit():
            continue
        ut[int(deler[0].rstrip("."))] = {"type": deler[1], "handling": deler[2]}
    return ut


def skaar(navn, fasit, svar, vis_bom=True):
    felles = sorted(set(fasit) & set(svar))
    mangler = sorted(set(fasit) - set(svar))

    ikke_bygg = [i for i in felles if fasit[i]["handling"] != "bygg"]
    falske = [i for i in ikke_bygg if svar[i]["handling"] == "bygg"]
    rate = len(falske) / len(ikke_bygg) if ikke_bygg else 0.0

    handling_rett = sum(1 for i in felles if svar[i]["handling"] == fasit[i]["handling"])
    type_rett = sum(1 for i in felles if svar[i]["type"] == fasit[i]["type"])

    harde = [i for i in felles if fasit[i]["type"] in ("tvil", "gjengivelse", "uenighet")]
    # Det som teller på de harde er om den bygde, ikke hvilken av de tre
    # ikke-bygg-handlingene den valgte. `hold` og `marker_åpent` er begge
    # riktig oppførsel; skillet mellom dem er finere enn produktet trenger.
    harde_bygde = [i for i in harde if svar[i]["handling"] == "bygg"]
    harde_type = sum(1 for i in harde if svar[i]["type"] == fasit[i]["type"])

    print(f"\n=== {navn} ===")
    if mangler:
        print(f"  MANGLER SVAR: {mangler}")
    print(f"  falsk byggerate  {len(falske)}/{len(ikke_bygg)} = {rate:.0%}"
          f"   {'BESTÅTT' if rate < TERSKEL else 'STRØKET'} (terskel {TERSKEL:.0%})")
    print(f"  handling riktig  {handling_rett}/{len(felles)} = {handling_rett/len(felles):.0%}")
    print(f"  type riktig      {type_rett}/{len(felles)} = {type_rett/len(felles):.0%}")
    if harde:
        print(f"  harde grenser    bygde på {len(harde_bygde)}/{len(harde)},"
              f" traff type {harde_type}/{len(harde)} (tvil, gjengivelse, uenighet)")

    if falske and vis_bom:
        print("\n  Bygget på noe som ikke var bestemt:")
        for i in falske:
            f = fasit[i]
            print(f"    {i:>2}. [{f['type']} -> {f['handling']}]  svarte {svar[i]['type']}|bygg")
            print(f"        «{f['tekst'][:88]}»")
    return rate


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    fasit = les_fasit()

    for sti in sys.argv[1:]:
        p = pathlib.Path(sti)
        if not p.is_absolute():
            p = HER / p
        if not p.exists():
            print(f"fant ikke {p}")
            continue
        svar = les_svar(p)
        skaar(p.stem, fasit, svar)

        # Daniels alternative lesning: krav er beslutninger om hvordan.
        alt = {i: (dict(r, handling="bygg") if r["type"] == "begrensning" else r)
               for i, r in fasit.items()}
        skaar(f"{p.stem} — krav teller som bygg", alt, svar, vis_bom=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
