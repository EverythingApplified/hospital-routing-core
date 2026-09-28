import type { DisplayRouteStep, HospitalData, RouteOptions } from "./types";
export declare function compressRouteSteps(route: DisplayRouteStep[]): DisplayRouteStep[];
export declare function getRouteFromCheckpoint(startCheckpointId: string, endDestinationId: string, hospitalData: HospitalData, options?: RouteOptions): DisplayRouteStep[];
export declare function getRoute(startDestinationId: string, endDestinationId: string, hospitalData: HospitalData, options?: RouteOptions): DisplayRouteStep[];
//# sourceMappingURL=route.d.ts.map