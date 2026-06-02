'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useTranslations } from 'next-intl';

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export default function PRFilter({
  isOpen: controlledOpen,
  onToggle,
  showToggle = true,
}: {
  isOpen?: boolean;
  onToggle?: () => void;
  showToggle?: boolean;
}) {
  const {
    allPRs,
    searchQuery,
    selectedUsers,
    setSearchQuery,
    toggleSelectedUser,
    clearSelectedUsers,
  } = useAppStore();

  const t = useTranslations('components.prfilter');
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const users = useMemo(() => {
    const set = new Set<string>();
    allPRs.forEach((pr) => {
      const login = pr.user?.login;
      if (login) set.add(login);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allPRs]);

  const filteredUsers = users.filter((u) =>
    u.toLowerCase().includes(userSearch.toLowerCase())
  );

  const activeCount = selectedUsers.length + (searchQuery ? 1 : 0);

  return (
    <div ref={panelRef} style={{ marginBottom: isOpen ? 12 : 0 }}>
      {/* Filter toggle button */}
      {showToggle && (
        <button
          onClick={() => {
            if (onToggle) onToggle();
            else setInternalOpen(!internalOpen);
          }}
          className="rr-filter-toggle"
          aria-expanded={isOpen}
        >
          <FilterIcon />
          <span>{t('filter')}</span>
          {activeCount > 0 && <span className="rr-filter-badge">{activeCount}</span>}
          <ChevronIcon open={isOpen} />
        </button>
      )}

      {/* Expandable panel */}
      <div
        className="rr-filter-panel"
        style={{
          maxHeight: isOpen ? 400 : 0,
          opacity: isOpen ? 1 : 0,
          overflow: isOpen ? 'visible' : 'hidden',
          transition: 'max-height 0.25s ease, opacity 0.2s ease',
        }}
      >
        <div className="rr-filter-inner">
          {/* User multi-select */}
          <div style={{ position: 'relative' }} ref={userDropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="rr-filter-field-btn"
            >
              <span>{t('users')}</span>
              <span style={{ color: 'var(--muted)' }}>
                {selectedUsers.length === 0
                  ? t('allUsers')
                  : t('selectedUsers', { count: selectedUsers.length })}
              </span>
              <ChevronIcon open={userDropdownOpen} />
            </button>

            {userDropdownOpen && (
              <div className="rr-filter-dropdown">
                <input
                  type="text"
                  placeholder={t('searchUsers')}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="rr-filter-search-input"
                />
                {selectedUsers.length > 0 && (
                  <div className="rr-filter-clear-row">
                    <button onClick={clearSelectedUsers} className="rr-filter-clear-btn">
                      {t('clearSelection')}
                    </button>
                  </div>
                )}
                <div className="rr-filter-options">
                  {filteredUsers.map((user) => (
                    <label key={user} className="rr-filter-option">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user)}
                        onChange={() => toggleSelectedUser(user)}
                        className="accent-cyan"
                      />
                      <span className="rr-filter-option-text">{user}</span>
                    </label>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="rr-filter-empty">
                      {allPRs.length === 0 ? t('loadPRsFirst') : t('noUsers')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Text search */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="rr-filter-label">{t('ticketSearch')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder={t('ticketPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rr-filter-text-input"
                style={{ paddingRight: searchQuery ? 32 : 12 }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="rr-filter-input-clear"
                  title={t('clearSearch')}
                  type="button"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
