// Client-safe parking constants & types (no server-only imports), shared by the
// service, the server actions and the client matrix component.

export const PARKING_TYPES = ['Covered', 'Open', 'Mechanical', 'EV', 'Visitor', 'Disabled'] as const;
export const PARKING_STATUSES = ['Available', 'Assigned', 'Blocked'] as const;

export interface ParkingSlotRow {
  id: string; code: string; level: string; type: string; status: string;
  unitId: string | null; unitCode: string | null; bookingId: string | null; notes: string | null;
}
export interface ParkingLevel { level: string; slots: ParkingSlotRow[] }
export interface UnitLite { id: string; code: string; tower: string | null; floor: number | null; typology: string | null; status: string }
export interface ParkingData {
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  levels: ParkingLevel[];
  units: UnitLite[];
  totals: { total: number; available: number; assigned: number; blocked: number; byType: Array<{ type: string; count: number }> };
}
