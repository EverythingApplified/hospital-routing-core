import type { CheckpointType, MoveType } from "./types";

export function getVerticalMoveTypeForCheckpointTypes(
  fromType: CheckpointType,
  toType: CheckpointType,
): MoveType | null {
  if (fromType === "lift_lobby" && toType === "lift_lobby") {
    return "lift";
  }

  if (fromType === "stairs_lobby" && toType === "stairs_lobby") {
    return "stairs";
  }

  return null;
}
