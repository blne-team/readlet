/** R2 usage that must be reserved before an operation reaches the bucket. */
export type R2UsageReservation = {
  classA?: number;
  classB?: number;
  objects?: readonly { key: string; bytes: number }[];
};

export type R2UsageLevel = "healthy" | "warning" | "critical" | "blocked";

export type R2UsageCounter = {
  used: number;
  limit: number;
  ratio: number;
};

/** The account-wide R2 allowance reserved by this Readlet deployment. */
export type R2UsageStatus = {
  periodStartedAt: string;
  periodEndsAt: string;
  level: R2UsageLevel;
  classA: R2UsageCounter;
  classB: R2UsageCounter;
  storage: R2UsageCounter;
};

/** A fail-closed gate shared by every path that can issue an R2 operation. */
export interface R2UsageBudget {
  reserve(usage: R2UsageReservation): Promise<void>;
  status(): Promise<R2UsageStatus>;
}

export class R2UsageLimitError extends Error {
  constructor(
    message: string,
    readonly status?: R2UsageStatus,
  ) {
    super(message);
    this.name = "R2UsageLimitError";
  }
}
