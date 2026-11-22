'use client';

import { KeyRound, X } from 'lucide-react';

export interface PendingResetRequest {
  id: string;
  userId: string;
  name: string;
  firstName: string;
  email: string;
  phone: string;
  role: string;
  serviceName: string;
  regionName: string;
  note: string;
  createdAt: string;
}

export default function AdminResetRequests({
  requests,
  busy,
  onSelectUser,
  onDismiss,
}: {
  requests: PendingResetRequest[];
  busy: boolean;
  onSelectUser: (userId: string) => void;
  onDismiss: (userId: string) => void;
}) {
  const hasPending = requests.length > 0;

  return (
    <div
      id="admin-reset-requests-panel"
      className={
        hasPending
          ? 'panel space-y-3 border-amber-200 bg-amber-50/40'
          : 'panel space-y-2'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-navy flex items-center gap-2">
            <KeyRound
              size={17}
              className={hasPending ? 'text-amber-700' : 'text-slate-500'}
              aria-hidden="true"
            />
            Demandes de réinitialisation en attente ({requests.length})
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {hasPending
              ? 'Ces utilisateurs ont sollicité l’administrateur depuis l’écran de connexion. Générez un code à 6 chiffres ou définissez un nouveau mot de passe.'
              : 'Aucune demande en attente. Lorsqu’un utilisateur clique sur « Mot de passe oublié ? » depuis l’écran de connexion, sa demande s’affiche automatiquement ici.'}
          </p>
        </div>
      </div>

      {hasPending && (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rattachement &amp; note</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id}>
                  <td>
                    <strong className="text-navy">
                      {req.firstName} {req.name}
                    </strong>
                    <div className="text-xs text-slate-600">
                      {req.email}
                      {req.phone ? ` · ${req.phone}` : ''}
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-700">
                      {[req.role, req.serviceName || req.regionName]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                    {req.note && (
                      <div className="text-xs text-slate-600 mt-0.5">
                        {req.note}
                      </div>
                    )}
                  </td>
                  <td className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {new Date(req.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn green whitespace-nowrap shrink-0"
                        disabled={busy}
                        onClick={() => onSelectUser(req.userId)}
                      >
                        Traiter
                      </button>
                      <button
                        type="button"
                        className="btn alt inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        disabled={busy}
                        onClick={() => onDismiss(req.userId)}
                      >
                        <X size={14} aria-hidden="true" />
                        Clôturer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
