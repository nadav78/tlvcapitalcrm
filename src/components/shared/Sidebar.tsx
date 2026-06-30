'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Building2,
  Users,
  Activity,
  Package,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/auth'

const navItems = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunities',  icon: Target },
  { href: '/clients',       label: 'Clients',        icon: Building2 },
  { href: '/contacts',      label: 'Contacts',       icon: Users },
  { href: '/activities',    label: 'Activities',     icon: Activity },
  { href: '/products',      label: 'Products',       icon: Package },
]

interface SidebarProps {
  role: UserRole
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 bg-card border-r border-border min-h-screen">
      <div className="h-16 flex items-center px-5 border-b border-border">
        <span className="font-semibold text-sm tracking-tight">TLV Capital</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {role === 'admin' && (
          <>
            <div className="my-2 border-t border-border" />
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/settings')
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Settings className="size-4 shrink-0" />
              Settings
            </Link>
          </>
        )}
      </nav>
    </aside>
  )
}

// Mobile bottom tab bar — shown instead of sidebar on small screens
const mobileItems = [
  { href: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunities', icon: Target },
  { href: '/contacts',      label: 'Contacts',      icon: Users },
  { href: '/activities',    label: 'Activities',    icon: Activity },
]

export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border z-50 flex">
      {mobileItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
