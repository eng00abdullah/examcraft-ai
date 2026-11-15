import sys
from pathlib import Path

# Add apps/api to sys.path so app modules are discoverable
root = Path(__file__).resolve().parent.parent
api_dir = root / "apps" / "api"
if str(api_dir) not in sys.path:
    sys.path.insert(0, str(api_dir))

from app.main import app
