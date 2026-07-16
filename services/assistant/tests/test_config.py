"""Tests for config validation — INTERNAL_SECRET fail-fast at startup."""

from __future__ import annotations

import logging
from unittest.mock import patch

import pytest

from src import config


class TestValidateInternalSecret:
    """validate_internal_secret() refuses the dev default outside development."""

    def test_should_raise_when_default_secret_in_production(self):
        with (
            patch.object(config.settings, "ENVIRONMENT", "production"),
            patch.object(config.settings, "INTERNAL_SECRET", config._DEFAULT_INTERNAL_SECRET),
        ):
            with pytest.raises(ValueError, match="INTERNAL_SECRET"):
                config.validate_internal_secret()

    def test_should_raise_when_default_secret_in_staging(self):
        with (
            patch.object(config.settings, "ENVIRONMENT", "staging"),
            patch.object(config.settings, "INTERNAL_SECRET", config._DEFAULT_INTERNAL_SECRET),
        ):
            with pytest.raises(ValueError, match="security risk"):
                config.validate_internal_secret()

    def test_should_raise_when_default_secret_in_unknown_env(self):
        # Unknown environment names are treated as production, not dev.
        with (
            patch.object(config.settings, "ENVIRONMENT", "some-cloud"),
            patch.object(config.settings, "INTERNAL_SECRET", config._DEFAULT_INTERNAL_SECRET),
        ):
            with pytest.raises(ValueError, match="some-cloud"):
                config.validate_internal_secret()

    def test_should_match_env_name_case_insensitively(self):
        with (
            patch.object(config.settings, "ENVIRONMENT", "PRODUCTION"),
            patch.object(config.settings, "INTERNAL_SECRET", config._DEFAULT_INTERNAL_SECRET),
        ):
            with pytest.raises(ValueError):
                config.validate_internal_secret()

    def test_should_warn_not_raise_when_default_secret_in_development(self, caplog):
        with (
            patch.object(config.settings, "ENVIRONMENT", "development"),
            patch.object(config.settings, "INTERNAL_SECRET", config._DEFAULT_INTERNAL_SECRET),
            caplog.at_level(logging.WARNING, logger="src.config"),
        ):
            config.validate_internal_secret()

        assert any("default value" in r.message for r in caplog.records)

    def test_should_tolerate_default_secret_when_environment_unset(self):
        # Empty ENVIRONMENT (local dev / test runs) keeps the old warn-only path.
        with (
            patch.object(config.settings, "ENVIRONMENT", ""),
            patch.object(config.settings, "INTERNAL_SECRET", config._DEFAULT_INTERNAL_SECRET),
        ):
            config.validate_internal_secret()

    def test_should_pass_when_real_secret_in_production(self):
        with (
            patch.object(config.settings, "ENVIRONMENT", "production"),
            patch.object(config.settings, "INTERNAL_SECRET", "a-real-rotated-secret"),
        ):
            config.validate_internal_secret()
