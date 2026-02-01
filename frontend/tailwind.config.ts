import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        current: "currentColor",
        transparent: "transparent",
        white: "#FFFFFF",
        black: "#000000",
        primary: "#5750F1",
        stroke: "#E6EBF1",
        "stroke-dark": "#27303E",
        dark: {
          DEFAULT: "#111928",
          2: "#1F2A37",
          3: "#374151",
          4: "#4B5563",
          5: "#6B7280",
          6: "#9CA3AF",
          7: "#D1D5DB",
          8: "#E5E7EB",
        },
        gray: {
          DEFAULT: "#EFF4FB",
          dark: "#122031",
          1: "#F9FAFB",
          2: "#F3F4F6",
          3: "#E5E7EB",
          4: "#D1D5DB",
          5: "#9CA3AF",
          6: "#6B7280",
          7: "#374151",
        },
        green: {
          DEFAULT: "#22AD5C",
          dark: "#1A8245",
          light: {
            DEFAULT: "#2CD673",
            1: "#10B981",
            2: "#34D399",
            3: "#A7F3D0",
            4: "#D1FAE5",
            5: "#ECFDF5",
          },
        },
        red: {
          DEFAULT: "#F23030",
          dark: "#DC2626",
          light: {
            DEFAULT: "#F87171",
            1: "#EF4444",
            2: "#FCA5A5",
            3: "#FECACA",
            4: "#FEE2E2",
            5: "#FEF2F2",
          },
        },
        yellow: {
          DEFAULT: "#FFC107",
          dark: "#F59E0B",
          light: {
            DEFAULT: "#FCD34D",
            1: "#FBBF24",
            2: "#FDE68A",
            3: "#FEF3C7",
            4: "#FEFCE8",
          },
        },
        blue: {
          DEFAULT: "#3C50E0",
          dark: "#1E3A8A",
          light: {
            DEFAULT: "#60A5FA",
            1: "#3B82F6",
            2: "#93C5FD",
            3: "#DBEAFE",
            4: "#EFF6FF",
          },
        },
      },
      fontSize: {
        "heading-1": ["44px", { lineHeight: "55px", fontWeight: "700" }],
        "heading-2": ["36px", { lineHeight: "45px", fontWeight: "700" }],
        "heading-3": ["28px", { lineHeight: "35px", fontWeight: "700" }],
        "heading-4": ["24px", { lineHeight: "30px", fontWeight: "700" }],
        "heading-5": ["20px", { lineHeight: "28px", fontWeight: "700" }],
        "heading-6": ["18px", { lineHeight: "26px", fontWeight: "700" }],
      },
      boxShadow: {
        "card-1": "0px 1px 3px rgba(0, 0, 0, 0.08)",
        "card-2": "0px 1px 2px rgba(0, 0, 0, 0.06)",
        dropdown:
          "0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.05)",
        1: "0px 1px 2px 0px rgba(0, 0, 0, 0.06), 0px 1px 3px 0px rgba(0, 0, 0, 0.1)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
