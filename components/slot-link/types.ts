export type DepositService = {
  id: string;
  name: string;
  durationMinutes: number;
  priceCents: number;
  depositCents: number;
};

export type SlotSeed = {
  serviceId: string;
  date: string;
  time: string;
};
