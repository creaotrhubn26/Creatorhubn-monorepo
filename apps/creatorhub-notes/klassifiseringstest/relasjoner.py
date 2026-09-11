"""Måler forholdet mellom to avsnitt — den nye modelloppgaven i «Tidligere om dette».

    python3 relasjoner.py                      # kjører Haiku og scorer svaret
    python3 relasjoner.py --modell sonnet      # kjører en annen modell
    python3 relasjoner.py --eskaler            # Haiku først, Sonnet på det Haiku koblet
    python3 relasjoner.py svar-relasjoner.txt  # scorer et svar som alt finnes

Måltallet er falsk koblingsrate: av parene der fasiten er `urelatert`, hvor
ofte svarer modellen noe annet? Det er den ene feilen som ødelegger funksjonen,
fordi den forteller brukeren at hun har tenkt noe hun ikke har tenkt.

Prompten leses ut av appens egen kildekode, ikke skrevet av på nytt her.
Klassifiseringstesten lærte at en prompt som lever to steder måler noe annet
enn produktet gjør.
"""
import json
import pathlib
import subprocess
import sys

HER = pathlib.Path(__file__).parent
MINNE = HER.parent / "app/src-tauri/src/minne.rs"
MODELL = "claude-haiku-4-5-20251001"
STOR = "claude-sonnet-5"
FORHOLD = ("motsier", "bekrefter", "besvarer", "urelatert")


def les_prompt() -> str:
    """Henter `RELASJON` ut av minne.rs, med Rusts linjefortsettelser løst opp."""
    kilde = MINNE.read_text()
    start = kilde.index('const RELASJON: &str = "') + len('const RELASJON: &str = "')
    slutt = kilde.index('";', start)
    ut: list[str] = []
    for linje in kilde[start:slutt].split("\n"):
        if ut and ut[-1].endswith("\\"):
            ut[-1] = ut[-1][:-1] + linje.lstrip()
        else:
            ut.append(linje)
    return "\n".join(ut)


def les_par():
    rader = [json.loads(l) for l in (HER / "relasjoner.jsonl").read_text().splitlines() if l.strip()]
    return {r["id"]: r for r in rader}


def bygg(par) -> str:
    """Samme oppsett som `relasjonsprompt` i minne.rs."""
    kropp = "\n\n".join(
        f"{i}.\nNå: {r['nytt']}\nTidligere: {r['tidligere']}"
        for i, r in enumerate(par.values(), 1)
    )
    return f"{les_prompt()}\n\nParene:\n\n{kropp}"


def kjør(prompt: str, modell: str = MODELL) -> str:
    ut = subprocess.run(
        ["claude", "-p", "--model", modell, "--output-format", "text", prompt],
        capture_output=True,
        text=True,
        cwd="/tmp",
        timeout=600,
    )
    if ut.returncode != 0:
        sys.exit(f"claude feilet: {ut.stderr.strip()}")
    return ut.stdout


def les_svar(tekst: str, antall: int):
    """Samme toleranse som `parse_forhold`: rusk rundt, første ord teller."""
    ut = {}
    for linje in tekst.splitlines():
        linje = linje.strip().lstrip("`").strip().lstrip("-*").strip()
        if "|" not in linje:
            continue
        n, resten = linje.split("|", 1)
        n = n.strip().rstrip(".)").strip()
        if not n.isdigit():
            continue
        ord_ = "".join(c if c.isalpha() else " " for c in resten).split()
        if not ord_ or ord_[0].lower() not in FORHOLD:
            continue
        if 1 <= int(n) <= antall:
            ut[int(n)] = ord_[0].lower()
    return ut


def skår(navn: str, par, svar):
    ider = sorted(par)
    nummer = {i: n for n, i in enumerate(ider, 1)}
    mangler = [i for i in ider if nummer[i] not in svar]

    urelaterte = [i for i in ider if par[i]["fasit"] == "urelatert" and nummer[i] in svar]
    falske = [i for i in urelaterte if svar[nummer[i]] != "urelatert"]
    rate = len(falske) / len(urelaterte) if urelaterte else 0.0

    ekte = [i for i in ider if par[i]["fasit"] != "urelatert" and nummer[i] in svar]
    funnet = [i for i in ekte if svar[nummer[i]] == par[i]["fasit"]]
    tapt = [i for i in ekte if svar[nummer[i]] == "urelatert"]

    print(f"\n== {navn} ==")
    print(f"Falsk koblingsrate: {len(falske)}/{len(urelaterte)} = {rate:.0%}")
    print(f"Ekte forhold truffet nøyaktig: {len(funnet)}/{len(ekte)}")
    print(f"Ekte forhold kalt urelatert:   {len(tapt)}/{len(ekte)}")
    if mangler:
        print(f"Uten svar: {mangler}")
    for i in falske:
        print(f"  falsk {i}: sa {svar[nummer[i]]} — {par[i]['nytt'][:60]}")
    for i in ekte:
        if svar[nummer[i]] != par[i]["fasit"]:
            print(f"  bom  {i}: sa {svar[nummer[i]]}, fasit {par[i]['fasit']}")
    return rate


def eskaler(par):
    """Arkitekturen RESULTAT.md pekte på, brukt på den ene dyre avgjørelsen her.

    Haiku dømmer alt. Bare parene Haiku faktisk koblet sendes videre til
    Sonnet, og Sonnets svar er det som gjelder. Et par Haiku kalte urelatert
    blir stående urelatert — Haiku mister nesten aldri et ekte forhold, den
    kobler for mye.
    """
    ider = sorted(par)
    rått = kjør(bygg(par))
    (HER / "svar-relasjoner-eskalert-haiku.txt").write_text(rått)
    liten = les_svar(rått, len(par))
    koblet = [i for n, i in enumerate(ider, 1) if liten.get(n, "urelatert") != "urelatert"]
    print(f"Haiku koblet {len(koblet)} av {len(par)} par. Sender dem til Sonnet.")
    if not koblet:
        return {n: "urelatert" for n in range(1, len(par) + 1)}

    delmengde = {i: par[i] for i in koblet}
    rått = kjør(bygg(delmengde), STOR)
    (HER / "svar-relasjoner-eskalert-sonnet.txt").write_text(
        "".join(f"# par {i}\n" for i in koblet) + rått
    )
    stor = les_svar(rått, len(delmengde))
    ut = {n: "urelatert" for n in range(1, len(par) + 1)}
    for plass, i in enumerate(koblet, 1):
        ut[ider.index(i) + 1] = stor.get(plass, "urelatert")
    return ut


def main():
    par = les_par()
    if len(sys.argv) > 1 and sys.argv[1] == "--eskaler":
        skår("haiku + sonnet", par, eskaler(par))
        return
    if len(sys.argv) > 2 and sys.argv[1] == "--modell":
        modell = sys.argv[2]
        svar = kjør(bygg(par), modell)
        navn = modell.split("-")[1] if "-" in modell else modell
        (HER / f"svar-relasjoner-{navn}.txt").write_text(svar)
        skår(navn, par, les_svar(svar, len(par)))
        return
    if len(sys.argv) > 1:
        for sti in sys.argv[1:]:
            skår(sti, par, les_svar(pathlib.Path(sti).read_text(), len(par)))
        return
    prompt = bygg(par)
    (HER / "oppgave-relasjoner.txt").write_text(prompt)
    svar = kjør(prompt)
    (HER / "svar-relasjoner-haiku.txt").write_text(svar)
    skår("haiku", par, les_svar(svar, len(par)))


if __name__ == "__main__":
    main()
