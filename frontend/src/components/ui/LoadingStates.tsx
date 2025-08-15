import { Card } from './Card';

export const LoadingSkeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse ${className}`}>
    <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
    <div className="h-8 bg-gray-800 rounded w-1/2"></div>
  </div>
);

export const TableLoadingSkeleton = () => (
  <Card>
    <div className="animate-pulse">
      <div className="h-4 bg-gray-800 rounded w-1/4 mb-4"></div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-800 rounded"></div>
        ))}
      </div>
    </div>
  </Card>
);

export const MetricLoadingSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {[...Array(8)].map((_, i) => (
      <Card key={i}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-800 rounded w-1/2 mb-2"></div>
          <div className="h-8 bg-gray-800 rounded w-3/4"></div>
        </div>
      </Card>
    ))}
  </div>
);

export const ChartLoadingSkeleton = () => (
  <Card>
    <div className="animate-pulse">
      <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
      <div className="h-64 bg-gray-800 rounded"></div>
    </div>
  </Card>
);