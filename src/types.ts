export type ZoneType = "building" | "outdoor" | "connector";

export type Direction = "north" | "south" | "east" | "west" | "up" | "down";

export type HorizontalDirection = "north" | "south" | "east" | "west";

export type VerticalDirection = "up" | "down";

export type MoveType =
  | "straight"
  | "continue"
  | "turn_left"
  | "turn_right"
  | "enter"
  | "exit"
  | "lift"
  | "stairs";

export type CheckpointType =
  | "entrance"
  | "junction"
  | "corridor"
  | "lift_lobby"
  | "stairs_lobby"
  | "room_entry";

export type DestinationType = "standard" | "toilet";

export type Exit = {
  direction: Direction;
  to: string;
  moveType: MoveType;
};

export type Destination = {
  id: string;
  name: string;
  checkpointId: string;
  direction: HorizontalDirection;
  aliases?: string[];
  selectable?: boolean;
  imageUrl?: string;
  destinationType?: DestinationType;
  isDisabledAccessible?: boolean;
  useAsLandmark?: boolean;
};

export type Landmark = {
  id: string;
  name: string;
  direction: HorizontalDirection;
  imageUrl?: string;
};

export type DirectionalCheckpointImage = {
  approachFromDirection: HorizontalDirection;
  imageUrl: string;
};

export type Zone = {
  id: string;
  hospitalId: string;
  name: string;
  type: ZoneType;
};

export type Checkpoint = {
  id: string;
  zoneId: string;
  floor: string;
  name: string;
  displayName?: string;
  instructionHint?: string;
  image?: unknown;
  imageUrl?: string;
  directionalImages?: DirectionalCheckpointImage[];
  type: CheckpointType;
  exits: Exit[];
  isOutdoor?: boolean;
  destinations?: Destination[];
  landmarks?: Landmark[];
};

export type HospitalData = {
  id: string;
  name: string;
  zones: Zone[];
  checkpoints: Checkpoint[];
};

export type Hospital = {
  id: string;
  name: string;
};

export type RouteOptions = {
  preferIndoor?: boolean;
  avoidStairs?: boolean;
};

export type CheckpointDisplayStep = {
  kind: "checkpoint_display";
  fromCheckpointId: string;
  toCheckpointId: string;
  moveType: MoveType;
  travelDirection: Direction;
  viaCheckpointIds: string[];
};

export type DestinationStep = {
  kind: "destination";
  checkpointId: string;
  destination: Destination;
};

export type DisplayRouteStep = CheckpointDisplayStep | DestinationStep;
