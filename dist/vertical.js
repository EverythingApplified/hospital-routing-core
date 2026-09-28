export function getVerticalMoveTypeForCheckpointTypes(fromType, toType) {
    if (fromType === "lift_lobby" && toType === "lift_lobby") {
        return "lift";
    }
    if (fromType === "stairs_lobby" && toType === "stairs_lobby") {
        return "stairs";
    }
    return null;
}
//# sourceMappingURL=vertical.js.map