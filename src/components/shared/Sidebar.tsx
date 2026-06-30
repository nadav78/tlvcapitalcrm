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
  LogOut,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/(auth)/login/actions'
import type { UserRole } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunities', icon: Target },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/products', label: 'Products', icon: Package },
]

interface SidebarProps {
  role: UserRole
  fullName: string
  email: string
}

export function Sidebar({ role, fullName, email }: SidebarProps) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === 'admin')

  return (
    <aside className="flex flex-col w-60 shrink-0 border-r bg-white h-full">
      {/* Logo / App name */}
      <div className="px-5 py-5 border-b">
        <span className="text-base font-semibold tracking-tight">TLV Capital</span>
        <p className="text-xs text-muted-foreground mt-0.5">CRM</p>
      </div>

      {/* Primary nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}

        {role === 'admin' && (
          <>
            <Separator className="my-2" />
            <Link
              href="/settings"
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname.startsWith('/settings')
                  ? 'bg-neutral-100 text-neutral-900'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
              )}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Settings
            </Link>
          </>
        )}
      </nav>

      {/* User section */}
      <div className="px-3 pb-4 border-t pt-3">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-medium text-neutral-900 truncate">{fullName}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
