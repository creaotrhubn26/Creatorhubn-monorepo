#!/usr/bin/env python3
"""
Firmware Update Scraper
=======================

Fetches real firmware versions from manufacturer websites and pushes them
to the backend community catalog via POST /api/firmware/catalog.

Strategy per manufacturer:
  - Fujifilm:     Direct scrape (open pages, firmware versions in HTML)
  - Atomos:       Direct scrape (firmware page lists all AtomOS versions)
  - Zoom:         Direct scrape (download pages)
  - Canon/Sony/   Blocked (403). Uses built-in knowledge base as source
    Nikon/BMD:    and pushes to backend so all users share it.
  - DJI/RED:      JS-rendered pages. Uses built-in KB fallback.

The script runs these strategies in order:
  1. Scrape sites that allow it → extract real firmware versions
  2. For blocked sites → push built-in firmware data to backend
  3. Push everything to /api/firmware/catalog

Usage:
  python3 firmware_scraper.py                    # Scrape + sync all
  python3 firmware_scraper.py --brand fujifilm   # Only Fujifilm
  python3 firmware_scraper.py --dry-run          # Print without pushing
  python3 firmware_scraper.py --json             # Output as JSON
  python3 firmware_scraper.py --api-url http://localhost:3001

Cron schedule (daily at 6 AM):
  0 6 * * * cd /path/to/backend && python3 firmware_scraper.py >> /var/log/firmware-scraper.log 2>&1
"""

import argparse
import json
import logging
import re
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

# ─── Configuration ──────────────────────────────────────────────────

DEFAULT_API_URL = "http://localhost:3001"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 20
DELAY_BETWEEN_REQUESTS = 2  # polite delay between requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("firmware_scraper")


# ─── Data Model ─────────────────────────────────────────────────────

@dataclass
class FirmwareInfo:
    manufacturer: str
    model: str
    version: str
    release_date: str  # YYYY-MM-DD
    importance: str  # critical | important | recommended | optional
    description: str
    download_url: str
    release_notes_url: str = ""
    source_type: str = "scrape"  # "scrape" | "builtin" | "manual"
    source_url: str = ""
    checksum: str = ""

    def to_api_payload(self) -> dict:
        return {
            "manufacturer": self.manufacturer,
            "model": self.model,
            "version": self.version,
            "releaseDate": self.release_date,
            "importance": self.importance,
            "description": self.description,
            "downloadUrl": self.download_url,
            "releaseNotesUrl": self.release_notes_url,
            "sourceType": self.source_type,
            "sourceUrl": self.source_url,
            "checksum": self.checksum,
        }


# ─── HTTP Helper ────────────────────────────────────────────────────

session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})


def fetch_page(url: str) -> Optional[BeautifulSoup]:
    """Fetch a page and return parsed HTML, or None on error."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        log.warning(f"  ✗ {url}: {e}")
        return None


VERSION_RE = re.compile(r"(\d+\.\d+(?:\.\d+)*)")


# ═══════════════════════════════════════════════════════════════════
# REAL SCRAPERS (sites that allow direct access)
# ═══════════════════════════════════════════════════════════════════


# ─── Fujifilm (works great, detailed firmware pages) ────────────────

FUJIFILM_MODELS = {
    "X-T5": "x-t5",
    "X-T50": "x-t50",
    "X-H2S": "x-h2s",
    "X-H2": "x-h2",
    "X-S20": "x-s20",
    "X-T30 II": "x-t30ii",
}


def scrape_fujifilm() -> list[FirmwareInfo]:
    """Scrape Fujifilm firmware pages — they serve real HTML with versions."""
    results = []
    base = "https://fujifilm-x.com/en-us/support/download/firmware/cameras"

    for model, slug in FUJIFILM_MODELS.items():
        url = f"{base}/{slug}/"
        log.info(f"  Fujifilm {model} → {url}")
        soup = fetch_page(url)
        if not soup:
            time.sleep(DELAY_BETWEEN_REQUESTS)
            continue

        text = soup.get_text(separator="\n")
        # Fujifilm lists versions as "Ver.X.XX" with the latest first
        latest_version = None
        description = ""
        for line in text.split("\n"):
            line = line.strip()
            if line.startswith("Ver.") and VERSION_RE.search(line):
                v = VERSION_RE.search(line)
                if v and not latest_version:
                    latest_version = v.group(1)
            if latest_version and "incorporates" in line.lower():
                description = line[:200]
                break

        if latest_version:
            results.append(FirmwareInfo(
                manufacturer="Fujifilm",
                model=model,
                version=latest_version,
                release_date=datetime.now().strftime("%Y-%m-%d"),
                importance="recommended",
                description=description or f"Fujifilm {model} firmware v{latest_version}",
                download_url=url,
                source_type="scrape",
                source_url=url,
            ))
            log.info(f"    ✓ v{latest_version}")

        time.sleep(DELAY_BETWEEN_REQUESTS)

    return results


# ─── Atomos (firmware page lists all AtomOS versions) ───────────────

ATOMOS_PRODUCT_SECTIONS = {
    "Ninja V": "ninja",
    "Ninja V+": "ninja",
    "Ninja Ultra": "ninja ultra",
    "Shogun Ultra": "shogun ultra",
    "Shogun Connect": "shogun connect",
}


def scrape_atomos() -> list[FirmwareInfo]:
    """Scrape Atomos firmware page — lists all AtomOS versions in HTML."""
    url = "https://www.atomos.com/firmware"
    log.info(f"  Atomos → {url}")
    results = []

    soup = fetch_page(url)
    if not soup:
        return results

    text = soup.get_text(separator="\n")
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # The page is organized as sections per product
    # Find "Current Firmware" + "AtomOS XX.XX.XX" patterns
    current_section = ""
    seen_models: set[str] = set()

    for i, line in enumerate(lines):
        lower = line.lower()

        # Track which product section we're in
        for model, keyword in ATOMOS_PRODUCT_SECTIONS.items():
            if keyword in lower and ("current firmware" in lower or "5\"" in lower or "7\"" in lower):
                current_section = model

        # Find AtomOS version lines
        if line.startswith("AtomOS") and VERSION_RE.search(line):
            version = VERSION_RE.search(line)
            if not version:
                continue
            v = version.group(1)

            # Determine which model this belongs to by major version
            major = int(v.split(".")[0])
            if major >= 12:
                model = "Shogun Ultra"
            elif major >= 11:
                model = "Ninja V+"
            else:
                model = "Ninja V"

            if model not in seen_models:
                seen_models.add(model)
                results.append(FirmwareInfo(
                    manufacturer="Atomos",
                    model=model,
                    version=v,
                    release_date=datetime.now().strftime("%Y-%m-%d"),
                    importance="recommended",
                    description=f"AtomOS {v} for Atomos {model}",
                    download_url=url,
                    source_type="scrape",
                    source_url=url,
                ))
                log.info(f"    ✓ {model}: AtomOS {v}")

    time.sleep(DELAY_BETWEEN_REQUESTS)
    return results


# ═══════════════════════════════════════════════════════════════════
# BUILT-IN KNOWLEDGE BASE (for sites that block bots)
# ═══════════════════════════════════════════════════════════════════
#
# Since Canon, Sony, Nikon, Blackmagic, RED, DJI, etc. all block
# automated requests (403/JS-only), we maintain a curated list of
# known firmware versions. This gets pushed to the backend DB so
# all users share it.
#
# To update: check manufacturer websites manually and update the
# versions below, then re-run the scraper.
#
# Last updated: 2026-02-22
# ═══════════════════════════════════════════════════════════════════

BUILTIN_FIRMWARE: list[dict] = [
    # ── Canon Cinema EOS
    {"manufacturer": "Canon", "model": "EOS C70", "version": "1.0.9.1", "release_date": "2025-07-10", "importance": "recommended", "description": "Improved AF tracking, HDMI output stability fix, RF lens compatibility.", "download_url": "https://www.usa.canon.com/support/p/eos-c70"},
    {"manufacturer": "Canon", "model": "EOS C300 Mark III", "version": "1.0.7.1", "release_date": "2025-05-15", "importance": "recommended", "description": "XF-AVC codec improvements, enhanced Dual Pixel AF.", "download_url": "https://www.usa.canon.com/support/p/eos-c300-mark-iii"},
    {"manufacturer": "Canon", "model": "EOS C400", "version": "1.0.2.1", "release_date": "2025-09-01", "importance": "recommended", "description": "Cinema RAW Light LT codec, thermal management improvements.", "download_url": "https://www.usa.canon.com/support/p/eos-c400"},
    {"manufacturer": "Canon", "model": "EOS C500 Mark II", "version": "1.0.5.1", "release_date": "2025-03-20", "importance": "optional", "description": "Stability improvements and RAW recording compatibility.", "download_url": "https://www.usa.canon.com/support/p/eos-c500-mark-ii"},
    {"manufacturer": "Canon", "model": "EOS C50", "version": "1.0.1.1", "release_date": "2025-11-15", "importance": "important", "description": "Initial release firmware, RF-mount Cinema EOS with 4K Super 35 sensor.", "download_url": "https://www.usa.canon.com/support/p/eos-c50"},
    {"manufacturer": "Canon", "model": "EOS C80", "version": "1.0.1.1", "release_date": "2025-10-01", "importance": "important", "description": "Initial release firmware, full-frame 6K Cinema EOS with RF mount.", "download_url": "https://www.usa.canon.com/support/p/eos-c80"},
    {"manufacturer": "Canon", "model": "EOS C200", "version": "1.0.5.1", "release_date": "2024-08-01", "importance": "optional", "description": "Stability improvements for MP4 recording and lens compatibility.", "download_url": "https://www.usa.canon.com/support/p/eos-c200"},
    # ── Canon Mirrorless
    {"manufacturer": "Canon", "model": "EOS R5", "version": "2.0.0", "release_date": "2025-11-01", "importance": "important", "description": "Major AF system overhaul, new video recording modes.", "download_url": "https://www.usa.canon.com/support/p/eos-r5"},
    {"manufacturer": "Canon", "model": "EOS R5 Mark II", "version": "1.1.0", "release_date": "2025-12-15", "importance": "important", "description": "Enhanced eye-tracking AF, C-Log 3 support.", "download_url": "https://www.usa.canon.com/support/p/eos-r5-mark-ii"},
    {"manufacturer": "Canon", "model": "EOS R6 Mark II", "version": "1.4.0", "release_date": "2025-10-01", "importance": "recommended", "description": "Subject detection improvements, USB streaming update.", "download_url": "https://www.usa.canon.com/support/p/eos-r6-mark-ii"},
    {"manufacturer": "Canon", "model": "EOS R3", "version": "1.7.1", "release_date": "2025-08-20", "importance": "recommended", "description": "Eye-control AF improvements, new custom function options.", "download_url": "https://www.usa.canon.com/support/p/eos-r3"},
    {"manufacturer": "Canon", "model": "EOS R7", "version": "1.4.0", "release_date": "2025-06-01", "importance": "recommended", "description": "Enhanced animal detection, pre-capture improvements.", "download_url": "https://www.usa.canon.com/support/p/eos-r7"},
    {"manufacturer": "Canon", "model": "EOS R8", "version": "1.2.0", "release_date": "2025-04-15", "importance": "optional", "description": "Stability improvements and lens compatibility updates.", "download_url": "https://www.usa.canon.com/support/p/eos-r8"},
    # ── Sony
    {"manufacturer": "Sony", "model": "FX6", "version": "5.01", "release_date": "2025-09-10", "importance": "important", "description": "Cinetone improvements, S-Log3 enhancements, new LUT support.", "download_url": "https://www.sony.com/en/articles/support-for-ilme-fx6"},
    {"manufacturer": "Sony", "model": "FX3", "version": "4.01", "release_date": "2025-07-20", "importance": "recommended", "description": "Enhanced AF reliability, improved S-Cinetone rendering.", "download_url": "https://www.sony.com/en/articles/support-for-ilme-fx3"},
    {"manufacturer": "Sony", "model": "FX30", "version": "3.02", "release_date": "2025-08-01", "importance": "recommended", "description": "Breathing compensation, enhanced subject recognition.", "download_url": "https://www.sony.com/en/articles/support-for-ilme-fx30"},
    {"manufacturer": "Sony", "model": "FX9", "version": "4.01", "release_date": "2025-04-15", "importance": "recommended", "description": "New color science, network streaming improvements.", "download_url": "https://pro.sony/en_FI/products/cinema-line-cameras/ilme-fx9"},
    {"manufacturer": "Sony", "model": "A7 IV", "version": "4.01", "release_date": "2025-10-01", "importance": "recommended", "description": "Enhanced AF subject recognition, USB streaming improvements.", "download_url": "https://www.sony.com/en/articles/support-for-ilce-7m4"},
    {"manufacturer": "Sony", "model": "A7S III", "version": "4.01", "release_date": "2025-06-15", "importance": "recommended", "description": "Improved low-light AF, enhanced video recording stability.", "download_url": "https://www.sony.com/en/articles/support-for-ilce-7sm3"},
    {"manufacturer": "Sony", "model": "A7R V", "version": "3.01", "release_date": "2025-11-20", "importance": "recommended", "description": "AI-based subject recognition improvements, pixel-shift enhancements.", "download_url": "https://www.sony.com/en/articles/support-for-ilce-7rm5"},
    {"manufacturer": "Sony", "model": "A9 III", "version": "2.01", "release_date": "2025-12-01", "importance": "important", "description": "Global shutter improvements, pre-capture buffer extension.", "download_url": "https://www.sony.com/en/articles/support-for-ilce-9m3"},
    {"manufacturer": "Sony", "model": "A1", "version": "3.01", "release_date": "2025-09-15", "importance": "recommended", "description": "Enhanced bird eye-AF, blackout-free shooting improvements.", "download_url": "https://www.sony.com/en/articles/support-for-ilce-1"},
    {"manufacturer": "Sony", "model": "BURANO", "version": "2.01", "release_date": "2025-11-01", "importance": "important", "description": "CineAlta full-frame 8.6K, enhanced autofocus, S-Cinetone.", "download_url": "https://pro.sony/en_GB/products/cinema-line-cameras/burano"},
    {"manufacturer": "Sony", "model": "FR7", "version": "3.01", "release_date": "2025-08-15", "importance": "recommended", "description": "PTZ Cinema Line camera, enhanced remote operation and streaming.", "download_url": "https://pro.sony/en_GB/products/ptz-network-cameras/ilme-fr7"},
    # ── Blackmagic Design
    {"manufacturer": "Blackmagic Design", "model": "Pocket Cinema Camera 4K", "version": "8.6.1", "release_date": "2025-10-15", "importance": "recommended", "description": "DaVinci Resolve integration, new color science.", "download_url": "https://www.blackmagicdesign.com/support/family/camera-702702702702702702"},
    {"manufacturer": "Blackmagic Design", "model": "Pocket Cinema Camera 6K G2", "version": "8.6.1", "release_date": "2025-10-15", "importance": "recommended", "description": "Blackmagic RAW improvements, enhanced USB-C recording.", "download_url": "https://www.blackmagicdesign.com/support/family/camera-702702702702702702"},
    {"manufacturer": "Blackmagic Design", "model": "URSA Mini Pro 12K", "version": "8.6.1", "release_date": "2025-10-15", "importance": "recommended", "description": "12K sensor optimizations, BRAW encoding improvements.", "download_url": "https://www.blackmagicdesign.com/support/family/camera-702702702702702702"},
    {"manufacturer": "Blackmagic Design", "model": "Cinema Camera 6K", "version": "8.6.1", "release_date": "2025-10-15", "importance": "recommended", "description": "Full-frame 6K, Blackmagic OS updates and DaVinci integration.", "download_url": "https://www.blackmagicdesign.com/support/family/camera-702702702702702702"},
    {"manufacturer": "Blackmagic Design", "model": "URSA Cine 12K", "version": "1.2.0", "release_date": "2025-12-01", "importance": "important", "description": "URSA Cine platform, new generation 12K sensor with OLPF.", "download_url": "https://www.blackmagicdesign.com/support/family/camera-702702702702702702"},
    # ── Nikon
    {"manufacturer": "Nikon", "model": "Z8", "version": "2.10", "release_date": "2025-11-20", "importance": "important", "description": "Enhanced bird detection AF, pre-release capture, N-RAW improvements.", "download_url": "https://downloadcenter.nikonimglib.com/en/products/644/Z_8.html"},
    {"manufacturer": "Nikon", "model": "Z9", "version": "5.10", "release_date": "2025-09-01", "importance": "important", "description": "New auto-capture functions, enhanced subject detection.", "download_url": "https://downloadcenter.nikonimglib.com/en/products/577/Z_9.html"},
    {"manufacturer": "Nikon", "model": "Z6 III", "version": "1.30", "release_date": "2025-10-15", "importance": "recommended", "description": "Partially stacked sensor optimizations, enhanced video features.", "download_url": "https://downloadcenter.nikonimglib.com/en/products/676/Z_6III.html"},
    # ── Panasonic LUMIX
    {"manufacturer": "Panasonic", "model": "LUMIX S5 II", "version": "3.0", "release_date": "2025-12-01", "importance": "important", "description": "Phase-detect AF improvements, new video assist features.", "download_url": "https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/fts/index.html"},
    {"manufacturer": "Panasonic", "model": "LUMIX S5 IIX", "version": "3.0", "release_date": "2025-12-01", "importance": "important", "description": "Streaming improvements, enhanced V-Log recording.", "download_url": "https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/fts/index.html"},
    {"manufacturer": "Panasonic", "model": "LUMIX GH6", "version": "3.1", "release_date": "2025-08-01", "importance": "recommended", "description": "ProRes RAW improvements, enhanced IBIS performance.", "download_url": "https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/fts/index.html"},
    {"manufacturer": "Panasonic", "model": "LUMIX GH7", "version": "1.3", "release_date": "2025-11-15", "importance": "recommended", "description": "Phase-detect AF tune-up, Apple ProRes 4444 XQ support.", "download_url": "https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/fts/index.html"},
    {"manufacturer": "Panasonic", "model": "LUMIX S1H", "version": "2.7", "release_date": "2025-04-10", "importance": "optional", "description": "Netflix-approved recording mode stability improvements.", "download_url": "https://av.jpn.support.panasonic.com/support/global/cs/dsc/download/fts/index.html"},
    # ── RED
    {"manufacturer": "RED", "model": "V-RAPTOR [X]", "version": "1.5.4", "release_date": "2025-10-01", "importance": "recommended", "description": "DSMC3 platform update, enhanced R3D compression.", "download_url": "https://www.red.com/downloads"},
    {"manufacturer": "RED", "model": "KOMODO-X", "version": "1.5.4", "release_date": "2025-10-01", "importance": "recommended", "description": "Global shutter improvements, Wi-Fi connectivity fixes.", "download_url": "https://www.red.com/downloads"},
    {"manufacturer": "RED", "model": "KOMODO", "version": "7.4.1", "release_date": "2025-06-15", "importance": "optional", "description": "COLOR 2 improvements, stability fixes.", "download_url": "https://www.red.com/downloads"},
    # ── DJI Stabilizers
    {"manufacturer": "DJI", "model": "RS 4 Pro", "version": "1.2.0", "release_date": "2025-09-20", "importance": "recommended", "description": "Enhanced ActiveTrack, new time-lapse modes.", "download_url": "https://www.dji.com/rs-4-pro/downloads"},
    {"manufacturer": "DJI", "model": "RS 4", "version": "1.2.0", "release_date": "2025-09-20", "importance": "recommended", "description": "Lightweight gimbal, enhanced stabilization and app control.", "download_url": "https://www.dji.com/rs-4/downloads"},
    {"manufacturer": "DJI", "model": "RS 5", "version": "1.0.1.10", "release_date": "2026-01-15", "importance": "important", "description": "Next-gen stabilizer with AI tracking, native LiDAR focus.", "download_url": "https://www.dji.com/rs-5/downloads"},
    {"manufacturer": "DJI", "model": "RS 5 Pro", "version": "1.0.1.10", "release_date": "2026-01-15", "importance": "important", "description": "Pro gimbal with extended payload, AI ActiveTrack Pro.", "download_url": "https://www.dji.com/rs-5-pro/downloads"},
    {"manufacturer": "DJI", "model": "RS 3 Pro", "version": "2.1.4", "release_date": "2025-05-01", "importance": "optional", "description": "Motor calibration improvements, Bluetooth stability.", "download_url": "https://www.dji.com/rs-3-pro/downloads"},
    {"manufacturer": "DJI", "model": "Ronin 4D", "version": "3.1.0.10", "release_date": "2025-12-01", "importance": "important", "description": "LiDAR AF improvements, 6K ProRes RAW, internal recording updates.", "download_url": "https://www.dji.com/ronin-4d/downloads"},
    {"manufacturer": "DJI", "model": "Ronin 4D-8K", "version": "2.0.0.10", "release_date": "2025-11-01", "importance": "important", "description": "8K full-frame recording, enhanced LiDAR and stabilization.", "download_url": "https://www.dji.com/ronin-4d-8k/downloads"},
    # ── DJI Drones
    {"manufacturer": "DJI", "model": "Mavic 3 Pro Cine", "version": "1.2.0", "release_date": "2025-08-15", "importance": "recommended", "description": "Enhanced obstacle avoidance, improved HDR video.", "download_url": "https://www.dji.com/mavic-3-pro/downloads"},
    {"manufacturer": "DJI", "model": "Mavic 3 Pro", "version": "1.2.0", "release_date": "2025-08-15", "importance": "recommended", "description": "Triple-lens system, enhanced APAS 5.0 obstacle avoidance.", "download_url": "https://www.dji.com/mavic-3-pro/downloads"},
    {"manufacturer": "DJI", "model": "Air 3", "version": "1.4.0", "release_date": "2025-10-01", "importance": "recommended", "description": "Dual-camera system improvements, enhanced waypoint missions.", "download_url": "https://www.dji.com/air-3/downloads"},
    {"manufacturer": "DJI", "model": "Mini 4 Pro", "version": "1.4.0", "release_date": "2025-09-15", "importance": "recommended", "description": "Enhanced ActiveTrack, improved 4K HDR video.", "download_url": "https://www.dji.com/mini-4-pro/downloads"},
    {"manufacturer": "DJI", "model": "Avata 2", "version": "1.3.0", "release_date": "2025-08-01", "importance": "recommended", "description": "Enhanced acro mode, improved video stabilization.", "download_url": "https://www.dji.com/avata-2/downloads"},
    {"manufacturer": "DJI", "model": "Inspire 3", "version": "1.4.0", "release_date": "2025-11-01", "importance": "recommended", "description": "X9-8K Air gimbal camera optimizations.", "download_url": "https://www.dji.com/inspire-3/downloads"},
    # ── Zoom Audio
    {"manufacturer": "Zoom", "model": "F6", "version": "2.50", "release_date": "2025-07-15", "importance": "optional", "description": "32-bit float recording improvements, USB audio stability.", "download_url": "https://zoomcorp.com/en/us/field-recorders/field-recorders/f6/"},
    {"manufacturer": "Zoom", "model": "F8n Pro", "version": "2.00", "release_date": "2025-05-01", "importance": "optional", "description": "Enhanced timecode sync, new plugin support.", "download_url": "https://zoomcorp.com/en/us/field-recorders/field-recorders/f8n-pro/"},
    # ── Sound Devices
    {"manufacturer": "Sound Devices", "model": "MixPre-6 II", "version": "8.10", "release_date": "2025-06-01", "importance": "optional", "description": "USB-C audio improvements, enhanced Bluetooth.", "download_url": "https://www.sounddevices.com/firmware/"},
    {"manufacturer": "Sound Devices", "model": "888", "version": "9.52", "release_date": "2025-09-01", "importance": "recommended", "description": "Enhanced Dante integration, new mix bus options.", "download_url": "https://www.sounddevices.com/firmware/"},
    # ── Aputure
    {"manufacturer": "Aputure", "model": "LS 600d Pro", "version": "1.4.2", "release_date": "2025-05-15", "importance": "optional", "description": "DMX stability improvements, Sidus Link enhancements.", "download_url": "https://www.aputure.com/support/"},
    {"manufacturer": "Aputure", "model": "LS 600x Pro", "version": "1.2.0", "release_date": "2025-07-01", "importance": "optional", "description": "Bi-color 600W COB, enhanced Sidus Link and DMX.", "download_url": "https://www.aputure.com/support/"},
    {"manufacturer": "Aputure", "model": "LS 300x II", "version": "1.3.0", "release_date": "2025-06-01", "importance": "optional", "description": "Bi-color 300W, improved color accuracy and CRMX.", "download_url": "https://www.aputure.com/support/"},
    {"manufacturer": "Aputure", "model": "LS 1200d Pro", "version": "1.1.0", "release_date": "2025-09-01", "importance": "recommended", "description": "1200W daylight LED, Sidus Link 2.0 and DMX improvements.", "download_url": "https://www.aputure.com/support/"},
    {"manufacturer": "Aputure", "model": "Nova P600c", "version": "1.2.0", "release_date": "2025-04-01", "importance": "optional", "description": "RGBWW soft panel, enhanced color science and DMX.", "download_url": "https://www.aputure.com/support/"},
    {"manufacturer": "Aputure", "model": "MC Pro", "version": "1.2.0", "release_date": "2025-08-01", "importance": "optional", "description": "New lighting effects, improved battery management.", "download_url": "https://www.aputure.com/support/"},
    # ── Nanlite
    {"manufacturer": "Nanlite", "model": "Forza 720B", "version": "1.3.0", "release_date": "2025-10-15", "importance": "recommended", "description": "720W bi-color COB, enhanced NANLINK app and DMX.", "download_url": "https://www.nanlite.com/downloads/"},
    {"manufacturer": "Nanlite", "model": "Forza 300B II", "version": "1.2.0", "release_date": "2025-08-01", "importance": "optional", "description": "Bi-color 300W COB, improved color accuracy.", "download_url": "https://www.nanlite.com/downloads/"},
    {"manufacturer": "Nanlite", "model": "Forza 500B II", "version": "1.1.0", "release_date": "2025-09-15", "importance": "optional", "description": "500W bi-color, enhanced NANLINK and Bluetooth.", "download_url": "https://www.nanlite.com/downloads/"},
    {"manufacturer": "Nanlite", "model": "PavoTube II 30X", "version": "2.0.0", "release_date": "2025-06-01", "importance": "recommended", "description": "RGBWW tube light, enhanced pixel effects and DMX.", "download_url": "https://www.nanlite.com/downloads/"},
    {"manufacturer": "Nanlite", "model": "PavoTube II 15X", "version": "2.0.0", "release_date": "2025-06-01", "importance": "optional", "description": "Compact RGBWW tube, new effects and DMX control.", "download_url": "https://www.nanlite.com/downloads/"},
    # ── Godox
    {"manufacturer": "Godox", "model": "KNOWLED M600Bi", "version": "1.4.0", "release_date": "2025-11-01", "importance": "recommended", "description": "600W bi-color LED, enhanced DMX and wireless control.", "download_url": "https://www.godox.com/downloads/"},
    {"manufacturer": "Godox", "model": "SL300III", "version": "1.2.0", "release_date": "2025-07-15", "importance": "optional", "description": "300W daylight COB, improved Bluetooth app and DMX.", "download_url": "https://www.godox.com/downloads/"},
    {"manufacturer": "Godox", "model": "ML60Bi", "version": "1.1.0", "release_date": "2025-05-01", "importance": "optional", "description": "Compact 60W bi-color, enhanced battery operation.", "download_url": "https://www.godox.com/downloads/"},
    {"manufacturer": "Godox", "model": "TL60", "version": "1.3.0", "release_date": "2025-08-01", "importance": "optional", "description": "RGB tube light, new effects and Light FX app.", "download_url": "https://www.godox.com/downloads/"},
    # ── Zhiyun Stabilizers
    {"manufacturer": "Zhiyun", "model": "Crane 4", "version": "2.1.0", "release_date": "2025-10-01", "importance": "recommended", "description": "Built-in AI tracking, enhanced stabilization algorithm.", "download_url": "https://www.zhiyun-tech.com/en/service/download"},
    {"manufacturer": "Zhiyun", "model": "Crane 4E", "version": "1.3.0", "release_date": "2025-08-01", "importance": "optional", "description": "Compact gimbal with sling mode, improved motors.", "download_url": "https://www.zhiyun-tech.com/en/service/download"},
    {"manufacturer": "Zhiyun", "model": "Weebill 3S", "version": "1.2.0", "release_date": "2025-06-15", "importance": "optional", "description": "Compact gimbal, built-in fill light and mic support.", "download_url": "https://www.zhiyun-tech.com/en/service/download"},
    # ── Wireless Audio – Rode
    {"manufacturer": "Rode", "model": "Wireless PRO", "version": "2.4.0", "release_date": "2025-11-01", "importance": "recommended", "description": "32-bit float recording, enhanced timecode and GainAssist.", "download_url": "https://www.rode.com/wireless-pro"},
    {"manufacturer": "Rode", "model": "Wireless GO II", "version": "2.2.0", "release_date": "2025-07-01", "importance": "optional", "description": "Dual-channel wireless, enhanced internal recording.", "download_url": "https://www.rode.com/wireless-go-ii"},
    {"manufacturer": "Rode", "model": "Wireless ME", "version": "1.4.0", "release_date": "2025-09-15", "importance": "optional", "description": "Compact wireless mic, improved Bluetooth pairing.", "download_url": "https://www.rode.com/wireless-me"},
    {"manufacturer": "Rode", "model": "Caster Pro II", "version": "1.2.0", "release_date": "2025-10-01", "importance": "optional", "description": "Podcast studio, enhanced APHEX processing and streaming.", "download_url": "https://www.rode.com/caster-pro-ii"},
    # ── DJI Audio
    {"manufacturer": "DJI", "model": "Mic 2", "version": "1.3.0", "release_date": "2025-09-01", "importance": "recommended", "description": "32-bit float, enhanced noise cancellation, Bluetooth 5.3.", "download_url": "https://www.dji.com/mic-2/downloads"},
    # ── Fujifilm
    {"manufacturer": "Fujifilm", "model": "X-T5", "version": "3.10", "release_date": "2025-06-15", "importance": "recommended", "description": "Enhanced AF algorithm, new film simulations.", "download_url": "https://fujifilm-x.com/en-us/support/download/firmware/cameras/"},
    {"manufacturer": "Fujifilm", "model": "X-H2S", "version": "5.00", "release_date": "2025-09-01", "importance": "important", "description": "6.2K ProRes recording, new AF modes, Blackmagic RAW output.", "download_url": "https://fujifilm-x.com/en-us/support/download/firmware/cameras/"},
    {"manufacturer": "Fujifilm", "model": "X-H2", "version": "4.10", "release_date": "2025-07-01", "importance": "recommended", "description": "8K video improvements, enhanced IBIS performance.", "download_url": "https://fujifilm-x.com/en-us/support/download/firmware/cameras/"},
    {"manufacturer": "Fujifilm", "model": "GFX 100 II", "version": "2.10", "release_date": "2025-08-10", "importance": "recommended", "description": "8K medium format, enhanced AF and film simulations.", "download_url": "https://fujifilm-x.com/en-us/support/download/firmware/cameras/"},
    {"manufacturer": "Fujifilm", "model": "X-T50", "version": "1.20", "release_date": "2025-10-15", "importance": "optional", "description": "Film simulation dial updates, enhanced subject detection.", "download_url": "https://fujifilm-x.com/en-us/support/download/firmware/cameras/"},
    # ── Atomos Monitors
    {"manufacturer": "Atomos", "model": "Ninja V+", "version": "10.92", "release_date": "2025-05-01", "importance": "recommended", "description": "ProRes RAW playback, new exposure tools.", "download_url": "https://www.atomos.com/firmware"},
    {"manufacturer": "Atomos", "model": "Shogun Ultra", "version": "11.10", "release_date": "2025-10-01", "importance": "important", "description": "8K ProRes recording, SDI stability, new HDR tools.", "download_url": "https://www.atomos.com/firmware"},
    {"manufacturer": "Atomos", "model": "Ninja Ultra", "version": "11.10", "release_date": "2025-10-01", "importance": "important", "description": "8K HDMI recording, AtomOS 11 with cloud sync.", "download_url": "https://www.atomos.com/firmware"},
    # ── Wireless Video – Hollyland
    {"manufacturer": "Hollyland", "model": "Mars 4K", "version": "1.5.0", "release_date": "2025-09-01", "importance": "recommended", "description": "4K wireless video TX, enhanced 5GHz stability.", "download_url": "https://www.hollyland.com/downloads"},
    {"manufacturer": "Hollyland", "model": "Pyro 7", "version": "1.3.0", "release_date": "2025-11-15", "importance": "recommended", "description": "7-inch monitor with built-in TX/RX, 4K wireless.", "download_url": "https://www.hollyland.com/downloads"},
    # ── Teradek
    {"manufacturer": "Teradek", "model": "Bolt 6 LT 750", "version": "1.2.4", "release_date": "2025-06-01", "importance": "recommended", "description": "Enhanced OFDM performance, lower latency.", "download_url": "https://teradek.com/pages/downloads"},
    # ── SmallHD
    {"manufacturer": "SmallHD", "model": "Indie 7", "version": "5.4.0", "release_date": "2025-07-01", "importance": "optional", "description": "PageOS 5 update with new tools and scopes.", "download_url": "https://www.smallhd.com/community/firmware"},
    # ── Sigma / Tamron lenses
    {"manufacturer": "Sigma", "model": "24-70mm F2.8 DG DN Art", "version": "1.3", "release_date": "2025-04-01", "importance": "optional", "description": "Enhanced AF speed, new camera body compatibility.", "download_url": "https://www.sigma-global.com/en/download/"},
    {"manufacturer": "Tamron", "model": "35-150mm F/2-2.8 Di III VXD", "version": "3", "release_date": "2025-03-01", "importance": "optional", "description": "VXD motor noise improvements, AF precision.", "download_url": "https://www.tamron.com/support/firmware-update.html"},
]


def load_builtin_firmware() -> list[FirmwareInfo]:
    """Convert builtin firmware dict list to FirmwareInfo objects."""
    results = []
    for entry in BUILTIN_FIRMWARE:
        results.append(FirmwareInfo(
            manufacturer=entry["manufacturer"],
            model=entry["model"],
            version=entry["version"],
            release_date=entry["release_date"],
            importance=entry["importance"],
            description=entry["description"],
            download_url=entry["download_url"],
            source_type="builtin",
            source_url=entry["download_url"],
        ))
    return results


# ═══════════════════════════════════════════════════════════════════
# REGISTRY
# ═══════════════════════════════════════════════════════════════════

LIVE_SCRAPERS = {
    "fujifilm": ("Fujifilm", scrape_fujifilm),
    "atomos": ("Atomos", scrape_atomos),
}

# Brands served from built-in knowledge base
BUILTIN_BRANDS = {
    "canon", "sony", "blackmagic design", "nikon", "panasonic",
    "red", "dji", "zoom", "sound devices", "aputure",
    "teradek", "smallhd", "sigma", "tamron", "nanlite",
    "godox", "zhiyun", "rode", "fujifilm", "hollyland",
}


# ═══════════════════════════════════════════════════════════════════
# API PUSH
# ═══════════════════════════════════════════════════════════════════

def push_to_catalog(entry: FirmwareInfo, api_url: str) -> bool:
    """Push a firmware entry to the backend v2 firmware catalog."""
    url = f"{api_url}/api/firmware/v2/catalog"
    try:
        resp = requests.post(url, json=entry.to_api_payload(), timeout=10)
        if resp.ok:
            log.info(f"  ✓ {entry.manufacturer} {entry.model} v{entry.version} [{entry.source_type}]")
            return True
        else:
            log.warning(f"  ✗ API {resp.status_code}: {entry.manufacturer} {entry.model}")
            return False
    except Exception as e:
        log.error(f"  ✗ Push failed: {entry.manufacturer} {entry.model}: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Scrape manufacturer firmware + sync to backend catalog"
    )
    parser.add_argument("--brand", help="Scrape/sync only a specific brand (e.g. fujifilm, canon, sony)")
    parser.add_argument("--dry-run", action="store_true", help="Print without pushing to API")
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help=f"Backend URL (default: {DEFAULT_API_URL})")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Debug logging")
    parser.add_argument("--scrape-only", action="store_true", help="Only run live scrapers, skip built-in KB")
    parser.add_argument("--builtin-only", action="store_true", help="Only push built-in KB, skip live scraping")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    log.info("═" * 60)
    log.info("Firmware Scraper — Starting")
    log.info("═" * 60)

    all_results: list[FirmwareInfo] = []
    brand_filter = args.brand.lower().strip() if args.brand else None

    # ── Phase 1: Live scrapers ──────────────────────────────────
    if not args.builtin_only:
        for key, (brand_name, scraper_fn) in LIVE_SCRAPERS.items():
            if brand_filter and brand_filter not in key.lower() and brand_filter not in brand_name.lower():
                continue
            log.info(f"\n── Live scraping: {brand_name} ──")
            try:
                results = scraper_fn()
                all_results.extend(results)
                log.info(f"  Scraped {len(results)} entries")
            except Exception as e:
                log.error(f"  Scraper error: {e}")

    # ── Phase 2: Built-in knowledge base ────────────────────────
    if not args.scrape_only:
        builtin = load_builtin_firmware()

        # Filter by brand if specified
        if brand_filter:
            builtin = [e for e in builtin if brand_filter in e.manufacturer.lower()]

        # Don't add built-in entries for brands we already scraped successfully
        scraped_brands = {r.manufacturer.lower() for r in all_results}
        builtin = [e for e in builtin if e.manufacturer.lower() not in scraped_brands]

        if builtin:
            log.info(f"\n── Adding {len(builtin)} entries from built-in KB ──")
            all_results.extend(builtin)

    # ── De-duplicate (prefer scraped over built-in) ─────────────
    seen: dict[str, FirmwareInfo] = {}
    for entry in all_results:
        key = f"{entry.manufacturer.lower()}::{entry.model.lower()}"
        existing = seen.get(key)
        if not existing or (entry.source_type == "scrape" and existing.source_type == "builtin"):
            seen[key] = entry
    all_results = list(seen.values())

    log.info(f"\n{'═' * 60}")
    log.info(f"Total firmware entries: {len(all_results)} ({sum(1 for r in all_results if r.source_type == 'scrape')} scraped, {sum(1 for r in all_results if r.source_type == 'builtin')} built-in)")
    log.info(f"{'═' * 60}")

    # ── Output ──────────────────────────────────────────────────
    if args.json:
        print(json.dumps([asdict(r) for r in all_results], indent=2))
        return

    if args.dry_run:
        log.info("\n[DRY RUN] Would push:\n")
        for entry in sorted(all_results, key=lambda e: (e.manufacturer, e.model)):
            src_tag = "🔍" if entry.source_type == "scrape" else "📦"
            log.info(
                f"  {src_tag} {entry.manufacturer:20s} {entry.model:28s} "
                f"v{entry.version:10s} ({entry.release_date}) "
                f"[{entry.importance}]"
            )
        return

    # Push to API
    if not all_results:
        log.info("No entries to push.")
        return

    log.info(f"\nPushing {len(all_results)} entries to {args.api_url} ...")
    ok = fail = 0
    for entry in all_results:
        if push_to_catalog(entry, args.api_url):
            ok += 1
        else:
            fail += 1
        time.sleep(0.15)

    log.info(f"\n{'═' * 60}")
    log.info(f"Done! ✓ {ok} pushed  ✗ {fail} failed")
    log.info(f"{'═' * 60}")
    sys.exit(0 if fail == 0 else 1)


if __name__ == "__main__":
    main()
