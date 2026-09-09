export interface Material {
  id: number;
  name: string;
  color: string | null;
}

export interface InventoryEvent {
  id: number;
  spool_id: number;
  event_type: string;
  quantity_change: number | null;
  machine_id: number | null;
  user_id: string;
  related_event_id: number | null;
  related_request_id: number | null;
  note: string | null;
  created_at: string;
}

export interface ReservationEvent {
  id: number;
  spool_id: number;
  print_request_id: number;
  event_type: string;
  amount: number;
  user_id: string;
  related_event_id: number | null;
  created_at: string;
}

export interface Spool {
  id: number;
  material_id: number;
  material_name: string;
  material_color: string | null;
  original_filament_weight: number;
  empty_spool_weight: number;
  low_stock_threshold: number;
  current_weight: number;
  current_machine_id: number | null;
  reserved_amount: number;
  available: number;
}

export interface SpoolDetail extends Spool {
  inventory_history: InventoryEvent[];
  reservation_history: ReservationEvent[];
}

export interface Machine {
  id: number;
  name: string;
  status: string;
  current_spool_id: number | null;
  current_spool_material_name: string | null;
  current_spool_available: number | null;
}

export interface PrintRequest {
  id: number;
  requested_by: string;
  project_name: string;
  material_id: number;
  material_name: string;
  material_color: string | null;
  amount_required: number;
  status: string;
  active_reservation_id: number | null;
  active_reserved_amount: number | null;
  reserved_spool_id: number | null;
  reservation_status: string | null;
}

export interface MaterialCreate {
  name: string;
  color?: string;
}

export interface SpoolCreate {
  material_id: number;
  original_filament_weight: number;
  empty_spool_weight: number;
  low_stock_threshold: number;
  user_id: string;
}

export interface MachineCreate {
  name: string;
  status: string;
}

export interface PrintRequestCreate {
  requested_by: string;
  project_name: string;
  material_id: number;
  amount_required: number;
}
