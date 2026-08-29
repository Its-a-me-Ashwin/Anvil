"""YouTube search adapter — custom, not MCP.

Finds an existing YouTube tutorial/how-to video for a topic via the YouTube
Data API v3. This is the cost-conscious alternative to generate_animation
(adapters/animation/adapter.py): a search here costs nothing (well within
the API's free daily quota), while every Veo render has a real dollar cost.
The agent is instructed (see agent.py's system prompt) to try this first for
any "how do I..." / demonstration question, and only fall back to
generate_animation when nothing suitable turns up or the user explicitly
asks for a generated animation.

Uses YOUTUBE_API_KEY — a separate key from GEMINI_API_KEY, since YouTube
Data API v3 is a distinct Google Cloud API that needs to be enabled on its
own project (see backend/.env.example for setup notes).
"""

import os
import re
from typing import Optional

import httpx

_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"

# Matches a YouTube chapter/timestamp line in a video description, e.g.
# "1:23 Wiring the sensor" or "01:02:03 - Final assembly".
_CHAPTER_RE = re.compile(r"^\s*\(?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\)?\s*[-:]?\s*(.+)$")


def _api_key() -> str:
    return os.environ.get("YOUTUBE_API_KEY", "")


def _timestamp_to_seconds(hours: Optional[str], minutes: str, seconds: str) -> int:
    return (int(hours) if hours else 0) * 3600 + int(minutes) * 60 + int(seconds)


def _find_relevant_timestamp(description: str, query: str) -> int:
    """Best-effort: if the video's description lists timestamped chapters
    (most tutorial creators do this), jump to whichever chapter's label
    shares the most words with the query. Falls back to the start of the
    video (0) if there are no chapters or none look relevant — this is a
    nice-to-have, not something worth a second Gemini call for."""
    query_words = {w for w in re.findall(r"[a-z0-9]+", query.lower()) if len(w) > 2}
    if not query_words:
        return 0

    best_seconds = 0
    best_score = 0
    for line in description.splitlines():
        match = _CHAPTER_RE.match(line)
        if not match:
            continue
        hours, minutes, seconds, label = match.groups()
        label_words = set(re.findall(r"[a-z0-9]+", label.lower()))
        score = len(query_words & label_words)
        if score > best_score:
            best_score = score
            best_seconds = _timestamp_to_seconds(hours, minutes, seconds)

    return best_seconds if best_score > 0 else 0


async def find_tutorial_video(query: str) -> dict:
    """Search YouTube for a real tutorial/how-to video matching the query and
    return it for the viewer to embed. This is free and often more thorough
    than a generated clip — call this before generate_animation for any
    "how do I..." or demonstration question, and only fall back to
    generate_animation if this returns status "not_found" or the user
    specifically asks for a generated animation."""
    api_key = _api_key()
    if not api_key:
        raise RuntimeError(
            "YOUTUBE_API_KEY is not set. Enable 'YouTube Data API v3' for your "
            "Google Cloud project, create an API key at "
            "https://console.cloud.google.com/apis/credentials, then add it to "
            "backend/.env."
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        search_resp = await client.get(
            _SEARCH_URL,
            params={
                "key": api_key,
                "q": query,
                "part": "snippet",
                "type": "video",
                "maxResults": 5,
                "order": "relevance",
                "safeSearch": "strict",
            },
        )
        if search_resp.status_code >= 400:
            message = search_resp.json().get("error", {}).get("message", search_resp.text)
            raise RuntimeError(f"YouTube search failed: {message}")

        items = search_resp.json().get("items", [])
        if not items:
            return {"status": "not_found", "query": query}

        top = items[0]
        video_id = top["id"]["videoId"]
        title = top["snippet"]["title"]
        channel = top["snippet"]["channelTitle"]
        thumbnail = top["snippet"]["thumbnails"].get("medium", {}).get("url", "")

        # Search results truncate the description — fetch the full one so
        # chapter timestamps (if any) aren't cut off.
        start_seconds = 0
        videos_resp = await client.get(
            _VIDEOS_URL,
            params={"key": api_key, "id": video_id, "part": "snippet"},
        )
        if videos_resp.status_code < 400:
            video_items = videos_resp.json().get("items", [])
            if video_items:
                description = video_items[0]["snippet"].get("description", "")
                start_seconds = _find_relevant_timestamp(description, query)

    embed_url = f"https://www.youtube.com/embed/{video_id}"
    if start_seconds:
        embed_url += f"?start={start_seconds}"

    return {
        "status": "found",
        "video_id": video_id,
        "title": title,
        "channel": channel,
        "thumbnail": thumbnail,
        "watch_url": f"https://www.youtube.com/watch?v={video_id}",
        "embed_url": embed_url,
        "start_seconds": start_seconds,
    }
