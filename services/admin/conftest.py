"""Test configuration — set required env vars before app imports."""

import os

os.environ.setdefault("ADMIN_API_KEY", "test-admin-key")
