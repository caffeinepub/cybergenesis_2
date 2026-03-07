// Placeholder type for governance backend canister
// Will be replaced with actual interface when governance canister is integrated
export interface governanceBackendInterface {
  [key: string]: (...args: any[]) => Promise<any>;
}
