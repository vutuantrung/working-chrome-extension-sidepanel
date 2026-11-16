import api from "../../infrastructure/api";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { personaClient } from "../../application/services/SidepanelServices";
import StatusScreen from "../../components/Persona/StatusScreen";
import PersonaCard from "../../components/Persona/PersonaCard";
import { useTranslation } from "../../helpers/i18n";
import type { PersonaSummary } from "../../types/PersonaContracts";
import "../../assets/css/pages/PersonaPage.css";

/**
 * Decision flow on mount:
 *   0 personas → create → activePersonaSession → navigate
 *   1 persona  → auto-select → activePersonaSession → navigate  (no UI)
 *  ≥2 personas → show selection UI → activePersonaSession → navigate
 */
const SelectPersona: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, applyPersonaOnSelect } = useAuth();

  type ViewState = "initializing" | "creating" | "activating" | "select";
  const [viewState, setViewState] = useState<ViewState>("initializing");
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activateAndProceed = async (persona: PersonaSummary) => {
    setViewState("activating");
    setErrorMsg(null);

    try {
      // R2.3 will combine validated selection and activation in Background.
      const selection = await personaClient.select(persona.id);
      if (selection.selectedPersonaId !== persona.id) throw new Error("Persona selection not acknowledged");
      await api.extensionUser.activatePersonaSession(persona.id);
      await applyPersonaOnSelect(persona);
      navigate("/facebook-login-mode");
    } catch (err) {
      console.error("[SelectPersona] activateAndProceed error:", err);
      setErrorMsg(t("personaActivateError"));
      setViewState("select");
    }
  };

  useEffect(() => {
    const init = async () => {
      setViewState("initializing");
      setErrorMsg(null);

      try {
        const prepared = await personaClient.prepareSelection();
        setPersonas(prepared.candidates);
        if (prepared.recommendedPersonaId) {
          const recommended = prepared.candidates.find(p => p.id === prepared.recommendedPersonaId);
          if (!recommended) throw new Error("Invalid recommended persona");
          await activateAndProceed(recommended);
          return;
        }
      } catch {
        setErrorMsg(t("personaLoadError"));
      }
      setViewState("select");
    };

    if (user?.id) void init();
  }, [user?.id]);

  const handleContinue = async () => {
    if (!selectedId || confirming) return;
    const persona = personas.find((p) => p.id === selectedId);
    if (!persona) return;
    setConfirming(true);
    try {
      await activateAndProceed(persona);
    } finally {
      setConfirming(false);
    }
  };

  if (viewState === "initializing") {
    return (
      <div className="persona-page">
        <StatusScreen icon="⏳" title={t("loadingPersonas")} />
      </div>
    );
  }

  if (viewState === "creating") {
    return (
      <div className="persona-page">
        <StatusScreen
          icon="✨"
          title={t("creatingPersona")}
          subtitle={t("justMoment")}
        />
      </div>
    );
  }

  if (viewState === "activating") {
    return (
      <div className="persona-page">
        <StatusScreen icon="🔄" title={t("activatingPersona")} />
      </div>
    );
  }

  return (
    <div className="persona-page">
      <div className="persona-panel">
        <div className="persona-panel__header">
          <h2 className="persona-panel__title">
            {t("selectPersona")}
          </h2>
          <p className="persona-panel__subtitle">
            {t("selectPersonaHint")}
          </p>
        </div>

        {errorMsg && (
          <div className="persona-panel__error">
            <span>⚠️</span>
            {errorMsg}
          </div>
        )}

        <div className="persona-panel__list">
          {personas.length === 0 ? (
            <div className="persona-panel__empty">
              {t("noPersonas")}
            </div>
          ) : (
            personas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedId === p.id}
                onSelect={() =>
                  setSelectedId((prev) => (prev === p.id ? null : p.id))
                }
              />
            ))
          )}
        </div>

        <div className="persona-panel__footer">
          <button
            onClick={handleContinue}
            disabled={!selectedId || confirming}
            className="persona-primary-btn"
          >
            {confirming ? t("activating") : `${t("continue")} →`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectPersona;
