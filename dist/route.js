function getZoneMap(hospitalData) {
    return Object.fromEntries((hospitalData.zones ?? []).map((zone) => [zone.id, zone]));
}
function getCheckpointMap(checkpoints) {
    return Object.fromEntries(checkpoints.map((checkpoint) => [checkpoint.id, checkpoint]));
}
function getDestinationMap(checkpoints) {
    const destinations = checkpoints.flatMap((checkpoint) => checkpoint.destinations ?? []);
    return Object.fromEntries(destinations.map((destination) => [destination.id, destination]));
}
function isStraightLike(moveType) {
    return moveType === "straight" || moveType === "continue";
}
function isMergeableVerticalStep(previous, step) {
    const isSameVerticalMove = previous.moveType === step.moveType &&
        (step.moveType === "lift" || step.moveType === "stairs");
    const isSameVerticalDirection = previous.travelDirection === step.travelDirection &&
        (step.travelDirection === "up" || step.travelDirection === "down");
    return (isSameVerticalMove &&
        isSameVerticalDirection &&
        previous.toCheckpointId === step.fromCheckpointId);
}
function getExitBetween(fromCheckpointId, toCheckpointId, checkpointMap) {
    const fromCheckpoint = checkpointMap[fromCheckpointId];
    return fromCheckpoint?.exits.find((exit) => exit.to === toCheckpointId);
}
function getStepCost(fromCheckpoint, toCheckpoint, moveType, hospitalData, options) {
    let cost = 1;
    const zoneMap = getZoneMap(hospitalData);
    const fromZone = zoneMap[fromCheckpoint.zoneId];
    const toZone = zoneMap[toCheckpoint.zoneId];
    const entersOutdoorZone = toZone?.type === "outdoor" || toCheckpoint.isOutdoor === true;
    const crossesZone = fromCheckpoint.zoneId !== toCheckpoint.zoneId;
    if (options.preferIndoor !== false && entersOutdoorZone) {
        cost += 8;
    }
    if (options.preferIndoor !== false &&
        crossesZone &&
        fromZone?.type !== "outdoor" &&
        toZone?.type === "outdoor") {
        cost += 4;
    }
    if (options.avoidStairs && moveType === "stairs") {
        cost += 50;
    }
    return cost;
}
function buildCheckpointPath(startCheckpointId, endCheckpointId, hospitalData, checkpointMap, options) {
    if (startCheckpointId === endCheckpointId) {
        return [startCheckpointId];
    }
    const checkpoints = hospitalData.checkpoints ?? [];
    const costs = {};
    const previous = {};
    const unvisited = new Set();
    for (const checkpoint of checkpoints) {
        costs[checkpoint.id] = Infinity;
        previous[checkpoint.id] = null;
        unvisited.add(checkpoint.id);
    }
    costs[startCheckpointId] = 0;
    while (unvisited.size > 0) {
        let currentId = null;
        let currentCost = Infinity;
        for (const checkpointId of unvisited) {
            if (costs[checkpointId] < currentCost) {
                currentCost = costs[checkpointId];
                currentId = checkpointId;
            }
        }
        if (!currentId || currentCost === Infinity) {
            break;
        }
        if (currentId === endCheckpointId) {
            break;
        }
        unvisited.delete(currentId);
        const currentCheckpoint = checkpointMap[currentId];
        if (!currentCheckpoint)
            continue;
        for (const exit of currentCheckpoint.exits) {
            if (!unvisited.has(exit.to))
                continue;
            const targetCheckpoint = checkpointMap[exit.to];
            if (!targetCheckpoint)
                continue;
            const newCost = costs[currentId] +
                getStepCost(currentCheckpoint, targetCheckpoint, exit.moveType, hospitalData, options);
            if (newCost < costs[exit.to]) {
                costs[exit.to] = newCost;
                previous[exit.to] = currentId;
            }
        }
    }
    if (costs[endCheckpointId] === Infinity) {
        return [];
    }
    const path = [];
    let current = endCheckpointId;
    while (current) {
        path.unshift(current);
        current = previous[current];
    }
    return path;
}
function buildUncompressedRoute(checkpointPath, checkpointMap, endDestination) {
    const steps = [];
    for (let i = 0; i < checkpointPath.length - 1; i++) {
        const fromCheckpointId = checkpointPath[i];
        const toCheckpointId = checkpointPath[i + 1];
        const exit = getExitBetween(fromCheckpointId, toCheckpointId, checkpointMap);
        if (!exit)
            continue;
        steps.push({
            kind: "checkpoint_display",
            fromCheckpointId,
            toCheckpointId,
            moveType: exit.moveType,
            travelDirection: exit.direction,
            viaCheckpointIds: [],
        });
    }
    steps.push({
        kind: "destination",
        checkpointId: endDestination.checkpointId,
        destination: endDestination,
    });
    return steps;
}
export function compressRouteSteps(route) {
    const compressed = [];
    for (const step of route) {
        if (step.kind === "destination") {
            compressed.push(step);
            continue;
        }
        const last = compressed[compressed.length - 1];
        if (last &&
            last.kind === "checkpoint_display" &&
            isStraightLike(last.moveType) &&
            isStraightLike(step.moveType) &&
            last.travelDirection === step.travelDirection &&
            last.toCheckpointId === step.fromCheckpointId) {
            last.viaCheckpointIds = [
                ...last.viaCheckpointIds,
                last.toCheckpointId,
                ...step.viaCheckpointIds,
            ];
            last.toCheckpointId = step.toCheckpointId;
            last.moveType = "continue";
            continue;
        }
        if (last &&
            last.kind === "checkpoint_display" &&
            isMergeableVerticalStep(last, step)) {
            last.viaCheckpointIds = [
                ...last.viaCheckpointIds,
                last.toCheckpointId,
                ...step.viaCheckpointIds,
            ];
            last.toCheckpointId = step.toCheckpointId;
            continue;
        }
        compressed.push({ ...step });
    }
    return compressed;
}
export function getRouteFromCheckpoint(startCheckpointId, endDestinationId, hospitalData, options = {
    preferIndoor: true,
    avoidStairs: false,
}) {
    const checkpointMap = getCheckpointMap(hospitalData.checkpoints ?? []);
    const destinationMap = getDestinationMap(hospitalData.checkpoints ?? []);
    const startCheckpoint = checkpointMap[startCheckpointId];
    const endDestination = destinationMap[endDestinationId];
    if (!startCheckpoint || !endDestination) {
        return [];
    }
    const checkpointPath = buildCheckpointPath(startCheckpointId, endDestination.checkpointId, hospitalData, checkpointMap, options);
    if (checkpointPath.length === 0) {
        return [];
    }
    return buildUncompressedRoute(checkpointPath, checkpointMap, endDestination);
}
export function getRoute(startDestinationId, endDestinationId, hospitalData, options = {
    preferIndoor: true,
    avoidStairs: false,
}) {
    const destinationMap = getDestinationMap(hospitalData.checkpoints ?? []);
    const startDestination = destinationMap[startDestinationId];
    const endDestination = destinationMap[endDestinationId];
    if (!startDestination || !endDestination) {
        return [];
    }
    if (startDestination.id === endDestination.id) {
        return [];
    }
    return getRouteFromCheckpoint(startDestination.checkpointId, endDestinationId, hospitalData, options);
}
//# sourceMappingURL=route.js.map