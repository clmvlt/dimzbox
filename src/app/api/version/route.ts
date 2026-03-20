export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0",
  });
}
