"use client";

import { useState } from "react";
import { parseFile } from "@/app/actions/parser";
import { createCategory } from "@/app/actions/categories";
import {
  checkImportDuplicates,
  commitImport,
  type DuplicateMatch,
} from "@/app/actions/transactions";
import { AddCategoryModal } from "@/components/ui/AddCategoryModal";
import { Modal, type ModalType } from "@/components/ui/Modal";
import { UploadSection } from "./UploadSection";
import { TransactionTable } from "@/components/transaction-table/TransactionTable";

type ImportStage = "upload" | "review" | "duplicates" | "complete";

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
  // Stage management
  const [stage, setStage] = useState<ImportStage>("upload");

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

  // Selection state - all transactions selected by default after parsing
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );

  // Duplicate detection state
  const [duplicates, setDuplicates] = useState<Map<number, DuplicateMatch[]>>(
    new Map(),
  );
  const [nonDuplicateIndices, setNonDuplicateIndices] = useState<Set<number>>(
    new Set(),
  );
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const showModal = (type: ModalType, title: string, message: string) => {
    setModalState({ isOpen: true, type, title, message });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file");
      return;
    }

    setIsUploading(true);
    setError(null);
    setParsedData(null);

    // Clear all state when parsing a new file
    setDuplicates(new Map());
    setSelectedIndices(new Set());
    setNonDuplicateIndices(new Set());

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
        label: t.label && t.label.trim().length > 0 ? t.label : t.description,
      }));
      setEditedTransactions(initialTransactions);

      // Select all transactions by default
      setSelectedIndices(new Set(initialTransactions.map((_, index) => index)));

      if (result.transactions[0]?.metadata?.accountNumber) {
        setAccountNumber(result.transactions[0].metadata.accountNumber);
      }

      // Move to review stage
      setStage("review");
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
      showModal(
        "error",
        "Failed to Create Category",
        error instanceof Error ? error.message : "Failed to create category",
      );
    }
  };

  const handleImportTransactions = async () => {
    if (!parsedData || selectedIndices.size === 0) return;

    setIsCheckingDuplicates(true);
    setError(null);

    try {
      // Get only the selected transactions
      const selectedTransactions = Array.from(selectedIndices)
        .sort((a, b) => a - b)
        .map((index) => ({
          ...editedTransactions[index],
          date: new Date(editedTransactions[index].date),
        }));

      // Check for duplicates
      const result = await checkImportDuplicates(selectedTransactions);

      if (result.duplicates.length > 0) {
        // Map duplicate indices back to original transaction indices
        const duplicateMap = new Map<number, DuplicateMatch[]>();
        result.duplicates.forEach(({ index, matches }) => {
          const originalIndex = Array.from(selectedIndices)[index];
          duplicateMap.set(originalIndex, matches);
        });
        setDuplicates(duplicateMap);

        // Store non-duplicate indices for later import
        const duplicateOriginalIndices = new Set(
          result.duplicates.map(
            ({ index }) => Array.from(selectedIndices)[index],
          ),
        );
        const nonDups = new Set(
          Array.from(selectedIndices).filter(
            (i) => !duplicateOriginalIndices.has(i),
          ),
        );
        setNonDuplicateIndices(nonDups);

        // Clear current selection - user will select duplicates to import
        setSelectedIndices(new Set());

        // Move to duplicates stage
        setStage("duplicates");
      } else {
        // No duplicates - import all selected
        await performImport(selectedIndices);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check duplicates",
      );
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const performImport = async (indices: Set<number>) => {
    if (!parsedData || indices.size === 0) return;

    setIsImporting(true);
    setError(null);

    try {
      const result = await commitImport(
        editedTransactions.map((t) => ({
          ...t,
          date: new Date(t.date),
        })),
        Array.from(indices),
        {
          filename: parsedData.filename,
          fileType: file?.type || "unknown",
          parserId: parsedData.parserId,
        },
      );

      if (result.success) {
        showModal(
          "success",
          "Import Successful",
          `Successfully imported ${result.importedCount} transaction${result.importedCount !== 1 ? "s" : ""} into your account!`,
        );
        // Reset to upload stage
        setStage("upload");
        setParsedData(null);
        setEditedTransactions([]);
        setFile(null);
        setDuplicates(new Map());
        setSelectedIndices(new Set());
        setNonDuplicateIndices(new Set());
      } else {
        throw new Error(result.error || "Import failed");
      }
    } catch (err) {
      showModal(
        "error",
        "Import Failed",
        err instanceof Error ? err.message : "Failed to import transactions",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleSelectAll = () => {
    setSelectedIndices(new Set(editedTransactions.map((_, i) => i)));
  };

  const handleDeselectAll = () => {
    setSelectedIndices(new Set());
  };

  const handleToggleSelection = (index: number) => {
    const newSelection = new Set(selectedIndices);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedIndices(newSelection);
  };

  const handleConfirmImport = async () => {
    // Import both selected duplicates AND non-duplicates
    const allIndicesToImport = new Set([
      ...selectedIndices,
      ...nonDuplicateIndices,
    ]);
    await performImport(allIndicesToImport);
  };

  const handleBackFromReview = () => {
    setStage("upload");
  };

  const handleBackFromDuplicates = () => {
    // Go back to review stage, restore original selection
    setStage("review");
    const allOriginalIndices = new Set([
      ...selectedIndices,
      ...nonDuplicateIndices,
      ...Array.from(duplicates.keys()),
    ]);
    setSelectedIndices(allOriginalIndices);
    setDuplicates(new Map());
    setNonDuplicateIndices(new Set());
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {stage === "upload" && (
        <div className="flex-1 p-8 overflow-hidden">
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
      )}

      {(stage === "review" || stage === "duplicates") && parsedData && (
        <TransactionTable
          parsedData={parsedData}
          transactions={editedTransactions}
          categories={categories}
          accountNumber={accountNumber}
          duplicates={stage === "duplicates" ? duplicates : undefined}
          selectedIndices={selectedIndices}
          nonDuplicateIndices={nonDuplicateIndices}
          isCheckingDuplicates={isCheckingDuplicates}
          isImporting={isImporting}
          showDuplicatesOnly={stage === "duplicates"}
          onUpdateTransaction={handleUpdateTransaction}
          onAccountNumberChange={setAccountNumber}
          onImport={handleImportTransactions}
          onConfirmImport={handleConfirmImport}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onToggleSelection={handleToggleSelection}
          onAddCategoryClick={() => setIsAddCategoryModalOpen(true)}
          onBack={
            stage === "review" ? handleBackFromReview : handleBackFromDuplicates
          }
        />
      )}

      <AddCategoryModal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        onAdd={handleAddCategory}
      />

      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
      />
    </div>
  );
}
