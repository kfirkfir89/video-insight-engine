import type {
  OutputData,
  OutputType,
  EnrichmentData,
  ExplanationOutput,
  RecipeOutput,
  CodeWalkthroughOutput,
  StudyKitOutput,
  TripPlannerOutput,
  WorkoutOutput,
  VerdictOutput,
  HighlightsOutput,
  MusicGuideOutput,
  ProjectGuideOutput,
} from '@vie/types';
import { ExplanationTabs } from './output-views/ExplanationTabs';
import { RecipeTabs } from './output-views/RecipeTabs';
import { CodeTabs } from './output-views/CodeTabs';
import { StudyTabs } from './output-views/StudyTabs';
import { TripTabs } from './output-views/TripTabs';
import { WorkoutTabs } from './output-views/WorkoutTabs';
import { VerdictTabs } from './output-views/VerdictTabs';
import { HighlightsTabs } from './output-views/HighlightsTabs';
import { MusicTabs } from './output-views/MusicTabs';
import { ProjectTabs } from './output-views/ProjectTabs';

interface OutputContentProps {
  outputType: OutputType;
  outputData: OutputData;
  enrichment?: EnrichmentData;
  activeTabId: string;
}

export function OutputContent({ outputType, outputData, enrichment, activeTabId }: OutputContentProps) {
  const data = outputData.data;

  switch (outputType) {
    case 'explanation':
      return <ExplanationTabs data={data as ExplanationOutput} activeTab={activeTabId} />;
    case 'recipe':
      return <RecipeTabs data={data as RecipeOutput} activeTab={activeTabId} />;
    case 'code_walkthrough':
      return <CodeTabs data={data as CodeWalkthroughOutput} enrichment={enrichment} activeTab={activeTabId} />;
    case 'study_kit':
      return <StudyTabs data={data as StudyKitOutput} enrichment={enrichment} activeTab={activeTabId} />;
    case 'trip_planner':
      return <TripTabs data={data as TripPlannerOutput} activeTab={activeTabId} />;
    case 'workout':
      return <WorkoutTabs data={data as WorkoutOutput} activeTab={activeTabId} />;
    case 'verdict':
      return <VerdictTabs data={data as VerdictOutput} activeTab={activeTabId} />;
    case 'highlights':
      return <HighlightsTabs data={data as HighlightsOutput} activeTab={activeTabId} />;
    case 'music_guide':
      return <MusicTabs data={data as MusicGuideOutput} activeTab={activeTabId} />;
    case 'project_guide':
      return <ProjectTabs data={data as ProjectGuideOutput} activeTab={activeTabId} />;
    default:
      return <ExplanationTabs data={data as ExplanationOutput} activeTab={activeTabId} />;
  }
}
