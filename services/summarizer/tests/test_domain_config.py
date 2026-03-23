"""Tests for domain_config.py — ensures domains.json is valid and consistent."""

import json
from pathlib import Path

import pytest

# Load domains.json directly for testing
DOMAINS_JSON_PATH = Path(__file__).resolve().parent.parent.parent.parent / "packages" / "shared" / "src" / "config" / "domains.json"


@pytest.fixture
def config():
    """Load the raw domain config."""
    return json.loads(DOMAINS_JSON_PATH.read_text())


class TestDomainsJsonStructure:
    """Validate the structure of domains.json."""

    def test_has_required_top_level_keys(self, config):
        assert "domains" in config
        assert "modifiers" in config
        assert "categoryMap" in config
        assert "components" in config
        assert "enrichment" in config

    def test_has_expected_domains(self, config):
        expected = {"learning", "tech", "fitness", "food", "music", "travel", "review", "project"}
        assert set(config["domains"].keys()) == expected

    def test_has_expected_modifiers(self, config):
        expected = {"narrative", "finance"}
        assert set(config["modifiers"].keys()) == expected

    def test_domain_has_required_fields(self, config):
        for name, domain in config["domains"].items():
            assert "emoji" in domain, f"{name} missing emoji"
            assert "label" in domain, f"{name} missing label"
            assert "gradient" in domain, f"{name} missing gradient"
            assert "defaultTabs" in domain, f"{name} missing defaultTabs"

    def test_modifier_has_required_fields(self, config):
        for name, modifier in config["modifiers"].items():
            assert "emoji" in modifier, f"{name} missing emoji"
            assert "label" in modifier, f"{name} missing label"

    def test_default_tabs_are_complete_objects(self, config):
        """Each defaultTab should be a complete object with id, label, emoji, component."""
        for domain_name, domain in config["domains"].items():
            for tab in domain["defaultTabs"]:
                assert isinstance(tab, dict), f"{domain_name} defaultTab is not a dict: {tab}"
                assert "id" in tab, f"{domain_name} tab missing id: {tab}"
                assert "label" in tab, f"{domain_name} tab missing label: {tab}"
                assert "emoji" in tab, f"{domain_name} tab missing emoji: {tab}"
                assert "component" in tab, f"{domain_name} tab missing component: {tab}"

    def test_components_array_valid(self, config):
        """Components array should contain non-empty strings."""
        components = config["components"]
        assert isinstance(components, list)
        assert len(components) > 0
        for c in components:
            assert isinstance(c, str) and len(c) > 0


class TestDomainsJsonConsistency:
    """Ensure internal consistency of domains.json."""

    def test_category_map_points_to_valid_domains(self, config):
        valid_domains = set(config["domains"].keys())
        for category, tag in config["categoryMap"].items():
            assert tag in valid_domains, (
                f"categoryMap['{category}'] = '{tag}' is not a valid domain. "
                f"Valid: {valid_domains}"
            )

    def test_gradients_are_css_gradients(self, config):
        for name, domain in config["domains"].items():
            assert domain["gradient"].startswith("linear-gradient("), (
                f"{name} gradient doesn't start with 'linear-gradient(': {domain['gradient']}"
            )

    def test_at_least_one_default_tab(self, config):
        for name, domain in config["domains"].items():
            assert len(domain["defaultTabs"]) >= 1, (
                f"{name} has no default tabs"
            )

    def test_default_tab_components_in_components_array(self, config):
        """Each defaultTab component should be in the top-level components array."""
        valid_components = set(config["components"])
        for domain_name, domain in config["domains"].items():
            for tab in domain["defaultTabs"]:
                component = tab.get("component", "")
                assert component in valid_components, (
                    f"{domain_name}.{tab['id']} component '{component}' "
                    f"not in components array"
                )


class TestDomainConfigModule:
    """Test the Python domain_config module functions."""

    def test_valid_content_tags_matches_json(self, config):
        from src.shared_config.domain_config import valid_content_tags
        assert valid_content_tags() == frozenset(config["domains"].keys())

    def test_valid_modifiers_matches_json(self, config):
        from src.shared_config.domain_config import valid_modifiers
        assert valid_modifiers() == frozenset(config["modifiers"].keys())

    def test_valid_components(self, config):
        from src.shared_config.domain_config import valid_components
        result = valid_components()
        assert isinstance(result, frozenset)
        assert result == frozenset(config["components"])
        assert "spot_explorer" in result
        assert "overview" in result

    def test_map_category_to_tag(self):
        from src.shared_config.domain_config import map_category_to_tag
        assert map_category_to_tag("cooking") == "food"
        assert map_category_to_tag("coding") == "tech"
        assert map_category_to_tag("unknown_category") == "learning"

    def test_get_default_tab_ids(self):
        from src.shared_config.domain_config import get_default_tab_ids
        ids = get_default_tab_ids("learning")
        assert "key_points" in ids
        assert "concepts" in ids

    def test_get_tab_meta(self):
        from src.shared_config.domain_config import get_tab_meta
        meta = get_tab_meta("key_points")
        assert meta is not None
        label, emoji = meta
        assert label == "Key Points"
        assert emoji != ""

    def test_get_tab_meta_unknown(self):
        from src.shared_config.domain_config import get_tab_meta
        assert get_tab_meta("nonexistent_tab") is None

    def test_build_fallback_tabs(self):
        from src.shared_config.domain_config import build_fallback_tabs
        tabs = build_fallback_tabs("tech")
        assert len(tabs) > 0
        assert all("id" in t and "label" in t and "emoji" in t and "component" in t for t in tabs)

    def test_build_fallback_tabs_have_component(self):
        from src.shared_config.domain_config import build_fallback_tabs
        tabs = build_fallback_tabs("travel")
        assert len(tabs) > 0
        for tab in tabs:
            assert "component" in tab
            assert tab["component"] != ""

    def test_get_enrichment_map(self, config):
        from src.shared_config.domain_config import get_enrichment_map
        result = get_enrichment_map()
        assert isinstance(result, dict)
        assert result == config["enrichment"]
        assert result["learning"] == "enrich/enrich_study.txt"
        # 8 primary domains + "default" entry
        assert len(result) == 9
        for domain in ["learning", "tech", "fitness", "food", "music", "travel", "review", "project"]:
            assert domain in result

    def test_enrichment_tags_are_valid_domains(self, config):
        """Every tag in enrichment (except 'default') must be a known domain."""
        valid_domains = set(config["domains"].keys())
        for tag in config["enrichment"]:
            if tag == "default":
                continue
            assert tag in valid_domains, f"enrichment tag '{tag}' not in domains"

    def test_enrichment_prompt_files_exist(self, config):
        """Every enrichment prompt file must exist in prompts/."""
        prompts_dir = Path(__file__).resolve().parent.parent / "src" / "prompts"
        for tag, filename in config["enrichment"].items():
            prompt_path = prompts_dir / filename
            assert prompt_path.exists(), f"Enrichment prompt '{filename}' for tag '{tag}' not found at {prompt_path}"
