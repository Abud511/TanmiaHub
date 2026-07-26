import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Account, User } from "../../drizzle/schema";
import { getAccountFromRequest } from "../localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  account: Account | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let account: Account | null = null;

  try {
    account = await getAccountFromRequest(opts.req);
  } catch {
    account = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    account,
  };
}
