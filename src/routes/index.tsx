import { createFileRoute } from "@tanstack/react-router";
import { GameCanvas } from "../components/GameCanvas";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Zone Royale — Solo Battle Royale vs Bots" },
      { name: "description", content: "Solo battle royale across a dense, layered night city with 99 bots, moving trains, vehicles, and a shrinking storm." },
      { property: "og:title", content: "Zone Royale — Solo Battle Royale" },
      { property: "og:description", content: "Fight 99 bots across a dense, layered night city. Last one standing wins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameCanvas,
});
