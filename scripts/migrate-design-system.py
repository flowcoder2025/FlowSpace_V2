"""
Bulk migrate Tailwind utility classes to FlowSpace design system tokens.

대상: 그룹 A(공개·인증·로비) + 그룹 B(운영자 대시보드).
Phaser 게임 룸 내부 UI(group C)는 제외.
"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

# Group A + B target paths (relative to src/)
TARGETS = [
    "src/components/layout/navbar.tsx",
    "src/components/auth/login-form.tsx",
    "src/components/auth/oauth-buttons.tsx",
    "src/components/auth/onboarding-form.tsx",
    "src/app/login/page.tsx",
    "src/app/onboarding/page.tsx",
    "src/app/my-spaces/page.tsx",
    "src/app/spaces/new/page.tsx",
    "src/app/spaces/[inviteCode]/page.tsx",
    "src/components/spaces/create-space-form.tsx",
    "src/components/spaces/join-space-view.tsx",
    "src/components/spaces/space-card.tsx",
    "src/components/spaces/space-list-view.tsx",
    "src/app/dashboard/spaces/[id]/layout.tsx",
    "src/app/dashboard/spaces/[id]/page.tsx",
    "src/app/dashboard/spaces/[id]/analytics/page.tsx",
    "src/app/dashboard/spaces/[id]/logs/page.tsx",
    "src/app/dashboard/spaces/[id]/media/page.tsx",
    "src/app/dashboard/spaces/[id]/members/page.tsx",
    "src/app/dashboard/spaces/[id]/messages/page.tsx",
    "src/app/dashboard/spaces/[id]/settings/page.tsx",
    "src/components/dashboard/announce-form.tsx",
    "src/components/dashboard/dashboard-sidebar.tsx",
    "src/components/dashboard/event-log-table.tsx",
    "src/components/dashboard/media-management.tsx",
    "src/components/dashboard/member-table.tsx",
    "src/components/dashboard/message-moderation.tsx",
    "src/components/dashboard/space-settings-form.tsx",
    "src/components/dashboard/stat-card.tsx",
    "src/components/dashboard/usage-chart.tsx",
    # Group C — in-game UI (chat panel 제외, 별도 유지)
    "src/components/space/space-hud.tsx",
    "src/components/space/loading-screen.tsx",
    "src/components/space/player-list.tsx",
    "src/components/space/avatar-editor-modal.tsx",
    "src/components/space/video/SpaceMediaLayer.tsx",
    "src/components/space/video/ParticipantPanel.tsx",
    "src/components/space/video/ScreenShare.tsx",
    "src/components/space/editor/asset-palette.tsx",
    "src/components/space/editor/editor-sidebar.tsx",
    "src/components/space/editor/editor-toggle-button.tsx",
    "src/components/space/editor/layer-selector.tsx",
    "src/components/space/editor/object-palette.tsx",
    "src/components/space/editor/property-panel.tsx",
    "src/components/space/editor/tile-palette.tsx",
    "src/components/space/editor/tool-bar.tsx",
    "src/components/avatar/character-editor.tsx",
    "src/components/avatar/internal/category-tabs.tsx",
    "src/components/avatar/internal/color-picker.tsx",
    "src/components/avatar/internal/part-grid.tsx",
    "src/components/avatar/internal/skin-tone-picker.tsx",
]

# Order matters: longer/more specific patterns first to avoid partial overshadow.
# Tuple of (pattern, replacement). Use word-boundary-aware patterns where needed.
REPLACEMENTS = [
    # Primary brand (blue → brand ink)
    (r"\bbg-blue-700\b", "bg-brand-deep"),
    (r"\bbg-blue-600\b", "bg-brand"),
    (r"\bbg-blue-50\b", "bg-cream-deep"),
    (r"\bhover:bg-blue-700\b", "hover:bg-brand-deep"),
    (r"\bhover:bg-blue-50\b", "hover:bg-cream-deep"),
    (r"\btext-blue-700\b", "text-ink"),
    (r"\btext-blue-600\b", "text-ink"),
    (r"\btext-blue-500\b", "text-ink-soft"),
    (r"\bborder-blue-500\b", "border-ink"),
    (r"\bborder-blue-200\b", "border-line"),
    (r"\bring-blue-500\b", "ring-ink/20"),
    (r"\bfocus:border-blue-500\b", "focus:border-ink"),
    (r"\bfocus:ring-blue-500\b", "focus:ring-ink/20"),
    (r"\bfocus:ring-blue-200\b", "focus:ring-ink/10"),
    # Gray text scale (gray-{900..400} → ink hierarchy)
    (r"\btext-gray-900\b", "text-ink"),
    (r"\btext-gray-800\b", "text-ink-soft"),
    (r"\btext-gray-700\b", "text-ink-soft"),
    (r"\btext-gray-600\b", "text-ink-muted"),
    (r"\btext-gray-500\b", "text-ink-muted"),
    (r"\btext-gray-400\b", "text-ink-light"),
    (r"\btext-gray-300\b", "text-ink-light"),
    (r"\bhover:text-gray-900\b", "hover:text-ink"),
    (r"\bhover:text-gray-700\b", "hover:text-ink"),
    # Gray backgrounds (light theme → cream tones)
    (r"\bbg-gray-900\b", "bg-ink"),
    (r"\bbg-gray-800\b", "bg-ink"),
    (r"\bbg-gray-100\b", "bg-cream-deep"),
    (r"\bbg-gray-50\b", "bg-cream-deep"),
    (r"\bhover:bg-gray-100\b", "hover:bg-cream-deep"),
    (r"\bhover:bg-gray-50\b", "hover:bg-cream-deep"),
    (r"\bhover:bg-gray-200\b", "hover:bg-line"),
    (r"\bbg-gray-200\b", "bg-line"),
    # Gray backgrounds (dark theme — buttons inside ink panels → translucent cream)
    (r"\bbg-gray-700\b", "bg-cream/10"),
    (r"\bbg-gray-600\b", "bg-cream/15"),
    (r"\bbg-gray-500\b", "bg-cream/20"),
    (r"\bhover:bg-gray-700\b", "hover:bg-cream/15"),
    (r"\bhover:bg-gray-600\b", "hover:bg-cream/20"),
    (r"\bhover:bg-gray-500\b", "hover:bg-cream/25"),
    # Borders
    (r"\bborder-gray-300\b", "border-line"),
    (r"\bborder-gray-200\b", "border-line"),
    (r"\bborder-gray-100\b", "border-line"),
    (r"\bborder-gray-400\b", "border-ink-light"),
    # Borders (dark theme)
    (r"\bborder-gray-700\b", "border-cream/10"),
    (r"\bborder-gray-600\b", "border-cream/15"),
    (r"\bborder-gray-500\b", "border-cream/20"),
    (r"\bhover:border-gray-300\b", "hover:border-ink/30"),
    # Spinner / accent blue (loading states)
    (r"\bborder-blue-400\b", "border-brand"),
    (r"\bhover:text-blue-800\b", "hover:text-brand-deep"),
    # Focus rings stripped for non-brand
    (r"\bring-gray-300\b", "ring-line"),
    (r"\bring-gray-200\b", "ring-line"),
]


def migrate_file(path: Path) -> tuple[int, list[str]]:
    """Apply replacements. Returns (change_count, list_of_changes)."""
    if not path.exists():
        return 0, [f"SKIP (not found): {path.relative_to(ROOT)}"]

    text = path.read_text(encoding="utf-8")
    original = text
    applied = []

    for pattern, replacement in REPLACEMENTS:
        new_text, count = re.subn(pattern, replacement, text)
        if count > 0:
            applied.append(f"  {pattern} → {replacement} (×{count})")
            text = new_text

    if text == original:
        return 0, []

    path.write_text(text, encoding="utf-8", newline="\n")
    return sum(int(re.search(r"×(\d+)", a).group(1)) for a in applied), applied


def main():
    total_changes = 0
    changed_files = 0
    for rel in TARGETS:
        path = ROOT / rel
        count, changes = migrate_file(path)
        if count > 0:
            changed_files += 1
            total_changes += count
            print(f"\n{rel} ({count} changes):")
            for c in changes:
                print(c)
        elif changes:
            print(f"\n{rel}: {changes[0]}")

    print(f"\n=== Summary ===")
    print(f"Files changed: {changed_files} / {len(TARGETS)}")
    print(f"Total replacements: {total_changes}")


if __name__ == "__main__":
    main()
