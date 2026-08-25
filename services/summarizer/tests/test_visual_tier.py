"""Tests for the adaptive frame-effort tier (media/visual_tier.py)."""

from unittest.mock import patch

from src.services.media.visual_tier import derive_tier, tier_settings


class TestDeriveTier:
    def test_unboxing_title_is_high_regardless_of_category(self):
        assert derive_tier(None, "ONE PIECE OP-17 UNBOXING!") == "high"
        assert derive_tier("standard", "Massive Box Break tonight") == "high"

    def test_tag_keyword_hits_count(self):
        assert derive_tier(None, "Ep 12", ["pack opening", "pulls"]) == "high"

    def test_high_domain_from_category(self):
        assert derive_tier("cooking", "Perfect pasta") == "high"
        assert derive_tier("travel", "My trip") == "high"

    def test_low_domain_without_keywords(self):
        assert derive_tier("podcast", "Long chat") == "low"

    def test_low_domain_with_visual_keyword_stays_high(self):
        assert derive_tier("podcast", "Podcast merch unboxing") == "high"

    def test_default_standard(self):
        assert derive_tier(None, "Some lecture") == "standard"
        assert derive_tier("coding", "Refactoring tips") == "standard"

    def test_missing_config_degrades_to_standard(self):
        with patch("src.services.media.visual_tier.visual_criticality_config", return_value={}):
            assert derive_tier("cooking", "unboxing time") == "standard"


class TestTierSettings:
    def test_high_knobs(self):
        knobs = tier_settings("high")
        assert knobs["overselect"] == 40
        assert knobs["visionMax"] == 40
        assert knobs["keep"] == 25

    def test_low_disables_vision(self):
        assert tier_settings("low")["visionMax"] == 0
