# Developer Guide

## 🚀 Quick Start for Developers

### Prerequisites
- Node.js 18+
- Basic understanding of React/Next.js
- TypeScript knowledge recommended

### Setup
```bash
cd trading-dashboard
npm install
npm run dev
```

## 📁 Understanding the Structure

### 1. Components Organization
```
components/
├── ui/                    # Base UI components
│   ├── Card.tsx          # Container components
│   ├── LoadingStates.tsx # Skeleton loaders
│   ├── ErrorStates.tsx   # Error handling
│   └── Filters.tsx       # Form components
├── trades/               # Trade feature
├── positions/            # Position feature
└── analytics/            # Analytics feature
```

### 2. Data Flow Pattern
```typescript
// 1. API Routes (app/api/)
export async function GET() {
  const data = await fetchFromFile();
  return NextResponse.json(data);
}

// 2. Custom Hooks (hooks/)
export const useTrades = (date: string) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  // Fetch logic here
  return { trades, loading, error, refetch };
};

// 3. Components (components/)
export default function TradesTable() {
  const { trades, loading, error } = useTrades(selectedDate);
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;
  return <Table data={trades} />;
}
```

## 🔧 Development Workflows

### Adding a New Feature

1. **Create Types** (types/trading.ts)
```typescript
export interface NewFeature {
  id: string;
  name: string;
  // ... other properties
}
```

2. **Create API Route** (app/api/new-feature/route.ts)
```typescript
export async function GET() {
  const data = await fetchNewFeatureData();
  return NextResponse.json(data);
}
```

3. **Create Custom Hook** (hooks/useNewFeature.ts)
```typescript
export const useNewFeature = () => {
  // Standard hook pattern
  const [data, setData] = useState<NewFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  
  const fetchData = useCallback(async () => {
    // Fetch implementation
  }, []);
  
  return { data, loading, error, refetch: fetchData };
};
```

4. **Create Component** (components/new-feature/NewFeatureComponent.tsx)
```typescript
export default function NewFeatureComponent() {
  const { data, loading, error } = useNewFeature();
  
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;
  
  return (
    <Card>
      {/* Component JSX */}
    </Card>
  );
}
```

### Modifying Existing Components

1. **Check Type Definitions** first in `types/trading.ts`
2. **Update Hook** if data structure changed
3. **Modify Component** with new props/data
4. **Test Build** with `npm run build`

### Adding New Utility Functions

```typescript
// utils/newUtils.ts
export const newUtilityFunction = (input: SomeType): OutputType => {
  // Implementation
  return result;
};

// Don't forget to update utils/index.ts for re-exports
export * from './newUtils';
```

## 🎨 UI Development Guidelines

### Using the Design System

```typescript
// Import from ui components
import { Card, MetricCard } from '@/components/ui/Card';
import { LoadingSkeleton } from '@/components/ui/LoadingStates';
import { ErrorState } from '@/components/ui/ErrorStates';

// Use consistent patterns
<MetricCard
  title="My Metric"
  value={formatCurrency(value)}
  valueColor={value >= 0 ? 'success' : 'error'}
  icon={<DollarSign className="h-4 w-4" />}
/>
```

### Color System
```typescript
// Use constants for consistency
import { COLORS, CHART_COLORS } from '@/utils/constants';

// Apply in components
className={`text-${COLORS.SUCCESS}`}
stroke={CHART_COLORS.PRIMARY}
```

### Responsive Design
```typescript
// Follow mobile-first approach
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Content */}
</div>
```

## 🔍 Debugging and Testing

### Debug Mode
```bash
# Enable verbose logging
DEBUG=true npm run dev
```

### Component Testing Pattern
```typescript
// Example test structure
import { render, screen } from '@testing-library/react';
import TradesTable from '@/components/trades/TradesTable';

// Mock the hook
jest.mock('@/hooks/useTrades', () => ({
  useTrades: () => ({
    trades: mockTrades,
    loading: false,
    error: null,
    refetch: jest.fn()
  })
}));

describe('TradesTable', () => {
  it('renders trades correctly', () => {
    render(<TradesTable />);
    expect(screen.getByText('Trading History')).toBeInTheDocument();
  });
});
```

### Hook Testing Pattern
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useTrades } from '@/hooks/useTrades';

// Mock fetch
global.fetch = jest.fn();

describe('useTrades', () => {
  it('fetches trades successfully', async () => {
    const mockResponse = { trades: [] };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const { result } = renderHook(() => useTrades('2024-01-01'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.trades).toEqual([]);
    });
  });
});
```

## ⚡ Performance Tips

### Optimization Techniques
```typescript
// 1. Memoize expensive components
const ExpensiveComponent = React.memo(({ data }: Props) => {
  // Component implementation
});

// 2. Use useCallback for functions passed as props
const handleClick = useCallback(() => {
  // Handler implementation
}, [dependencies]);

// 3. Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'));
```

### Bundle Analysis
```bash
# Analyze bundle size
npm run build
npm run analyze  # If analyzer is set up
```

## 🔐 Security Best Practices

### Data Validation
```typescript
// Always validate API responses
const validateTradeData = (data: unknown): Trade[] => {
  if (!Array.isArray(data)) {
    throw new Error('Invalid trades data format');
  }
  
  return data.map(item => {
    // Validate each trade item
    if (!item.symbol || !item.type) {
      throw new Error('Invalid trade item');
    }
    return item as Trade;
  });
};
```

### Error Handling
```typescript
// Don't expose sensitive information
catch (error) {
  console.error('Internal error:', error); // For debugging
  setError({
    message: 'Failed to load data', // Generic user message
    code: 'DATA_FETCH_ERROR'
  });
}
```

## 📦 Build and Deployment

### Development Build
```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
```

### Environment Configuration
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=development
```

### Production Checklist
- [ ] All TypeScript errors resolved
- [ ] Tests passing
- [ ] Bundle size acceptable
- [ ] Performance optimized
- [ ] Error handling complete
- [ ] Security review done

## 🤝 Contributing Guidelines

### Code Style
- Use TypeScript for all new code
- Follow existing naming conventions
- Add JSDoc comments for complex functions
- Keep components small and focused

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### Pull Request Checklist
- [ ] Code follows project conventions
- [ ] TypeScript types are accurate
- [ ] Components are properly tested
- [ ] Performance impact considered
- [ ] Documentation updated

## 📚 Learning Resources

### Key Concepts to Master
1. **React Hooks**: Understanding useEffect, useCallback, useMemo
2. **TypeScript**: Interfaces, generics, type guards
3. **Next.js**: App Router, API routes, server components
4. **Performance**: React optimization patterns

### Useful Libraries
- **Recharts**: Chart library used in analytics
- **Lucide React**: Icon library
- **date-fns**: Date manipulation
- **Tailwind CSS**: Utility-first CSS framework

---

This guide should help you navigate and contribute to the trading dashboard effectively. For specific questions, refer to the component documentation or create an issue in the repository.