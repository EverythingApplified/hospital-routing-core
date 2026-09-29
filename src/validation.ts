import type { CheckpointType, Direction, MoveType } from "./types.js";

import { getOppositeDirection } from "./direction.js";
import { getVerticalMoveTypeForCheckpointTypes } from "./vertical.js";

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
  type:
    | "empty_hospital"
    | "zone_without_checkpoints"
    | "floor_without_checkpoints"
    | "checkpoint_without_links"
    | "isolated_checkpoint"
    | "dead_end_checkpoint"
    | "missing_link_target"
    | "missing_reverse_link"
    | "invalid_reverse_link"
    | "duplicate_direction_slot"
    | "missing_destination_checkpoint"
    | "duplicate_destination_name"
    | "unreachable_checkpoint"
    | "unreachable_destination"
    | "cross_zone_link"
    | "invalid_vertical_link";
  severity: "error" | "warning";
  message: string;
  checkpointId?: string;
  destinationId?: string;
};

export function validateHospitalGraph(
  hospital: ValidationHospitalRow | null,
  zones: ValidationZoneRow[],
  floors: ValidationFloorRow[],
  checkpoints: ValidationCheckpointRow[],
  links: ValidationLinkRow[],
  destinations: ValidationDestinationRow[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!hospital || checkpoints.length === 0) {
    issues.push({
      type: "empty_hospital",
      severity: "error",
      message: "No checkpoints found for this hospital.",
    });
    return issues;
  }

  const checkpointMap = Object.fromEntries(
    checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]),
  ) as Record<string, ValidationCheckpointRow>;

  const outgoingByCheckpoint = new Map<string, ValidationLinkRow[]>();
  const incomingByCheckpoint = new Map<string, ValidationLinkRow[]>();

  for (const checkpoint of checkpoints) {
    outgoingByCheckpoint.set(checkpoint.id, []);
    incomingByCheckpoint.set(checkpoint.id, []);
  }

  for (const link of links) {
    const outgoing = outgoingByCheckpoint.get(link.from_checkpoint_id) ?? [];
    outgoing.push(link);
    outgoingByCheckpoint.set(link.from_checkpoint_id, outgoing);

    const incoming = incomingByCheckpoint.get(link.to_checkpoint_id) ?? [];
    incoming.push(link);
    incomingByCheckpoint.set(link.to_checkpoint_id, incoming);
  }

  for (const zone of zones) {
    const zoneCheckpointCount = checkpoints.filter(
      (checkpoint) => checkpoint.zone_id === zone.id,
    ).length;

    if (zoneCheckpointCount === 0) {
      issues.push({
        type: "zone_without_checkpoints",
        severity: "warning",
        message: `Zone "${zone.name}" (${zone.id}) has no checkpoints.`,
      });
    }
  }

  for (const floor of floors) {
    const floorCheckpointCount = checkpoints.filter(
      (checkpoint) => checkpoint.floor_id === floor.id,
    ).length;

    if (floorCheckpointCount === 0) {
      issues.push({
        type: "floor_without_checkpoints",
        severity: "warning",
        message: `Floor "${floor.name}" (${floor.id}) has no checkpoints.`,
      });
    }
  }

  const directionSlotMap = new Map<string, ValidationLinkRow[]>();

  for (const link of links) {
    const key = `${link.from_checkpoint_id}__${link.direction}`;
    const existing = directionSlotMap.get(key) ?? [];
    existing.push(link);
    directionSlotMap.set(key, existing);
  }

  for (const groupedLinks of directionSlotMap.values()) {
    if (groupedLinks.length > 1) {
      const sampleLink = groupedLinks[0];
      const checkpoint = checkpointMap[sampleLink.from_checkpoint_id];
      const targets = groupedLinks
        .map((item) => item.to_checkpoint_id)
        .join(", ");

      issues.push({
        type: "duplicate_direction_slot",
        severity: "error",
        checkpointId: sampleLink.from_checkpoint_id,
        message: `Checkpoint "${checkpoint?.name ?? sampleLink.from_checkpoint_id}" (${sampleLink.from_checkpoint_id}) has multiple "${sampleLink.direction}" links targeting: ${targets}.`,
      });
    }
  }

  for (const checkpoint of checkpoints) {
    const outgoing = outgoingByCheckpoint.get(checkpoint.id) ?? [];
    const incoming = incomingByCheckpoint.get(checkpoint.id) ?? [];
    const totalConnections = outgoing.length + incoming.length;

    if (outgoing.length === 0) {
      issues.push({
        type: "checkpoint_without_links",
        severity: "warning",
        checkpointId: checkpoint.id,
        message: `Checkpoint "${checkpoint.name}" (${checkpoint.id}) has no outgoing links.`,
      });
    }

    if (outgoing.length === 0 && incoming.length === 0) {
      issues.push({
        type: "isolated_checkpoint",
        severity: "error",
        checkpointId: checkpoint.id,
        message: `Checkpoint "${checkpoint.name}" (${checkpoint.id}) is completely isolated.`,
      });
    }

    const shouldWarnForDeadEnd =
      checkpoint.type === "junction" || checkpoint.type === "corridor";

    if (shouldWarnForDeadEnd && totalConnections <= 1) {
      issues.push({
        type: "dead_end_checkpoint",
        severity: "warning",
        checkpointId: checkpoint.id,
        message: `Checkpoint "${checkpoint.name}" (${checkpoint.id}) looks like a dead end for a ${checkpoint.type}.`,
      });
    }
  }

  for (const link of links) {
    const sourceCheckpoint = checkpointMap[link.from_checkpoint_id];
    const targetCheckpoint = checkpointMap[link.to_checkpoint_id];

    if (!sourceCheckpoint) {
      continue;
    }

    if (!targetCheckpoint) {
      issues.push({
        type: "missing_link_target",
        severity: "error",
        checkpointId: link.from_checkpoint_id,
        message: `Link "${link.id}" points to missing checkpoint "${link.to_checkpoint_id}".`,
      });
      continue;
    }

    const reverseDirection = getOppositeDirection(link.direction);

    const reverseCandidates = links.filter(
      (candidate) =>
        candidate.from_checkpoint_id === link.to_checkpoint_id &&
        candidate.direction === reverseDirection,
    );

    if (reverseCandidates.length === 0) {
      issues.push({
        type: "missing_reverse_link",
        severity: "error",
        checkpointId: link.from_checkpoint_id,
        message: `Missing reverse link for "${link.from_checkpoint_id}" ${link.direction} → "${link.to_checkpoint_id}".`,
      });
    } else {
      const correctReverse = reverseCandidates.some(
        (candidate) => candidate.to_checkpoint_id === link.from_checkpoint_id,
      );

      if (!correctReverse) {
        issues.push({
          type: "invalid_reverse_link",
          severity: "error",
          checkpointId: link.from_checkpoint_id,
          message: `Reverse link for "${link.from_checkpoint_id}" ${link.direction} → "${link.to_checkpoint_id}" exists, but it does not point back correctly.`,
        });
      }
    }

    const isVerticalDirection =
      link.direction === "up" || link.direction === "down";

    const usesVerticalMoveType =
      link.move_type === "lift" || link.move_type === "stairs";

    if (isVerticalDirection) {
      const expectedVerticalMoveType = getVerticalMoveTypeForCheckpointTypes(
        sourceCheckpoint.type,
        targetCheckpoint.type,
      );

      if (sourceCheckpoint.floor_id === targetCheckpoint.floor_id) {
        issues.push({
          type: "invalid_vertical_link",
          severity: "error",
          checkpointId: link.from_checkpoint_id,
          message: `Vertical link "${link.id}" connects checkpoints on the same floor.`,
        });
      } else if (!expectedVerticalMoveType) {
        issues.push({
          type: "invalid_vertical_link",
          severity: "error",
          checkpointId: link.from_checkpoint_id,
          message: `Vertical link "${link.id}" must connect matching lift lobbies or matching stairs lobbies.`,
        });
      } else if (link.move_type !== expectedVerticalMoveType) {
        issues.push({
          type: "invalid_vertical_link",
          severity: "error",
          checkpointId: link.from_checkpoint_id,
          message: `Vertical link "${link.id}" should use "${expectedVerticalMoveType}" because it connects ${sourceCheckpoint.type.replace(/_/g, " ")} checkpoints.`,
        });
      }
    } else if (usesVerticalMoveType) {
      issues.push({
        type: "invalid_vertical_link",
        severity: "error",
        checkpointId: link.from_checkpoint_id,
        message: `Horizontal link "${link.id}" cannot use the vertical move type "${link.move_type}".`,
      });
    }

    const isCrossZone = sourceCheckpoint.zone_id !== targetCheckpoint.zone_id;
    const isAllowedCrossZoneMove =
      link.move_type === "enter" ||
      link.move_type === "exit" ||
      link.move_type === "lift" ||
      link.move_type === "stairs";

    if (isCrossZone && !isAllowedCrossZoneMove) {
      issues.push({
        type: "cross_zone_link",
        severity: "warning",
        checkpointId: link.from_checkpoint_id,
        message: `Cross-zone link from "${sourceCheckpoint.name}" (${sourceCheckpoint.id}) to "${targetCheckpoint.name}" (${targetCheckpoint.id}) uses "${link.move_type}" instead of a zone transition move.`,
      });
    }
  }

  for (const destination of destinations) {
    if (!checkpointMap[destination.checkpoint_id]) {
      issues.push({
        type: "missing_destination_checkpoint",
        severity: "error",
        destinationId: destination.id,
        message: `Destination "${destination.name}" (${destination.id}) points to missing checkpoint "${destination.checkpoint_id}".`,
      });
    }
  }

  const destinationNameMap = new Map<string, ValidationDestinationRow[]>();

  for (const destination of destinations) {
    const key = destination.name.trim().toLowerCase();
    const existing = destinationNameMap.get(key) ?? [];
    existing.push(destination);
    destinationNameMap.set(key, existing);
  }

  for (const [key, grouped] of destinationNameMap.entries()) {
    if (grouped.length > 1) {
      const readableName = grouped[0]?.name || key;
      const ids = grouped.map((item) => item.id).join(", ");

      issues.push({
        type: "duplicate_destination_name",
        severity: "warning",
        message: `Destination name "${readableName}" appears multiple times (${ids}).`,
      });
    }
  }

  const startCheckpointId = checkpoints[0]?.id;
  const reachableCheckpointIds = new Set<string>();

  if (startCheckpointId) {
    const queue: string[] = [startCheckpointId];

    while (queue.length > 0) {
      const currentId = queue.shift();

      if (!currentId || reachableCheckpointIds.has(currentId)) {
        continue;
      }

      reachableCheckpointIds.add(currentId);

      const outgoing = outgoingByCheckpoint.get(currentId) ?? [];

      for (const link of outgoing) {
        if (!reachableCheckpointIds.has(link.to_checkpoint_id)) {
          queue.push(link.to_checkpoint_id);
        }
      }
    }

    for (const checkpoint of checkpoints) {
      if (!reachableCheckpointIds.has(checkpoint.id)) {
        issues.push({
          type: "unreachable_checkpoint",
          severity: "error",
          checkpointId: checkpoint.id,
          message: `Checkpoint "${checkpoint.name}" (${checkpoint.id}) is unreachable from "${startCheckpointId}".`,
        });
      }
    }

    for (const destination of destinations) {
      const destinationCheckpoint = checkpointMap[destination.checkpoint_id];

      if (
        destinationCheckpoint &&
        !reachableCheckpointIds.has(destination.checkpoint_id)
      ) {
        issues.push({
          type: "unreachable_destination",
          severity: "error",
          checkpointId: destination.checkpoint_id,
          destinationId: destination.id,
          message: `Destination "${destination.name}" (${destination.id}) is attached to unreachable checkpoint "${destination.checkpoint_id}".`,
        });
      }
    }
  }

  return issues;
}
