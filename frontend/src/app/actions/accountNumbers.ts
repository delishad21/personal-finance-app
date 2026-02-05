"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export interface AccountIdentifier {
  id: string;
  accountIdentifier: string;
  color: string;
}

export async function getAccountNumbers(): Promise<AccountIdentifier[]> {
  const session = await auth();

  if (!session?.user?.id) {
    return [];
  }

  const accounts = await prisma.accountIdentifier.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      accountIdentifier: true,
      color: true,
    },
    orderBy: {
      accountIdentifier: "asc",
    },
  });

  return accounts;
}

export async function upsertAccountNumber(
  accountIdentifier: string,
  color: string,
): Promise<AccountIdentifier> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const account = await prisma.accountIdentifier.upsert({
    where: {
      userId_accountIdentifier: {
        userId: session.user.id,
        accountIdentifier,
      },
    },
    update: {
      color,
    },
    create: {
      userId: session.user.id,
      accountIdentifier,
      color,
    },
    select: {
      id: true,
      accountIdentifier: true,
      color: true,
    },
  });

  return account;
}
