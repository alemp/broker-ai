import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'

export function LoginPage() {
  const { t } = useTranslation('common')
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        {t('auth.loading')}
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.error.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="from-muted/40 flex min-h-svh items-center justify-center bg-gradient-to-b via-background to-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('auth.login.title')}</CardTitle>
          <CardDescription>{t('auth.login.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.field.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.field.password')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t('auth.login.submitting') : t('auth.login.submit')}
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              <Link className="text-primary underline-offset-4 hover:underline" to="/register">
                {t('auth.login.registerCta')}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
