"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export async function getCategories(): Promise<Category[]> {
  const session = await auth();

  if (!session?.user?.id) {
    return [];
  }

  const categories = await prisma.category.findMany({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      name: true,
      color: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return categories;
}

export async function createCategory(
  name: string,
  color: string,
): Promise<Category> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  const category = await prisma.category.create({
    data: {
      userId: session.user.id,
      name,
      color,
    },
    select: {
      id: true,
      name: true,
      color: true,
    },
  });

  return category;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // Verify the category belongs to the user before deleting
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId: session.user.id,
    },
  });

  if (!category) {
    throw new Error("Category not found or unauthorized");
  }

  // Delete the category (transactions will have categoryId set to null due to onDelete: SetNull)
  await prisma.category.delete({
    where: {
      id: categoryId,
    },
  });
}

export async function updateCategory(
  categoryId: string,
  name: string,
  color: string,
): Promise<Category> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  // Verify the category belongs to the user before updating
  const existingCategory = await prisma.category.findFirst({
    where: {
      id: categoryId,
      userId: session.user.id,
    },
  });

  if (!existingCategory) {
    throw new Error("Category not found or unauthorized");
  }

  const category = await prisma.category.update({
    where: {
      id: categoryId,
    },
    data: {
      name,
      color,
    },
    select: {
      id: true,
      name: true,
      color: true,
    },
  });

  return category;
}
