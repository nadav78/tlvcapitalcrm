'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  Users,
  Activity,
  Menu,
  Building2,
  Package,
  Settings,
  LogOut,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { signOut } from '@/app/(auth)/login/actions'
import type { UserRole } from '@/lib/types'

const BOTTOM_TABS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunities', icon: Target },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/activities', label: 'Activities', icon: Activity },
]

const ALL_NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/opportunities', label: 'Opportunities', icon: Target },
  { href: '/clients', label: 'Clients', icon: Building2 },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/activities', label: 'Activities', icon: Activity },
  { href: '/products', label: 'Products', icon: Package },
]

interface MobileNavProps {
  role: UserRole
  fullName: string
  email: string
}

export function MobileNav({ role, fullName, email }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t flex md:hidden">
        {BOTTOM_TABS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
                isActive ? 'text-neutral-900' : 'text-neutral-500'
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}

        {/* Menu button → sheet */}
        <Sheet>
          <SheetTrigger className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-neutral-500 border-0 bg-transparent">
            <Menu className="h-5 w-5" />
            More
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <div className="px-5 py-5 border-b">
              <span className="text-base font-semibold tracking-tight">TLV Capital</span>
              <p className="text-xs text-muted-foreground mt-0.5">CRM</p>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {ALL_NAV.map((item) => {
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
          </SheetContent>
        </Sheet>
      </nav>
    </>
  )
}
