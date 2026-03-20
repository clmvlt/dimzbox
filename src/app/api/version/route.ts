// CACHE-01: Retirer force-dynamic, ajouter Cache-Control
export function GET() {
  return new Response(
    JSON.stringify({
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
