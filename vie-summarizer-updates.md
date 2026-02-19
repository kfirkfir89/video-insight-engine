# VIE — Summarizer Implementation Plan

## Step 1 — Explainer MCP: Wire to All Surfaces

UI work only. Backend already handles everything.

| Button                  | Where                 | What it does                       |
| ----------------------- | --------------------- | ---------------------------------- |
| "Go Deeper"             | Every content block   | Expands block with more context    |
| "Simplify"              | Every content block   | Re-renders in simpler terms        |
| "Explain for [persona]" | Every content block   | Re-renders using persona detection |
| "Expand chapter"        | Every chapter heading | Expands full chapter               |
| "Tell me more"          | Concept tooltips      | Deep-dive on that concept          |

### Explainer MCP Tool Chain

The Explainer MCP is not limited to video transcript context. It has access to external tools to enrich explanations:

```
EXPLAINER MCP
├── Search Tool (web) — look up concepts, find references, current info
├── Octacode MCP — best code practices, code explanations, patterns
├── Fetch MCP — retrieve content from URLs referenced in video
├── Global Chat — expand context beyond the video WITHOUT overflowing
│                  the session subject. Gets complete instructions to
│                  stay bounded to the topic while pulling in external
│                  knowledge when needed.
```

**Key rule:** The summarizer chat works ONLY with the specific video context. The Explainer MCP can reach out to external tools to deepen understanding, but every response stays anchored to the video's subject matter. The global chat access is specifically instructed to expand — not drift.

---

## Step 2 — Multimodal: Selective Visual Screenshot Analysis

Extract frames from videos where visual content matters. Feed through vision model to enrich content blocks.

### Vision Model: Gemini

- Use Gemini for visual analysis (cost-effective, strong at code/diagram/text recognition)
- Alternative: GPT Vision as fallback if Gemini quality is insufficient
- Route through LiteLLM for provider flexibility

### Selective Extraction

Only extract frames when visual context adds value:

| Extract                                      | Skip                      |
| -------------------------------------------- | ------------------------- |
| Coding tutorials (code on screen)            | Talking-head podcasts     |
| Slide presentations (text, diagrams, charts) | Interviews (just faces)   |
| Whiteboard lectures (equations, drawings)    | Music content             |
| Product demos (UI, workflows)                | Conversation-only content |
| Cooking/DIY (visual steps)                   |                           |

### Detection Heuristic (to decide)

- YouTube category tags
- Keyword scanning from transcript ("as you can see", "on the screen", "this code", "this slide")
- User toggle: "This video has important visuals"
- Combination of above

### Frame Extraction

- At chapter boundaries + on significant scene changes
- ~1 frame per 2-3 minutes for qualifying videos
- 30-min video ≈ 10-15 frames
- Tools: ffmpeg keyframe extraction + scene change detection

### Frontend: Image Component Block

**New block type needed.** When multimodal analysis produces visual context, the frontend needs to render it.

| Approach                 | Description                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| **Image Block**          | New content block type: frame thumbnail + vision model description. Rendered inline with text blocks.  |
| **Image View (grouped)** | View mode that groups related blocks with their frames. Text + visual context side by side or stacked. |
| **Both**                 | Image blocks for standalone visuals. Grouped view for chapters with multiple frames.                   |

**To decide:** Which approach fits the existing block architecture best.

### Storage

- Frame thumbnails saved alongside blocks (MongoDB or S3 depending on size)
- Vision model analysis text stored as part of the block data

### Cost

~$0.10-0.30 per qualifying video with Gemini

---

## Step 3 — Export Formats

| Format             | Notes                                                |
| ------------------ | ---------------------------------------------------- |
| **Markdown (.md)** | Summary as Markdown. For Obsidian/Notion users.      |
| **Copy as text**   | One-click copy of full summary or individual blocks. |
| **PDF**            | Formatted export for sharing/printing/archiving.     |
| **JSON**           | Structured block data for developers/automation.     |

---

## Step 4 — Search Tool

Each user has their own isolated database space. Complete separation between users.

### What to Build

- Per-user search across their summarized videos in MongoDB
- Full-text search through their summaries only
- Filter by: topic, date, channel
- "Find all videos where [concept] was discussed"
- Frontend RAG approach

### Chat Context Rules

The summarizer chat operates under strict context boundaries:

```
SUMMARIZER CHAT
│
├── Context: ONLY the specific video being viewed
│   └── Transcript, blocks, concepts, timestamps, visual analysis
│
├── Can use: Explainer MCP (which has its own tool chain)
│   ├── Web search — for external references
│   ├── Octacode MCP — for code explanations
│   ├── Fetch MCP — for URL content
│   └── Global chat — bounded expansion (stays on topic)
│
└── Cannot: drift to unrelated topics, access other users' data,
            mix context from different videos
```

**The chat is video-scoped.** External tools expand depth, not breadth.

---

## Step 5 — Anonymous Access (Separate Route)

A completely separate light version. Different route and view entirely.

### Separate Route Architecture

```
vie.app/              → Full app (logged-in users)
vie.app/s/{video_id}  → Anonymous light version (separate view)
```

### Anonymous Light Version

| Included                                                  | Excluded        |
| --------------------------------------------------------- | --------------- |
| Summarize YouTube URLs                                    | Export          |
| View TLDR / master summary / chapters / blocks / mind map | Memorize        |
| Concepts + timestamps                                     | Folder explorer |
| Explainer (limited depth)                                 | Summary history |
|                                                           | Search          |
|                                                           | Chat (full)     |

### Technical

- Completely separate frontend route and view components
- Same backend pipeline runs (system cache benefits everyone)
- No auth, no session persistence, no user identity
- Conversion trigger: CTA to sign up for full version

### Shareable Summary Cards

- Anonymous route IS the shareable link: `vie.app/s/{video_id}`
- Open Graph tags: video title, thumbnail, key takeaways, VIE branding
- Anyone visits → sees summary in light view → CTA to sign up
- Growth loop: share → view → sign up → summarize → share

---

## Implementation Order

```
STEP 1 ─── Explainer on every surface + tool chain wiring
STEP 2 ─── Multimodal screenshots (Gemini, selective) + image block component
STEP 3 ─── Export formats (Markdown, copy, PDF, JSON)
STEP 4 ─── Search tool (per-user DB space) + chat context rules
STEP 5 ─── Anonymous access (separate route + shareable cards)
```

---
