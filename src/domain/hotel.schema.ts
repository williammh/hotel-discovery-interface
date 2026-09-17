import { z } from "zod"

/** The seed is hand-authored with known defects, so it's validated at the boundary. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected an ISO date (YYYY-MM-DD)")

export const addressSchema = z.object({
  street: z.string(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip_code: z.string(),
  country: z.string().min(1),
})

export const contactSchema = z.object({
  phone: z.string(),
  email: z.string(),
})

export const policiesSchema = z.object({
  check_in_time: z.string(),
  check_out_time: z.string(),
  cancellation: z.string(),
})

export const roomSchema = z.object({
  room_id: z.string().min(1),
  type: z.string().min(1),
  bed_type: z.string(),
  bed_count: z.number().int().nonnegative(),
  max_occupancy: z.number().int().positive(),
  square_footage: z.number().nonnegative(),
  price_per_night: z.number().nonnegative(),
  room_amenities: z.array(z.string()),
  /** The nights this room can be booked. An empty array means fully booked. */
  available_dates: z.array(isoDate),
})

export const hotelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  star_rating: z.number().int().min(1).max(5),
  overall_rating: z.number().min(0).max(5),
  review_count: z.number().int().nonnegative(),
  address: addressSchema,
  contact: contactSchema,
  amenities: z.array(z.string()),
  policies: policiesSchema,
  rooms: z.array(roomSchema),
})

export type RawHotel = z.infer<typeof hotelSchema>
export type RawRoom = z.infer<typeof roomSchema>
export type Address = z.infer<typeof addressSchema>
