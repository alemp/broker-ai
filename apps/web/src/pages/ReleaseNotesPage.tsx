import type { Components } from 'react-markdown'
import Markdown from 'react-markdown'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/PageHeader'

import releaseNotesSource from '@/content/RELEASE_NOTES.md?raw'

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-foreground mt-0 mb-4 text-2xl font-semibold tracking-tight">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-foreground mt-10 mb-3 border-b border-border pb-2 text-xl font-semibold tracking-tight first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-foreground mt-6 mb-2 text-lg font-medium">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground mb-4 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="text-muted-foreground mb-4 list-inside list-disc space-y-2 text-sm leading-relaxed">{children}</ul>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  hr: () => <hr className="border-border my-8" />,
  blockquote: ({ children }) => (
    <blockquote className="border-muted-foreground/30 text-muted-foreground mb-4 border-l-4 pl-4 text-sm italic">
      {children}
    </blockquote>
  ),
}

export function ReleaseNotesPage() {
  const { t } = useTranslation('common')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title={t('releaseNotes.title')} description={t('releaseNotes.subtitle')} />
      <article
        className="bg-card text-card-foreground border-border mt-6 rounded-xl border p-6 shadow-sm"
        aria-label={t('releaseNotes.articleAria')}
      >
        <Markdown components={markdownComponents}>{releaseNotesSource}</Markdown>
      </article>
    </div>
  )
}
