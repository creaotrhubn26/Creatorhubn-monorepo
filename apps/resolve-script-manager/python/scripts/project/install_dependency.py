"""Install Dependency — runs `brew install <pkg>` or `pip3 install <pkg>` with progress.

Supported targets:
  - brew:    "ffmpeg", "chromaprint", "node@20", etc.
  - pip:     "anthropic", "whisperx", "Pillow", etc.
  - brew_bootstrap: installs Homebrew itself (requires sudo password — opens Terminal)

The Tauri app calls this from the Dependencies modal. SIGKILL-able via the
Cancel button in the Running Scripts panel.

Params:
  manager: "brew" | "pip"
  packages: ["ffmpeg", "chromaprint"]
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


# ML packages on Apple Silicon need Python ≤ 3.12 (ctranslate2 / torch pins).
# We auto-provision python@3.12 via brew when the system python is too new,
# then install into a dedicated venv (PEP 668 blocks pip on brew-managed Python).
PIP_COMPAT_PACKAGES = {"whisperx", "ctranslate2", "torch", "torchaudio", "pyannote.audio", "librosa"}
BREW_PY312_BIN_CANDIDATES = (
    "/opt/homebrew/opt/python@3.12/bin/python3.12",
    "/usr/local/opt/python@3.12/bin/python3.12",
    "/opt/homebrew/bin/python3.12",
    "/usr/local/bin/python3.12",
)
TRRPA_VENV_DIR = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/venv-py312"
)


def _venv_python() -> str:
    """Path to the venv's python binary (whether or not it exists yet)."""
    return os.path.join(TRRPA_VENV_DIR, "bin", "python")


def _ensure_venv(py312: str) -> str | None:
    """Create the dedicated venv under Application Support if missing. Returns venv python path."""
    venv_py = _venv_python()
    if os.path.isfile(venv_py):
        return venv_py
    bridge.log(f"Creating venv at {TRRPA_VENV_DIR}…")
    bridge.progress(0, 100, "Creating Python 3.12 venv…")
    os.makedirs(os.path.dirname(TRRPA_VENV_DIR), exist_ok=True)
    code, _ = stream_subprocess([py312, "-m", "venv", TRRPA_VENV_DIR], "venv")
    if code != 0 or not os.path.isfile(venv_py):
        bridge.error(f"Failed to create venv (exit {code})")
        return None
    # Upgrade pip inside the venv first — old pip can't resolve modern wheels
    stream_subprocess([venv_py, "-m", "pip", "install", "--upgrade", "pip", "wheel"], "pip-upgrade")
    return venv_py


def _detect_py_version(python: str) -> tuple[int, int] | None:
    try:
        out = subprocess.check_output(
            [python, "-c", "import sys; print(sys.version_info[0], sys.version_info[1])"],
            text=True,
            timeout=5,
        ).strip().split()
        return int(out[0]), int(out[1])
    except (subprocess.SubprocessError, ValueError, FileNotFoundError):
        return None


def _find_python312() -> str | None:
    for path in BREW_PY312_BIN_CANDIDATES:
        if os.path.isfile(path):
            return path
    return shutil.which("python3.12")


def _ensure_python312_via_brew() -> str | None:
    """Install python@3.12 via brew, returns path to the binary or None if failed."""
    existing = _find_python312()
    if existing:
        return existing

    brew = shutil.which("brew") or "/opt/homebrew/bin/brew"
    if not os.path.isfile(brew):
        bridge.error("Need python@3.12 for ML packages, but Homebrew is not installed.")
        return None

    bridge.log("System Python is too new for ML packages — installing python@3.12 via Homebrew…")
    bridge.progress(0, 100, "Installing python@3.12 (kan ta 2–4 minutter)…")
    code, _ = stream_subprocess([brew, "install", "python@3.12"], "brew")
    if code != 0:
        bridge.error(f"brew install python@3.12 failed (exit {code})")
        return None
    return _find_python312()


def _resolve_pip_python(packages: list[str]) -> tuple[str, bool]:
    """Pick the right python interpreter for `pip install <packages>`.

    Returns (python_path, is_venv). When is_venv=True, pip can install freely.
    When False (system Python), caller must pass --user and handle PEP 668.
    Auto-installs python@3.12 + venv if any package needs Python ≤ 3.12.
    """
    system_py = shutil.which("python3") or "/usr/bin/python3"
    needs_compat = any(p.lower().split("==")[0].strip() in PIP_COMPAT_PACKAGES for p in packages)
    if not needs_compat:
        return system_py, False

    sys_ver = _detect_py_version(system_py)
    if sys_ver and sys_ver <= (3, 12):
        return system_py, False

    bridge.log(
        f"System python is {sys_ver[0]}.{sys_ver[1]} — {', '.join(packages)} requires Python ≤ 3.12. "
        "Provisioning Python 3.12 + dedicated venv."
    )
    py312 = _ensure_python312_via_brew()
    if not py312:
        bridge.error("Could not provision Python 3.12. Aborting.")
        return system_py, False
    venv_py = _ensure_venv(py312)
    if not venv_py:
        bridge.error("Could not create venv. Aborting.")
        return system_py, False
    return venv_py, True


def _augmented_env() -> dict:
    """Tauri-spawned Python får minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin).
    For brew-managed verktøy (cmake, python@3.12, ffmpeg) må vi explicitly
    augment PATH før vi spawner subprocesser slik at bygg-scripts (e.g.
    dlib's setup.py som CALLS cmake) finner verktøyene."""
    env = os.environ.copy()
    extra_paths = [
        "/opt/homebrew/bin",        # Apple Silicon brew
        "/opt/homebrew/sbin",
        "/usr/local/bin",           # Intel brew
        "/usr/local/sbin",
        "/opt/homebrew/opt/cmake/bin",
        "/opt/local/bin",           # MacPorts (rare)
    ]
    current = env.get("PATH", "")
    parts = current.split(":") if current else []
    for p in extra_paths:
        if os.path.isdir(p) and p not in parts:
            parts.insert(0, p)
    env["PATH"] = ":".join(parts)

    # CMake 4.x har fjernet bakoverkompatibilitet med CMake < 3.5. Eldre
    # source-pakker (dlib 19.22.x, mange research-repoer) har fortsatt
    # `cmake_minimum_required(VERSION 2.8)` og krasjer ved configure-trinn:
    #   "Compatibility with CMake < 3.5 has been removed from CMake."
    # CMake leser CMAKE_POLICY_VERSION_MINIMUM fra env og injecter det som
    # min-version-policy hvis source ikke har en kompatibel verdi.
    env.setdefault("CMAKE_POLICY_VERSION_MINIMUM", "3.5")
    return env


def _find_binary(name: str) -> str | None:
    """Robust binary-lookup som ikke stoler på PATH alene."""
    direct = shutil.which(name)
    if direct:
        return direct
    for prefix in (
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/opt/homebrew/sbin",
        "/usr/local/sbin",
        "/usr/bin",
    ):
        candidate = os.path.join(prefix, name)
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    return None


def stream_subprocess(cmd: list[str], label: str) -> tuple[int, list[str]]:
    """Run a subprocess and stream stdout/stderr line-by-line as bridge.log events."""
    bridge.log(f"$ {' '.join(cmd)}")
    output: list[str] = []
    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
            env=_augmented_env(),  # augment PATH so cmake/brew tools are findable
        )
    except FileNotFoundError as exc:
        bridge.error(f"Could not spawn {cmd[0]}: {exc}")
        return 127, output

    assert proc.stdout is not None
    for line in iter(proc.stdout.readline, ""):
        line = line.rstrip()
        if not line:
            continue
        output.append(line)
        bridge.log(line[:200])
    code = proc.wait()
    return code, output


def run(params: dict, dry_run: bool) -> None:
    manager = (params.get("manager") or "").lower()
    packages = params.get("packages") or []
    if isinstance(packages, str):
        packages = [packages]

    # Fix: some DependenciesModal entries pass `"tensorflow tensorflow-hub"` as
    # one string (multiple pkgs separated by space). pip parses that as a
    # single invalid requirement → exit 1. Split on whitespace so each pkg
    # becomes its own argv entry.
    expanded: list[str] = []
    for pkg in packages:
        if isinstance(pkg, str) and " " in pkg.strip():
            expanded.extend(pkg.split())
        else:
            expanded.append(pkg)
    packages = expanded

    # Pre-flight: face_recognition needs to compile dlib from source, which
    # requires cmake + C++ compiler. Detect + install cmake via brew first.
    # NB: bruk _find_binary i stedet for shutil.which siden Tauri-spawned
    # Python har begrenset PATH og missing /opt/homebrew/bin.
    if manager == "pip" and any(
        (isinstance(p, str) and p.lower().split("==")[0].strip() == "face_recognition")
        for p in packages
    ):
        brew = _find_binary("brew")
        cmake_path = _find_binary("cmake")
        if not cmake_path and brew:
            bridge.log("face_recognition krever dlib (compiled fra C++). Installerer cmake først…")
            stream_subprocess([brew, "install", "cmake"], "brew-cmake-prereq")
            cmake_path = _find_binary("cmake")
        if not cmake_path:
            bridge.error(
                "face_recognition krever cmake (for å bygge dlib fra source). "
                "Installer manuelt: `brew install cmake`. Alternativt: skip "
                "face_recognition — Post Agent fungerer uten (faces-signalet "
                "fallback'er til OpenCV Haar cascade)."
            )
            sys.exit(1)
        bridge.log(f"cmake found at {cmake_path} — proceeding med face_recognition build")

        # macOS 26+ har fjernet legacy Carbon-header `<fp.h>`. Dlib 19.24+ og
        # 20+ bundler en versjon av libpng som inkluderer det headeren.
        # Vi prøver to fallback-strategier i rekkefølge:
        #
        #   Strategy A: dlib 19.22.1 (siste pre-bundled-libpng version) —
        #               kompilerer cleanly mot modern macOS SDK
        #   Strategy B: face_recognition_models alene (bare .pkl-vekter, ingen
        #               kompilering) + skip face_recognition itself + advar
        #               bruker at faces-signalet fallback'er til OpenCV Haar
        #               uten identity-matching
        #
        # Brukerflyt: vi prøver dlib==19.22.1 først. Hvis pip-install-trinnet
        # under feiler, faller pre-flight tilbake til Strategy B og emitter
        # en error som tydeliggjør at face_recognition er optional.
        if not any(
            (isinstance(p, str) and p.lower().split("==")[0].strip() == "dlib")
            for p in packages
        ):
            bridge.log(
                "Pinning dlib==19.22.1 to bypass macOS 26+ bundled-libpng "
                "issue (dlib 19.24+ bundler libpng som inkluderer legacy <fp.h>)"
            )
            packages = ["dlib==19.22.1"] + list(packages)

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would install {len(packages)} packages via {manager}: {packages}",
            "warning": "Homebrew installs run as your user. pip installs use python3 -m pip.",
        })
        return

    if not packages:
        bridge.error("packages list is empty")
        sys.exit(1)

    if manager == "brew":
        brew = _find_binary("brew") or "/opt/homebrew/bin/brew"
        if not os.path.isfile(brew):
            bridge.error("Homebrew is not installed. Install it first via the Bootstrap button.")
            sys.exit(1)
        cmd = [brew, "install", *packages]
    elif manager == "pip":
        python, is_venv = _resolve_pip_python(packages)
        bridge.log(f"Using {python} for pip install" + (" (in venv)" if is_venv else ""))
        if is_venv:
            cmd = [python, "-m", "pip", "install", *packages]
        else:
            cmd = [python, "-m", "pip", "install", "--user", *packages]
    elif manager == "brew_bootstrap":
        bridge.error(
            "Homebrew bootstrap must run interactively in Terminal. Open Terminal and paste:\n"
            "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        )
        sys.exit(1)
    else:
        bridge.error(f"Unknown manager '{manager}'. Use 'brew' or 'pip'.")
        sys.exit(1)

    bridge.progress(0, 100, f"Installing {packages[0]}…")
    code, output = stream_subprocess(cmd, manager)
    bridge.progress(100, 100, "Done.")

    if code != 0:
        # Special-case: dlib build feilet → face_recognition won't install.
        # Faces-signalet i Post Agent har OpenCV Haar cascade fallback som
        # fungerer UTEN dlib (kun mangler identity-matching mot known-faces-DB).
        # I stedet for hard-fail med kryptisk exit-code, log klart at brukeren
        # kan trygt skippe face_recognition.
        tail_output = " ".join(output[-50:]) if output else ""
        dlib_failed = "Failed to build dlib" in tail_output or "ERROR: Could not build wheels for dlib" in tail_output
        if manager == "pip" and dlib_failed:
            bridge.error(
                "dlib (face_recognition's C++ dependency) feilet å bygge på "
                "denne macOS-versjonen. SKIP face_recognition — Post Agent "
                "fungerer uten:\n"
                "  • Faces-signalet fallback'er til OpenCV Haar cascade\n"
                "  • Mangler kun: identity-matching mot known-faces-DB "
                "(boost shots med detekterte familie-medlemmer)\n"
                "  • Andre installerte signaler (YAMNet/Aesthetic/Pose/"
                "GroundingDINO/etc) er upåvirket\n"
                "Manuell workaround hvis du virkelig trenger face_recognition: "
                "`conda install -c conda-forge dlib` deretter "
                "`pip install --no-deps face_recognition face-recognition-models`"
            )
            sys.exit(code)
        bridge.error(f"{manager} install failed with exit code {code}")
        sys.exit(code)

    bridge.result({
        "manager": manager,
        "packages": packages,
        "exitCode": code,
        "lastLines": output[-10:],
    })


if __name__ == "__main__":
    bridge.main_guard(run)
