export type BotConsumables = {
  health: number;
  shield: number;
  medkits: number;
  shieldPotions: number;
};

export type BotConsumable = "med" | "shield";

export const BOT_CAR_BOARD_RANGE = 18;
export const BOT_AIRCRAFT_BOARD_RANGE = 55;

export function canBotBoardVehicle(distance: number, occupied: boolean, range: number): boolean {
  return !occupied && distance <= range;
}

export function chooseBotConsumable(needs: BotConsumables, engaged: boolean): BotConsumable | null {
  if (engaged) return null;
  if (needs.health <= 70 && needs.medkits > 0) return "med";
  if (needs.shield <= 35 && needs.shieldPotions > 0) return "shield";
  return null;
}

export function applyBotConsumable(needs: BotConsumables, consumable: BotConsumable): BotConsumables {
  if (consumable === "med") {
    return { ...needs, health: 150, medkits: needs.medkits - 1 };
  }
  return {
    ...needs,
    shield: Math.min(100, needs.shield + 50),
    shieldPotions: needs.shieldPotions - 1,
  };
}