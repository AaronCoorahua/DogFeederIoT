import { LoginForm } from "@/components/login-form";

// El middleware ya redirige a "/" si hay sesion.
export default function LoginPage() {
  return <LoginForm />;
}
