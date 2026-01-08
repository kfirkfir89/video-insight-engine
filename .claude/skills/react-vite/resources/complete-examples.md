# Complete Examples

Full working code examples showing all patterns together.

---

## Table of Contents

- [Complete Feature Component](#complete-feature-component)
- [Complete Custom Hook](#complete-custom-hook)
- [Complete Page with Data Fetching](#complete-page-with-data-fetching)
- [Complete Form with Validation](#complete-form-with-validation)
- [Refactoring: Bad to Good](#refactoring-bad-to-good)
- [End-to-End Feature](#end-to-end-feature)

---

## Complete Feature Component

```tsx
// src/features/users/components/UserCard.tsx
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { User } from '../types';
import { Avatar } from '@/components/Avatar';
import { Badge } from '@/components/Badge';
import { cn } from '@/lib/utils';

interface UserCardProps {
  user: User;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  className?: string;
}

export const UserCard = memo(function UserCard({
  user,
  onSelect,
  isSelected = false,
  className,
}: UserCardProps) {
  return (
    <article
      className={cn(
        'rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
        isSelected && 'ring-2 ring-blue-500',
        onSelect && 'cursor-pointer',
        className
      )}
      onClick={() => onSelect?.(user.id)}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={(e) => {
        if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect(user.id);
        }
      }}
    >
      <div className="flex items-center gap-4">
        <Avatar src={user.avatar} alt={user.name} size="lg" />
        
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">
            <Link
              to={`/users/${user.id}`}
              className="hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {user.name}
            </Link>
          </h3>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
        </div>

        <div className="flex gap-2">
          {user.roles.map((role) => (
            <Badge key={role} variant={role === 'admin' ? 'primary' : 'secondary'}>
              {role}
            </Badge>
          ))}
        </div>
      </div>
    </article>
  );
});
```

---

## Complete Custom Hook

```tsx
// src/features/users/hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users.api';
import { User, CreateUserData, UpdateUserData, UsersFilter } from '../types';

// Query keys factory
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: UsersFilter) => [...userKeys.lists(), filters] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
};

// Fetch users list
export function useUsers(filters: UsersFilter = {}) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: () => usersApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch single user
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => usersApi.getById(id),
    enabled: !!id,
  });
}

// Create user mutation
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserData) => usersApi.create(data),
    onSuccess: (newUser) => {
      // Invalidate lists to refetch
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      
      // Optionally set the new user in cache
      queryClient.setQueryData(userKeys.detail(newUser.id), newUser);
    },
  });
}

// Update user mutation
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserData }) =>
      usersApi.update(id, data),
    onSuccess: (updatedUser) => {
      // Update cache directly
      queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}

// Delete user mutation
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: userKeys.detail(deletedId) });
      
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
}
```

---

## Complete Page with Data Fetching

```tsx
// src/features/users/pages/UsersPage.tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUsers } from '../hooks/useUsers';
import { UserCard } from '../components/UserCard';
import { UserFilters } from '../components/UserFilters';
import { Pagination } from '@/components/Pagination';
import { Spinner } from '@/components/Spinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { EmptyState } from '@/components/EmptyState';

export function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Read filters from URL
  const filters = {
    search: searchParams.get('search') ?? '',
    role: searchParams.get('role') ?? 'all',
    page: Number(searchParams.get('page')) || 1,
    limit: 20,
  };

  const { data, isLoading, error, refetch } = useUsers(filters);

  // Update URL params
  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      if (value) {
        prev.set(key, value);
      } else {
        prev.delete(key);
      }
      if (key !== 'page') prev.set('page', '1');
      return prev;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage
        title="Failed to load users"
        message={error.message}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>
        {selectedIds.size > 0 && (
          <span className="text-sm text-gray-500">
            {selectedIds.size} selected
          </span>
        )}
      </div>

      <UserFilters
        search={filters.search}
        role={filters.role}
        onSearchChange={(v) => updateFilter('search', v)}
        onRoleChange={(v) => updateFilter('role', v)}
      />

      {data?.users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Try adjusting your filters"
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data?.users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                onSelect={toggleSelect}
                isSelected={selectedIds.has(user.id)}
              />
            ))}
          </div>

          <Pagination
            page={filters.page}
            totalPages={data?.totalPages ?? 1}
            onPageChange={(p) => updateFilter('page', String(p))}
          />
        </>
      )}
    </div>
  );
}
```

---

## Complete Form with Validation

```tsx
// src/features/users/components/UserForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User } from '../types';
import { FormInput } from '@/components/FormInput';
import { FormSelect } from '@/components/FormSelect';
import { Button } from '@/components/Button';

const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['user', 'admin', 'moderator']),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  user?: User;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
}

export function UserForm({ user, onSubmit, onCancel }: UserFormProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: user ?? {
      name: '',
      email: '',
      role: 'user',
      bio: '',
    },
  });

  const handleFormSubmit = async (data: UserFormData) => {
    try {
      await onSubmit(data);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_EXISTS') {
        setError('email', { message: 'This email is already registered' });
      } else {
        setError('root', { message: 'Something went wrong. Please try again.' });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {errors.root && (
        <div className="rounded-md bg-red-50 p-4 text-red-700">
          {errors.root.message}
        </div>
      )}

      <FormInput
        id="name"
        label="Name"
        error={errors.name?.message}
        {...register('name')}
      />

      <FormInput
        id="email"
        label="Email"
        type="email"
        error={errors.email?.message}
        {...register('email')}
      />

      <FormSelect
        id="role"
        label="Role"
        error={errors.role?.message}
        {...register('role')}
      >
        <option value="user">User</option>
        <option value="moderator">Moderator</option>
        <option value="admin">Admin</option>
      </FormSelect>

      <FormInput
        id="bio"
        label="Bio (optional)"
        as="textarea"
        rows={4}
        error={errors.bio?.message}
        {...register('bio')}
      />

      <div className="flex justify-end gap-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? 'Saving...' : user ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}
```

---

## Refactoring: Bad to Good

### Before (God Component)

```tsx
// ❌ BAD: Everything in one component
function UserDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });

  useEffect(() => {
    setLoading(true);
    fetch('/api/users')
      .then((res) => res.json())
      .then(setUsers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
    const newUser = await res.json();
    setUsers([...users, newUser]);
    setIsModalOpen(false);
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error!</div>;

  return (
    <div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} />
      <button onClick={() => setIsModalOpen(true)}>Add User</button>

      {filteredUsers.map((user) => (
        <div key={user.id} onClick={() => setSelectedUser(user)}>
          {user.name}
        </div>
      ))}

      {isModalOpen && (
        <div className="modal">
          <form onSubmit={handleSubmit}>
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <button type="submit">Save</button>
          </form>
        </div>
      )}
    </div>
  );
}
```

### After (Properly Separated)

```tsx
// ✅ GOOD: Separated concerns

// Hook for data
function useUsers() {
  return useQuery({ queryKey: ['users'], queryFn: usersApi.getAll });
}

// Hook for filtering
function useFilteredUsers(users: User[], search: string) {
  return useMemo(
    () => users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  );
}

// Page component - composition only
function UserDashboard() {
  const [search, setSearch] = useState('');
  const { value: isModalOpen, setTrue: openModal, setFalse: closeModal } = useToggle();
  
  const { data: users = [], isLoading, error } = useUsers();
  const filteredUsers = useFilteredUsers(users, search);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <SearchInput value={search} onChange={setSearch} />
        <Button onClick={openModal}>Add User</Button>
      </div>

      <UserList users={filteredUsers} />

      <CreateUserModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
}

// Presentational component
function UserList({ users }: { users: User[] }) {
  if (users.length === 0) return <EmptyState />;

  return (
    <div className="grid gap-4">
      {users.map((user) => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  );
}

// Modal with form
function CreateUserModal({ isOpen, onClose }: ModalProps) {
  const createUser = useCreateUser();

  const handleSubmit = async (data: CreateUserData) => {
    await createUser.mutateAsync(data);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create User">
      <UserForm onSubmit={handleSubmit} onCancel={onClose} />
    </Modal>
  );
}
```

---

## End-to-End Feature

Complete file structure for a "Users" feature:

```
src/features/users/
├── api/
│   └── users.api.ts        # API calls
├── components/
│   ├── UserCard.tsx        # User display card
│   ├── UserForm.tsx        # Create/edit form
│   ├── UserFilters.tsx     # Search/filter controls
│   └── UserList.tsx        # List container
├── hooks/
│   └── useUsers.ts         # React Query hooks
├── pages/
│   ├── UsersPage.tsx       # List page
│   └── UserDetailPage.tsx  # Detail page
├── types/
│   └── index.ts            # TypeScript types
└── index.ts                # Public exports
```

### Public Exports

```tsx
// src/features/users/index.ts
export { UsersPage } from './pages/UsersPage';
export { UserDetailPage } from './pages/UserDetailPage';
export { UserCard } from './components/UserCard';
export { useUsers, useUser } from './hooks/useUsers';
export type { User, CreateUserData } from './types';
```

---

## Summary

| Layer | Responsibility | Example |
|-------|----------------|---------|
| Pages | Composition, layout | `UsersPage.tsx` |
| Components | UI rendering | `UserCard.tsx` |
| Hooks | Data & logic | `useUsers.ts` |
| API | Network calls | `users.api.ts` |
| Types | Type definitions | `types/index.ts` |

Each layer knows only about layers below it. Pages compose components, components use hooks, hooks call API.
