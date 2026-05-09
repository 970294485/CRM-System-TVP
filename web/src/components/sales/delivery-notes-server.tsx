import { auth } from "@/auth";
import { DeliveryNotesWorkspace } from "@/components/sales/delivery-notes-workspace";

export async function DeliveryNotesServer() {
  await auth();
  return <DeliveryNotesWorkspace />;
}
