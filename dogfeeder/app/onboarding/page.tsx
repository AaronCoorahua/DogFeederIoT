import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export default async function OnboardingPage() {
  const { supabase, user } = await getSessionUser();
  if (!user) redirect("/login");

  // Si ya tiene un perro, no repetir el onboarding.
  const { data: dogs } = await supabase
    .from("dogs")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_active", true)
    .limit(1);

  if (dogs && dogs.length > 0) redirect("/");

  return <OnboardingWizard />;
}
