"""Adafruit datasheet lookup adapter — custom, not MCP.

Auto-enrichment for add_inventory_item (adapters/state/adapter.py): when an
inventory item looks like a specific electronics part, this looks up its
datasheet via Adafruit's own Learn system and returns a title+URL to record
as a data source.

Deliberately does NOT use Adafruit's on-site search (adafruit.com/search) —
their robots.txt disallows it. Instead this matches the part name against
the full list of Learn guide slugs from Adafruit's own public sitemap
(cdn-learn.adafruit.com/sitemaps/learn*.xml.gz, no robots.txt restriction),
then fetches that one guide's /downloads page (also allowed) and pulls
whichever link Adafruit itself labels "Datasheet". No search API, no
Gemini call — just a few small HTTP requests and local string matching,
kept out of the main agent conversation entirely so this costs no chat
tokens.

Best-effort only: never guesses a URL, only returns one Adafruit's own page
explicitly labels as a datasheet, and returns None rather than a
low-confidence guess whenever the part name is too generic to match
confidently (e.g. "temperature sensor" with no model number) or Adafruit
simply doesn't carry it.
"""

import gzip
import re

import httpx

_SITEMAP_INDEX = "https://cdn-learn.adafruit.com/sitemaps/learn.xml.gz"
_GUIDE_URL_RE = re.compile(r"https://learn\.adafruit\.com/([a-z0-9-]+)")
_DATASHEET_LINK_RE = re.compile(r'<li><a href="([^"]+)">([^<]*[Dd]atasheet[^<]*)</a></li>')
_TOKEN_RE = re.compile(r"[a-z0-9]+")
_HEADERS = {"User-Agent": "Mozilla/5.0"}

_ELECTRONICS_KEYWORDS = (
    "sensor", "module", "microcontroller", "resistor", "capacitor", "transistor",
    "diode", "led", "servo", "motor", "relay", "mosfet", "breakout", "arduino",
    "esp32", "esp8266", "raspberry pi", "circuit board", "battery", "regulator",
    "amplifier", "encoder", "potentiometer", "buzzer", "display", "oled", "lcd",
    "accelerometer", "gyroscope", "gps", "bluetooth", "stepper", "solenoid",
    "thermistor", "microphone", "neopixel",
)

# Populated once per process on first use — a few hundred KB, so worth
# keeping in memory rather than re-fetching on every inventory item.
_slug_cache: list[str] | None = None


def looks_electronic(name: str) -> bool:
    """Cheap keyword pre-filter so find_datasheet is only attempted for
    inventory items that plausibly have an electronics datasheet at all."""
    lowered = name.lower()
    return any(kw in lowered for kw in _ELECTRONICS_KEYWORDS)


def _tokens(text: str) -> set[str]:
    return {t for t in _TOKEN_RE.findall(text.lower()) if len(t) >= 2}


async def _adafruit_guide_slugs(client: httpx.AsyncClient) -> list[str]:
    global _slug_cache
    if _slug_cache is not None:
        return _slug_cache

    index_resp = await client.get(_SITEMAP_INDEX, headers=_HEADERS)
    index_resp.raise_for_status()
    shard_urls = re.findall(r"<loc>([^<]+)</loc>", gzip.decompress(index_resp.content).decode())

    slugs: set[str] = set()
    for shard_url in shard_urls:
        shard_resp = await client.get(shard_url, headers=_HEADERS)
        shard_resp.raise_for_status()
        slugs.update(_GUIDE_URL_RE.findall(gzip.decompress(shard_resp.content).decode()))

    _slug_cache = list(slugs)
    return _slug_cache


def _best_slug_match(name: str, slugs: list[str]) -> str | None:
    name_tokens = _tokens(name)
    part_number_tokens = {t for t in name_tokens if any(c.isdigit() for c in t)}
    if not part_number_tokens:
        return None  # too generic to match confidently, e.g. just "sensor"

    # Requiring 2+ matching tokens (not just 1) once the name has more than
    # one token avoids false positives where two unrelated parts merely
    # share a common family prefix, e.g. "ESP32-CAM" (not an Adafruit
    # product) otherwise matching some unrelated "...-esp32-..." guide on
    # the "esp32" token alone.
    required_score = min(2, len(name_tokens))
    best_slug, best_score = None, 0
    for slug in slugs:
        slug_tokens = set(slug.split("-"))
        if not (part_number_tokens & slug_tokens):
            continue
        score = len(name_tokens & slug_tokens)
        if score >= required_score and score > best_score:
            best_score = score
            best_slug = slug

    return best_slug


async def find_datasheet(component_name: str) -> dict | None:
    """Look up a datasheet for a specific electronics part (e.g. 'BME280' or
    'DHT22 temperature sensor') on Adafruit's Learn system. Returns
    {'title', 'url'} pointing at the datasheet PDF, or None if no confident
    match was found — a generic name with no model number, or a part
    Adafruit doesn't carry. Never guesses a URL, only ones Adafruit's own
    site explicitly labels as a Datasheet."""
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        slugs = await _adafruit_guide_slugs(client)
        slug = _best_slug_match(component_name, slugs)
        if not slug:
            return None

        resp = await client.get(f"https://learn.adafruit.com/{slug}/downloads", headers=_HEADERS)
        if resp.status_code >= 400:
            return None

    match = _DATASHEET_LINK_RE.search(resp.text)
    if not match:
        return None
    return {"title": match.group(2).strip(), "url": match.group(1)}
