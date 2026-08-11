# Common Gotchas

Project-wide bug knowledge base. **Check here BEFORE debugging.**

This file persists across sessions to capture learnings from past bugs.
When you fix a bug, add it here to prevent re-investigation.

---

## How to Use

1. **Before debugging**: Search this file for similar symptoms
2. **After fixing**: Add new gotcha with symptom, cause, and fix
3. **Review periodically**: Remove outdated entries

---

## vie-api (Node.js/Fastify)

| Symptom | Cause | Fix | Added |
|---------|-------|-----|-------|
| 401 on protected routes | Missing/expired JWT | Check token expiry, refresh flow | 2026-02 |
| 500 on MongoDB operations | Connection timeout | Check MONGODB_URI, increase timeout | 2026-02 |
| Route not found (404) | Registration order | Register routes after plugins | 2026-02 |
| SSE not streaming | Missing flush/proper headers | Use `reply.raw.write()` + flush | 2026-02 |
| Validation errors on good input | Zod schema mismatch | Check schema vs actual payload | 2026-02 |

---

## vie-web (React/Vite)

| Symptom | Cause | Fix | Added |
|---------|-------|-----|-------|
| Component not re-rendering | Missing dependency in useEffect | Add all deps or use useCallback | 2026-02 |
| Stale data in React Query | Cache not invalidated | Call `queryClient.invalidateQueries()` | 2026-02 |
| CORS errors in dev | Vite proxy misconfigured | Check `vite.config.ts` proxy | 2026-02 |
| Hydration mismatch | Server/client render difference | Check conditional rendering | 2026-02 |
| CSS not applying (Tailwind) | Class not in safelist | Check content paths in tailwind config | 2026-02 |

---

## vie-summarizer (Python/FastAPI)

| Symptom | Cause | Fix | Added |
|---------|-------|-----|-------|
| LLM timeout | Long transcript + slow model | Increase timeout, use faster model | 2026-02 |
| Rate limit errors | Provider quota exceeded | Switch provider or add retry | 2026-02 |
| Transcript empty | Video unavailable/private | Check video accessibility | 2026-02 |
| JSON parse error in response | LLM output malformed | Add response validation, retry | 2026-02 |
| Memory spike | Large transcript in memory | Stream processing, chunk | 2026-02 |

---

## vie-explainer (Python/FastAPI/MCP)

| Symptom | Cause | Fix | Added |
|---------|-------|-----|-------|
| MCP connection fails | Stdio transport issue | Check subprocess spawn | 2026-02 |
| Tool not found | Tool not registered | Check MCP tool registration | 2026-02 |
| Slow responses | No caching | Check MongoDB cache hits | 2026-02 |
| Context too large | VideoContext bloated | Trim unnecessary fields | 2026-02 |

---

## Docker / Infrastructure

| Symptom | Cause | Fix | Added |
|---------|-------|-----|-------|
| Container can't connect to DB | Network misconfigured | Use service name, not localhost | 2026-02 |
| Hot reload not working | Volume not mounted | Check docker-compose volumes | 2026-02 |
| Port already in use | Dangling container | `docker-compose down` first | 2026-02 |
| Build fails (npm install) | Package-lock stale | Delete node_modules, reinstall | 2026-02 |

---

## Cross-Service Issues

| Symptom | Cause | Fix | Added |
|---------|-------|-----|-------|
| API → Summarizer timeout | Long processing | Increase Fastify timeout | 2026-02 |
| Type mismatch between services | @vie/types out of sync | Rebuild shared packages | 2026-02 |
| SSE disconnects randomly | Proxy/load balancer | Disable buffering, long timeout | 2026-02 |

---

## Adding New Gotchas

When you fix a bug, add it using this format:

```markdown
| [Brief symptom] | [Root cause] | [How to fix] | [YYYY-MM] |
```

Guidelines:
- Keep symptom brief but searchable
- Cause should explain "why" not just "what"
- Fix should be actionable
- Date helps with relevance
