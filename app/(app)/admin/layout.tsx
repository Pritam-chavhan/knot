import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/features/admin/admin-nav";

export const metadata = { title: "Founder dashboard" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="px-5 pt-6">
      <p className="text-[13px] font-semibold text-muted">Only admins can see this</p>
      <h1 className="font-display mt-0.5 mb-4 text-[30px] leading-[1.05] font-extrabold">Founder dashboard</h1>
      <AdminNav />
      {children}
    </div>
  );
}
