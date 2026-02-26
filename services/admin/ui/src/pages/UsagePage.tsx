import { CostChart } from '../components/CostChart';
import { FeatureBreakdown } from '../components/FeatureBreakdown';
import { ModelBreakdown } from '../components/ModelBreakdown';
import { RecentCalls } from '../components/RecentCalls';

export function UsagePage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostChart />
        <ModelBreakdown />
      </div>
      <FeatureBreakdown />
      <RecentCalls />
    </div>
  );
}
