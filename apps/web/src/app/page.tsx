import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Oodel Score</h1>
      <p>Scaffold in progress — see /api/health for the Mongo connectivity check.</p>
      <p>
        <Link href="/login">Log in</Link>
      </p>
    </main>
  );
}
