import { z } from "zod";

export const serviceVenueTypeSchema = z.enum(["room", "bay", "event_space", "equipment", "other"]);

export const serviceVenueCreateSchema = z.object({
  name: z.string().trim().min(1, "請填寫場地名稱"),
  venueType: serviceVenueTypeSchema.optional().default("room"),
  capacity: z.union([z.number().int().positive(), z.null()]).optional(),
  locationNote: z.string().trim().optional().nullable(),
});

export const serviceVenuePatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  venueType: serviceVenueTypeSchema.optional(),
  capacity: z.union([z.number().int().positive(), z.null()]).optional(),
  locationNote: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const serviceResourceBookingCreateSchema = z
  .object({
    title: z.string().trim().min(1, "請填寫預約標題"),
    customerServiceCaseId: z.string().uuid().optional().nullable(),
    staffUserId: z.string().uuid().optional().nullable(),
    venueId: z.string().uuid().optional().nullable(),
    startsAt: z.string().min(1, "請選擇開始時間"),
    endsAt: z.string().min(1, "請選擇結束時間"),
    purchaseNote: z.string().trim().optional().nullable(),
    estimatedCostMinor: z.union([z.number().int().nonnegative(), z.null()]).optional(),
    notes: z.string().trim().optional().nullable(),
  })
  .refine((v) => v.staffUserId != null || v.venueId != null, {
    message: "請至少指定負責員工或場地其中一項",
    path: ["staffUserId"],
  });

export type ServiceVenueCreateInput = z.infer<typeof serviceVenueCreateSchema>;
export type ServiceVenuePatchInput = z.infer<typeof serviceVenuePatchSchema>;
export type ServiceResourceBookingCreateInput = z.infer<typeof serviceResourceBookingCreateSchema>;
