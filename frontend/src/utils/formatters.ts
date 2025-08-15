/**
 * Utility functions for formatting trading data
 */

export const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '--';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

export const formatPercentage = (value?: number): string => {
  if (value === undefined || value === null) return '--';
  return `${(value * 100).toFixed(2)}%`;
};

export const formatUptime = (milliseconds: number): string => {
  const hours = Math.floor(milliseconds / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

export const formatQuantity = (quantity: number, decimals: number = 6): string => {
  return quantity.toFixed(decimals);
};

export const formatTime = (timestamp?: string): string => {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateTime = (timestamp?: string): string => {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateOnly = (timestamp?: string): string => {
  if (!timestamp) return '--';
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
};