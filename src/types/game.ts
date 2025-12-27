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
  medleyChoice?: {
    mode?: 'pick_game' | 'go_first';
    game?: string;
    starter?: 'p1' | 'p2';
    chooser?: 'p1' | 'p2';
    corkWinnerId?: string;
  };
}
