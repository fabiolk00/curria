import Header from "@/components/landing/header"

interface DashboardNavbarProps {
  onMenuClick?: () => void
}

export function DashboardNavbar({ onMenuClick }: DashboardNavbarProps) {
  return <Header onMenuClick={onMenuClick} />
}
