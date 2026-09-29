import type { CheckpointType, Direction, MoveType } from "./types.js";
export type ValidationHospitalRow = {
    id: string;
    name: string;
};
export type ValidationZoneRow = {
    id: string;
    hospital_id: string;
    name: string;
};
export type ValidationFloorRow = {
    id: string;
    hospital_id: string;
    zone_id: string;
    name: string;
    order_index: number;
};
export type ValidationCheckpointRow = {
    id: string;
    hospital_id: string;
    zone_id: string;
    floor_id: string;
    name: string;
    type: CheckpointType;
};
export type ValidationLinkRow = {
    id: string;
    from_checkpoint_id: string;
    direction: Direction;
    to_checkpoint_id: string;
    move_type: MoveType;
};
export type ValidationDestinationRow = {
    id: string;
    checkpoint_id: string;
    name: string;
};
export type ValidationIssue = {
    type: "empty_hospital" | "zone_without_checkpoints" | "floor_without_checkpoints" | "checkpoint_without_links" | "isolated_checkpoint" | "dead_end_checkpoint" | "missing_link_target" | "missing_reverse_link" | "invalid_reverse_link" | "duplicate_direction_slot" | "missing_destination_checkpoint" | "duplicate_destination_name" | "unreachable_checkpoint" | "unreachable_destination" | "cross_zone_link" | "invalid_vertical_link";
    severity: "error" | "warning";
    message: string;
    checkpointId?: string;
    destinationId?: string;
};
export declare function validateHospitalGraph(hospital: ValidationHospitalRow | null, zones: ValidationZoneRow[], floors: ValidationFloorRow[], checkpoints: ValidationCheckpointRow[], links: ValidationLinkRow[], destinations: ValidationDestinationRow[]): ValidationIssue[];
//# sourceMappingURL=validation.d.ts.map