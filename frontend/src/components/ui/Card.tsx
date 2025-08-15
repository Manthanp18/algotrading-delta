import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export const Card = ({ children, className = '', padding = 'md' }: CardProps) => {
  const paddingClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  valueColor?: 'default' | 'success' | 'error' | 'warning';
  className?: string;
}

export const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  valueColor = 'default',
  className = ''
}: MetricCardProps) => {
  const colorClasses = {
    default: 'text-white',
    success: 'text-green-500',
    error: 'text-red-500',
    warning: 'text-yellow-500'
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <div className={`text-2xl font-bold ${colorClasses[valueColor]} mb-1`}>
        {value}
      </div>
      {subtitle && (
        <p className="text-xs text-gray-500">{subtitle}</p>
      )}
    </Card>
  );
};