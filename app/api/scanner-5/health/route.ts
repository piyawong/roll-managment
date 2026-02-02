import { handleHealth } from "@/lib/scannerProxy";

export async function GET() {
  return handleHealth(5);
}
