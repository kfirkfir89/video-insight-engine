# MCP EXPLAINER API

Model Context Protocol (MCP) tools exposed by `vie-explainer`.

---

## Overview

`vie-explainer` is an MCP server with two tools:

| Tool           | Purpose                                       | Cached? |
| -------------- | --------------------------------------------- | ------- |
| `explain_auto` | Generate documentation for section/concept    | ✅ Yes  |
| `explain_chat` | Interactive conversation about memorized item | ❌ No   |

---

## Connection

`vie-api` connects as MCP client:

```typescript
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";

const transport = new StdioClientTransport({
  command: "python",
  args: ["-m", "src.server"],
  cwd: "/path/to/explainer",
});

const client = new Client({
  name: "vie-api",
  version: "1.0.0",
});

await client.connect(transport);
```

---

## Tool: explain_auto

Generate detailed documentation for a video section or concept. Results are cached and reused across all users.

### Schema

```json
{
  "name": "explain_auto",
  "description": "Generate detailed documentation for a video section or concept. Results are cached.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "videoSummaryId": {
        "type": "string",
        "description": "ID of videoSummaryCache entry"
      },
      "targetType": {
        "type": "string",
        "enum": ["section", "concept"],
        "description": "Type of content to explain"
      },
      "targetId": {
        "type": "string",
        "description": "UUID of the section or concept"
      }
    },
    "required": ["videoSummaryId", "targetType", "targetId"]
  }
}
```

### Input Example

```json
{
  "videoSummaryId": "507f1f77bcf86cd799439020",
  "targetType": "section",
  "targetId": "550e8400-e29b-41d4-a716-446655440001"
}
```

### Output

Returns markdown string:

````markdown
# useState Hook

The `useState` hook is the most fundamental hook in React...

## Basic Usage

```jsx
const [count, setCount] = useState(0);
```
````

## Key Concepts

1. **Initial Value**: Passed as argument to useState
2. **State Variable**: First element of returned array
3. **Setter Function**: Second element, triggers re-render

## Examples

### Counter Component

...

## Best Practices

- Always call hooks at the top level
- Don't call hooks inside conditions
  ...

```

### Flow

```

Input received
│
▼
Check systemExpansionCache
by (videoSummaryId + targetType + targetId)
│
┌──┴──┐
│ │
HIT MISS
│ │
▼ ▼
Return Load context from videoSummaryCache
cached │
│ ▼
│ Build prompt (section or concept)
│ │
│ ▼
│ Call Claude API
│ │
│ ▼
│ Save to systemExpansionCache
│ │
└────┬────┘
│
▼
Return content

````

---

## Tool: explain_chat

Interactive conversation about a memorized item. Personalized per user, never cached.

### Schema

```json
{
  "name": "explain_chat",
  "description": "Interactive conversation about memorized content. Per-user, not cached.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "memorizedItemId": {
        "type": "string",
        "description": "ID of the memorized item"
      },
      "userId": {
        "type": "string",
        "description": "ID of the user"
      },
      "message": {
        "type": "string",
        "description": "User's message"
      },
      "chatId": {
        "type": "string",
        "description": "Optional - continue existing chat"
      }
    },
    "required": ["memorizedItemId", "userId", "message"]
  }
}
````

### Input Example

New conversation:

```json
{
  "memorizedItemId": "507f1f77bcf86cd799439030",
  "userId": "507f1f77bcf86cd799439011",
  "message": "Can you explain this with a practical example?"
}
```

Continue conversation:

```json
{
  "memorizedItemId": "507f1f77bcf86cd799439030",
  "userId": "507f1f77bcf86cd799439011",
  "message": "How would I use this in a form?",
  "chatId": "507f1f77bcf86cd799439040"
}
```

### Output

````json
{
  "response": "Sure! Let me show you a practical example of useState with a form...\n\n```jsx\nfunction LoginForm() {\n  const [email, setEmail] = useState('');\n  ...\n}\n```",
  "chatId": "507f1f77bcf86cd799439040"
}
````

### Flow

```
Input received
      │
      ▼
Load memorizedItem by ID
(verify userId matches)
      │
      ▼
Load or create userChat
      │
      ▼
Build prompt:
├── System context (memorized content)
├── Chat history (previous messages)
└── Current message
      │
      ▼
Call Claude API
(NEVER cached)
      │
      ▼
Save messages to userChat
      │
      ▼
Return response + chatId
```

### System Prompt Template

```
You are a helpful tutor discussing content the user has saved.

SAVED CONTENT:
Title: {item.title}
Source Video: {item.source.videoTitle}
YouTube: {item.source.youtubeUrl}

CONTENT:
{formatted content from item.source.content}

USER'S NOTES:
{item.notes or "None"}

---

Help the user understand this content deeply:
- Answer questions clearly
- Provide practical examples
- Add code snippets when relevant
- Make connections to related concepts
- Be conversational and supportive
```

---

## Error Handling

Both tools can return errors:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Video summary not found"
  }
}
```

Error codes:

- `NOT_FOUND` - Resource doesn't exist
- `UNAUTHORIZED` - User doesn't own the resource
- `PROCESSING` - Still generating (retry later)
- `LLM_ERROR` - Claude API error

---

## Usage from vie-api

```typescript
// Gateway calling explain_auto
async function explainAuto(
  videoSummaryId: string,
  targetType: string,
  targetId: string
) {
  const result = await mcpClient.callTool("explain_auto", {
    videoSummaryId,
    targetType,
    targetId,
  });

  if (result.isError) {
    throw new Error(result.content[0].text);
  }

  return result.content[0].text;
}

// Gateway calling explain_chat
async function explainChat(
  memorizedItemId: string,
  userId: string,
  message: string,
  chatId?: string
) {
  const result = await mcpClient.callTool("explain_chat", {
    memorizedItemId,
    userId,
    message,
    ...(chatId && { chatId }),
  });

  if (result.isError) {
    throw new Error(result.content[0].text);
  }

  return JSON.parse(result.content[0].text);
}
```
