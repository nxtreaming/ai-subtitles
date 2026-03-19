import { Suspense } from "react";
import SubStudioApp from "@/components/SubStudioApp";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <Suspense fallback={null}>
        <SubStudioApp />
      </Suspense>
    </main>
  );
}
