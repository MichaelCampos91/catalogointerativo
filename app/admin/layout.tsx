"use client"

import { ProtectedRoute, useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, BarChart3, History, FolderOpen } from "lucide-react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isLoginPage = pathname === "/admin/login"

  const handleLogout = async () => {
    await logout()
    router.push("/admin/login")
  }

  const isActive = (path: string) => pathname === path
  const navLinkClass = (active: boolean) =>
    `rounded-none border-b-2 ${active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground hover:border-primary"}`

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100">
        <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="flex items-center">
                <img
                  src="/logo.png"
                  alt="Logo"
                  className="h-10 w-auto object-contain"
                />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </header>

        <nav className="fixed top-[65px] left-0 right-0 z-40 bg-white border-b">
          <div className="container mx-auto px-4 pt-3">
            <div className="flex gap-4">
              <Link href="/admin">
                <Button
                  variant="ghost"
                  className={navLinkClass(isActive("/admin"))}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/admin/production-history">
                <Button
                  variant="ghost"
                  className={navLinkClass(
                    isActive("/admin/production-history")
                  )}
                >
                  <History className="h-4 w-4 mr-2" />
                  Histórico de produção
                </Button>
              </Link>
              <Link href="/admin/files">
                <Button
                  variant="ghost"
                  className={navLinkClass(isActive("/admin/files"))}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Arquivos
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        <main className="container mx-auto px-4 py-8 pt-[140px]">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
