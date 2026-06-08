# Changelog

## 2026-06-08 — master

### Added
- GitHub Stars bridge — fetches starred repos via API, feeds skill gap detection
- Raindrop.io bridge — fetches bookmarks + highlights via API
- Fact extraction — proficiency levels, experience years, usage frequency from content patterns
- Graph search — entity co-occurrence relations boost related content in search
- Wikilink boost — vault notes linked from top search results get relevance bump
- E2E pipeline test — 9-step test covering ingest through audit
- `--config` CLI flag and `NEXUS_CONFIG` env var for custom config path
- `nexus.yaml.example` template with placeholder paths
- GitHub Actions CI workflow
- README.md, LICENSE (MIT)

### Changed
- Vector search now uses real MiniLM-L6-v2 embeddings (was hash stub)
- Enrichment worker now creates co-occurrence relations and extracts facts
- Removed personal bridges (ai-feeds, job-hunter, email-hub) — repo is now general-purpose
- Centralized tilde expansion in config module (was scattered across 4 files)
- Documentation fully rewritten (README, CONTEXT, STATUS)

### Breaking
- Users must delete `data/vectors.lance/` and re-ingest (embedding dimension changed 1024→384)
- Personal source bridges removed — configure `sources.vault`, `sources.github_stars`, `sources.raindrop` instead
