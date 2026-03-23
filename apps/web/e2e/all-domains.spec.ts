/**
 * All-Domains E2E Tests
 *
 * Tests each domain renderer (learning, tech, food, fitness, music,
 * travel, review, project, narrative) with realistic mock data.
 * Verifies tab switching, data rendering, and empty state handling.
 *
 * Data flow: API response → OutputRouter → VIEResponse → ComposableOutput
 *   → Interactive component (if in INTERACTIVE_TABS) or DisplaySection (generic)
 */
import { test, expect } from "./fixtures";

// ── Shared helpers ──

function makeVideo(title: string) {
  return {
    id: "video-1",
    videoSummaryId: "summary-1",
    youtubeId: "dQw4w9WgXcQ",
    title,
    channel: "Test Channel",
    duration: 600,
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    status: "completed",
    folderId: null,
    createdAt: "2024-01-01T00:00:00Z",
  };
}

/**
 * Create a VideoOutput mock with domain-keyed extraction data.
 * @param primaryTag - The primary content tag (e.g., "tech", "food")
 * @param tabs - Tab definitions with id, label, emoji, dataSource
 * @param domainData - Domain-keyed extraction data (e.g., { tech: {...} })
 */
function makeOutput(
  primaryTag: string,
  tabs: { id: string; label: string; emoji: string; dataSource: string }[],
  domainData: Record<string, unknown>,
) {
  return {
    triage: {
      contentTags: [primaryTag],
      modifiers: [],
      primaryTag,
      userGoal: `Testing ${primaryTag} domain`,
      tabs,
      sections: [],
      confidence: 0.95,
    },
    output: domainData,
    synthesis: {
      tldr: "Test summary",
      keyTakeaways: ["Takeaway 1"],
      masterSummary: "Test master summary",
      seoDescription: "Test SEO",
    },
    enrichment: null,
  };
}

async function setupMock(
  page: import("@playwright/test").Page,
  title: string,
  output: ReturnType<typeof makeOutput>,
) {
  await page.route(/\/api\/videos\/video-1$/, (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ video: makeVideo(title), summary: null, output }),
      });
    } else {
      route.continue();
    }
  });
}

async function waitForOutput(page: import("@playwright/test").Page) {
  await page.waitForSelector(".max-w-4xl", { timeout: 10000 });
  await page.waitForSelector("[role='tablist']", { timeout: 5000 });
}

// ── Mock data for each domain ──
// Data shapes must match what interactive components and DisplaySection expect.

const TECH_DATA = {
  // overview: string → DisplaySection renders as paragraph
  overview: "A comprehensive TypeScript and Python tutorial using React and FastAPI frameworks.",
  // setup: TechSnippet[] → CodeExplorer renders code blocks
  setup: [
    { filename: "terminal", language: "bash", code: "npm install", explanation: "Install dependencies" },
    { filename: "terminal", language: "bash", code: "npm run dev", explanation: "Start development server" },
  ],
  // snippets: TechSnippet[] → CodeExplorer
  snippets: [
    { filename: "app.ts", language: "typescript", code: "const x = 1;", explanation: "A variable" },
  ],
  // cheatSheet: TechSnippet[] → CodeExplorer
  cheatSheet: [
    { filename: "Quick Start", language: "bash", code: "npx create-app", explanation: "Bootstrap project" },
  ],
};

const FOOD_DATA = {
  // overview: string → DisplaySection renders as paragraph
  overview: "A medium difficulty Italian recipe. Prep: 10min, Cook: 25min. Serves 4. Approx 400 calories per serving.",
  // ingredients: normalized by ChecklistInteractive → { name, amount, unit } → "400 g Pasta"
  ingredients: [
    { name: "Pasta", amount: "400", unit: "g", group: "Main" },
    { name: "Tomatoes", amount: "2", unit: "cans", group: "Sauce" },
  ],
  // steps: StepItem[] → StepByStepInteractive
  steps: [
    { number: 1, title: "Boil Water", instruction: "Fill pot with water and bring to boil.", duration: "10 min", tips: "Salt generously" },
    { number: 2, title: "Cook Pasta", instruction: "Cook pasta until al dente.", duration: "8 min" },
  ],
  // tips: TipItem[] → DisplaySection → CalloutBlock
  tips: [
    { type: "chef_tip", text: "Reserve pasta water for the sauce." },
    { type: "warning", text: "Don't overcook the pasta." },
  ],
};

const FITNESS_DATA = {
  // overview: string → DisplaySection
  overview: "A 30min intermediate HIIT workout targeting chest and back with dumbbells. Burns approximately 300 calories.",
  // exercises: FitnessExercise[] → ExerciseInteractive
  exercises: [
    { emoji: "💪", name: "Push-ups", sets: 3, reps: "12", rest: "60s", formCues: ["Keep core tight", "Full range"], modifications: [{ label: "Knee push-ups", description: "Easier variant" }] },
    { emoji: "🏋️", name: "Dumbbell Row", sets: 3, reps: "10", rest: "60s", formCues: ["Squeeze at top"], modifications: [] },
  ],
  // tips: TipItem[] → DisplaySection → CalloutBlock
  tips: [
    { type: "tip", text: "Focus on mind-muscle connection." },
    { type: "warning", text: "Stop if you feel sharp pain." },
  ],
};

const MUSIC_DATA = {
  // credits: specs format → DisplaySection → KeyValueRow
  credits: [
    { key: "Title", value: "Bohemian Rhapsody" },
    { key: "Artist", value: "Queen" },
    { key: "Vocals", value: "Freddie Mercury" },
    { key: "Guitar", value: "Brian May" },
    { key: "Genre", value: "Rock, Progressive Rock" },
  ],
  // analysis: string → DisplaySection → paragraph
  analysis: "A groundbreaking 6-minute operatic rock masterpiece that defied conventional song structure.",
  // structure: specs format → DisplaySection → KeyValueRow
  structure: [
    { key: "Intro", value: "A cappella opening (0:30)" },
    { key: "Ballad", value: "Piano-led section (2:00)" },
    { key: "Opera", value: "Multi-layered vocal harmonies (1:30)" },
  ],
  // lyrics: string → DisplaySection → paragraph
  lyrics: "Is this the real life?\nIs this just fantasy?\nCaught in a landslide",
};

const TRAVEL_DATA = {
  // days: TravelDay[] → SpotExplorer (via normalizeItineraryProps)
  days: [
    {
      day: 1, city: "Tokyo", theme: "Cultural Immersion",
      spots: [
        { name: "Senso-ji Temple", emoji: "⛩️", description: "Oldest Buddhist temple in Tokyo", cost: "Free", duration: "2h", tips: "Go early morning" },
        { name: "Akihabara", emoji: "🎮", description: "Electronics and anime district", cost: "$50", duration: "3h" },
      ],
    },
  ],
  // budget: SpotItem-like[] → SpotExplorer
  budget: [
    { name: "Accommodation", emoji: "🏨", cost: "USD 800", description: "Hostels and budget hotels" },
    { name: "Food", emoji: "🍜", cost: "USD 500", description: "Street food and restaurants" },
  ],
  // packingList: PackingItem[] → ChecklistInteractive
  packingList: [
    { item: "Comfortable shoes", category: "Clothing", essential: true },
    { item: "Portable WiFi", category: "Electronics", essential: true },
  ],
};

const REVIEW_DATA = {
  // overview: string → DisplaySection → paragraph
  overview: "iPhone 16 Pro review. Rating: 8.5/10 (Great). Priced at $999. The best iPhone camera system yet with A18 Pro chip.",
  // pros/cons/comparisons → ComparisonInteractive (accessed from full review object)
  pros: ["Excellent camera system", "A18 Pro chip performance", "USB-C finally"],
  cons: ["Expensive", "Incremental upgrade", "No major design change"],
  comparisons: [{ feature: "Camera", thisProduct: "48MP triple", competitor: "50MP triple", competitorName: "Samsung S24 Ultra" }],
  // specs: key/value → DisplaySection → KeyValueRow (uses non-interactive tab ID)
  specs: [{ key: "Display", value: "6.3\" OLED 120Hz" }, { key: "Chip", value: "A18 Pro" }, { key: "Storage", value: "128GB-1TB" }],
  // verdict: string → DisplaySection → paragraph
  verdict: "Recommended. Best iPhone yet, but pricey. Best for Photography enthusiasts and iOS users.",
};

const PROJECT_DATA = {
  // overview: string → DisplaySection → paragraph
  overview: "Wooden Bookshelf - an intermediate difficulty DIY project. Estimated time: 4 hours, estimated cost: $80.",
  // materials: { name, quantity, cost } → ChecklistInteractive
  materials: [
    { name: "Pine boards", quantity: "6 pieces", cost: "$40", notes: "1x10x6 ft" },
    { name: "Wood screws", quantity: "24 pieces", cost: "$5" },
  ],
  // tools: { name, notes } → ChecklistInteractive
  tools: [
    { name: "Drill", notes: "Required" },
    { name: "Sander", notes: "Optional - Alternative: Sandpaper" },
  ],
  // steps: StepItem[] → StepByStepInteractive
  steps: [
    { number: 1, title: "Cut boards", instruction: "Cut pine boards to shelf lengths.", duration: "30 min", tips: "Measure twice", safetyNote: "Wear dust mask" },
    { number: 2, title: "Sand surfaces", instruction: "Sand all surfaces smooth.", duration: "20 min" },
  ],
};

const NARRATIVE_DATA = {
  // keyMoments: TimelineEntry[] → TimelineExplorer
  keyMoments: [
    { time: "0:45", seconds: 45, label: "The unexpected twist", emoji: "😮", mood: "Surprise", description: "The unexpected twist that changes everything." },
    { time: "3:00", seconds: 180, label: "The heartfelt confession", emoji: "😢", mood: "Emotional", description: "The heartfelt confession scene." },
  ],
  // quotes: NarrativeQuote[] → DisplaySection → QuoteBlock
  quotes: [
    { text: "The only way to do great work is to love what you do.", speaker: "Steve Jobs", timestamp: 120, context: "During commencement speech" },
    { text: "Stay hungry, stay foolish.", speaker: "Steve Jobs", timestamp: 300 },
  ],
  // takeaways: string[] → DisplaySection → ListBlock
  takeaways: ["Follow your passion", "Don't settle for less", "Connect the dots looking backwards"],
};

// ── Tests ──

test.describe("All Domain Renderers", () => {
  // ── TECH ──
  test.describe("Tech domain", () => {
    const techOutput = makeOutput("tech", [
      { id: "overview", label: "Overview", emoji: "📋", dataSource: "tech.overview" },
      { id: "setup", label: "Setup", emoji: "⚙️", dataSource: "tech.setup" },
      { id: "code", label: "Code", emoji: "💻", dataSource: "tech.snippets" },
      { id: "cheat_sheet", label: "Cheat Sheet", emoji: "📝", dataSource: "tech.cheatSheet" },
    ], { tech: TECH_DATA });

    test("should render tech overview with language mentions", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Tech Tutorial", techOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await expect(page.getByText("TypeScript")).toBeVisible();
      await expect(page.getByText("Python")).toBeVisible();
      await expect(page.getByText("React")).toBeVisible();
    });

    test("should render setup commands", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Tech Tutorial", techOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Setup/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("npm install")).toBeVisible();
    });

    test("should render code snippets", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Tech Tutorial", techOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Code/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("const x = 1;")).toBeVisible();
      await expect(page.getByText("A variable")).toBeVisible();
    });

    test("should render cheat sheet cards", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Tech Tutorial", techOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Cheat Sheet/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Quick Start")).toBeVisible();
      await expect(page.getByText("npx create-app")).toBeVisible();
    });
  });

  // ── FOOD ──
  test.describe("Food domain", () => {
    const foodOutput = makeOutput("food", [
      { id: "overview", label: "Overview", emoji: "📋", dataSource: "food.overview" },
      { id: "ingredients", label: "Ingredients", emoji: "🥕", dataSource: "food.ingredients" },
      { id: "steps", label: "Steps", emoji: "👨‍🍳", dataSource: "food.steps" },
      { id: "tips", label: "Tips", emoji: "💡", dataSource: "food.tips" },
    ], { food: FOOD_DATA });

    test("should render recipe overview with details", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Pasta Recipe", foodOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await expect(page.getByText("Italian")).toBeVisible();
      await expect(page.getByText("10min")).toBeVisible();
      await expect(page.getByText("400")).toBeVisible();
    });

    test("should render ingredients list", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Pasta Recipe", foodOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Ingredients/i }).click({ force: true });
      await page.waitForTimeout(300);
      // ChecklistInteractive normalizes to "400 g Pasta" label
      await expect(page.getByText("g Pasta")).toBeVisible();
      await expect(page.getByText("Tomatoes")).toBeVisible();
    });

    test("should render cooking steps", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Pasta Recipe", foodOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Steps/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Boil Water")).toBeVisible();
      await expect(page.getByText("Fill pot with water")).toBeVisible();
    });

    test("should render tips with callout style", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Pasta Recipe", foodOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Tips/i }).click({ force: true });
      await page.waitForTimeout(300);
      // DisplaySection → CalloutBlock renders tip text with icon
      await expect(page.getByText("Reserve pasta water")).toBeVisible();
      await expect(page.getByText("Don't overcook the pasta")).toBeVisible();
    });
  });

  // ── FITNESS ──
  test.describe("Fitness domain", () => {
    const fitnessOutput = makeOutput("fitness", [
      { id: "overview", label: "Overview", emoji: "📋", dataSource: "fitness.overview" },
      { id: "exercises", label: "Exercises", emoji: "🏋️", dataSource: "fitness.exercises" },
      { id: "tips", label: "Tips", emoji: "💡", dataSource: "fitness.tips" },
    ], { fitness: FITNESS_DATA });

    test("should render fitness overview with metadata", async ({ authenticatedPage: page }) => {
      await setupMock(page, "HIIT Workout", fitnessOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      // "HIIT" appears in header + overview text
      await expect(page.getByText("HIIT").first()).toBeVisible();
      await expect(page.getByText("30min")).toBeVisible();
    });

    test("should render exercises with form cues", async ({ authenticatedPage: page }) => {
      await setupMock(page, "HIIT Workout", fitnessOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Exercises/i }).click({ force: true });
      await page.waitForTimeout(500);
      await expect(page.getByText("Push-ups")).toBeVisible();
      // ExerciseInteractive renders "3 sets" and "12 reps"
      await expect(page.getByText("3 sets").first()).toBeVisible();
      await expect(page.getByText("12 reps").first()).toBeVisible();
    });
  });

  // ── MUSIC ──
  test.describe("Music domain", () => {
    const musicOutput = makeOutput("music", [
      { id: "credits", label: "Credits", emoji: "🎬", dataSource: "music.credits" },
      { id: "analysis", label: "Analysis", emoji: "📈", dataSource: "music.analysis" },
      { id: "structure", label: "Structure", emoji: "🎵", dataSource: "music.structure" },
      { id: "lyrics", label: "Lyrics", emoji: "📝", dataSource: "music.lyrics" },
    ], { music: MUSIC_DATA });

    test("should render music credits with title/artist", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Bohemian Rhapsody Analysis", musicOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      // Credits rendered as KeyValueRow specs: key="Vocals", value="Freddie Mercury"
      await expect(page.getByText("Bohemian Rhapsody").first()).toBeVisible();
      await expect(page.getByText("Queen")).toBeVisible();
      await expect(page.getByText("Freddie Mercury")).toBeVisible();
    });

    test("should render analysis text", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Bohemian Rhapsody Analysis", musicOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Analysis/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("groundbreaking")).toBeVisible();
    });

    test("should render song structure", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Bohemian Rhapsody Analysis", musicOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Structure/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Intro")).toBeVisible();
      await expect(page.getByText("Ballad")).toBeVisible();
      await expect(page.getByText("Opera")).toBeVisible();
    });

    test("should render lyrics", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Bohemian Rhapsody Analysis", musicOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Lyrics/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Is this the real life?")).toBeVisible();
    });
  });

  // ── TRAVEL ──
  test.describe("Travel domain", () => {
    const travelOutput = makeOutput("travel", [
      { id: "itinerary", label: "Itinerary", emoji: "📅", dataSource: "travel.days" },
      { id: "budget", label: "Budget", emoji: "💰", dataSource: "travel.budget" },
      { id: "packing", label: "Packing", emoji: "🎒", dataSource: "travel.packingList" },
    ], { travel: TRAVEL_DATA });

    test("should render travel itinerary with spots", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Tokyo Travel Guide", travelOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await expect(page.getByText("Senso-ji Temple")).toBeVisible();
      await expect(page.getByText("Akihabara")).toBeVisible();
    });

    test("should render budget breakdown", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Tokyo Travel Guide", travelOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Budget/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Accommodation")).toBeVisible();
      await expect(page.getByText("USD 800")).toBeVisible();
    });

    test("should render packing list", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Tokyo Travel Guide", travelOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Packing/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Comfortable shoes")).toBeVisible();
      await expect(page.getByText("Portable WiFi")).toBeVisible();
    });
  });

  // ── REVIEW ──
  test.describe("Review domain", () => {
    const reviewOutput = makeOutput("review", [
      { id: "overview", label: "Overview", emoji: "📋", dataSource: "review.overview" },
      { id: "pros_cons", label: "Pros & Cons", emoji: "⚖️", dataSource: "review" },
      { id: "specifications", label: "Specs", emoji: "📊", dataSource: "review.specs" },
      { id: "verdict_summary", label: "Verdict", emoji: "🏆", dataSource: "review.verdict" },
    ], { review: REVIEW_DATA });

    test("should render review overview with rating", async ({ authenticatedPage: page }) => {
      await setupMock(page, "iPhone 16 Pro Review", reviewOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      // "iPhone 16 Pro" appears in header + overview, use first()
      await expect(page.getByText("iPhone 16 Pro").first()).toBeVisible();
      await expect(page.getByText("8.5")).toBeVisible();
    });

    test("should render pros and cons", async ({ authenticatedPage: page }) => {
      await setupMock(page, "iPhone 16 Pro Review", reviewOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Pros & Cons/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Excellent camera system")).toBeVisible();
      await expect(page.getByText("Expensive")).toBeVisible();
    });

    test("should render specs table", async ({ authenticatedPage: page }) => {
      await setupMock(page, "iPhone 16 Pro Review", reviewOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Specs/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Display")).toBeVisible();
      await expect(page.getByText("A18 Pro")).toBeVisible();
    });

    test("should render verdict", async ({ authenticatedPage: page }) => {
      await setupMock(page, "iPhone 16 Pro Review", reviewOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Verdict/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Best iPhone yet")).toBeVisible();
      await expect(page.getByText("Photography enthusiasts")).toBeVisible();
    });
  });

  // ── PROJECT ──
  test.describe("Project domain", () => {
    const projectOutput = makeOutput("project", [
      { id: "overview", label: "Overview", emoji: "📋", dataSource: "project.overview" },
      { id: "materials", label: "Materials", emoji: "🧱", dataSource: "project.materials" },
      { id: "tools", label: "Tools", emoji: "🔧", dataSource: "project.tools" },
      { id: "steps", label: "Steps", emoji: "📝", dataSource: "project.steps" },
    ], { project: PROJECT_DATA });

    test("should render project overview", async ({ authenticatedPage: page }) => {
      await setupMock(page, "DIY Bookshelf", projectOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await expect(page.getByText("Wooden Bookshelf")).toBeVisible();
      await expect(page.getByText("4 hours")).toBeVisible();
    });

    test("should render materials list", async ({ authenticatedPage: page }) => {
      await setupMock(page, "DIY Bookshelf", projectOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Materials/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Pine boards")).toBeVisible();
      await expect(page.getByText("Wood screws")).toBeVisible();
    });

    test("should render tools with notes", async ({ authenticatedPage: page }) => {
      await setupMock(page, "DIY Bookshelf", projectOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Tools/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Drill")).toBeVisible();
      await expect(page.getByText("Required")).toBeVisible();
      await expect(page.getByText("Sander")).toBeVisible();
    });

    test("should render project steps", async ({ authenticatedPage: page }) => {
      await setupMock(page, "DIY Bookshelf", projectOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Steps/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("Cut boards")).toBeVisible();
      // Step 1 is active, so its safetyNote is visible
      await expect(page.getByText("Wear dust mask")).toBeVisible();
    });
  });

  // ── NARRATIVE ──
  test.describe("Narrative modifier", () => {
    const narrativeOutput = makeOutput("learning", [
      { id: "key_moments", label: "Key Moments", emoji: "⭐", dataSource: "narrative.keyMoments" },
      { id: "quotes", label: "Quotes", emoji: "💬", dataSource: "narrative.quotes" },
      { id: "takeaways", label: "Takeaways", emoji: "🎯", dataSource: "narrative.takeaways" },
    ], { narrative: NARRATIVE_DATA });

    test("should render narrative key moments timeline", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Steve Jobs Speech", narrativeOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      // TimelineExplorer renders entry.label
      await expect(page.getByText("The unexpected twist")).toBeVisible();
    });

    test("should render quotes with attribution", async ({ authenticatedPage: page }) => {
      await setupMock(page, "Steve Jobs Speech", narrativeOutput);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Quotes/i }).click({ force: true });
      await page.waitForTimeout(300);
      // DisplaySection → QuoteBlock
      await expect(page.getByText("The only way to do great work")).toBeVisible();
      await expect(page.getByText("Steve Jobs").first()).toBeVisible();
    });
  });

  // ── EMPTY STATE HANDLING ──
  test.describe("Empty state handling", () => {
    test("should show empty message for null music analysis", async ({ authenticatedPage: page }) => {
      const emptyMusic = { ...MUSIC_DATA, analysis: null };
      const output = makeOutput("music", [
        { id: "credits", label: "Credits", emoji: "🎬", dataSource: "music.credits" },
        { id: "analysis", label: "Analysis", emoji: "📈", dataSource: "music.analysis" },
      ], { music: emptyMusic });
      await setupMock(page, "Song Analysis", output);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Analysis/i }).click({ force: true });
      await page.waitForTimeout(300);
      await expect(page.getByText("No data available")).toBeVisible();
    });

    test("should handle null overview gracefully", async ({ authenticatedPage: page }) => {
      const emptyTech = { ...TECH_DATA, overview: null };
      const output = makeOutput("tech", [
        { id: "overview", label: "Overview", emoji: "📋", dataSource: "tech.overview" },
        { id: "code", label: "Code", emoji: "💻", dataSource: "tech.snippets" },
      ], { tech: emptyTech });
      await setupMock(page, "Tech Video", output);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      // overview is non-interactive → DisplaySection(null) → "No data available"
      await expect(page.getByText("No data available")).toBeVisible();
    });

    test("should handle null tips gracefully", async ({ authenticatedPage: page }) => {
      const emptyFood = { ...FOOD_DATA, tips: null };
      const output = makeOutput("food", [
        { id: "overview", label: "Overview", emoji: "📋", dataSource: "food.overview" },
        { id: "tip_list", label: "Tips", emoji: "💡", dataSource: "food.tips" },
      ], { food: emptyFood });
      await setupMock(page, "Recipe Video", output);
      await page.goto("/video/video-1");
      await waitForOutput(page);
      await page.getByRole("tab", { name: /Tips/i }).click({ force: true });
      await page.waitForTimeout(300);
      // tip_list is non-interactive → DisplaySection(null) → "No data available"
      await expect(page.getByText("No data available")).toBeVisible();
    });
  });
});
