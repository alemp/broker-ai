import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'

import { CrmListCardHeader } from '@/components/CrmListCardHeader'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FormSelect } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { usePersistedListViewMode } from '@/hooks/usePersistedListViewMode'
import { apiFetch } from '@/lib/api'

type UserRole = 'ADMIN' | 'SALES_MANAGER' | 'BROKER'

type OrgUser = {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  active: boolean
  created_at: string
}

type CreatedResponse = {
  user: OrgUser
  temporary_password: string | null
}

const LIST_VIEW_STORAGE_KEY = 'ai-copilot:list-view:users'

export function UsersPage() {
  const { t } = useTranslation('common')
  const { user } = useAuth()
  const [rows, setRows] = useState<OrgUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [listSearch, setListSearch] = useState('')
  const debouncedListSearch = useDebouncedValue(listSearch, 350)
  const [viewMode, setViewMode] = usePersistedListViewMode(LIST_VIEW_STORAGE_KEY)

  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('BROKER')
  const [newActive, setNewActive] = useState(true)
  const [creating, setCreating] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const canManageUsers = user?.role === 'ADMIN'

  const roleOptions = useMemo(
    () => [
      { value: 'ADMIN', label: t('users.role.admin') },
      { value: 'SALES_MANAGER', label: t('users.role.salesManager') },
      { value: 'BROKER', label: t('users.role.broker') },
    ],
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<OrgUser[]>('/v1/org/admin/users')
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (canManageUsers) {
      void load()
    }
  }, [canManageUsers, load])

  const onCreate = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!newEmail.trim()) {
      return
    }
    setCreating(true)
    setError(null)
    setTempPassword(null)
    try {
      const res = await apiFetch<CreatedResponse>('/v1/org/admin/users', {
        method: 'POST',
        json: {
          email: newEmail.trim(),
          full_name: newName.trim() || null,
          role: newRole,
          active: newActive,
        },
      })
      setTempPassword(res.temporary_password)
      setNewEmail('')
      setNewName('')
      setNewRole('BROKER')
      setNewActive(true)
      toast.success(t('users.toast.created'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setCreating(false)
    }
  }

  const onToggleActive = async (row: OrgUser) => {
    setError(null)
    try {
      await apiFetch<OrgUser>(`/v1/org/admin/users/${row.id}`, {
        method: 'PATCH',
        json: { active: !row.active },
      })
      toast.success(t('users.toast.updated'))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    }
  }

  const onResetPassword = async (row: OrgUser) => {
    setError(null)
    setTempPassword(null)
    try {
      const res = await apiFetch<CreatedResponse>(`/v1/org/admin/users/${row.id}/reset-password`, {
        method: 'POST',
        json: {},
      })
      setTempPassword(res.temporary_password)
      toast.success(t('users.toast.reset'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    }
  }

  if (!canManageUsers) {
    return <Navigate to="/" replace />
  }

  const filteredRows = rows.filter((r) => {
    const q = debouncedListSearch.trim().toLowerCase()
    if (!q) {
      return true
    }
    const name = (r.full_name ?? '').toLowerCase()
    const email = r.email.toLowerCase()
    return name.includes(q) || email.includes(q)
  })

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <PageHeader title={t('users.title')} description={t('users.subtitle')} />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('users.create.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={onCreate}>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="new-email">{t('users.field.email')}</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(ev) => setNewEmail(ev.target.value)}
                required
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="new-name">{t('users.field.fullNameOptional')}</Label>
              <Input id="new-name" value={newName} onChange={(ev) => setNewName(ev.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-role">{t('users.field.role')}</Label>
              <FormSelect
                id="new-role"
                value={newRole}
                onValueChange={(v) => setNewRole(v as UserRole)}
                options={roleOptions}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-active">{t('users.field.status')}</Label>
              <FormSelect
                id="new-active"
                value={newActive ? 'active' : 'inactive'}
                onValueChange={(v) => setNewActive(v === 'active')}
                options={[
                  { value: 'active', label: t('users.status.active') },
                  { value: 'inactive', label: t('users.status.inactive') },
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={creating || !newEmail.trim()}>
                {creating ? t('users.create.creating') : t('users.create.submit')}
              </Button>
            </div>
          </form>
          {tempPassword ? (
            <div className="mt-4 rounded-md border p-3 text-sm">
              <p className="font-medium">{t('users.tempPassword.title')}</p>
              <p className="text-muted-foreground mt-1 text-xs">{t('users.tempPassword.hint')}</p>
              <p className="mt-2 font-mono break-all">{tempPassword}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CrmListCardHeader
          listTitle={t('users.list.title')}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={load}
          loading={loading}
          searchId="users-list-search"
          searchValue={listSearch}
          onSearchChange={setListSearch}
          searchPlaceholder={t('users.listSearch')}
          searchAriaLabel={t('users.listSearchAria')}
        />
        <CardContent>
          {loading ? (
            viewMode === 'table' ? (
              <div className="space-y-2" aria-busy="true" aria-label={t('auth.loading')}>
                <div className="flex gap-2 border-b px-3 py-2">
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="ml-auto h-3 w-24" />
                </div>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-2 border-b px-3 py-3 last:border-0">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="ml-auto h-8 w-36" />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                aria-busy="true"
                aria-label={t('auth.loading')}
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="border-border/80 flex flex-col gap-3 rounded-xl border p-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex justify-end border-t border-border/60 pt-3">
                      <Skeleton className="h-8 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('users.list.empty')}</p>
          ) : viewMode === 'table' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.table.email')}</TableHead>
                  <TableHead>{t('users.table.name')}</TableHead>
                  <TableHead>{t('users.table.role')}</TableHead>
                  <TableHead>{t('users.table.status')}</TableHead>
                  <TableHead className="w-[1%] whitespace-nowrap text-right">{t('users.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.email}</TableCell>
                    <TableCell className="text-muted-foreground">{r.full_name ?? '—'}</TableCell>
                    <TableCell>{roleOptions.find((o) => o.value === r.role)?.label ?? r.role}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.active ? t('users.status.active') : t('users.status.inactive')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => void onToggleActive(r)}>
                          {r.active ? t('users.action.deactivate') : t('users.action.activate')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void onResetPassword(r)}>
                          {t('users.action.resetPassword')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <ul className="grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRows.map((r) => (
                <li key={r.id}>
                  <Card className="border-border/80 h-full shadow-sm transition-shadow hover:shadow-md">
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-foreground line-clamp-2 text-base font-semibold">{r.email}</p>
                        <dl className="text-muted-foreground space-y-1 text-sm">
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">{t('users.table.name')}</dt>
                            <dd className="min-w-0 break-words">{r.full_name ?? '—'}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">{t('users.table.role')}</dt>
                            <dd>{roleOptions.find((o) => o.value === r.role)?.label ?? r.role}</dd>
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                            <dt className="text-foreground/80 font-medium">{t('users.table.status')}</dt>
                            <dd>{r.active ? t('users.status.active') : t('users.status.inactive')}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                        <Button type="button" variant="outline" size="sm" onClick={() => void onToggleActive(r)}>
                          {r.active ? t('users.action.deactivate') : t('users.action.activate')}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => void onResetPassword(r)}>
                          {t('users.action.resetPassword')}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

