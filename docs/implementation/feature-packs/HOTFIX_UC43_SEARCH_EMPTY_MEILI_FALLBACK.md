# Hotfix — UC-43 Search Filter Fallback

Issue: `/api/search/issues` returned an empty Meilisearch result set even when PostgreSQL contained a matching issue. The service returned Meilisearch results whenever a query string was present, even if `hits` was empty.

Fix: only return Meilisearch results when hits are present. Empty Meilisearch results now fall back to the PostgreSQL query path, preserving search/filter smoke-test reliability while Meilisearch indexing/filterable attributes settle.
