"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";
import { Modal, type ModalType } from "@/components/ui/Modal";
import {
  User,
  Tags,
  WalletCards,
  Settings2,
} from "lucide-react";
import { ManageCategoriesModal } from "@/components/settings/ManageCategoriesModal";
import { ManageAccountsModal } from "@/components/settings/ManageAccountsModal";
import { ChangePasswordModal } from "@/components/settings/ChangePasswordModal";
import {
  updateUserProfile,
  changePassword,
  type UserProfile,
} from "@/app/actions/user";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
} from "@/app/actions/categories";
import {
  updateAccountIdentifier,
  deleteAccountIdentifier,
  upsertAccountNumber,
  type AccountIdentifier,
} from "@/app/actions/accountNumbers";

interface SettingsClientProps {
  user: UserProfile | null;
  initialCategories: Category[];
  initialAccountIdentifiers: AccountIdentifier[];
}

export function SettingsClient({
  user,
  initialCategories,
  initialAccountIdentifiers,
}: SettingsClientProps) {
  const [profile, setProfile] = useState<UserProfile | null>(user);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [accounts, setAccounts] = useState<AccountIdentifier[]>(
    initialAccountIdentifiers,
  );

  const [passwordState, setPasswordState] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [manageAccountsOpen, setManageAccountsOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: "",
    color: "#6366f1",
  });
  const [newAccount, setNewAccount] = useState({
    identifier: "",
    color: "#6366f1",
  });

  const showModal = (
    type: ModalType,
    title: string,
    message: string,
    onConfirm?: () => void,
  ) => {
    setModalState({ isOpen: true, type, title, message, onConfirm });
  };

  const closeModal = () => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleProfileSave = async () => {
    if (!profile) return;
    try {
      const updated = await updateUserProfile({
        name: profile.name,
        username: profile.username,
        email: profile.email,
      });
      setProfile(updated);
      showModal("success", "Profile Updated", "Your profile has been saved.");
    } catch (error) {
      showModal(
        "error",
        "Update Failed",
        error instanceof Error ? error.message : "Failed to update profile",
      );
    }
  };

  const handlePasswordSave = async () => {
    if (!passwordState.current || !passwordState.next) {
      showModal("warning", "Missing Fields", "Fill in all password fields.");
      return;
    }
    if (passwordState.next.length < 6) {
      showModal(
        "warning",
        "Password Too Short",
        "Password must be at least 6 characters.",
      );
      return;
    }
    if (passwordState.next !== passwordState.confirm) {
      showModal(
        "warning",
        "Passwords Mismatch",
        "New password and confirmation do not match.",
      );
      return;
    }
    try {
      await changePassword(passwordState.current, passwordState.next);
      setPasswordState({ current: "", next: "", confirm: "" });
      setPasswordModalOpen(false);
      showModal(
        "success",
        "Password Updated",
        "Password updated successfully.",
      );
    } catch (error) {
      showModal(
        "error",
        "Password Update Failed",
        error instanceof Error ? error.message : "Failed to update password",
      );
    }
  };

  const handleCategoryDelete = (categoryId: string) => {
    showModal(
      "warning",
      "Delete Category",
      "This will remove the category.",
      async () => {
        try {
          await deleteCategory(categoryId);
          setCategories((prev) =>
            prev.filter((item) => item.id !== categoryId),
          );
          showModal("success", "Category Deleted", "Category removed.");
        } catch (error) {
          showModal(
            "error",
            "Delete Failed",
            error instanceof Error
              ? error.message
              : "Failed to delete category",
          );
        }
      },
    );
  };

  const handleAccountDelete = (accountId: string) => {
    showModal(
      "warning",
      "Delete Account",
      "This will remove the account.",
      async () => {
        try {
          await deleteAccountIdentifier(accountId);
          setAccounts((prev) => prev.filter((item) => item.id !== accountId));
          showModal("success", "Account Deleted", "Account removed.");
        } catch (error) {
          showModal(
            "error",
            "Delete Failed",
            error instanceof Error ? error.message : "Failed to delete account",
          );
        }
      },
    );
  };

  const handleSaveAllCategories = async () => {
    try {
      await Promise.all(
        categories.map((category) =>
          updateCategory(category.id, category.name, category.color),
        ),
      );
      showModal("success", "Categories Saved", "All categories updated.");
    } catch (error) {
      showModal(
        "error",
        "Save Failed",
        error instanceof Error ? error.message : "Failed to update categories",
      );
    }
  };

  const handleSaveAllAccounts = async () => {
    try {
      await Promise.all(
        accounts.map((account) =>
          updateAccountIdentifier(
            account.id,
            account.accountIdentifier,
            account.color,
          ),
        ),
      );
      showModal("success", "Accounts Saved", "All accounts updated.");
    } catch (error) {
      showModal(
        "error",
        "Save Failed",
        error instanceof Error ? error.message : "Failed to update accounts",
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-dark dark:text-white">
          Settings
        </h2>
        <p className="text-sm text-dark-5 dark:text-dark-6">
          Manage your profile, categories, and account identifiers.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-primary/20 text-primary flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Profile</CardTitle>
                  <p className="text-sm text-dark-5 dark:text-dark-6 mt-1">
                    Update your account details and credentials.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPasswordModalOpen(true)}
                >
                  Change Password
                </Button>
                <Button variant="primary" size="sm" onClick={handleProfileSave}>
                  Save
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Full name
              </label>
              <TextInput
                value={profile?.name || ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, name: e.target.value } : prev,
                  )
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Username
              </label>
              <TextInput
                value={profile?.username || ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, username: e.target.value } : prev,
                  )
                }
              />
            </div>
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-dark-5 dark:text-dark-6">
                Email address
              </label>
              <TextInput
                value={profile?.email || ""}
                onChange={(e) =>
                  setProfile((prev) =>
                    prev ? { ...prev, email: e.target.value } : prev,
                  )
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-light-4 dark:bg-blue-dark/40 text-blue flex items-center justify-center">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Preferences</CardTitle>
              <p className="text-sm text-dark-5 dark:text-dark-6 mt-1">
                Manage categories and account identifiers.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-stroke dark:border-dark-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-orange-light-3 dark:bg-orange-dark-2/60 text-orange flex items-center justify-center">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-dark dark:text-white">
                    Categories
                  </h4>
                  <p className="text-sm text-dark-5 dark:text-dark-6 mt-1">
                    Color-coded categories for analytics.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setManageCategoriesOpen(true)}
              >
                Manage
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-dark-5 dark:text-dark-6">
              {categories.slice(0, 6).map((category) => (
                <span
                  key={category.id}
                  className="inline-flex items-center gap-2 rounded-full border border-stroke dark:border-dark-3 px-3 py-1"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  {category.name}
                </span>
              ))}
              {categories.length === 0 && <span>No categories yet.</span>}
              {categories.length > 6 && (
                <span className="text-dark-5 dark:text-dark-6">
                  +{categories.length - 6} more
                </span>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-stroke dark:border-dark-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-green-light-5 dark:bg-green-dark/40 text-green flex items-center justify-center">
                  <WalletCards className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-base font-semibold text-dark dark:text-white">
                    Account Identifiers
                  </h4>
                  <p className="text-sm text-dark-5 dark:text-dark-6 mt-1">
                    Accounts tied to imported statements.
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setManageAccountsOpen(true)}
              >
                Manage
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-dark-5 dark:text-dark-6">
              {accounts.slice(0, 6).map((account) => (
                <span
                  key={account.id}
                  className="inline-flex items-center gap-2 rounded-full border border-stroke dark:border-dark-3 px-3 py-1"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: account.color }}
                  />
                  {account.accountIdentifier}
                </span>
              ))}
              {accounts.length === 0 && <span>No accounts yet.</span>}
              {accounts.length > 6 && (
                <span className="text-dark-5 dark:text-dark-6">
                  +{accounts.length - 6} more
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ManageCategoriesModal
        isOpen={manageCategoriesOpen}
        categories={categories}
        newCategory={newCategory}
        onClose={() => setManageCategoriesOpen(false)}
        onNewCategoryChange={setNewCategory}
        onAddCategory={async () => {
          if (!newCategory.name.trim()) return;
          try {
            const created = await createCategory(
              newCategory.name.trim(),
              newCategory.color,
            );
            setCategories((prev) => [...prev, created]);
            setNewCategory({ name: "", color: "#6366f1" });
          } catch (error) {
            showModal(
              "error",
              "Create Failed",
              error instanceof Error
                ? error.message
                : "Failed to create category",
            );
          }
        }}
        onCategoryNameChange={(id, name) =>
          setCategories((prev) =>
            prev.map((item) => (item.id === id ? { ...item, name } : item)),
          )
        }
        onCategoryColorChange={(id, color) =>
          setCategories((prev) =>
            prev.map((item) => (item.id === id ? { ...item, color } : item)),
          )
        }
        onDeleteCategory={handleCategoryDelete}
        onSaveAll={handleSaveAllCategories}
      />

      <ManageAccountsModal
        isOpen={manageAccountsOpen}
        accounts={accounts}
        newAccount={newAccount}
        onClose={() => setManageAccountsOpen(false)}
        onNewAccountChange={setNewAccount}
        onAddAccount={async () => {
          if (!newAccount.identifier.trim()) return;
          try {
            const created = await upsertAccountNumber(
              newAccount.identifier.trim(),
              newAccount.color,
            );
            setAccounts((prev) => {
              const exists = prev.some((item) => item.id === created.id);
              if (exists) {
                return prev.map((item) =>
                  item.id === created.id ? created : item,
                );
              }
              return [...prev, created];
            });
            setNewAccount({ identifier: "", color: "#6366f1" });
          } catch (error) {
            showModal(
              "error",
              "Create Failed",
              error instanceof Error
                ? error.message
                : "Failed to create account identifier",
            );
          }
        }}
        onAccountIdentifierChange={(id, identifier) =>
          setAccounts((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, accountIdentifier: identifier } : item,
            ),
          )
        }
        onAccountColorChange={(id, color) =>
          setAccounts((prev) =>
            prev.map((item) => (item.id === id ? { ...item, color } : item)),
          )
        }
        onDeleteAccount={handleAccountDelete}
        onSaveAll={handleSaveAllAccounts}
      />

      <ChangePasswordModal
        isOpen={passwordModalOpen}
        current={passwordState.current}
        next={passwordState.next}
        confirm={passwordState.confirm}
        onChange={setPasswordState}
        onClose={() => setPasswordModalOpen(false)}
        onSave={handlePasswordSave}
      />

      <Modal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        onConfirm={modalState.onConfirm}
      />
    </div>
  );
}
