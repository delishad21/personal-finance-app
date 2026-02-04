import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db/client";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, username, password } = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 400 },
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user with default settings and categories
    const user = await prisma.user.create({
      data: {
        name,
        username,
        password: hashedPassword,
        settings: {
          create: {
            theme: "light",
            currency: "USD",
            dateFormat: "MM/dd/yyyy",
            defaultTimeframe: "month",
          },
        },
        categories: {
          create: [
            {
              name: "Groceries",
              color: "#4caf50",
              icon: "shopping_cart",
              isDefault: true,
            },
            {
              name: "Dining",
              color: "#ff9800",
              icon: "restaurant",
              isDefault: true,
            },
            {
              name: "Transportation",
              color: "#2196f3",
              icon: "directions_car",
              isDefault: true,
            },
            {
              name: "Utilities",
              color: "#9c27b0",
              icon: "bolt",
              isDefault: true,
            },
            {
              name: "Entertainment",
              color: "#e91e63",
              icon: "movie",
              isDefault: true,
            },
            {
              name: "Shopping",
              color: "#f44336",
              icon: "shopping_bag",
              isDefault: true,
            },
            {
              name: "Health",
              color: "#00bcd4",
              icon: "local_hospital",
              isDefault: true,
            },
            {
              name: "Income",
              color: "#8bc34a",
              icon: "attach_money",
              isDefault: true,
            },
            {
              name: "Transfers",
              color: "#607d8b",
              icon: "swap_horiz",
              isDefault: true,
            },
            {
              name: "Other",
              color: "#9e9e9e",
              icon: "category",
              isDefault: true,
            },
            {
              name: "Uncategorized",
              color: "#9ca3af",
              icon: "label",
              isDefault: true,
            },
          ],
        },
      },
    });

    return NextResponse.json(
      { message: "User created successfully", userId: user.id },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 },
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
