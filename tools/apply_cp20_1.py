from pathlib import Path
import shutil

PATCH = Path(__file__).resolve().parents[1]
ROOT = Path.cwd()

FILES = [
    "app/miners/page.tsx",
    "app/dashboard/page.tsx",
    "app/faucet/page.tsx",
    "app/quests/page.tsx",
    "app/ptc/page.tsx",
    "app/surveys/page.tsx",
    "app/merge/page.tsx",
    "components/layout/Sidebar.tsx",
    "supabase/migrations/20260915_cp20_1_final_sync.sql",
]

for rel in FILES:
    src = PATCH / rel
    dst = ROOT / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)

print("CP20.1: copied explicit source files.")
