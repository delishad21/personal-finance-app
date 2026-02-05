"use client";

import { useState } from "react";
import { parseFile } from "@/app/actions/parser";
import { createCategory } from "@/app/actions/categories";
import { upsertAccountNumber } from "@/app/actions/accountNumbers";
import {
  checkImportDuplicates,
  commitImport,
  type DuplicateMatch,
} from "@/app/actions/transactions";
import { AddCategoryModal } from "@/components/ui/AddCategoryModal";
import { Modal, type ModalType } from "@/components/ui/Modal";
import { NewAccountColorModal } from "@/components/ui/NewAccountColorModal";
import { AddAccountIdentifierModal } from "@/components/ui/AddAccountIdentifierModal";
import { UploadSection } from "./UploadSection";
import { TransactionTable } from "@/components/transaction-table/TransactionTable";
import { ReimbursementSelectorModal } from "./ReimbursementSelectorModal";
import type { TransactionLinkage } from "@/components/transaction-table/types";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
];

type ImportStage = "upload" | "review" | "duplicates" | "complete";

interface Transaction {
  date: string;
  description: string;
  label?: string;
  categoryId?: string;
  amountIn?: number;
  amountOut?: number;
  balance?: number;
  accountIdentifier?: string;
  accountNumber?: string;
  metadata: Record<string, any>;
  linkage?: TransactionLinkage | null;
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

interface AccountIdentifier {
  id: string;
  accountIdentifier: string;
  color: string;
}

interface ImportClientProps {
  initialCategories: Category[];
  initialAccountNumbers: AccountIdentifier[];
  parserOptions: ParserOption[];
}

export function ImportClient({
  initialCategories,
  initialAccountNumbers,
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
  const [accountIdentifier, setAccountIdentifier] = useState<string>("");
  const [accountColor, setAccountColor] = useState<string>("#6366f1");
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [showNewAccountModal, setShowNewAccountModal] = useState(false);
  const [accountIdentifiers, setAccountIdentifiers] = useState<
    AccountIdentifier[]
  >(initialAccountNumbers);
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);

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

  // Reimbursement selector modal state
  const [reimbursementModalOpen, setReimbursementModalOpen] = useState(false);
  const [reimbursementTargetIndex, setReimbursementTargetIndex] = useState<
    number | null
  >(null);

  const showModal = (type: ModalType, title: string, message: string) => {
    setModalState({ isOpen: true, type, title, message });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  // Handle linkage changes (internal/reimbursement marking)
  const handleLinkageChange = (
    index: number,
    linkage: TransactionLinkage | null,
  ) => {
    const updated = [...editedTransactions];
    updated[index] = { ...updated[index], linkage };

    // Auto-assign category based on linkage type
    // The actual category ID will be assigned on commit by the backend
    // For now, we just mark it and clear any user-set category
    if (linkage?.type === "internal" || linkage?.type === "reimbursement") {
      const reservedName =
        linkage.type === "internal" ? "Internal" : "Reimbursement";
      const reservedCategory = categories.find(
        (category) => category.name === reservedName,
      );
      updated[index].categoryId = reservedCategory?.id;
    } else if (!linkage) {
      const currentCategory = categories.find(
        (category) => category.id === updated[index].categoryId,
      );
      if (
        currentCategory?.name === "Internal" ||
        currentCategory?.name === "Reimbursement"
      ) {
        updated[index].categoryId = undefined;
      }
    }

    setEditedTransactions(updated);
  };

  // Open reimbursement selector modal
  const handleOpenReimbursementSelector = (index: number) => {
    setReimbursementTargetIndex(index);
    setReimbursementModalOpen(true);
  };

  // Confirm reimbursement selection
  const handleConfirmReimbursement = (linkage: TransactionLinkage) => {
    if (reimbursementTargetIndex !== null) {
      const currentLinkage =
        editedTransactions[reimbursementTargetIndex]?.linkage;
      if (currentLinkage?.type === "internal") {
        showModal(
          "warning",
          "Invalid Reimbursement",
          "Internal transactions cannot be marked as reimbursements. Clear the internal flag first.",
        );
      } else {
        handleLinkageChange(reimbursementTargetIndex, linkage);
      }
    }
    setReimbursementModalOpen(false);
    setReimbursementTargetIndex(null);
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
        label: t.label && t.label.trim().length > 0 ? t.label : undefined,
      }));
      setEditedTransactions(initialTransactions);

      // Select all transactions by default
      setSelectedIndices(new Set(initialTransactions.map((_, index) => index)));

      // Detect and handle account identifier (from transaction root or metadata)
      const detectedAccount =
        (result as any)?.accountIdentifier ||
        (result.transactions[0] as any)?.accountIdentifier ||
        result.transactions[0]?.accountNumber ||
        result.transactions[0]?.metadata?.accountIdentifier ||
        result.transactions[0]?.metadata?.accountNumber;
      if (detectedAccount) {
        const existingAccount = accountIdentifiers.find(
          (acc) => acc.accountIdentifier === detectedAccount,
        );

        if (existingAccount) {
          // Existing account - auto-select with saved color
          setAccountIdentifier(existingAccount.accountIdentifier);
          setAccountColor(existingAccount.color);
          setIsNewAccount(false);
        } else {
          // New account - assign random color and prompt user
          const randomColor =
            PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
          setAccountIdentifier(detectedAccount);
          setAccountColor(randomColor);
          setIsNewAccount(true);
          setShowNewAccountModal(true);
        }
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
          accountIdentifier:
            accountIdentifier.trim().length > 0
              ? accountIdentifier.trim()
              : undefined,
          label:
            t.label && t.label.trim().length > 0
              ? t.label.trim()
              : t.description,
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

  const resetImportFlow = () => {
    setStage("upload");
    setParsedData(null);
    setEditedTransactions([]);
    setFile(null);
    setDuplicates(new Map());
    setSelectedIndices(new Set());
    setNonDuplicateIndices(new Set());
    setAccountIdentifier("");
    setAccountColor("#6366f1");
    setIsNewAccount(false);
    setShowNewAccountModal(false);
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

  const handleSaveAccountIdentifier = async (
    identifier: string,
    color: string,
  ) => {
    try {
      const saved = await upsertAccountNumber(identifier, color);
      setAccountIdentifiers((prev) => {
        const exists = prev.some(
          (acc) => acc.accountIdentifier === saved.accountIdentifier,
        );
        return exists
          ? prev.map((acc) =>
              acc.accountIdentifier === saved.accountIdentifier ? saved : acc,
            )
          : [...prev, saved];
      });
      setAccountIdentifier(saved.accountIdentifier);
      setAccountColor(saved.color);
      setIsNewAccount(false);
    } catch (err) {
      showModal(
        "error",
        "Failed to Save Account",
        err instanceof Error ? err.message : "Failed to save account",
      );
    }
  };

  const handleConfirmAccountColor = async (color: string) => {
    if (!accountIdentifier) return;
    await handleSaveAccountIdentifier(accountIdentifier, color);
    setShowNewAccountModal(false);
  };

  const handleAddAccountIdentifier = () => {
    setIsAddAccountModalOpen(true);
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
          accountIdentifier={accountIdentifier}
          accountColor={accountColor}
          accountIdentifiers={accountIdentifiers}
          isNewAccount={isNewAccount}
          duplicates={stage === "duplicates" ? duplicates : undefined}
          selectedIndices={selectedIndices}
          nonDuplicateIndices={nonDuplicateIndices}
          isCheckingDuplicates={isCheckingDuplicates}
          isImporting={isImporting}
          showDuplicatesOnly={stage === "duplicates"}
          onUpdateTransaction={handleUpdateTransaction}
          onAccountIdentifierChange={setAccountIdentifier}
          onAccountColorChange={setAccountColor}
          onAddAccountIdentifier={handleAddAccountIdentifier}
          onImport={handleImportTransactions}
          onConfirmImport={handleConfirmImport}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onToggleSelection={handleToggleSelection}
          onAddCategoryClick={() => setIsAddCategoryModalOpen(true)}
          onBack={
            stage === "review" ? handleBackFromReview : handleBackFromDuplicates
          }
          onLinkageChange={stage === "review" ? handleLinkageChange : undefined}
          onOpenReimbursementSelector={
            stage === "review" ? handleOpenReimbursementSelector : undefined
          }
        />
      )}

      <AddCategoryModal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        onAdd={handleAddCategory}
      />

      <NewAccountColorModal
        isOpen={showNewAccountModal}
        accountIdentifier={accountIdentifier}
        defaultColor={accountColor}
        onConfirm={handleConfirmAccountColor}
        onCancel={resetImportFlow}
      />

      <AddAccountIdentifierModal
        isOpen={isAddAccountModalOpen}
        onCancel={() => setIsAddAccountModalOpen(false)}
        onConfirm={async (identifier, color) => {
          await handleSaveAccountIdentifier(identifier, color);
          setIsAddAccountModalOpen(false);
        }}
      />

      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
      />

      <ReimbursementSelectorModal
        isOpen={reimbursementModalOpen}
        onClose={() => {
          setReimbursementModalOpen(false);
          setReimbursementTargetIndex(null);
        }}
        onConfirm={handleConfirmReimbursement}
        currentIndex={reimbursementTargetIndex ?? 0}
        transactions={editedTransactions}
        currentLinkage={
          reimbursementTargetIndex !== null
            ? editedTransactions[reimbursementTargetIndex]?.linkage
            : null
        }
      />
    </div>
  );
}
