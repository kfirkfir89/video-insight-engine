"""Tests for the shared yt-dlp player-client plumbing (media/download_utils.py).

These builders are the one thing that must stay in sync across the stream-URL
fetch, the scene-detection download, the local 720p fallback, and the whisper
audio download — a typo here silently reinstates the 403s everywhere.
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from src.services.media import download_utils


@pytest.fixture
def clients(monkeypatch):
    def _set(value: str) -> None:
        monkeypatch.setattr(download_utils.settings, "YTDLP_PLAYER_CLIENTS", value)

    return _set


class TestCliArgs:
    def test_single_client(self, clients):
        clients("android")
        assert download_utils.ytdlp_client_cli_args() == [
            "--extractor-args",
            "youtube:player_client=android",
        ]

    def test_multiple_clients_preserve_order(self, clients):
        clients("android,web")
        assert download_utils.ytdlp_client_cli_args() == [
            "--extractor-args",
            "youtube:player_client=android,web",
        ]

    @pytest.mark.parametrize("value", ["", "   "])
    def test_blank_means_ytdlp_defaults(self, clients, value):
        clients(value)
        assert download_utils.ytdlp_client_cli_args() == []


class TestApiOpts:
    def test_single_client(self, clients):
        clients("android")
        assert download_utils.ytdlp_client_api_opts() == {
            "extractor_args": {"youtube": {"player_client": ["android"]}}
        }

    def test_multiple_clients_are_split_and_stripped(self, clients):
        clients("android, web")
        assert download_utils.ytdlp_client_api_opts() == {
            "extractor_args": {"youtube": {"player_client": ["android", "web"]}}
        }

    @pytest.mark.parametrize("value", ["", " , "])
    def test_blank_means_ytdlp_defaults(self, clients, value):
        clients(value)
        assert download_utils.ytdlp_client_api_opts() == {}


class TestDownloadYoutubeAudioClientOpts:
    def _run(self, ydl_opts: dict, tmp_path: Path) -> dict:
        """Run one successful download and return the opts YoutubeDL received."""
        ydl = MagicMock()
        ydl.__enter__ = MagicMock(return_value=ydl)
        ydl.__exit__ = MagicMock(return_value=False)
        with patch.object(download_utils.yt_dlp, "YoutubeDL", return_value=ydl) as ctor:
            download_utils.download_youtube_audio("dQw4w9WgXcQ", ydl_opts, tmp_path, "audio")
        return ctor.call_args.args[0]

    def test_injects_configured_clients(self, clients, tmp_path):
        clients("android")
        received = self._run({"format": "bestaudio"}, tmp_path)
        assert received["format"] == "bestaudio"
        assert received["extractor_args"] == {"youtube": {"player_client": ["android"]}}

    def test_does_not_override_caller_supplied_extractor_args(self, clients, tmp_path):
        clients("android")
        custom = {"youtube": {"player_client": ["ios"]}}
        received = self._run({"extractor_args": custom}, tmp_path)
        assert received["extractor_args"] == custom

    def test_blank_setting_leaves_opts_untouched(self, clients, tmp_path):
        clients("")
        received = self._run({"format": "bestaudio"}, tmp_path)
        assert "extractor_args" not in received
