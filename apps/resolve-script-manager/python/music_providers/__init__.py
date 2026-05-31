"""Music providers — plugin-system for søk og download fra eksterne
musikk-leverandører (Jamendo, Pixabay, Soundstripe, etc.).

Hver provider implementerer Provider-protokollen:
  - id, name, requires_key
  - search(query, limit) → list[TrackResult]
  - download(track_id, dest) → str (lokal WAV-path)
"""

from .base import Provider, TrackResult
from .jamendo import JamendoProvider
from .pixabay import PixabayProvider
from .soundstripe import SoundstripeProvider
from .artlist import ArtlistProvider

ALL_PROVIDERS: list[Provider] = [
    JamendoProvider(),
    PixabayProvider(),
    SoundstripeProvider(),
    ArtlistProvider(),
]

PROVIDERS_BY_ID = {p.id: p for p in ALL_PROVIDERS}
