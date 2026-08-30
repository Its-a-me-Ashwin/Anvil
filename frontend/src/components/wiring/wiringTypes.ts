export interface WiringModule {
  id: string;
  name: string;
  pins: string[];
}

export type WiringConnection = [string, string, string, string, string?];

export interface WiringDiagramData {
  modules: WiringModule[];
  connections: WiringConnection[];
}
