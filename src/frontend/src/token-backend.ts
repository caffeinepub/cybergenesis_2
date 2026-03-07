import type { Principal } from "@icp-sdk/core/principal";

export interface tokenBackendInterface {
  icrc1_balance_of(args: { owner: Principal; subaccount: [] }): Promise<bigint>;
  getCanisterTokenBalance(): Promise<bigint>;
}
