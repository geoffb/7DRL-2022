/** Engine configuration */
export interface Config {
  /** Default font */
  font: {
    image: string;
    width: number;
    height: number;
    glyphs: string;
  };

  /** Entry scene after loading */
  entryScene: string;

  /** Assets to be preloaded */
  preload: {
    data: string[];
    images: string[];
    sounds: Record<string, string>;
  };

  /** Global sound volume */
  soundVolume: number;
}
