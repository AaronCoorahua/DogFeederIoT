import { RegisterForm } from "@/components/register-form";

// El middleware ya redirige a "/" si hay sesion.
export default function RegisterPage() {
  return <RegisterForm />;
}
