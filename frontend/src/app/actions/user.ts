"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { compare, hash } from "bcryptjs";

export interface UserProfile {
  id: string;
  name: string | null;
  username: string;
  email: string | null;
  baseCurrency: string;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      settings: {
        select: {
          currency: true,
        },
      },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    baseCurrency: user.settings?.currency || "SGD",
  };
}

export async function updateUserProfile(
  data: Omit<UserProfile, "id" | "baseCurrency">,
): Promise<UserProfile> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const existingByUsername = await prisma.user.findFirst({
    where: {
      username: data.username,
      id: { not: session.user.id },
    },
    select: { id: true },
  });

  if (existingByUsername) {
    throw new Error("Username already in use");
  }

  if (data.email) {
    const existingByEmail = await prisma.user.findFirst({
      where: {
        email: data.email,
        id: { not: session.user.id },
      },
      select: { id: true },
    });

    if (existingByEmail) {
      throw new Error("Email already in use");
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      username: data.username,
      email: data.email,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      settings: {
        select: {
          currency: true,
        },
      },
    },
  });
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    baseCurrency: user.settings?.currency || "SGD",
  };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  if (!user?.password) {
    throw new Error("Password not set");
  }

  const valid = await compare(currentPassword, user.password);
  if (!valid) {
    throw new Error("Current password is incorrect");
  }

  const hashed = await hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  });

  return { success: true };
}
