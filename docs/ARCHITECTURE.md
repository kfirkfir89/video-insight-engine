# Architecture

System overview and data flows.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                vie-web                                       │
│                          React + Vite + TypeScript                           │
│                               Port: 5173                                     │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ HTTP / WebSocket
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                vie-api                                       │
│                        Node.js + Fastify + TypeScript                        │
│                               Port: 3000                                     │
│                                                                              │
│  • REST API for frontend                                                     │
│  • MCP Client (connects to vie-explainer)                                    │
│  • HTTP calls to vie-summarizer                                              │
│  • WebSocket for real-time updates                                           │
└──────────┬─────────────────────────────────────────────────┬────────────────┘
           │                                                  │
           │ HTTP POST                                        │ MCP Protocol
           ▼                                                  ▼
┌────────────────────┐  ┌───────────────────┐  ┌─────────────────────────────┐
│   vie-summarizer   │  │   vie-mongodb     │  │      vie-explainer           │
│  Python + FastAPI  │  │    MongoDB 7      │  │    Python + MCP SDK         │
│    Port: 8000      │  │   Port: 27017     │  │      Port: 8001             │
│                    │  │                   │  │                             │
│ • Receive HTTP req │  │ System Cache:     │  │ MCP Tools:                  │
│ • Fetch transcript │  │ • videoSummaryCache│ │ • explain_auto (cached)      │
│ • Process with LLM │  │ • systemExpansion │  │ • explain_chat (per-user)    │
│ • Save to cache    │  │   Cache           │  │                             │
│                    │  │                   │  │                             │
└─────────┬──────────┘  │ User Data:        │  └─────────────────────────────┘
          │             │ • users           │
          │             │ • folders         │
          │             │ • userVideos      │
          │             │ • memorizedItems  │
          │             │ • userChats       │
          └────────────►└───────────────────┘
```

---

## Service Communication

| From           | To             | Protocol       | Purpose                     |
| -------------- | -------------- | -------------- | --------------------------- |
| vie-web        | vie-api        | HTTP/WS        | API calls, status updates   |
| vie-api        | vie-mongodb    | MongoDB driver | Data operations             |
| vie-api        | vie-summarizer | HTTP POST      | Trigger summarization       |
| vie-api        | vie-explainer  | **MCP**        | Call explain tools          |
| vie-summarizer | vie-mongodb    | MongoDB driver | Save to cache               |
| vie-summarizer | Claude API     | HTTP           | LLM generation              |
| vie-explainer  | vie-mongodb    | MongoDB driver | Cache + chats               |
| vie-explainer  | Claude API     | HTTP           | LLM generation              |

---

## Data Flows

### 1. Video Summarization

```
User submits YouTube URL
         │
         ▼
┌─────────────────────┐
│ vie-api checks      │
│ videoSummaryCache   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
  HIT           MISS
    │             │
    ▼             ▼
 Create      POST /summarize
 userVideo   to vie-summarizer
 reference        │
    │             ▼
    │    ┌────────────────┐
    │    │ vie-summarizer │
    │    │                │
    │    │ 1. Transcript  │
    │    │ 2. LLM process │
    │    │ 3. Save cache  │
    │    └───────┬────────┘
    │            │
    │     Status: done
    │     (DB update)
    │            │
    └─────┬──────┘
          │
          ▼
    User sees summary
    (via polling or WebSocket)
```

### 2. Explain Auto (Cached)

```
User clicks "Explain" on section
         │
         ▼
┌─────────────────────┐
│ vie-api calls MCP   │
│ explain_auto tool    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ vie-explainer checks │
│ systemExpansionCache│
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
  HIT           MISS
    │             │
    ▼             ▼
 Return       Generate
 cached       with LLM
    │             │
    │        Save to cache
    │             │
    └──────┬──────┘
           │
           ▼
     Return expansion
```

### 3. Explain Chat (Not Cached)

```
User sends message on memorized item
         │
         ▼
┌─────────────────────┐
│ vie-api calls MCP   │
│ explain_chat tool    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ vie-explainer:       │
│ 1. Load context     │
│ 2. Load chat history│
│ 3. Call Claude API  │
│ 4. Save to userChats│
└──────────┬──────────┘
           │
           ▼
     Return response
     (never cached)
```

### 4. Memorize

```
User clicks "Memorize"
         │
         ▼
┌─────────────────────┐
│ vie-api:            │
│ 1. Load from cache  │
│ 2. Copy content     │
│ 3. Create item      │
└──────────┬──────────┘
           │
           ▼
   Item in Memorized tab
   (independent copy)
```

---

## Network Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                   vie-network (Docker bridge)                    │
│                                                                  │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ vie-web   │  │ vie-api   │  │vie-summarizer│ │vie-explainer│ │
│  │  :5173    │  │  :3000    │  │   :8000     │  │   :8001    │ │
│  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘  └─────┬──────┘ │
│        │              │               │                │        │
│        └──────────────┼───────────────┼────────────────┘        │
│                       │               │                         │
│                       ▼               │                         │
│                ┌─────────────┐        │                         │
│                │ vie-mongodb │◄───────┘                         │
│                │   :27017    │                                   │
│                └─────────────┘                                   │
└─────────────────────────────────────────────────────────────────┘

Exposed ports:
  - 5173  → Frontend
  - 3000  → API
```
