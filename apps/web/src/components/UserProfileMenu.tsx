import { Check, ChevronDown, LogOut, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DropdownMenu } from 'radix-ui'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

const contentClass = cn(
  'bg-popover text-popover-foreground z-50 min-w-[14rem] overflow-hidden rounded-md border p-1 shadow-md',
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
)

const itemClass = cn(
  'focus:bg-accent focus:text-accent-foreground relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none',
  'data-disabled:pointer-events-none data-disabled:opacity-50',
)

const radioItemClass = cn(itemClass, 'pl-8')

const labelClass = 'text-muted-foreground px-2 py-1.5 text-xs font-medium'

export function UserProfileMenu() {
  const { t } = useTranslation('common')
  const { user, logout } = useAuth()
  const { preference, setPreference } = useTheme()

  if (!user) {
    return null
  }

  const onThemeChange = (value: string) => {
    if (value === 'system' || value === 'light' || value === 'dark') {
      setPreference(value)
    }
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="max-w-full gap-1.5"
          aria-label={t('layout.profileMenuAria')}
        >
          <User className="size-4 shrink-0" aria-hidden />
          <span className="hidden max-w-[10rem] truncate sm:inline">{user.email}</span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-70" aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={contentClass}
          sideOffset={6}
          align="end"
          collisionPadding={12}
        >
          <DropdownMenu.Label className={cn(labelClass, 'text-foreground font-normal')}>
            {user.email}
          </DropdownMenu.Label>
          <DropdownMenu.Label className={labelClass}>{t('theme.appearance')}</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={preference} onValueChange={onThemeChange}>
            <DropdownMenu.RadioItem value="system" className={radioItemClass}>
              <span className="absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4" aria-hidden />
                </DropdownMenu.ItemIndicator>
              </span>
              {t('theme.system')}
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="light" className={radioItemClass}>
              <span className="absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4" aria-hidden />
                </DropdownMenu.ItemIndicator>
              </span>
              {t('theme.light')}
            </DropdownMenu.RadioItem>
            <DropdownMenu.RadioItem value="dark" className={radioItemClass}>
              <span className="absolute left-2 flex size-3.5 items-center justify-center">
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4" aria-hidden />
                </DropdownMenu.ItemIndicator>
              </span>
              {t('theme.dark')}
            </DropdownMenu.RadioItem>
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item
            className={cn(itemClass, 'text-destructive focus:bg-destructive/10 focus:text-destructive pl-8')}
            onSelect={() => logout()}
          >
            <span className="absolute left-2 flex size-3.5 items-center justify-center">
              <LogOut className="size-4" aria-hidden />
            </span>
            {t('auth.logout')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
