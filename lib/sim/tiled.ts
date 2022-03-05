/** These types and interfaces map to Tiled's JSON format */

/** Tiled custom property types */
export type TiledCustomPropertyType = "color" | "bool" | "int" | "string";

/** Tiled layer types */
export type TiledLayerType = "tilelayer" | "objectgroup";

/** Tiled map */
export interface ITiledMap {
  backgroundcolor: string;
  infinite: boolean;
  width: number;
  height: number;
  layers: ITiledLayer[];
  properties: ITiledCustomProperty[];
  tilewidth: number;
  tileheight: number;
}

/** Tiled custom property */
export interface ITiledCustomProperty {
  name: string;
  type: TiledCustomPropertyType;
  value: any;
}

/** Tiled layer */
export interface ITiledLayer {
  id: number;
  name: string;
  type: TiledLayerType;
  opacity: number;
  visible: boolean;
  x: number;
  h: number;
}

/** Tiled tile layer */
export interface ITiledTileLayer extends ITiledLayer {
  type: "tilelayer";
  data: number[];
  width: number;
  height: number;
}

/** Tiled object group */
export interface ITiledObjectGroup extends ITiledLayer {
  type: "objectgroup";
  objects: ITiledObject[];
}

/** Tile object */
export interface ITiledObject {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  gid?: number;
  properties?: ITiledCustomProperty[];
}

interface ITileset {
  tiles: ITilesetTile[];
}

interface ITilesetTile {
  id: number;
  properties: IProperty[];
}

interface IProperty {
  name: string;
  type: string;
  value: any;
}

interface IProperties {
  [index: string]: any;
}

/** Parse Tiled properties into a more sane structure */
export function parseProperties(props: IProperty[]): IProperties {
  const properties: IProperties = {};
  for (const prop of props) {
    properties[prop.name] = prop.value;
  }
  return properties;
}

/** Return the value of a tile property */
function getTileProperty<T>(tile: ITilesetTile, name: string): T | undefined {
  for (const prop of tile.properties) {
    if (prop.name === name) {
      return prop.value as T;
    }
  }
  return undefined;
}

/** Return all layers of a given type from a map */
export function getLayersByType<T extends ITiledLayer>(
  map: ITiledMap,
  type: TiledLayerType
): T[] {
  const layers: T[] = [];
  for (const layer of map.layers) {
    if (layer.type === type) {
      layers.push(layer as T);
    }
  }
  return layers;
}

/** Return a layer by its name */
export function getLayerByName<T extends ITiledLayer>(
  map: ITiledMap,
  name: string
): T | undefined {
  for (const layer of map.layers) {
    if (layer.name === name) {
      return layer as T;
    }
  }
}

/** Return a list of walkable tiles */
export function getWalkableTiles(tileset: ITileset): number[] {
  const walkable: number[] = [];
  for (const tile of tileset.tiles) {
    if (getTileProperty<boolean>(tile, "walk") === true) {
      walkable.push(tile.id);
    }
  }
  return walkable;
}
