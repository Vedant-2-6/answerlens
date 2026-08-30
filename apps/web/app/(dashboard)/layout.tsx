import { Sidebar } from "@/app/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}
