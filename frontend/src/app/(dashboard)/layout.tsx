"use client";

import { Sidebar } from "@/components/Layouts/Sidebar";
import { Header } from "@/components/Layouts/Header";
import { SidebarProvider } from "@/components/Layouts/sidebar-context";
import { usePathname } from "next/navigation";

const pageConfig: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": {
    title: "Dashboard",
    subtitle: "Personal Finance Management",
  },
  "/import": {
    title: "Import Transactions",
    subtitle:
      "Upload your bank statements to automatically extract transactions",
  },
  "/transactions": {
    title: "Transactions",
    subtitle: "View and manage your transactions",
  },
  "/categories": {
    title: "Categories",
    subtitle: "Organize your spending categories",
  },
  "/settings": {
    title: "Settings",
    subtitle: "Manage your account settings",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const config = pageConfig[pathname] || pageConfig["/dashboard"];

  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col overflow-hidden bg-gray-2 dark:bg-dark-bg">
          <Header title={config.title} subtitle={config.subtitle} />

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="h-full w-full px-12 py-6 md:px-16 md:py-8 2xl:px-24 2xl:py-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
