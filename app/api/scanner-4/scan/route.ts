import { handleScan } from "@/lib/scannerProxy";

export async function POST() {
  return handleScan(4);
}
