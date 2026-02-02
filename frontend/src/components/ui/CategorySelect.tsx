"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";

interface Category {
  id: string;
  name: string;
  color: string;
}

interface CategorySelectProps {
  value?: string;
  categories: Category[];
  onChange: (categoryId: string) => void;
  onAddClick: () => void;
}

export function CategorySelect({
  value,
  categories,
  onChange,
  onAddClick,
}: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const [showAbove, setShowAbove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedCategory = categories.find((c) => c.id === value);

  const updateDropdownPosition = () => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 240; // max-h-60 = 240px
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Determine if dropdown should show above or below
    const shouldShowAbove =
      spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

    setShowAbove(shouldShowAbove);
    setDropdownPosition({
      top: shouldShowAbove ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();

      // Update position on scroll
      const handleScroll = () => {
        updateDropdownPosition();
      };

      // Listen to scroll on all scrollable parents
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleScroll);

      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleScroll);
      };
    }
  }, [isOpen]);

  const handleSelect = (categoryId: string) => {
    onChange(categoryId);
    setIsOpen(false);
  };

  const handleAddNew = () => {
    setIsOpen(false);
    onAddClick();
  };

  return (
    <div ref={containerRef} className="relative h-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-full flex items-center px-4 py-3 text-sm text-left bg-transparent text-dark dark:text-white outline-none cursor-pointer hover:bg-gray-2 dark:hover:bg-dark-3 transition-all ${
          isOpen ? "ring-2 ring-inset ring-primary" : ""
        }`}
      >
        {selectedCategory ? (
          <>
            <div
              className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
              style={{ backgroundColor: selectedCategory.color }}
            />
            <span className="flex-1 truncate font-medium">
              {selectedCategory.name}
            </span>
          </>
        ) : (
          <span className="flex-1 text-dark-5 dark:text-dark-6">
            Uncategorized
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-dark-5 dark:text-dark-6 ml-2 flex-shrink-0 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed z-20 py-1 bg-white dark:bg-dark-2 border border-stroke dark:border-dark-3 rounded-lg shadow-dropdown max-h-60 overflow-auto"
          style={{
            top: showAbove ? "auto" : dropdownPosition.top,
            bottom: showAbove
              ? window.innerHeight - dropdownPosition.top
              : "auto",
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            transformOrigin: showAbove ? "bottom" : "top",
          }}
        >
          {/* Uncategorized Option */}
          <button
            type="button"
            onClick={() => handleSelect("")}
            className="w-full flex items-center px-4 py-2.5 text-sm text-left hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
          >
            <div className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0 bg-dark-5 dark:bg-dark-6" />
            <span className="flex-1 text-dark dark:text-white">
              Uncategorized
            </span>
            {!value && <Check className="h-4 w-4 text-primary ml-2" />}
          </button>

          {/* Divider */}
          <div className="h-px bg-stroke dark:bg-dark-3 my-1" />

          {/* Category Options */}
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelect(cat.id)}
              className="w-full flex items-center px-4 py-2.5 text-sm text-left hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors"
            >
              <div
                className="w-2.5 h-2.5 rounded-full mr-2 flex-shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="flex-1 text-dark dark:text-white">
                {cat.name}
              </span>
              {value === cat.id && (
                <Check className="h-4 w-4 text-primary ml-2" />
              )}
            </button>
          ))}

          {/* Divider */}
          <div className="h-px bg-stroke dark:bg-dark-3 my-1" />

          {/* Add New Category */}
          <button
            type="button"
            onClick={handleAddNew}
            className="w-full flex items-center px-4 py-2.5 text-sm text-left text-primary hover:bg-gray-2 dark:hover:bg-dark-3 transition-colors font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span>New Category</span>
          </button>
        </div>
      )}
    </div>
  );
}
