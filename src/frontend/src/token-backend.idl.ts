// Placeholder IDL factory for token backend canister
// Will be replaced with actual IDL when token canister is integrated
export const idlFactory = ({ IDL }: { IDL: any }) => {
  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });
  return IDL.Service({
    icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ["query"]),
    getCanisterTokenBalance: IDL.Func([], [IDL.Nat], ["query"]),
  });
};
