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
│  • MCP Client (connects to vie-explainer)                                     │
│  • Publishes jobs to RabbitMQ                                                │
│  • WebSocket for real-time updates                                           │
└──────────┬────────────────────────┬────────────────────────┬────────────────┘
           │                        │                        │
           │ MongoDB                │ RabbitMQ               │ MCP Protocol
           ▼                        ▼                        ▼
┌────────────────────┐  ┌────────────────────┐  ┌─────────────────────────────┐
│   vie-mongodb      │  │   vie-rabbitmq     │  │      vie-explainer           │
│    MongoDB 7       │  │    RabbitMQ 3      │  │    Python + MCP SDK         │
│   Port: 27017      │  │   Port: 5672       │  │      Port: 8001             │
│                    │  │                    │  │                             │
│ System Cache:      │  │ Queues:            │  │ MCP Tools:                  │
│ • videoSummaryCache│  │ • summarize.jobs   │  │ • explain_auto (cached)      │
│ • systemExpansion  │  │                    │  │ • explain_chat (per-user)    │
│   Cache            │  │ Exchanges:         │  │                             │
│                    │  │ • job.status       │  │                             │
│ User Data:         │  │                    │  │                             │
│ • users            │  │                    │  │                             │
│ • folders          │  │                    │  │                             │
│ • userVideos       │  │                    │  │                             │
│ • memorizedItems   │  │                    │  │                             │
│ • userChats        │  │                    │  │                             │
└────────────────────┘  └─────────┬──────────┘  └─────────────────────────────┘
                                  │
                                  │ Consumes jobs
                                  ▼
                       ┌────────────────────┐
                       │   vie-summarizer   │
                       │  Python + FastAPI  │
                       │    Port: 8000      │
                       │                    │
                       │ • Fetch transcript │
                       │ • Process with LLM │
                       │ • Save to cache    │
                       └────────────────────┘
```

---

## Service Communication

| From           | To            | Protocol       | Purpose                   |
| -------------- | ------------- | -------------- | ------------------------- |
| vie-web        | vie-api       | HTTP/WS        | API calls, status updates |
| vie-api        | vie-mongodb   | MongoDB driver | Data operations           |
| vie-api        | vie-rabbitmq  | AMQP           | Publish jobs              |
| vie-api        | vie-explainer | **MCP**        | Call explain tools        |
| vie-summarizer | vie-rabbitmq  | AMQP           | Consume jobs              |
| vie-summarizer | vie-mongodb   | MongoDB driver | Save to cache             |
| vie-summarizer | Claude API    | HTTP           | LLM generation            |
| vie-explainer  | vie-mongodb   | MongoDB driver | Cache + chats             |
| vie-explainer  | Claude API    | HTTP           | LLM generation            |

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
 Create       Publish to
 userVideo    summarize.jobs
 reference         │
    │             ▼
    │    ┌────────────────┐
    │    │ vie-summarizer │
    │    │                │
    │    │ 1. Transcript  │
    │    │ 2. LLM process │
    │    │ 3. Save cache  │
    │    └───────┬────────┘
    │            │
    │     WebSocket: done
    │            │
    └─────┬──────┘
          │
          ▼
    User sees summary
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
│              ┌────────┴───────┐       │                         │
│              │                │       │                         │
│        ┌─────┴─────┐   ┌──────┴──────┐                          │
│        │vie-mongodb│   │vie-rabbitmq │                          │
│        │  :27017   │   │   :5672     │                          │
│        └───────────┘   └─────────────┘                          │
└─────────────────────────────────────────────────────────────────┘

Exposed ports:
  - 5173  → Frontend
  - 3000  → API
  - 15672 → RabbitMQ UI (dev only)
```
