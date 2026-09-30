import test from "node:test";
import assert from "node:assert/strict";

import {
  compressRouteSteps,
  getOppositeDirection,
  getRouteFromCheckpoint,
  validateHospitalGraph,
} from "../dist/index.js";

test("opposite directions work horizontally and vertically", () => {
  assert.equal(getOppositeDirection("north"), "south");
  assert.equal(getOppositeDirection("south"), "north");
  assert.equal(getOppositeDirection("east"), "west");
  assert.equal(getOppositeDirection("west"), "east");
  assert.equal(getOppositeDirection("up"), "down");
  assert.equal(getOppositeDirection("down"), "up");
});

test("straight checkpoint steps are compressed", () => {
  const hospitalData = {
    id: "hospital-1",
    name: "Test Hospital",
    zones: [
      {
        id: "zone-1",
        hospitalId: "hospital-1",
        name: "Main Building",
        type: "building",
      },
    ],
    checkpoints: [
      {
        id: "a",
        zoneId: "zone-1",
        floor: "Ground",
        name: "A",
        type: "corridor",
        exits: [
          {
            direction: "east",
            to: "b",
            moveType: "straight",
          },
        ],
      },
      {
        id: "b",
        zoneId: "zone-1",
        floor: "Ground",
        name: "B",
        type: "corridor",
        exits: [
          {
            direction: "east",
            to: "c",
            moveType: "straight",
          },
        ],
      },
      {
        id: "c",
        zoneId: "zone-1",
        floor: "Ground",
        name: "C",
        type: "room_entry",
        exits: [],
        destinations: [
          {
            id: "destination-c",
            name: "Destination C",
            checkpointId: "c",
            direction: "east",
          },
        ],
      },
    ],
  };

  const route = getRouteFromCheckpoint("a", "destination-c", hospitalData);

  assert.equal(route.length, 3);

  const compressed = compressRouteSteps(route);

  assert.equal(compressed.length, 2);

  const movementStep = compressed[0];

  assert.equal(movementStep.kind, "checkpoint_display");

  if (movementStep.kind === "checkpoint_display") {
    assert.equal(movementStep.fromCheckpointId, "a");
    assert.equal(movementStep.toCheckpointId, "c");
    assert.equal(movementStep.moveType, "continue");
    assert.deepEqual(movementStep.viaCheckpointIds, ["b"]);
  }
});

test("avoid stairs chooses an alternative route", () => {
  const hospitalData = {
    id: "hospital-1",
    name: "Test Hospital",
    zones: [
      {
        id: "zone-1",
        hospitalId: "hospital-1",
        name: "Main Building",
        type: "building",
      },
    ],
    checkpoints: [
      {
        id: "start",
        zoneId: "zone-1",
        floor: "Ground",
        name: "Start",
        type: "corridor",
        exits: [
          {
            direction: "up",
            to: "target",
            moveType: "stairs",
          },
          {
            direction: "east",
            to: "lift",
            moveType: "straight",
          },
        ],
      },
      {
        id: "lift",
        zoneId: "zone-1",
        floor: "Ground",
        name: "Lift",
        type: "lift_lobby",
        exits: [
          {
            direction: "up",
            to: "target",
            moveType: "lift",
          },
        ],
      },
      {
        id: "target",
        zoneId: "zone-1",
        floor: "First",
        name: "Target",
        type: "lift_lobby",
        exits: [],
        destinations: [
          {
            id: "destination",
            name: "Destination",
            checkpointId: "target",
            direction: "east",
          },
        ],
      },
    ],
  };

  const normalRoute = getRouteFromCheckpoint(
    "start",
    "destination",
    hospitalData,
    {
      preferIndoor: true,
      avoidStairs: false,
    },
  );

  const accessibleRoute = getRouteFromCheckpoint(
    "start",
    "destination",
    hospitalData,
    {
      preferIndoor: true,
      avoidStairs: true,
    },
  );

  assert.equal(normalRoute[0].kind, "checkpoint_display");
  assert.equal(accessibleRoute[0].kind, "checkpoint_display");

  if (
    normalRoute[0].kind === "checkpoint_display" &&
    accessibleRoute[0].kind === "checkpoint_display"
  ) {
    assert.equal(normalRoute[0].moveType, "stairs");
    assert.equal(accessibleRoute[0].toCheckpointId, "lift");
  }
});

test("validator detects a missing reverse link", () => {
  const issues = validateHospitalGraph(
    {
      id: "hospital-1",
      name: "Test Hospital",
    },
    [
      {
        id: "zone-1",
        hospital_id: "hospital-1",
        name: "Main Building",
      },
    ],
    [
      {
        id: "floor-1",
        hospital_id: "hospital-1",
        zone_id: "zone-1",
        name: "Ground",
        order_index: 0,
      },
    ],
    [
      {
        id: "a",
        hospital_id: "hospital-1",
        zone_id: "zone-1",
        floor_id: "floor-1",
        name: "A",
        type: "corridor",
      },
      {
        id: "b",
        hospital_id: "hospital-1",
        zone_id: "zone-1",
        floor_id: "floor-1",
        name: "B",
        type: "corridor",
      },
    ],
    [
      {
        id: "link-1",
        from_checkpoint_id: "a",
        direction: "east",
        to_checkpoint_id: "b",
        move_type: "straight",
      },
    ],
    [],
  );

  assert.equal(
    issues.some((issue) => issue.type === "missing_reverse_link"),
    true,
  );
});

test("validator rejects a vertical link on the same floor", () => {
  const issues = validateHospitalGraph(
    {
      id: "hospital-1",
      name: "Test Hospital",
    },
    [
      {
        id: "zone-1",
        hospital_id: "hospital-1",
        name: "Main Building",
      },
    ],
    [
      {
        id: "floor-1",
        hospital_id: "hospital-1",
        zone_id: "zone-1",
        name: "Ground",
        order_index: 0,
      },
    ],
    [
      {
        id: "lift-a",
        hospital_id: "hospital-1",
        zone_id: "zone-1",
        floor_id: "floor-1",
        name: "Lift A",
        type: "lift_lobby",
      },
      {
        id: "lift-b",
        hospital_id: "hospital-1",
        zone_id: "zone-1",
        floor_id: "floor-1",
        name: "Lift B",
        type: "lift_lobby",
      },
    ],
    [
      {
        id: "link-up",
        from_checkpoint_id: "lift-a",
        direction: "up",
        to_checkpoint_id: "lift-b",
        move_type: "lift",
      },
      {
        id: "link-down",
        from_checkpoint_id: "lift-b",
        direction: "down",
        to_checkpoint_id: "lift-a",
        move_type: "lift",
      },
    ],
    [],
  );

  assert.equal(
    issues.some((issue) => issue.type === "invalid_vertical_link"),
    true,
  );
});


test("consecutive lift floors are compressed into one visible step", () => {
  const route = [
    {
      kind: "checkpoint_display",
      fromCheckpointId: "lift-l3",
      toCheckpointId: "lift-l4",
      moveType: "lift",
      travelDirection: "up",
      viaCheckpointIds: [],
    },
    {
      kind: "checkpoint_display",
      fromCheckpointId: "lift-l4",
      toCheckpointId: "lift-l5",
      moveType: "lift",
      travelDirection: "up",
      viaCheckpointIds: [],
    },
    {
      kind: "destination",
      checkpointId: "lift-l5",
      destination: {
        id: "destination-l5",
        name: "Level 5 destination",
        checkpointId: "lift-l5",
        direction: "east",
      },
    },
  ];

  const compressed = compressRouteSteps(route);

  assert.equal(compressed.length, 2);

  const liftStep = compressed[0];

  assert.equal(liftStep.kind, "checkpoint_display");

  if (liftStep.kind === "checkpoint_display") {
    assert.equal(liftStep.fromCheckpointId, "lift-l3");
    assert.equal(liftStep.toCheckpointId, "lift-l5");
    assert.equal(liftStep.moveType, "lift");
    assert.equal(liftStep.travelDirection, "up");
    assert.deepEqual(liftStep.viaCheckpointIds, ["lift-l4"]);
  }
});
