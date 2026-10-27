import type { Metadata } from "next";
import HomePage from "@/components/home/home-page";

export const metadata: Metadata = {
  title: "Arcade Vault — El arcade clásico está de vuelta",
  description:
    "Juega los mejores clásicos en tu navegador, sin descargas y sin costo, y compite por el puntaje más alto.",
};

export default function Home() {
  return <HomePage />;
}
