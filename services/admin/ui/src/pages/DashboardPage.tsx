import { AlertsBanner } from '../components/AlertsBanner';
import { CostChart } from '../components/CostChart';
import { FeatureBreakdown } from '../components/FeatureBreakdown';
import { ServiceHealth } from '../components/ServiceHealth';
import { StatsCards } from '../components/StatsCards';

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <AlertsBanner />
      <StatsCards />
      <ServiceHealth />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CostChart />
        <FeatureBreakdown />
      </div>
    </div>
  );
}
