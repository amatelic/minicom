# TanStack Query (React Query) - Best Practices & Anti-patterns

> **Version**: v5.x | **Library**: `@tanstack/react-query`

## Table of Contents

1. [Introduction](#introduction)
2. [Query Keys](#query-keys)
3. [Query Functions](#query-functions)
4. [Caching Strategy](#caching-strategy)
5. [Data Synchronization](#data-synchronization)
6. [Mutations](#mutations)
7. [Pagination & Infinite Queries](#pagination--infinite-queries)
8. [SSR & Next.js Integration](#ssr--nextjs-integration)
9. [DevTools Usage](#devtools-usage)
10. [Common Anti-patterns](#common-anti-patterns)
11. [Performance Optimization](#performance-optimization)
12. [Error Handling](#error-handling)

---

## Introduction

TanStack Query (formerly React Query) is a powerful data-fetching and state management library for React applications. It handles caching, background updates, and stale data out of the box.

### Core Concepts

- **Query**: A declarative dependency on an asynchronous source of data
- **Mutation**: Functions to modify server-side data
- **Query Client**: The core engine that manages caching and fetching
- **Query Key**: A unique identifier for cached data

---

## Query Keys

### Best Practices

#### 1. Use Descriptive, Hierarchical Query Keys

Query keys should be arrays that represent the data hierarchy. This enables automatic grouping and invalidation.

**Good:**
```typescript
// Hierarchical structure enables targeted invalidation
const { data: user } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});

const { data: posts } = useQuery({
  queryKey: ['user', userId, 'posts'],
  queryFn: () => fetchUserPosts(userId),
});

const { data: comments } = useQuery({
  queryKey: ['user', userId, 'posts', postId, 'comments'],
  queryFn: () => fetchComments(userId, postId),
});
```

**Bad:**
```typescript
// Flat keys lose hierarchy benefits
const { data: user } = useQuery({
  queryKey: ['user'],
  queryFn: () => fetchUser(userId),
});

const { data: posts } = useQuery({
  queryKey: ['posts'],
  queryFn: () => fetchUserPosts(userId),
});
```

#### 2. Include All Dependencies in Query Keys

Every variable that affects the query result must be in the query key.

**Good:**
```typescript
const { data } = useQuery({
  queryKey: ['todos', { status, page, limit, search }],
  queryFn: () => fetchTodos({ status, page, limit, search }),
});

// Or with explicit array items
const { data } = useQuery({
  queryKey: ['todos', status, page, limit, search],
  queryFn: () => fetchTodos({ status, page, limit, search }),
});
```

**Bad:**
```typescript
// Missing dependencies cause stale data
const { data } = useQuery({
  queryKey: ['todos'],
  queryFn: () => fetchTodos({ status, page, limit, search }),
});
// When status/page changes, query won't refetch!
```

#### 3. Use Query Key Factories for Consistency

Create a centralized factory to ensure consistency across your application.

**Good:**
```typescript
// queryKeys.ts
export const queryKeys = {
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  posts: {
    all: ['posts'] as const,
    lists: () => [...queryKeys.posts.all, 'list'] as const,
    list: (filters: PostFilters) => [...queryKeys.posts.lists(), filters] as const,
    details: () => [...queryKeys.posts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.posts.details(), id] as const,
    comments: (postId: string) => [...queryKeys.posts.detail(postId), 'comments'] as const,
  },
};

// Usage
const { data: user } = useQuery({
  queryKey: queryKeys.users.detail(userId),
  queryFn: () => fetchUser(userId),
});

// Invalidation becomes easy and safe
queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(postId) });
```

**Bad:**
```typescript
// String keys scattered throughout the codebase
const { data: user } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});

// Somewhere else, slightly different key
const { data: user } = useQuery({
  queryKey: ['users', userId], // Different! Creates separate cache entry
  queryFn: () => fetchUser(userId),
});
```

#### 4. Dynamic Query Keys for Parameterized Queries

When dealing with dynamic parameters, always include them in the key.

**Good:**
```typescript
function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
    enabled: !!userId, // Prevent fetching with empty id
  });
}

function useUserPosts(userId: string, filters: PostFilters) {
  return useQuery({
    queryKey: ['user', userId, 'posts', filters],
    queryFn: () => fetchUserPosts(userId, filters),
    enabled: !!userId,
  });
}
```

---

## Query Functions

### Best Practices

#### 1. Keep Query Functions Pure

Query functions should only fetch data, not perform side effects.

**Good:**
```typescript
const fetchUser = async (userId: string): Promise<User> => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};

const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});
```

**Bad:**
```typescript
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: async () => {
    // Side effects in query function!
    analytics.track('user_fetch_started');
    
    const response = await api.get(`/users/${userId}`);
    
    // More side effects!
    localStorage.setItem('lastUserId', userId);
    
    return response.data;
  },
});
```

#### 2. Proper Error Handling in Query Functions

Throw errors properly so TanStack Query can catch and handle them.

**Good:**
```typescript
const fetchUser = async (userId: string): Promise<User> => {
  const response = await fetch(`/api/users/${userId}`);
  
  if (!response.ok) {
    // Throw with meaningful error
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Failed to fetch user: ${response.status}`);
  }
  
  return response.json();
};

// Component handles error state
const { data, error, isError } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});

if (isError) {
  return <ErrorMessage message={error.message} />;
}
```

**Bad:**
```typescript
const fetchUser = async (userId: string): Promise<User | null> => {
  try {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  } catch (error) {
    // Silently returning null - query appears successful!
    return null;
  }
};
```

#### 3. Using Axios/Fetch Correctly

**With Axios:**
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptors for auth tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const fetchUser = async (userId: string): Promise<User> => {
  const { data } = await api.get(`/users/${userId}`);
  return data;
};
```

**With Fetch:**
```typescript
const fetchUser = async (userId: string): Promise<User> => {
  const token = localStorage.getItem('token');
  
  const response = await fetch(`/api/users/${userId}`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
};
```

---

## Caching Strategy

### Understanding staleTime vs cacheTime (v5: gcTime)

| Property | Description | Default |
|----------|-------------|---------|
| `staleTime` | How long data remains "fresh" before background refetch | `0` (always stale) |
| `gcTime` (v5) / `cacheTime` (v4) | How long inactive data stays in cache before garbage collection | `5 minutes` |

```
Timeline:
┌─────────────────────────────────────────────────────────────┐
│  Fetch  │  Fresh (staleTime)  │  Stale  │  Inactive  │ GC  │
│    ↓    │         ↓           │    ↓    │     ↓      │  ↓  │
│  Data   │   No refetch on     │ Background│  Kept    │     │
│ loaded  │   mount/focus       │ refetch │  in cache  │Removed│
└─────────────────────────────────────────────────────────────┘
```

### Best Practices

#### 1. Configure Appropriate Cache Durations

**Good:**
```typescript
// Global configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes
    },
  },
});

// Per-query configuration
const { data: user } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  staleTime: 1000 * 60 * 5, // User data stays fresh for 5 minutes
});

// Reference data that rarely changes
const { data: countries } = useQuery({
  queryKey: ['countries'],
  queryFn: fetchCountries,
  staleTime: 1000 * 60 * 60 * 24, // 24 hours
});

// Real-time data that needs frequent updates
const { data: stockPrice } = useQuery({
  queryKey: ['stock', symbol],
  queryFn: () => fetchStockPrice(symbol),
  staleTime: 0, // Always fetch fresh data
  refetchInterval: 5000, // Poll every 5 seconds
});
```

#### 2. Using placeholderData and initialData

**initialData**: Data to start with (treated as fresh)
**placeholderData**: Data to show while loading (marked as placeholder)

**Good:**
```typescript
// Using initialData for instant rendering with cached data
const { data: user } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  initialData: () => {
    // Get from another query's cache
    return queryClient.getQueryData(['users'])?.find(u => u.id === userId);
  },
  staleTime: 1000 * 60 * 5,
});

// Using placeholderData for better UX
const { data: posts, isPlaceholderData } = useQuery({
  queryKey: ['posts', page],
  queryFn: () => fetchPosts(page),
  placeholderData: (previousData) => previousData, // Keep previous page while loading
});

// Show placeholder state visually
return (
  <div className={isPlaceholderData ? 'opacity-50' : ''}>
    <PostList posts={posts} />
  </div>
);
```

**Bad:**
```typescript
// Using initialData when you should use placeholderData
const { data: posts } = useQuery({
  queryKey: ['posts', page],
  queryFn: () => fetchPosts(page),
  initialData: previousPosts, // This is treated as FRESH data!
});
// User won't see new data until staleTime passes
```

---

## Data Synchronization

### Best Practices

#### 1. Background Refetching

Configure when queries should refetch in the background.

**Good:**
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetch when window regains focus
      refetchOnWindowFocus: true,
      // Refetch when network reconnects
      refetchOnReconnect: true,
      // Don't refetch on mount if data is fresh
      refetchOnMount: 'always', // or false, or 'always'
    },
  },
});

// Per-query override
const { data } = useQuery({
  queryKey: ['dashboard'],
  queryFn: fetchDashboard,
  refetchOnWindowFocus: false, // Dashboard doesn't need to refetch on focus
});
```

#### 2. Polling Strategies

**Good:**
```typescript
// Simple polling
const { data } = useQuery({
  queryKey: ['notifications'],
  queryFn: fetchNotifications,
  refetchInterval: 30000, // Poll every 30 seconds
});

// Conditional polling
const { data } = useQuery({
  queryKey: ['live-match', matchId],
  queryFn: () => fetchMatchStatus(matchId),
  refetchInterval: (data) => {
    // Stop polling when match ends
    return data?.status === 'finished' ? false : 5000;
  },
});

// Polling with pause on hidden tab
const { data } = useQuery({
  queryKey: ['live-data'],
  queryFn: fetchLiveData,
  refetchInterval: 5000,
  refetchIntervalInBackground: false, // Pause when tab is hidden
});
```

#### 3. Real-time Updates with WebSockets

**Good:**
```typescript
function useRealtimePosts() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const socket = io('/posts');
    
    socket.on('post:created', (newPost) => {
      // Update cache with new post
      queryClient.setQueryData(['posts'], (old: Post[] = []) => {
        return [newPost, ...old];
      });
    });
    
    socket.on('post:updated', (updatedPost) => {
      queryClient.setQueryData(['posts'], (old: Post[] = []) => {
        return old.map(post => 
          post.id === updatedPost.id ? updatedPost : post
        );
      });
      
      // Also update individual post cache
      queryClient.setQueryData(
        ['post', updatedPost.id], 
        updatedPost
      );
    });
    
    socket.on('post:deleted', (deletedId) => {
      queryClient.setQueryData(['posts'], (old: Post[] = []) => {
        return old.filter(post => post.id !== deletedId);
      });
    });
    
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
  
  return useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });
}
```

---

## Mutations

### Best Practices

#### 1. Using onSuccess/onError Callbacks

**Good:**
```typescript
const createPostMutation = useMutation({
  mutationFn: createPost,
  
  onSuccess: (data, variables, context) => {
    // Show success notification
    toast.success('Post created successfully!');
    
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    
    // Navigate to new post
    router.push(`/posts/${data.id}`);
  },
  
  onError: (error, variables, context) => {
    // Show error notification
    toast.error(error.message || 'Failed to create post');
    
    // Rollback optimistic update if needed
    if (context?.previousPosts) {
      queryClient.setQueryData(['posts'], context.previousPosts);
    }
  },
  
  onSettled: (data, error, variables, context) => {
    // Always runs after success or error
    // Good for cleanup
  },
});

// Usage
const handleSubmit = (values) => {
  createPostMutation.mutate(values);
};
```

#### 2. Optimistic Updates

**Good:**
```typescript
const updatePostMutation = useMutation({
  mutationFn: ({ id, data }) => updatePost(id, data),
  
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['post', variables.id] });
    
    // Snapshot previous value
    const previousPost = queryClient.getQueryData(['post', variables.id]);
    
    // Optimistically update
    queryClient.setQueryData(['post', variables.id], (old) => ({
      ...old,
      ...variables.data,
    }));
    
    // Return context for rollback
    return { previousPost };
  },
  
  onError: (error, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(
      ['post', variables.id], 
      context?.previousPost
    );
  },
  
  onSettled: (data, error, variables) => {
    // Always refetch after error or success
    queryClient.invalidateQueries({ queryKey: ['post', variables.id] });
  },
});
```

#### 3. Query Invalidation After Mutations

**Good:**
```typescript
const deletePostMutation = useMutation({
  mutationFn: deletePost,
  
  onSuccess: (_, deletedId) => {
    // Remove from cache immediately
    queryClient.removeQueries({ queryKey: ['post', deletedId] });
    
    // Invalidate lists that might contain this post
    queryClient.invalidateQueries({ 
      queryKey: ['posts'],
      exact: false, // Invalidate all post lists
    });
    
    // Invalidate related data
    queryClient.invalidateQueries({ queryKey: ['user', 'posts'] });
  },
});
```

#### 4. Handling Loading/Error States

**Good:**
```typescript
function CreatePostForm() {
  const mutation = useMutation({
    mutationFn: createPost,
  });
  
  return (
    <form onSubmit={handleSubmit}>
      <input 
        name="title" 
        disabled={mutation.isPending}
      />
      
      <button 
        type="submit"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Creating...' : 'Create Post'}
      </button>
      
      {mutation.isError && (
        <ErrorMessage message={mutation.error.message} />
      )}
    </form>
  );
}
```

---

## Pagination & Infinite Queries

### Best Practices

#### 1. Using useInfiniteQuery Correctly

**Good:**
```typescript
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  status,
} = useInfiniteQuery({
  queryKey: ['posts', 'infinite'],
  queryFn: fetchPostsPage,
  initialPageParam: 1,
  getNextPageParam: (lastPage, allPages) => {
    // Return next page number or undefined if no more pages
    return lastPage.hasMore ? allPages.length + 1 : undefined;
  },
  getPreviousPageParam: (firstPage, allPages) => {
    // For bidirectional infinite scroll
    return firstPage.hasPrevious ? allPages.length - 1 : undefined;
  },
});

// Flatten pages for rendering
const posts = data?.pages.flatMap(page => page.posts) ?? [];

return (
  <div>
    {posts.map(post => <PostCard key={post.id} post={post} />)}
    
    <button
      onClick={() => fetchNextPage()}
      disabled={!hasNextPage || isFetchingNextPage}
    >
      {isFetchingNextPage
        ? 'Loading more...'
        : hasNextPage
        ? 'Load More'
        : 'No more posts'}
    </button>
  </div>
);
```

**Bad:**
```typescript
// Don't use regular useQuery for infinite scroll
const { data, refetch } = useQuery({
  queryKey: ['posts', page],
  queryFn: () => fetchPosts(page),
});

// Manual page management is error-prone
const handleLoadMore = () => {
  setPage(p => p + 1);
  refetch();
};
```

#### 2. Proper Cursor/Page Handling

**Good:**
```typescript
// Cursor-based pagination (recommended)
const infiniteQuery = useInfiniteQuery({
  queryKey: ['posts', 'cursor'],
  queryFn: async ({ pageParam }) => {
    const response = await fetch(`/api/posts?cursor=${pageParam || ''}`);
    return response.json();
  },
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});

// Offset-based pagination
const infiniteQuery = useInfiniteQuery({
  queryKey: ['posts', 'offset'],
  queryFn: async ({ pageParam = 0 }) => {
    const response = await fetch(`/api/posts?offset=${pageParam}&limit=10`);
    return response.json();
  },
  initialPageParam: 0,
  getNextPageParam: (lastPage, pages) => {
    const totalFetched = pages.length * 10;
    return totalFetched < lastPage.total ? totalFetched : undefined;
  },
});
```

---

## SSR & Next.js Integration

### Best Practices

#### 1. Hydration Considerations

**Good:**
```typescript
// app/providers.tsx (Next.js 13+ App Router)
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

#### 2. Prefetching on Server

**Good:**
```typescript
// app/page.tsx (Next.js 13+ App Router)
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { Posts } from './Posts';

export default async function PostsPage() {
  const queryClient = new QueryClient();

  // Prefetch on server
  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Posts />
    </HydrationBoundary>
  );
}

// app/Posts.tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export function Posts() {
  // This will use the prefetched data
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  return <PostList posts={data} />;
}
```

**With Pages Router:**
```typescript
// pages/posts.tsx
import { dehydrate, QueryClient, useQuery } from '@tanstack/react-query';

export async function getServerSideProps() {
  const queryClient = new QueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
  };
}

export default function PostsPage() {
  const { data } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  return <PostList posts={data} />;
}
```

---

## DevTools Usage

### Best Practices

#### 1. Debugging with React Query DevTools

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools 
        initialIsOpen={false}
        position="bottom"
        toggleButtonProps={{ style: { left: 20 } }}
      />
    </QueryClientProvider>
  );
}
```

#### 2. Understanding DevTools Information

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green dot | Fresh data (within staleTime) |
| 🟡 Yellow dot | Stale data (needs refetch) |
| 🔴 Red dot | Inactive query (will be garbage collected) |
| ⏳ Loading spinner | Query is fetching |
| 🔄 Refresh icon | Background refetch in progress |

---

## Common Anti-patterns

### 1. Query Key Issues

#### Hardcoding Query Keys

**Bad:**
```typescript
// Hardcoded strings are error-prone
const { data } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
});

// Somewhere else
queryClient.invalidateQueries({ queryKey: ['users'] }); // Won't match!
```

**Good:**
```typescript
// Use query key factory
const { data } = useQuery({
  queryKey: queryKeys.users.detail(userId),
  queryFn: () => fetchUser(userId),
});

queryClient.invalidateQueries({ 
  queryKey: queryKeys.users.detail(userId) 
});
```

#### Not Including All Dependencies

**Bad:**
```typescript
const [filter, setFilter] = useState('active');

const { data } = useQuery({
  queryKey: ['todos'], // Missing filter dependency!
  queryFn: () => fetchTodos({ filter }),
});

// When filter changes, query won't refetch
```

**Good:**
```typescript
const { data } = useQuery({
  queryKey: ['todos', filter], // Include all dependencies
  queryFn: () => fetchTodos({ filter }),
});
```

#### Using Same Key for Different Data

**Bad:**
```typescript
// Same key, different data structures
const { data: user } = useQuery({
  queryKey: ['data', id],
  queryFn: () => fetchUser(id),
});

const { data: post } = useQuery({
  queryKey: ['data', id], // Same key as above!
  queryFn: () => fetchPost(id),
});
```

**Good:**
```typescript
const { data: user } = useQuery({
  queryKey: ['user', id],
  queryFn: () => fetchUser(id),
});

const { data: post } = useQuery({
  queryKey: ['post', id],
  queryFn: () => fetchPost(id),
});
```

### 2. Incorrect Usage Patterns

#### Using TanStack Query for Local/Client State

**Bad:**
```typescript
// Don't use TanStack Query for local UI state
const { data: isOpen, mutate: setIsOpen } = useMutation({
  mutationFn: async (value: boolean) => value,
});

// Don't use it for form state
const { data: formValues } = useQuery({
  queryKey: ['form'],
  queryFn: () => ({ name: '', email: '' }),
});
```

**Good:**
```typescript
// Use useState for local state
const [isOpen, setIsOpen] = useState(false);

// Use form libraries for form state
const form = useForm({ defaultValues: { name: '', email: '' } });
```

#### Mapping Fetched Data to Redux/Context

**Bad:**
```typescript
// Don't duplicate state in Redux
const { data } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
});

useEffect(() => {
  if (data) {
    dispatch(setUser(data)); // Unnecessary!
  }
}, [data, dispatch]);
```

**Good:**
```typescript
// Use TanStack Query as your server state manager
const { data: user } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
});

// Access user directly from the query
return <div>Hello, {user?.name}</div>;
```

#### Using refetch When You Should Use a New Query Key

**Bad:**
```typescript
const [userId, setUserId] = useState('1');

const { data, refetch } = useQuery({
  queryKey: ['user'],
  queryFn: () => fetchUser(userId),
});

// Wrong: Manual refetch when userId changes
useEffect(() => {
  refetch();
}, [userId, refetch]);
```

**Good:**
```typescript
const [userId, setUserId] = useState('1');

// Correct: Include userId in query key
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});
// Automatically refetches when userId changes
```

### 3. Missing Provider Setup

**Bad:**
```typescript
// Forgetting QueryClientProvider
function App() {
  return <YourApp />; // Queries will fail!
}
```

**Good:**
```typescript
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

### 4. Performance Mistakes

#### Not Using select for Data Transformation

**Bad:**
```typescript
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});

// Transforming in component causes re-renders
const activeUsers = data?.filter(u => u.isActive) ?? [];
```

**Good:**
```typescript
const { data: activeUsers } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  select: (data) => data.filter(u => u.isActive),
});
// Component only re-renders when activeUsers actually changes
```

#### Unnecessary Refetching

**Bad:**
```typescript
// Default staleTime is 0 - refetches on every mount!
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
});
```

**Good:**
```typescript
const { data } = useQuery({
  queryKey: ['user', userId],
  queryFn: () => fetchUser(userId),
  staleTime: 1000 * 60 * 5, // 5 minutes
});
```

#### Race Conditions from Improper Query Dependencies

**Bad:**
```typescript
const [search, setSearch] = useState('');

const { data } = useQuery({
  queryKey: ['search'],
  queryFn: async () => {
    // Race condition: search might change during fetch
    const results = await searchAPI(search);
    return results;
  },
});
```

**Good:**
```typescript
const [search, setSearch] = useState('');

const { data } = useQuery({
  queryKey: ['search', search], // Include in key for automatic cancellation
  queryFn: async ({ queryKey }) => {
    const [, searchTerm] = queryKey;
    const results = await searchAPI(searchTerm);
    return results;
  },
});
// Outdated requests are automatically cancelled
```

### 5. Error Handling Issues

#### Not Handling Error States

**Bad:**
```typescript
const { data } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
});

// No error handling - UI breaks on error
return <div>Hello, {data.name}</div>;
```

**Good:**
```typescript
const { data, isLoading, isError, error } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
});

if (isLoading) return <Loading />;
if (isError) return <ErrorMessage message={error.message} />;

return <div>Hello, {data.name}</div>;
```

#### Silent Failures

**Bad:**
```typescript
const mutation = useMutation({
  mutationFn: updateUser,
  onError: (error) => {
    // Silent - user doesn't know something went wrong
    console.error(error);
  },
});
```

**Good:**
```typescript
const mutation = useMutation({
  mutationFn: updateUser,
  onError: (error) => {
    toast.error(error.message || 'Failed to update user');
  },
});
```

### 6. Mutation Anti-patterns

#### Not Invalidating Queries After Mutations

**Bad:**
```typescript
const createPostMutation = useMutation({
  mutationFn: createPost,
  onSuccess: () => {
    // Forgot to invalidate - list won't update!
    toast.success('Post created!');
  },
});
```

**Good:**
```typescript
const createPostMutation = useMutation({
  mutationFn: createPost,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    toast.success('Post created!');
  },
});
```

#### Manual Cache Updates When Invalidation Would Work

**Bad:**
```typescript
const deletePostMutation = useMutation({
  mutationFn: deletePost,
  onSuccess: (_, deletedId) => {
    // Overly complex manual update
    queryClient.setQueryData(['posts'], (old) => 
      old?.filter(p => p.id !== deletedId)
    );
    queryClient.setQueryData(['user', 'posts'], (old) => 
      old?.filter(p => p.id !== deletedId)
    );
    // What about other lists? Easy to miss something!
  },
});
```

**Good:**
```typescript
const deletePostMutation = useMutation({
  mutationFn: deletePost,
  onSuccess: () => {
    // Simple invalidation - handles all cases
    queryClient.invalidateQueries({ 
      queryKey: ['posts'],
      exact: false,
    });
  },
});
```

---

## Performance Optimization

### 1. Use select for Derived Data

```typescript
// Only re-render when selected data changes
const { data: totalAmount } = useQuery({
  queryKey: ['cart'],
  queryFn: fetchCart,
  select: (cart) => cart.items.reduce((sum, item) => sum + item.price, 0),
});
```

### 2. Structural Sharing

TanStack Query uses structural sharing by default to prevent unnecessary re-renders.

```typescript
const { data } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
  structuralSharing: true, // Default
});
```

### 3. KeepPreviousData (placeholderData)

```typescript
const { data, isPlaceholderData } = useQuery({
  queryKey: ['posts', page],
  queryFn: () => fetchPosts(page),
  placeholderData: (previousData) => previousData,
});
```

### 4. Query Deduplication

Multiple components with the same query key share the same request:

```typescript
// Component A
const { data: userA } = useQuery({
  queryKey: ['user', '1'],
  queryFn: () => fetchUser('1'),
});

// Component B (simultaneously)
const { data: userB } = useQuery({
  queryKey: ['user', '1'],
  queryFn: () => fetchUser('1'), // Same request, single network call!
});
```

---

## Error Handling

### Global Error Handling

```typescript
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Global error handler
      if (query.meta?.errorMessage) {
        toast.error(query.meta.errorMessage);
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, variables, context, mutation) => {
      // Global mutation error handler
      toast.error(error.message);
    },
  }),
});

// Usage with meta
const { data } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
  meta: {
    errorMessage: 'Failed to load user profile',
  },
});
```

### Retry Configuration

```typescript
const { data } = useQuery({
  queryKey: ['user'],
  queryFn: fetchUser,
  retry: (failureCount, error) => {
    // Don't retry on 404
    if (error.status === 404) return false;
    // Retry up to 3 times
    return failureCount < 3;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
});
```

---

## Quick Reference

### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `staleTime` | Time before data becomes stale | `0` |
| `gcTime` | Time before inactive cache is garbage collected | `5 min` |
| `refetchOnWindowFocus` | Refetch when window regains focus | `true` |
| `refetchOnMount` | Refetch when component mounts | `true` |
| `refetchOnReconnect` | Refetch when network reconnects | `true` |
| `retry` | Number of retry attempts | `3` |
| `retryDelay` | Delay between retries | Exponential |
| `enabled` | Enable/disable the query | `true` |
| `select` | Transform data | - |
| `initialData` | Initial data (treated as fresh) | - |
| `placeholderData` | Placeholder while loading | - |

### Query Client Methods

```typescript
// Fetch and cache
await queryClient.fetchQuery({ queryKey, queryFn });

// Prefetch (don't return data)
await queryClient.prefetchQuery({ queryKey, queryFn });

// Get cached data
const data = queryClient.getQueryData(queryKey);

// Set cached data
queryClient.setQueryData(queryKey, newData);
queryClient.setQueryData(queryKey, (old) => ({ ...old, updated: true }));

// Invalidate (mark stale and refetch)
queryClient.invalidateQueries({ queryKey });
queryClient.invalidateQueries({ queryKey, exact: true });
queryClient.invalidateQueries({ queryKey, refetchType: 'all' });

// Remove from cache
queryClient.removeQueries({ queryKey });

// Cancel ongoing requests
queryClient.cancelQueries({ queryKey });

// Reset to initial state
queryClient.resetQueries({ queryKey });

// Clear entire cache
queryClient.clear();
```

---

## Summary Checklist

### Do's

- [ ] Use hierarchical query keys
- [ ] Include all dependencies in query keys
- [ ] Use query key factories for consistency
- [ ] Keep query functions pure
- [ ] Configure appropriate staleTime
- [ ] Use `select` for data transformation
- [ ] Handle loading and error states
- [ ] Invalidate queries after mutations
- [ ] Use optimistic updates for better UX
- [ ] Use `useInfiniteQuery` for pagination

### Don'ts

- [ ] Don't hardcode query keys
- [ ] Don't use TanStack Query for local state
- [ ] Don't duplicate state in Redux/Context
- [ ] Don't forget QueryClientProvider
- [ ] Don't use `refetch` when a new key would work
- [ ] Don't ignore error states
- [ ] Don't manually update cache when invalidation works
- [ ] Don't leave default staleTime for all queries

---

## Resources

- [Official Documentation](https://tanstack.com/query/latest)
- [React Query Devtools](https://tanstack.com/query/latest/docs/react/devtools)
- [Query Key Factory Pattern](https://tkdodo.eu/blog/effective-react-query-keys)
- [Performance Tips](https://tanstack.com/query/latest/docs/react/guides/important-defaults)
