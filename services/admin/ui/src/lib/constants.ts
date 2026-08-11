export const OUTPUT_TYPE_LABELS: Record<string, string> = {
  summary: 'Summary',
  recipe: 'Recipe',
  tutorial: 'Tutorial',
  review: 'Review',
  lecture: 'Lecture',
  interview: 'Interview',
  news: 'News',
  documentary: 'Documentary',
  workout: 'Workout',
  music: 'Music',
  vlog: 'Vlog',
};

export function getOutputTypeLabel(type: string): string {
  return OUTPUT_TYPE_LABELS[type] ?? type;
}
