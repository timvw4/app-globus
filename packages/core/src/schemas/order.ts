import { z } from 'zod';
import {
  accessTypeSchema,
  INSURANCE_THRESHOLD_CHF,
  PICKUP_OTHER_VALUE,
} from '../types/enums';
import type { OperatingHoursSettings } from '../types';
import { isSunday } from '../business/operatingHours';
import { isValidTimeSlot } from '../business/timeSlots';
import { isWithinCutoff } from '../business/cutoff';
import { isValidPhoneNumber } from '../business/phone';
import type { CutoffSettings } from '../types';

/**
 * Schéma d'UN colis.
 * Chaque commande contient désormais une liste de colis (au moins un).
 * La description et le poids sont obligatoires ; le reste est facultatif.
 */
export const packageItemSchema = z.object({
  // Numéro du sac / colis (identifiant physique) — facultatif
  bag_number: z.string().optional(),
  // Contenu du colis — obligatoire
  description: z.string().min(1, 'order.validation.packageDescriptionRequired'),
  // Poids en kg — obligatoire et strictement positif
  weight: z
    .coerce
    .number({ invalid_type_error: 'order.validation.packageWeightRequired' })
    .positive('order.validation.packageWeightRequired'),
  // Dimensions (texte libre, ex: 30×20×15 cm) — facultatif
  dimensions: z.string().optional(),
  // Caractéristiques — facultatives
  fragile: z.boolean().default(false),
  perishable: z.boolean().default(false),
  declared_value_chf: z.coerce.number().nonnegative().optional().or(z.literal('')),
  extra_insurance: z.boolean().default(false),
  goods_photo_url: z.string().optional(),
});

export type PackageItemData = z.infer<typeof packageItemSchema>;

/** Schéma de base pour une commande (formulaire) */
export const orderFormSchema = z
  .object({
    // Départ
    pickup_location_id: z.string().min(1, 'order.validation.pickupRequired'),
    pickup_address_custom: z.string().optional(),

    // Destination
    delivery_address: z.string().min(1, 'order.validation.deliveryRequired'),
    access_type: accessTypeSchema,
    access_detail: z.string().optional(),
    is_hotel: z.boolean().default(false),
    hotel_room_number: z.string().optional(),

    // Obligatoire — destinataire & logistique
    floor: z.string().min(1, 'order.validation.floorRequired'),
    client_name: z.string().min(1, 'order.validation.clientNameRequired'),
    client_phone: z.string().min(1, 'order.validation.clientPhoneRequired'),
    // Obligatoire — date & créneau
    requested_date: z.string().min(1, 'order.validation.dateRequired'),
    requested_time_slot: z.string().min(1, 'order.validation.timeSlotRequired'),
    // Facultatif
    leave_at_door: z.boolean().default(false),
    special_instructions: z.string().optional(),

    // Obligatoire — au moins un colis
    packages: z.array(packageItemSchema).min(1, 'order.validation.packagesRequired'),

    // Tarif (peut être ajusté manuellement)
    price_chf: z.coerce.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    // Lieu « Autres » → adresse de départ obligatoire
    if (data.pickup_location_id === PICKUP_OTHER_VALUE) {
      if (!data.pickup_address_custom?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'order.validation.customPickupRequired',
          path: ['pickup_address_custom'],
        });
      }
    }

    // Détail d'accès obligatoire sauf accès libre
    if (data.access_type !== 'acces_libre' && !data.access_detail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'order.validation.accessDetailRequired',
        path: ['access_detail'],
      });
    }

    // Hôtel → numéro de chambre obligatoire
    if (data.is_hotel && !data.hotel_room_number?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'order.validation.hotelRoomRequired',
        path: ['hotel_room_number'],
      });
    }

    // Téléphone du destinataire : si renseigné, vérifier le nombre de chiffres
    if (data.client_phone?.trim() && !isValidPhoneNumber(data.client_phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'order.validation.invalidPhone',
        path: ['client_phone'],
      });
    }

    // Assurance complémentaire recommandée si la valeur d'un colis dépasse le seuil
    data.packages.forEach((pkg, index) => {
      const declaredValue =
        typeof pkg.declared_value_chf === 'number' ? pkg.declared_value_chf : null;
      if (declaredValue != null && declaredValue > INSURANCE_THRESHOLD_CHF && !pkg.extra_insurance) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'order.validation.extraInsuranceRecommended',
          path: ['packages', index, 'extra_insurance'],
        });
      }
    });
  });

export type OrderFormData = z.infer<typeof orderFormSchema>;

/** Contexte de validation pour date/créneau */
export interface OrderValidationContext {
  operatingHours: OperatingHoursSettings;
  cutoffs: CutoffSettings;
  now?: Date;
}

/** Schéma complet avec validation date/créneau */
export function createOrderFormSchemaWithContext(ctx: OrderValidationContext) {
  return orderFormSchema.superRefine((data, zodCtx) => {
    if (data.requested_date) {
      const date = new Date(data.requested_date + 'T12:00:00');

      if (isSunday(date)) {
        zodCtx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'order.validation.sundayClosed',
          path: ['requested_date'],
        });
      }

      const now = ctx.now ?? new Date();
      if (!isWithinCutoff(now, date, ctx.cutoffs)) {
        zodCtx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'order.validation.cutoffExceeded',
          path: ['requested_date'],
        });
      }

      if (data.requested_time_slot) {
        if (!isValidTimeSlot(date, data.requested_time_slot, ctx.operatingHours)) {
          zodCtx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'order.validation.invalidTimeSlot',
            path: ['requested_time_slot'],
          });
        }
      }
    }
  });
}

/** Schéma pour la création en base */
export const orderInsertSchema = z.object({
  pickup_location_id: z.string().uuid().nullable(),
  pickup_address_custom: z.string().nullable(),
  delivery_address: z.string().min(1),
  access_type: accessTypeSchema,
  access_detail: z.string().nullable(),
  is_hotel: z.boolean(),
  hotel_room_number: z.string().nullable(),
  floor: z.string().nullable(),
  client_name: z.string().nullable(),
  client_phone: z.string().nullable(),
  requested_date: z.string().nullable(),
  requested_time_slot: z.string().nullable(),
  leave_at_door: z.boolean(),
  special_instructions: z.string().nullable(),
  packages: z.array(packageItemSchema),
  price_chf: z.number().nullable(),
  created_by: z.string().uuid(),
});

export type OrderInsertData = z.infer<typeof orderInsertSchema>;
