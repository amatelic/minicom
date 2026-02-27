# React Best Practices & Anti-patterns Skill Guide

A comprehensive guide to writing clean, performant, and maintainable React applications.

---

## Table of Contents

1. [Component Design](#1-component-design)
2. [State Management](#2-state-management)
3. [Hooks Usage](#3-hooks-usage)
4. [Performance Optimization](#4-performance-optimization)
5. [JSX Best Practices](#5-jsx-best-practices)
6. [Type Safety](#6-type-safety)
7. [Error Handling](#7-error-handling)
8. [Bad Practices & Anti-patterns](#8-bad-practices--anti-patterns)

---

## 1. Component Design

### 1.1 Single Responsibility Principle

Each component should do one thing well. If a component is handling UI rendering, data fetching, and state management all at once, it's time to split it.

**Bad Practice:**
```jsx
// A component doing too much
function UserDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => {
    setLoading(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      });
  }, []);

  const filteredUsers = users
    .filter(user => user.name.includes(searchTerm))
    .sort((a, b) => sortOrder === 'asc' 
      ? a.name.localeCompare(b.name) 
      : b.name.localeCompare(a.name));

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <input 
        value={searchTerm} 
        onChange={e => setSearchTerm(e.target.value)} 
      />
      <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
        Sort
      </button>
      <table>
        {filteredUsers.map(user => (
          <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
          </tr>
        ))}
      </table>
    </div>
  );
}
```

**Best Practice:**
```jsx
// Custom hook for data fetching
function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { users, loading, error };
}

// Hook for filtering and sorting
function useUserFilter(users) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  const filteredUsers = useMemo(() => {
    return users
      .filter(user => user.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => sortOrder === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name));
  }, [users, searchTerm, sortOrder]);

  return { filteredUsers, searchTerm, setSearchTerm, sortOrder, setSortOrder };
}

// Presentational component
function UserTable({ users }) {
  return (
    <table>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Search component
function SearchInput({ value, onChange }) {
  return (
    <input 
      type="search"
      placeholder="Search users..."
      value={value} 
      onChange={e => onChange(e.target.value)} 
    />
  );
}

// Main container component
function UserDashboard() {
  const { users, loading, error } = useUsers();
  const { filteredUsers, searchTerm, setSearchTerm, sortOrder, setSortOrder } = useUserFilter(users);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="user-dashboard">
      <div className="controls">
        <SearchInput value={searchTerm} onChange={setSearchTerm} />
        <SortButton order={sortOrder} onToggle={() => setSortOrder(
          sortOrder === 'asc' ? 'desc' : 'asc'
        )} />
      </div>
      <UserTable users={filteredUsers} />
    </div>
  );
}
```

### 1.2 Composition over Inheritance

React favors composition over inheritance. Use props and children to create flexible, reusable components.

**Bad Practice:**
```jsx
// Using inheritance pattern (anti-pattern in React)
class Card extends React.Component {
  renderHeader() {
    return null; // Override in subclasses
  }
  
  renderBody() {
    return null; // Override in subclasses
  }
  
  render() {
    return (
      <div className="card">
        <div className="card-header">{this.renderHeader()}</div>
        <div className="card-body">{this.renderBody()}</div>
      </div>
    );
  }
}

class UserCard extends Card {
  renderHeader() {
    return <h3>{this.props.user.name}</h3>;
  }
  
  renderBody() {
    return <p>{this.props.user.bio}</p>;
  }
}
```

**Best Practice:**
```jsx
// Flexible, composable Card component
function Card({ header, children, footer, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

// Usage with composition
function UserCard({ user }) {
  return (
    <Card 
      header={<h3>{user.name}</h3>}
      footer={<button>Follow</button>}
    >
      <p>{user.bio}</p>
      <UserStats user={user} />
    </Card>
  );
}

function ProductCard({ product }) {
  return (
    <Card 
      header={<img src={product.image} alt={product.name} />}
      footer={
        <div className="price-row">
          <span className="price">${product.price}</span>
          <button>Add to Cart</button>
        </div>
      }
    >
      <h4>{product.name}</h4>
      <p>{product.description}</p>
    </Card>
  );
}
```

### 1.3 Breaking Down Large Components

When a component exceeds ~200-300 lines or has multiple distinct responsibilities, consider splitting it.

**Best Practice - Component Extraction Checklist:**

1. **Identify distinct UI sections** - Header, Sidebar, Content, Footer
2. **Find reusable patterns** - Lists, Forms, Cards, Modals
3. **Separate business logic** - Custom hooks for data fetching, state management
4. **Extract pure functions** - Helpers, formatters, validators

```jsx
// Before: Large component (300+ lines)
function ProductPage({ productId }) {
  // ... 300 lines of mixed concerns
}

// After: Well-organized structure
function ProductPage({ productId }) {
  const { product, loading, error } = useProduct(productId);
  const { addToCart } = useCart();

  if (loading) return <ProductSkeleton />;
  if (error) return <ErrorDisplay error={error} />;

  return (
    <ProductLayout>
      <ProductGallery images={product.images} />
      <ProductInfo product={product} onAddToCart={addToCart} />
      <ProductReviews productId={productId} />
      <RelatedProducts category={product.category} />
    </ProductLayout>
  );
}
```

### 1.4 Proper Component Hierarchy

Organize components in a clear hierarchy that reflects your UI structure.

```
src/
├── components/           # Reusable, generic components
│   ├── ui/              # Primitive UI components (Button, Input, Card)
│   ├── layout/          # Layout components (Header, Sidebar, Footer)
│   └── common/          # Shared business components
├── features/            # Feature-specific components
│   ├── auth/
│   ├── dashboard/
│   └── products/
├── hooks/               # Custom hooks
├── utils/               # Utility functions
└── pages/               # Page components (route handlers)
```

---

## 2. State Management

### 2.1 Lifting State Up Appropriately

Lift state to the nearest common ancestor when multiple components need to share it.

**Bad Practice:**
```jsx
// State duplicated in sibling components
function Parent() {
  return (
    <div>
      <TemperatureInput />
      <TemperatureDisplay />
    </div>
  );
}

function TemperatureInput() {
  const [temperature, setTemperature] = useState(''); // ❌ Duplicated state
  return <input value={temperature} onChange={e => setTemperature(e.target.value)} />;
}

function TemperatureDisplay() {
  const [temperature, setTemperature] = useState(''); // ❌ Another copy
  return <div>{temperature}°C</div>;
}
```

**Best Practice:**
```jsx
// State lifted to common ancestor
function Parent() {
  const [temperature, setTemperature] = useState('');
  
  return (
    <div>
      <TemperatureInput value={temperature} onChange={setTemperature} />
      <TemperatureDisplay value={temperature} />
    </div>
  );
}

function TemperatureInput({ value, onChange }) {
  return <input value={value} onChange={e => onChange(e.target.value)} />;
}

function TemperatureDisplay({ value }) {
  return <div>{value}°C</div>;
}
```

### 2.2 Using useState vs useReducer

Choose the right state management approach based on complexity.

**Use `useState` when:**
- State is simple (primitives or simple objects)
- Few state transitions
- Independent state values

**Use `useReducer` when:**
- Complex state logic
- Multiple related state values
- State transitions follow patterns
- Need to centralize update logic

```jsx
// useState for simple state
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

// useReducer for complex state
const initialState = { items: [], loading: false, error: null };

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return {
        ...state,
        items: [...state.items, action.payload]
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload)
      };
    case 'UPDATE_QUANTITY':
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        )
      };
    case 'CLEAR_CART':
      return initialState;
    default:
      return state;
  }
}

function ShoppingCart() {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = (item) => dispatch({ type: 'ADD_ITEM', payload: item });
  const removeItem = (id) => dispatch({ type: 'REMOVE_ITEM', payload: id });
  
  // ... render logic
}
```

### 2.3 Avoiding Unnecessary State

Not everything needs to be in state. Use derived values when possible.

**Bad Practice:**
```jsx
function UserList({ users }) {
  const [userCount, setUserCount] = useState(0);
  const [sortedUsers, setSortedUsers] = useState([]);

  useEffect(() => {
    setUserCount(users.length); // ❌ Unnecessary state
    setSortedUsers([...users].sort((a, b) => a.name.localeCompare(b.name))); // ❌ Can be derived
  }, [users]);

  return (
    <div>
      <p>Total users: {userCount}</p>
      {sortedUsers.map(user => <UserCard key={user.id} user={user} />)}
    </div>
  );
}
```

**Best Practice:**
```jsx
function UserList({ users }) {
  // Derived values - computed on each render
  const userCount = users.length;
  
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  return (
    <div>
      <p>Total users: {userCount}</p>
      {sortedUsers.map(user => <UserCard key={user.id} user={user} />)}
    </div>
  );
}
```

### 2.4 State Colocation

Keep state as close as possible to where it's used.

**Bad Practice:**
```jsx
// All state at the top level
function App() {
  const [email, setEmail] = useState(''); // Only used in LoginForm
  const [password, setPassword] = useState(''); // Only used in LoginForm
  const [searchQuery, setSearchQuery] = useState(''); // Only used in SearchBar
  const [isModalOpen, setIsModalOpen] = useState(false); // Only used in Modal

  return (
    <div>
      <LoginForm 
        email={email} 
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
      />
      <SearchBar query={searchQuery} setQuery={setSearchQuery} />
      <Modal isOpen={isModalOpen} setIsOpen={setIsModalOpen} />
    </div>
  );
}
```

**Best Practice:**
```jsx
// State colocated with components that use it
function App() {
  return (
    <div>
      <LoginForm />
      <SearchBar />
      <ModalTrigger />
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // ... form logic
}

function SearchBar() {
  const [query, setQuery] = useState('');
  // ... search logic
}

function ModalTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  // ... modal logic
}
```

---

## 3. Hooks Usage

### 3.1 Rules of Hooks

Follow these rules to ensure hooks work correctly:

1. **Only call hooks at the top level** - Not inside loops, conditions, or nested functions
2. **Only call hooks from React functions** - Components or custom hooks

**Bad Practice:**
```jsx
function UserProfile({ userId }) {
  if (userId) {
    // ❌ Hook inside condition
    const [user, setUser] = useState(null);
  }

  for (let i = 0; i < 3; i++) {
    // ❌ Hook inside loop
    const [value, setValue] = useState(i);
  }

  function handleClick() {
    // ❌ Hook inside regular function
    const [count, setCount] = useState(0);
  }

  // ❌ Conditional hook call
  const [data, setData] = userId ? useState(null) : useState({});
}
```

**Best Practice:**
```jsx
function UserProfile({ userId }) {
  // ✅ All hooks at top level
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState([0, 1, 2]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return; // ✅ Conditional logic inside hook
    
    setLoading(true);
    fetchUser(userId).then(data => {
      setUser(data);
      setLoading(false);
    });
  }, [userId]);

  const handleClick = useCallback(() => {
    setCount(c => c + 1); // ✅ Use state updater function
  }, []);

  // ... render
}
```

### 3.2 Proper useEffect Dependency Arrays

The dependency array controls when the effect runs. Include all values used inside the effect.

**Bad Practice:**
```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // ❌ Missing dependency: userId

  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log(count);
    setCount(count + 1);
  }, [count]); // ❌ Infinite loop - count in deps and setter

  const handleSave = () => {
    saveUser(user);
  };

  useEffect(() => {
    document.addEventListener('click', handleSave);
    return () => document.removeEventListener('click', handleSave);
  }, []); // ❌ Missing dependency: handleSave (stale closure!)
}
```

**Best Practice:**
```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!userId) return;
    
    fetchUser(userId).then(setUser);
  }, [userId]); // ✅ All dependencies included

  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(c => c + 1); // ✅ Functional update avoids dependency
    }, 1000);
    return () => clearInterval(timer);
  }, []); // ✅ No dependencies needed with functional update

  // ✅ Stable callback with useCallback
  const handleSave = useCallback(() => {
    saveUser(user);
  }, [user]);

  useEffect(() => {
    document.addEventListener('click', handleSave);
    return () => document.removeEventListener('click', handleSave);
  }, [handleSave]); // ✅ handleSave is now a dependency
}
```

### 3.3 Cleaning Up Side Effects

Always clean up subscriptions, timers, and event listeners to prevent memory leaks.

**Bad Practice:**
```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();
    // ❌ No cleanup - memory leak when component unmounts!
  }, [roomId]);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('tick');
    }, 1000);
    // ❌ Timer keeps running after unmount
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    // ❌ Event listener not removed
  }, []);
}
```

**Best Practice:**
```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();
    
    return () => {
      connection.disconnect(); // ✅ Cleanup on unmount or roomId change
    };
  }, [roomId]);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log('tick');
    }, 1000);
    
    return () => clearInterval(timer); // ✅ Clear timer
  }, []);

  useEffect(() => {
    const handleResize = () => {
      // handle resize
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize); // ✅ Remove listener
  }, []);
}
```

### 3.4 Using useMemo and useCallback Appropriately

Don't over-optimize. Use these hooks only when there's a measurable performance benefit.

**When to use `useMemo`:**
- Expensive calculations
- Object/array stability for dependency arrays
- Referential equality for child components

**When to use `useCallback`:**
- Functions passed to optimized child components
- Functions in dependency arrays of other hooks
- Event handlers in large lists

**Bad Practice:**
```jsx
function ProductList({ products }) {
  // ❌ Unnecessary useMemo for simple operation
  const productCount = useMemo(() => products.length, [products]);

  // ❌ useCallback for function not passed to memoized child
  const handleClick = useCallback((id) => {
    console.log(id);
  }, []);

  // ❌ Premature optimization - simple map doesn't need memoization
  const productCards = useMemo(() => 
    products.map(p => <ProductCard key={p.id} product={p} />),
    [products]
  );

  return (
    <div>
      <p>Count: {productCount}</p>
      {productCards}
    </div>
  );
}
```

**Best Practice:**
```jsx
function ProductList({ products, onProductSelect }) {
  // ✅ Simple value - no memoization needed
  const productCount = products.length;

  // ✅ useCallback for function passed to memoized child
  const handleProductClick = useCallback((product) => {
    onProductSelect(product);
  }, [onProductSelect]);

  // ✅ useMemo for expensive calculation
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => 
      calculateProductScore(b) - calculateProductScore(a)
    );
  }, [products]);

  return (
    <div>
      <p>Count: {productCount}</p>
      {sortedProducts.map(product => (
        <MemoizedProductCard 
          key={product.id} 
          product={product}
          onClick={handleProductClick}
        />
      ))}
    </div>
  );
}

const MemoizedProductCard = React.memo(ProductCard);
```

---

## 4. Performance Optimization

### 4.1 React.memo for Component Memoization

Use `React.memo` to prevent unnecessary re-renders of pure functional components.

```jsx
// Component that re-renders even when props haven't changed
function ExpensiveComponent({ data }) {
  // Expensive rendering logic
  return <div>{/* ... */}</div>;
}

// Memoized version
const MemoizedExpensiveComponent = React.memo(function ExpensiveComponent({ data }) {
  // Only re-renders when data changes (shallow comparison)
  return <div>{/* ... */}</div>;
});

// With custom comparison
const CustomMemoComponent = React.memo(
  function MyComponent({ user }) {
    return <div>{user.name}</div>;
  },
  (prevProps, nextProps) => {
    // Return true to prevent re-render
    return prevProps.user.id === nextProps.user.id;
  }
);
```

### 4.2 useMemo for Expensive Calculations

Cache expensive computations between renders.

```jsx
function DataTable({ data, filter }) {
  // ✅ Expensive filtering cached
  const filteredData = useMemo(() => {
    return data
      .filter(item => matchesFilter(item, filter))
      .sort((a, b) => compareItems(a, b));
  }, [data, filter]);

  // ✅ Expensive aggregation cached
  const statistics = useMemo(() => {
    return {
      total: data.reduce((sum, item) => sum + item.value, 0),
      average: data.reduce((sum, item) => sum + item.value, 0) / data.length,
      max: Math.max(...data.map(item => item.value)),
      min: Math.min(...data.map(item => item.value))
    };
  }, [data]);

  return (
    <div>
      <StatsDisplay stats={statistics} />
      <Table data={filteredData} />
    </div>
  );
}
```

### 4.3 useCallback for Function Stability

Prevent function recreation on every render.

```jsx
function ParentComponent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  // ❌ New function created on every render
  const unstableHandler = () => {
    console.log(count);
  };

  // ✅ Function only recreated when count changes
  const stableHandler = useCallback(() => {
    console.log(count);
  }, [count]);

  return (
    <div>
      <input value={name} onChange={e => setName(e.target.value)} />
      {/* Child won't re-render when name changes */}
      <MemoizedChild onAction={stableHandler} />
    </div>
  );
}

const MemoizedChild = React.memo(ChildComponent);
```

### 4.4 Code Splitting with React.lazy and Suspense

Load components on demand to reduce initial bundle size.

```jsx
import { Suspense, lazy } from 'react';

// ✅ Lazy load route components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));

// ✅ Lazy load heavy components
const HeavyChart = lazy(() => import('./components/HeavyChart'));
const RichEditor = lazy(() => import('./components/RichEditor'));

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

// ✅ Conditional lazy loading with error boundary
function AnalyticsSection({ showCharts }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<ChartSkeleton />}>
        {showCharts && <HeavyChart data={data} />}
      </Suspense>
    </ErrorBoundary>
  );
}
```

### 4.5 Virtualization for Long Lists

Render only visible items for large lists.

```jsx
import { FixedSizeList as List } from 'react-window';

// ❌ Rendering 10,000 items - slow!
function SlowList({ items }) {
  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={{ height: 50 }}>{item.name}</div>
      ))}
    </div>
  );
}

// ✅ Virtualized - only renders visible items
function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      {items[index].name}
    </div>
  );

  return (
    <List
      height={500}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </List>
  );
}

// ✅ With react-window and dynamic heights
import { VariableSizeList } from 'react-window';

function DynamicHeightList({ items }) {
  const getItemSize = (index) => items[index].expanded ? 150 : 50;

  return (
    <VariableSizeList
      height={500}
      itemCount={items.length}
      itemSize={getItemSize}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <ExpandingItem item={items[index]} />
        </div>
      )}
    </VariableSizeList>
  );
}
```

---

## 5. JSX Best Practices

### 5.1 Using Proper Keys in Lists

Keys help React identify which items have changed, been added, or removed.

**Bad Practice:**
```jsx
// ❌ Using array index as key (causes issues with reordering)
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>{todo.text}</li>
      ))}
    </ul>
  );
}

// ❌ Using non-unique values
function UserList({ users }) {
  return (
    <ul>
      {users.map(user => (
        <li key={user.name}>{user.name}</li> // Names might not be unique
      ))}
    </ul>
  );
}

// ❌ Using random values
function ItemList({ items }) {
  return (
    <ul>
      {items.map(item => (
        <li key={Math.random()}>{item.name}</li> // New key every render!
      ))}
    </ul>
  );
}
```

**Best Practice:**
```jsx
// ✅ Using unique, stable IDs
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}

// ✅ Generating stable IDs if not available
function ItemList({ items }) {
  // Use a ref to maintain stable IDs across renders
  const idMap = useRef(new Map()).current;
  
  const getId = (item) => {
    if (!idMap.has(item)) {
      idMap.set(item, generateUniqueId());
    }
    return idMap.get(item);
  };

  return (
    <ul>
      {items.map(item => (
        <li key={getId(item)}>{item.name}</li>
      ))}
    </ul>
  );
}

// ✅ Using composite keys when necessary
function NestedList({ categories }) {
  return (
    <div>
      {categories.map(category => (
        <div key={category.id}>
          <h3>{category.name}</h3>
          <ul>
            {category.items.map(item => (
              <li key={`${category.id}-${item.id}`}>{item.name}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

### 5.2 Conditional Rendering Patterns

Choose the right pattern for different scenarios.

```jsx
// ✅ Simple ternary for binary conditions
function Greeting({ isLoggedIn }) {
  return (
    <div>
      {isLoggedIn ? <UserGreeting /> : <GuestGreeting />}
    </div>
  );
}

// ✅ Logical AND for simple show/hide
function Notification({ message }) {
  return (
    <div>
      {message && <Alert>{message}</Alert>}
    </div>
  );
}

// ⚠️ Caution with falsy values
function ItemCount({ count }) {
  // ❌ Shows "0" when count is 0
  return <div>{count && <span>{count} items</span>}</div>;
  
  // ✅ Proper handling
  return <div>{count > 0 && <span>{count} items</span>}</div>;
  // Or
  return <div>{count ? <span>{count} items</span> : null}</div>;
}

// ✅ Early returns for complex conditions
function Dashboard({ user, loading, error }) {
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (!user) return <LoginPrompt />;

  return (
    <div className="dashboard">
      <UserProfile user={user} />
      <DashboardWidgets user={user} />
    </div>
  );
}

// ✅ IIFE for complex logic
function ComplexComponent({ data, type }) {
  return (
    <div>
      {(() => {
        switch (type) {
          case 'chart':
            return <Chart data={data} />;
          case 'table':
            return <Table data={data} />;
          case 'list':
            return <List data={data} />;
          default:
            return <DefaultView data={data} />;
        }
      })()}
    </div>
  );
}
```

### 5.3 Fragment Usage

Use fragments to group elements without adding extra DOM nodes.

```jsx
// ❌ Unnecessary wrapper div
function TableRow({ cells }) {
  return (
    <div> {/* Extra DOM node */}
      {cells.map(cell => (
        <td key={cell.id}>{cell.value}</td>
      ))}
    </div>
  );
}

// ✅ Using Fragment
import { Fragment } from 'react';

function TableRow({ cells }) {
  return (
    <Fragment>
      {cells.map(cell => (
        <td key={cell.id}>{cell.value}</td>
      ))}
    </Fragment>
  );
}

// ✅ Short syntax (no key support)
function ListItems({ items }) {
  return (
    <>
      <li>Item 1</li>
      <li>Item 2</li>
    </>
  );
}

// ✅ Fragment with key
function Glossary({ items }) {
  return (
    <dl>
      {items.map(item => (
        <Fragment key={item.id}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
```

---

## 6. Type Safety

### 6.1 Using PropTypes

Validate props at runtime in development.

```jsx
import PropTypes from 'prop-types';

function UserCard({ user, onEdit, isAdmin, config }) {
  return (
    <div className="user-card">
      <h3>{user.name}</h3>
      {isAdmin && <button onClick={onEdit}>Edit</button>}
    </div>
  );
}

UserCard.propTypes = {
  // Required props
  user: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string,
    avatar: PropTypes.string
  }).isRequired,
  
  // Optional props with defaults
  onEdit: PropTypes.func,
  isAdmin: PropTypes.bool,
  
  // Complex types
  config: PropTypes.exact({
    theme: PropTypes.oneOf(['light', 'dark']),
    showAvatar: PropTypes.bool,
    maxLength: PropTypes.number
  }),
  
  // Arrays
  tags: PropTypes.arrayOf(PropTypes.string),
  
  // Custom validator
  customProp: function(props, propName, componentName) {
    if (!/matchme/.test(props[propName])) {
      return new Error(
        'Invalid prop `' + propName + '` supplied to' +
        ' `' + componentName + '`. Validation failed.'
      );
    }
  }
};

UserCard.defaultProps = {
  onEdit: () => {},
  isAdmin: false,
  config: { theme: 'light', showAvatar: true }
};
```

### 6.2 Using TypeScript

TypeScript provides compile-time type checking.

```tsx
// Type definitions
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'user' | 'guest';
}

interface UserCardProps {
  user: User;
  onEdit?: (user: User) => void;
  isAdmin?: boolean;
  config?: {
    theme: 'light' | 'dark';
    showAvatar: boolean;
  };
}

// Component with typed props
function UserCard({ 
  user, 
  onEdit, 
  isAdmin = false, 
  config = { theme: 'light', showAvatar: true } 
}: UserCardProps) {
  return (
    <div className={`user-card theme-${config.theme}`}>
      {config.showAvatar && user.avatar && (
        <img src={user.avatar} alt={user.name} />
      )}
      <h3>{user.name}</h3>
      {isAdmin && onEdit && (
        <button onClick={() => onEdit(user)}>Edit</button>
      )}
    </div>
  );
}

// Generic component
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}

// Usage with type inference
<List 
  items={users}
  renderItem={user => <UserCard user={user} />}
  keyExtractor={user => user.id}
/>

// Typed hooks
function useUser(userId: string): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(user => {
      setUser(user);
      setLoading(false);
    });
  }, [userId]);

  return { user, loading };
}

// Typed events
function SearchInput({ onSearch }: { onSearch: (query: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearch(e.currentTarget.value);
    }
  };

  return <input onChange={handleChange} onKeyDown={handleKeyDown} />;
}
```

---

## 7. Error Handling

### 7.1 Error Boundaries

Catch JavaScript errors anywhere in the child component tree.

```jsx
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Send to monitoring service
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary fallback={<PageError />}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={
            <ErrorBoundary fallback={<DashboardError />}>
              <Dashboard />
            </ErrorBoundary>
          } />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

// Granular error boundaries
function UserProfileSection({ userId }) {
  return (
    <div className="user-profile">
      <ErrorBoundary fallback={<AvatarError />}>
        <UserAvatar userId={userId} />
      </ErrorBoundary>
      
      <ErrorBoundary fallback={<InfoError />}>
        <UserInfo userId={userId} />
      </ErrorBoundary>
      
      <ErrorBoundary fallback={<ActivityError />}>
        <UserActivity userId={userId} />
      </ErrorBoundary>
    </div>
  );
}
```

### 7.2 Graceful Error Handling

Handle errors gracefully without crashing the UI.

```jsx
// Async error handling
function UserData({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/users/${userId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const userData = await response.json();
        
        if (!cancelled) {
          setData(userData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay message={error} retry={() => setLoading(true)} />;
  
  return <UserDetails data={data} />;
}

// Form error handling
function ContactForm() {
  const [errors, setErrors] = useState({});
  
  const validate = (values) => {
    const newErrors = {};
    
    if (!values.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!values.message || values.message.length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }
    
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formErrors = validate(formData);
    
    if (Object.keys(formErrors).length === 0) {
      submitForm(formData);
    } else {
      setErrors(formErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input name="email" />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>
      <div>
        <textarea name="message" />
        {errors.message && <span className="error">{errors.message}</span>}
      </div>
      <button type="submit">Submit</button>
    </form>
  );
}
```

---

## 8. Bad Practices & Anti-patterns

### 8.1 useEffect Issues

#### Missing Dependency Arrays

**Bad:**
```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log(count);
  }, []); // ❌ Stale closure - count is always 0

  return <button onClick={() => setCount(c => c + 1)}>Increment</button>;
}
```

**Good:**
```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log(count);
  }, [count]); // ✅ Correct dependency

  return <button onClick={() => setCount(c => c + 1)}>Increment</button>;
}
```

#### Overly Broad Dependency Arrays

**Bad:**
```jsx
function UserList({ users }) {
  const [filteredUsers, setFilteredUsers] = useState([]);

  useEffect(() => {
    setFilteredUsers(users.filter(u => u.active));
  }, [users]); // ❌ Runs on every users change, even if not needed

  // ...
}
```

**Good:**
```jsx
function UserList({ users, filterActive }) {
  // ✅ Derive value instead of using effect
  const filteredUsers = useMemo(() => {
    return filterActive ? users.filter(u => u.active) : users;
  }, [users, filterActive]);

  // ...
}
```

#### Not Cleaning Up Subscriptions

**Bad:**
```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const ws = new WebSocket(`wss://chat.example.com/${roomId}`);
    ws.onmessage = (msg) => console.log(msg);
    // ❌ No cleanup - connection stays open!
  }, [roomId]);
}
```

**Good:**
```jsx
function ChatRoom({ roomId }) {
  useEffect(() => {
    const ws = new WebSocket(`wss://chat.example.com/${roomId}`);
    ws.onmessage = (msg) => console.log(msg);
    
    return () => {
      ws.close(); // ✅ Clean up connection
    };
  }, [roomId]);
}
```

#### Using useEffect for Things That Don't Need It

**Bad:**
```jsx
function Form() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fullName, setFullName] = useState('');

  // ❌ Unnecessary effect
  useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
  }, [firstName, lastName]);
}
```

**Good:**
```jsx
function Form() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  // ✅ Derived value - no effect needed
  const fullName = `${firstName} ${lastName}`.trim();
}
```

### 8.2 Performance Anti-patterns

#### Creating Anonymous Functions in JSX

**Bad:**
```jsx
function ItemList({ items, onItemClick }) {
  return (
    <ul>
      {items.map(item => (
        <li 
          key={item.id}
          onClick={() => onItemClick(item.id)} // ❌ New function every render
        >
          {item.name}
        </li>
      ))}
    </ul>
  );
}
```

**Good:**
```jsx
function ItemList({ items, onItemClick }) {
  // ✅ Stable callback
  const handleClick = useCallback((id) => {
    onItemClick(id);
  }, [onItemClick]);

  return (
    <ul>
      {items.map(item => (
        <ListItem 
          key={item.id}
          item={item}
          onClick={handleClick}
        />
      ))}
    </ul>
  );
}

const ListItem = React.memo(function ListItem({ item, onClick }) {
  return (
    <li onClick={() => onClick(item.id)}>
      {item.name}
    </li>
  );
});
```

#### Not Using Keys or Using Array Indices

**Bad:**
```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}> {/* ❌ Index as key - breaks on reorder */}
          <input value={todo.text} />
        </li>
      ))}
    </ul>
  );
}
```

**Good:**
```jsx
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}> {/* ✅ Stable, unique key */}
          <input value={todo.text} />
        </li>
      ))}
    </ul>
  );
}
```

#### Unnecessary Re-renders

**Bad:**
```jsx
function Parent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  const config = { theme: 'dark' }; // ❌ New object every render

  return (
    <div>
      <input value={name} onChange={e => setName(e.target.value)} />
      <ExpensiveChild config={config} /> {/* Re-renders when name changes */}
    </div>
  );
}
```

**Good:**
```jsx
function Parent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  const config = useMemo(() => ({ theme: 'dark' }), []); // ✅ Stable reference

  return (
    <div>
      <input value={name} onChange={e => setName(e.target.value)} />
      <MemoizedExpensiveChild config={config} />
    </div>
  );
}

const MemoizedExpensiveChild = React.memo(ExpensiveChild);
```

#### Over-using Context for Frequently Changing Data

**Bad:**
```jsx
// ❌ Context updates cause all consumers to re-render
const AppContext = createContext();

function AppProvider({ children }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Tracking mouse position in context - causes constant re-renders!
  useEffect(() => {
    const handler = (e) => setMousePosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return (
    <AppContext.Provider value={{ mousePosition }}>
      {children}
    </AppContext.Provider>
  );
}
```

**Good:**
```jsx
// ✅ Use refs or separate state for high-frequency updates
function useMousePosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e) => setPosition({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return position;
}

// Or use a subscription pattern
function MousePositionDisplay() {
  const position = useSyncExternalStore(
    subscribeToMousePosition,
    getMousePositionSnapshot
  );
  
  return <div>{position.x}, {position.y}</div>;
}
```

### 8.3 State Management Mistakes

#### Directly Mutating State

**Bad:**
```jsx
function TodoList() {
  const [todos, setTodos] = useState([]);

  const addTodo = (text) => {
    todos.push({ id: Date.now(), text }); // ❌ Mutating state!
    setTodos(todos);
  };

  const updateTodo = (id, newText) => {
    const todo = todos.find(t => t.id === id);
    todo.text = newText; // ❌ Direct mutation!
    setTodos(todos);
  };

  const removeTodo = (id) => {
    const index = todos.findIndex(t => t.id === id);
    todos.splice(index, 1); // ❌ Mutating array!
    setTodos(todos);
  };
}
```

**Good:**
```jsx
function TodoList() {
  const [todos, setTodos] = useState([]);

  const addTodo = (text) => {
    setTodos(prev => [...prev, { id: Date.now(), text }]); // ✅ New array
  };

  const updateTodo = (id, newText) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, text: newText } : todo // ✅ New object
    ));
  };

  const removeTodo = (id) => {
    setTodos(prev => prev.filter(todo => todo.id !== id)); // ✅ New array
  };

  // For nested updates
  const updateNested = (userId, newAddress) => {
    setUsers(prev => prev.map(user =>
      user.id === userId
        ? { 
            ...user, 
            profile: { 
              ...user.profile, 
              address: newAddress 
            } 
          }
        : user
    ));
  };

  // Or use Immer for complex mutations
  import produce from 'immer';

  const updateWithImmer = (id, updates) => {
    setTodos(prev => produce(prev, draft => {
      const todo = draft.find(t => t.id === id);
      if (todo) {
        Object.assign(todo, updates);
      }
    }));
  };
}
```

#### Storing Derived Values in State

**Bad:**
```jsx
function ShoppingCart({ items }) {
  const [total, setTotal] = useState(0);
  const [itemCount, setItemCount] = useState(0);

  useEffect(() => {
    setTotal(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
    setItemCount(items.reduce((sum, item) => sum + item.quantity, 0));
  }, [items]); // ❌ Derived values in state
}
```

**Good:**
```jsx
function ShoppingCart({ items }) {
  // ✅ Derived values computed on render
  const total = items.reduce((sum, item) => 
    sum + item.price * item.quantity, 0
  );
  
  const itemCount = items.reduce((sum, item) => 
    sum + item.quantity, 0
  );

  // Or memoize if expensive
  const { total, itemCount, discountedTotal } = useMemo(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discountedTotal = total * (itemCount > 5 ? 0.9 : 1);
    
    return { total, itemCount, discountedTotal };
  }, [items]);
}
```

#### Over-using State for Things That Should Be Props

**Bad:**
```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  // ❌ Component manages its own data when parent could provide it
}

// Parent has to wait for child to load
function Parent() {
  return <UserProfile userId="123" />; // No control over loading state
}
```

**Good:**
```jsx
// ✅ Component receives data as props
function UserProfile({ user, loading, error }) {
  if (loading) return <Spinner />;
  if (error) return <Error message={error} />;
  
  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// Parent controls data fetching
function Parent() {
  const { user, loading, error } = useUser('123');
  
  return (
    <UserProfile 
      user={user} 
      loading={loading} 
      error={error} 
    />
  );
}
```

### 8.4 Component Structure Issues

#### Monolithic Components

**Bad:**
```jsx
// 500+ lines doing everything
function Dashboard() {
  // State for 10 different things
  // 5 useEffect hooks
  // 15 helper functions
  // Complex JSX with nested conditionals
  // ...
}
```

**Good:**
```jsx
// Split into focused components
function Dashboard() {
  return (
    <DashboardLayout>
      <DashboardHeader />
      <DashboardStats />
      <DashboardCharts />
      <RecentActivity />
    </DashboardLayout>
  );
}

// Each component has a single responsibility
function DashboardStats() {
  const stats = useDashboardStats();
  return <StatsGrid stats={stats} />;
}

function RecentActivity() {
  const activities = useRecentActivity();
  return <ActivityList activities={activities} />;
}
```

#### Prop Drilling Instead of Composition

**Bad:**
```jsx
function App() {
  const [theme, setTheme] = useState('light');
  
  return (
    <Page theme={theme} setTheme={setTheme} />
  );
}

function Page({ theme, setTheme }) {
  return (
    <Header theme={theme} setTheme={setTheme} />
    <Main theme={theme} />
  );
}

function Header({ theme, setTheme }) {
  return (
    <Nav theme={theme}>
      <ThemeToggle theme={theme} setTheme={setTheme} />
    </Nav>
  );
}
// Props drilled through 4 levels!
```

**Good:**
```jsx
// Using composition
function App() {
  const [theme, setTheme] = useState('light');
  
  return (
    <Page>
      <Header>
        <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />
      </Header>
      <Main theme={theme} />
    </Page>
  );
}

// Or use Context for truly global state
const ThemeContext = createContext();

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  return <button onClick={toggleTheme}>Current: {theme}</button>;
}
```

#### Tight Coupling

**Bad:**
```jsx
// Component tightly coupled to specific API structure
function UserList() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/v2/users?include=profile,settings')
      .then(res => res.json())
      .then(data => setUsers(data.data.users)); // Tied to specific response shape
  }, []);

  return (
    <ul>
      {users.map(user => (
        <li key={user.profile.id}> {/* Assumes nested structure */}
          {user.profile.name}
        </li>
      ))}
    </ul>
  );
}
```

**Good:**
```jsx
// Abstract data fetching
function useUsers() {
  const [users, setUsers] = useState([]);
  
  useEffect(() => {
    userService.getAll().then(setUsers);
  }, []);
  
  return users;
}

// Service layer handles API details
const userService = {
  async getAll() {
    const response = await fetch('/api/v2/users?include=profile,settings');
    const data = await response.json();
    // Transform to consistent format
    return data.data.users.map(apiUser => ({
      id: apiUser.profile.id,
      name: apiUser.profile.name,
      email: apiUser.profile.email
    }));
  }
};

// Component works with clean data structure
function UserList() {
  const users = useUsers();

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### 8.5 Other Common Mistakes

#### Not Handling Component Unmounting

**Bad:**
```jsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(data => setResults(data));
    // ❌ No cleanup - state update after unmount causes warning
  }, [query]);
}
```

**Good:**
```jsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/search?q=${query}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setResults(data);
        }
      });

    return () => {
      cancelled = true; // ✅ Prevent state update after unmount
    };
  }, [query]);
}

// Or use AbortController for fetch
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/search?q=${query}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => setResults(data))
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      });

    return () => {
      controller.abort(); // ✅ Cancel in-flight request
    };
  }, [query]);
}
```

#### Ignoring Accessibility

**Bad:**
```jsx
function ClickableDiv({ onClick, children }) {
  return (
    <div onClick={onClick}> {/* ❌ Not accessible */}
      {children}
    </div>
  );
}

function ImageGallery({ images }) {
  return (
    <div>
      {images.map(img => (
        <img src={img.src} /> // ❌ No alt text
      ))}
    </div>
  );
}

function Form() {
  return (
    <div>
      <span>Email</span> {/* ❌ Not a label */}
      <input />
      <div onClick={submit}>Submit</div> {/* ❌ Not a button */}
    </div>
  );
}
```

**Good:**
```jsx
function ClickableButton({ onClick, children }) {
  return (
    <button onClick={onClick}> {/* ✅ Semantic element */}
      {children}
    </button>
  );
}

// Or make div accessible
function ClickableDiv({ onClick, children, ...props }) {
  return (
    <div 
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick(e);
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}

function ImageGallery({ images }) {
  return (
    <div role="list">
      {images.map((img, index) => (
        <img 
          key={img.id}
          src={img.src} 
          alt={img.alt || `Image ${index + 1} of ${images.length}`}
          role="listitem"
        />
      ))}
    </div>
  );
}

function Form() {
  return (
    <form>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" aria-required="true" />
      <button type="submit">Submit</button>
    </form>
  );
}
```

#### Poor Naming Conventions

**Bad:**
```jsx
// ❌ Unclear naming
function x({ d }) {
  const [v, sV] = useState('');
  const hC = () => sV(d.n);
  
  return <div onClick={hC}>{v}</div>;
}

// ❌ Inconsistent naming
function UserComponent({ userData }) {
  const [usr, setusr] = useState(null);
  const handleClk = () => {};
  const HandleSubmit = () => {};
}
```

**Good:**
```jsx
// ✅ Clear, consistent naming
function UserProfile({ user }) {
  const [displayName, setDisplayName] = useState('');
  
  const handleNameClick = useCallback(() => {
    setDisplayName(user.name);
  }, [user.name]);
  
  const handleFormSubmit = useCallback((event) => {
    event.preventDefault();
    // Submit logic
  }, []);

  return (
    <div onClick={handleNameClick}>
      {displayName}
    </div>
  );
}

// Naming conventions:
// - Components: PascalCase (UserProfile)
// - Props: camelCase (userName, onClick)
// - Hooks: camelCase starting with 'use' (useUser)
// - Event handlers: 'handle' + EventName (handleClick, handleSubmit)
// - Callback props: 'on' + EventName (onClick, onSubmit)
// - Boolean props: 'is', 'has', 'should' prefix (isLoading, hasError)
// - Arrays: plural nouns (users, items)
```

---

## Quick Reference Checklist

### Before Committing Code:

- [ ] Follow Rules of Hooks (top level only, React functions only)
- [ ] Include all dependencies in useEffect dependency arrays
- [ ] Clean up subscriptions, timers, and event listeners
- [ ] Use unique, stable keys for list items
- [ ] Don't mutate state directly
- [ ] Don't store derived values in state
- [ ] Use proper semantic HTML for accessibility
- [ ] Memoize expensive calculations with useMemo
- [ ] Use useCallback for functions passed to optimized children
- [ ] Split large components (>200 lines) into smaller ones
- [ ] Use composition over prop drilling
- [ ] Add error boundaries for error handling
- [ ] Validate props with PropTypes or TypeScript

### Performance Checklist:

- [ ] Profile before optimizing
- [ ] Use React.memo for pure components receiving stable props
- [ ] Virtualize long lists (>100 items)
- [ ] Code split with React.lazy and Suspense
- [ ] Avoid creating objects/functions in render for memoized children
- [ ] Don't over-use Context for frequently changing data
- [ ] Use production builds for performance testing

---

## Resources

- [React Official Documentation](https://react.dev/)
- [React Patterns](https://reactpatterns.com/)
- [Kent C. Dodds Blog](https://kentcdodds.com/blog)
- [React Performance Optimization](https://web.dev/optimize-react-rerenders/)
- [Accessibility in React](https://reactjs.org/docs/accessibility.html)
