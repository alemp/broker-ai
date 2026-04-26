import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'

type UpdateMeResponse = {
  user: {
    id: string
    email: string
    full_name: string | null
  }
}

export function ProfilePage() {
  const { t } = useTranslation('common')
  const { user, refreshUser } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = useMemo(() => {
    if (!user) {
      return false
    }
    if (password || passwordConfirm) {
      return password.length >= 8 && password === passwordConfirm
    }
    const normalized = fullName.trim()
    const current = (user.full_name ?? '').trim()
    return normalized !== current
  }, [fullName, password, passwordConfirm, user])

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!user) {
      return
    }
    setError(null)
    if (password || passwordConfirm) {
      if (password.length < 8) {
        setError(t('profile.error.passwordTooShort'))
        return
      }
      if (password !== passwordConfirm) {
        setError(t('profile.error.passwordMismatch'))
        return
      }
    }
    setSaving(true)
    try {
      await apiFetch<UpdateMeResponse>('/v1/me', {
        method: 'PATCH',
        json: {
          full_name: fullName.trim() || null,
          password: password ? password : null,
        },
      })
      setPassword('')
      setPasswordConfirm('')
      await refreshUser()
      toast.success(t('toast.saved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.error.generic'))
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="profile-email">{t('profile.field.email')}</Label>
              <Input id="profile-email" value={user.email} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-full-name">{t('profile.field.fullName')}</Label>
              <Input
                id="profile-full-name"
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                placeholder={t('profile.field.fullNamePlaceholder')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-password">{t('profile.field.password')}</Label>
                <Input
                  id="profile-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder={t('profile.field.passwordPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-password-confirm">{t('profile.field.passwordConfirm')}</Label>
                <Input
                  id="profile-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(ev) => setPasswordConfirm(ev.target.value)}
                  placeholder={t('profile.field.passwordConfirmPlaceholder')}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!canSubmit || saving}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : null}
                {saving ? t('profile.save.saving') : t('profile.save.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

