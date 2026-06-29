import type { AccessType, Department, OrderStatus, UserRole } from './enums';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  department: Department;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PickupLocation {
  id: string;
  label: string;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/** Un colis appartenant à une commande (stocké dans la colonne JSON `packages`) */
export interface PackageItem {
  bag_number?: string | null;
  description: string;
  weight: number;
  dimensions?: string | null;
  fragile?: boolean;
  perishable?: boolean;
  declared_value_chf?: number | null;
  extra_insurance?: boolean;
  goods_photo_url?: string | null;
}

export interface Order {
  id: string;
  pickup_location_id: string | null;
  pickup_address_custom: string | null;
  delivery_address: string;
  access_type: AccessType;
  access_detail: string | null;
  is_hotel: boolean;
  hotel_room_number: string | null;
  floor: string | null;
  client_name: string | null;
  client_phone: string | null;
  requested_date: string | null;
  requested_time_slot: string | null;
  leave_at_door: boolean;
  special_instructions: string | null;
  // Liste des colis de la commande
  packages: PackageItem[];
  status: OrderStatus;
  price_chf: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  logtech_ref: string | null;

  // Anciens champs « un seul colis » — conservés pour les commandes créées
  // avant la mise à jour. Ne plus utiliser pour les nouvelles commandes.
  weight?: number | null;
  dimensions?: string | null;
  fragile?: boolean;
  perishable?: boolean;
  goods_photo_url?: string | null;
  declared_value_chf?: number | null;
  extra_insurance?: boolean;
}

export interface PricingRule {
  id: string;
  label: string;
  base_price_chf: number;
  modifiers: Record<string, unknown>;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DeliveryOptionConfig {
  key: string;
  label: string;
  enabled: boolean;
}

export interface DayHours {
  open: string; // "HH:mm"
  close: string; // "HH:mm"
  closed?: boolean;
}

export interface OperatingHoursSettings {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface CutoffSettings {
  weekday: string; // "HH:mm" — dernière commande en semaine
  saturday: string; // "HH:mm" — dernière commande le samedi
}

export interface AppSettings {
  operating_hours: OperatingHoursSettings;
  cutoffs: CutoffSettings;
  globus_notification_email: string;
}

export interface TimeSlot {
  value: string; // ex: "08:00-10:00"
  label: string; // ex: "08h00 – 10h00"
  startMinutes: number;
  endMinutes: number;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
        Relationships: [];
      };
      pickup_locations: {
        Row: PickupLocation;
        Insert: Omit<PickupLocation, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<PickupLocation>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'status'> & {
          id?: string;
          status?: OrderStatus;
        };
        Update: Partial<Order>;
        Relationships: [];
      };
      pricing_rules: {
        Row: PricingRule;
        Insert: Omit<PricingRule, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
        };
        Update: Partial<PricingRule>;
        Relationships: [];
      };
      delivery_options_config: {
        Row: DeliveryOptionConfig;
        Insert: DeliveryOptionConfig;
        Update: Partial<DeliveryOptionConfig>;
        Relationships: [];
      };
      settings: {
        Row: { key: string; value: unknown; updated_at?: string };
        Insert: { key: string; value: unknown };
        Update: { value: unknown };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      department: Department;
      access_type: AccessType;
      order_status: OrderStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
