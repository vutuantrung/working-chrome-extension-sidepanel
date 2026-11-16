import WorkspacePageHeader from "../../components/WorkspacePageHeader";
import "../../assets/css/features/platform.css";
import React, { useEffect, useState } from "react";
import {
  appStorage,
  extensionStorage,
  localStorageService,
} from "../../../../entrypoints/sidepanel/application/services/SidepanelServices";
import { useLocation, useNavigate } from "react-router-dom";
import { setSelectedPlatformId } from "../../helpers/helpers";
import { PLATFORMS } from "../../helpers/helpers-ui";
import { useAuth } from "../../contexts/AuthContext";
import type { PlatformId, PlatformObject } from "../../types/types";
import PlatformSelect from "../../components/PlatformSelect";
import { useTranslation } from "../../helpers/i18n";
import { localizeOptions, LOGIN_ERROR_MESSAGES } from "../../helpers/constants";

const chromeStorageKey = (id: PlatformId) => id === "facebook" ? "fbLoginMode" : `${id}LoginMode`;
const localStorageKey = (id: PlatformId) => id === "facebook" ? "local:fbLoginMode" : `local:${id}LoginMode`;

const FacebookLoginMode: React.FC = () => {
  const { t } = useTranslation();
  const { loginWithMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<"platform" | "loginMode">("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformObject | null>(null);
  const [busyId, setBusyId] = useState<PlatformId | null>(null);
  const [busyMode, setBusyMode] = useState<"auto" | "manual" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const navState = location.state as { platformId?: string } | null;
    if (navState?.platformId) {
      const platform = PLATFORMS.find((p) => p.id === navState.platformId);
      if (platform && !platform.disabled) {
        setSelectedPlatform(platform);
        setStep("loginMode");
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, []);

  const handleSelectPlatform = async (platform: PlatformObject) => {
    setErrorMessage(null);
    setSelectedPlatform(platform);
    setSelectedPlatformId(platform.id);

    try {
      const key = chromeStorageKey(platform.id);
      const result = await extensionStorage.get(key);
      const savedValue = result?.[key];
      const savedMode = typeof savedValue === "object" && savedValue !== null ? savedValue.mode : savedValue;
      const hasActiveSession =
        localStorageService.getItem("fbLoginModeSelected") === "1";

      if ((savedMode === "auto" || savedMode === "manual") && hasActiveSession) {
        setBusyId(platform.id);

        const loginResult = await loginWithMode(savedMode, platform.id);
        setBusyId(null);

        console.log("Login result for platform:", platform.id, loginResult);

        if (loginResult.success === true) {
          console.log("Login successful for platform:", platform.id);
          localStorageService.setItem("login:login-success-redirect", "1");
          localStorageService.setItem("fbLoginModeSelected", "1");
          setSelectedPlatformId(platform.id);
          // Notify AppRoutes to sync React state before navigation so there
          // is no stale intermediate render with hasSelectedFbMode=false.
          window.dispatchEvent(new Event("localStorageSync"));
          console.log("Navigating to home after successful login for platform:", platform.id);
          navigate("/");
          return;
        }

        await extensionStorage.remove(key);
        await appStorage.removeItem(localStorageKey(platform.id) as any);
        localStorageService.removeItem("fbLoginModeSelected");

        setErrorMessage(
          localizeOptions(LOGIN_ERROR_MESSAGES, t).find(opt => opt.id === (loginResult.reason ?? "unknown"))?.label ??
          localizeOptions(LOGIN_ERROR_MESSAGES, t).find(opt => opt.id === "unknown")?.label ?? ""
        );
        setStep("loginMode");
        return;
      }
    } catch {
      setErrorMessage(localizeOptions(LOGIN_ERROR_MESSAGES, t).find(opt => opt.id === "unknown")?.label ?? "");
    } finally { setBusyId(null); }

    setStep("loginMode");
  };

  const handleLoginMode = async (mode: "auto" | "manual") => {
    console.log("Handling login mode:", mode, busyMode);
    if (!selectedPlatform || busyMode) return;
    setErrorMessage(null);
    console.log("Selected platform:", selectedPlatform);

    try {
      await extensionStorage.set({ [chromeStorageKey(selectedPlatform.id)]: mode });
    } catch { }

    try {
      await appStorage.setItem("local:fbLoginMode", {
        mode,
        platform: selectedPlatform.id,
      });
    } catch { }

    setBusyMode(mode);

    const result = await loginWithMode(mode, selectedPlatform.id).catch(() => ({ success: false as const, reason: "unknown" as const }));
    setBusyMode(null);

    if (result.success === true) {
      console.log("Login successful for platform:", selectedPlatform.id);
      localStorageService.setItem("login:login-success-redirect", "1");
      localStorageService.setItem("fbLoginModeSelected", "1");
      setSelectedPlatformId(selectedPlatform.id);
      // Notify AppRoutes to sync React state before navigation so there
      // is no stale intermediate render with hasSelectedFbMode=false.
      window.dispatchEvent(new Event("localStorageSync"));
      console.log("Navigating to home after successful login for platform:", selectedPlatform.id);
      navigate("/");
      return;
    }

    try {
      await extensionStorage.remove(chromeStorageKey(selectedPlatform.id));
      await appStorage.removeItem(localStorageKey(selectedPlatform.id) as any);
      localStorageService.removeItem("fbLoginModeSelected");
    } catch { }

    setErrorMessage(
      localizeOptions(LOGIN_ERROR_MESSAGES, t).find(opt => opt.id === (result.reason ?? "unknown"))?.label ??
      localizeOptions(LOGIN_ERROR_MESSAGES, t).find(opt => opt.id === "unknown")?.label ?? ""
    );
  };

  const isModeBusy = busyMode !== null;
  const isAutoLoading = isModeBusy && busyMode === "auto";
  const isManualLoading = isModeBusy && busyMode === "manual";

  const footerLabel = step === "loginMode" && selectedPlatform ? selectedPlatform.label : null;

  return (
    <div className="fb-login-mode-container switch-platform-page switch-platform-redesign">
      {/* Platform switcher preview section */}
      <div className="switch-platform-redesign__shell">
        <WorkspacePageHeader
          eyebrow={t("platform")}
          title={selectedPlatform
            ? t("chooseConnect")
            : t("switchPlatform")
          }
          description={selectedPlatform
            ? t("chooseOne") :
            t("chooseNetwork")
          } />

        {/* Progress indicator for platform switch steps */}
        <div className="switch-platform-redesign__progress">
          <span className="is-complete" /><span className={selectedPlatform ? "is-complete" : ""} />
        </div>

        {/* Platform switcher section */}
        {selectedPlatform
          ?
          < section className="switch-platform-redesign__section">
            <button className="switch-platform-redesign__back"
              onClick={() => setSelectedPlatform(null)}>← {t("allPlatforms")}
            </button>
            <div className="switch-platform-redesign__selected">
              <strong>{selectedPlatform.label}</strong>
              <span className="switch-platform-redesign__selected-check">✓</span>
            </div>
            <div className="switch-platform-redesign__section-heading">
              <span>{t("signInMethod")}</span>
            </div>
            <div className="switch-platform-redesign__mode-list">
              <button
                className="switch-platform-redesign__mode"
                onClick={() => void handleLoginMode("auto")}
              >
                <span className="switch-platform-redesign__mode-icon">⚡</span>
                <span className="switch-platform-redesign__mode-copy">
                  <strong>{t("systemAccount")}</strong>
                  <small>{t("systemAccountHint")}</small>
                </span>
                <span className="switch-platform-redesign__mode-arrow">→</span></button>
              <button
                className="switch-platform-redesign__mode"
                onClick={() => void handleLoginMode("manual")}
              >
                <span className="switch-platform-redesign__mode-icon">↗</span>
                <span className="switch-platform-redesign__mode-copy">
                  <strong>{t("personalAccount")}</strong>
                  <small>{t("personalAccountHint")}</small>
                </span>
                <span className="switch-platform-redesign__mode-arrow">→</span>
              </button>
            </div>
          </section>
          :
          <section className="switch-platform-redesign__section">
            <div className="switch-platform-redesign__section-heading">
              <span>{t("availableNetworks")}</span>
              <span>{t("selectPlatform")} ↓</span>
            </div>
            <PlatformSelect
              busyId={busyId}
              variant="switch"
              currentPlatformId="facebook"
              onSelectPlatform={(platform) => handleSelectPlatform(platform)} />
            <p className="switch-platform-redesign__hint">
              {t("platformHintSafe")}
            </p>
          </section>
        }
      </div>
    </div >
  );
};

export default FacebookLoginMode;