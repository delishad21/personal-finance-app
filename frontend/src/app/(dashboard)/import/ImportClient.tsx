"use client";

import { useState } from "react";
import { parseFile } from "@/app/actions/parser";
import { createCategory } from "@/app/actions/categories";
import { AddCategoryModal } from "@/components/ui/AddCategoryModal";
import { UploadSection } from "../../../components/import/UploadSection";
import { TransactionTable } from "../../../components/import/TransactionTable";

interface Transaction {
  date: string;
  description: string;
  label?: string;
  categoryId?: string;
  amountIn?: number;
  amountOut?: number;
  balance?: number;
  metadata: Record<string, any>;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface ParseResult {
  success: boolean;
  filename: string;
  parserId: string;
  transactions: Transaction[];
  count: number;
}

interface ParserOption {
  value: string;
  label: string;
  description: string;
}

interface ImportClientProps {
  initialCategories: Category[];
  parserOptions: ParserOption[];
}

export function ImportClient({
  initialCategories,
  parserOptions,
}: ImportClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedParser, setSelectedParser] = useState<string>(
    parserOptions[0]?.value || "generic_csv",
  );
  const [parsedData, setParsedData] = useState<ParseResult | null>(null);
  const [editedTransactions, setEditedTransactions] = useState<Transaction[]>(
    [],
  );
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsUploading(true);
    setError(null);
    setParsedData(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("parserId", selectedParser);

      const result = await parseFile(formData);

      if (!result || !result.transactions) {
        throw new Error("Invalid response from parser service");
      }

      setParsedData(result);

      const initialTransactions = result.transactions.map((t) => ({
        ...t,
        label: "",
      }));
      setEditedTransactions(initialTransactions);

      if (result.transactions[0]?.metadata?.accountNumber) {
        setAccountNumber(result.transactions[0].metadata.accountNumber);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateTransaction = (
    index: number,
    field: string,
    value: any,
  ) => {
    const updated = [...editedTransactions];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTransactions(updated);
  };

  const handleAddCategory = async (name: string, color: string) => {
    try {
      // Save to database via server action
      const newCategory = await createCategory(name, color);

      // Update local state with the database-created category
      setCategories([...categories, newCategory]);
    } catch (error) {
      console.error("Failed to create category:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create category",
      );
    }
  };

  const handleImportTransactions = async () => {
    if (!parsedData) return;
    alert(
      `TODO: Import ${parsedData.count} transactions to database. This will be implemented with Prisma.`,
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0">
        <UploadSection
          file={file}
          selectedParser={selectedParser}
          parserOptions={parserOptions}
          isUploading={isUploading}
          error={error}
          onFileSelect={(file) => {
            setFile(file);
            setError(null);
          }}
          onParserChange={setSelectedParser}
          onUpload={handleUpload}
        />
      </div>

      {parsedData && (
        <TransactionTable
          parsedData={parsedData}
          transactions={editedTransactions}
          categories={categories}
          accountNumber={accountNumber}
          onUpdateTransaction={handleUpdateTransaction}
          onAccountNumberChange={setAccountNumber}
          onImport={handleImportTransactions}
          onAddCategoryClick={() => setIsAddCategoryModalOpen(true)}
        />
      )}

      <AddCategoryModal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        onAdd={handleAddCategory}
      />
    </div>
  );
}
