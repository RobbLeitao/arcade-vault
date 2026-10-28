import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function AccessPage({ searchParams }: PageProps<"/acceso">) {
  return (
    <Suspense fallback={<AuthForm />}>
      <AccessWithError searchParams={searchParams} />
    </Suspense>
  );
}

// /auth/callback redirige aquí con ?error=oauth si el intercambio falla.
async function AccessWithError({
  searchParams,
}: {
  searchParams: PageProps<"/acceso">["searchParams"];
}) {
  const { error } = await searchParams;
  return <AuthForm callbackError={error === "oauth"} />;
}
