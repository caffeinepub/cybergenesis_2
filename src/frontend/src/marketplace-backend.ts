// Placeholder type for marketplace backend canister
// Will be replaced with actual interface when marketplace canister is integrated
export interface marketplaceBackendInterface {
  [key: string]: (...args: any[]) => Promise<any>;
}
