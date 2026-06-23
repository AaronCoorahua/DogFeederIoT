import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Dashboard } from "@/components/dashboard";

// Control de sesion en server component (corre en Node, no Edge).
export default async function Page() {
  const cookieStore = await cookies();
  if (cookieStore.get("df_auth")?.value !== "1") {
    redirect("/login");
  }
  return <Dashboard />;
}
