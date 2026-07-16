// Shared empty-state primitive — every interactive renders this instead of
// bare `return null` so an empty/filtered tab never shows blank whitespace.
export { EmptyTabState } from './EmptyTabState';

// Kept interactives
export { ChecklistInteractive } from './ChecklistInteractive';
export { FlashDeckInteractive } from './FlashDeckInteractive';
export { SpotExplorer } from './SpotExplorer';
export { StepByStepInteractive } from './StepByStepInteractive';
export { MomentTrack } from './MomentTrack';
export type { MomentItem } from './MomentTrack';
export { ComparisonInteractive } from './ComparisonInteractive';
export { BudgetInteractive } from './BudgetInteractive';
export { OverviewInteractive } from './OverviewInteractive';
export { InfoGridInteractive } from './InfoGridInteractive';

// Video-to-action overhaul (2026-05-28) — new interactives
export { VideoFilmstrip, type FilmstripFrame } from './VideoFilmstrip';
export { ConceptCanvas } from './ConceptCanvas';
export { StepFlowCanvas } from './StepFlowCanvas';
// ComparisonRadar was merged into ComparisonInteractive (P3C); comparison_radar
// is now a registry alias that renders ComparisonInteractive with view="radar".
export { ConnectCanvas } from './ConnectCanvas';
export { CodePlayground } from './CodePlayground';
export { QuizArena, type QuizArenaQuestion } from './QuizArena';
export { PackingMission, type PackingItem } from './PackingMission';
export { WorkoutRoom } from './WorkoutRoom';
export { LyricsKaraoke, type LyricsSection } from './LyricsKaraoke';

// Interactive Overhaul v2 — Phase 5b: news signature component
export { ClaimsTracker } from './ClaimsTracker';

// Interactive Overhaul v2 — Phase 5c/d: gaming + sport signature components
export { TierList } from './TierList';
export { FormationDiagram } from './FormationDiagram';

// Interactive Overhaul v2 — Phase 2: secondary-tier (attachment-only) components
export { StatBanner, type StatBannerStat } from './StatBanner';
export { TipCallout } from './TipCallout';
export { SummaryHeader } from './SummaryHeader';
export { DiagramCard, type DiagramCardItem } from './DiagramCard';
