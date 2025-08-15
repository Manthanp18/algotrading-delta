import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Card } from './Card';
import { ApiError } from '@/types/trading';

interface ErrorStateProps {
  error: ApiError;
  onRetry?: () => void;
  title?: string;
}

export const ErrorState = ({ error, onRetry, title = 'Error' }: ErrorStateProps) => (
  <Card className="text-center">
    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400 mb-4">{error.message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    )}
  </Card>
);

export const NoDataState = ({ 
  title = 'No Data', 
  message = 'No data available for the selected criteria.',
  icon 
}: { 
  title?: string; 
  message?: string;
  icon?: React.ReactNode;
}) => (
  <Card className="text-center">
    {icon || <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4 opacity-50" />}
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400">{message}</p>
  </Card>
);