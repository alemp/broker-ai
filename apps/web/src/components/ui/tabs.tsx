import * as React from 'react'
import { Tabs } from 'radix-ui'

import { cn } from '@/lib/utils'

function TabsRoot({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.Root>) {
  return <Tabs.Root className={cn('w-full', className)} {...props} />
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.List>) {
  return (
    <Tabs.List
      className={cn(
        'bg-muted/40 text-muted-foreground inline-flex h-auto min-h-10 w-full flex-wrap gap-1 rounded-xl border border-border/80 p-1.5',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.Trigger>) {
  return (
    <Tabs.Trigger
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all outline-none',
        'hover:text-foreground',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        'disabled:pointer-events-none disabled:opacity-50',
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.Content>) {
  return (
    <Tabs.Content
      className={cn(
        'ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export { TabsRoot, TabsList, TabsTrigger, TabsContent }
