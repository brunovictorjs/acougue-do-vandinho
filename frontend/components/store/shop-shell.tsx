import { BottomNav } from "./bottom-nav"
import { StoreHeader } from "./store-header"

/** Customer pages: sticky header + mobile tab bar. */
export function ShopShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreHeader />
      <div className="pb-20 md:pb-0">{children}</div>
      <BottomNav />
    </>
  )
}

/** Inner page title row used under the header. */
export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl md:text-4xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
