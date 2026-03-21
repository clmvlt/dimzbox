import { getAdminUser } from "@/lib/admin";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin/admin-panel";

export const metadata = {
  title: "Admin — DimzBox",
};

export default async function AdminPage() {
  const admin = await getAdminUser();

  if (!admin) {
    redirect("/");
  }

  return <AdminPanel />;
}
