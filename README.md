# 🎬 Video Insight Engine

> **Stop losing knowledge from videos you watch.**

You watch a 2-hour tutorial, learn amazing things, and a week later... it's gone. You can't remember the exact steps, you can't find that one explanation that clicked, and you definitely can't explain it to someone else.

**Video Insight Engine fixes this.**

---

## The Problem

📺 You watch educational YouTube videos all the time.

😤 But videos are **terrible for knowledge retention**:

- Can't search inside them
- Can't highlight or save key parts
- Can't quickly review what you learned
- Rewatching wastes hours

**Result:** 90% of video knowledge evaporates within a week.

---

## The Solution

**Video Insight Engine** transforms any YouTube video into **structured, searchable, personal knowledge**.

```
📺 YouTube Video
      ↓
🤖 AI Processing
      ↓
📚 Your Knowledge Base
```

### Three Core Features

#### 1. 📝 Summarize

Paste a YouTube URL → Get a structured summary in seconds.

- **Sections** with timestamps (click to jump)
- **Key concepts** extracted and explained
- **Prerequisites** you need to understand it
- **Organize** into folders by topic

#### 2. 🧠 Memorize

Save any part to your personal collection.

- Save entire summaries, single sections, or specific concepts
- **Add your own notes** alongside AI content
- **Export** to Notion, Obsidian, or Markdown
- **Independent copies** - works even if you delete the source

#### 3. 💬 Explain

Don't understand something? Ask.

- Click any section → Get a **deeper explanation**
- **Chat with the content** - ask follow-up questions
- AI remembers the video context
- Like having the video creator explain it personally

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                        You                                   │
│                         │                                    │
│                    Paste URL                                 │
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   vie-web                               ││
│  │              React Dashboard                            ││
│  └─────────────────────────────────────────────────────────┘│
│                         │                                    │
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   vie-api                               ││
│  │           Orchestrates everything                       ││
│  └─────────────────────────────────────────────────────────┘│
│              │                           │                   │
│              ↓                           ↓                   │
│  ┌───────────────────┐       ┌───────────────────┐          │
│  │  vie-summarizer   │       │   vie-explainer   │          │
│  │                   │       │                   │          │
│  │ YouTube → Summary │       │ Explain & Chat    │          │
│  │   (Claude AI)     │       │   (Claude AI)     │          │
│  └───────────────────┘       └───────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Smart Caching = Low Cost

**Same video = one AI call.** Ever.

| Scenario                                 | AI Calls | Cost   |
| ---------------------------------------- | -------- | ------ |
| You summarize a video                    | 1        | ~$0.05 |
| 100 other users summarize the same video | 0        | $0.00  |
| You expand a section                     | 1        | ~$0.02 |
| You expand it again                      | 0        | $0.00  |

Popular videos become essentially **free** to process.

---

## Quick Start

```bash
# Clone
git clone https://github.com/yourusername/video-insight-engine.git
cd video-insight-engine

# Configure
cp .env.example .env
# Add your ANTHROPIC_API_KEY (get one at console.anthropic.com)

# Launch
docker-compose up -d

# Open
open http://localhost:5173
```

**That's it.** Paste a YouTube URL and watch the magic happen.

---

## Tech Stack

| Layer          | Technology                                |
| -------------- | ----------------------------------------- |
| **Frontend**   | React + TypeScript + Tailwind + shadcn/ui |
| **Backend**    | Node.js + Fastify                         |
| **AI Workers** | Python + Claude API                       |
| **Database**   | MongoDB                                   |
| **Queue**      | RabbitMQ                                  |

---

## Use Cases

### 🎓 Students

- Summarize lecture recordings
- Build a searchable study library
- Review before exams without rewatching

### 👨‍💻 Developers

- Extract key points from conference talks
- Save code patterns from tutorials
- Build a personal learning wiki

### 📚 Lifelong Learners

- Process online courses efficiently
- Never lose insights from podcasts
- Create a second brain for video content

### 🏢 Teams

- Share summarized training videos
- Build institutional knowledge from video content
- Onboard new members faster

---

## What Makes This Different

| Feature                     | YouTube         | Notion      | Video Insight Engine |
| --------------------------- | --------------- | ----------- | -------------------- |
| Search inside videos        | ❌              | ❌          | ✅                   |
| AI-powered summaries        | ❌              | Manual      | ✅ Automatic         |
| Save specific parts         | Timestamps only | Manual copy | ✅ One click         |
| Ask questions about content | ❌              | ❌          | ✅ Chat with AI      |
| Organize by topic           | Playlists       | ✅          | ✅ Folders           |
| Works offline               | ❌              | ✅          | ✅ Saved content     |

---

## Documentation

📖 **[Full Documentation →](./CLAUDE.md)**

Quick links:

- [Architecture](./docs/ARCHITECTURE.md) - System design
- [API Reference](./docs/API-REST.md) - Endpoints
- [Data Models](./docs/DATA-MODELS.md) - Database schemas

---

## Roadmap

- [x] Core summarization
- [x] Memorization system
- [x] Explain & chat
- [ ] Browser extension (paste from anywhere)
- [ ] Mobile app
- [ ] Team workspaces
- [ ] Obsidian/Notion sync
- [ ] Podcast support
- [ ] Multi-language support

---

## Contributing

This project uses **Claude Code** for AI-assisted development.

1. Read [CLAUDE.md](./CLAUDE.md) for project context
2. Run `@plan-auditor` before making changes
3. Follow patterns in `.claude/skills/`

---

## License

MIT - Use it, fork it, build on it.

---

<p align="center">
  <b>Stop forgetting. Start building knowledge.</b>
  <br><br>
  <a href="http://localhost:5173">Try it locally</a> •
  <a href="./CLAUDE.md">Read the docs</a> •
  <a href="https://github.com/yourusername/video-insight-engine/issues">Report a bug</a>
</p>
