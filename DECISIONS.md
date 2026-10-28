# Decisions
- Original “Phosphor Arcade” presentation; five familiar mechanics with original art and titles.
- Fixed 60 Hz simulation, per-world seeded PRNG, one application animation loop.
- Separate worlds use identical seeds in local multiplayer. Score decides winner; all lives/rounds follow solo rules.
- Use existing checkout /workspace/Gamefun; no worktree.
- No application runtime dependencies; Vite/TypeScript and test tooling are development-only.
