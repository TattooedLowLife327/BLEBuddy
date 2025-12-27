export type GameInOut = 'do' | 'mo' | 'mimo' | 'dido' | null;
export type GameBull = 'full' | 'split' | null;

export interface GameConfiguration {
  legs: number;
  games: string[];
  handicap: boolean;
  format: {
    inOut: GameInOut;
    bull: GameBull;
  };
}
