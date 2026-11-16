export type PersonaSummary = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  job: string;
  gender: string;
  country: string;
  status: string;
};
export type PersonaState = {
  selectedPersonaId: string | null;
  selectedPersona: PersonaSummary | null;
  mode: "config_bound" | "persona_bound";
  canSwitch: boolean;
  revision: number;
  status: "unselected" | "selected";
};
export type PersonaPreparation = {
  state: PersonaState;
  candidates: PersonaSummary[];
  recommendedPersonaId: string | null;
  status: "ready" | "selection_required";
};
