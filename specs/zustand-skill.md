# Zustand - Complete Skill Guide

> A comprehensive guide to best practices, anti-patterns, and common pitfalls when using Zustand for React state management.

---

## Table of Contents

1. [Store Creation](#store-creation)
2. [Selectors](#selectors)
3. [Actions](#actions)
4. [State Updates](#state-updates)
5. [Middleware Usage](#middleware-usage)
6. [Performance Optimization](#performance-optimization)
7. [Async Operations](#async-operations)
8. [Testing](#testing)
9. [Bad Practices & Anti-patterns](#bad-practices--anti-patterns)
10. [TypeScript Best Practices](#typescript-best-practices)

---

## Store Creation

### ✅ Best Practices

#### 1.1 Basic Store Creation

```typescript
import { create } from 'zustand';

// Good: Simple, focused store
const useCounterStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}));
```

#### 1.2 Store Organization

```typescript
// Good: Organize by feature/domain
const useAuthStore = create((set) => ({
  // State
  user: null,
  isAuthenticated: false,
  isLoading: false,
  
  // Actions
  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const user = await api.login(credentials);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: error.message });
    }
  },
  logout: () => set({ user: null, isAuthenticated: false }),
}));
```

#### 1.3 Single Store vs Multiple Stores

```typescript
// Good: Multiple stores for different domains (recommended)
const useUserStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));

const useThemeStore = create((set) => ({
  theme: 'light',
  toggleTheme: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
}));

const useCartStore = create((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ 
    items: [...state.items, item] 
  })),
}));

// Avoid: Monolithic store with everything
const useGlobalStore = create((set) => ({
  // Too many unrelated concerns
  user: null,
  theme: 'light',
  cartItems: [],
  notifications: [],
  // ... hundreds of lines
}));
```

### ❌ Bad Practices

```typescript
// Bad: Store creation inside component
function MyComponent() {
  const useLocalStore = create(() => ({ count: 0 })); // Never do this!
  const state = useLocalStore();
}

// Bad: Creating stores conditionally
function App() {
  if (condition) {
    const useStore = create(...); // Never do this!
  }
}
```

---

## Selectors

### ✅ Best Practices

#### 2.1 Basic Selector Usage

```typescript
// Good: Select only what you need
const count = useCounterStore((state) => state.count);
const increment = useCounterStore((state) => state.increment);

// Good: Multiple selections in separate hooks
const count = useCounterStore((state) => state.count);
const increment = useCounterStore((state) => state.increment);
const decrement = useCounterStore((state) => state.decrement);
```

#### 2.2 Using useShallow for Object Selections

```typescript
import { useShallow } from 'zustand/react/shallow';

// Good: Use useShallow when selecting multiple properties
const { count, name } = useCounterStore(
  useShallow((state) => ({ count: state.count, name: state.name }))
);

// Good: Alternative - separate hooks
const count = useCounterStore((state) => state.count);
const name = useCounterStore((state) => state.name);
```

#### 2.3 Creating Reusable Selectors

```typescript
// Good: Define selectors outside components
const selectCount = (state) => state.count;
const selectUser = (state) => state.user;
const selectIsAuthenticated = (state) => state.isAuthenticated;

// Use in components
const count = useCounterStore(selectCount);
const user = useAuthStore(selectUser);
```

### ❌ Bad Practices (CRITICAL)

```typescript
// CRITICAL BAD: Creates new object every render - causes infinite re-renders!
const { setMessages } = useMessagesStore((state) => ({
  setMessages: state.setMessages,
}));

// CRITICAL BAD: Same issue - new object every render
const { count, increment } = useCounterStore((state) => ({
  count: state.count,
  increment: state.increment,
}));

// CRITICAL BAD: Array also creates new reference
const [count, setCount] = useCounterStore((state) => [
  state.count,
  state.setCount,
]);
```

### ✅ Correct Alternatives

```typescript
// Good: Select individual properties
const setMessages = useMessagesStore((state) => state.setMessages);

// Good: Use useShallow for multiple properties
const { count, increment } = useCounterStore(
  useShallow((state) => ({ count: state.count, increment: state.increment }))
);

// Good: Separate hooks (simplest and most performant)
const count = useCounterStore((state) => state.count);
const increment = useCounterStore((state) => state.increment);
```

---

## Actions

### ✅ Best Practices

#### 3.1 Defining Actions in Store

```typescript
// Good: Actions defined in store with clear naming
const useTodoStore = create((set, get) => ({
  // State
  todos: [],
  filter: 'all',
  
  // Actions
  addTodo: (text) => {
    const newTodo = { id: Date.now(), text, completed: false };
    set((state) => ({ todos: [...state.todos, newTodo] }));
  },
  
  toggleTodo: (id) => {
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      ),
    }));
  },
  
  removeTodo: (id) => {
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== id),
    }));
  },
  
  setFilter: (filter) => set({ filter }),
  
  // Using get() to access current state
  getCompletedCount: () => {
    return get().todos.filter((todo) => todo.completed).length;
  },
}));
```

#### 3.2 Action Naming Conventions

```typescript
// Good: Clear, consistent naming
const useStore = create((set) => ({
  // Use verbs for actions
  fetchUser: () => {},
  updateUser: () => {},
  deleteUser: () => {},
  setUser: () => {},
  resetUser: () => {},
  
  // Use set/get prefix for simple state changes
  setName: (name) => set({ name }),
  setEmail: (email) => set({ email }),
  
  // Boolean toggles
  toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
  enableFeature: () => set({ featureEnabled: true }),
  disableFeature: () => set({ featureEnabled: false }),
}));
```

#### 3.3 Separating State and Actions (Optional Pattern)

```typescript
// Good: Separate actions for better organization
const createActions = (set, get) => ({
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  getTotal: () => get().count + get().bonus,
});

const useStore = create((set, get) => ({
  count: 0,
  bonus: 10,
  ...createActions(set, get),
}));
```

### ❌ Bad Practices

```typescript
// Bad: Defining actions outside store that mutate state directly
function Component() {
  const todos = useTodoStore((state) => state.todos);
  const setTodos = useTodoStore((state) => state.setTodos);
  
  // Don't do this - logic scattered in components
  const handleAdd = (text) => {
    setTodos([...todos, { id: Date.now(), text }]);
  };
}

// Bad: Inconsistent naming
const useStore = create((set) => ({
  user: null,
  getUser: () => {},  // confusing - is this a getter or action?
  userUpdate: () => {}, // inconsistent naming
  updatingUser: () => {}, // sounds like a boolean
}));
```

---

## State Updates

### ✅ Best Practices

#### 4.1 Using set Function Correctly

```typescript
const useStore = create((set) => ({
  count: 0,
  name: '',
  items: [],
  
  // Good: Functional update when depending on previous state
  increment: () => set((state) => ({ count: state.count + 1 })),
  
  // Good: Direct update when not depending on previous state
  setName: (name) => set({ name }),
  
  // Good: Partial updates (set merges by default)
  updatePartial: () => set({ count: 5 }), // name and items preserved
}));
```

#### 4.2 Immutable State Updates

```typescript
const useStore = create((set) => ({
  items: [],
  user: { name: '', email: '' },
  nested: { deep: { value: 0 } },
  
  // Good: Array updates
  addItem: (item) => set((state) => ({ 
    items: [...state.items, item] 
  })),
  
  removeItem: (id) => set((state) => ({ 
    items: state.items.filter((item) => item.id !== id) 
  })),
  
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    ),
  })),
  
  // Good: Object updates
  updateUser: (updates) => set((state) => ({
    user: { ...state.user, ...updates },
  })),
  
  // Good: Nested updates
  updateNested: (value) => set((state) => ({
    nested: { ...state.nested, deep: { ...state.nested.deep, value } },
  })),
}));
```

#### 4.3 Understanding set() Merges by Default

```typescript
const useStore = create((set) => ({
  count: 0,
  name: 'John',
  age: 30,
  
  // Good: set merges by default - only updates specified properties
  updateName: () => {
    set({ name: 'Jane' }); // count and age remain unchanged
  },
  
  // Good: Replace entire state when needed (second argument)
  replaceState: () => {
    set({ count: 0, name: '', age: 0 }, true); // true = replace
  },
}));
```

### ❌ Bad Practices

```typescript
const useStore = create((set, get) => ({
  items: [],
  user: { name: '', email: '' },
  
  // Bad: Mutating state directly
  badAddItem: (item) => {
    const state = get();
    state.items.push(item); // Mutation!
    set({ items: state.items });
  },
  
  // Bad: Mutating nested objects
  badUpdateUser: (name) => {
    const state = get();
    state.user.name = name; // Mutation!
    set({ user: state.user });
  },
  
  // Bad: Using get() when functional update would work
  badIncrement: () => {
    set({ count: get().count + 1 }); // Use functional form instead
  },
}));
```

---

## Middleware Usage

### ✅ Best Practices

#### 5.1 Persist Middleware (localStorage)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 })),
    }),
    {
      name: 'my-app-storage', // unique name
      // Good: Select specific fields to persist
      partialize: (state) => ({ count: state.count }),
      // Good: Handle hydration
      onRehydrateStorage: () => (state) => {
        console.log('Storage rehydrated:', state);
      },
    }
  )
);
```

#### 5.2 Immer Middleware (Mutable-style Updates)

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useStore = create(
  immer((set) => ({
    user: { name: '', email: '', preferences: { theme: 'light' } },
    items: [],
    
    // Good: Write mutable-style code with immer
    updateUserName: (name) =>
      set((draft) => {
        draft.user.name = name; // Looks like mutation, but it's safe!
      }),
    
    addItem: (item) =>
      set((draft) => {
        draft.items.push(item); // Safe push with immer
      }),
    
    updateNestedPreference: (theme) =>
      set((draft) => {
        draft.user.preferences.theme = theme; // Easy nested updates
      }),
  }))
);
```

#### 5.3 Devtools Middleware

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools(
    (set) => ({
      count: 0,
      increment: () => set((state) => ({ count: state.count + 1 }), false, 'increment'),
    }),
    {
      name: 'MyStore',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);
```

#### 5.4 Combining Multiple Middleware

```typescript
import { create } from 'zustand';
import { persist, devtools, immer } from 'zustand/middleware';

const useStore = create(
  devtools(
    persist(
      immer((set) => ({
        count: 0,
        increment: () =>
          set((draft) => {
            draft.count += 1;
          }),
      })),
      { name: 'counter-storage' }
    ),
    { name: 'CounterStore' }
  )
);
```

#### 5.5 Subscribe Middleware

```typescript
const useStore = create((set, get, api) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

// Good: Subscribe to state changes outside React
const unsubscribe = useStore.subscribe(
  (state) => state.count,
  (count, previousCount) => {
    console.log(`Count changed from ${previousCount} to ${count}`);
  }
);

// Unsubscribe when done
unsubscribe();
```

### ❌ Bad Practices

```typescript
// Bad: Not handling persist hydration
const useStore = create(
  persist(
    (set) => ({ count: 0 }),
    { name: 'storage' }
  )
);

// Component might render with stale state before rehydration
function Component() {
  const count = useStore((state) => state.count);
  // count might be 0 initially even if persisted value is different
}

// Bad: Persisting everything including non-serializable data
const useStore = create(
  persist(
    (set) => ({
      count: 0,
      domRef: { current: null }, // Non-serializable!
      callback: () => {}, // Non-serializable!
    }),
    { name: 'storage' } // Will cause issues
  )
);
```

---

## Performance Optimization

### ✅ Best Practices

#### 6.1 Selecting Only Needed State

```typescript
// Good: Select only what each component needs
function CounterDisplay() {
  const count = useCounterStore((state) => state.count);
  return <div>{count}</div>; // Only re-renders when count changes
}

function CounterButtons() {
  const increment = useCounterStore((state) => state.increment);
  const decrement = useCounterStore((state) => state.decrement);
  return (
    <div>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  ); // Never re-renders from state changes
}
```

#### 6.2 Avoiding Object Creation in Selectors

```typescript
// Good: Stable selector functions defined outside component
const selectCount = (state) => state.count;
const selectIncrement = (state) => state.increment;

function Counter() {
  const count = useCounterStore(selectCount);
  const increment = useCounterStore(selectIncrement);
}

// Good: Inline selectors are okay for simple cases
function Counter() {
  const count = useCounterStore((state) => state.count);
}

// Bad: Creating new selector function on every render
function Counter() {
  const count = useCounterStore((state) => ({ count: state.count }));
}
```

#### 6.3 Using Multiple Hooks for Different Slices

```typescript
// Good: Separate hooks for unrelated state
function UserProfile() {
  const user = useUserStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);
  
  // Component only re-renders when user OR theme changes
}

// Good: Within same store, use separate hooks
function Dashboard() {
  const notifications = useAppStore((state) => state.notifications);
  const unreadCount = useAppStore((state) => state.unreadCount);
  const markAsRead = useAppStore((state) => state.markAsRead);
  
  // Each hook subscribes independently
}
```

#### 6.4 Memoizing Derived State

```typescript
import { useMemo } from 'react';

// Good: Compute derived state in component with useMemo
function TodoList() {
  const todos = useTodoStore((state) => state.todos);
  const filter = useTodoStore((state) => state.filter);
  
  const filteredTodos = useMemo(() => {
    switch (filter) {
      case 'completed':
        return todos.filter((t) => t.completed);
      case 'active':
        return todos.filter((t) => !t.completed);
      default:
        return todos;
    }
  }, [todos, filter]);
  
  return <List items={filteredTodos} />;
}
```

### ❌ Bad Practices

```typescript
// Bad: Subscribing to entire store
function Component() {
  const state = useStore(); // No selector = entire store
  return <div>{state.count}</div>; // Re-renders on ANY state change
}

// Bad: Creating selectors inline that return new objects
function Component() {
  const { count, name } = useStore((state) => ({
    count: state.count,
    name: state.name,
  })); // New object every render = infinite re-renders!
}

// Bad: Computing derived state in store without memoization
const useStore = create((set) => ({
  todos: [],
  // This creates new array on every access!
  get completedTodos() {
    return this.todos.filter((t) => t.completed);
  },
}));
```

---

## Async Operations

### ✅ Best Practices

#### 7.1 Handling Async Actions

```typescript
const useUserStore = create((set) => ({
  user: null,
  isLoading: false,
  error: null,
  
  // Good: Handle loading and error states
  fetchUser: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const user = await api.fetchUser(userId);
      set({ user, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  // Good: Optimistic updates
  updateUser: async (updates) => {
    const previousUser = get().user;
    set({ user: { ...previousUser, ...updates } }); // Optimistic
    try {
      await api.updateUser(updates);
    } catch (error) {
      set({ user: previousUser }); // Rollback on error
    }
  },
}));
```

#### 7.2 Loading and Error States Pattern

```typescript
const useAsyncStore = create((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  
  // Good: Async action with proper state management
  asyncAction: async () => {
    // Prevent concurrent requests
    if (get().isLoading) return;
    
    set({ isLoading: true, error: null });
    
    try {
      const result = await fetchData();
      set({ data: result, isLoading: false });
      return result;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      throw error; // Re-throw for component handling
    }
  },
  
  // Good: Reset function
  reset: () => set({ data: null, isLoading: false, error: null }),
}));
```

#### 7.3 Using in Components

```typescript
function UserProfile({ userId }) {
  const { user, isLoading, error, fetchUser } = useUserStore(
    useShallow((state) => ({
      user: state.user,
      isLoading: state.isLoading,
      error: state.error,
      fetchUser: state.fetchUser,
    }))
  );
  
  useEffect(() => {
    fetchUser(userId);
  }, [userId, fetchUser]);
  
  if (isLoading) return <Spinner />;
  if (error) return <Error message={error} />;
  if (!user) return null;
  
  return <Profile user={user} />;
}
```

### ❌ Bad Practices

```typescript
// Bad: Not handling loading state
const useBadStore = create((set) => ({
  user: null,
  fetchUser: async (id) => {
    const user = await api.fetchUser(id); // No loading state!
    set({ user });
  },
}));

// Bad: Not handling errors
const useBadStore = create((set) => ({
  data: null,
  fetchData: async () => {
    const data = await api.fetchData(); // What if this fails?
    set({ data });
  },
}));

// Bad: Not cleaning up or preventing duplicate requests
const useBadStore = create((set) => ({
  isLoading: false,
  fetchData: async () => {
    set({ isLoading: true });
    const data = await api.fetchData(); // Multiple concurrent calls possible!
    set({ data, isLoading: false });
  },
}));
```

---

## Testing

### ✅ Best Practices

#### 8.1 Testing Stores

```typescript
// store.js
export const useCounterStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));

// store.test.js
import { act } from '@testing-library/react';
import { useCounterStore } from './store';

describe('Counter Store', () => {
  // Reset store before each test
  beforeEach(() => {
    useCounterStore.setState({ count: 0 });
  });
  
  test('initial state', () => {
    expect(useCounterStore.getState().count).toBe(0);
  });
  
  test('increment', () => {
    act(() => {
      useCounterStore.getState().increment();
    });
    expect(useCounterStore.getState().count).toBe(1);
  });
  
  test('decrement', () => {
    useCounterStore.setState({ count: 5 });
    act(() => {
      useCounterStore.getState().decrement();
    });
    expect(useCounterStore.getState().count).toBe(4);
  });
});
```

#### 8.2 Mocking Stores in Components

```typescript
// Component that uses store
function Counter() {
  const { count, increment } = useCounterStore();
  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>Increment</button>
    </div>
  );
}

// Component.test.js
import { render, screen, fireEvent } from '@testing-library/react';
import { useCounterStore } from './store';

// Mock the store
jest.mock('./store', () => ({
  useCounterStore: jest.fn(),
}));

describe('Counter', () => {
  const mockIncrement = jest.fn();
  
  beforeEach(() => {
    useCounterStore.mockImplementation((selector) => {
      const state = {
        count: 5,
        increment: mockIncrement,
      };
      return selector ? selector(state) : state;
    });
  });
  
  test('renders count', () => {
    render(<Counter />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
  
  test('calls increment on click', () => {
    render(<Counter />);
    fireEvent.click(screen.getByText('Increment'));
    expect(mockIncrement).toHaveBeenCalled();
  });
});
```

#### 8.3 Testing with Provider Pattern

```typescript
// Create a test utility for providing stores
function createTestStore(initialState) {
  return create(() => ({ ...initialState }));
}

// Test with isolated store instance
function renderWithStore(Component, { initialState = {} } = {}) {
  const TestStore = createTestStore(initialState);
  
  const Wrapper = ({ children }) => (
    <StoreProvider store={TestStore}>{children}</StoreProvider>
  );
  
  return render(<Component />, { wrapper: Wrapper });
}
```

### ❌ Bad Practices

```typescript
// Bad: Not resetting store between tests
// State leaks from one test to another!

describe('Bad Tests', () => {
  test('first test', () => {
    useStore.getState().increment();
    expect(useStore.getState().count).toBe(1);
  });
  
  test('second test', () => {
    // count might be 1 here from previous test!
    expect(useStore.getState().count).toBe(0); // Flaky!
  });
});
```

---

## Bad Practices & Anti-patterns

### 9.1 Selector Anti-patterns Summary

```typescript
// ANTI-PATTERN 1: Creating new objects in selectors
const { count, increment } = useStore((state) => ({
  count: state.count,
  increment: state.increment,
}));
// Result: Infinite re-renders!

// ANTI-PATTERN 2: Creating new arrays in selectors
const [count, setCount] = useStore((state) => [
  state.count,
  state.setCount,
]);
// Result: Infinite re-renders!

// ANTI-PATTERN 3: Subscribing to entire store
const state = useStore();
// Result: Component re-renders on ANY state change

// ANTI-PATTERN 4: Destructuring incorrectly
const { count } = useStore((state) => ({ count: state.count }));
// Result: Same as anti-pattern 1

// ANTI-PATTERN 5: Computing values in selector
const doubled = useStore((state) => state.count * 2);
// This is actually fine - primitive values are compared by value
```

### 9.2 State Management Issues

```typescript
// BAD: Mutating state directly
const useStore = create((set, get) => ({
  items: [],
  addItem: (item) => {
    const state = get();
    state.items.push(item); // Mutation!
    set({ items: state.items });
  },
}));

// BAD: Not understanding set merges
const useStore = create((set) => ({
  user: { name: 'John', age: 30 },
  updateName: (name) => {
    set({ user: { name } }); // Oops! Age is lost!
  },
}));

// GOOD: Proper merge
updateName: (name) => {
  set((state) => ({ 
    user: { ...state.user, name } 
  }));
},

// BAD: Over-using Zustand for local state
function Component() {
  // Don't use Zustand for simple local state!
  const [localValue, setLocalValue] = useStore((state) => [
    state.localValue,
    state.setLocalValue,
  ]);
  
  // Use useState instead
  const [localValue, setLocalValue] = useState('');
}
```

### 9.3 Performance Pitfalls

```typescript
// BAD: Subscribing to entire store
function BadComponent() {
  const store = useStore(); // Re-renders on every state change
  return <div>{store.count}</div>;
}

// BAD: Inline selectors that create new objects
function BadComponent() {
  const data = useStore((state) => ({
    count: state.count,
    name: state.name,
  })); // New object reference every render
}

// BAD: Not using proper equality checks
const data = useStore((state) => state.complexObject);
// If complexObject reference changes, component re-renders
// even if contents are the same
```

### 9.4 Middleware Misuse

```typescript
// BAD: Incorrect persist configuration
const useStore = create(
  persist(
    (set) => ({
      count: 0,
      domElement: document.getElementById('app'), // Non-serializable!
      callback: () => console.log('hello'), // Non-serializable!
    }),
    { name: 'my-storage' }
  )
);

// GOOD: Only persist serializable data
const useStore = create(
  persist(
    (set) => ({
      count: 0,
      domElement: null, // Don't persist
      callback: null, // Don't persist
    }),
    {
      name: 'my-storage',
      partialize: (state) => ({ count: state.count }), // Only persist count
    }
  )
);

// BAD: Not handling hydration
function Component() {
  const user = useStore((state) => state.user);
  
  useEffect(() => {
    if (user) {
      fetchUserData(user.id); // Might run with stale data!
    }
  }, [user]);
}

// GOOD: Handle hydration properly
const useStore = create(
  persist(
    (set) => ({ count: 0 }),
    {
      name: 'storage',
      onRehydrateStorage: () => (state) => {
        useStore.setState({ _hasHydrated: true });
      },
    }
  )
);

function Component() {
  const { user, _hasHydrated } = useStore(
    useShallow((state) => ({ 
      user: state.user, 
      _hasHydrated: state._hasHydrated 
    }))
  );
  
  useEffect(() => {
    if (_hasHydrated && user) {
      fetchUserData(user.id);
    }
  }, [_hasHydrated, user]);
}
```

---

## TypeScript Best Practices

### ✅ Best Practices

#### 10.1 Proper Store Typing

```typescript
import { create } from 'zustand';

// Good: Define types first
interface User {
  id: string;
  name: string;
  email: string;
}

interface UserState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

interface UserActions {
  setUser: (user: User | null) => void;
  fetchUser: (id: string) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

type UserStore = UserState & UserActions;

// Good: Type the store properly
const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,
  
  setUser: (user) => set({ user }),
  
  fetchUser: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const user = await api.fetchUser(id);
      set({ user, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
  
  updateUser: async (updates) => {
    const { user } = get();
    if (!user) return;
    
    set({ isLoading: true });
    try {
      const updated = await api.updateUser(user.id, updates);
      set({ user: updated, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
}));
```

#### 10.2 Typing with Middleware

```typescript
import { create } from 'zustand';
import { persist, immer } from 'zustand/middleware';
import {devtools} from "zustand/middleware";

interface BearState {
  bears: number;
  addBear: () => void;
}

const useBearStore = create<BearState>()(
  devtools(
    persist(
      immer((set) => ({
        bears: 0,
        addBear: () =>
          set((draft) => {
            draft.bears += 1;
          }),
      })),
      { name: 'bear-storage' }
    ),
    { name: 'BearStore' }
  )
);
```

#### 10.3 Selector Types

```typescript
// Good: Type selectors for better inference
const selectCount: (state: UserStore) => number = (state) => state.count;
const selectUser: (state: UserStore) => User | null = (state) => state.user;

// Or use satisfies for type checking
const selectName = ((state: UserStore) => state.user?.name) satisfies (
  state: UserStore
) => string | undefined;

// In component
const count = useUserStore(selectCount);
const user = useUserStore(selectUser);
```

### ❌ Bad Practices

```typescript
// Bad: Not typing the store
const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
// No type safety!

// Bad: Incorrect middleware typing
const useStore = create<StoreType>(
  persist(
    (set) => ({ count: 0 }),
    { name: 'storage' }
  )
);
// Type inference issues with middleware

// Bad: Using any
const useStore = create<any>((set) => ({
  // ...
}));
```

---

## Quick Reference

### Do's and Don'ts Summary

| ✅ Do This | ❌ Don't Do This |
|-----------|-----------------|
| `const count = useStore(s => s.count)` | `const { count } = useStore(s => ({ count: s.count }))` |
| Use `useShallow` for multiple properties | Create new objects/arrays in selectors |
| Select only what you need | Subscribe to entire store |
| Use separate hooks for different slices | Destructure from object selectors |
| Define selectors outside components | Create selectors inline that return objects |
| Use functional updates: `set(s => ({ count: s.count + 1 }))` | Use `get()` when not needed |
| Keep state immutable | Mutate state directly |
| Use immer for complex updates | Write complex spread operations |
| Handle loading/error states in async actions | Forget error handling |
| Use `partialize` with persist | Persist non-serializable data |
| Type your store properly | Use `any` or skip types |

### Common Error Patterns

```typescript
// ERROR: Infinite re-render loop
const { value } = useStore((state) => ({ value: state.value }));

// FIX: Select primitive value
const value = useStore((state) => state.value);

// ERROR: Losing state on partial update
set({ user: { name: 'New' } }); // Loses other user properties

// FIX: Spread existing state
set((state) => ({ user: { ...state.user, name: 'New' } }));

// ERROR: Component re-renders too much
const state = useStore();

// FIX: Select specific properties
const count = useStore((state) => state.count);
```

---

## Resources

- [Official Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Zustand GitHub Repository](https://github.com/pmndrs/zustand)
- [Zustand Middleware Guide](https://docs.pmnd.rs/zustand/guides/initialize-state-with-props)

---

*Last updated: 2024*
