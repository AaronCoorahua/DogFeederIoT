import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { AjustesView } from "@/components/ajustes-view";

export default async function AjustesPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login");

  const { data: dogs } = await supabase
    .from("dogs")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .limit(1);

  if (!dogs || dogs.length === 0) redirect("/onboarding");

  return <AjustesView />;
}
