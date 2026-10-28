import { createFormHook } from "@tanstack/react-form";
import { SwitchField, TextareaField, TextField } from "./fields";
import { fieldContext, formContext } from "./form-context";
import { SubmitButton } from "./submit-button";

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField, SwitchField },
  formComponents: { SubmitButton },
});
