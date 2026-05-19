"use client";
import { useState } from "react";
import { ChevronRight, Pencil, Trash2, Lock } from "lucide-react";
import { SCREENS_CONFIG } from "@/lib/permissions/screens";

interface Permission {
  screenName: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

interface Role {
  name: string;
  description: string | null;
  color: string | null;
  isSuperadmin: boolean;
  isSystem: boolean;
}

interface Props {
  role: Role;
  permissions: Permission[];
  onEdit: () => void;
  onDelete: () => void;
  onEditMeta?: () => void;
}

export function RoleRow({ role, permissions, onEdit, onDelete, onEditMeta }: Props) {
  const [expanded, setExpanded] = useState(false);

  const permMap = new Map(permissions.map((p) => [p.screenName, p]));
  const readCount = permissions.filter((p) => p.canRead).length;
  const isReadOnly = role.isSystem || role.isSuperadmin;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface">
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2 transition-colors select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronRight
          size={16}
          className={`shrink-0 text-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
        />

        <span
          className="size-2.5 rounded-full shrink-0"
          style={{ background: role.color ?? "var(--color-primary)" }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-body-sm font-semibold text-text">{role.name}</span>
            {role.isSuperadmin && <span title="Superadmin">👑</span>}
            {role.isSystem && (
              <span title="System role — cannot be edited">
                <Lock size={12} className="text-subtle inline-block" />
              </span>
            )}
          </div>
          {role.description && (
            <p className="text-body-xs text-muted truncate">{role.description}</p>
          )}
        </div>

        <span className="text-body-xs text-muted shrink-0 whitespace-nowrap">
          {readCount}/{SCREENS_CONFIG.length} pages
        </span>

        {/* Action buttons — stop propagation so clicks don't toggle expand */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {!role.isSuperadmin && onEditMeta && (
            <button
              onClick={onEditMeta}
              title="Edit role details"
              className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-3 transition-colors"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={onEdit}
            disabled={isReadOnly}
            title={isReadOnly ? "System roles cannot be edited" : "Edit permissions"}
            className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface-3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onDelete}
            disabled={isReadOnly}
            title={isReadOnly ? "System roles cannot be deleted" : "Delete role"}
            className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded permissions summary */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-surface-2">
          <table className="w-full text-body-xs">
            <thead>
              <tr className="text-muted">
                <th className="text-left py-1 pr-3 font-medium w-32">Screen</th>
                <th className="text-center py-1 px-2 font-medium">Read</th>
                <th className="text-center py-1 px-2 font-medium">Create</th>
                <th className="text-center py-1 px-2 font-medium">Edit</th>
                <th className="text-center py-1 px-2 font-medium">Delete</th>
              </tr>
            </thead>
            <tbody>
              {SCREENS_CONFIG.map(({ key, label }) => {
                const p = permMap.get(key);
                const read = role.isSuperadmin || (p?.canRead ?? false);
                const create = role.isSuperadmin || (p?.canCreate ?? false);
                const edit = role.isSuperadmin || (p?.canEdit ?? false);
                const del = role.isSuperadmin || (p?.canDelete ?? false);
                return (
                  <tr key={key} className="border-t border-border first:border-0">
                    <td className="py-1.5 pr-3 text-text font-medium">{label}</td>
                    <td className="text-center py-1.5 px-2">
                      {read ? <span className="text-success">✓</span> : <span className="text-subtle">–</span>}
                    </td>
                    <td className="text-center py-1.5 px-2">
                      {create ? <span className="text-success">✓</span> : <span className="text-subtle">–</span>}
                    </td>
                    <td className="text-center py-1.5 px-2">
                      {edit ? <span className="text-success">✓</span> : <span className="text-subtle">–</span>}
                    </td>
                    <td className="text-center py-1.5 px-2">
                      {del ? <span className="text-success">✓</span> : <span className="text-subtle">–</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
