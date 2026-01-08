# Service: vie-web

React frontend application.

---

## Tech Stack

| Technology   | Purpose      |
| ------------ | ------------ |
| Vite 5       | Build tool   |
| React 18     | UI framework |
| TypeScript   | Language     |
| Tailwind CSS | Styling      |
| shadcn/ui    | Components   |
| React Query  | Server state |
| Zustand      | Client state |
| React Router | Routing      |

---

## Project Structure

```
web/
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    │
    ├── api/
    │   ├── client.ts             # Fetch wrapper
    │   ├── auth.ts
    │   ├── folders.ts
    │   ├── videos.ts
    │   ├── memorize.ts
    │   └── explain.ts
    │
    ├── components/
    │   ├── ui/                   # shadcn components
    │   │
    │   ├── layout/
    │   │   ├── Layout.tsx
    │   │   ├── Header.tsx
    │   │   └── Sidebar.tsx
    │   │
    │   ├── folders/
    │   │   ├── FolderTree.tsx
    │   │   ├── FolderItem.tsx
    │   │   └── CreateFolderDialog.tsx
    │   │
    │   ├── videos/
    │   │   ├── VideoGrid.tsx
    │   │   ├── VideoCard.tsx
    │   │   ├── VideoDetail.tsx
    │   │   ├── SectionCard.tsx
    │   │   ├── ConceptBadge.tsx
    │   │   └── AddVideoDialog.tsx
    │   │
    │   ├── memorize/
    │   │   ├── MemorizeDialog.tsx
    │   │   ├── MemorizedGrid.tsx
    │   │   ├── MemorizedCard.tsx
    │   │   ├── MemorizedDetail.tsx
    │   │   └── ChatPanel.tsx
    │   │
    │   └── explain/
    │       └── ExpansionView.tsx
    │
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useFolders.ts
    │   ├── useVideos.ts
    │   ├── useMemorized.ts
    │   ├── useExplain.ts
    │   └── useWebSocket.ts
    │
    ├── pages/
    │   ├── LoginPage.tsx
    │   ├── RegisterPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── VideoPage.tsx
    │   └── MemorizedPage.tsx
    │
    ├── stores/
    │   └── uiStore.ts
    │
    ├── types/
    │   └── index.ts
    │
    └── lib/
        └── utils.ts
```

---

## Environment Variables

```bash
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
```

---

## Routes

| Path             | Page          | Description             |
| ---------------- | ------------- | ----------------------- |
| `/login`         | LoginPage     | Sign in                 |
| `/register`      | RegisterPage  | Sign up                 |
| `/`              | DashboardPage | Two-tab interface       |
| `/video/:id`     | VideoPage     | Video detail + sections |
| `/memorized/:id` | MemorizedPage | Item detail + chat      |

---

## Key Components

### DashboardPage

Two-tab layout with folder sidebar.

```tsx
// src/pages/DashboardPage.tsx

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"summarized" | "memorized">(
    "summarized"
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  return (
    <Layout>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summarized">📁 Summarized</TabsTrigger>
          <TabsTrigger value="memorized">🧠 Memorized</TabsTrigger>
        </TabsList>

        <div className="flex h-[calc(100vh-120px)]">
          {/* Sidebar */}
          <aside className="w-64 border-r p-4">
            <FolderTree
              type={activeTab}
              selectedId={selectedFolderId}
              onSelect={setSelectedFolderId}
            />
          </aside>

          {/* Content */}
          <main className="flex-1 p-6 overflow-auto">
            <TabsContent value="summarized">
              <AddVideoDialog />
              <VideoGrid folderId={selectedFolderId} />
            </TabsContent>

            <TabsContent value="memorized">
              <MemorizedGrid folderId={selectedFolderId} />
            </TabsContent>
          </main>
        </div>
      </Tabs>
    </Layout>
  );
}
```

### VideoPage

Video detail with explain functionality.

```tsx
// src/pages/VideoPage.tsx

export function VideoPage() {
  const { id } = useParams();
  const { data, isLoading } = useVideo(id!);
  const [expansion, setExpansion] = useState<string | null>(null);
  const explainMutation = useExplainAuto();

  if (isLoading) return <Skeleton />;

  const { video, summary } = data;

  const handleExplain = async (
    targetType: "section" | "concept",
    targetId: string
  ) => {
    const result = await explainMutation.mutateAsync({
      videoSummaryId: video.videoSummaryId,
      targetType,
      targetId,
    });
    setExpansion(result.expansion);
  };

  return (
    <Layout>
      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-6">
          {/* Video header */}
          <div className="flex gap-4">
            <img src={video.thumbnailUrl} className="w-48 rounded" />
            <div>
              <h1 className="text-2xl font-bold">{video.title}</h1>
              <p className="text-muted-foreground">{video.channel}</p>
            </div>
          </div>

          {/* TLDR */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{summary.tldr}</p>
              <div className="mt-4">
                <h4 className="font-medium">Key Takeaways</h4>
                <ul className="list-disc pl-5">
                  {summary.keyTakeaways.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Sections</h2>
            <div className="space-y-4">
              {summary.sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  onExplain={() => handleExplain("section", section.id)}
                  onMemorize={() => openMemorizeDialog("section", section)}
                />
              ))}
            </div>
          </div>

          {/* Concepts */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Concepts</h2>
            <div className="flex flex-wrap gap-2">
              {summary.concepts.map((concept) => (
                <ConceptBadge
                  key={concept.id}
                  concept={concept}
                  onExplain={() => handleExplain("concept", concept.id)}
                  onMemorize={() => openMemorizeDialog("concept", concept)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Expansion panel */}
        <aside className="border-l pl-6">
          {expansion ? (
            <ExpansionView
              content={expansion}
              onClose={() => setExpansion(null)}
            />
          ) : (
            <div className="text-muted-foreground text-center py-12">
              Click "Explain" on any section or concept
            </div>
          )}
        </aside>
      </div>
    </Layout>
  );
}
```

### ChatPanel

Interactive chat for memorized items.

```tsx
// src/components/memorize/ChatPanel.tsx

export function ChatPanel({ memorizedItemId }: { memorizedItemId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (message: string) =>
      api.explainChat(memorizedItemId, message, chatId),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: input },
        { role: "assistant", content: data.response },
      ]);
      setChatId(data.chatId);
      setInput("");
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || mutation.isPending) return;
    mutation.mutate(input);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            Ask questions about this content
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "mb-4 p-3 rounded-lg",
              msg.role === "user"
                ? "bg-primary text-primary-foreground ml-8"
                : "bg-muted mr-8"
            )}
          >
            {msg.role === "assistant" ? (
              <Markdown>{msg.content}</Markdown>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {mutation.isPending && (
          <div className="bg-muted p-3 rounded-lg mr-8">
            <Loader2 className="animate-spin" />
          </div>
        )}
        <div ref={scrollRef} />
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this content..."
          disabled={mutation.isPending}
        />
        <Button type="submit" disabled={mutation.isPending}>
          Send
        </Button>
      </form>
    </div>
  );
}
```

---

## API Client

```typescript
// src/api/client.ts

const API_URL = import.meta.env.VITE_API_URL;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json();
    throw new ApiError(res.status, error.message);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  // Videos
  getVideos: (folderId?: string) =>
    request(`/videos${folderId ? `?folderId=${folderId}` : ""}`),

  getVideo: (id: string) => request(`/videos/${id}`),

  createVideo: (url: string, folderId?: string) =>
    request("/videos", {
      method: "POST",
      body: JSON.stringify({ url, folderId }),
    }),

  // Explain
  explainAuto: (videoSummaryId: string, targetType: string, targetId: string) =>
    request(`/explain/${videoSummaryId}/${targetType}/${targetId}`),

  explainChat: (memorizedItemId: string, message: string, chatId?: string) =>
    request("/explain/chat", {
      method: "POST",
      body: JSON.stringify({ memorizedItemId, message, chatId }),
    }),

  // ... other endpoints
};
```

---

## shadcn Components

```bash
npx shadcn@latest init
npx shadcn@latest add button card input tabs dialog badge
npx shadcn@latest add dropdown-menu scroll-area textarea skeleton
npx shadcn@latest add toast avatar separator
```

---

## Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
```

---

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview

# Type check
npm run typecheck
```
