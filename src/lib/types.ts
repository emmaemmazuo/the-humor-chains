export type Step = {
  id: number;
  humor_flavor_id: number;
  order_by: number;
  description: string | null;
  llm_system_prompt: string | null;
  llm_user_prompt: string | null;
  llm_temperature: number | null;
  llm_model_id: number;
  llm_input_type_id: number;
  llm_output_type_id: number;
  humor_flavor_step_type_id: number;
  is_hidden: boolean;
};

export type Option = { id: number; label: string; hint?: string };

export type StepOptions = {
  models: Option[];
  stepTypes: Option[];
  inputTypes: Option[];
  outputTypes: Option[];
};

export type RunStepInfo = {
  id: number;
  position: number;
  description: string | null;
  inputTypeId: number;
  outputTypeId: number;
};

export type ImageChoice = { id: string; url: string; description: string | null };
